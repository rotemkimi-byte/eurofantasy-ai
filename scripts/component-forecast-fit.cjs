'use strict';
const {catalog}=require('./component-feature-catalog.cjs');
const {targets,shots,finite,sum,mean,clamp,clampTarget,project}=require('../component-forecast-core.cjs');

const labels=new Map(catalog.map(spec=>[spec.id,spec]));
const isRate=key=>key!=='minutes'&&!key.endsWith('Accuracy');
const shotByAccuracy=new Map(shots.map(s=>[s.accuracy,s.attempt]));
const minTrain=40,minValidation=22, ridge=35;

function sample(row,key){
 const actual=row.target?.[key],base=row.base?.[key];
 if(!finite(actual)||!finite(base))return null;
 if(isRate(key)){
  if(row.target.minutes<4||row.base.minutes<=0)return null;
  return {actual:actual*row.base.minutes/row.target.minutes,base,weight:clamp(row.target.minutes/20,.2,1.5)};
 }
 const weight=shotByAccuracy.has(key)?clamp(row.target[shotByAccuracy.get(key)]/4,.25,3):1;
 return {actual,base,weight};
}
const standardized=(x,{center,scale})=>clamp((x-center)/scale,-3,3);
function score(rows,key,fit){
 let loss=0,weight=0;
 for(const {data,row} of rows){
  const value=fit.reduce((v,item)=>finite(row.features[item.id])?v+item.beta*standardized(row.features[item.id],item):v,data.base);
  loss+=data.weight*(clampTarget(key,value)-data.actual)**2;
  weight+=data.weight;
 }
 return weight?loss/weight:null;
}
function fitOne(rows,id,previous){
 const observed=rows.filter(({row})=>finite(row.features[id]));
 if(observed.length<minTrain||new Set(observed.map(({row})=>row.gameCode)).size<4)return null;
 const center=mean(observed.map(({row})=>row.features[id]));
 const scale=Math.sqrt(mean(observed.map(({row})=>(row.features[id]-center)**2)));
 if(scale<1e-7)return null;
 const normalization={center,scale};
 let numerator=0,denominator=ridge;
 for(const {data,row} of observed){
  const x=standardized(row.features[id],normalization);
  const existing=previous.reduce((v,item)=>finite(row.features[item.id])?v+item.beta*standardized(row.features[item.id],item):v,data.base);
  numerator+=data.weight*x*(data.actual-existing);
  denominator+=data.weight*x*x;
 }
 return {id,...normalization,beta:numerator/denominator};
}
function overlapping(rows,id,other){
 const pairs=rows.map(({row})=>[row.features[id],row.features[other]]).filter(([a,b])=>finite(a)&&finite(b));
 if(pairs.length<minTrain)return false;
 const a=mean(pairs.map(pair=>pair[0])),b=mean(pairs.map(pair=>pair[1]));
 const cross=sum(pairs.map(([x,y])=>(x-a)*(y-b)));
 const scale=Math.sqrt(sum(pairs.map(([x])=>(x-a)**2))*sum(pairs.map(([,y])=>(y-b)**2)));
 return scale>0&&Math.abs(cross/scale)>.72;
}

function fitModels(rows,{split=7}={}){
 const C={},D={},audit={};
 for(const spec of catalog)audit[spec.id]={routes:spec.targets,training:0,validation:0,eligible:[],selected:[],excluded:spec.excluded||null};
 for(const key of targets){
  const full=rows.map(row=>({row,data:sample(row,key)})).filter(p=>p.data);
  const validation=full.filter(p=>p.row.round>=split);
  const cut=validation.length?Math.min(...validation.map(p=>p.row.cutoff)):Infinity;
  const train=full.filter(p=>p.row.round<split&&p.row.available<=cut);
  const usable=full.filter(p=>p.row.round>=split||p.row.available<=cut);
  const options=catalog.filter(spec=>!spec.excluded&&spec.targets.includes(key)).filter(spec=>{
   const t=train.filter(({row})=>finite(row.features[spec.id])),v=validation.filter(({row})=>finite(row.features[spec.id]));
   const entry=audit[spec.id];
   entry.training=Math.max(entry.training,t.length);
   entry.validation=Math.max(entry.validation,v.length);
   const enough=t.length>=minTrain&&v.length>=minValidation&&new Set(v.map(p=>p.row.gameCode)).size>=3;
   if(enough)entry.eligible.push(key);
   return enough;
  });
  const chosen=[];
  function append(level,max){
   for(let index=0;index<max;index++){
    const loss=score(validation,key,chosen);
    let winner=null;
    for(const spec of options){
     if(spec.level!==level||chosen.some(item=>item.id===spec.id||overlapping(train,spec.id,item.id)))continue;
     const item=fitOne(train,spec.id,chosen);
     if(!item)continue;
     const improvement=(loss-score(validation,key,[...chosen,item]))/Math.max(loss,1e-8);
     if(improvement>=.005&&(!winner||improvement>winner.improvement))winner={...item,improvement};
    }
    if(!winner)break;
    chosen.push(winner);
    audit[winner.id].selected.push({target:key,developmentImprovement:winner.improvement});
   }
  }
  const refit=chosen=>chosen.reduce((list,item)=>{
   const fitted=fitOne(usable,item.id,list);
   if(fitted)list.push(fitted);
   return list;
  },[]);
  append('C',2);
  C[key]=refit(chosen);
  append('D',2);
  D[key]=refit(chosen);
 }
 return {C,D,audit};
}

function developmentRange(rows,{minimum=60}={}){
 // Residuals from the fixed component baseline in the chronological dev fold.
 // Final-test outcomes never fit or calibrate this interval.
 const calibration=rows.filter(r=>r.round>=7&&finite(r.actual)&&r.base).map(row=>{
  const line=project(row,{});
  return line?{error:row.actual-line.pir,variability:row.features.pirVar,
   minVar:row.features.minVar,dependence:row.features.scoringDependence??row.features.scoringShare}:null;
 }).filter(Boolean);
 function band(selected){
  if(selected.length<minimum)return null;
  const sorted=selected.map(r=>r.error).sort((a,b)=>a-b);
  return {low:sorted[Math.floor((sorted.length-1)*.1)],high:sorted[Math.ceil((sorted.length-1)*.9)],n:sorted.length};
 }
 return {general:band(calibration),volatile:band(calibration.filter(r=>r.variability>=8||r.minVar>=6||r.dependence>=66)),
  stable:band(calibration.filter(r=>finite(r.variability)&&finite(r.minVar)&&finite(r.dependence)&&r.variability<8&&r.minVar<6&&r.dependence<66))};
}
function rangeFor(row,line,calibration){
 const {pirVar,minVar,scoringDependence,scoringShare}=row.features;
 const dependence=scoringDependence??scoringShare;
 const volatile=pirVar>=8||minVar>=6||dependence>=66;
 const eligible=[pirVar,minVar,dependence].every(finite);
 const band=(volatile?calibration.volatile:eligible?calibration.stable:null)||calibration.general;
 return band?{low:line.pir+band.low,high:line.pir+band.high,n:band.n}:null;
}
function factors(row,line,fitted){
 const ids=new Set(Object.values(fitted).flat().map(item=>item.id));
 const measured=[];
 for(const id of ids){
  if(!finite(row.features[id]))continue;
  const without=project(row,fitted,id);
  if(!without||Math.abs(line.pir-without.pir)<.035)continue;
  const spec=labels.get(id);
  measured.push({id,label:spec.label,source:spec.source,value:row.features[id],...row.details[id],impact:line.pir-without.pir,
   components:targets.flatMap(key=>Math.abs(line.components[key]-without.components[key])>.001?[[key,line.components[key]-without.components[key]]]:[])});
 }
 return measured.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));
}
module.exports={fitModels,developmentRange,rangeFor,factors};
