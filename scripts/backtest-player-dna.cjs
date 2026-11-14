/* Opt-in experiment. Reads versioned pregame inputs and never changes forecast settings. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const M=require('../dna-player-core.js');
const D=require('../dna-core.js');
const P=require('../personal-model-core.js');
const U=require('../unified-forecast-core.js');
const root=path.resolve(__dirname,'..');
const load=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024});
const schedule=Object.values(load('data/learning/schedule.json')).filter(g=>g.played);
const source='data/official-offense.json';
const revisions=git('log','--first-parent','--format=%H %cI','--',source).trim().split('\n')
 .map(line=>line.split(' ')).map(([sha,t])=>[sha,Date.parse(t)]);
const snapshots=new Map();
function archived(cutoff){
 for(const [sha,stamp] of revisions){
  if(stamp>cutoff)continue;
  if(!snapshots.has(sha))snapshots.set(sha,JSON.parse(git('show',sha+':'+source)));
  const data=snapshots.get(sha);
  if(Date.parse(data.updated_at)<=cutoff)return data;
 }
 return null;
}

const rows=[];
for(const game of schedule){
 const file='data/learning/snapshots/E2026-'+game.gameCode+'.json';
 const boxFile='data/backtest/cache/E2026-'+game.gameCode+'-stats.json';
 if(!fs.existsSync(path.join(root,file))||!fs.existsSync(path.join(root,boxFile)))continue;
 const saved=load(file),cutoff=Date.parse(saved.created_at);
 if(saved.season!=='E2026'||saved.gameCode!==game.gameCode||!(cutoff<Date.parse(game.start)))continue;
 const data=archived(cutoff);
 if(!data)continue;
 const context=M.seasonContext(data,null,cutoff,{pregame:true,fixtureCode:game.gameCode});
 const people=new Map([...context.players.values()].map(p=>[D.key(p.name),p]));
 const known=new Map();
 for(const p of people.values())for(const g of p.games)known.set(g.gameCode+'|'+D.key(p.name)+'|'+g.team,g.stats?.valuation);
 const box=load(boxFile);
 for(const p of saved.predictions){
  if(p.status!=='active'||!(p.expectedMinutes>=5)||!Number.isFinite(p.expectedPir))continue;
  const team=P.team(p.team),key=D.key(p.name),past=people.get(key);
  const side=team===game.home?'local':team===game.away?'road':null;
  if(!side||!past||P.team(p.opponent)!==(side==='local'?game.away:game.home))continue;
  const actual=box[side]?.players.find(r=>D.key(r.player?.person?.name)===key)?.stats;
  if(!Number.isFinite(actual?.valuation)||!Number.isFinite(actual.timePlayed))continue;
  const f=M.features({...past,team},context);
  if(!Number.isFinite(f.stability)||!Number.isFinite(f.offensiveRole))continue;
  // Two separate signals. Stability uses outcomes under weak shooting and role
  // change uses action counts only. No additional Usage or shooting coefficient.
  const x=[Math.max(-1,Math.min(1,(f.stability-50)/100)),Math.max(-2,Math.min(2,f.offensiveRole/10))];
  rows.push({gameCode:game.gameCode,cutoff,key:key+'|'+team,known,x,actualPir:actual.valuation,
   actualMinutes:actual.timePlayed/60,base:{expected:p.expectedPir,minutes:p.expectedMinutes}});
 }
}
rows.sort((a,b)=>a.cutoff-b.cutoff);
const paired=[];
for(const row of rows){
 const train=rows.filter(r=>r.cutoff<row.cutoff&&Number.isFinite(row.known.get(r.gameCode+'|'+r.key)));
 if(train.length<40||new Set(train.map(r=>r.gameCode)).size<3)continue;
 // Two-variable ridge regression on errors from frozen forecasts. Fit only on
 // already published outcomes, and limit the experimental correction to 3 PIR.
 let aa=35,ab=0,bb=35,ay=0,by=0;
 for(const p of train){
  const [a,b]=p.x,y=row.known.get(p.gameCode+'|'+p.key)-p.base.expected;
  aa+=a*a;ab+=a*b;bb+=b*b;ay+=a*y;by+=b*y;
 }
 const det=aa*bb-ab*ab,[a,b]=row.x;
 const adjustment=a*(bb*ay-ab*by)/det+b*(aa*by-ab*ay)/det;
 paired.push({...row,candidate:{...row.base,expected:Math.max(0,row.base.expected+Math.max(-3,Math.min(3,adjustment)))}});
}
console.log(JSON.stringify({available:rows.length,availableGames:new Set(rows.map(r=>r.gameCode)).size,
 baseline:U.metrics(paired,r=>r.base),experiment:U.metrics(paired,r=>r.candidate)},null,2));
