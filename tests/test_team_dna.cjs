'use strict';
const assert=require('node:assert/strict');
const D=require('../dna-core.js');
const T=require('../team-metrics-core.js');
const official=require('../data/official-offense.json');
const advanced=require('../data/advanced-players.json');
const events=require('../data/team-dna-events.json');
const metrics=D.teamGroups.flatMap(([,rows])=>rows);
const IDs=[...D.offense,...D.defense,...metrics].map(([id])=>id);
assert.equal(new Set(IDs).size,IDs.length);
const model=D.build(official,advanced,T,Date.now(),events);
const team=model.teams.find(t=>t.team==='Olympiacos');
const games=D.select(team.games,3);
assert.equal(games.length,3);
const report=D.summarize(games,metrics);
const sum=read=>games.reduce((n,g)=>n+read(g),0);
const box=k=>sum(g=>g.stats[k]);
const fga=box('fieldGoalsAttempted2')+box('fieldGoalsAttempted3');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
near(report.ts.value,100*sum(g=>g.points)/(2*(fga+.44*box('freeThrowsAttempted'))));
near(report.efg.value,100*(box('fieldGoalsMade2')+1.5*box('fieldGoalsMade3'))/fga);
near(report.ftr.value,100*box('freeThrowsAttempted')/fga);
near(report.assistToTurnover.value,box('assistances')/box('turnovers'));
const fixture=games.find(g=>events.games[g.code]?.teams[g.team]?.midAttempts>=5&&events.games[g.code]?.teams[g.opponent]?.rimAttempts>=5);
if(fixture){
 const event=events.games[fixture.code],own=event.teams[fixture.team],rival=event.teams[fixture.opponent];
 const single=D.summarize([fixture],metrics);
 near(single.midVolume.value,own.midAttempts);
 near(single.midAccuracy.value,100*own.midMade/own.midAttempts);
 near(single.allowedRim.value,100*rival.rimMade/rival.rimAttempts);
 if(own.offTurnover!==null)near(single.turnoverPoints.value,own.offTurnover);
}
assert.equal(report.fastAccuracy.value,null);
assert.equal(report.secondEfficiency.value,null);
assert.equal(D.summarize(games.slice(0,1),metrics).offensiveStability.value,null);
const makeGame=(offensiveRating,scored)=>({offensiveRating,points:100,scorers:new Map(scored),metrics:{}});
const synthetic=[
 makeGame(90,[['a',40],['b',35],['c',25]]),
 makeGame(100,[['a',25],['b',40],['c',35]]),
 makeGame(110,[['a',30],['b',25],['c',45]])
];
const range=D.summarize(synthetic,metrics);
near(range.offensiveStability.value,Math.sqrt(200/3));
near(range.topTwoShare.value,100*205/300);
assert.equal(D.summarize([...synthetic,{metrics:{},points:80}],metrics).topTwoShare.value,null);
const [game]=games;
const verifiedLine=(stats,points)=>({
 attempts:stats.fieldGoalsAttempted2+stats.fieldGoalsAttempted3,
 located:stats.fieldGoalsAttempted2+stats.fieldGoalsAttempted3,
 points,midMade:3,midAttempts:8,rimMade:4,rimAttempts:10,offTurnover:9
});
const fixtureEvents={season:'E2026',games:{[game.code]:{date:game.date,teams:{
 [game.team]:verifiedLine(game.stats,game.points),
 [game.opponent]:verifiedLine(game.opponentStats,game.against)
}}}};
const covered=D.build(official,advanced,T,Date.now(),fixtureEvents).teams.find(t=>t.team===game.team);
const verified=D.summarize([covered.games[0]],metrics);
near(verified.midVolume.value,8);
near(verified.midAccuracy.value,37.5);
near(verified.rimAccuracy.value,40);
near(verified.allowedRim.value,40);
near(verified.turnoverPoints.value,9);
const noEvents=D.build(official,advanced,T,Date.now(),{...events,season:'E2025'});
const missing=D.summarize(noEvents.teams.find(t=>t.team===team.team).games,metrics);
for(const id of ['midVolume','midAccuracy','rimAccuracy','allowedRim','turnoverPoints'])assert.equal(missing[id].value,null,id);
assert.ok(missing.efg.value>0);
assert.equal(D.build({...official,season:'E2025'},advanced,T).teams.length,0);
console.log('Team DNA: 13 rows, weighted ratios, verified shots, missing inputs, stability, scoring concentration and season isolation passed.');
