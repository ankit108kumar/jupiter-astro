# JupiterAstro Hybrid Transit Engine V2.1

**Research-only.** V2.1 is a new standalone file. It does not overwrite V1 or V2.

## Motion policy (user-approved)

| Planets | Rule |
|---|---|
| Sun, Moon | Always progressive/direct. No dynamic retrograde test. |
| Rahu, Ketu | Always retrograde. No dynamic direct test. |
| Mars, Mercury, Venus, Jupiter, Saturn | Dynamic direction from consecutive JSON Navamsa labels, cross-checked against the existing sidereal-longitude calculation. |

The fixed four planets bypass dynamic classification. Their established rules are deliberately not modified.

## JSON database

Uses `Planetary Transit correction v4.json`, New Delhi / Asia-Kolkata (+05:30).

For the five dynamic planets, V2.1 uses their `Navamsa` arrays as the chronological reference sequence. The labels contain the Navamsa sign, e.g. `Gemini (3)`. Consecutive labels are interpreted cyclically:

- label index advances by one (including Pisces → Aries): progressive/direct;
- label index retreats by one (including Aries → Pisces): retrograde;
- any non-adjacent transition: unresolved and flagged.

The v4 database has Navamsa arrays for Mars, Mercury, Venus, Jupiter and Saturn. V2.1 deliberately does not substitute Sign or Nakshatra arrays as a direction proxy for these five.

## Existing longitude cross-check

Pass the existing JupiterAstro sidereal longitude function as `getSiderealLongitude(planet, timestampMs)`. V2.1 samples it throughout each JSON Navamsa interval, unwraps the 0°/360° transition, computes local angular speed, and labels sample runs as direct, retrograde or stationary.

For the five dynamic planets:
- JSON Navamsa direction is the reference direction.
- Existing sidereal longitude is the independent motion cross-check.
- A disagreement, station or reversal is exposed in diagnostics.
- The engine does not silently override a disagreement.

For Sun, Moon, Rahu and Ketu, the fixed motion policy is applied without dynamic direction inference. The longitude profile is still inspected for calibration diagnostics, but the fixed policy is not changed by it.

## Calibration and internal boundaries

Each pair of consecutive Navamsa events represents 3°20′ of sidereal zodiac travel in the reference direction. V2.1 normalizes the sampled ephemeris profile to that reference span and searches each sampled motion segment for internal crossings. It does not assume that the entire interval is monotonic.

The JSON Navamsa events themselves are the primary calibrated boundaries. For sign ingress, a sign boundary occurs at each ninth Navamsa boundary; for Nakshatra pada, every Navamsa boundary corresponds to a 3°20′ pada segment. Use the corresponding JSON arrays directly when present for event-level comparisons.

## Integration

Load V2.1 as a separate script. It registers `window.JAHybridTransitV21`.

```js
const msToJd = ms => ms / 86400000 + 2440587.5;

// Connect the exact existing sidereal longitude calculation.
// The callback must return Lahiri sidereal longitude in degrees [0, 360).
const getSiderealLongitude = (planet, timestampMs) =>
  siderealPlanetLongitude(planet, msToJd(timestampMs));

const result = window.JAHybridTransitV21.analyzeDatabase({
  database: planetaryTransitCorrectionV4,
  planet: "Saturn",
  division: "Navamsa",
  getSiderealLongitude,
  sampleCount: 512,
  subdivisions: 1,
  stationaryThresholdDegPerDay: 0.01,
  timeToleranceMs: 250
});
```

Start with a small index range:

```js
const test = window.JAHybridTransitV21.analyzeDatabase({
  database: planetaryTransitCorrectionV4,
  planet: "Saturn",
  division: "Navamsa",
  getSiderealLongitude,
  startIndex: 0,
  endIndex: 20,
  sampleCount: 512
});
```

## Important output

- `reference.direction`: fixed policy for Sun/Moon/Rahu/Ketu; consecutive Navamsa-label direction for the other five.
- `ephemeris.overallMotion`: direct, retrograde, stationary or mixed.
- `ephemeris.motionAgreement`: agreement / review diagnostic.
- `ephemeris.directionMismatch`: net direction conflicts with the reference.
- `diagnostics.motionRuns`: chronological motion phases.
- `diagnostics.hasStationaryPortion` and `hasDirectionReversal`.
- `crossings`: internal target crossings detected in each sampled monotonic subsegment.
- `errors`: per-interval errors; non-adjacent Navamsa label transitions are not silently treated as direct or retrograde.

## Validation status

- JavaScript syntax check: passed.
- Parsed all nine planet records from v4 JSON.
- Confirmed Navamsa event arrays for all five dynamic planets.
- Direction counts were derived from the actual JSON sequence:
  - Saturn: 526 direct, 183 retrograde intervals.
  - Jupiter: 1,103 direct, 255 retrograde intervals.
  - Mars: 5,562 direct, 209 retrograde intervals.
  - Mercury: 11,226 direct, 1,181 retrograde intervals.
  - Venus: 10,331 direct, 281 retrograde intervals.
- Confirmed fixed policies: Sun/Moon direct; Rahu/Ketu retrograde.

These counts validate parser and label-direction handling only. They do not validate the astronomical accuracy of the existing longitude calculation or the JSON reference timestamps.

## Separation

Keep all three modules:
- `hybrid-navamsa-engine.js` — original implementation.
- `hybrid-transit-engine-v2.js` — previous research version.
- `hybrid-transit-engine-v2.1.js` — new agreed motion-policy version.