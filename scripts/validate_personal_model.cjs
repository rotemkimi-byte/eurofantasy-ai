/* Chronological replay: every prediction sees only earlier player games. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {project, key} = require('../personal-model-core.js');
const root = path.resolve(__dirname, '..');
const historyPath = path.join(root, 'data/player-history.json');
const history = JSON.parse(fs.readFileSync(historyPath));
const replayHistory = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'data/player-history-games.json.gz'))));
const clip = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
function summarize(log) {
  const min = log.reduce((s, g) => s + g.minutes, 0);
  const avgPir = mean(log.map(g => g.pir));
  return {games: log.length, avgPir, avgMinutes: min / log.length,
    pirPerMinute: log.reduce((s, g) => s + g.pir, 0) / min,
    sdPir: Math.sqrt(mean(log.map(g => (g.pir - avgPir) ** 2)))};
}
function recent(log) {
  if (!log.length) return null;
  return {latestSeason: 'E2026', currentSeasonGames: log.length, season: summarize(log),
    last5: summarize(log.slice(-5)), lastGame: log.at(-1),
    previous4: log.length > 1 ? summarize(log.slice(-5, -1)) : null, gameLog: log};
}
// The exact previous site's price prior + current-season blend + stability shrinkage.
function oldProject(p, r, context = {}) {
  const price = p.price, baseMin = price >= 14 ? 27 : price >= 10 ? 23 : price >= 7 ? 19 : 14;
  let priorMin = baseMin + clip(context.injuryBoost || 0, 0, 4);
  if (p.status === 'questionable') priorMin *= .82;
  if ((context.margin || 0) >= 10) priorMin *= price >= 12 ? .97 : price <= 7 ? 1.05 : 1;
  priorMin = clip(priorMin, 0, 36);
  const environment = (1 + clip(context.teamPct || 0, -8, 8) / 100 * .6) *
    (1 + clip(context.positionPct || 0, -12, 12) / 100 * .35) * (1 + (context.injuryUsagePct || 0) / 100);
  const prior = price * .93 * priorMin / baseMin * environment;
  if (p.status === 'out') return {expected: 0, minutes: 0};
  if (!r) return {expected: prior, minutes: priorMin};
  const g = r.currentSeasonGames, w = Math.min(.75, g / (g + 8));
  const rate = g > 5 ? .7 * r.season.pirPerMinute + .3 * r.last5.avgPir / r.last5.avgMinutes : r.season.pirPerMinute;
  const observedMin = g > 5 ? .7 * r.season.avgMinutes + .3 * r.last5.avgMinutes : r.season.avgMinutes;
  const minutes = clip(priorMin * (1 - w) + observedMin * w, 5, 36);
  const raw = prior * (1 - w) + rate * minutes * environment * w;
  const volatility = g >= 2 ? clip(r.last5.sdPir / Math.max(5, Math.abs(r.season.avgPir)), 0, 1.25) : .65;
  const role = g >= 2 ? clip(Math.abs(r.lastGame.minutes - r.previous4.avgMinutes) / Math.max(12, r.previous4.avgMinutes), 0, 1.25) : .5;
  const reference = r.previous4?.avgPir ?? prior;
  const outlier = clip(Math.abs(r.lastGame.pir - reference) / Math.max(6, Math.abs(reference)), 0, 1.25);
  const risk = clip(.45 * clip(1 - g / 8, 0, 1) + .30 * Math.min(1, volatility) + .15 * Math.min(1, role) + .10 * Math.min(1, outlier), 0, 1);
  return {expected: Math.max(0, prior + (raw - prior) * (1 - .55 * risk)), minutes};
}
const rows = [];
for (const profile of Object.values(replayHistory.players)) {
  const log = profile.gameLog;
  if (log.length < 14) continue;
  const seed = log.slice(0, 8), h = {...summarize(seed), team: seed.at(-1).team};
  // A synthetic preseason price uses only the eight already-observed games.
  const price = clip(h.avgPir / .93, 4, 20);
  for (let i = 8; i < log.length; i++) {
    const game = log[i], r = recent(log.slice(8, i));
    const p = {price, team: game.team, pos: game.pos, status: 'active'};
    const base = project(p, r, h), old = oldProject(p, r);
    const boosted = project(p, r, h, {}, {momentum: {active: true, coefficient: .3}});
    rows.push({date: game.date, actual: game.pir, minutes: game.minutes, base: base.expected,
      baseMinutes: base.minutes, old: old.expected, oldMinutes: old.minutes,
      signal: (boosted.expected - base.expected) / .3, pos: p.pos});
  }
}
const train = rows.filter(r => r.date < '2026-03-01');
const holdout = rows.filter(r => r.date >= '2026-03-01');
const metrics = (rows, field, coefficient = 0) => ({n: rows.length,
  mae: rows.length ? mean(rows.map(r => Math.abs(r.actual - (r[field] + coefficient * r.signal)))) : null,
  biasActualMinusPrediction: rows.length ? mean(rows.map(r => r.actual - (r[field] + coefficient * r.signal))) : null});
const hotTrain = train.filter(r => r.signal > 0), hotHoldout = holdout.filter(r => r.signal > 0);
let coefficient = 0;
const trainingTrials = [0, .1, .2, .3].map(c => ({coefficient: c, ...metrics(hotTrain, 'base', c)}));
if (hotTrain.length >= 80) coefficient = trainingTrials.reduce((best, row) => row.mae < best.mae ? row : best).coefficient;
const unboosted = metrics(hotHoldout, 'base'), boosted = metrics(hotHoldout, 'base', coefficient);
const momentumActive = coefficient > 0 && hotHoldout.length >= 40 && boosted.mae <= unboosted.mae * .98 &&
  Math.abs(boosted.biasActualMinusPrediction) <= Math.abs(unboosted.biasActualMinusPrediction) + .5;
const config = {momentum: {active: momentumActive, coefficient: momentumActive ? coefficient : 0}};
const report = {schema: 'personal-model-validation-v1', sourceSeason: 'E2025',
  method: 'Chronological next-game replay. First eight played games seed a fixed personal prior and synthetic price. Subsequent results are visible only after prediction. Momentum coefficient selected before 2026-03-01 and checked on later games.',
  limitations: 'Played-game replay only; not a test of injury/DNP prediction, matchup effects or live fantasy prices. These are reconstructed forecasts, not frozen live forecasts.',
  holdoutStart: '2026-03-01', trainingRows: train.length, holdout: {
    old: metrics(holdout, 'old'), personal: metrics(holdout, 'base', config.momentum.coefficient),
    oldMinutesMae: mean(holdout.map(r => Math.abs(r.minutes - r.oldMinutes))),
    personalMinutesMae: mean(holdout.map(r => Math.abs(r.minutes - r.baseMinutes)))},
  momentum: {active: momentumActive, trainingTrials, holdoutUnboosted: unboosted,
    holdoutCandidate: boosted, selectedCoefficient: config.momentum.coefficient},
  byPosition: Object.fromEntries(['G', 'F', 'C'].map(pos => [pos, {
    old: metrics(holdout.filter(r => r.pos === pos), 'old'),
    personal: metrics(holdout.filter(r => r.pos === pos), 'base', config.momentum.coefficient)}]))};
history.config = config;
historyPath && fs.writeFileSync(historyPath, JSON.stringify(history) + '\n');
fs.writeFileSync(path.join(root, 'data/personal-model-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
