(function(root){
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const key=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
function events(game){
 const m=game.metrics||{},s=game.stats||{};
 const parts=[s.fieldGoalsAttempted2,s.fieldGoalsAttempted3,s.freeThrowsAttempted,s.turnovers].map(num);
 const base=num(m.usageEvents)??(parts.every(v=>v!==null&&v>=0)?parts[0]+parts[1]+.44*parts[2]+parts[3]:null);
 const assists=num(s.assistances)??num(m.assists),exposure=num(m.usageExposure),minutes=num(game.minutes);
 const valid=minutes>0&&exposure>0&&base!==null&&base>=0;
 return {base,assists,exposure,minutes,regular:valid?100*base/exposure:null,combined:valid&&assists!==null&&assists>=0?100*(base+assists)/exposure:null};
}
function selectGames(profile,range='1',asOf=Date.now()){
 const limit=Number(range),byCode=new Map();
 for(const g of profile?.games||[])if(Number(g.gameCode)>0&&Date.parse(g.date)<=Number(asOf))byCode.set(Number(g.gameCode),g);
 const games=[...byCode.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||Number(b.gameCode)-Number(a.gameCode));
 return limit>0?games.slice(0,limit):games;
}
function summarize(games){
 const played=games.filter(g=>num(g.minutes)>0),rows=played.map(events),unknownMinutes=games.filter(g=>num(g.minutes)===null||num(g.minutes)<0).length;
 const aggregate=metric=>{
  const valid=rows.filter(r=>r[metric]!==null);
  const numerator=valid.reduce((s,r)=>s+r.base+(metric==='combined'?r.assists:0),0),exposure=valid.reduce((s,r)=>s+r.exposure,0);
  return {value:exposure>0?100*numerator/exposure:null,covered:valid.length,missing:played.length-valid.length+unknownMinutes};
 };
 const sum=field=>{const values=played.map(g=>num(field(g)));return values.length&&values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null};
 return {registered:games.length,played:played.length,dnp:games.filter(g=>num(g.minutes)===0).length,unknownMinutes,regular:aggregate('regular'),combined:aggregate('combined'),
  minutes:sum(g=>g.minutes),fga:sum(g=>num(g.metrics?.fga)??(num(g.stats?.fieldGoalsAttempted2)!==null&&num(g.stats?.fieldGoalsAttempted3)!==null?Number(g.stats.fieldGoalsAttempted2)+Number(g.stats.fieldGoalsAttempted3):null)),
  fta:sum(g=>g.stats?.freeThrowsAttempted??g.metrics?.freeThrowAttempts),turnovers:sum(g=>g.stats?.turnovers??g.metrics?.turnovers),assists:sum(g=>g.stats?.assistances??g.metrics?.assists)};
}
// Both percentages use the same box-score estimate of team plays during a player's minutes.
// Combined involvement adds assists; an assist and a teammate's shot can describe the same play.
const api={num,key,events,selectGames,summarize};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.UsageCore=api;
})(typeof window!=='undefined'?window:globalThis);
