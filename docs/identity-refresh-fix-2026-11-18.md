# Scheduled data publication repair — 18 November 2026

## Causes and changes

- Identity acceptance tests now freeze their original 11-game sample before 14 November. Later appearances remain available and no longer invalidate that historical sample.
- Fixture tests use a frozen schedule, including completed-game and next-round cases, instead of expecting a live schedule to keep November 17 unplayed forever.
- Four raw official box scores referenced by the published metrics (111, 112, 113 and 117) were absent from Git. They are restored from the existing official provider mirror. The official metrics workflow now saves raw cache evidence alongside its derived data.
- Registry rebuilding uses current-season official ID profiles as well as raw boxes. A partial cache no longer drops stable identities. Rebuilding before and after restoring identical evidence is tested to be deterministic.
- Integrity checks distinguish a newly cached roster/DNP with no derived profile yet from a missing observed profile in a game already covered by the derived dataset. The former remains partial and produces a warning, without inventing minutes or PIR. Missing source evidence, name/ID conflicts, and omitted numeric observations still block publication.
- Missing required raw evidence produces an explicit `missing-box` audit error instead of an unhandled file exception. The identity workflow can restore required evidence before verification.

## Local validation

- Initial repair: all 342 market players checked; 308 linked, 34 without an official link, zero audit errors. After the successful official refresh: 310 linked, 32 without an official link, zero audit errors; 119 completed team results and 2,847 registered player-game rows.
- Eight identity acceptance cases and browser/Node/Python identity parity passed.
- 32 Python tests passed.
- Node suites passed for identity refresh, identity integrity, squad matchup, position defense, compact fantasy tools, surprises, team metrics, weighted forecasts, player DNA, risk profile, replay, unified forecast, advanced players, official offense, algorithm UI/evidence, defense and team DNA.
- New negative tests confirm that missing observed profiles, unsupported IDs and conflicting official names still block publication. DNP and pending-derived-data cases remain partial.

## Remote validation

Implementation commit: `d01e21ad1efc0938f5e9b4608a6c642e758142a8`.

- [Official update and Pages publication](https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44234371864): **success**. All metric/forecast tests, recalibration, raw-evidence save, final integrity gate, artifact upload and Pages deployment passed. Generated data commit: `31ff3dc3`.
- On that updated source, registry regeneration is deterministic and the identity acceptance suite, integrity audit and 16 additional Node suites pass again. Rolands Smits and Kenan Kamenjas now have matching official profiles after the refresh; the current audit has no pending-profile warnings. The synthetic delayed/DNP cases remain partial without invented observations.
- [Rolling learning, restarted attempt](https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44232473611): **success**, including replay checks, immutable input snapshots, the two integrity audits and Pages deployment. Generated commit: `8018b89e`.
- [Identity and real mobile checks](https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44234371853): **success**, including all three browser suites and Pages deployment.
- The identity workflow could finish after a newer official/learning deployment and overwrite it with its older artifact. Its deploy job now checks the current main head and skips a superseded artifact. The final report commit publishes the current source, preserving the newly refreshed data.
