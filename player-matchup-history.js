(()=>{
'use strict';
const section=document.getElementById('playerMatchups');
const upcoming=section.querySelector('#pmUpcoming'),history=section.querySelector('#pmHistory');
const round=history.querySelector('#pmHistoryRound'),game=history.querySelector('#pmHistoryGame');
const status=history.querySelector('#pmHistoryStatus'),retry=history.querySelector('#pmHistoryRetry'),result=history.querySelector('#pmHistoryResult');
const positions={1:'G',2:'F',3:'C'};
const day=new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'});
let rounds=null,loading=false,request=0;

function completedGames(schedule){
 const seen=new Set();
 return schedule.data.filter(g=>{
  const home=pmNumber(g.local?.score),away=pmNumber(g.road?.score);
  if(g.season?.code!=='E2026'||g.played!==true||!Number.isInteger(g.gameCode)||g.gameCode<=0||
    !Number.isInteger(g.round)||!g.local?.club?.name||!g.road?.club?.name||
    home===null||away===null||home===away||!(Date.parse(g.utcDate)<=Date.now())||seen.has(g.gameCode))return false;
  seen.add(g.gameCode);
  return true;
 }).map(g=>({
  code:g.gameCode,round:g.round,date:new Date(g.utcDate),
  home:canonicalTeam(g.local.club.name),away:canonicalTeam(g.road.club.name),
  homeScore:g.local.score,awayScore:g.road.score
 })).sort((a,b)=>b.round-a.round||b.date-a.date||b.code-a.code);
}
function roster(side){
 return side.players.flatMap(({player,stats})=>{
  const name=player?.person?.name,seconds=pmNumber(stats?.timePlayed);
  if(!name||!(seconds>0))return [];
  return [{name:reorderCommaName(name),pos:positions[player.position]||'—',
   starter:stats.startFive===true,values:pmBoxValues(stats,seconds)}];
 }).sort((a,b)=>b.values.minutes-a.values.minutes||a.name.localeCompare(b.name));
}
const number=(p,key)=>clubNumber(p?.values[key]);
function matchup({a,b,pos}){
 const side=p=>p?`<span><bdi>${esc(p.name)}</bdi><small>${number(p,'minutes')} דק׳ · PIR ${number(p,'pir')}</small></span>`:
  '<span class="muted">—</span>';
 const position=pos==='—'?'עמדה לא ידועה':pos;
 return `<details class="pmHistoryPair"><summary>${side(a)}<span class="pmHistoryPosition">${position}</span>${side(b)}</summary>
  <div class="pmCompare"><table aria-label="השוואת שחקנים במשחק"><thead><tr>
  <th scope="col"><bdi>${esc(a?.name||'—')}</bdi></th><th scope="col">בפועל</th><th scope="col"><bdi>${esc(b?.name||'—')}</bdi></th>
  </tr></thead><tbody>${PM_METRICS.map(([key,label])=>`<tr><td>${number(a,key)}</td><th scope="row">${label}</th><td>${number(b,key)}</td></tr>`).join('')}</tbody></table></div>
 </details>`;
}
function lineups(box){
 const home=roster(box.local),away=roster(box.road);
 if(!home.length&&!away.length)return '';
 return [true,false].map(starter=>{
  const pairs=pmListPairs(home.filter(p=>p.starter===starter),away.filter(p=>p.starter===starter),['C','F','G','—']);
  if(!pairs.length)return '';
  const title=starter?'חמישיות פותחות בפועל':'שחקני ספסל ששיחקו';
  return `<h4 class="pmLineupTitle">${title}</h4>${pairs.map(matchup).join('')}`;
 }).join('');
}
async function renderGame(){
 const selected=rounds.get(round.value)?.find(g=>String(g.code)===game.value);
 if(!selected)return;
 const id=++request;
 retry.hidden=true;
 status.textContent='טוען בוקס סקור…';
 result.innerHTML=`<div class="pmHistoryScore">
  <span><small>בית</small><bdi>${esc(selected.home)}</bdi></span>
  <strong><bdi>${selected.homeScore}</bdi><span>–</span><bdi>${selected.awayScore}</bdi></strong>
  <span><small>חוץ</small><bdi>${esc(selected.away)}</bdi></span>
 </div><div data-pm-history-lineups></div>`;
 try{
  const box=await lastThreeFetch(`./data/backtest/cache/E2026-${selected.code}-stats.json`);
  if(id!==request)return;
  const html=lineups(box);
  if(!html)throw Error('empty box score');
  result.querySelector('[data-pm-history-lineups]').innerHTML=html;
  status.textContent='נתוני המשחק בפועל · צימוד לפי עמדה ודקות · לחיצה על זוג פותחת את הפירוט';
 }catch{
  if(id!==request)return;
  status.textContent='בוקס סקור למשחק הזה לא זמין כרגע.';
  retry.hidden=false;
 }
}
function changeRound(){
 const choices=rounds.get(round.value)||[];
 game.replaceChildren(...choices.map(g=>new Option(day.format(g.date)+' · '+g.home+' – '+g.away,g.code)));
 game.disabled=!choices.length;
 void renderGame();
}
async function openHistory(){
 if(loading||rounds)return;
 loading=true;
 retry.hidden=true;
 status.textContent='טוען משחקי עבר…';
 try{
  const schedule=await lastThreeFetch('./data/context/E2026-schedule.json');
  rounds=new Map();
  for(const g of completedGames(schedule)){
   const key=String(g.round);
   if(!rounds.has(key))rounds.set(key,[]);
   rounds.get(key).push(g);
  }
  if(!rounds.size){status.textContent='אין עדיין משחקים שהסתיימו בעונת 2026/27.';return;}
  round.replaceChildren(...[...rounds.keys()].map(n=>new Option('מחזור '+n,n)));
  round.disabled=false;
  changeRound();
 }catch{
  rounds=null;
  status.textContent='טעינת משחקי העבר נכשלה.';
  retry.hidden=false;
 }finally{loading=false;}
}
const modes=section.querySelectorAll('[data-pm-mode]');
for(const button of modes)button.addEventListener('click',()=>{
 const showHistory=button.dataset.pmMode==='history';
 for(const item of modes)item.setAttribute('aria-pressed',String(item===button));
 upcoming.hidden=showHistory;
 history.hidden=!showHistory;
 if(showHistory)void openHistory();
});
round.addEventListener('change',changeRound);
game.addEventListener('change',()=>void renderGame());
retry.addEventListener('click',()=>void (rounds?renderGame():openHistory()));
})();
