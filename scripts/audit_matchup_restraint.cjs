const fs=require('fs'),vm=require('vm');
const rows=JSON.parse(fs.readFileSync(0,'utf8'));
const personal=fs.readFileSync('personal-model-core.js','utf8'),context=fs.readFileSync('matchup-context-core.js','utf8');
// Candidates fixed before examining held-out rounds 7 and 8. No search on holdout.
const specs=[{id:'baseline'},
{id:'position_full',p:.35,to:1},
{id:'team_full',team:true},
{id:'shooting_full',shoot:true},
{id:'usage_full',usage:true},
{id:'recent_faster',recent:true},
{id:'combined_matchup',p:.35,to:1,team:true,shoot:true,usage:true}];
const outputs={};
for(const spec of specs){
 let pc=personal,cc=context;
 if(spec.p)pc=pc.replace('/ 100 * .35','/ 100 * '+spec.to);
 if(spec.team)pc=pc.replace('/ 100 * .6','/ 100 * 1');
 if(spec.recent)pc=pc.replace('games / (games + 4)','games / (games + 2)');
 if(spec.shoot)cc=cc.replace('*.35,-.03,.03','*1,-.10,.10');
 if(spec.usage)cc=cc.replace(')*.20*reliability,-.06,.06',')*.60*reliability,-.15,.15');
 if(spec.id!=='baseline' && pc===personal && cc===context)throw Error('candidate not applied '+spec.id);
 const sandbox={};vm.createContext(sandbox);vm.runInContext(pc,sandbox);vm.runInContext(cc,sandbox);
 outputs[spec.id]=rows.map(r=>{
 const a=r.input;vm.runInContext('Date.now=()=>'+Date.parse(a.asOf),sandbox);
 const base=sandbox.PersonalForecast.project(a.player,a.recent,a.history,a.context,a.config);base.match=a.match;
 const x=sandbox.MatchupContext.project(base,a.player,a.contextData);
 return {pred:x.expected,minutes:x.minutes,context:x.context};});
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const metric=(indices,id)=>{const errs=indices.map(i=>rows[i].actualPir-outputs[id][i].pred);return {n:indices.length,games:new Set(indices.map(i=>rows[i].gameCode)).size,mae:mean(errs.map(Math.abs)),rmse:Math.sqrt(mean(errs.map(x=>x*x))),biasActualMinusPred:mean(errs),largeMisses:errs.filter(x=>Math.abs(x)>=10).length,under10:errs.filter(x=>x>=10).length,over10:errs.filter(x=>x<=-10).length};};
const eligible=rows.map((r,i)=>i).filter(i=>rows[i].input.player.status==='active'&&outputs.baseline[i].minutes>=5);
const train=eligible.filter(i=>rows[i].round<=6),holdout=eligible.filter(i=>rows[i].round>=7);
if(train.length<60||holdout.length<60||new Set(train.map(i=>rows[i].gameCode)).size<6||new Set(holdout.map(i=>rows[i].gameCode)).size<6)throw Error('Insufficient chronological audit sample');
const trials=specs.map(s=>({id:s.id,train:metric(train,s.id)}));
const selected=trials.reduce((a,b)=>b.train.mae<a.train.mae?b:a).id;
const before=metric(holdout,'baseline'),after=metric(holdout,selected);
const perRound=[7,8].map(round=>({round,baseline:metric(holdout.filter(i=>rows[i].round===round),'baseline'),candidate:metric(holdout.filter(i=>rows[i].round===round),selected)}));
const activate=selected!=='baseline'&&after.mae<before.mae*.98&&after.rmse<=before.rmse&&perRound.every(x=>x.candidate.mae<=x.baseline.mae);
const coverage={total:eligible.length,position:0,shooting:0,involvement:0,pace:0};
for(const i of eligible){const a=rows[i].input,c=outputs.baseline[i].context; if(a.context.positionPct!==0)coverage.position++;if(c?.defensePointsDelta!=null)coverage.shooting++;if(c?.profile?.previousGames>=3&&c?.profile?.recentGames>=2)coverage.involvement++;}
const biggest=eligible.slice().sort((i,j)=>Math.abs(rows[j].actualPir-outputs.baseline[j].pred)-Math.abs(rows[i].actualPir-outputs.baseline[i].pred)).slice(0,20).map(i=>{const r=rows[i],x=outputs.baseline[i],c=x.context;return {name:r.name,opponent:r.opponent,round:r.round,gameCode:r.gameCode,forecast:x.pred,served:r.servedPir,actual:r.actualPir,expectedMinutes:x.minutes,actualMinutes:r.actualMinutes,actualStats:r.actualStats,positionPct:r.input.context.positionPct,teamPct:r.input.context.teamPct,involvementFactor:c?.involvementFactor,defenseFactor:c?.defenseFactor,defensePointsDelta:c?.defensePointsDelta,defenseSample:c?.defenseSample,minutesErrorContribution:(r.actualMinutes-x.minutes)*x.pred/x.minutes,efficiencyErrorContribution:r.actualPir-r.actualMinutes*x.pred/x.minutes,selectedForecast:outputs[selected][i].pred};});
const report={schema:'matchup-restraint-audit-v1',createdAt:new Date().toISOString(),method:'Current shared cores replayed with frozen pregame inputs and virtual time. Candidates fixed in code; select by MAE on rounds 5–6 only; one held-out evaluation on rounds 7–8. Active players with forecast >=5 minutes. Activation requires >=2% MAE improvement, no RMSE deterioration, no deterioration in either held-out round.',limitations:['Replayed current core, not all historical served versions.','40 games / four rounds: limited sample, no evidence of long-run generalization.','No independent possession/pace feature in frozen context; team points and positional PIR already reflect parts of environment.','Nonzero position signal is not proof of source completeness; zero may mean neutral or missing.','Large misses are diagnostic, not a selection subset.'],totalExact:rows.length,coverage,trials,selected,holdout:{baseline:before,candidate:after,perRound},activate,largestMissesSummary:{n:biggest.length,efficiencyDominated:biggest.filter(r=>Math.abs(r.efficiencyErrorContribution)>Math.abs(r.minutesErrorContribution)).length},largestMisses:biggest};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
