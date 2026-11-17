# Compact fantasy tools — E2026 / 2026–27

## Changes

- `index.html`: absence recommendations use compact player headers, four clearly labelled statistics, canonical profile actions and collapsed recommendation/missing-player explanations. `absenceGroups`, `model` and recommendation ordering are unchanged.
- `fantasy-compact.js`: shared identity-first profile/media rendering; resolves the registry key to exactly one current market player before invoking the existing `showPlayer`. No fuzzy name join or new profile implementation.
- `fantasy-compact.css`: scoped light/dark cards and compact team table, based on existing theme tokens, fonts and market proportions. No navigation changes.
- `free-throws.js`: team ranking table, descending active metric with canonical team ID tie break and missing values last. All five team metrics remain selectable; makes and attempts stay per-game, accuracy remains a percentage. Clicking any team row opens existing team details. Source selection and summary formulas are unchanged.
- `surprises.js`: credit descending, actual PIR ascending and actual-minus-forecast ascending. Keeps the exact played/position/13+ credit/10-or-lower PIR filter and round selector. Reads existing pre-round E2026 prediction archives, validating round and timestamp; duplicates, missing identities and invalid snapshots produce an em dash. Never recalculates a historical forecast using today's model.
- `tests/test_fantasy_compact.cjs` and the existing identity/Pages workflow: regression coverage added to the normal publication checks.

## Validation completed before publication

- All changed JavaScript and 12 inline scripts parse.
- Compact regression suite passed: all 11 available rounds, all three numeric sorts, ties/missing values, Baldwin alias identity, duplicate/wrong-season/late-snapshot guards, 60 team/range combinations.
- Existing `test_surprises.cjs` passed, including official rank reconciliation and same-day leakage guards.
- Existing `test_team_metrics.cjs` passed: 20 teams and 110 results.
- Separate baseline comparison against commit `2af19d07b5d06e0cb938a562c21afeb06fc6e803`: surprise membership/results identical for all 11 rounds; all 60 team/range summaries deeply equal. No forecast, price or source-data files changed.
- Browser: absence screen inspected at 375, 390 and 430 CSS pixels with no horizontal overflow; long English names, four metric columns and collapsed explanations inspected. Shirt action opened Matthew Strazel's existing profile. Final checks and publication evidence are reported in the completion message.

## Known data and verification limits

- Round 1 has no valid pre-round prediction archive. Its forecast/gap cells deliberately display an em dash. All selected players in rounds 2–11 have matched archived predictions.
- A genuinely absent portrait falls back to the team's shirt.
- Local broad identity/forecast suites require the large advanced-player dataset, which the connector could not transfer. They run in the existing GitHub Actions publication workflow with the complete repository. Browser connection timeouts limited local interactive verification; unverified checks must not be reported as passed.
