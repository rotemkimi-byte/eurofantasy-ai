'use strict';
const assert=require('node:assert/strict');
const C=require('../weighted-forecast-core.js');
const P=require('../personal-model-core.js');
const official=require('../data/official-offense.json');
const advanced=require('../data/advanced-players.json');
const roster=require('../data/players.json');

assert.equal(C.definitions.length,22);
assert(C.valid(C.defaults));
assert(C.valid(C.normalize({...C.defaults,performance:77})));
assert(!C.valid({...C.defaults,performance:77}));
assert(!C.valid({...C.defaults,performance:null}));
const only=id=>Object.fromEntries(C.definitions.map(d=>[d.id,d.id===id?100:0]));
const values=C.definitions.map(d=>d.id==='performance'?1:d.id==='usage'?-.5:null);
const player={pos:'G',status:'active',price:5};
const base={expected:10,minutes:20,match:{home:false},floor:7,ceiling:14};
const saved=C.input(player,base,values);
assert.equal(C.project(saved,only('performance')),13);
assert.equal(C.project(saved,only('usage')),8.5);
assert.equal(C.project(saved,only('shotMap')),10);
const served=C.apply({...base},player,saved,only('performance'));
assert.equal(served.minutes,20);
assert.equal(served.match.home,false);
assert.equal(served.value,2.6);
assert.equal(C.project(C.input({...player,status:'out'},{expected:0,minutes:0},values),only('performance')),0);
assert.equal(C.input({...player,pos:'COACH'},base,values),null);
const day={savedAt:'2026-11-09T00:00:00Z',weights:only('performance'),players:[[14,10,3,values]]};
const good=C.assess([day]),bad=C.assess([{...day,players:[[8,10,3,values]]}]);
assert.equal(good.rows.find(r=>r.id==='performance').delta,3);
assert.equal(bad.rows.find(r=>r.id==='performance').delta,-3);
assert.equal(good.rows.find(r=>r.id==='usage').delta,null);
assert.equal(C.assess([day],()=>null).n,0);

const data=C.build(official,advanced,P);
const early=C.build(official,advanced,{...P,asOf:Date.parse('2026-09-23T00:00:00Z')});
assert(early.profiles.size===0&&early.clubs.size===0,'future results excluded');
const active=roster.filter(p=>['G','F','C'].includes(p.pos)&&p.status==='active');
const sample=active.map(p=>C.signals(p,{basePir:8,baseMin:20,injuryBoost:1,injuryUsagePct:2,
 positionMatchup:{sampleGames:10},positionMatchPct:2},data,roster));
assert(sample.every(row=>row.every(s=>s===null||Number.isFinite(s)&&Math.abs(s)<=1)));
for(const id of ['performance','usage','box','shotMap','playerDna','teamMarket','teamMatchup','teamFreeThrows']){
 const i=C.definitions.findIndex(d=>d.id===id);
 assert(sample.some(row=>row[i]!==null&&row[i]!==0),id+' uses actual data');
}
console.log('Weighted forecast: real inputs, normalization, live adjustment and round attribution verified');
