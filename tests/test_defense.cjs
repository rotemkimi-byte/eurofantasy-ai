const assert=require('node:assert/strict'),fs=require('node:fs'),D=require('../defense-core.js');
const data=JSON.parse(fs.readFileSync('data/official-offense.json'));
assert.equal(data.defenseVersion,1);const env=D.environment(data);assert(env.games>0);
let perTotal=0,minutes=0,seen=0;
for(const p of Object.values(data.players))for(const g of p.games){
 const m=D.gameMetrics(g,data,env);if(g.minutes>0){
  assert.equal(m.stocks,g.stats.steals+g.stats.blocksFavour);
  const game=data.teamGames[String(g.gameCode)],opp=game[g.home?'road':'local'],own=game[g.home?'local':'road'];
  if(m.blk.value!==null)assert(Math.abs(m.blk.value-100*g.stats.blocksFavour/(g.minutes/own.gameMinutes*opp.stats.fieldGoalsAttempted2))<1e-8);
  if(m.reb.value!==null)assert(Math.abs(m.reb.value-100*g.stats.totalRebounds/(g.minutes/own.gameMinutes*(own.stats.totalRebounds+opp.stats.totalRebounds)))<1e-8);
  if(m.per!==null){perTotal+=m.per*g.minutes;minutes+=g.minutes;}seen++;
 }
}
assert(seen>0);assert(minutes>0);assert(Math.abs(perTotal/minutes-15)<1e-8,'minute-weighted league PER must be 15');
const player=Object.values(data.players).find(p=>p.games.some(g=>g.minutes>0&&g.stats.blocksFavour>0));assert(player);
const g=player.games.find(g=>g.minutes>0&&g.stats.blocksFavour>0),m=D.gameMetrics(g,data,env);
assert.equal(D.gameMetrics({...g,minutes:0},data,env).blk.value,null);
assert.equal(D.gameMetrics({...g,stats:{...g.stats,steals:null}},data,env).stocks,null);
assert.equal(D.gameMetrics({...g,stats:{...g.stats,blocksFavour:null}},data,env).blk.value,null);
assert.equal(D.gameMetrics({...g,stats:{...g.stats,totalRebounds:null}},data,env).per,null);
const changed=JSON.parse(JSON.stringify(data));changed.teamGames[String(g.gameCode)][g.home?'road':'local'].stats.fieldGoalsAttempted2=0;
assert.equal(D.gameMetrics(g,changed,env).blk.value,null,'zero opportunity denominator remains unknown');
const sample=[g,{...g,minutes:g.minutes/2}],a=D.summarize(sample,data,env);
const expected=100*(2*g.stats.blocksFavour)/(m.blk.exposure*1.5);assert(Math.abs(a.blk.value-expected)<1e-8,'aggregate rates use summed exposures');
assert.equal(D.summarize([{...g,minutes:0}],data,env).per.value,null);
const future=JSON.parse(JSON.stringify(data));future.teamGames.future={...Object.values(data.teamGames)[0],date:'2099-01-01'};
assert.equal(D.environment(future).games,env.games,'future games excluded from league baseline');
console.log(`PASS: ${seen} official appearances; Stocks, block/rebound rates, weighted aggregate, missing data, DNP, future isolation and normalized PER.`);
