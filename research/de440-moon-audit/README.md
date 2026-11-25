# JupiterAstro — JPL DE440s Moon Sign Ingress Audit

Isolated research utility. It does **not** import into or modify the production JupiterAstro engine, production JSON, or website assets.

## Scope

- Recalculate 300 evenly distributed Moon sidereal sign-ingress events sampled from the 14,758-event Moon Sign series in `Planetary Transit correction v4.json`.
- Compare DE440s ingress times against the reference JSON timestamps and the existing JupiterAstro engine timestamps for the same 300 events.
- Produce a row-level CSV and a JSON report with signed/absolute mean deviation, median absolute deviation, RMS, percentiles, threshold counts, and largest outliers.

## Implementation

Uses the USGS SpiceQL WebAssembly distribution, which exposes NAIF CSPICE to Node.js. The runner uses CSPICE `furnsh`, `str2et`, `spkezr`, `pxform`, `reclat`, and `et2utc`. No Moshier or Swiss Ephemeris fallback is permitted.

## Files

```
research/de440-moon-audit/
├── data/moon-sign-sample-300.csv
├── kernels/                 # local only; not committed
│   ├── de440s.bsp
│   └── naif0012.tls
├── output/                  # generated locally; not committed
├── src/run-audit.mjs
├── .gitignore
├── package.json
└── README.md
```

## 1. Obtain the kernels

Download these official NAIF files into `kernels/`:

- [JPL DE440s](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp)
- [NAIF leap-second kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls)

DE440s covers the entire 1949–2040 sample. The binary kernel is intentionally excluded from Git because of its size and external scientific-data provenance.

## 2. Install and run

Requires Node.js 20 or later.

```bash
npm install
npm run audit
```

The runner stops if either kernel is missing. It never silently substitutes another ephemeris.

## 3. Outputs

- `output/de440-moon-audit-report.json`
- `output/de440-moon-audit-300.csv`

The report records the DE440s kernel SHA-256, method, all row-level results, and summary statistics.

## Coordinate and ayanamsha convention

- Geocentric Moon relative to Earth; geometric state (`abcorr = NONE`).
- J2000 equatorial state transformed to the fixed mean ecliptic J2000 frame (`ECLIPJ2000`).
- Sidereal origin: fixed J2000 ecliptic longitude minus **23.857092°**, matching the J2000 intercept of the Lahiri polynomial in the inspected JupiterAstro HTML engine.
- Ingress is solved by bisection around the supplied JSON timestamp; final bracket is narrower than 0.5 ms.
- This first pass uses a fixed J2000 ecliptic and does **not** apply a date-dependent true-ecliptic/nutation transformation. The convention is explicit and reproducible, but it must be checked against the reference source before treating residuals as final Drik Panchang accuracy. If material, implement IAU precession-nutation and rerun the same sample.

The JSON timestamps have minute precision. Sub-minute numerical output does not establish sub-minute absolute accuracy of the source timestamps.

## Provenance

The sample file contains only 300 selected Moon Sign events and the corresponding existing-engine timestamps. It does not copy the full correction database or modify it.
