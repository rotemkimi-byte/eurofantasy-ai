# Scheduled data publication repair — 18 November 2026

## Causes and changes

- Identity acceptance tests now freeze their original 11-game sample before 14 November. Later appearances remain available and no longer invalidate that historical sample.
- Fixture tests use a frozen schedule, including completed-game and next-round cases, instead of expecting a live schedule to keep November 17 unplayed forever.
- Four raw official box scores referenced by the published metrics (111, 112, 113 and 117) were absent from Git. They are restored from the existing official provider mirror. The official metrics workflow now saves raw cache evidence alongside its derived data.
- Registry rebuilding uses current-season official ID profiles as well as raw boxes. A partial cache no longer drops stable identities. Rebuilding before and after restoring identical evidence is tested to be deterministic.
- Integrity checks distinguish a newly cached roster/DNP with no derived profile yet from a missing observed profile in a game already covered by the derived dataset. The former remains partial and produces a warning, without inventing minutes or PIR. Missing source evidence, name/ID conflicts, and omitted numeric observations still block publication.
- Missing required raw evidence produces an explicit `missing-box` audit error instead of an unhandled file exception. The identity workflow can restore required evidence before verification.

## Local validation

- All 342 market players checked; 308 linked, 34 without an official link, zero audit errors.
- Eight identity acceptance cases and browser/Node/Python identity parity passed.
- 32 Python tests passed.
- Node suites passed for identity refresh, identity integrity, squad matchup, position defense, compact fantasy tools, surprises, team metrics, weighted forecasts, player DNA, risk profile, replay, unified forecast, advanced players, official offense, algorithm UI/evidence, defense and team DNA.
- New negative tests confirm that missing observed profiles, unsupported IDs and conflicting official names still block publication. DNP and pending-derived-data cases remain partial.

## Remote validation

GitHub Actions and Pages results will be recorded after the repair runs complete. No remote success is implied by local checks alone.
