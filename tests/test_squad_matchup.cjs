'use strict';
const assert = require('node:assert/strict');
const S = require('../squad-matchup.js');
const W = require('../weighted-forecast-core.js');
const official = require('../data/official-offense.json');
const schedule = require('../data/context/E2026-schedule.json');
const canonical = team => team.startsWith('Panathinaikos') ? 'Panathinaikos' : team;
const now = Date.parse('2026-11-14T16:25:00Z');

assert.deepEqual(S.fixture(schedule,'Virtus Bologna',canonical,now), {
 team:'Panathinaikos',home:true,date:Date.parse('2026-11-17T20:00:00Z'),round:12
});
assert.equal(S.fixture(schedule,'Panathinaikos',canonical,now).home,false);
assert.equal(S.fixture(schedule,'Unknown',canonical,now),null);
assert.deepEqual(S.gameStats({...official,season:'E2025'},canonical,now),[]);
const games = S.gameStats(official,canonical,now);
const defense = S.comparison(games,'C','Panathinaikos');
const rows = games.filter(g => g.pos==='C' && g.opponent==='Panathinaikos');
assert.equal(defense.games,new Set(rows.map(g=>g.gameCode)).size);
assert.equal(defense.appearances,rows.length);
assert.ok(defense.games>0);
assert.equal(defense.rows[0].actual, rows.reduce((a,g)=>a+g.stats.valuation,0)/rows.length);
assert.ok(defense.rows.every(r=>r.normal!==null && r.actual!==null));
assert.ok(S.comparison(games,'C','Unknown').rows.every(r=>r.actual===null));
assert.equal(S.positionPlayer(games,[{name:'Mathias Lessort',pos:'C',status:'out'}],
 'Panathinaikos','C',name=>name.toLowerCase()),null);

const signals = W.definitions.map(d => ({market:.8,playerMatchup:-.5,pirWeakness:.7}[d.id]??null));
const frozen = W.input({pos:'C',status:'active'},{minutes:22,expected:16},signals);
const forecast = W.apply({expected:16},{price:10},frozen,W.defaults);
const before = W.project(frozen,W.defaults,W.definitions.findIndex(d=>d.id==='playerMatchup'));
assert.equal(forecast.expected,W.project(frozen,W.defaults));
assert.equal(forecast.weightedMatchupBase,before);
assert.equal(W.apply({expected:16},{price:10},{...frozen,signals:signals.map(()=>null)},W.defaults).weightedMatchupBase,null);
console.log('PASS: schedule, venue, season, official comparison, missing samples, unavailable rival and unchanged served forecast');
