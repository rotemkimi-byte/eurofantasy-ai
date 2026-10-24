(function(root){
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const add=(a,b)=>num(a)!==null&&num(b)!==null?Number(a)+Number(b):null;
function build(data,asOf=Date.now()){
 const map=new Map(),seen=new Set();
 const fresh=team=>({team,played:0,wins:0,losses:0,for:0,against:0,rankFor:0,rankAgainst:0,games:[]});
 for(const g of data.teamResults||[]){
  if(!g.home||!g.away||g.home===g.away||!(Date.parse(g.date)<=asOf)||seen.has(Number(g.gameCode))||num(g.homeScore)===null||num(g.awayScore)===null||g.homeScore===g.awayScore)continue;
  seen.add(Number(g.gameCode));
  for(const home of [true,false]){
   const name=home?g.home:g.away,opponent=home?g.away:g.home,points=num(home?g.homeScore:g.awayScore),against=num(home?g.awayScore:g.homeScore);
   if(!map.has(name))map.set(name,fresh(name));const t=map.get(name),box=data.teamGames?.[String(g.gameCode)],own=box?.[home?'local':'road'],opp=box?.[home?'road':'local'];
   const stats=own?.team===name?own.stats:null,opponentStats=opp?.team===opponent?opp.stats:null;
   const rawFor=num(home?g.homeStandingsScore:g.awayStandingsScore),rawAgainst=num(home?g.awayStandingsScore:g.homeStandingsScore);
   // The standings feed may omit regulation-only scores; never treat an absent zero as a real 0–0.
   const hasReg=rawFor!==null&&rawAgainst!==null&&rawFor+rawAgainst>0;
   t.played++;t.wins+=points>against?1:0;t.losses+=points<against?1:0;t.for+=points;t.against+=against;t.rankFor+=hasReg?rawFor:points;t.rankAgainst+=hasReg?rawAgainst:against;
   t.games.push({code:Number(g.gameCode),round:g.round,date:g.date,home,team:name,opponent,points,against,stats,opponentStats,pir:num(stats?.valuation),opponentPir:num(opponentStats?.valuation)});
  }
 }
 let teams=[...map.values()].sort((a,b)=>b.wins-a.wins||a.played-b.played||(b.rankFor-b.rankAgainst)-(a.rankFor-a.rankAgainst)||b.rankFor-a.rankFor||a.team.localeCompare(b.team));
 const official=data.officialStandings?.rows||[],ranks=new Map(official.map(r=>[r.team,num(r.rank)]));
 const useOfficial=teams.length>0&&teams.every(t=>ranks.get(t.team)>0)&&new Set(teams.map(t=>ranks.get(t.team))).size===teams.length;
 if(useOfficial)teams.sort((a,b)=>ranks.get(a.team)-ranks.get(b.team));
 teams.forEach((t,i)=>{t.rank=useOfficial?ranks.get(t.team):i+1;t.difference=t.for-t.against;t.games.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.code-a.code);t.summary=summarize(t.games);});
 return {teams,official:useOfficial,rankSource:useOfficial?data.officialStandings.source:null,games:seen.size};
}
function summarize(games){
 const pair=games.filter(g=>g.pir!==null&&g.opponentPir!==null),sum=k=>games.reduce((s,g)=>s+g[k],0);
 const made=s=>add(s?.fieldGoalsMade2,s?.fieldGoalsMade3);
 const shots=games.filter(g=>made(g.stats)!==null&&made(g.opponentStats)!==null);
 return {games:games.length,for:sum('points'),against:sum('against'),pirGames:pair.length,pir:pair.length?pair.reduce((s,g)=>s+g.pir,0)/pair.length:null,opponentPir:pair.length?pair.reduce((s,g)=>s+g.opponentPir,0)/pair.length:null,
  madeGames:shots.length,made:shots.length?shots.reduce((s,g)=>s+made(g.stats),0):null,opponentMade:shots.length?shots.reduce((s,g)=>s+made(g.opponentStats),0):null};
}
const api={num,add,build,summarize};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TeamMetricsCore=api;
})(typeof window!=='undefined'?window:globalThis);
