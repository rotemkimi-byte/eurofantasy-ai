const assert=require('node:assert/strict'),fs=require('node:fs'),O=require('../official-offense-core.js');
const data=JSON.parse(fs.readFileSync('data/official-offense.json'));
const player={name:'Elijah Bryant',team:'Hapoel Tel Aviv'},past=O.report(data,player,{gameCode:61});
assert(past);assert.equal(past.observed.metrics.fga,14);assert.equal(past.observed.metrics.threeAttempts,4);assert.equal(past.observed.home,true);
assert(past.peers.every(p=>p.last.position===past.latest.position));assert(past.peers.every(p=>p.last.date<=past.cutoff));
const early=O.report(data,player,{gameCode:3});assert.equal(early.season.games,1);assert.equal(early.trend,null);
const future=O.report(data,player,{minutes:25});assert.equal(future.projected.fga,25*future.baseline.fgaPerMinute);
assert.equal(O.report(data,player,{minutes:0}).projected.fga,0);
assert.equal(O.report(data,player,{minutes:null}).projected,null);
const altered=JSON.parse(JSON.stringify(data));for(const p of Object.values(altered.players))for(const g of p.games)if(g.date>early.cutoff){g.metrics.fga=999;g.minutes=999;}
assert.deepEqual(O.report(altered,player,{gameCode:3}),early);
const row={minutes:20,metrics:{usageEvents:10,usageExposure:30,fga:8,threeAttempts:3,twoAttempts:5,freeThrowAttempts:0},stats:{points:8,fieldGoalsMade2:1,fieldGoalsMade3:2}};
const agg=O.aggregate([row,{...row,metrics:{...row.metrics,usageEvents:2,usageExposure:10}}]);assert.equal(agg.usagePct,30);
assert.equal(O.aggregate([{...row,metrics:{...row.metrics,usageExposure:null}}]).usagePct,null);
console.log('PASS: official fixture values, pooled Usage, future shot estimates, historical isolation and missing data');
