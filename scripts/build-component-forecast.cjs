'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const data=require('./component-forecast-data.cjs');
const {dna,catalog}=require('./component-feature-catalog.cjs');
const {finite,mean,targets,project,metrics}=require('../component-forecast-core.cjs');
const {fitModels,developmentRange,rangeFor,factors}=require('./component-forecast-fit.cjs');

const {season,root,schedule}=data;
const release='components-v1';
const firstTest=9,lastBenchmark=12;
const argument=process.argv.find(arg=>arg.startsWith('--as-of='));
const now=argument?Date.parse(argument.slice('--as-of='.length)):Date.now();
if(!finite(now))throw new Error('Invalid as-of date');
const generated=new Date(now).toISOString();
const out='data/component-forecast/';
const snapshotPath=game=>out+'snapshots/'+season+'-'+game+'.json';
const num=value=>finite(value)?Number(value.toFixed(4)):null;
const rounded=object=>Object.fromEntries(Object.entries(object).map(([key,value])=>[key,num(value)]));
const iso=value=>finite(value)?new Date(value).toISOString():null;
function save(file,value){
 const dest=path.join(root,out+file);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 const temp=dest+'.tmp';
 const json=JSON.stringify(value)+'\n';
 fs.writeFileSync(temp,file.endsWith('.gz')?gzipSync(json,{level:9}):json);
 fs.renameSync(temp,dest);
}

const {rows,audit}=data.historicalRows();
const threshold=Math.min(...audit.filter(g=>g.round>=firstTest&&g.round<=lastBenchmark).map(g=>g.cutoff));
const training=rows.filter(r=>r.round<firstTest&&r.available<=threshold&&r.target&&r.base);
const model=fitModels(training);
const range=developmentRange(training);
const warmup=new Map();
for(let round=3;round<firstTest;round++){
 const cutoff=Math.min(...audit.filter(g=>g.round===round).map(g=>g.cutoff));
 const earlier=rows.filter(r=>r.round<round&&r.available<=cutoff&&r.target&&r.base);
 const fitted=round>=6?fitModels(earlier,{split:round-1}):{C:{},D:{}};
 warmup.set(round,fitted);
}
const keys=['A','B','C','D'];
const versionFor=(fitted,calibration)=>release+'-'+createHash('sha256').update(JSON.stringify([fitted,calibration])).digest('hex').slice(0,12);
const version=versionFor(model,range);
const baseline=projectRow=>project(projectRow,{});
function risk(row,line){
 if(!line)return [];
 const notes=[];
 const {pirVar,minVar,scoringDependence,teammateDependence}=row.features;
 if(pirVar>=8)notes.push({label:'ה־PIR של השחקן תנודתי',value:pirVar,unit:'PIR'});
 if(minVar>=6)notes.push({label:'דקות המשחק משתנות משמעותית',value:minVar,unit:'דק׳'});
 if(scoringDependence>=66)notes.push({label:'רוב הנקודות מגיעות מסוג קליעה אחד',value:scoringDependence,unit:'%'});
 if(row.features['context.mainTeammateOut']===1&&finite(teammateDependence))
  notes.push({label:'חבר מרכזי חסר ויש היסטוריה למדידת התלות בו',value:teammateDependence,unit:'PIR ל־40 דק׳'});
 const b=baseline(row)?.components;
 if(!b)return notes;
 for(const [key,limit,lower,higher,unit] of [
  ['twoAccuracy',.02,'צפויה ירידה בדיוק לשתיים','צפויה עלייה בדיוק לשתיים','נק׳ אחוז'],
  ['threeAccuracy',.02,'צפויה ירידה בדיוק לשלוש','צפויה עלייה בדיוק לשלוש','נק׳ אחוז'],
  ['minutes',1,'צפויות פחות דקות מהבסיס האישי','צפויות יותר דקות מהבסיס האישי','דק׳'],
  ['turnovers',.2,'צפויים פחות איבודים','צפויים יותר איבודים','איב׳'],
  ['drawn',.2,'צפויות פחות עבירות שנסחטות','צפויות יותר עבירות שנסחטות','עב׳']
 ]){
  if(!finite(b[key]))continue;
  const change=line.components[key]-b[key];
  if(Math.abs(change)>=limit)notes.push({label:change<0?lower:higher,value:unit==='נק׳ אחוז'?100*change:change,unit});
 }
 return notes;
}
const savedByGame=new Map();
for(const g of schedule){
 const saved=data.load(snapshotPath(g.gameCode));
 if(saved?.season===season&&saved.gameCode===g.gameCode&&Date.parse(saved.kickoff)===Date.parse(g.start)&&Date.parse(saved.generatedAt)<Date.parse(g.start))
  savedByGame.set(g.gameCode,saved);
}
const frozenIndexes=new Map([...savedByGame].map(([code,saved])=>[code,new Map(saved.predictions.map(p=>[p.team+'|'+p.id,p]))]));
const output=rows.map(row=>{
 const {id,name,team,opponent,round,gameCode,actual,A,samples,baseline:old,status}=row;
 const phase=round<firstTest?'development':round<=lastBenchmark?'holdout':'prospective';
 const frozen=frozenIndexes.get(gameCode)?.get(team+'|'+id), frozenGame=savedByGame.get(gameCode);
 const eligible=status!=='out'&&status!=='injured';
 const b=eligible?baseline(row):null;
 const fitted=phase==='holdout'?model:phase==='development'?warmup.get(round):null;
 const c=eligible&&fitted?project(row,fitted.C):null;
 const d=eligible&&fitted?project(row,fitted.D):null;
 const interval=frozen?.interval??(d&&phase==='holdout'?rangeFor(row,d,range):null);
 const item={id,name,team,opponent,round,gameCode,cutoff:iso(frozenGame?Date.parse(frozenGame.generatedAt):row.cutoff),kickoff:iso(row.kickoff),phase,
  actual:num(actual),A:num(A),B:num(frozen?.B??(phase==='prospective'?null:b?.pir)),C:num(frozen?.C??c?.pir),D:num(frozen?.D??d?.pir),
  baseline:old??null,samples,interval,frozen:!!frozen};
 if(/shorts/i.test(name)&&finite(actual)){
  item.actualLine=row.target||null;
  item.baseLine=b?rounded(b.components):null;
  item.line=frozen?.components??(d?rounded(d.components):null);
  item.factors=frozen?.factors??(d?factors(row,d,fitted.D).slice(0,8):[]);
  item.risk=frozen?.risk??(d?risk(row,d):[]);
 }
 if(frozen&&row.target&&frozen.components)item.componentErrors=Object.fromEntries(targets.map(key=>[
  key,finite(frozen.components[key])&&finite(row.target[key])?num(frozen.components[key]-row.target[key]):null
 ]));
 return item;
});
const holdout=output.filter(r=>r.phase==='holdout');
const comparable=holdout.filter(r=>[r.actual,...keys.map(k=>r[k])].every(finite));
const latestComparable=comparable.filter(r=>r.baseline==='site-2');
const prospective=output.filter(r=>r.frozen);
const roundReview={};
for(const row of prospective){
 if(!finite(row.actual)||!finite(row.D))continue;
 const review=roundReview[row.round]??={components:{},features:{}};
 const append=(ledger,key,value)=>{
  const group=ledger[key]??={n:0,bias:0,mae:0};
  group.n++;group.bias+=value;group.mae+=Math.abs(value);
 };
 for(const [key,value] of Object.entries(row.componentErrors||{}))if(finite(value))append(review.components,key,value);
 const frozen=frozenIndexes.get(row.gameCode)?.get(row.team+'|'+row.id);
 for(const [id,impact] of Object.entries(frozen?.impacts||{})){
  const measure=review.features[id]??={n:0,total:0};
  measure.n++;
  measure.total+=Math.abs(row.D-impact-row.actual)-Math.abs(row.D-row.actual);
 }
}
for(const review of Object.values(roundReview)){
 for(const stats of Object.values(review.components)){stats.bias/=stats.n;stats.mae/=stats.n;}
 for(const stats of Object.values(review.features))stats.deltaMae=stats.total/stats.n;
}
const peerCases=rows.filter(r=>r.round>=firstTest&&r.round<=lastBenchmark&&r.id!=='012608'&&finite(r.target?.twoAccuracy)&&
 finite(r.features['context.opponent2'])&&r.status!=='out'&&r.status!=='injured').map(row=>{
 const full=project(row,model.D),omit=project(row,model.D,'context.opponent2');
 return full&&omit&&full.components.twoAccuracy<omit.components.twoAccuracy?{row,full,omit}:null;
}).filter(Boolean);
const twoPointReview={n:peerCases.length,games:new Set(peerCases.map(p=>p.row.gameCode)).size,
 accuracyMAE:mean(peerCases.map(({row,full})=>Math.abs(row.target.twoAccuracy-full.components.twoAccuracy))),
 omitAccuracyMAE:mean(peerCases.map(({row,omit})=>Math.abs(row.target.twoAccuracy-omit.components.twoAccuracy))),
 pirMAE:mean(peerCases.map(({row,full})=>Math.abs(row.actual-full.pir))),
 omitPirMAE:mean(peerCases.map(({row,omit})=>Math.abs(row.actual-omit.pir)))};

const scores=(rows,variants=keys)=>Object.fromEntries(variants.map(key=>[key,metrics(rows,key)]));
const withBand=holdout.filter(r=>finite(r.actual)&&r.interval);
const intervals={n:withBand.length,coverage:mean(withBand.map(r=>Number(r.actual>=r.interval.low&&r.actual<=r.interval.high))),
 below:withBand.filter(r=>r.actual<r.interval.low).length,above:withBand.filter(r=>r.actual>r.interval.high).length};
const featureAudit=catalog.map(spec=>{
 const selected=model.audit[spec.id];
 return {id:spec.id,label:spec.label,source:spec.source,definition:spec.help||null,group:spec.group||'context',
  version:spec.level,...selected,holdoutCoverage:rows.filter(r=>r.round>=firstTest&&r.round<=lastBenchmark&&finite(r.actual)&&finite(r.features[spec.id])).length};
});
const coverage={fixtures:audit.length,boxFixtures:audit.filter(g=>g.publishedBox).length,
 observed:output.filter(r=>finite(r.actual)).length,candidates:output.filter(r=>finite(r.B)).length,
 paired:comparable.length,modelRecords:holdout.filter(r=>finite(r.D)&&finite(r.actual)).length};
const performance={version,season,generatedAt:generated,developmentFrom:1,developmentThrough:firstTest-1,firstTest,lastBenchmark,
 coverage,fixtures:audit,all:scores(holdout),paired:scores(comparable),currentAlgorithm:scores(latestComparable),
 prospective:scores(prospective),roundReview,intervals,twoPointReview,metricsAudited:dna.length,features:featureAudit,rows:output};

const lastComplete=audit.filter(g=>g.observed>0).reduce((last,g)=>Math.max(last,g.round),0);
const completeThrough=Math.max(0,...Array.from({length:lastComplete},(_,index)=>index+1).filter(round=>{
 const games=schedule.filter(g=>g.round===round);
 return games.length>0&&games.every(g=>audit.some(a=>a.gameCode===g.gameCode&&a.publishedBox<=now&&a.observed>0));
}));
const liveRows=rows.filter(r=>r.round<=completeThrough&&r.available<=now&&r.target&&r.base);
const liveSplit=Math.max(7,completeThrough-1);
const liveModel=completeThrough>=10?fitModels(liveRows,{split:liveSplit}):model;
const liveRange=completeThrough>=10?developmentRange(liveRows.filter(r=>r.round>=liveSplit)):range;
const liveVersion=versionFor(liveModel,liveRange);
const livePredictions=data.upcoming(now).map(row=>{
 const eligible=row.status!=='out'&&row.status!=='injured';
 const b=eligible?baseline(row):null,c=eligible?project(row,liveModel.C):null,d=eligible?project(row,liveModel.D):null;
 const {id,fantasyId,name,team,opponent,gameCode,round,kickoff,price,samples,status}=row;
 const effects=d?factors(row,d,liveModel.D):[];
 return {id,fantasyId,name,team,opponent,gameCode,round,kickoff:iso(kickoff),price,samples,status,
  B:num(b?.pir),C:num(c?.pir),D:num(d?.pir),components:d?rounded(d.components):null,
  points:num(d?.points),rebounds:num(d?.rebounds),defense:num(d?.defense),negatives:num(d?.negatives),
  interval:d?rangeFor(row,d,liveRange):null,factors:effects.slice(0,5),impacts:Object.fromEntries(effects.map(f=>[f.id,num(f.impact)])),risk:d?risk(row,d):[]};
});
const versions=data.load(out+'versions.json')||{};
versions[version]??={createdAt:generated,trainingThrough:firstTest-1,fit:model,range};
versions[liveVersion]??={createdAt:generated,trainingThrough:completeThrough>=10?completeThrough:firstTest-1,fit:liveModel,range:liveRange};
save('versions.json',versions);
save('performance.json.gz',performance);
save('live.json.gz',{season,version:liveVersion,generatedAt:generated,predictions:livePredictions.map(({impacts,...row})=>row)});
for(const gameCode of new Set(livePredictions.map(p=>p.gameCode))){
 if(savedByGame.has(gameCode))continue;
 const predictions=livePredictions.filter(p=>p.gameCode===gameCode);
 const {kickoff}=predictions[0];
 const minutes=(Date.parse(kickoff)-now)/60000;
 if(minutes<=10||minutes>24*60||!predictions.some(p=>finite(p.D)))continue;
 save('snapshots/'+season+'-'+gameCode+'.json',{season,version:liveVersion,generatedAt:generated,kickoff,gameCode,predictions});
}
console.log(JSON.stringify({version,liveVersion,coverage,paired:performance.paired,currentAlgorithm:performance.currentAlgorithm,intervals,
 live:livePredictions.length,liveCovered:livePredictions.filter(p=>finite(p.D)).length,twoPointReview,
 selectedDna:featureAudit.filter(x=>x.group!=='context'&&x.selected.length).length,
 selectedContext:featureAudit.filter(x=>x.group==='context'&&x.selected.length).length,
 shorts:output.filter(r=>r.actual!==null&&/shorts/i.test(r.name)).map(({round,opponent,actual,A,B,C,D})=>({round,opponent,actual,A,B,C,D}))},null,2));
