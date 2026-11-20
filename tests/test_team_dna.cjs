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
const before=Date.parse(game.date);
const defense=D.matchupDefense(model.teams,team.team,{before,limit:1});
const prior=team.games.find(g=>Date.parse(g.date)<before);
const rivalBox=prior.opponentStats;
const rivalFga=rivalBox.fieldGoalsAttempted2+rivalBox.fieldGoalsAttempted3;
const rivalActions=rivalFga+.44*rivalBox.freeThrowsAttempted+rivalBox.turnovers;
near(defense.allowed.allowedTwo.value,100*rivalBox.fieldGoalsMade2/rivalBox.fieldGoalsAttempted2);
near(defense.allowed.forced.value,100*rivalBox.turnovers/(rivalActions-rivalBox.offensiveRebounds));
assert.deepEqual(Object.keys(defense.allowed),['allowedThree','allowedTwo','allowedFastbreak','allowedRebound','allowedSecondChance','forced','steals','allowedFouls','allowedRim']);
for(const spec of D.defense)assert.deepEqual(defense.allowed[spec[0]],D.summarize([prior],[spec])[spec[0]]);
assert.equal(defense.allowed.allowedTwo.total,1);
assert.equal(defense.count,1);
assert.equal(defense.benchmarks.allowedTwo.percentile(defense.allowed.allowedTwo),null);
assert.equal(defense.league.allowedTwo.total,model.teams.length);
const seasonDefense=D.matchupDefense(model.teams,team.team,{before});
const contextPairs=[['fastbreak','allowedFastbreak'],['secondChance','allowedSecondChance']];
let coveredContexts=0;
for(const t of model.teams)for(const g of t.games){
 const opponent=model.teams.find(x=>x.team===g.opponent)?.games.find(x=>x.code===g.code);
 for(const [offensive,allowed] of contextPairs){
  if(g.metrics[allowed]===null)continue;
  assert.deepEqual(g.metrics[allowed],opponent.metrics[offensive]);
  assert.equal(g.metrics[allowed][1],g.against);
  coveredContexts++;
 }
}
assert.ok(coveredContexts>0);
for(const [offensive,allowed] of contextPairs){
 const covered=team.games.filter(g=>Date.parse(g.date)<before&&g.metrics[allowed]);
 near(seasonDefense.allowed[allowed].value,100*covered.reduce((n,g)=>n+g.metrics[allowed][0],0)/covered.reduce((n,g)=>n+g.against,0));
 assert.ok(Number.isInteger(seasonDefense.benchmarks[allowed].percentile(seasonDefense.allowed[allowed])));
 assert.equal(D.matchupMetrics.find(spec=>spec[5]===allowed)[0],offensive);
}
const wrongSeason=D.build(official,{...advanced,season:'E2025'},T,Date.now(),events);
for(const [,allowed] of contextPairs)assert.equal(D.matchupDefense(wrongSeason.teams,team.team).allowed[allowed].value,null);
const missingTags=structuredClone(advanced.games[game.code]);
const rivalScorer=Object.values(missingTags.players).find(p=>p.team===game.opponent&&p.minutes>0&&p.stats.points>0);
rivalScorer.styleShots.fastbreak=null;
const incomplete=D.build(official,{...advanced,games:{...advanced.games,[game.code]:missingTags}},T,Date.now(),events);
const incompleteGame=incomplete.teams.find(t=>t.team===team.team).games.find(g=>g.code===game.code);
assert.equal(incompleteGame.metrics.allowedFastbreak,null);
assert.deepEqual(incompleteGame.metrics.allowedSecondChance,game.metrics.allowedSecondChance);
const rankSample=[10,20,30,40,50,60].map(value=>({value,count:3,minutes:120,denominator:20}));
assert.equal(D.benchmark(rankSample,'allowedRim',false,{raw:true}).percentile(rankSample[0]),8);
assert.equal(D.benchmark(rankSample,'allowedRim').percentile(rankSample[0]),92);
assert.equal(D.benchmark(rankSample,'twoAccuracy',true,{raw:true}).percentile({...rankSample[0],denominator:2}),null);
assert.equal(D.benchmark(rankSample,'twoAccuracy',true,{raw:true}).percentile(rankSample[5]),92);
assert.ok(Number.isInteger(seasonDefense.benchmarks.allowedTwo.percentile(seasonDefense.allowed.allowedTwo)));
const firstGame=team.games.at(-1);
assert.equal(D.matchupDefense(model.teams,team.team,{before:Date.parse(firstGame.date)}).allowed.allowedTwo.value,null);
const away=team.games.find(g=>!g.home);
const awayDefense=D.matchupDefense(model.teams,team.team,{venue:'away',limit:1}).allowed;
near(awayDefense.allowedThree.value,100*away.opponentStats.fieldGoalsMade3/away.opponentStats.fieldGoalsAttempted3);
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
