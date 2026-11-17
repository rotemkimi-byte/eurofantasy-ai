/* Protocol fixed before holdout: fit rounds 7-9, evaluate once on 10-11. */
'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const W=require('../weighted-forecast-core.js'),P=require('../personal-model-core.js'),M=require('../matchup-context-core.js');
const load=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:32*1024*1024});
const source='data/official-offense.json';
const revisions=new Map(),cache=new Map();
function archived(file,cutoff){
 if(!revisions.has(file))revisions.set(file,git('log','--first-parent','--format=%H %cI','--',file).trim().split('\n').filter(Boolean).map(l=>{const [sha,t]=l.split(' ');return {sha,time:Date.parse(t)};}));
 const rev=revisions.get(file).find(r=>r.time<=cutoff);if(!rev)return null;
 const id=rev.sha+':'+file;
 if(!cache.has(id))cache.set(id,loadGit(id));
 const data=cache.get(id);
 if(data.updated_at&&!(Date.parse(data.updated_at)<=cutoff))return null;
 return {data,sha:rev.sha};
}
function loadGit(id){return JSON.parse(git('show',id));}
const legacyCode=git('show','98d91285221b110d75ef50d2da5eb75b60ec832a:weighted-forecast-core.js'),vm=require('node:vm'),sandbox={module:{exports:{}},require:require('node:module').createRequire(require('node:path').resolve('weighted-forecast-core.js'))};
vm.runInNewContext(legacyCode,sandbox);const old=sandbox.module.exports;
const schedule=Object.values(load('data/learning/schedule.json')).filter(g=>g.played&&g.round>=7&&g.round<=11).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
const results=[],sources=[],skipped=[];
for(const g of schedule){
 const file=`data/learning/input-snapshots/E2026-${g.gameCode}.json`;
 if(!fs.existsSync(file)){skipped.push({game:g.gameCode,reason:'No frozen pregame input'});continue;}
 const saved=load(file),cutoff=Date.parse(saved.created_at);
 if(saved.season!=='E2026'||saved.gameCode!==g.gameCode||!(cutoff<Date.parse(g.start))){skipped.push({game:g.gameCode,reason:'Invalid pregame cutoff'});continue;}
 const official=archived(source,cutoff),advanced=archived('data/advanced-players.json',cutoff),roster=archived('data/players.json',cutoff)?.data;
 if(!official||!Array.isArray(roster)){skipped.push({game:g.gameCode,reason:'No pregame published source'});continue;}
 const data=W.build(official.data,advanced?.data,{...P,asOf:cutoff});
 const legacyData=old.build(official.data,advanced?.data,{...P,asOf:cutoff});
 const box=load(`data/backtest/cache/E2026-${g.gameCode}-stats.json`);
 sources.push({game:g.gameCode,round:g.round,cutoff:saved.created_at,official:official.sha,advanced:advanced?.sha||null,latestObservation:Math.max(...[...data.profiles.values()].flatMap(r=>r||[]).map(r=>Date.parse(r.date)))});
 for(const row of saved.predictions){
  const a=row.input,p=a?.player;
  if(!p||p.status!=='active'||!['G','F','C'].includes(p.pos)||P.team(row.opponent)!==P.team(a.match?.opponent))continue;
  const side=P.team(p.team)===g.home?'local':P.team(p.team)===g.away?'road':null;
  if(!side)continue;
  const actual=box[side]?.players.find(r=>P.key(r.player?.person?.name)===P.key(p.name))?.stats;
  if(!Number.isFinite(actual?.valuation))continue;
  const x=P.project(p,a.recent,a.history,a.context,a.config);x.match=a.match;
  const y=M.project(x,p,a.contextData,cutoff);
  Object.assign(y,{injuryUsagePct:a.context.injuryUsagePct,positionMatchPct:a.context.positionPct,
   positionMatchup:a.context.positionMatchup});
  // Some captures retain the position row in the served observation instead.
  const originalFile=`data/learning/snapshots/E2026-${g.gameCode}.json`;
  if(fs.existsSync(originalFile)){
   const observed=load(originalFile).predictions.find(r=>P.key(r.name)===P.key(p.name));
   y.positionMatchup=observed?.algorithmInputs?.positionMatchup??y.positionMatchup;
  }
  const frozen=W.input(p,y,W.signals(p,y,data,roster),data);
  const before=old.input(p,y,old.signals(p,y,legacyData,roster),legacyData);
  if(!frozen||!(frozen.minutes>=5))continue;
  const features=W.positionFeatures(p,{...y,minutes:frozen.minutes},data);
  const base=W.project(frozen,W.defaults,W.matchupSignals),candidate=W.positionProject(frozen,features,W.defaults,1);
  const pos=data.positionDefense?.defense?.[P.team(row.opponent)]?.[p.pos];
  results.push({name:p.name,gameCode:g.gameCode,round:g.round,pos:p.pos,opponent:row.opponent,
   actual:actual.valuation,legacy:old.project(before),baseline:W.project(frozen),base,raw:candidate.expected-base,
   defense:pos?.rawFactor<1?'strong':'weak',sample:pos?.sampleGames||0,features:features.map(f=>({id:f.id,value:f.value}))});
 }
 console.log(`Replayed round ${g.round}, game ${g.gameCode}; ${results.length} player observations`);
}
const train=results.filter(r=>r.round<=9),test=results.filter(r=>r.round>=10);
// One nonnegative ridge coefficient, fit on training outcomes only. No holdout search.
const coefficient=Math.max(0,Math.min(1,train.reduce((s,r)=>s+r.raw*(r.actual-r.base),0)/(35+train.reduce((s,r)=>s+r.raw*r.raw,0))));
for(const r of results)r.candidate=Math.max(0,r.base+coefficient*r.raw);
function metrics(rows,id){const n=rows.length;if(!n)return {n:0,games:0,mae:null,rmse:null};const errors=rows.map(r=>r[id]-r.actual);return {n,games:new Set(rows.map(r=>r.gameCode)).size,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/n,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/n),largeMisses:errors.filter(e=>Math.abs(e)>=10).length};}
const pair=rows=>({legacy:metrics(rows,'legacy'),baseline:metrics(rows,'baseline'),candidate:metrics(rows,'candidate')});
const holdout={...pair(test),perRound:[10,11].map(round=>({round,...pair(test.filter(r=>r.round===round))}))};
const sufficient=train.length>=60&&new Set(train.map(r=>r.gameCode)).size>=6&&test.length>=60&&new Set(test.map(r=>r.gameCode)).size>=6;
const activate=sufficient&&coefficient>0&&holdout.candidate.mae<Math.min(holdout.baseline.mae,holdout.legacy.mae)*.98&&holdout.candidate.rmse<=Math.min(holdout.baseline.rmse,holdout.legacy.rmse)&&holdout.perRound.every(r=>r.candidate.mae<=Math.min(r.baseline.mae,r.legacy.mae));
const thresholdAudit=['hard','neutral','positive'].map(label=>{const rows=test.filter(r=>{const d=r.baseline-r.base;return (d>.5?'positive':d<-.5?'hard':'neutral')===label;});return {label,...pair(rows),meanActualMinusNeutral:rows.length?rows.reduce((s,r)=>s+r.actual-r.base,0)/rows.length:null};});
const report={schema:'position-defense-validation-v2',protocol:'train-7-9-holdout-10-11-v2',season:'E2026',created_at:new Date().toISOString(),cutoffSafe:true,coefficient,activate,
 method:'Current weighted core replayed from frozen pregame inputs with Git-published official/advanced/roster revisions strictly before each cutoff. Fit one ridge coefficient on rounds 7-9; untouched holdout rounds 10-11. Activation requires >=2% MAE improvement over legacy and source-corrected baseline, no RMSE deterioration, neither holdout round worse. E2026 outcomes only.',
 limitations:['Replay of current core with archived inputs, not a claim to reproduce every historical served version.','No calibrated on-ball defender, height or weight effect.','Invalid E2025 positional signal removed from the source-corrected baseline; rebuilt positional effects stay gated.',
 'Default tool weights evaluated; custom weights retain their values but have no separate held-out accuracy guarantee.','Position prior and reliability constants fixed before holdout; thresholds ±0.5 are preliminary, diagnosed on baseline effects and not selected on holdout.','Final-round sample is small; future model selection must use a new untouched holdout.'],
 train:pair(train),holdout,byPosition:Object.fromEntries(['G','F','C'].map(pos=>[pos,pair(test.filter(r=>r.pos===pos))])),byDefense:Object.fromEntries(['strong','weak'].map(d=>[d,pair(test.filter(r=>r.defense===d))])),thresholdAudit,
 largestMisses:test.slice().sort((a,b)=>Math.abs(b.actual-b.baseline)-Math.abs(a.actual-a.baseline)).slice(0,20),sources,skipped};
fs.writeFileSync('data/learning/position-defense-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({coefficient,activate,train:report.train,holdout,byPosition:report.byPosition,byDefense:report.byDefense,skipped:skipped.length},null,2));
