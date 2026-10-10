const assert=require('node:assert/strict');
const core=require('../matchup-context-core.js');
const data={schema:'matchup-context-v1',season:'E2026',updated_at:new Date().toISOString(),players:{},defense:{},league:{},teams:{}};
const p={name:'X',team:'A',opponent:'B',pos:'C',price:15,status:'active'};
const base={expected:25,minutes:25,floor:10,ceiling:35,match:{opponent:'B',margin:5,winProb:.65},learning:{}};
assert.deepEqual(core.project(base,p,{}),base);
assert.deepEqual(core.project(base,{...p,status:'out'},data),base);
let x=core.project(base,p,data);assert.equal(x.expected,25);assert.equal(x.minutes,25);
assert.ok(Math.abs(x.context.scenarios.reduce((s,r)=>s+r.weight,0)-1)<1e-8);
assert.ok(x.floor<=x.expected&&x.ceiling>=x.expected);
assert.ok(!x.context.minutesCorrectionActive);
assert.equal(core.valid({...data,updated_at:'2020-01-01'}),false);
data.players[core.key('X')]={name:'X',team:'A',pos:'C',games:10,avgMinutes:25,previousGames:8,recentGames:2,previousEventsPerMinute:.5,recentEventsPerMinute:1,averages:{fieldGoalsAttempted2:8,fieldGoalsAttempted3:3},logs:Array.from({length:10},(_,i)=>({minutes:i<5?29:20,margin:i<5?5:20}))};
data.league={rate2:.5,rate3:.35};data.defense.B={games:10,made2:30,attempts2:100,made3:10,attempts3:100};
x=core.project(base,p,data);assert.ok(x.context.defenseFactor<1);assert.ok(x.context.involvementFactor>1);assert.ok(x.minutes>=23&&x.minutes<=27);assert.ok(x.context.minutesCorrectionActive);
const matches={A:{opponent:'B',home:true,margin:5,total:170},B:{opponent:'A',home:false,margin:-5,total:170}};
data.teams={A:{opponent:'B',home:true,margin:3,winProb:.6},B:{opponent:'A',home:false,margin:-3,winProb:.4}};
core.applyTeams(matches,data);assert.equal(matches.A.winProb+matches.B.winProb,1);
for(const m of Object.values(matches)){
 assert.ok(Math.abs(m.p1_10+m.p11_20+m.p20-m.winProb)<1e-8);
 assert.ok(Math.abs(m.l1_10+m.l11_20+m.l20-(1-m.winProb))<1e-8);
}
const once=JSON.stringify(matches);core.applyTeams(matches,data);assert.equal(JSON.stringify(matches),once);
const staleFixture={...data,teams:{A:{opponent:'OTHER',home:true,margin:20,winProb:.9}}};core.applyTeams(matches,staleFixture);assert.equal(matches.A.margin,3);
console.log('Context core: bounded effects, missing/stale fallback, coherent probabilities and idempotence passed');
