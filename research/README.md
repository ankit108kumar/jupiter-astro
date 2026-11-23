# JupiterAstro — Hybrid Calibrated Longitude Navamsa Method

## Status and scope

This is a **standalone research implementation**. It is not imported into the live application and does not alter the production ephemeris, transit timeline, chart calculations, or current Navamsa logic.

Supported planets:
- **Sun and Moon:** direct sidereal motion; chronological Pada sequence 1 → 2 → 3 → 4.
- **Rahu and Ketu:** retrograde sidereal motion; chronological Pada sequence 4 → 3 → 2 → 1.

The engine determines motion handling from the planet name. It expects the callback to return that planet's own Lahiri sidereal longitude.

## Method

The correction/reference database supplies the Nakshatra entry timestamp. The next entry for the **same planet** supplies the exit timestamp.

1. Read the existing ephemeris' Lahiri sidereal longitude at both endpoints.
2. Calculate signed angular displacement in the expected direction.
3. Sample intermediate longitudes and verify monotonic motion.
4. Normalize the within-interval angular progression to exactly 13°20′, preserving the ephemeris' relative speed profile while anchoring both endpoints to the reference interval.
5. Solve the three internal 3°20′ Pada boundaries by bisection.
6. Return the four chronological Pada ranges and Navamsa signs.

For retrograde Rahu and Ketu, the interval begins at Pada 4 and proceeds through 3, 2, and 1. The module handles this ordering; callers must not reverse the returned rows.

The endpoint timestamps are exact by construction. Internal timestamps are estimates from the ephemeris motion profile. A small solver tolerance is numerical precision, not proof of equivalent astronomical accuracy.

## Integration adapter

The existing JupiterAstro `siderealPlanetLongitude(planet, jd)` accepts Julian Day, while this module's callback receives epoch milliseconds:

```js
const msToJd = ms => ms / 86400000 + 2440587.5;
const result = window.JAHybridNavamsa.calculate({
  planet: "Ketu",                 // "Sun", "Moon", "Rahu", or "Ketu"
  nakshatraIndex: "Ashwini",      // name or zero-based index
  entryTime: entryMs,
  exitTime: exitMs,
  getSiderealLongitude: (planet, timestampMs) =>
    siderealPlanetLongitude(planet, msToJd(timestampMs)),
  timeToleranceMs: 250
});
```

Use the same call shape for Sun, Moon and Rahu; change only `planet` and supply that planet's correct interval. Load this module only in a research/test harness when required. This commit does not wire it into the live application.

## Planet-specific correction records

Select consecutive records from the same planet's Nakshatra reference series. The current record is the interval entry and the next record is its exit; the last record has no following endpoint.

**Important data prerequisite:** the original correction-data inspection established the Sun and Moon Nakshatra series. It did not establish that separate Rahu and Ketu Nakshatra series are present in the JSON. Before running either node, inspect the actual data schema and confirm that a complete, correctly ordered entry series exists for that node. Do not assume `data.Rahu.Nakshatra` or `data.Ketu.Nakshatra` exists. If Ketu reference entries are absent, they must be sourced or derived through a separately validated method before this engine can calculate Ketu transit intervals. Never silently reuse Rahu timestamps as Ketu's own interval timestamps.

The longitude callback must also return the selected node's own sidereal longitude.

## Correction JSON timestamps

The correction JSON timestamps are local New Delhi/IST wall-clock values without an offset, e.g. `2023-02-20T22:54:00`. Do not pass these strings directly to `Date.parse()`, because parsing depends on the runtime timezone. Use:

```js
const entryMs = JAHybridNavamsa.parseIstTimestamp(entry.entered_at);
const exitMs  = JAHybridNavamsa.parseIstTimestamp(nextEntry.entered_at);
```

This parser interprets the value as UTC+05:30 and returns epoch milliseconds. If a source timestamp already contains `Z` or an explicit offset, use ordinary offset-aware ISO parsing instead; do not apply the IST conversion twice.

## Output

- `entry`, `exit`: reference endpoints and sidereal longitudes.
- `boundaries`: three chronological internal transitions, with Pada being left and Pada being entered.
- `padas`: four chronological ranges with Pada number, Navamsa sign, start/end and duration.
- `diagnostics`: angular travel, calibration scale, interval duration, monotonicity and root tolerance.
- `sampledMotionProfile`: sampled raw angular progression for diagnostics.

## Validation and failure behavior

The module throws instead of returning a result if the planet is unsupported, the interval is invalid, endpoint motion has the wrong direction, longitude is non-finite, or sampled motion is non-monotonic.

The callback must return the selected planet's Lahiri sidereal longitude in degrees. Entry and exit must belong to the same planet and Nakshatra transit, and must use the same time basis.

## Validation protocol before production use

Validate each planet separately against an independent reference such as Drik Panchang:

1. **Hybrid calibrated longitude:** this module.
2. **Equal-quarter baseline:** entry plus 1/4, 2/4 and 3/4 of the reference interval. For Rahu/Ketu these transitions correspond to Pada 3, 2 and 1 after the Pada 4 entry.
3. **Direct-longitude baseline:** solve absolute Navamsa boundaries using the uncalibrated ephemeris.

Report signed error, mean/median/maximum absolute error, exact-minute matches, and percentages within stated tolerances. State source precision explicitly. A minute-rounded reference cannot validate sub-minute astronomical accuracy.

Do not conclude universal superiority from a small sample. Validate multiple years and Nakshatras for all four planets, inspect endpoint residuals and monotonicity, and use an independent ephemeris/reference before production integration.

## Explicit non-goals of this commit

- No production integration or replacement of current transit calculations.
- No changes to existing public application files, UI, transit timeline, correction JSON, or deployment configuration.
- No automatic database fetching; callers supply the interval and ephemeris callback.
