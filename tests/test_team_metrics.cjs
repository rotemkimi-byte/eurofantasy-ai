const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('../team-metrics-core.js');
const data=JSON.parse(fs.readFileSync('data/official-offense.json'));assert.equal(data.teamMetricsVersion,1);const report=C.build(data);assert(report.teams.length>1);assert(report.games>0);
assert.equal(report.teams.reduce((s,t)=>s+t.played,0),2*report.games);assert.equal(report.teams.reduce((s,t)=>s+t.wins,0),report.games);assert.equal(report.teams.reduce((s,t)=>s+t.losses,0),report.games);assert.equal(report.teams.reduce((s,t)=>s+t.for-t.against,0),0);
for(const t of report.teams){assert(t.rank>0);assert.equal(t.wins+t.losses,t.played);for(const g of t.games){
 const opposite=report.teams.find(t=>t.team===g.opponent).games.find(r=>r.code===g.code);assert(opposite);assert.equal(g.points,opposite.against);assert.equal(g.pir,opposite.opponentPir);
 const own=data.teamGames[String(g.code)]?.[g.home?'local':'road'];if(own)assert.equal(g.pir,C.num(own.stats.valuation));
}}
const duplicate={...data,teamResults:[...data.teamResults,data.teamResults[0],{...data.teamResults[0],gameCode:999999,date:'2099-01-01'}]};assert.equal(C.build(duplicate).games,report.games);
const removed=JSON.parse(JSON.stringify(data)),code=data.teamResults[0].gameCode;delete removed.teamGames[String(code)];const partial=C.build(removed);assert.equal(partial.games,report.games);const g=partial.teams.flatMap(t=>t.games).find(g=>g.code===code);assert.equal(g.pir,null);assert.equal(g.opponentPir,null);assert.equal(typeof g.points,'number');
const official={...data,officialStandings:{source:'https://example.com/official',rows:report.teams.map((t,i)=>({team:t.team,rank:report.teams.length-i}))}};const byOfficial=C.build(official);assert(byOfficial.official);assert.equal(byOfficial.teams[0].team,report.teams.at(-1).team);
const missingRanks={...official,officialStandings:{rows:official.officialStandings.rows.slice(1)}};assert(!C.build(missingRanks).official,'partial official rankings cannot be mixed with calculated positions');
const summary=C.summarize([{points:80,against:70,pir:100,opponentPir:80,stats:{},opponentStats:{}},{points:60,against:90,pir:null,opponentPir:80,stats:{},opponentStats:{}}]);assert.equal(summary.for,140);assert.equal(summary.pir,100);assert.equal(summary.pirGames,1);assert.equal(summary.made,null);
console.log(`PASS: ${report.teams.length} teams, ${report.games} results; totals, standings, mirrored PIR, historical games, missing reports and duplicate/future exclusion.`);
