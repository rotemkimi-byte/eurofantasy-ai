const assert = require('node:assert/strict');
const {project, key} = require('../personal-model-core.js');
const p = {name: 'Elijah Bryant', price: 17.1, team: 'Hapoel Tel Aviv', pos: 'G', status: 'active'};
const h = {games: 38, avgPir: 20, avgMinutes: 30, pirPerMinute: 2 / 3, team: p.team};
const r = {latestSeason: 'E2026', currentSeasonGames: 3,
  season: {avgPir: 28, avgMinutes: 32.5, pirPerMinute: 28 / 32.5},
  gameLog: [{pir: 31, minutes: 34}, {pir: 40, minutes: 32}]};
const basic = project(p, r, h);
assert.equal(key('BRYANT, ELIJAH'), key('Elijah Bryant'));
assert(basic.expected > 22 && basic.expected < 28, 'Personal history should moderate current form once');
assert(basic.minutes > 30, 'Observed role must move minutes above the price prior');
assert.equal(basic.personalPrior.momentumPir, 0, 'An unvalidated streak must not add PIR');
const hot = project(p, r, h, {}, {momentum: {active: true, coefficient: .2}});
assert(hot.personalPrior.momentumPir > 0 && hot.expected <= basic.expected * 1.15);
const moved = project({...p, team: 'Different club'}, r, h, {}, {momentum: {active: true, coefficient: .2}});
assert(moved.personalPrior.historyWeight < basic.personalPrior.historyWeight);
assert.equal(moved.personalPrior.momentumPir, 0);
assert.equal(project({...p, status: 'out'}, r, h).expected, 0);
assert.equal(project({...p, status: 'out'}, r, h).minutes, 0);
assert(project({...p, status: 'questionable'}, r, h).minutes < basic.minutes);
const stale = project(p, {...r, latestSeason: 'E2025'}, h);
assert.equal(stale.currentSeasonGames, 0, 'Historical results must not masquerade as current-season results');
assert.equal(project(p, null, null).expected, p.price * .93);
const invalid = project(p, {latestSeason: 'E2026', currentSeasonGames: 3, season: {pirPerMinute: null, avgMinutes: null}}, null);
assert(Number.isFinite(invalid.expected) && invalid.currentSeasonWeight === 0);
const injury = project(p, r, h, {injuryBoost: 3, injuryUsagePct: 4});
assert(Math.abs(injury.minutes - basic.minutes - 3) < 1e-10);
assert(Math.abs(injury.expected / basic.expected - (injury.minutes / basic.minutes) * 1.04) < 1e-10,
  'Injury opportunity must be applied exactly once, after role estimation');
const coach = project({...p, pos: 'COACH'}, r, h);
assert.equal(coach.expected, 0);
assert.equal(coach.minutes, 0);
console.log('Personal-model regression checks passed');
