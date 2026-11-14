'use strict';
const fs=require('node:fs');
const path=require('node:path');
const A=require('../advanced-player-core.js');
const L=require('../dna-lineup-ledger.cjs');
const file=path.resolve(__dirname,'../data/player-dna-events.json');
const empty=()=>({season:'E2026',version:1,fields:L.fields,games:{}});
function previous(){
 try{
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.season==='E2026'&&data.version===1&&JSON.stringify(data.fields)===JSON.stringify(L.fields))return data;
 }catch(error){if(error.code!=='ENOENT')throw error;}
 return empty();
}
function game(box,points,pbp,meta,prior,{teamDna=false}={}){
 let ledger=null;
 const zones={};
 const players=A.buildGame(box,points,pbp,{
  teamDna,
  observeLineups(...args){
   const capture=L.capture(...args);
   if(capture)return {track:capture.track,finish:end=>{ledger=capture.finish(end);}};
  },
  observeShots(player,shots){
   const bins=Array.from({length:4},()=>[0,0,0]);
   let distance=0,paint=0;
   for(const shot of shots){
    const bin=bins[A.shotZone(shot)];
    bin[0]++;bin[1]+=Number(shot.made);bin[2]+=shot.points;
    distance+=Math.hypot(shot.x,shot.y)/100;
    if(shot.type.startsWith('2')&&Math.abs(shot.x)<=245&&shot.y<=422.5)paint+=shot.points;
   }
   zones[player.id]=[bins,Math.round(distance*1e6)/1e6,paint];
  }
 });
 const sides=['local','road'].map(side=>String(box[side]?.players?.[0]?.player?.club?.code||'').trim());
 const same=prior?.date===meta.date&&sides.every((code,i)=>prior.teams[i]===code)&&
  prior.score.every((n,i)=>n===box[i?'road':'local'].total.points);
 const data={
  date:meta.date,teams:sides,score:['local','road'].map(side=>box[side].total.points),
  ...(ledger?{ledger}:pbp?.Live!==false&&same&&prior.ledger?{ledger:prior.ledger}:{}),
  zones:points?.Rows?.length?Object.fromEntries(Object.entries(zones).filter(([id])=>players[id].minutes>0)):same?prior.zones:{}
 };
 return {players,data};
}
const save=data=>fs.writeFileSync(file,JSON.stringify(data)+'\n');
if(require.main===module){
 // For reproducible backfills, read the same raw feeds as the scheduled build.
 const [pbpDir,pointsDir]=process.argv.slice(2);
 if(!pbpDir||!pointsDir)throw Error('Pass Play-by-Play and Points cache directories');
 const data=empty(),official=require('../data/official-offense.json');
 if(official.season!==data.season)throw Error('Wrong EuroLeague season');
 for(const meta of official.teamResults){
  const code=meta.gameCode;
  const box=require('../data/backtest/cache/E2026-'+code+'-stats.json');
  const read=dir=>JSON.parse(fs.readFileSync(path.resolve(dir,code+'.json'),'utf8'));
  data.games[code]=game(box,read(pointsDir),read(pbpDir),meta).data;
 }
 save(data);
}
module.exports={empty,previous,game,save};
