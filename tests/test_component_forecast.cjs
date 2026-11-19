'use strict';
const assert=require('node:assert/strict');
const {shots,targets,observed,ledger,project,baseForecast,metrics}=require('../component-forecast-core.cjs');
const {dna,catalog}=require('../scripts/component-feature-catalog.cjs');
const {fitModels,rangeFor}=require('../scripts/component-forecast-fit.cjs');

const stats={fieldGoalsAttempted2:14,fieldGoalsMade2:5,fieldGoalsAttempted3:0,fieldGoalsMade3:0,freeThrowsAttempted:3,
 freeThrowsMade:2,offensiveRebounds:1,defensiveRebounds:5,assistances:2,steals:0,blocksFavour:0,
 turnovers:3,foulsCommited:2,foulsReceived:7,blocksAgainst:1};
const box={minutes:23.4333333333,stats};
const result=observed(box);
assert.equal(ledger(result).pir,11);
assert.equal(result.threeAccuracy,null);
assert.equal(ledger({...result,threeAttempts:1}),null);
assert.equal(ledger({...result,blocked:null}),null);
assert.equal(ledger({...result,twoAccuracy:1.1}),null);
assert.equal(ledger({...result,blocked:100}).negatives,24);
const input={base:baseForecast([box,box]),features:{test:2},details:{}};
const fitted={minutes:[{id:'test',beta:20,center:0,scale:1}],twoAccuracy:[{id:'test',beta:1,center:0,scale:1}]};
const forecast=project(input,fitted);
assert.equal(forecast.components.minutes,40);
assert.equal(forecast.components.twoAccuracy,1);
assert.ok(forecast.components.blocked<=forecast.fieldMisses);
assert.equal(project(input,fitted,'test').pir,11);
assert.equal(project({...input,features:{}},fitted).pir,11);
assert.ok(shots.every(({attempt,accuracy})=>!forecast.components[attempt]||forecast.components[accuracy]<=1));
assert.equal(targets.length,16);
assert.equal(dna.length,82);
assert.equal(new Set(catalog.map(f=>f.id)).size,catalog.length);
assert.ok(catalog.every(x=>x.targets.every(k=>targets.includes(k))));
assert.equal(fitModels([]).audit.projection.eligible.length,0);
assert.equal(rangeFor(input,forecast,{}),null);
assert.equal(metrics([{actual:1,D:11,id:'x',gameCode:1},{actual:2,D:null,id:'y',gameCode:1}],'D').misses10,1);

const rows=Array.from({length:180},(_,i)=>{
 const round=5+Math.floor(i/45),available=(round+1)*100;
 const minVar=i%2?12:2;
 return {round,available,cutoff:round*100,gameCode:round*10+(i%9),base:input.base,features:{minVar},
  target:{...result,minutes:input.base.minutes+(i%2?6:-6)}};
});
const trained=fitModels(rows);
assert.ok(trained.C.minutes.some(item=>item.id==='minVar'));
const future=rows.map(row=>row.round<7?{...row,available:10000}:row);
assert.equal(fitModels(future).C.minutes.length,0);
console.log('Component forecast checks passed');
