'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const U=require('../unified-forecast-core.js');
const W=require('../weighted-forecast-core.js');
const advanced=require('../data/advanced-players.json');
const official=require('../data/official-offense.json');
const P=require('../personal-model-core.js');

let compared=0;
for(const game of Object.values(advanced.games)){
 for(const p of Object.values(game.players)){
  const components=U.components(p.stats);
  if(!components||!(p.minutes>0))continue;
  assert.equal(Object.values(components).reduce((a,b)=>a+b,0),p.stats.valuation,p.name);
  compared++;
 }
}
assert(compared>1000,'PIR formula reconciles with real official valuations');
assert.equal(U.components({points:5}),null,'incomplete components do not become zero');
const data=W.build(official,advanced,P);
const newcomer={name:'New Player',team:'Paris',pos:'G',status:'active',price:5};
const captured=U.capture(newcomer,{minutes:14,expected:5,basePir:5,baseMin:14},data,[],W);
assert.equal(captured.profile,null);
assert.equal(captured.tools.playerDna,null);
assert.equal(U.project(captured).expected,5);
assert.deepEqual(U.project({...captured,status:'out'}),{expected:0,minutes:0,floor:0,ceiling:0,rate:0});
const toolInput={...captured,tools:{teamMarket:1,playerDna:1}};
const adjustments={minutes:{teamMarket:2},rate:{playerDna:3},radius:8};
const prediction=U.project(toolInput,adjustments);
assert.equal(prediction.minutes,16);
assert(prediction.expected>U.project(toolInput,adjustments,'playerDna').expected);
assert.equal(U.project(toolInput,adjustments,['teamMarket','playerDna']).expected,5);
assert.equal(prediction.ceiling-prediction.floor,16);
const rows=[],results={};
for(let game=1;game<=8;game++){
 const start=`2026-10-${10+game}T20:00:00Z`,cutoff=start.replace('20:00','12:00');
 results[game]={};
 for(let known=1;known<game;known++)
  results[game][known]=Object.fromEntries(Array.from({length:12},(_,i)=>['p'+i,[8,20]]));
 for(let i=0;i<12;i++)rows.push({gameCode:game,start,cutoff,key:'p'+i,name:'p'+i,team:'Paris',
  input:toolInput,servedVersion:'v1',served:{expected:5,minutes:14},actualPir:8,actualMinutes:20});
}
function score(rows,results){
 const result=spawnSync(process.execPath,['scripts/score-unified.cjs'],
  {input:JSON.stringify({archivedReplay:{rows,results},prospective:{rows:[],results:{}}}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return JSON.parse(result.stdout);
}
assert.equal(score(rows,results).archivedReplay.heldOutN,24,'first six games are for training');
assert.equal(score(rows,{}).archivedReplay.heldOutN,0,'past kickoff does not prove the outcome was published');
const futureOnly=Object.fromEntries(Object.keys(results).map(code=>[code,{8:results[8][7]}]));
assert.equal(score(rows,futureOnly).archivedReplay.heldOutN,0,'future results never enter training');
assert.equal(score(rows,results).eligibleForReview,false,'a replay cannot qualify the model for adoption');
console.log(`Unified forecast: ${compared} official PIR checks, missing inputs, minutes, ablations and time cutoffs passed`);
