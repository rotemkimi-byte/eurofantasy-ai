'use strict';
const fs=require('node:fs'),path=require('node:path');
const C=require('../advanced-player-core.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'data/advanced-players.json');
const read=(p,fallback)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return fallback}};
async function fetchJSON(url){
 for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(url,{headers:{'User-Agent':'EuroFantasy-PlayerTools/1.0','Accept':'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){if(attempt===1)throw e;}}
}
async function main(){
 const official=read(path.join(root,'data/official-offense.json'),null);
 if(official?.season!=='E2026')throw Error('Missing current-season official data');
 const info=new Map();
 for(const p of Object.values(official.players))for(const g of p.games||[])if(Date.parse(g.date)<Date.now())info.set(String(g.gameCode),{gameCode:g.gameCode,date:g.date,round:g.round});
 const old=read(out,{games:{}}),codes=[...info.keys()].sort((a,b)=>Date.parse(info.get(b).date)-Date.parse(info.get(a).date));
 const result={schema:'advanced-players-v1',season:'E2026',updated_at:new Date().toISOString(),source:'https://live.euroleague.net/',games:{},warnings:[]};
 let at=0;
 async function worker(){while(at<codes.length){const i=at++,code=codes[i],meta=info.get(code);
  if(i>=6&&old.schema==='advanced-players-v1'&&old.games?.[code]?.eventsFetched&&old.games[code].styleVersion===1){result.games[code]=old.games[code];continue;}
  const box=read(path.join(root,'data/backtest/cache/E2026-'+code+'-stats.json'),null);
  if(!box){result.warnings.push('Missing box score '+code);continue;}
  const urls=['Points','PlaybyPlay'].map(kind=>'https://live.euroleague.net/api/'+kind+'?gamecode='+code+'&seasoncode=E2026');
  const fetched=await Promise.allSettled(urls.map(fetchJSON));
  const points=fetched[0].status==='fulfilled'?fetched[0].value:null,pbp=fetched[1].status==='fulfilled'?fetched[1].value:null;
  const hasPoints=!!points?.Rows?.length,hasPbp=pbp?.Live===false;
  const previous=old.games?.[code];
  const players=C.buildGame(box,points,pbp);
  // Either upstream feed can be rate-limited independently. Retain the verified
  // fields for that feed while accepting newly verified fields from the other.
  const priorPlayers=previous?.players||{};
  const matching=new Set(Object.values(players).filter(p=>{
   const prior=priorPlayers[p.id];
   return prior?.teamCode===p.teamCode&&JSON.stringify(prior.stats)===JSON.stringify(p.stats);
  }).map(p=>p.id));
  const sameBox=matching.size===Object.keys(players).length&&matching.size===Object.keys(priorPlayers).length;
  for(const p of Object.values(players)){
   if(!matching.has(p.id))continue;
   const prior=priorPlayers[p.id];
   if(!hasPoints){
    p.shots=prior.shots;p.shotCoverage=prior.shotCoverage;
    if(prior.styleShots)p.styleShots=prior.styleShots;
   }
   if(!hasPbp){p.lineups=prior.lineups;p.lineupCoverage=prior.lineupCoverage;}
  }
  for(const p of Object.values(players)){
   const o=Object.values(official.players).find(o=>C.pid(o.playerCode)===p.id);
   const g=o?.games.find(g=>String(g.gameCode)===code);
   if(g){p.team=g.team;p.opponent=g.opponent;p.home=g.home;}
  }
  const styleVersion=hasPoints||(sameBox&&previous?.styleVersion===1)?1:undefined;
  const retained=sameBox&&previous?.eventsFetched;
  const eventsFetched=(hasPoints||retained)&&(hasPbp||retained);
  result.games[code]={...meta,styleVersion,eventsFetched:!!eventsFetched,players};
  if(!hasPoints||!hasPbp)result.warnings.push('Missing event feed '+code);
 }}
 await Promise.all(Array.from({length:4},worker));
 if(!Object.keys(result.games).length)throw Error('No advanced games; preserving previous dataset');
 fs.writeFileSync(out,JSON.stringify(result)+'\n');
 const all=Object.values(result.games).flatMap(g=>Object.values(g.players)).filter(p=>p.minutes>0);
 console.log(JSON.stringify({games:Object.keys(result.games).length,appearances:all.length,shots:all.filter(p=>p.shotCoverage).length,lineups:all.filter(p=>p.lineupCoverage).length,warnings:result.warnings.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
