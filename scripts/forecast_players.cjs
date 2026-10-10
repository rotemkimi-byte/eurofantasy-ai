/* Future backtest snapshots use the same pure forecast core as the website. */
const fs = require('node:fs');
const path = require('node:path');
const core = require('../personal-model-core.js');
const extension = require('../matchup-context-core.js');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function load(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file))); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
const players = load('data/players.json', []).map(p => ({...p, team: core.team(p.team), opponent: core.team(p.opponent)}));
const rawHistory = load('data/player-history.json');
const history = rawHistory.schema === 'player-history-v1' && rawHistory.season === 'E2025' &&
  rawHistory.currentSeason === 'E2026' && rawHistory.complete === true ? rawHistory : {};
const rawRecent = load('data/recent-form.json');
const form = rawRecent.currentSeason === 'E2026' ? rawRecent.players || {} : {};
const recent = Object.fromEntries(Object.entries(form).map(([k, v]) => [core.key(k), v]));
const matches = load('data/matchups.json').matchups || {};
const matchupContext = load('data/matchup-context.json');
extension.applyTeams(matches, matchupContext);
const defense = load('data/position-matchups.json').defense || {};
const games = load('data/euroleague-live-E2026.json');
const modelFiles = ['index.html','live.js','roster-live.js','position-matchups.js','matchup-live.js',
  'model-stability.js','personal-model-core.js','personal-model.js','matchup-context-core.js','matchup-context.js','data/player-history.json'];
const fingerprint = crypto.createHash('sha256');
for (const file of modelFiles) if (fs.existsSync(path.join(root, file))) {
  fingerprint.update(file); fingerprint.update(fs.readFileSync(path.join(root, file)));
}
const modelId = fingerprint.digest('hex').slice(0, 20);
const learning = load('data/learning/latest.json');
const logs = {};
if (games.season === 'E2026') for (const game of Object.values(games.games || {})) {
  for (const g of game.rows || []) {
    if (g.season !== 'E2026' || Number(g.minutes) <= 0) continue;
    (logs[core.key(g.name)] ||= []).push({...g, date: g.date || game.date, gameCode: g.gameCode || game.gameCode});
  }
}
for (const [k, rows] of Object.entries(logs)) {
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.gameCode - b.gameCode);
  logs[k] = rows.filter((g, i) => rows.findIndex(x => x.gameCode === g.gameCode) === i);
}
const forecasts = players.filter(p => ['G', 'F', 'C'].includes(p.pos)).map(p => {
  const k = core.key(p.name), h = history.players?.[k], r = recent[k] ? {...recent[k], gameLog: logs[k] || []} : null;
  const match = matches[p.team] || {teamPoints: Number(p.home) === 1 ? 85.5 : 82.5};
  const positionPct = (Number(defense[match.opponent || p.opponent]?.[p.pos]?.factor || 1) - 1) * 100;
  const teamPct = (Math.max(.92, Math.min(1.08, 1 + (Number(match.teamPoints ?? 84) - 84) * .006)) - 1) * 100;
  const context = {...core.opportunity(p, players), teamPct, positionPct, margin: match.margin};
  const x = core.calibrate(extension.project({...core.project(p, r, h, context, history.config),match}, p, matchupContext), p, learning, modelId);
  return {...p, expectedPir: x.expected, expectedMinutes: x.minutes,
    detail: {reason: x.source, teamMatchPct: teamPct, positionMatchPct: positionPct,
      ...context, personalPrior: x.personalPrior}};
});
console.log(JSON.stringify({model: 'shared-personal-model-v1', predictions: forecasts}));
