# JupiterAstro Hybrid Planetary Reference Reconciliation

**Implementation plan and technical specification**  
**Initial scope:** Saturn, Jupiter, Rahu and Ketu  
**Reference source:** `Planetary Transit correction v4.json`  
**Reference timezone:** `Asia/Kolkata` (IST, UTC+05:30)

## 1. Purpose

Implement a two-stage planetary calculation workflow:

1. **Calculate immediately:** use the existing JupiterAstro ephemeris to calculate longitude, Sign, Nakshatra, Pada, Navamsa and motion. Render this result without waiting.
2. **Verify asynchronously:** load and validate the reference JSON, compare each available division, and reconcile ingress, exit and duration data.
3. **Update selectively:** apply valid reference corrections and update only affected UI values. Cache validated reference data and reconciled intervals.

The reference process must never block the initial calculation. If the JSON cannot be loaded, is invalid, or does not cover the requested instant, the existing ephemeris result remains available.

## 2. Core principles

- Preserve the existing ephemeris calculation as the immediate first result.
- Treat validated JSON events as authoritative only within their actual coverage.
- Verify Sign, Nakshatra and Navamsa independently.
- Reconcile duration even when the calculated labels already match.
- Preserve chronological event order, retrograde returns and repeated labels.
- Never deduplicate events merely because a label repeats.
- Retain original calculated values, reference values, corrections and diagnostics.
- Do not modify the source JSON from the browser.
- Keep the reconciliation module separate from existing production ephemeris functions until regression testing is complete.

## 3. Reference database and coverage

The reviewed JSON has a `metadata` section and a `data` section. Its reference location is New Delhi, India, and its timezone is `Asia/Kolkata`.

Expected divisions:

| Planet | Sign | Nakshatra | Navamsa |
|---|---:|---:|---:|
| Saturn | 130 | 199 | 710 |
| Jupiter | 162 | 336 | 1,359 |
| Rahu | 63 | 140 | Not present |
| Ketu | 63 | 130 | Not present |

The Ketu Sign count reflects the updated copy containing ten added opposite-sign events. Those ten entries were inferred from user-provided Rahu transitions and the 180° Rahu–Ketu opposition relationship; they are not independently verified astronomical observations. Confirm that the intended updated file is deployed before integration.

Absence of a division in the JSON is not permission to invent direct reference records. Rahu and Ketu Navamsa must be derived separately and explicitly marked as derived data.

## 4. Proposed architecture

```text
User requests chart / transit calculation
                 |
                 v
       Existing ephemeris engine
                 |
                 v
 Calculate longitude and divisions
                 |
                 v
      DISPLAY IMMEDIATELY
                 |
                 | asynchronous task
                 v
      Reference reconciliation
                 |
        +--------+--------+
        |                 |
        v                 v
  Load cached JSON    Fetch JSON if
  if available        cache unavailable
        |                 |
        +--------+--------+
                 |
                 v
      Validate and index events
                 |
                 v
 Compare Sign / Nakshatra / Navamsa
                 |
                 v
 Reconcile ingress / exit / duration
                 |
                 v
      Update affected UI values
                 |
                 v
        Cache verified result
```

Suggested independent module: `planetary-reference-reconciliation.js`  
Suggested public interface: `window.JAPlanetaryReference`

Expose clear methods for initialization, verification, interval lookup, cache management and diagnostics. Finalize exact method signatures during implementation.

## 5. Stage 1 — Existing calculation

The current ephemeris continues to calculate:

- Planetary longitude.
- Sign.
- Nakshatra and Pada.
- Navamsa.
- Motion state using the existing rules.

Render the result immediately. Do not wait for a network request, IndexedDB read or JSON parsing operation. Do not change existing ephemeris formulas as part of the first reconciliation implementation.

## 6. Stage 2 — Load and validate the reference

### Loading sequence

1. Check the in-memory reference object.
2. Check persistent browser cache (preferably IndexedDB; Cache Storage is also acceptable).
3. Use a valid cached database immediately.
4. Revalidate or fetch the latest JSON in the background according to the versioning policy.
5. If no valid cache exists, fetch asynchronously.
6. Validate downloaded data before accepting it.

A failed fetch or invalid JSON must not break the original calculation.

### Validation

At minimum, validate:

- Required root sections exist.
- `metadata.timezone` is recognized.
- Expected planet and division arrays have the correct types.
- Every event has a valid label and `entered_at` timestamp.
- Timestamps parse successfully in the declared timezone.
- Events are chronological.
- Duplicate timestamps are flagged.
- Adjacent labels are plausible for the division while allowing legitimate direct and retrograde reversals.
- Source version/update metadata is available for cache invalidation.

Do not silently discard invalid records. Record diagnostics and reject or quarantine a series when its integrity is uncertain.

### Timestamp normalization

The JSON timestamps are New Delhi local times without an explicit UTC offset. Interpret them using `Asia/Kolkata`, then convert them to UTC epoch milliseconds for comparisons. Do not parse these strings as the browser's local timezone.

## 7. Stage 3 — Index the reference

Parse source arrays once and build an in-memory index by planet and division. Keep the source JSON field names and structure unchanged; normalized records are internal only.

Example normalized event:

```js
{
  label: "Capricorn (10)",
  enteredAtUTC: 2891234567890,
  source: "json"
}
```

Use binary search to locate the applicable event interval efficiently.

## 8. Verification logic

For every supported planet and available division:

1. Find the latest event whose timestamp is less than or equal to the requested instant.
2. Use that event's label as the reference label.
3. Find the next chronological event to determine the exit boundary.
4. Compare the reference label with the Stage 1 calculated label.
5. If they agree, retain the calculated label.
6. If they disagree and the reference interval is valid, use the JSON label as the final displayed label.
7. Record the original value, reference value and match status in diagnostics.

Compare Sign, Nakshatra and Navamsa independently. Do not infer one division's label from another division's array when a direct array exists.

| Condition | Action |
|---|---|
| Calculated label matches reference | Keep calculated label |
| Calculated label differs from valid reference | Use reference label |
| Reference series missing | Keep calculated result; mark unverified |
| Reference data invalid or ambiguous | Keep calculated result; report diagnostic |
| Requested instant outside reference coverage | Keep calculated result; mark outside coverage |

## 9. Duration reconciliation

Run duration reconciliation on every applicable calculation, even when all labels match.

For each division, use the current event and the next chronological event:

- Entry = latest `entered_at` at or before the requested instant.
- Exit = next chronological event's `entered_at`.
- Elapsed = current instant minus entry.
- Remaining = exit minus current instant.
- Total stay = exit minus entry.

```text
Elapsed duration   = current timestamp - entry timestamp
Remaining duration = exit timestamp - current timestamp
Total stay         = exit timestamp - entry timestamp
```

Use absolute timestamps, not local clock subtraction. Preserve every chronological transition, including retrograde returns and re-entries. Repeated labels can represent separate intervals and must remain separate events. If an exit event is unavailable because the requested instant is at the end of coverage, mark the duration as incomplete rather than extrapolating.

## 10. Retrograde and direction handling

For Saturn and Jupiter:

- Derive reference direction from consecutive labels in the relevant JSON division.
- Use existing ephemeris longitude progression as a diagnostic cross-check.
- Preserve all chronological events, including retrograde re-entries.
- Flag non-adjacent transitions, direction disagreements, possible stations and suspicious gaps.
- Do not silently force a direction when reference and ephemeris disagree.

For Rahu and Ketu:

- Preserve the application's established retrograde policy.
- Do not infer direct motion from a label sequence.
- Use JSON events as the Sign and Nakshatra references.

## 11. Rahu and Ketu Navamsa strategy

The reviewed JSON does not contain direct Navamsa arrays for Rahu or Ketu.

Proposed derived-boundary method:

1. Take two consecutive Rahu Nakshatra ingress events.
2. Treat the interval as a reference Nakshatra span of 13°20′, subject to validation of the source convention.
3. Sample the existing Rahu sidereal longitude engine inside the interval.
4. Unwrap longitude continuously and preserve retrograde direction.
5. Calibrate sampled progression to the reference interval.
6. Solve the internal 3°20′ boundaries.
7. Generate equivalent Ketu boundaries using the 180° opposition relationship.
8. Cache derived boundaries against both the reference database version and ephemeris version.

These boundaries must be marked **derived/calibrated**, not direct JSON observations. Validate against known Rahu/Ketu cases and confirm the source's node convention and Nakshatra boundary definitions before relying on this method.

## 12. Timezone and location handling

The source database is based on New Delhi and uses `Asia/Kolkata`.

For the geocentric planetary longitudes used by the existing engine, the absolute ingress instant is the same worldwide:

1. Parse source timestamps in `Asia/Kolkata`.
2. Convert them to UTC epoch milliseconds.
3. Compare with the requested calculation instant in UTC.
4. Convert final timestamps to the user's selected display timezone.
5. Calculate durations using absolute timestamps.

Do not apply a location-based time shift to the astronomical event itself. If topocentric planetary positions are introduced later, reassess this assumption for that feature.

## 13. Caching strategy

| Layer | Data | Purpose |
|---|---|---|
| Memory | Parsed and indexed JSON | Fast access during current session |
| IndexedDB / Cache Storage | Reference JSON and derived boundaries | Persistence across sessions |
| Result cache | Verified intervals and durations | Avoid repeated reconciliation |

Cache identity should include:

- Reference database version or content hash.
- Planet.
- Division.
- Reference interval/event identity.
- Ephemeris version for derived results.
- Timezone/display settings only where presentation values depend on them.

Cache whole event intervals where possible. Reuse entry and exit boundaries for any instant in the same interval; recalculate elapsed and remaining durations from the requested instant. Invalidate derived Rahu/Ketu Navamsa data when either the JSON version or ephemeris version changes. Avoid duplicate simultaneous fetches or reconciliation jobs for the same database version.

## 14. UI integration

The reconciliation service should be the shared source of verified transit data for relevant JupiterAstro features, including planetary position/details, Transit Timeline, duration displays, research tables and other interfaces consuming the same transit state.

The initial result remains visible while reconciliation is pending. When verification completes:

- Update only changed labels.
- Update corrected entry and exit timestamps.
- Update elapsed, remaining and total durations.
- Refresh dependent displays consuming corrected values.
- Avoid rerendering the entire chart unnecessarily.

Optional unobtrusive status indicators may distinguish Calculated, Verified, Corrected from reference, Derived, and Unverified / outside reference coverage.

## 15. Diagnostic record

Keep original and reconciled values. A diagnostic record should contain fields equivalent to:

```js
{
  planet: "Saturn",
  calculated: {
    sign: "Aquarius",
    nakshatra: "Dhanishta",
    navamsa: "Capricorn"
  },
  verified: {
    sign: "Aquarius",
    nakshatra: "Dhanishta",
    navamsa: "Capricorn"
  },
  duration: {
    sign: {},
    nakshatra: {},
    navamsa: {}
  },
  diagnostics: {
    signMatch: true,
    nakshatraMatch: true,
    navamsaMatch: true
  }
}
```

Also record requested timestamp, source database version/hash, reference entry and exit timestamps, original estimated entry/exit timestamps (if available), entry/exit differences in minutes, direct versus derived status, validation warnings and reconciliation completion time. This enables measurement of how much the reference database improves the existing engine.

## 16. Implementation phases

### Phase 1 — Reference service foundation

- Create the separate reconciliation module.
- Implement JSON loading and validation.
- Normalize IST timestamps correctly.
- Build indexes and binary-search interval lookup.
- Implement memory and persistent caching.
- Keep the existing engine untouched.

**Deliverable:** reliable reference service, not yet connected to production UI.

### Phase 2 — Saturn and Jupiter

Implement Sign, Nakshatra and Navamsa. Test direct ingress, retrograde return, direct re-entry, matching labels, mismatching labels and duration-only corrections.

**Deliverable:** Saturn/Jupiter reconciliation engine.

### Phase 3 — Rahu and Ketu

- Implement Sign verification.
- Implement Nakshatra verification.
- Preserve retrograde policy.
- Validate the updated Ketu Sign series.
- Develop and test derived Navamsa boundaries.

**Deliverable:** Rahu/Ketu reconciliation engine.

### Phase 4 — UI integration

- Connect shared verified results to relevant displays.
- Preserve immediate initial rendering.
- Update labels and durations asynchronously.
- Prevent unnecessary full-chart rerenders.

**Deliverable:** integrated hybrid workflow.

### Phase 5 — Regression and production readiness

- Run historical test cases across JSON coverage.
- Test retrograde returns and repeated labels.
- Test timezone conversion.
- Test missing, malformed and stale reference data.
- Compare original and corrected ingress/exit timestamps.
- Test cache invalidation and offline fallback.
- Confirm no existing ephemeris or chart feature regresses.

**Deliverable:** production-ready hybrid calculation and verification system.

## 17. Acceptance criteria

| Test | Required outcome |
|---|---|
| Initial calculation | Displayed immediately |
| JSON unavailable | Existing calculation continues |
| JSON matches calculated label | No unnecessary label change |
| JSON differs | Valid reference label becomes final |
| Labels match but duration differs | Duration is still corrected |
| Retrograde return | Correct chronological interval selected |
| Repeated label | Event is not deduplicated |
| Outside reference coverage | Existing calculation retained |
| Timezone changes | Same absolute ingress instant |
| Cached interval exists | No unnecessary full JSON scan |
| Database version changes | Stale cache invalidated |
| Derived Navamsa | Clearly marked and versioned |
| Repeated requests | No duplicate background work |

## 18. Scope boundaries and safeguards

- Initial production scope is Saturn, Jupiter, Rahu and Ketu.
- Sun, Moon, Mars, Mercury and Venus are not part of this first production rollout.
- Do not modify the original JSON from the client.
- Do not overwrite existing ephemeris functions.
- Do not treat derived Rahu/Ketu Navamsa boundaries as direct source records.
- Do not claim minute-level accuracy until event timestamps have been independently validated.
- Do not deploy the new module until historical and regression tests pass.
- Preserve a fallback path to the original calculation at all times.

## 19. Recommended implementation order

Start with **Phase 1 and Phase 2: reference service foundation plus Saturn/Jupiter reconciliation**. This validates the most complete part of the database first, because Saturn and Jupiter have all three reference divisions available.

After those tests pass, extend the same service to Rahu and Ketu Sign and Nakshatra. Add their derived Navamsa boundaries as a separately tested capability.

**Intended final behavior:**  
**Calculate immediately → verify asynchronously → correct labels → correct ingress/exit and duration → cache the reconciled interval → reuse it across JupiterAstro.**
