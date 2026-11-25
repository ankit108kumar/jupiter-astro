/*
 * JupiterAstro Global Ephemeris Calculator v1.0
 * Self-contained browser module; loads two local coefficient JSON files.
 *
 * Models:
 *  - Sun, Mercury, Venus, Mars, Jupiter, Saturn: VSOP87D
 *  - Moon: Meeus Astronomical Algorithms, Chapter 47 / Table 47.A
 *  - Rahu: mean ascending lunar node
 *  - Ketu: exactly 180 degrees from Rahu
 *
 * Coordinates: geocentric ecliptic longitude of date, sidereal Lahiri.
 * Input timestamps: ISO-like local date/time with explicit UTC offset,
 * or a Date object. Default numeric input is Unix milliseconds.
 *
 * Coefficient sources and notices:
 *  - VSOP87: Bretagnon & Francou (1988), VSOP87; coefficient files
 *    distributed by ctdk/vsop87.
 *  - Lunar Table 47.A: Meeus; coefficient table distributed by
 *    PyMeeus under LGPL-3.0. See repository source notices.
 *
 * This implementation intentionally does not replace the application's
 * existing global functions. It exposes JupiterAstroGlobalEphemeris.
 */
(function (root) {
  'use strict';

  const VERSION = 'JupiterAstro-global-ephemeris-v1.0';
  const PLANETS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Rahu','Ketu'];
  const NAKSHATRAS = [
    'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
    'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
    'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula',
    'Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha',
    'Purva Bhadrapada','Uttara Bhadrapada','Revati'
  ];
  const SIGNS = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
  ];
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const DAY_MS = 86400000;
  const J2000 = 2451545.0;

  let coefficientsPromise = null;
  let coefficients = null;
  let lunarTerms = null;

  const rev = x => ((x % 360) + 360) % 360;
  const sinD = x => Math.sin(x * RAD);
  const cosD = x => Math.cos(x * RAD);

  // Agreed JupiterAstro Lahiri polynomial. Do not alter without approval.
  function lahiri(jdTT) {
    const T = (jdTT - J2000) / 36525;
    return 23.857092 +
      (5028.796195 * T + 1.1054348 * T * T) / 3600;
  }

  // Espenak-Meeus polynomial approximation for Delta-T (TT-UT), seconds.
  // Valid around the requested modern epoch; broad historical dates are
  // approximate and should be checked against a maintained Delta-T table.
  function deltaTSeconds(year) {
    let u, t;
    if (year >= 2005 && year < 2050) {
      t = year - 2000;
      return 62.92 + 0.32217*t + 0.005589*t*t;
    }
    if (year >= 1986 && year < 2005) {
      t = year - 2000;
      return 63.86 + 0.3345*t - 0.060374*t*t +
        0.0017275*t*t*t + 0.000651814*t*t*t*t +
        0.00002373599*t*t*t*t*t;
    }
    if (year >= 2050 && year < 2150) {
      return -20 + 32 * Math.pow((year - 1820) / 100, 2) -
        0.5628 * (2150 - year);
    }
    if (year >= 2000 && year < 2005) {
      t = year - 2000;
      return 63.86 + 0.3345*t - 0.060374*t*t +
        0.0017275*t*t*t + 0.000651814*t*t*t*t +
        0.00002373599*t*t*t*t*t;
    }
    u = (year - 2000) / 100;
    return 64.7 + 64.5*u + 33.5*u*u;
  }

  function julianDayUTC(date) {
    return date.getTime() / DAY_MS + 2440587.5;
  }

  function utcToTT(date) {
    const year = date.getUTCFullYear() +
      (date.getUTCMonth() + (date.getUTCDate()-1)/31) / 12;
    return julianDayUTC(date) + deltaTSeconds(year) / 86400;
  }

  async function loadData(basePath) {
    if (coefficients && lunarTerms) return;
    if (!coefficientsPromise) {
      const base = (basePath || './data/').replace(/\/?$/, '/');
      coefficientsPromise = Promise.all([
        fetch(base + 'jupiterastro-vsop87d.json').then(r => {
          if (!r.ok) throw new Error('Unable to load VSOP87D data: HTTP ' + r.status);
          return r.json();
        }),
        fetch(base + 'jupiterastro-meeus-moon-terms.json').then(r => {
          if (!r.ok) throw new Error('Unable to load Meeus lunar data: HTTP ' + r.status);
          return r.json();
        })
      ]).then(([v,m]) => {
        if (!v || v.format !== 'VSOP87D' || !v.bodies ||
            !v.bodies.Earth || !v.bodies.Mercury ||
            !v.bodies.Venus || !v.bodies.Mars ||
            !v.bodies.Jupiter || !v.bodies.Saturn) {
          throw new Error('VSOP87D dataset is incomplete or incompatible.');
        }
        if (!m || !Array.isArray(m.terms) || m.terms.length !== 60) {
          throw new Error('Meeus Table 47.A must contain exactly 60 terms.');
        }
        coefficients = v;
        lunarTerms = m.terms;
      }).catch(error => {
        coefficientsPromise = null;
        throw error;
      });
    }
    return coefficientsPromise;
  }

  // VSOP87D: each row is [A, B, C], in L/B radians or R AU.
  function evaluateSeries(series, tau) {
    let total = 0;
    for (let order = 0; order < series.length; order++) {
      const terms = series[order] || [];
      let subtotal = 0;
      for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        subtotal += term[0] * Math.cos(term[1] + term[2] * tau);
      }
      total += subtotal * Math.pow(tau, order);
    }
    return total;
  }

  function heliocentricSpherical(body, jdTT) {
    const tau = (jdTT - J2000) / 365250;
    const data = coefficients.bodies[body];
    if (!data) throw new Error('Missing VSOP87D body: ' + body);
    return {
      L: rev(evaluateSeries(data[0], tau) * DEG),
      B: evaluateSeries(data[1], tau) * DEG,
      R: evaluateSeries(data[2], tau)
    };
  }

  function sphericalToVector(p) {
    const L = p.L * RAD, B = p.B * RAD, R = p.R;
    return [
      R * Math.cos(B) * Math.cos(L),
      R * Math.cos(B) * Math.sin(L),
      R * Math.sin(B)
    ];
  }

  function vectorToLongitude(v) {
    return rev(Math.atan2(v[1], v[0]) * DEG);
  }

  function subtract(a,b) {
    return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  }

  function norm(v) {
    return Math.hypot(v[0],v[1],v[2]);
  }

  function geocentricPlanetLongitude(body, jdTT) {
    const earth = sphericalToVector(heliocentricSpherical('Earth', jdTT));
    let planetJD = jdTT;
    let geo;
    // Iterate light-time using distance in AU; 0.0057755183 day per AU.
    for (let i=0; i<3; i++) {
      const planet = sphericalToVector(heliocentricSpherical(body, planetJD));
      geo = subtract(planet, earth);
      planetJD = jdTT - norm(geo) * 0.0057755183;
    }
    return vectorToLongitude(geo);
  }

  function geocentricSunLongitude(jdTT) {
    const earth = sphericalToVector(heliocentricSpherical('Earth', jdTT));
    return vectorToLongitude([-earth[0],-earth[1],-earth[2]]);
  }

  function moonLongitudeMeeus(jdTT) {
    const T = (jdTT - J2000) / 36525;
    const Lp = rev(218.3164477 + 481267.88123421*T -
      0.0015786*T*T + T*T*T/538841 - T*T*T*T/65194000);
    const D = rev(297.8501921 + 445267.1114034*T -
      0.0018819*T*T + T*T*T/545868 - T*T*T*T/113065000);
    const M = rev(357.5291092 + 35999.0502909*T -
      0.0001536*T*T + T*T*T/24490000);
    const Mp = rev(134.9633964 + 477198.8675055*T +
      0.0087414*T*T + T*T*T/69699 - T*T*T*T/14712000);
    const F = rev(93.2720950 + 483202.0175233*T -
      0.0036539*T*T - T*T*T/3526000 + T*T*T*T/863310000);
    const E = 1 - 0.002516*T - 0.0000074*T*T;
    let sum = 0;
    for (const term of lunarTerms) {
      const [d,m,mp,f,longitude] = term;
      const factor = Math.abs(m) === 1 ? E :
        Math.abs(m) === 2 ? E*E : 1;
      sum += longitude * factor *
        sinD(d*D + m*M + mp*Mp + f*F);
    }
    const A1 = 119.75 + 131.849*T;
    const A2 = 53.09 + 479264.290*T;
    sum += 3958*sinD(A1) +
      1962*sinD(Lp-F) +
      318*sinD(A2);
    return rev(Lp + sum/1000000);
  }

  function meanNodeLongitude(jdTT) {
    const T = (jdTT - J2000) / 36525;
    return rev(125.0445479 - 1934.1362891*T +
      0.0020754*T*T + T*T*T/467441 -
      T*T*T*T/60616000);
  }

  function tropicalLongitude(planet, jdTT) {
    switch (planet) {
      case 'Sun': return geocentricSunLongitude(jdTT);
      case 'Moon': return moonLongitudeMeeus(jdTT);
      case 'Mercury': case 'Venus': case 'Mars':
      case 'Jupiter': case 'Saturn':
        return geocentricPlanetLongitude(planet, jdTT);
      case 'Rahu': return meanNodeLongitude(jdTT);
      case 'Ketu': return rev(meanNodeLongitude(jdTT)+180);
      default: throw new Error('Unsupported planet: ' + planet);
    }
  }

  function dms(degrees) {
    let total = Math.round(rev(degrees) * 3600);
    total %= 360 * 3600;
    const d = Math.floor(total/3600);
    const m = Math.floor((total%3600)/60);
    const s = total%60;
    return {degrees:d, minutes:m, seconds:s,
      formatted:String(d).padStart(2,'0') + '° ' +
        String(m).padStart(2,'0') + '′ ' +
        String(s).padStart(2,'0') + '″'};
  }

  function classify(siderealLongitude) {
    const lon = rev(siderealLongitude);
    const signIndex = Math.floor(lon/30);
    const withinSign = lon - signIndex*30;
    const nakSpan = 360/27;
    const nakIndex = Math.floor(lon/nakSpan);
    const withinNak = lon - nakIndex*nakSpan;
    const pada = Math.floor(withinNak/(nakSpan/4))+1;
    const navamsaIndex = Math.floor(rev(lon*9)/30);
    return {
      sign: SIGNS[signIndex],
      signIndex,
      degreeInSign: dms(withinSign),
      nakshatra: NAKSHATRAS[nakIndex],
      nakshatraIndex: nakIndex,
      pada,
      navamsa: SIGNS[navamsaIndex],
      siderealLongitude: lon
    };
  }

  function calculateAll(jdTT) {
    const result = {};
    for (const planet of PLANETS) {
      const tropical = tropicalLongitude(planet,jdTT);
      const sidereal = rev(tropical-lahiri(jdTT));
      result[planet] = {
        planet,
        tropicalLongitude: tropical,
        siderealLongitude: sidereal,
        ...classify(sidereal)
      };
    }
    // Enforce exact opposite node axis in the final reported values.
    result.Ketu.siderealLongitude = rev(result.Rahu.siderealLongitude+180);
    Object.assign(result.Ketu, classify(result.Ketu.siderealLongitude));
    return result;
  }

  function parseInput(input) {
    if (input instanceof Date) return new Date(input.getTime());
    if (typeof input === 'number') return new Date(input);
    if (typeof input === 'string') {
      const d = new Date(input);
      if (!Number.isFinite(d.getTime())) throw new Error('Invalid date/time input.');
      return d;
    }
    throw new TypeError('Pass a Date, ISO date-time string with timezone, or Unix milliseconds.');
  }

  async function calculate(input, options) {
    await loadData(options && options.dataPath);
    const date = parseInput(input);
    const jdTT = utcToTT(date);
    return {
      version: VERSION,
      inputUTC: date.toISOString(),
      jdTT,
      deltaTSeconds: deltaTSeconds(date.getUTCFullYear()),
      ayanamsa: lahiri(jdTT),
      zodiac: 'Sidereal Lahiri',
      nodeType: 'Mean node',
      positions: calculateAll(jdTT)
    };
  }

  root.JupiterAstroGlobalEphemeris = Object.freeze({
    version: VERSION,
    planets: PLANETS.slice(),
    load: loadData,
    calculate,
    calculateAll,
    tropicalLongitude,
    siderealLongitude: (planet,jdTT) =>
      rev(tropicalLongitude(planet,jdTT)-lahiri(jdTT)),
    lahiri,
    deltaTSeconds,
    classify
  });
})(typeof window !== 'undefined' ? window : globalThis);
