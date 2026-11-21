/* Current-season, cutoff-safe position defense. Shared by UI, updater and replay. */
(function(root){
'use strict';
const finite=Number.isFinite, positions={1:'G',2:'F',3:'C'};
const metrics=[
 {id:'pir',label:'PIR',tool:'pirWeakness',fields:['valuation'],read:s=>s.valuation},
 {id:'rebounds',label:'ריבאונדים',tool:'defense',fields:['totalRebounds'],read:s=>s.totalRebounds},
 {id:'two',label:'קליעה ל־2',tool:'shotMap',fields:['fieldGoalsMade2','fieldGoalsAttempted2'],read:s=>3*s.fieldGoalsMade2-s.fieldGoalsAttempted2,attempt:'fieldGoalsAttempted2',made:'fieldGoalsMade2'},
 {id:'three',label:'קליעה ל־3',tool:'shotMap',fields:['fieldGoalsMade3','fieldGoalsAttempted3'],read:s=>4*s.fieldGoalsMade3-s.fieldGoalsAttempted3,attempt:'fieldGoalsAttempted3',made:'fieldGoalsMade3'},
 {id:'blocked',label:'זריקות שנחסמו',tool:'playerMatchup',fields:['blocksAgainst'],read:s=>-s.blocksAgainst},
 {id:'turnovers',label:'איבודים',tool:'playerMatchup',fields:['turnovers'],read:s=>-s.turnovers},
 {id:'foulsAndFt',label:'סחיטת עבירות ועונשין',tool:'teamFreeThrows',fields:['foulsReceived','freeThrowsMade','freeThrowsAttempted'],read:s=>s.foulsReceived+2*s.freeThrowsMade-s.freeThrowsAttempted}
];
const stat=(g,k)=>finite(g.stats?.[k])?g.stats[k]:null;
function build(official,{key=s=>s,team=s=>s,asOf=Date.now()}={}){
 const rows=[];
 if(official?.season!=='E2026'||official.schema!=='official-offense-v1')return {rows,defense:{},season:'E2026',asOf};
 const finished=new Map((official.teamResults||[]).filter(g=>Date.parse(g.date)+4*3600000<=asOf).map(g=>[String(g.gameCode),[team(g.home),team(g.away)]]));
 for(const p of Object.values(official.players||{})){
  const seen=new Set();
  for(const g of p.games||[]){
   const sides=finished.get(String(g.gameCode)),pos=positions[g.position],club=team(g.team),opponent=team(g.opponent);
   if(!pos||!(g.minutes>0)||!(Date.parse(g.date)+4*3600000<=asOf)||!sides?.includes(club)||!sides.includes(opponent)||club===opponent||seen.has(g.gameCode))continue;
   seen.add(g.gameCode);rows.push({...g,pos,team:club,opponent,id:key(p.name)});
  }
 }
 const defense={};
 for(const opponent of new Set(rows.map(g=>g.opponent))){
  defense[opponent]={};
  for(const pos of ['G','F','C']){
   const peers=rows.filter(g=>g.pos===pos),against=peers.filter(g=>g.opponent===opponent),others=peers.filter(g=>g.opponent!==opponent);
   const minutes=against.reduce((s,g)=>s+g.minutes,0),games=new Set(against.map(g=>g.gameCode)).size;
   const personal=new Map();for(const g of others){if(!personal.has(g.id))personal.set(g.id,[]);personal.get(g.id).push(g);}
   const rate=(group,k)=>{const valid=group.filter(g=>stat(g,k)!==null),mp=valid.reduce((s,g)=>s+g.minutes,0);return mp?valid.reduce((s,g)=>s+g.stats[k],0)/mp:null;};
   const fields=[...new Set(metrics.flatMap(m=>m.fields))],observed={},expected={},coverage={};
   for(const k of fields){
    let actual=0,predicted=0,mp=0;
    const leagueRate=rate(others,k);
    for(const g of against){
     if(stat(g,k)===null||leagueRate===null)continue;
     const prior=(personal.get(g.id)||[]).filter(r=>stat(r,k)!==null),pm=prior.reduce((s,r)=>s+r.minutes,0);
     // An 80-minute league prior stabilizes the opponent-quality estimate.
     const quality=(prior.reduce((s,r)=>s+r.stats[k],0)+80*leagueRate)/(pm+80);
     actual+=g.stats[k];predicted+=g.minutes*quality;mp+=g.minutes;
    }
    observed[k]=mp?actual/mp:null;expected[k]=mp?predicted/mp:null;coverage[k]=mp;
   }
   const leaguePir=rate(others,'valuation'),raw=observed.valuation,quality=expected.valuation;
   const reliability=games/(games+8);
   const factor=games>=3&&quality>0?Math.max(.88,Math.min(1.12,1+(raw/quality-1)*reliability)):1;
   defense[opponent][pos]={factor,pct:(factor-1)*100,rawFactor:quality>0?raw/quality:null,
    allowedPirPer40:raw===null?null:40*raw,leaguePirPer40:leaguePir===null?null:40*leaguePir,
    sampleGames:games,appearances:against.length,minutes,observed,expected,coverage,reliability};
  }
 }
 return {schema:'position-defense-v2',season:'E2026',seasonsUsed:['E2026'],asOf,updated_at:new Date(asOf).toISOString(),
  gamesUsed:finished.size,playerRowsUsed:rows.length,source:'Official E2026 completed box scores; per-minute, opponent-quality adjusted; 4-hour completion buffer',defense,rows};
}
function features(profile,position,minutes){
 const rates=profile?.rates?{...profile.rates,totalRebounds:profile.rates.offensiveRebounds+profile.rates.defensiveRebounds}:null;
 if(!rates||!(minutes>0)||position?.sampleGames<3)return metrics.map(m=>({...m,value:null}));
 const {observed:o,expected:e,reliability}=position;
 const values=metrics.map(m=>{
  if(m.id==='pir')return {...m,value:0};
  const valid=m.fields.every(k=>finite(o[k])&&finite(e[k])&&finite(rates[k]));
  if(!valid)return {...m,value:null};
  const activity=m.attempt?m.attempt:m.id==='blocked'?'fieldGoalsAttempted2':m.id==='foulsAndFt'?'freeThrowsAttempted':m.fields[0];
  // Player DNA action rates provide style exposure, not height/weight guesses.
  const exposure=e[activity]>0&&finite(rates[activity])?rates[activity]/e[activity]:0;
  return {...m,value:(m.read(o)-m.read(e))*minutes*exposure*reliability};
 });
 // PIR is a residual of the disjoint events above: never add total PIR twice.
 const complete=values.slice(1).every(m=>m.value!==null)&&finite(o.valuation)&&finite(e.valuation);
 values[0].value=complete?(o.valuation-e.valuation-metrics.slice(1).reduce((s,m)=>s+m.read(o)-m.read(e),0))*minutes*reliability:null;
 return values;
}
const api={build,features,metrics};if(typeof module==='object'&&module.exports)module.exports=api;else root.PositionDefense=api;
})(typeof globalThis!=='undefined'?globalThis:this);
