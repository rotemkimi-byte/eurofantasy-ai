'use strict';
const assert=require('node:assert/strict');
const M=require('../dna-player-core.js');
const D=require('../dna-core.js');
const T=require('../team-metrics-core.js');
const W=require('../weighted-forecast-core.js');
const O=require('../official-offense-core.js');
const official=require('../data/official-offense.json');
const advanced=require('../data/advanced-players.json');
const context=M.seasonContext(official,advanced);
const all=[...context.players.values()];
const player=all.find(p=>/VEZENKOV/.test(p.name));
const record={...player,team:player.games[0].team};
const report=M.summarize(record,context);
const games=report.games;
const components=M.pirLedger(games);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.equal(D.playerMetrics.length,14);
assert.equal(new Set(M.catalog.map(m=>m.id)).size,M.catalog.length);
assert.equal(M.catalog.length+D.playerMetrics.length-Object.values(M.detailRows).flat().length,80);
near(report.stats.ts.value,O.aggregate(games).tsPct);
near(report.stats.efg.value,O.aggregate(games).efgPct);
near(components.plus+components.minus,components.net);
near(components.net,games.reduce((s,g)=>s+g.stats.valuation,0));
near(report.stats.scoringShare.value+report.stats.otherShare.value,100);
near(report.stats.otherAttack.details.reduce((s,[,n])=>s+n,0),100);
near(report.stats.pirMinute.value*40,report.stats.pir40.value);
assert.ok(report.stats.rimAttempts.value>0);
assert.ok(report.stats.scoringDependence.value>0);
assert.ok(report.stats.pirStability.value!==null);
assert.equal(M.summarize(record,context,{limit:1}).games.length,1);
assert.equal(M.summarize(record,context,{limit:5}).games.length,5);
assert.ok(M.summarize(record,context,{venue:'away'}).games.every(g=>g.home===false&&!g.neutral));
assert.equal(M.select([{home:true,neutral:true},{home:true,neutral:false}],0,'home').length,1);
const empty=M.summarize({id:'missing'},context);
assert.ok(Object.values(empty.stats).every(s=>s.value===null));
assert.equal(M.seasonContext({...official,season:'E2025'},advanced).players.size,0);
assert.ok(M.summarize(record,M.seasonContext(official,{...advanced,season:'E2025'})).stats.rimAttempts.value===null);
assert.equal(M.pirLedger([{...games[0],stats:{...games[0].stats,valuation:999}}]),null);
assert.equal(M.pirLedger([{...games[0],stats:{...games[0].stats,blocksAgainst:null}}]),null);
const zero={...games[0],event:null,stats:{...games[0].stats,points:0,fieldGoalsMade2:0,fieldGoalsMade3:0,fieldGoalsAttempted2:0,fieldGoalsAttempted3:0,freeThrowsAttempted:0,freeThrowsMade:0,turnovers:0},metrics:{...games[0].metrics,fga:0,freeThrowAttempts:0}};
const z=M.summarize(record,{...context,players:new Map([[record.id,{games:[zero]}]])}).stats;
for(const id of ['ts','efg','tovPct','astTo','ftr','missPct','scoringDependence'])assert.equal(z[id].value,null,id);
const teamModel=D.build(official,advanced,T),clubs=M.buildRivals(context);
const measured=[...clubs].filter(([name,r])=>name!==record.team&&r.covered.length>=2).map(([name])=>
 M.opponentReport(M.summarize(record,context),context,clubs,name,record.team,teamModel).stats);
assert.ok(measured.some(m=>m.matchFit.value!==null));
assert.ok(measured.every(m=>m.allowedZones.value>0&&m.pirWeakness.rank!==undefined));
const asOf=Date.parse(official.updated_at)+3600000,fixture=games[0].gameCode;
const pre=M.seasonContext(official,advanced,asOf,{pregame:true,fixtureCode:fixture});
assert.ok(!pre.games.has(String(fixture)));
assert.ok([...pre.games.values()].every(g=>Date.parse(g.date)+4*3600000<=asOf));
assert.equal(M.seasonContext(official,advanced,Date.parse(official.updated_at)-1,{pregame:true}).games.size,0);
assert.throws(()=>M.features(record,context));
const data=W.build(official,advanced,{key:D.key,team:t=>t,asOf});
assert.deepEqual(data.playerDna(record,fixture),M.features(record,pre));
assert.equal(M.features(record,pre).season,'E2026');
const frozen={base:11,scale:4,signals:W.definitions.map((_,i)=>i%3===0?.3:null)};
const projection=M.projection(frozen,W,W.defaults);
near(projection.value,W.project(frozen));
near(projection.details.reduce((s,[,n])=>s+n,0),projection.value);
let validated=0;
for(const p of all){
 const rows=p.games.filter(g=>g.minutes>0);
 if(!rows.length)continue;
 const ledger=M.pirLedger(rows);
 assert.equal(ledger.rows.length,rows.length,p.name);
 validated+=rows.length;
 const stats=M.summarize({...p,team:rows[0].team},context).stats;
 for(const [id,s] of Object.entries(stats))assert.ok(s.value===null||Number.isFinite(s.value),p.name+' '+id);
}
console.log('Player DNA formulas, coverage, pregame cutoffs, 80 rows and official PIR reconciliation across '+validated+' appearances passed.');

const help=require('../dna-metric-explanations.js');
const dnaEvents=require('../data/player-dna-events.json');
const enriched=M.seasonContext(official,advanced,Date.now(),{dnaEvents});
const enrichedRecord=enriched.players.get(record.id);
const enrichedReport=M.summarize({...enrichedRecord,team:record.team},enriched);
const rivalCoverage=M.buildRivals(enriched);
assert.equal(Object.keys(help.rows).length,M.catalog.length+M.addedMetrics.length);
for(const spec of [...M.catalog,...M.addedMetrics]){
 assert.ok(help.rows[spec.id].slice(0,4).every(t=>typeof t==='string'&&t.length>0),spec.id);
 assert.ok(help.method(spec).length>20,spec.id);
 assert.ok(help.reason(spec,{value:null},{games:[{}]},'rival')?.length>10,spec.id);
}
assert.ok(enrichedReport.shotGames>=report.shotGames);
assert.ok([...rivalCoverage.values()].every(r=>r.covered.length>=2));
const full=enrichedReport.games.filter(g=>g.onCourt?.[0]?.person.assistances!==undefined);
assert.ok(full.length);
const entries=full.flatMap(g=>g.onCourt);
const assisted=entries.reduce((n,l)=>n+l.person.assistances,0);
const baskets=entries.reduce((n,l)=>n+l.own.fieldGoalsMade2+l.own.fieldGoalsMade3-l.person.fieldGoalsMade2-l.person.fieldGoalsMade3,0);
near(enrichedReport.stats.astPct.value,100*assisted/baskets);
assert.equal(enrichedReport.stats.astPct.count,full.length);
for(const g of enrichedRecord.games.filter(g=>g.onCourt)){
 const {onCourt}=g;
 assert.ok(Math.abs(onCourt.reduce((n,l)=>n+l.seconds,0)-g.minutes*60)<=3);
 for(const k of dnaEvents.fields.filter(k=>Number.isFinite(onCourt[0].person[k]))){
  assert.equal(onCourt.reduce((n,l)=>n+l.person[k],0),g.stats[k],k+' in game '+g.gameCode);
 }
}
const samples=new Map();
for(const p of enriched.players.values()){
 const played=p.games.find(g=>g.minutes>0);
 if(!played)continue;
 const r=M.summarize({...p,team:played.team},enriched);
 for(const {id} of M.addedMetrics)if(Number.isFinite(r.stats[id].value))samples.set(id,(samples.get(id)||0)+1);
}
assert.equal(samples.size,M.addedMetrics.length);
const polluted=M.seasonContext(official,advanced,Date.now(),{dnaEvents:{...dnaEvents,season:'E2025'}});
assert.ok(polluted.players.get(record.id).games.every(g=>!g.onCourt&&!g.extraZone));
assert.ok(M.seasonContext(official,advanced,asOf,{pregame:true,dnaEvents}).players.get(record.id).games.every(g=>!g.onCourt&&!g.extraZone));
const zeroRebound=enrichedReport.games.find(g=>g.onCourt?.[0]?.person.offensiveRebounds!==undefined&&g.stats.offensiveRebounds===0&&
 g.onCourt.some(l=>l.own.offensiveRebounds+l.rival.defensiveRebounds>0));
if(zeroRebound)assert.equal(M.summarize(record,enriched,{gameCode:zeroRebound.gameCode}).stats.orbPct.value,0);
console.log('Player DNA explanations and reconciled event coverage:',Object.fromEntries(samples));
