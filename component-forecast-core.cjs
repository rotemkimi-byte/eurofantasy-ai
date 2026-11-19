'use strict';

const shots = [
 {attempt:'twoAttempts', accuracy:'twoAccuracy', made:'fieldGoalsMade2', field:'fieldGoalsAttempted2', value:2},
 {attempt:'threeAttempts', accuracy:'threeAccuracy', made:'fieldGoalsMade3', field:'fieldGoalsAttempted3', value:3},
 {attempt:'freeAttempts', accuracy:'freeAccuracy', made:'freeThrowsMade', field:'freeThrowsAttempted', value:1}
];
const counts = [
 ['offRebounds','offensiveRebounds'], ['defRebounds','defensiveRebounds'], ['assists','assistances'],
 ['steals','steals'], ['blocks','blocksFavour'], ['turnovers','turnovers'],
 ['fouls','foulsCommited'], ['drawn','foulsReceived'], ['blocked','blocksAgainst']
];
const targets = ['minutes', ...shots.flatMap(s=>[s.attempt,s.accuracy]), ...counts.map(([key])=>key)];
const finite = Number.isFinite;
const sum = values=>values.reduce((total,value)=>total+value,0);
const mean = values=>values.length?sum(values)/values.length:null;
const clamp = (value,min,max)=>Math.max(min,Math.min(max,value));
const clampTarget = (key,value)=>clamp(value,0,key==='minutes'?40:key.endsWith('Accuracy')?1:key==='fouls'?5:40);

function observed(game){
 const stats=game.stats;
 if(!finite(game.minutes)||!stats)return null;
 const values={minutes:game.minutes};
 for(const {attempt,accuracy,made,field} of shots){
  values[attempt]=finite(stats[field])?stats[field]:null;
  values[accuracy]=stats[field]>0&&finite(stats[made])?stats[made]/stats[field]:null;
 }
 for(const [key,field] of counts)values[key]=finite(stats[field])?stats[field]:null;
 return values;
}

function baseForecast(history){
 if(!history.length)return null;
 const weights=history.map((_,i)=>i<3?2:1);
 const minutes=mean(history.map(g=>g.minutes));
 const expectedMinutes=sum(history.map((g,i)=>g.minutes*weights[i]))/sum(weights);
 const component={minutes:clampTarget('minutes',(expectedMinutes*history.length+minutes*2)/(history.length+2))};
 function rate(field,exposure,priorMinutes){
  const valid=history.map((g,i)=>({g,w:weights[i]})).filter(({g})=>finite(g.stats?.[field])&&finite(exposure(g))&&exposure(g)>0);
  const total=sum(valid.map(({g})=>exposure(g)));
  if(!total)return null;
  const prior=sum(valid.map(({g})=>g.stats[field]))/total;
  return (sum(valid.map(({g,w})=>g.stats[field]*w))+prior*priorMinutes)/(sum(valid.map(({g,w})=>exposure(g)*w))+priorMinutes);
 }
 for(const {attempt,accuracy,made,field} of shots){
  const attempts=rate(field,g=>g.minutes,50);
  component[attempt]=attempts===null?null:attempts*component.minutes;
  component[accuracy]=rate(made,g=>g.stats?.[field],15);
 }
 for(const [key,field] of counts){
  const value=rate(field,g=>g.minutes,50);
  component[key]=value===null?null:clampTarget(key,value*component.minutes);
 }
 return component;
}

function ledger(component){
 if(!component)return null;
 let points=0,misses=0,fieldMisses=0;
 for(const {attempt,accuracy,value} of shots){
  const n=component[attempt],p=component[accuracy];
  if(!finite(n)||n<0||(n>0&&(!finite(p)||p<0||p>1)))return null;
  const made=n?n*p:0;
  points+=value*made;
  misses+=n-made;
  if(value>1)fieldMisses+=n-made;
 }
 if(counts.some(([key])=>!finite(component[key])||component[key]<0))return null;
 const rebounds=component.offRebounds+component.defRebounds;
 const defense=component.steals+component.blocks;
 const negatives=misses+component.turnovers+component.fouls+Math.min(component.blocked,fieldMisses);
 return {points,misses,fieldMisses,rebounds,defense,negatives,pir:points+rebounds+component.assists+defense+component.drawn-negatives};
}

function project(row, fitted, omit=null){
 if(!row.base)return null;
 const components={...row.base};
 for(const key of targets){
  if(!finite(components[key]))continue;
  for(const item of fitted[key]||[]){
   const x=row.features[item.id];
   if(item.id!==omit&&finite(x))components[key]+=item.beta*clamp((x-item.center)/item.scale,-3,3);
  }
  if(key!=='minutes'&&!key.endsWith('Accuracy')&&row.base.minutes>0)components[key]*=components.minutes/row.base.minutes;
  components[key]=clampTarget(key,components[key]);
 }
 // A blocked shot is also a missed field goal, and cannot exceed that count.
 const line=ledger(components);
 if(!line)return null;
 components.blocked=Math.min(components.blocked,line.fieldMisses);
 return {components,...line};
}

function metrics(rows,model){
 const valid=rows.filter(r=>finite(r.actual)&&finite(r[model]));
 const error=valid.map(r=>r[model]-r.actual);
 return {n:valid.length,games:new Set(valid.map(r=>r.gameCode)).size,players:new Set(valid.map(r=>r.id)).size,
  mae:mean(error.map(Math.abs)),rmse:error.length?Math.sqrt(mean(error.map(e=>e*e))):null,bias:mean(error),
  within3:mean(error.map(e=>Number(Math.abs(e)<=3))),within5:mean(error.map(e=>Number(Math.abs(e)<=5))),
  misses10:error.filter(e=>Math.abs(e)>=10).length};
}

module.exports={shots,counts,targets,finite,sum,mean,clamp,clampTarget,observed,baseForecast,ledger,project,metrics};
