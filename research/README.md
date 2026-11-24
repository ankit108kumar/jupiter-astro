# JupiterAstro — Planetary Reference Reconciliation

## Status and scope

Phase 1 integrates the standalone \`JAPlanetaryReference\` reconciliation engine into the live JupiterAstro transit view through external script references. The reconciliation logic remains in its own JavaScript files; it is not duplicated in the main HTML.

Supported planets:
- **Saturn**
- **Jupiter**
- **Rahu**
- **Ketu**

The existing JupiterAstro sidereal ephemeris remains the astronomical calculation engine. It continues to calculate planetary longitude and positions. Reference reconciliation does not replace or modify that ephemeris. It supplies the selected-time division labels and reference ingress/egress timestamps and durations.

## Reference source by planet and division

| Planet | Sign | Nakshatra | Navamsa |
|---|---|---|---|
| Saturn | JSON reference | JSON reference | JSON reference |
| Jupiter | JSON reference | JSON reference | JSON reference |
| Rahu | JSON reference | JSON reference | Hybrid derivation using JSON Nakshatra anchors + existing ephemeris |
| Ketu | JSON reference | JSON reference | Hybrid derivation using JSON Nakshatra anchors + existing ephemeris |

The empty \`Rahu.Navamsa\` and \`Ketu.Navamsa\` arrays in the correction JSON are placeholders indicating that direct Navamsa reference events are unavailable. They are not valid empty reference series. The reconciliation engine detects these empty arrays and derives the Navamsa transitions. No synthetic Navamsa records are inserted into the correction JSON.

## Hybrid Navamsa method for Rahu and Ketu

The correction/reference database supplies consecutive Nakshatra entry timestamps for the same planet. The next entry for that same planet supplies the current Nakshatra interval's exit.

1. Read the existing ephemeris' Lahiri sidereal longitude at both endpoints.
2. Determine the signed direction from the consecutive reference Nakshatra labels.
3. Sample intermediate longitudes and unwrap the angular progression.
4. Verify that the ephemeris progression agrees with the reference direction and is monotonic.
5. Calibrate the sampled net angular travel to the exact signed Nakshatra span of 13°20′, preserving the ephemeris' relative speed profile.
6. Solve the three internal 3°20′ Navamsa boundaries by bisection inside the sampled brackets.
7. Combine the derived transitions across consecutive Nakshatra intervals to form a chronological Navamsa event series.

For retrograde Rahu and Ketu, the chronological path traverses the Nakshatra's fourth, third, second and first Pada. The hybrid solver anchors the chronological entry at the upper Nakshatra boundary and preserves retrograde ordering. The same planet's Nakshatra events are used as anchors; Rahu timestamps are never reused as Ketu timestamps.

The endpoint timestamps are anchored to the JSON Nakshatra references. Internal Navamsa transition timestamps are estimates derived from the existing ephemeris motion profile. Solver tolerance is numerical precision, not proof of equivalent astronomical accuracy.

## Application integration

The production HTML loads the reconciliation engine and its application adapter as external scripts:

- \`/research/planetary-reference-reconciliation.js\`
- \`/research/planetary-reference-transit-adapter.js\`

The adapter reads the selected transit timestamp and obtains the current sidereal longitude through the existing \`siderealPlanetLongitude(planet, jd)\` function. The adapter converts epoch milliseconds to Julian Day for that callback.

For all four planets, the transit reconciliation table reports:
- Current Sign, Nakshatra and Navamsa labels.
- Entry and exit timestamps for each division.
- Total duration of the current interval.
- The source used: JSON reference or hybrid derivation.

Reference timestamps are interpreted using the correction database's declared timezone and UTC offset. The current correction dataset is based on New Delhi/IST. Displayed reference timestamps are explicitly labelled IST.

The adapter and reconciliation engine do not write to or modify the correction JSON. The engine may cache the loaded source database in IndexedDB for application performance.

## Reconciliation API

\`\`\`js
const engine = window.JAPlanetaryReference.create({
  url: '/data/Planetary%20Transit%20correction%20v4.json'
});

await engine.init();

const result = await engine.verify({
  planet: 'Ketu',                 // Saturn, Jupiter, Rahu, or Ketu
  timestamp: selectedTimestampMs,
  calculated: {
    Sign: 'Sagittarius (9)',
    Nakshatra: 'Mula First Pada',
    Navamsa: 'Leo (5)'
  },
  ephemerisLongitudeAt: (planet, timestampMs) =>
    siderealPlanetLongitude(planet, timestampMs / 86400000 + 2440587.5),
  ephemerisVersion: 'JupiterAstro-existing-sidereal-ephemeris'
});
\`\`\`

Use \`verifyAll({ timestamp, calculated, ephemerisLongitudeAt, ephemerisVersion })\` to reconcile all four supported planets at the same selected timestamp.

## Correction JSON timestamps

The correction JSON timestamps are local New Delhi/IST wall-clock values without an offset, e.g. \`2023-02-20T22:54:00\`. The engine interprets them using \`metadata.utc_offset\`; do not pass these strings directly to \`Date.parse()\` or apply the IST conversion twice. ISO timestamps that already contain \`Z\` or an explicit offset are parsed as offset-aware timestamps.

## Output and status

For each division, the verification result includes:
- The existing ephemeris-derived calculated label.
- The reference/final label and whether the label differs.
- Entry and exit timestamps, elapsed time, remaining time and total interval duration when covered.
- Reference source and direction.
- Derived Navamsa diagnostics for Rahu/Ketu, including calibration and solver metadata.

Intervals beyond the final available reference event have no known exit timestamp and are marked open-ended. Timestamps before the first reference event are outside coverage. Missing or invalid data is not silently substituted with another planet's events.

## Validation protocol

Validate each planet and division independently against an external reference such as Drik Panchang. For derived Rahu/Ketu Navamsa transitions, compare:
1. **Hybrid calibrated longitude:** sampled ephemeris profile calibrated to the JSON Nakshatra interval.
2. **Equal-quarter baseline:** entry plus 1/4, 2/4 and 3/4 of the reference interval.
3. **Direct-longitude baseline:** solve the absolute Navamsa boundaries using the uncalibrated ephemeris.

Report signed error, mean/median/maximum absolute error, exact-minute matches, and percentages within stated tolerances. State source precision explicitly. A minute-rounded reference cannot validate sub-minute astronomical accuracy. Validate multiple years and Nakshatras, inspect endpoint residuals and monotonicity, and use an independent ephemeris/reference before making broad accuracy claims.

## Explicit boundaries of Phase 1

- The existing planetary longitude and chart calculation engine is not replaced or modified.
- The reconciliation engine remains in its own JavaScript file and is connected through external script tags.
- No artificial Rahu/Ketu Navamsa rows are added to the correction JSON.
- The correction JSON itself is not modified.
- The reference dataset remains New Delhi/IST based; this phase displays those reference timestamps in IST and does not apply a geographic time correction to the astronomical event.
