# Player identity and forecast integrity — E2026 / 2026–27

Implementation: unified browser/Node/Python registry, exact IDs first; no fuzzy joins. Existing navigation, styles and metrics preserved.

## Findings

- 342 fantasy players (plus 20 coaches excluded); 306 linked to official E2026 person codes; 36 have no record in the 110 cached completed official fixtures.
- 11 verified identity repairs: Wade Baldwin, McKinley Wright, Oshae Brissett, TyTy Washington, Patrick Baldwin Jr, AJ Lawson, Perry Dozier, Olek/Aleksander Balcerowski, Mouhamadou/Mo Gueye, Maksym/Max Shulga, Armando Bacot Jr.
- Three genuine recent-form omissions recovered from current-season boxes: Derek Willis, Diego Flaccadori, Nicola Akele.
- 15 directly affected identities across datasets and tool selectors; 11 official, 11 recent-form and 11 media joins repaired (33 joins across these three sources), plus 11 advanced-selector repairs. Talen Horton-Tucker had a broken advanced-tool selector because hyphens were deleted.
- 51 players have no played E2026 appearances: 36 absent from cached official records and 15 registered but DNP. These get explicit partial-data metadata and a reduced confidence cap; they are not assigned invented statistics.
- 88 upcoming forecasts changed after reconnecting player/teammate evidence. All 342 were recalculated with the existing tool weights. Full before/after JSON and every changed forecast are in data/integrity/.

## Required acceptance players

| Player | Official ID | Fantasy ID | Played games | Photo | Advanced appearances |
|---|---|---:|---:|---|---:|
| Wade Baldwin | 009863 | 3771 | 11 | True | 11 |
| Talen Horton-Tucker | 014124 | 8567 | 11 | True | 11 |
| Mckinley Wright | 012606 | 4096 | 11 | True | 11 |
| Oshae Brissett | 014127 | 7197 | 11 | True | 11 |
| Tyty Washington | 015162 | 11517 | 7 | True | 7 |
| Patrick Baldwin Jr | 014728 | 11494 | 5 | True | 5 |
| Aj Lawson | 014734 | 11512 | 11 | True | 11 |
| Perry Dozier | 012742 | 4758 | 7 | True | 7 |

Baldwin: 11 appearances, 13.82 PIR, 23.86 minutes. Horton-Tucker: 11 appearances, 14.09 PIR, 20.70 minutes. Shot-map absence can still legitimately mean an unverified event feed; this is distinct from zero appearances.

## Historical audit — original forecasts preserved

- Original grading: 2,314 outcomes, PIR MAE 5.7693, minutes MAE 5.0542.
- Corrected identity grading: 2,389 outcomes, PIR MAE 5.7483, minutes MAE 5.0587. Added 75 observations for 11 players. Different coverage means this is **not** a like-for-like improvement claim.
- Separate paired diagnostic on 36 inputs: PIR MAE **5.4565 → 6.2075**; minutes MAE **5.7036 → 4.9788**. Better minutes and worse PIR in this small sample.
- Counterfactual repairs use official files from Git commits published before the frozen pregame cutoff, a dataset publication timestamp before that cutoff, and only games finished at least four hours before it. Target and future games are excluded. Original frozen status, price, configuration, historical prior and context are kept.
- This 36-case diagnostic covers the shared personal/context core. It does not claim to reconstruct every historical weighted site forecast; full historical weighted/tool-impact reconstruction is limited by archived input availability.
- No original prediction/input snapshot was overwritten. SHA-256 hashes of the original files and replay source commit IDs are retained in learning-identity-audit.json.
- Coefficients and tool weights were not tuned. Identity code and registry are included in forecast, rolling and shadow-engine fingerprints; version constants were refreshed so old calibrations cannot silently carry across this repair.

## Publication guards and regression checks

- Every scheduled data writer rebuilds the registry and emits an integrity report before commit. Scheduled Pages uploads validate again after rebasing. A dedicated identity workflow validates deterministic generation, corruption guards, core regressions and mobile browser acceptance before deployment.
- Report covers duplicate official/fantasy IDs, ambiguous aliases, official ID/name conflicts, wrong photos, source-appearance reconciliation, mismatched advanced minutes/team, active players with existing games but missing form, and unjustified price fallbacks. Missing current records/photos remain warnings.
- Removed the scheduled heredoc that rewrote recent-form.js with an obsolete independent matcher. Scheduled backtesting and recent-form generation import the same Python identity adapter.
- Local: 26 Node regression suites passed, 30 Python tests passed, personal-model tests passed, all workflow YAML parsed, git diff --check passed.
- Local real-browser test execution is unavailable: Chromium cannot create its required Unix socket in this executor, and the connected browser cannot access the executor loopback. Browser suites are configured in GitHub Actions; their final result and deployment status will be reported separately.

## Forecast comparison

| Player | PIR before | PIR after | Minutes before | Minutes after |
|---|---:|---:|---:|---:|
| TJ Shorts | 17.7232 | 17.7116 | 23.3780 | 23.3780 |
| Mfiondu Kabengele | 18.6333 | 18.7066 | 24.0536 | 24.0536 |
| Walter Tavares | 15.4477 | 15.4456 | 21.1292 | 21.1292 |
| Dwayne Bacon | 16.7079 | 16.7356 | 26.7201 | 26.7201 |
| Dario Saric | 13.8779 | 13.8983 | 25.1430 | 25.1430 |
| Chima Moneke | 12.8629 | 12.8771 | 20.6949 | 20.6949 |
| Jordan Nwora | 14.0619 | 14.0556 | 22.9969 | 22.9969 |
| Wade Baldwin | 7.5520 | 14.4453 | 15.0000 | 23.5387 |
| Justin Robinson | 13.9276 | 13.8694 | 20.7813 | 20.7813 |
| Talen Horton-Tucker | 11.8055 | 11.7692 | 19.5526 | 19.5526 |
| Theo Maledon | 18.9613 | 18.9725 | 23.2753 | 23.2753 |
| Shavon Shields | 13.5319 | 13.5465 | 23.9460 | 23.9460 |
| Jaylen Hoard | 10.8789 | 10.8902 | 23.9066 | 23.9066 |
| Mckinley Wright | 7.5324 | 11.5633 | 15.0000 | 24.8110 |
| Patty Mills | 12.3132 | 12.3217 | 20.9647 | 20.9647 |
| Chris Jones | 13.3414 | 13.3314 | 19.8515 | 19.8515 |
| Elie Okobo | 13.0549 | 13.0296 | 27.2091 | 27.2091 |
| Kameron Taylor | 11.9012 | 11.8989 | 23.8042 | 23.8042 |
| Filip Petrusev | 9.8782 | 9.8596 | 15.2208 | 15.2208 |
| Roman Sorkin | 10.1707 | 10.1660 | 16.7068 | 16.7068 |
| Bonzie Colson | 11.5469 | 11.5446 | 20.0042 | 20.0042 |
| Daniel Theis | 11.5821 | 11.5522 | 19.5700 | 19.5700 |
| Will Clyburn | 10.6241 | 10.6175 | 21.2385 | 21.2385 |
| Bruno Fernando | 7.3718 | 7.3678 | 15.3663 | 15.3663 |
| Matthew Strazel | 11.0960 | 11.0895 | 22.4213 | 22.4213 |
| Tornike Shengelia | 5.8963 | 5.8956 | 14.0188 | 14.0188 |
| Tadas Sedekerskis | 6.8276 | 6.8094 | 11.9509 | 11.9509 |
| Yam Madar | 11.9753 | 11.9779 | 21.6823 | 21.6823 |
| Tremont Waters | 10.8907 | 10.8924 | 19.8025 | 19.8025 |
| Oshae Brissett | 7.5137 | 11.1534 | 15.0000 | 24.4817 |
| Collin Malcolm | 10.4650 | 10.4647 | 24.6779 | 24.6779 |
| Marcus Bingham | 7.9903 | 7.9695 | 16.5441 | 16.5441 |
| Jordan Loyd | 10.8311 | 10.8246 | 25.3002 | 25.3002 |
| Cameron Payne | 9.6425 | 9.6296 | 19.7387 | 19.7387 |
| Andres Feliz | 11.9177 | 11.9456 | 20.3958 | 20.3958 |
| Hugo Besson | 11.5698 | 11.5708 | 19.3684 | 19.3684 |
| Neal Sako | 8.4830 | 8.4833 | 15.8629 | 15.8629 |
| Tyty Washington | 7.4419 | 10.0425 | 15.0178 | 20.3869 |
| Jae Crowder | 11.5169 | 11.5021 | 23.0965 | 23.0965 |
| Jimmy Clark III | 9.9295 | 9.9341 | 20.5261 | 20.5261 |
| Both Gach | 8.9002 | 8.8980 | 20.4619 | 20.4619 |
| Patrick Baldwin Jr | 7.4570 | 5.2543 | 15.0000 | 11.1448 |
| Tyrese Martin | 10.0076 | 9.9985 | 23.5765 | 23.5765 |
| Chuma Okeke | 8.3365 | 8.3351 | 16.5153 | 16.5153 |
| Aj Lawson | 7.5599 | 10.8691 | 15.0347 | 23.9351 |
| Jaron Blossomgame | 7.0075 | 7.0143 | 17.8346 | 17.8346 |
| Trent Forrest | 6.0902 | 6.0873 | 17.7793 | 17.7793 |
| Mamadi Diakite | 7.1997 | 7.1980 | 13.4394 | 13.4394 |
| Jared Butler | 7.6898 | 7.6889 | 16.9518 | 16.9518 |
| Semi Ojeleye | 10.4675 | 10.4690 | 24.0883 | 24.0883 |
| Jaime Pradilla | 6.4828 | 6.4803 | 13.7285 | 13.7285 |
| TJ Leaf | 3.5226 | 3.5351 | 9.6978 | 9.6978 |
| Marcio Santos | 7.1862 | 7.1846 | 13.3258 | 13.3258 |
| Kai Jones | 8.5650 | 8.5717 | 16.7478 | 16.7478 |
| Jasiel Rivero | 5.7960 | 5.8002 | 14.4838 | 14.4838 |
| Nick Weiler-Babb | 4.9597 | 4.9577 | 20.4248 | 20.4248 |
| Tyson Carter | 6.4116 | 6.4106 | 17.0679 | 17.0679 |
| Keaton Wallace | 4.1372 | 4.1402 | 14.9296 | 14.9296 |
| Gonzalo Corbalan | 5.0628 | 5.0578 | 13.2823 | 13.2823 |
| Stanley Umude | 5.4390 | 5.4628 | 14.4723 | 14.4723 |
| Aleksander Balcerowski | 7.5692 | 8.4420 | 15.0384 | 17.8455 |
| Ebuka Izundu | 8.4790 | 8.4804 | 16.9932 | 16.9932 |
| Mo Gueye | 7.4570 | 3.8199 | 15.1006 | 8.5784 |
| Santi Yusta | 4.6265 | 4.6236 | 12.3373 | 12.3373 |
| Dylan Osetkowski | 6.5166 | 6.5161 | 20.0728 | 20.0728 |
| Ercan Osmani | 4.2311 | 4.2326 | 15.3665 | 15.3665 |
| Omari Moore | 5.0377 | 5.0396 | 14.3325 | 14.3325 |
| Nathan Sestina | 3.9960 | 3.9890 | 13.9650 | 13.9650 |
| Max Shulga | 7.5153 | 1.9236 | 15.1304 | 5.3526 |
| Perry Dozier | 7.4993 | 5.7646 | 15.1786 | 16.2162 |
| Armando Bacot | 7.5137 | 2.1747 | 15.0000 | 8.9220 |
| Alberto Abalde | 6.0374 | 6.0364 | 17.1244 | 17.1244 |
| Yves Pons | 4.0226 | 4.0271 | 11.0076 | 11.0076 |
| Dario Brizuela | 4.6312 | 4.6202 | 18.3307 | 18.3307 |
| Myles Cale | 2.7260 | 2.7247 | 14.3892 | 14.3892 |
| David Kramer | 2.2814 | 2.2777 | 14.4730 | 14.4730 |
| Bodian Massa | 4.0940 | 4.0963 | 14.3043 | 14.3043 |
| Davion Mintz | 3.6648 | 3.6683 | 14.4078 | 14.4078 |
| Ognjen Dobric | 4.3005 | 4.2905 | 10.4432 | 10.4432 |
| Dejan Davidovac | 4.3776 | 4.3823 | 13.0191 | 13.0191 |
| David Lighty | 4.3754 | 4.3729 | 11.2107 | 11.2107 |
| Alvaro Cardenas | 4.2687 | 4.2654 | 11.2400 | 11.2400 |
| Marc-owen Fodzo Dada | 5.6450 | 5.6398 | 15.0164 | 15.0164 |
| John Dibartolomeo | 2.4342 | 2.4349 | 10.3167 | 10.3167 |
| Davis Bertans | 3.0452 | 3.0454 | 11.0030 | 11.0030 |
| Mario Saint-supery | 3.2623 | 3.2618 | 12.1940 | 12.1940 |
| William Rayman | 1.4059 | 1.4083 | 5.3942 | 5.3942 |
| Kosta Kondic | 1.1229 | 1.1226 | 5.3397 | 5.3397 |

## Changed files

- `.github/workflows/backtest.yml`
- `.github/workflows/fantasy.sync.yml`
- `.github/workflows/fast-live-sync.yml`
- `.github/workflows/install-fantasy-learning.yml`
- `.github/workflows/install-matchup-context.yml`
- `.github/workflows/install-rolling-learning.yml`
- `.github/workflows/install-round-lab.yml`
- `.github/workflows/install-ui-refresh.yml`
- `.github/workflows/matchups-live.yml`
- `.github/workflows/official-offense.yml`
- `.github/workflows/player-identity.yml`
- `.github/workflows/position-matchups-live.yml`
- `.github/workflows/recent-form-2026-27-only.yml`
- `.github/workflows/roster-sync.yml`
- `advanced-player-tools.js`
- `algorithm-core.js`
- `app-player.js`
- `data/integrity/forecast-identity-changes.json`
- `data/integrity/forecasts-after-identity.json`
- `data/integrity/forecasts-before-identity.json`
- `data/integrity/learning-identity-audit.json`
- `data/integrity/player-identities.json`
- `data/matchup-context.json`
- `data/player-identities.json`
- `dna-core.js`
- `docs/player-identity-report-2026-11-17.md`
- `free-throws.js`
- `game-data-store.js`
- `index.html`
- `learning-model-version.js`
- `learning.js`
- `matchup-context-core.js`
- `official-offense-core.js`
- `personal-model-core.js`
- `personal-model.js`
- `player-identities.js`
- `player-identity-core.js`
- `recent-form.js`
- `risk-profile-core.js`
- `rolling-model-version.js`
- `round-lab.js`
- `scripts/audit_identity_learning.py`
- `scripts/audit_player_identities.cjs`
- `scripts/build_matchup_context.py`
- `scripts/build_official_metrics.py`
- `scripts/build_player_identities.py`
- `scripts/build_player_media.py`
- `scripts/fantasy_learning.py`
- `scripts/forecast_players.cjs`
- `scripts/install_learning.py`
- `scripts/player_identity.py`
- `scripts/replay-engine.cjs`
- `scripts/replay_identity_audit.cjs`
- `scripts/rolling_learning.py`
- `scripts/round_lab.py`
- `scripts/unified_learning.py`
- `tests/test_capture.cjs`
- `tests/test_player_identity.cjs`
- `tests/test_player_identity_browser.cjs`
- `tests/test_rolling_learning.py`
- `tests/test_algorithm_ui.cjs`
- `tests/test_player_dashboard.cjs`
- `usage-core.js`
- `usage-ui.js`
- `weighted-forecast-core.js`

CI follow-up: updated the isolated algorithm UI harness to load the shared identity dependency and made the round-lab Python adapter importable when tests load it by file path. These isolated entry points now pass locally.

## Publication evidence

- Core implementation: bf7da644079aa4844ac82c0bcbf6c6321c536821, with isolated-test follow-ups 83355c63220bc11aebff03a2dbac264617ec5dc2, b835d7ce40388733ff387406ae4c8a8bccd72be8, a02d090737e7eb941c425af1a235aa4bf7d0cf82.
- Official metrics and Pages: https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44130499311 — update, integrity gate and deploy all succeeded.
- Bargains/Super Squad pipeline and Pages: https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44130499170 — verification, integrity gate and deploy all succeeded.
- Mobile identity acceptance: https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44130607999 — all eight requested players passed profiles, photo URLs, unique selections and five advanced tools; all 342 forecasts were finite. An unrelated older dashboard assertion expected an aria-label, while the existing button has visible return text; the assertion was aligned with that existing accessible name without changing the UI.
- Published URL: https://rotemkimi-byte.github.io/eurofantasy-ai/
- Direct interactive verification could not be completed: the connected browser timed out opening the published page. Automated real-browser checks ran on GitHub's runner.

Additional CI compatibility: removed the old single-process Chromium test flag (it crashed when the existing dashboard suite opened its second context), and made the scheduled learning workflow check out current main so retries do not replay obsolete snapshots over already archived predictions.

## Unified historical/tool-impact validation

Ran `python scripts/unified_learning.py --historical --output /tmp/identity-unified-validation.json` with the corrected resolver. The separate result is saved as `data/integrity/unified-identity-validation.json`: 949 eligible archived inputs across 40 games; 641 held-out predictions across 27 games, with per-version accuracy, per-tool ablations and coverage. Prospective paired validation remains empty (0), so this does not authorize activating new learned coefficients. This compares the existing unified candidate with served model versions, and must not be described as a pure before/after identity improvement. The 36-case paired diagnostic above is the isolated form-repair comparison.

## Final validation and deployment result

- https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44131830203 : the complete `verify` job succeeded, including all three real-browser suites. All eight acceptance players, all 342 finite forecasts, dashboard tabs/ranges/Usage/PIR, missing-image and data-failure behavior, rapid player switching, and advanced tools at 390/1280 px in light/dark themes passed.
- That run's separate deploy job was rejected because a newer Pages deployment was already in progress. Its older artifact was not retried over the newer data.
- https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44131830727 : learning update, replay/input capture, integrity gate and Pages deployment all succeeded.
- https://github.com/rotemkimi-byte/eurofantasy-ai/actions/runs/44132126968 : latest main version 2e9a99e51b274887b0ff3a85761d5a7eaf17aacf was published successfully. This includes the identity implementation and follow-up fixes.
- Verification evidence: 26 local Node suites, 30 Python tests, the personal-model regression suite, three successful cloud browser suites and a 949-input historical unified replay. No algorithm weights were changed by this task.
- Additional report artifact: `data/integrity/unified-identity-validation.json`.
