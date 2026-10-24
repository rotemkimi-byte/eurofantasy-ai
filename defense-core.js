(function(root){
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const fields=['points','fieldGoalsMade2','fieldGoalsMade3','fieldGoalsAttempted2','fieldGoalsAttempted3','freeThrowsMade','freeThrowsAttempted','assistances','turnovers','offensiveRebounds','totalRebounds','foulsCommited'];
const sumFields=rows=>Object.fromEntries(fields.map(k=>[k,rows.length&&rows.every(s=>num(s[k])!==null)?rows.reduce((a,s)=>a+Number(s[k]),0):null]));
const fgm=s=>num(s.fieldGoalsMade2)!==null&&num(s.fieldGoalsMade3)!==null?Number(s.fieldGoalsMade2)+Number(s.fieldGoalsMade3):null;
const fga=s=>num(s.fieldGoalsAttempted2)!==null&&num(s.fieldGoalsAttempted3)!==null?Number(s.fieldGoalsAttempted2)+Number(s.fieldGoalsAttempted3):null;
function possessions(s){const a=fga(s),f=num(s.freeThrowsAttempted),o=num(s.offensiveRebounds),t=num(s.turnovers);return [a,f,o,t].every(v=>v!==null)?a+.44*f-o+t:null;}
function environment(data,asOf=Date.now()){
 const sides=[],teams=new Map(),gameCodes=new Set();let games=0;
 for(const [code,g] of Object.entries(data.teamGames||{})){
  if(!(Date.parse(g.date)<=asOf)||!g.local||!g.road)continue;
  const a=possessions(g.local.stats),b=possessions(g.road.stats);
  const mins=[num(g.local.gameMinutes),num(g.road.gameMinutes)];
  const pace=a>0&&b>0&&mins[0]>0&&mins[0]===mins[1]?(a+b)/2: null;
  // Incomplete games cannot poison the entire season baseline or supply invented zeros.
  if(pace===null||![g.local,g.road].every(side=>fields.every(k=>num(side.stats[k])!==null)))continue;
  gameCodes.add(Number(code));
  for(const side of [g.local,g.road]){
   sides.push(side.stats);if(!teams.has(side.team))teams.set(side.team,{rows:[],possessions:0,minutes:0,complete:true});
   const t=teams.get(side.team);t.rows.push(side.stats);if(pace===null)t.complete=false;else {t.possessions+=pace;t.minutes+=side.gameMinutes;}
  }games++;
 }
 const league=sumFields(sides);let poss=0,minutes=0,complete=true;
 for(const t of teams.values()){t.stats=sumFields(t.rows);t.pace=t.complete&&t.minutes>0?t.possessions/t.minutes*40:null;poss+=t.possessions;minutes+=t.minutes;if(!t.complete)complete=false;}
 const lgPace=complete&&minutes>0?poss/minutes*40:null,fg=fgm(league),ft=num(league.freeThrowsMade);
 const factor=fg>0&&ft>0?2/3-(.5*league.assistances/fg)/(2*(fg/ft)):null;
 const denominator=fga(league)-league.offensiveRebounds+league.turnovers+.44*league.freeThrowsAttempted;
 const constants=fields.every(k=>num(league[k])!==null)&&denominator>0&&league.totalRebounds>0&&factor!==null?{factor,vop:league.points/denominator,drb:(league.totalRebounds-league.offensiveRebounds)/league.totalRebounds,ftPerFoul:league.foulsCommited>0?league.freeThrowsMade/league.foulsCommited:null,ftaPerFoul:league.foulsCommited>0?league.freeThrowsAttempted/league.foulsCommited:null}:null;
 const env={teams,league,lgPace,constants,games,gameCodes,scale:null};let total=0,mp=0;
 // The normalization uses every valid player appearance in the same season sample.
 for(const p of Object.values(data.players||{}))for(const g of p.games||[]){if(Date.parse(g.date)>asOf)continue;const value=adjustedPER(g,env);if(value!==null){total+=value*g.minutes;mp+=g.minutes;}}
 if(mp>0&&total>0)env.scale=15/(total/mp);
 return env;
}
function adjustedPER(g,env){
 const s=g.stats||{},mp=num(g.minutes),t=env.teams.get(g.team),c=env.constants;
 if(!(mp>0)||!env.gameCodes.has(Number(g.gameCode))||!t||!(t.pace>0)||!(env.lgPace>0)||!c||c.ftPerFoul===null||c.ftaPerFoul===null)return null;
 const required=[...fields,'steals','blocksFavour'];if(!required.every(k=>num(s[k])!==null))return null;
 const teamFG=fgm(t.stats);if(!(teamFG>0)||num(t.stats.assistances)===null)return null;
 const ast=t.stats.assistances/teamFG,fg=fgm(s),fgAtt=fga(s),{factor,vop,drb}=c;
 const value=s.fieldGoalsMade3+2/3*s.assistances+(2-factor*ast)*fg+s.freeThrowsMade*.5*(1+(1-ast)+2/3*ast)
  -vop*s.turnovers-vop*drb*(fgAtt-fg)-vop*.44*(.44+.56*drb)*(s.freeThrowsAttempted-s.freeThrowsMade)
  +vop*(1-drb)*(s.totalRebounds-s.offensiveRebounds)+vop*drb*s.offensiveRebounds+vop*s.steals+vop*drb*s.blocksFavour
  -s.foulsCommited*(c.ftPerFoul-.44*c.ftaPerFoul*vop);
 const per=value/mp*env.lgPace/t.pace;return Number.isFinite(per)?per:null;
}
function gameMetrics(g,data,env){
 const s=g.stats||{},match=data.teamGames?.[String(g.gameCode)],side=g.home===true?'local':g.home===false?'road':null;
 const own=side?match?.[side]:null,opp=side?match?.[side==='local'?'road':'local']:null,mins=num(g.minutes),length=num(own?.gameMinutes);
 const share=mins>0&&length>0&&own.team===g.team?mins/length:null,t=own?.stats||{},o=opp?.stats||{};
 const stl=num(s.steals),blk=num(s.blocksFavour),reb=num(s.totalRebounds),orb=num(s.offensiveRebounds),drb=num(s.defensiveRebounds);
 const add=(a,b)=>num(a)!==null&&num(b)!==null?Number(a)+Number(b):null;
 const oppPoss=possessions(o),opp2=num(o.fieldGoalsAttempted2),rebTotal=add(t.totalRebounds,o.totalRebounds),orebTotal=add(t.offensiveRebounds,o.defensiveRebounds),drebTotal=add(t.defensiveRebounds,o.offensiveRebounds);
 const rate=(value,available)=>({numerator:value,exposure:share!==null&&available!==null&&available>0?share*available:null,value:share!==null&&available>0&&value!==null?100*value/(share*available):null});
 const per=env?adjustedPER(g,env):null;
 return {stl:rate(stl,oppPoss),blk:rate(blk,opp2),reb:rate(reb,rebTotal),orb:rate(orb,orebTotal),drb:rate(drb,drebTotal),stocks:stl!==null&&blk!==null?stl+blk:null,steals:stl,blocks:blk,rebounds:reb,offensiveRebounds:orb,defensiveRebounds:drb,per:per!==null&&env.scale!==null?per*env.scale:null};
}
function summarize(games,data,env){
 const played=games.filter(g=>num(g.minutes)>0),rows=played.map(g=>({g,m:gameMetrics(g,data,env)}));
 const total=k=>rows.length&&rows.every(r=>num(r.m[k])!==null)?rows.reduce((s,r)=>s+r.m[k],0):null;
 const rates=Object.fromEntries(['stl','blk','reb','orb','drb'].map(k=>{const valid=rows.filter(r=>r.m[k].value!==null),n=valid.reduce((s,r)=>s+r.m[k].numerator,0),ex=valid.reduce((s,r)=>s+r.m[k].exposure,0);return [k,{value:ex>0?100*n/ex:null,covered:valid.length,missing:played.length-valid.length}]}));
 const perRows=rows.filter(r=>r.m.per!==null),minutes=perRows.reduce((s,r)=>s+r.g.minutes,0);
 return {...rates,per:{value:minutes>0?perRows.reduce((s,r)=>s+r.m.per*r.g.minutes,0)/minutes:null,covered:perRows.length,missing:played.length-perRows.length},stocks:total('stocks'),steals:total('steals'),blocks:total('blocks'),rebounds:total('rebounds'),offensiveRebounds:total('offensiveRebounds'),defensiveRebounds:total('defensiveRebounds'),played:played.length,registered:games.length};
}
const api={num,possessions,environment,gameMetrics,summarize};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DefenseCore=api;
})(typeof window!=='undefined'?window:globalThis);
