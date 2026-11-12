/* Expanding-window evaluation and held-out tool ablations. */
const fs=require('node:fs');
const U=require('../unified-forecast-core.js');
const W=require('../weighted-forecast-core.js');
const source=JSON.parse(fs.readFileSync(0,'utf8'));
const toolIds=W.definitions.map(d=>d.id);
const omissions=[...toolIds,['playerDna','teamDna'],toolIds];
const difference=(a,b)=>a-b;
function trainAt(rows,cutoff,known){
 return rows.flatMap(r=>{
  const actual=known[r.gameCode]?.[r.key];
  return actual&&Date.parse(r.start)<cutoff&&Date.parse(r.cutoff)<cutoff
   ? [{...r,actualPir:actual[0],actualMinutes:actual[1]}]:[];
 });
}
function predict(test,train,previous){
 const calibrated=train.filter(r=>r.input.status==='active'&&r.actualMinutes>=5&&r.input.minutes>=5).length>=60
  &&new Set(train.map(r=>r.gameCode)).size>=6;
 if(!calibrated)return test.map(r=>({...r,candidate:U.project(r.input),alternatives:[],calibrated}));
 const [model,...models]=U.fitVariants(train,[null,...omissions]);
 // Earlier held-out errors are available only when their box score was published.
 const errors=previous.filter(r=>r.calibrated&&r.candidate).map(r=>Math.abs(r.candidate.expected-r.actualPir)).sort(difference);
 if(errors.length>=60)model.radius=errors[Math.min(errors.length-1,Math.ceil(.8*(errors.length+1))-1)];
 return test.map(r=>({...r,candidate:U.project(r.input,model),calibrated,
  alternatives:models.map((fit,i)=>U.project(r.input,fit,omissions[i]).expected)}));
}
function evaluate({rows,results},prospective){
 const byGame=Object.groupBy(rows,r=>r.gameCode);
 const games=Object.values(byGame).sort((a,b)=>Date.parse(a[0].cutoff)-Date.parse(b[0].cutoff));
 const scored=[],untrained=[];
 for(const test of games){
  const cutoff=Math.min(...test.map(r=>Date.parse(r.cutoff)));
  const known=results[test[0].gameCode]||{};
  const forecasts=prospective?test:predict(test,trainAt(rows,cutoff,known),trainAt(scored,cutoff,known));
  for(const r of forecasts)(r.calibrated?scored:untrained).push(r);
 }
 const compare=rows=>({served:U.metrics(rows,r=>r.served),candidate:U.metrics(rows,r=>r.candidate)});
 const versions=Object.fromEntries(Object.entries(Object.groupBy(scored,r=>r.servedVersion)).map(([id,rows])=>[id,compare(rows)]));
 const initialByVersion=Object.fromEntries(Object.entries(Object.groupBy(untrained,r=>r.servedVersion)).map(([id,rows])=>[id,{
  served:U.metrics(rows,r=>r.served),uncalibrated:U.metrics(rows,r=>r.candidate)
 }]));
 const impacts=omissions.map((omit,i)=>{
  const ids=[omit].flat(),available=rows.filter(r=>ids.some(id=>Number.isFinite(r.input.tools[id])));
  const sample=scored.filter(r=>ids.some(id=>Number.isFinite(r.input.tools[id])));
  const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const changes=scored.map(r=>Math.abs(r.alternatives[i]-r.actualPir)-Math.abs(r.candidate.expected-r.actualPir));
  return {id:ids.length===1?ids[0]:ids.length===2?'dnaTogether':'allTools',archivedAvailable:available.length,
   n:sample.length,games:new Set(sample.map(r=>r.gameCode)).size,heldOutN:scored.length,
   maeGain:average(changes),availableMaeGain:average(sample.map(r=>Math.abs(r.alternatives[i]-r.actualPir)-Math.abs(r.candidate.expected-r.actualPir)))};
 });
 const breakdowns=Object.fromEntries(['pos','team','name','home','status'].map(field=>[field,
  Object.fromEntries(Object.entries(Object.groupBy(scored,r=>String(r[field]??r.input[field]??'unknown'))).map(([key,rows])=>[key,compare(rows)]))
 ]));
 const review=Object.fromEntries(Object.entries(Object.groupBy(scored,r=>r.servedVersion)).map(([id,rows])=>{
  const {served,candidate}=versions[id];
  const ordered=[...new Set(rows.map(r=>r.gameCode))];
  const tail=new Set(ordered.slice(Math.floor(ordered.length/2)));
  const recent=compare(rows.filter(r=>tail.has(r.gameCode)));
  const eligible=served.n>=60&&served.games>=6&&candidate.mae<served.mae*.98
   &&candidate.hit3>=served.hit3&&candidate.hit5>=served.hit5&&candidate.minutesMae<=served.minutesMae
   &&recent.candidate.mae<recent.served.mae;
  return [id,{eligible,recent}];
 }));
 const intervalRows=scored.filter(r=>r.candidate.intervalSource==='held-out-errors');
 return {inputN:rows.length,inputGames:games.length,heldOutN:scored.length,versions,initialByVersion,impacts,breakdowns,review,
  interval:{n:intervalRows.length,covered:intervalRows.filter(r=>r.actualPir>=r.candidate.floor&&r.actualPir<=r.candidate.ceiling).length}};
}
if(process.argv.includes('--freeze')){
 const previous=trainAt(source.history,Date.parse(source.cutoff),source.known);
 const rows=predict(source.rows,previous,previous);
 process.stdout.write(JSON.stringify(rows.map(({candidate,alternatives,calibrated})=>({candidate,alternatives,calibrated}))));
}else{
 const result=Object.fromEntries(Object.entries(source).map(([mode,rows])=>[mode,evaluate(rows,mode==='prospective')]));
 const eligibleForReview=Object.values(result.prospective.review).some(r=>r.eligible);
 process.stdout.write(JSON.stringify({version:U.version,eligibleForReview,...result}));
}
