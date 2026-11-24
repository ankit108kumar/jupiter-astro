/* =========================================================================
   JupiterAstro — Hybrid Transit Engine V2.1 (research-only)
   -------------------------------------------------------------------------
   Separate from hybrid-navamsa-engine.js. Does not replace or modify it.

   Purpose:
   - Use Planetary Transit correction JSON as the reference event timeline.
   - Support Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu.
   - Infer direct / retrograde direction from consecutive JSON boundary labels.
   - Inspect the existing sidereal-longitude engine for direct, retrograde,
     stationary and mixed-motion portions.
   - Calibrate the ephemeris motion profile to each JSON-to-JSON interval.
   - Find internal equal-division crossings without assuming monotonic motion.

   The JSON timestamps remain the reference anchors. This module does not
   claim that the existing ephemeris or the JSON is independently exact.
   ========================================================================= */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JAHybridTransitV21 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PLANETS = Object.freeze([
    "Sun", "Moon", "Mars", "Mercury", "Jupiter",
    "Venus", "Saturn", "Rahu", "Ketu"
  ]);
  const FIXED_DIRECT = new Set(["Sun", "Moon"]);
  const FIXED_RETROGRADE = new Set(["Rahu", "Ketu"]);
  const DYNAMIC_PLANETS = new Set(["Mars", "Mercury", "Venus", "Jupiter", "Saturn"]);

  const DIVISIONS = Object.freeze({
    Sign:     { field: "sign",     count: 12, spanDeg: 30 },
    Nakshatra:{ field: "nakshatra",count: 27, spanDeg: 40 / 3 },
    Navamsa:  { field: "navamsa",  count: 12, spanDeg: 10 / 3 }
  });

  const SIGN_NAMES = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  const NAK_NAMES = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
    "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha",
    "Shravana", "Dhanishtha", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati"
  ];

  const mod = (n, m) => ((n % m) + m) % m;
  const normalize360 = x => mod(Number(x), 360);

  function signedDelta(fromDeg, toDeg) {
    let d = normalize360(toDeg) - normalize360(fromDeg);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // JSON timestamps are local New Delhi wall-clock values without an offset.
  function parseIstTimestamp(value) {
    if (typeof value !== "string") throw new TypeError("Expected an IST timestamp string.");
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if (!m) throw new TypeError("Expected YYYY-MM-DDTHH:mm[:ss[.SSS]] without timezone.");
    const [, y, mo, d, h, mi, sec = "0", fraction = "0"] = m;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec,
      Number(fraction.padEnd(3, "0"))) - 330 * 60000;
  }

  function toMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new TypeError("Invalid timestamp.");
    return parsed;
  }

  function getLabelIndex(record, division) {
    const cfg = DIVISIONS[division];
    const raw = record && record[cfg.field];
    if (typeof raw !== "string") return -1;

    if (division === "Sign") {
      const match = raw.match(/\((\d{1,2})\)\s*$/);
      if (match) {
        const n = Number(match[1]);
        if (n >= 1 && n <= 12) return n - 1;
      }
      const clean = raw.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
      return SIGN_NAMES.findIndex(x => x.toLowerCase() === clean);
    }

    const clean = raw.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
    return (division === "Nakshatra" ? NAK_NAMES : SIGN_NAMES)
      .findIndex(x => x.toLowerCase() === clean);
  }

  function getReferenceEvents(database, planet, division) {
    if (!PLANETS.includes(planet)) throw new RangeError("Unsupported planet: " + planet);
    const cfg = DIVISIONS[division];
    if (!cfg) throw new RangeError("Unsupported division: " + division);
    const source = database && database.data && database.data[planet] &&
      database.data[planet][division];

    if (!Array.isArray(source) || source.length < 2) {
      throw new Error("No usable " + division + " reference array for " + planet + ".");
    }

    const events = source.map((record, sourceIndex) => {
      const labelIndex = getLabelIndex(record, division);
      if (labelIndex < 0) {
        throw new Error("Unrecognized " + division + " label at " + planet +
          " record " + sourceIndex + ".");
      }
      return {
        planet, division, sourceIndex,
        label: record[cfg.field],
        labelIndex,
        timestampMs: parseIstTimestamp(record.entered_at),
        enteredAt: record.entered_at
      };
    }).sort((a, b) => a.timestampMs - b.timestampMs);

    for (let i = 1; i < events.length; i++) {
      if (events[i].timestampMs <= events[i - 1].timestampMs) {
        throw new Error("Duplicate or non-increasing reference timestamps for " + planet + ".");
      }
    }
    return events;
  }

  function getReferenceStep(a, b, count, planet) {
    if (FIXED_DIRECT.has(planet)) return { direction: 1, step: 1, motion: "direct-fixed" };
    if (FIXED_RETROGRADE.has(planet)) return { direction: -1, step: -1, motion: "retrograde-fixed" };
    const forward = mod(b.labelIndex - a.labelIndex, count);
    if (forward === 1) return { direction: 1, step: 1, motion: "direct" };
    if (forward === count - 1) return { direction: -1, step: -1, motion: "retrograde" };
    return {
      direction: 0,
      step: forward,
      motion: "non-adjacent-reference-label",
      forwardDistance: forward
    };
  }

  function classifySpeed(speed, threshold) {
    if (Math.abs(speed) <= threshold) return "stationary";
    return speed > 0 ? "direct" : "retrograde";
  }

  function compressMotionRuns(samples) {
    if (!samples.length) return [];
    const runs = [];
    let start = 0, current = samples[0].motion;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].motion !== current) {
        runs.push({ motion: current, startIndex: start, endIndex: i - 1 });
        start = i;
        current = samples[i].motion;
      }
    }
    runs.push({ motion: current, startIndex: start, endIndex: samples.length - 1 });
    return runs;
  }

  function analyzeInterval(options) {
    const {
      planet, division, fromEvent, toEvent, getSiderealLongitude,
      sampleCount = 512, stationaryThresholdDegPerDay = 0.01,
      subdivisions = 1, timeToleranceMs = 250
    } = options;

    if (typeof getSiderealLongitude !== "function") {
      throw new TypeError("getSiderealLongitude(planet, timestampMs) callback is required.");
    }
    if (!Number.isInteger(sampleCount) || sampleCount < 16) {
      throw new RangeError("sampleCount must be an integer >= 16.");
    }
    if (!Number.isInteger(subdivisions) || subdivisions < 1) {
      throw new RangeError("subdivisions must be a positive integer.");
    }

    const cfg = DIVISIONS[division];
    const ref = getReferenceStep(fromEvent, toEvent, cfg.count, planet);
    const startMs = fromEvent.timestampMs, endMs = toEvent.timestampMs;
    const durationDays = (endMs - startMs) / 86400000;
    const sampleN = sampleCount;
    const samples = [];
    let previousLon = null, unwrapped = 0;

    for (let i = 0; i <= sampleN; i++) {
      const t = startMs + (endMs - startMs) * i / sampleN;
      const lon = normalize360(getSiderealLongitude(planet, t));
      if (!Number.isFinite(lon)) {
        throw new TypeError("Non-finite sidereal longitude for " + planet + " at " + new Date(t).toISOString());
      }
      if (previousLon !== null) unwrapped += signedDelta(previousLon, lon);
      samples.push({ timestampMs: t, longitude: lon, unwrappedDeg: unwrapped });
      previousLon = lon;
    }

    const stepDays = durationDays / sampleN;
    const speedSamples = [];
    for (let i = 0; i < sampleN; i++) {
      const delta = samples[i + 1].unwrappedDeg - samples[i].unwrappedDeg;
      const speed = stepDays ? delta / stepDays : 0;
      speedSamples.push({
        startMs: samples[i].timestampMs,
        endMs: samples[i + 1].timestampMs,
        deltaDeg: delta,
        speedDegPerDay: speed,
        motion: classifySpeed(speed, stationaryThresholdDegPerDay)
      });
    }

    const nonStationary = speedSamples.filter(x => x.motion !== "stationary");
    const directions = new Set(nonStationary.map(x => x.motion));
    const overallMotion = directions.size === 0 ? "stationary"
      : directions.size === 1 ? [...directions][0] : "mixed";
    const rawNetTravel = samples[sampleN].unwrappedDeg;
    const expectedTravel = ref.direction * cfg.spanDeg * ref.step;

    const directionMismatch = ref.direction !== 0 &&
      Math.abs(rawNetTravel) > 1e-8 &&
      Math.sign(rawNetTravel) !== Math.sign(expectedTravel);

    const canCalibrate = ref.direction !== 0 &&
      Math.abs(rawNetTravel) > 1e-7 && !directionMismatch;
    const calibrationScale = canCalibrate ? expectedTravel / rawNetTravel : null;

    const runs = compressMotionRuns(speedSamples);
    const motionRuns = runs.map(run => ({
      motion: run.motion,
      start: new Date(speedSamples[run.startIndex].startMs).toISOString(),
      end: new Date(speedSamples[run.endIndex].endMs).toISOString(),
      startMs: speedSamples[run.startIndex].startMs,
      endMs: speedSamples[run.endIndex].endMs
    }));

    const crossings = [];
    const failedTargets = [];
    if (canCalibrate && subdivisions > 1) {
      const targetValues = [];
      for (let k = 1; k < subdivisions; k++) {
        targetValues.push(expectedTravel * k / subdivisions);
      }

      for (const target of targetValues) {
        let foundForTarget = false;
        for (let i = 0; i < sampleN; i++) {
          const a = samples[i], b = samples[i + 1];
          const pa = a.unwrappedDeg * calibrationScale;
          const pb = b.unwrappedDeg * calibrationScale;
          if (Math.abs(pb - pa) < 1e-12) continue;
          const lo = Math.min(pa, pb), hi = Math.max(pa, pb);
          if (target < lo - 1e-9 || target > hi + 1e-9) continue;

          // Refine inside this monotonic sample bracket. The local unwrap is
          // anchored to sample a, avoiding a global monotonicity assumption.
          let left = a.timestampMs, right = b.timestampMs;
          const targetRaw = target / calibrationScale;
          const rawAt = t => a.unwrappedDeg + signedDelta(
            a.longitude, normalize360(getSiderealLongitude(planet, t))
          );
          const increasing = b.unwrappedDeg >= a.unwrappedDeg;
          for (let iter = 0; iter < 70 && right - left > timeToleranceMs; iter++) {
            const mid = (left + right) / 2;
            const value = rawAt(mid);
            if ((value < targetRaw) === increasing) left = mid;
            else right = mid;
          }
          const crossingMs = (left + right) / 2;
          const duplicate = crossings.some(x =>
            Math.abs(x.targetProgressDeg - target) < 1e-8 &&
            Math.abs(x.timestampMs - crossingMs) <= Math.max(1000, timeToleranceMs * 2)
          );
          if (duplicate) {
            foundForTarget = true;
            continue;
          }
          crossings.push({
            targetProgressDeg: target,
            crossingIndex: crossings.filter(x => Math.abs(x.targetProgressDeg - target) < 1e-8).length + 1,
            timestampMs: crossingMs,
            iso: new Date(crossingMs).toISOString(),
            betweenSampleIndex: i
          });
          foundForTarget = true;
        }
        if (!foundForTarget) failedTargets.push(target);
      }
    }

    crossings.sort((a, b) => a.timestampMs - b.timestampMs);

    return {
      planet, division,
      reference: {
        from: fromEvent.enteredAt, to: toEvent.enteredAt,
        fromLabel: fromEvent.label, toLabel: toEvent.label,
        direction: ref.motion, directionSign: ref.direction,
        expectedAngularTravelDeg: expectedTravel
      },
      ephemeris: {
        startLongitude: samples[0].longitude,
        endLongitude: samples[sampleN].longitude,
        rawNetTravelDeg: rawNetTravel,
        overallMotion,
        directionMismatch,
        referenceMotion: ref.motion,
        calculatedMotion: overallMotion,
        motionAgreement: ref.direction === 0 ? "unresolved" :
          (directions.size === 1 && [...directions][0] === (ref.direction > 0 ? "direct" : "retrograde")) ? "agree" :
          directions.size === 0 ? "stationary-near-interval" : "review",
        calibrationScale,
        stationaryThresholdDegPerDay
      },
      diagnostics: {
        durationDays,
        sampleCount: sampleN,
        motionRuns,
        hasStationaryPortion: speedSamples.some(x => x.motion === "stationary"),
        hasDirectionReversal: directions.size > 1,
        calibrationAvailable: canCalibrate,
        failedTargets
      },
      crossings,
      sampledProfile: samples
    };
  }

  function analyzeDatabase(options) {
    const {
      database, planet, division = "Sign", getSiderealLongitude,
      sampleCount = 512, stationaryThresholdDegPerDay = 0.01,
      subdivisions = 1, timeToleranceMs = 250,
      startIndex = 0, endIndex
    } = options || {};

    const referenceDivision = DYNAMIC_PLANETS.has(planet) ? "Navamsa" : division;
    const events = getReferenceEvents(database, planet, referenceDivision);
    const last = endIndex == null ? events.length - 1 : Math.min(endIndex, events.length - 1);
    const intervals = [];
    const errors = [];

    for (let i = Math.max(0, startIndex); i < last; i++) {
      try {
        intervals.push(analyzeInterval({
          planet, division: referenceDivision, fromEvent: events[i], toEvent: events[i + 1],
          getSiderealLongitude, sampleCount, stationaryThresholdDegPerDay,
          subdivisions, timeToleranceMs
        }));
      } catch (error) {
        errors.push({ intervalIndex: i, message: error.message });
      }
    }

    return {
      engine: "JupiterAstro Hybrid Transit Engine V2.1",
      version: "2.1.0-research",
      planet, division: referenceDivision,
      requestedDivision: division,
      motionPolicy: FIXED_DIRECT.has(planet) ? "fixed-direct" :
        FIXED_RETROGRADE.has(planet) ? "fixed-retrograde" : "navamsa-reference-plus-sidereal-longitude",
      referenceLocation: database && database.metadata && database.metadata.reference_location,
      timezone: database && database.metadata && database.metadata.timezone,
      referenceEventCount: events.length,
      intervalCount: intervals.length,
      errorCount: errors.length,
      intervals,
      errors
    };
  }

  return Object.freeze({
    analyzeDatabase,
    analyzeInterval,
    getReferenceEvents,
    getReferenceStep,
    parseIstTimestamp,
    signedDelta,
    normalize360,
    constants: Object.freeze({
      planets: PLANETS.slice(),
      divisions: Object.keys(DIVISIONS),
      fixedDirectPlanets: [...FIXED_DIRECT],
      fixedRetrogradePlanets: [...FIXED_RETROGRADE],
      dynamicMotionPlanets: [...DYNAMIC_PLANETS],
      divisionDefinitions: JSON.parse(JSON.stringify(DIVISIONS)),
      signs: SIGN_NAMES.slice(),
      nakshatras: NAK_NAMES.slice()
    })
  });
});