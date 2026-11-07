(function(root){
'use strict';
const n=x=>x===null||x===undefined||x===''||typeof x==='boolean'||!Number.isFinite(Number(x))?null:Number(x);
const pid=x=>String(x||'').trim().replace(/^P/,'');
const sum=(a,k)=>a.reduce((v,x)=>v+(n(x[k])||0),0);
const shotTypes={'2FGM':2,'2FGA':0,'3FGM':3,'3FGA':0,'FTM':1,'FTA':0};
function select(games,range,now=Date.now()){
 const rows=[...new Map((games||[]).filter(g=>Date.parse(g.date)<=now).map(g=>[String(g.gameCode),g])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.gameCode-a.gameCode);
 if(String(range).startsWith('game:'))return rows.filter(g=>String(g.gameCode)===String(range).slice(5));
 return Number(range)>0?rows.slice(0,Number(range)):rows;
}
function boxAverages(games,fields){
 const played=games.filter(g=>n(g.minutes)>0);
 const summarize=values=>({
  mean:values.length?values.reduce((total,value)=>total+value,0)/values.length:null,
  covered:values.length
 });
 const stats=Object.fromEntries(fields.map(key=>[key,summarize(played
  .map(g=>n(g.stats?.[key])).filter(value=>value!==null))]));
 const shooting=Object.fromEntries([2,3].map(points=>{
  const pairs=played.map(g=>[n(g.stats?.['fieldGoalsMade'+points]),n(g.stats?.['fieldGoalsAttempted'+points])])
   .filter(([made,attempted])=>made!==null&&attempted!==null&&made>=0&&attempted>=made);
  return [points,{made:summarize(pairs.map(p=>p[0])).mean,attempted:summarize(pairs.map(p=>p[1])).mean,covered:pairs.length}];
 }));
 return {games:played.length,stats,shooting};
}
function negative(games){
 const fields={turnovers:'turnovers',fouls:'foulsCommited',blocked:'blocksAgainst'};
 const result={};
 for(const [k,f] of Object.entries(fields)){const vals=games.map(g=>n(g.stats?.[f])).filter(x=>x!==null&&x>=0);result[k]={total:vals.length?vals.reduce((a,b)=>a+b,0):null,covered:vals.length,mean:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};}
 for(const [k,a,m] of [['miss2','fieldGoalsAttempted2','fieldGoalsMade2'],['miss3','fieldGoalsAttempted3','fieldGoalsMade3'],['missFT','freeThrowsAttempted','freeThrowsMade']]){
 const vals=games.map(g=>[n(g.stats?.[a]),n(g.stats?.[m])]).filter(([a,m])=>a!==null&&m!==null&&a>=m&&m>=0).map(([a,m])=>a-m);
 result[k]={total:vals.length?vals.reduce((a,b)=>a+b,0):null,covered:vals.length,mean:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null};
 }return result;
}
function plus(games){
 const rows=games.filter(g=>n(g.stats?.plusMinus)!==null&&n(g.minutes)>0);
 const total=rows.reduce((a,g)=>a+Number(g.stats.plusMinus),0),minutes=sum(rows,'minutes');
 return {total:rows.length?total:null,mean:rows.length?total/rows.length:null,per40:minutes?40*total/minutes:null,covered:rows.length,minutes};
}
function buildGame(box,points,pbp){
 const people={};
 for(const side of ['local','road'])for(const r of box[side]?.players||[]){
  const p=r.player?.person||{},s=r.stats||{},id=pid(p.code);
  if(!id||!p.name)continue;
  people[id]={id,name:p.name,teamCode:String(r.player?.club?.code||'').trim(),team:r.player?.club?.name||'',height:n(p.height),minutes:n(s.timePlayed)===null?null:n(s.timePlayed)/60,stats:s,shots:[],shotCoverage:false,lineups:[],lineupCoverage:false};
 }
 // A complete per-player shooting ledger must reconcile with the box score.
 const raw=Array.isArray(points?.Rows)?points.Rows:[],seen=new Set(),duplicates=new Set();
 for(const r of raw){
  const id=pid(r.ID_PLAYER),p=people[id],type=String(r.ID_ACTION||'').trim(),key=String(r.NUM_ANOT);
  if(!p||!(type in shotTypes))continue;
  if(seen.has(key)){duplicates.add(id);continue;}seen.add(key);
  if(String(r.TEAM||'').trim()!==p.teamCode){duplicates.add(id);continue;}
  const flag=k=>r[k]===0||r[k]==='0'?false:r[k]===1||r[k]==='1'?true:null;
  let x=n(r.COORD_X),y=n(r.COORD_Y);
  if(type.startsWith('FT')||x===null||y===null||(x===-1&&y===-1)||Math.abs(x)>750||y< -157.5||y>2642.5){x=null;y=null;}
  p.shots.push({event:n(r.NUM_ANOT),type,points:shotTypes[type],made:type.endsWith('M'),x,y,fastbreak:flag('FASTBREAK'),secondChance:flag('SECOND_CHANCE'),offTurnover:flag('POINTS_OFF_TURNOVER')});
 }
 for(const p of Object.values(people)){
  const s=p.stats,counts=[['2','fieldGoalsAttempted2','fieldGoalsMade2'],['3','fieldGoalsAttempted3','fieldGoalsMade3'],['FT','freeThrowsAttempted','freeThrowsMade']];
  p.shotCoverage=raw.length>0&&!duplicates.has(p.id)&&counts.every(([prefix,a,m])=>n(s[a])!==null&&n(s[m])!==null&&p.shots.filter(r=>r.type.startsWith(prefix)).length===n(s[a])&&p.shots.filter(r=>r.type.startsWith(prefix)&&r.made).length===n(s[m]));
  // Points may omit missed free throws. Verify field attempts and all made shots
  // independently before deriving location and tagged scoring shares.
  const verified=raw.length>0&&!duplicates.has(p.id)&&counts.every(([prefix,a,m])=>
   n(s[m])!==null&&p.shots.filter(r=>r.type.startsWith(prefix)&&r.made).length===n(s[m])&&
   (prefix==='FT'||(n(s[a])!==null&&p.shots.filter(r=>r.type.startsWith(prefix)).length===n(s[a]))));
  if(verified){
   const field=p.shots.filter(r=>!r.type.startsWith('FT')),located=field.filter(r=>r.x!==null&&r.y!==null);
   const scoring=p.shots.filter(r=>r.made),points=sum(scoring,'points');
   const marked=flag=>scoring.every(r=>typeof r[flag]==='boolean')?[sum(scoring.filter(r=>r[flag]),'points'),points]:null;
   p.styleShots={fieldAttempts:field.length,located:located.length,
    nearRim:located.filter(r=>r.type.startsWith('2')&&Math.hypot(r.x,r.y)<=200).length,
    fastbreak:marked('fastbreak'),secondChance:marked('secondChance')};
  }
  if(!p.shotCoverage)p.shots=[];
 }
 if(!pbp||pbp.Live!==false)return people;
 const teams={};
 for(const side of ['local','road']){
  const list=(box[side]?.players||[]),code=String(list[0]?.player?.club?.code||'').trim();
  const active=new Set(list.filter(r=>r.stats?.startFive===true).map(r=>pid(r.player.person.code)));
  teams[code]={active,valid:active.size===5,seconds:{},points:{},groups:{},side};
 }
 const rawEvents=[];
 ['FirstQuarter','SecondQuarter','ThirdQuarter','ForthQuarter','ExtraTime'].forEach((k,i)=>{
  for(const e of pbp[k]||[]){
   const period=i<4?i+1:5+Math.max(0,Math.floor(((n(e.MINUTE)||41)-41)/5));
   const length=period<=4?600:300,start=period<=4?(period-1)*600:2400+(period-5)*300;
   const type=String(e.PLAYTYPE||'').trim();let at=null;
   if(type==='BP')at=start;
   else if(type==='EP'||type==='EG')at=start+length;
   else {const match=String(e.MARKERTIME||'').match(/^(\d{1,2}):(\d{2})$/);if(match&&Number(match[2])<60){const remaining=Number(match[1])*60+Number(match[2]);if(remaining<=length)at=start+length-remaining;}}
   rawEvents.push({...e,period,at,type,seq:n(e.NUMBEROFPLAY)});
  }
 });
 // Provider event number determines order inside each period, not scoring clock.
 const events=rawEvents.sort((a,b)=>a.period-b.period||(a.type==='BP'?-1:b.type==='BP'?1:0)||(a.seq-b.seq));
 const end=events.filter(e=>e.type==='EG').at(-1)?.at;
 if(!end||end<2400)return people;
 let last=0,timing=true;const ids=new Set();
 function group(t){const lineup=[...t.active].sort(),k=lineup.join('|');return t.groups[k]||(t.groups[k]={players:lineup,seconds:0,points:{}});}
 for(const e of events){
  if(ids.has(e.seq)){for(const t of Object.values(teams))t.valid=false;continue;}ids.add(e.seq);
  if(e.at===null||e.at<last)timing=false;
  const dt=timing?e.at-last:0;
  for(const t of Object.values(teams)){
   if(t.active.size!==5&&dt>0)t.valid=false;
   if(t.valid&&dt){group(t).seconds+=dt;for(const id of t.active)t.seconds[id]=(t.seconds[id]||0)+dt;}
  }if(e.at!==null)last=e.at;
  const code=String(e.CODETEAM||'').trim(),t=teams[code],id=pid(e.PLAYER_ID);
  if(!t)continue;
  if(e.type==='IN'){if(!people[id]||people[id].teamCode!==code||t.active.has(id))t.valid=false;t.active.add(id);}
  else if(e.type==='OUT'){if(!t.active.has(id))t.valid=false;t.active.delete(id);}
  else if(e.type in shotTypes){
   const pts=shotTypes[e.type];t.points[id]=(t.points[id]||0)+pts;
   if(t.active.size!==5||!t.active.has(id))t.valid=false;
   if(t.valid&&pts){const g=group(t);g.points[id]=(g.points[id]||0)+pts;}
  }
 }
 for(const [code,t] of Object.entries(teams)){
  const list=Object.values(people).filter(p=>p.teamCode===code);
  // Reject unverifiable lineups, rather than silently attributing scoring to a wrong five.
  if(!t.valid||!list.every(p=>n(p.stats.points)!==null&&(t.points[p.id]||0)===n(p.stats.points)))continue;
  for(const p of list){
   p.lineupCoverage=true;
   p.lineups=Object.values(t.groups).filter(g=>g.players.includes(p.id)).map(g=>({teammates:g.players.filter(id=>id!==p.id).map(id=>({id,name:people[id].name})),minutes:timing&&list.every(q=>Math.abs((t.seconds[q.id]||0)-n(q.stats.timePlayed))<=3)?g.seconds/60:null,points:g.points[p.id]||0}));
  }
 }
 return people;
}
function attacks(games){
 const rows=games.filter(g=>g.shotCoverage),shots=rows.flatMap(g=>g.shots||[]);
 return ['fastbreak','secondChance','offTurnover','other'].map(key=>{
  const complete=rows.filter(g=>(g.shots||[]).every(s=>key==='other'?['fastbreak','secondChance','offTurnover'].every(k=>typeof s[k]==='boolean'):typeof s[key]==='boolean'));
  const selected=complete.flatMap(g=>g.shots||[]).filter(s=>key==='other'?!s.fastbreak&&!s.secondChance&&!s.offTurnover:s[key]);
  const fg=selected.filter(s=>!s.type.startsWith('FT')),ft=selected.filter(s=>s.type.startsWith('FT'));
  return {key,covered:complete.length,points:sum(selected,'points'),fga:fg.length,fgm:fg.filter(s=>s.made).length,fta:ft.length,ftm:ft.filter(s=>s.made).length};
 });
}
function lineups(games){
 const map=new Map();
 for(const g of games.filter(g=>g.lineupCoverage))for(const row of g.lineups||[]){
  const key=row.teammates.map(p=>p.id).sort().join('|');let r=map.get(key);
  if(!r){r={teammates:row.teammates,points:0,minutes:0,games:new Set()};map.set(key,r);}
  r.points+=row.points;r.minutes=r.minutes===null||row.minutes===null?null:r.minutes+row.minutes;r.games.add(g.gameCode);
 }return [...map.values()].map(r=>({...r,games:r.games.size,per40:r.minutes>0?40*r.points/r.minutes:null})).sort((a,b)=>b.points-a.points||b.minutes-a.minutes);
}
const api={n,pid,select,boxAverages,negative,plus,buildGame,attacks,lineups};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AdvancedPlayerCore=api;
})(typeof window!=='undefined'?window:globalThis);
