# JupiterAstro — Hybrid Calibrated Longitude Navamsa Method

## Status and scope

This is a **standalone research implementation** of the hybrid Navamsa/Pada ingress method. It is intentionally not imported into `index.html` and does not modify or replace the production ephemeris, transit timeline, chart calculations, or existing Navamsa logic.

Supported planets and motion:

- **Sun and Moon:** direct sidereal motion; chronological Pada sequence 1 → 2 → 3 → 4.
- **Rahu:** retrograde sidereal motion; chronological Pada sequence 4 → 3 → 2 → 1.

Ketu and other planets are not enabled in this research module.

## Calculation principle

The correction/reference database supplies the timestamp at which a planet enters a Nakshatra. The next entry for that planet supplies the exit timestamp. The interval is therefore bounded by two reference timestamps.

Within that interval:

1. Read the existing JupiterAstro ephemeris' Lahiri sidereal longitude at the entry and exit timestamps.
2. Calculate the signed angular displacement, accounting for the planet's direction of motion.
3. Sample the ephemeris at intermediate times and verify that its angular progression is monotonic in the expected direction.
4. Normalize the ephemeris' within-interval angular progression to exactly 13°20′ (the full Nakshatra span). This preserves the ephemeris' relative speed variation while anchoring the result to the reference interval endpoints.
5. Solve the three internal 3°20′ Pada boundaries using bisection.
6. Return the four chronological Pada ranges and their Navamsa signs.

For Rahu, the first point of a retrograde Nakshatra interval is Pada 4. The three internal crossings therefore move from Pada 4 to 3, 3 to 2, and 2 to 1. The code handles this direction explicitly; do not reverse the returned rows again.

The reference entry and exit timestamps are exact by construction. Intermediate timestamps are estimates derived from the existing ephemeris' motion profile. Solver tolerance controls numerical root resolution; it does not establish astronomical accuracy beyond the precision of the reference data and ephemeris.

## Files

- `hybrid-navamsa-engine.js` — standalone UMD module, usable in a browser or Node.js.

## Integration adapter for JupiterAstro's current ephemeris

The current `siderealPlanetLongitude(planet, jd)` function takes a Julian Day. The hybrid module's callback takes epoch milliseconds, so adapt milliseconds to JD:

```js
const msToJd = ms => ms / 86400000 + 2440587.5;

const result = window.JAHybridNavamsa.calculate({
  planet: "Rahu",                 // "Sun", "Moon", or "Rahu"
  nakshatraIndex: "Ashwini",      // name or zero-based index (Ashwini = 0)
  entryTime: entryMs,
  exitTime: exitMs,
  getSiderealLongitude: (planet, timestampMs) =>
    siderealPlanetLongitude(planet, msToJd(timestampMs)),
  timeToleranceMs: 250
});
```

Load the standalone module only in a research/test harness when required. It is not wired into the live application by this change.

## Parsing correction-database timestamps

The correction JSON uses local New Delhi/IST timestamps without an explicit UTC offset, for example `2023-02-20T22:54:00`. Do not pass such strings directly to `Date.parse()`: the result depends on the runtime's local timezone. Use the explicit IST parser: