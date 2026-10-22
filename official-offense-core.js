(function(root){
'use strict';
const key=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
const valid=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
function aggregate(games){
 const rows=games.filter(g=>g.minutes>0),sum=f=>rows.reduce((s,g)=>s+f(g),0),complete=k=>rows.length&&rows.every(g=>valid(g.metrics?.[k]));
 const minutes=sum(g=>g.minutes),total=k=>complete(k)?sum(g=>g.metrics[k]):null;
 const fga=total('fga'),three=total('threeAttempts'),two=total('twoAttempts'),fta=total('freeThrowAttempts'),events=total('usageEvents'),exposure=total('usageExposure');
 const shots=rows.every(g=>valid(g.stats?.fieldGoalsMade2)&&valid(g.stats?.fieldGoalsMade3)),pts=rows.every(g=>valid(g.stats?.points));
 return {games:rows.length,minutes,avgMinutes:rows.length?minutes/rows.length:null,
  fgaPerGame:fga!==null&&rows.length?fga/rows.length:null,threePerGame:three!==null&&rows.length?three/rows.length:null,
  twoPerGame:two!==null&&rows.length?two/rows.length:null,ftaPerGame:fta!==null&&rows.length?fta/rows.length:null,
  fgaPerMinute:minutes&&fga!==null?fga/minutes:null,threePerMinute:minutes&&three!==null?three/minutes:null,twoPerMinute:minutes&&two!==null?two/minutes:null,ftaPerMinute:minutes&&fta!==null?fta/minutes:null,
  usagePct:events!==null&&exposure>0?100*events/exposure:null,
  threeAttemptSharePct:fga>0&&three!==null?100*three/fga:null,
  efgPct:fga>0&&shots?100*sum(g=>g.stats.fieldGoalsMade2+1.5*g.stats.fieldGoalsMade3)/fga:null,
  tsPct:fga!==null&&fta!==null&&fga+.44*fta>0&&pts?100*sum(g=>g.stats.points)/(2*(fga+.44*fta)):null};
}
function report(data,player,{gameCode=null,minutes=null,asOf=new Date().toISOString()}={}){
 if(data?.schema!=='official-offense-v1'||data.season!=='E2026')return null;
 const profile=data.players?.[key(player.name)];if(!profile)return null;
 const observed=gameCode==null?null:profile.games.find(g=>Number(g.gameCode)===Number(gameCode));
 if(gameCode!=null&&!observed)return null;
 const cutoff=observed?.date||asOf,club=observed?.team||player.team;
 const games=profile.games.filter(g=>g.team===club&&Date.parse(g.date)<=Date.parse(cutoff)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const played=games.filter(g=>g.minutes>0),last=played.slice(-3),baseline=aggregate(last),season=aggregate(played),prior=aggregate(played.slice(0,-3)),latest=observed||played.at(-1);
 const projected=minutes!==null&&valid(minutes)&&Number(minutes)>=0?Object.fromEntries(['fga','three','two','fta'].map(k=>[k,baseline[k+'PerMinute']!==null?baseline[k+'PerMinute']*Number(minutes):null])):null;
 const position=latest?.position;
 const peers=Object.entries(data.players).filter(([k])=>k!==key(player.name)).map(([,p])=>{
  const teamGames=p.games.filter(g=>Date.parse(g.date)<=Date.parse(cutoff)).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const recent=teamGames.at(-1);if(!recent||recent.team!==club||position==null||recent.position!==position)return null;
  const same=teamGames.filter(g=>g.team===club),map=new Map(same.map(g=>[g.gameCode,g]));
  const withPeer=aggregate(played.filter(g=>map.get(g.gameCode)?.minutes>0));
  // Missing box-score rows are unknown, not proof the teammate was absent.
  const withoutPeer=aggregate(played.filter(g=>map.has(g.gameCode)&&map.get(g.gameCode).minutes===0));
  return {name:p.name,position:recent.positionName,last:recent,average:aggregate(same.slice(-3)),withPeer,withoutPeer,
   comparisonReady:withPeer.games>=3&&withoutPeer.games>=3};
 }).filter(Boolean).sort((a,b)=>(b.average.avgMinutes||0)-(a.average.avgMinutes||0)).slice(0,5);
 const trend=baseline.games>=3&&prior.games>=3&&prior.fgaPerMinute>0&&baseline.fgaPerMinute!==null?100*(baseline.fgaPerMinute/prior.fgaPerMinute-1):null;
 return {observed,latest,baseline,season,prior,projected,peers,trend,cutoff,positionName:latest?.positionName,source:observed?.source||latest?.source,updatedAt:data.updated_at};
}
const api={key,aggregate,report};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.OfficialOffense=api;
})(typeof window!=='undefined'?window:globalThis);
