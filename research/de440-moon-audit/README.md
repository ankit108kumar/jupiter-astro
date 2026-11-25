# JupiterAstro — JPL DE440s Moon Sign Ingress Audit

This isolated research utility does not modify production code or correction data.

## Scope
- Select 300 evenly distributed Moon Sign events from the `data.Moon.Sign` array in the user's correction JSON.
- Recalculate the same ingress events with the existing JupiterAstro 12-term Moon model and JPL DE440s through NAIF CSPICE/USGS SpiceQL.
- Compare DE440s against JSON and existing-engine timestamps; export a detailed CSV and JSON report.

## Files
- `src/build-sample.mjs`: derives a deterministic 300-event sample and existing-engine ingress times from the correction JSON.
- `src/run-audit.mjs`: runs the DE440s/CSPICE calculation and produces the report.
- `kernels/`: local-only binary kernels; never committed.
- `data/moon-sign-sample-300.csv`: generated locally; never committed.
- `output/`: generated locally; never committed.

## Requirements
Node.js 20+. Install with `npm install`.

## 1. Download official kernels
Place these files in `kernels/`:
- [JPL DE440s](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp)
- [NAIF leap seconds](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls)

## 2. Run
Pass the local path to `Planetary Transit correction v4.json`:

```bash
npm install
MOON_CORRECTION_JSON="/absolute/path/to/Planetary Transit correction v4.json" npm run audit
```

The runner refuses to continue if the source JSON or either kernel is missing. It does not silently substitute Moshier or any other ephemeris.

## Calculation convention
- Geometric geocentric Moon relative to Earth (`spkezr('MOON', et, 'J2000', 'NONE', 'EARTH')`).
- IAU 2006 mean precession to the mean ecliptic/equinox of date; nutation omitted in this first pass.
- Date-dependent Lahiri polynomial matching the J2000 intercept and rate in the inspected JupiterAstro HTML.
- Numerical bisection around each reference ingress; CSV timestamps retained in IST.
- The JSON reference is minute-resolution, so sub-minute numerical residuals do not establish sub-minute absolute accuracy.

The omitted nutation must be assessed before claiming sub-minute agreement with an external Panchang source. This audit is deliberately isolated and does not alter the production engine.
