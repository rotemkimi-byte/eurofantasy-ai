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
  homeScore:Number(g.local.score),awayScore:Number(g.road.score),
  homeCrest:g.local.club.images?.crest,awayCrest:g.road.club.images?.crest
 })).sort((a,b)=>b.round-a.round||b.date-a.date||b.code-a.code);
}
function roster(side){
 return side.players.flatMap(({player,stats})=>{
  const name=player?.person?.name,seconds=pmNumber(stats?.timePlayed);
  if(!name||!(seconds>0))return [];
  return [{name:reorderCommaName(name),playerCode:player.person.code,team:player.club?.name,pos:positions[player.position]||'—',
   photo:playerCardImageUrl(player.images?.headshot)||playerCardImageUrl(player.images?.action)||playerCardImageUrl(playerCardProfile({name,playerCode:player.person.code,team:player.club?.name})?.photo),
   starter:stats.startFive===true,values:pmBoxValues(stats,seconds)}];
 }).sort((a,b)=>b.values.minutes-a.values.minutes||a.name.localeCompare(b.name));
}
const number=(p,key)=>clubNumber(p?.values[key]);
function matchup({a,b,pos}){
 const first=pmNumber(a?.values.pir),second=pmNumber(b?.values.pir);
 const compared=first!==null&&second!==null;
 const lower=Math.min(0,first??0,second??0),upper=Math.max(0,first??0,second??0);
 const side=(p,pir,other)=>{
  if(!p)return '<span class="pmHistoryEmpty">אין שחקן בעמדה</span>';
  const tone=compared&&pir!==other?(pir>other?'leading':'trailing'):'neutral';
  const share=compared?(upper===lower?50:100*(pir-lower)/(upper-lower)):0;
  const comparison=tone==='leading'?'PIR גבוה יותר':tone==='trailing'?'PIR נמוך יותר':compared?'PIR שווה':'';
  return `<span class="pmHistoryPlayer" data-pir-tone="${tone}">
   ${window.PlayerAnalysis.control(p,`<span class="pmHistoryPhoto" aria-hidden="true">${window.ChartGameCard.image(p.photo)}<b>${esc(p.name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''))}</b></span><bdi class="pmHistoryName">${esc(p.name)}</bdi>`,'pm-history-identity')}
   <span class="pmHistoryNumbers pa-dark-metrics"><span><small>PIR</small><bdi${pir<0?' data-tone="negative"':''}>${number(p,'pir')}</bdi></span><span><small>דקות</small><bdi>${number(p,'minutes')}</bdi></span></span>
   ${compared?`<span class="pmHistoryPerformance" role="img" aria-label="${comparison}"><i style="width:${share}%"></i></span>`:''}
  </span>`;
 };
 const position=pos==='—'?'עמדה לא ידועה':({C:'סנטר',F:'פורוורד',G:'גארד'})[pos];
 return `<details class="pmHistoryPair"><summary>${side(a,first,second)}<span class="pmHistoryPosition" aria-label="${position}" title="${position}">${pos}</span>${side(b,second,first)}</summary>
  <div class="pmCompare"><table aria-label="השוואת שחקנים במשחק"><thead><tr>
  <th scope="col"><bdi>${esc(a?.name||'—')}</bdi></th><th scope="col">בפועל</th><th scope="col"><bdi>${esc(b?.name||'—')}</bdi></th>
  </tr></thead><tbody>${PM_METRICS.map(([key,label])=>pmComparisonRow(key,label,a?.values[key],b?.values[key])).join('')}</tbody></table></div>
 </details>`;
}
function lineups(box){
 const home=roster(box.local),away=roster(box.road);
 if(!home.length&&!away.length)return '';
 return [true,false].map(starter=>{
  const pairs=pmListPairs(home.filter(p=>p.starter===starter),away.filter(p=>p.starter===starter),['C','F','G','—']);
  if(!pairs.length)return '';
  const title=starter?'חמישיות פותחות בפועל':'שחקני ספסל ששיחקו';
  return `<section class="pmHistoryLineup"><h4 class="pmLineupTitle">${title}</h4>${pairs.map(matchup).join('')}</section>`;
 }).join('');
}
async function renderGame(){
 const selected=rounds.get(round.value)?.find(g=>String(g.code)===game.value);
 if(!selected)return;
 const id=++request;
 retry.hidden=true;
 status.textContent='טוען בוקס סקור…';
 const homeWon=selected.homeScore>selected.awayScore;
 const team=(name,crest,venue,won)=>`<span class="pmHistoryTeam${won?' is-winner':''}">
  ${window.ChartGameCard.crest(name,crest)}<bdi>${esc(name)}</bdi>
  <small>${venue}${won?' · ניצחון':''}</small></span>`;
 result.innerHTML=`<div class="pmHistoryScore">
  ${team(selected.home,selected.homeCrest,'בית',homeWon)}
  <strong dir="rtl"><bdi class="${homeWon?'is-winner':''}">${selected.homeScore}</bdi>–<bdi class="${homeWon?'':'is-winner'}">${selected.awayScore}</bdi><small dir="rtl">תוצאה סופית</small></strong>
  ${team(selected.away,selected.awayCrest,'חוץ',!homeWon)}
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
