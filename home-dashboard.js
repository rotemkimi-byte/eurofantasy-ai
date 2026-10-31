/* Home fixtures use official UTC timestamps, displayed in Israel time. */
(function(root){
'use strict';
const zone='Asia/Jerusalem';
const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function fixtures(payload,results=null){
 const score=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
 const finals=new Map((results?.season==='E2026'?results.teamResults||[]:[]).filter(r=>score(r.homeScore)&&score(r.awayScore)&&Number(r.homeScore)+Number(r.awayScore)>0).map(r=>[Number(r.gameCode),r]));
 return (payload?.data||[]).filter(g=>g.season?.code==='E2026'&&g.phaseType?.code==='RS'&&Number.isFinite(Date.parse(g.utcDate))&&g.local?.club&&g.road?.club)
  .map(g=>{
   const final=finals.get(Number(g.gameCode));
   const completed=!!final||(g.played===true&&score(g.local.score)&&score(g.road.score)&&Number(g.local.score)+Number(g.road.score)>0);
   return {...g,played:completed,day:dayKey(g.utcDate),local:{...g.local,score:final?Number(final.homeScore):g.local.score},road:{...g.road,score:final?Number(final.awayScore):g.road.score}};
  }).sort((a,b)=>Date.parse(a.utcDate)-Date.parse(b.utcDate));
}
function currentRound(games,now=Date.now()){
 const today=dayKey(now);return games.find(g=>g.day>=today)?.round||games.at(-1)?.round||null;
}
const api={dayKey,fixtures,currentRound};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.HomeDashboardCore=api;
if(typeof document==='undefined')return;
const hero=document.querySelector('main>.hero');if(!hero)return;
// Keep the existing model's stat targets available without showing the old hero.
hero.hidden=true;
const panel=document.createElement('section');panel.id='efDashboard';
panel.innerHTML=`<section class="card hd-fixtures" aria-labelledby="hdTitle"><div class="hd-heading"><h2 id="hdTitle"><span class="hd-live-dot"></span>משחקי המחזור</h2><button id="hdToday" class="secondary" type="button">המחזור הנוכחי</button><button id="hdRefresh" class="secondary" type="button" aria-label="רענון משחקים וטבלה">↻</button></div><nav id="hdRounds" aria-label="בחירת מחזור בגלילה אופקית"></nav><p id="hdGamesStatus" class="hd-note" role="status" aria-live="polite">טוען לוח משחקים…</p><div id="hdPreview" tabindex="0" role="region" aria-label="כל משחקי המחזור, גלילה אופקית"></div></section>`;
hero.before(panel);
// Keep standings open beside the tools, independently of the fixtures accordion.
const standings=document.createElement('section');standings.id='efCompactLeague';
standings.className='card hd-compact-league';
standings.setAttribute('aria-labelledby','hdLeagueTitle');
standings.innerHTML=`<div class="hd-league-heading"><h3 id="hdLeagueTitle">טבלת הליגה</h3><button class="secondary" type="button" id="hdTeams">מדד קבוצות ←</button></div><p id="hdTableStatus" class="hd-note" role="status" aria-live="polite">טוען דירוג…</p><div id="hdStandings" tabindex="0" role="region" aria-label="טבלת הליגה, גלול לכל הקבוצות"></div>`;
const search=document.querySelector('#efHome .ef-search');
if(search)search.after(standings);else panel.after(standings);
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleDateString('he-IL',{timeZone:zone,weekday:'long',day:'numeric',month:'numeric',year:'numeric'});
const time=value=>new Date(value).toLocaleTimeString('he-IL',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false});
let games=[],busy=false,manual=false,selectedRound=null;
function club(c){return typeof canonicalTeam==='function'?canonicalTeam(c.name):c.abbreviatedName||c.name;}
function renderGames(){
 const rows=games.filter(g=>Number(g.round)===selectedRound),days=[...new Set(rows.map(g=>g.day))],today=dayKey(Date.now());
 $('hdGamesStatus').textContent=`מחזור ${selectedRound} · ${days.length} סיבובי משחקים · שעות ישראל · גללו לצדדים ↔`;
 $('hdPreview').innerHTML=rows.map(g=>{
  const turn=days.indexOf(g.day)+1,past=Date.parse(g.utcDate)<Date.now(),status=g.played?'הסתיים':past?'תוצאה טרם עודכנה':g.day===today?'היום':'טרם שוחק';
  const shortDate=new Date(g.utcDate).toLocaleDateString('he-IL',{timeZone:zone,weekday:'short',day:'numeric',month:'numeric'});
  return `<article class="hd-match ${g.played?'hd-finished':''}"><div class="hd-turn"><b>סיבוב ${turn}</b><span>${esc(shortDate)}</span></div><div class="hd-match-top"><time datetime="${esc(g.utcDate)}">${g.confirmedHour===false?'טרם נקבעה':time(g.utcDate)}</time><span>${status}</span></div><div class="hd-side"><b>${esc(club(g.local.club))}</b><small>בית</small>${g.played?`<strong class="${g.local.score>g.road.score?'hd-winner':''}">${g.local.score}</strong>`:''}</div><div class="hd-side"><b>${esc(club(g.road.club))}</b><small>חוץ</small>${g.played?`<strong class="${g.road.score>g.local.score?'hd-winner':''}">${g.road.score}</strong>`:''}</div></article>`;
 }).join('')||'<p class="hd-note">אין משחקים זמינים למחזור הזה.</p>';
 for(const button of $('hdRounds').querySelectorAll('button'))button.setAttribute('aria-current',Number(button.dataset.round)===selectedRound?'true':'false');
 $('hdPreview').scrollLeft=0;
}
function selectRound(round){
 selectedRound=Number(round);renderGames();
 $('hdRounds').querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});
}
async function json(path){const r=await fetch(path+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Data unavailable');return r.json();}
async function loadGames(resultPromise){
 try{
  const [schedule,results]=await Promise.all([json('./data/context/E2026-schedule.json'),resultPromise.catch(()=>null)]);
  const next=fixtures(schedule,results);if(!next.length)throw Error('No fixtures');
  const old=selectedRound;games=next;
  const rounds=[...new Set(games.map(g=>g.round))].sort((a,b)=>a-b);
  $('hdRounds').innerHTML=rounds.map(r=>`<button class="secondary" type="button" data-round="${r}" aria-current="false">מחזור ${r}</button>`).join('');
  selectRound(manual&&rounds.includes(old)?old:currentRound(games));
 }catch{ $('hdGamesStatus').textContent=games.length?'הרענון נכשל · מוצג הלוח הקודם':'לוח המשחקים לא נטען. לחץ על רענון.'; }
}
async function loadTable(resultPromise){
 try{
  const data=await resultPromise;if(data.season!=='E2026')throw Error('Wrong season');
  const report=root.TeamMetricsCore.build(data);if(!report.teams.length)throw Error('No standings');
  $('hdTableStatus').textContent=`${report.official?'דירוג רשמי':'דירוג מחושב לפי מאזן והפרש נקודות'} · עודכן ${new Date(data.updated_at).toLocaleString('he-IL',{timeZone:zone,day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}`;
  $('hdStandings').innerHTML=`<table class="hd-standings-table"><thead><tr><th scope="col">#</th><th scope="col">קבוצה</th><th scope="col">מש׳</th><th scope="col">ניצ׳</th><th scope="col">הפ׳</th></tr></thead><tbody>${report.teams.map(t=>{
   const zone=t.rank<=6?'playoff':t.rank<=10?'playin':'other',rate=t.played>0?Math.max(0,Math.min(100,t.wins/t.played*100)):0;
   return `<tr class="hd-zone-${zone}"><td><span class="hd-rank">${t.rank}</span></td><th scope="row"><span class="hd-team-name">${esc(t.team)}</span><span class="hd-win-track" aria-hidden="true"><i style="width:${rate.toFixed(1)}%"></i></span></th><td>${t.played}</td><td class="hd-wins">${t.wins}</td><td>${t.losses}</td></tr>`;
  }).join('')}</tbody></table>`;
 }catch{ $('hdTableStatus').textContent=$('hdStandings').children.length?'הרענון נכשל · מוצגת הטבלה הקודמת':'טבלת הדירוג לא נטענה. לחץ על רענון.'; }
}
async function load(){if(busy)return;busy=true;$('hdRefresh').disabled=true;const resultPromise=json('./data/official-offense.json');await Promise.allSettled([loadGames(resultPromise),loadTable(resultPromise)]);busy=false;$('hdRefresh').disabled=false;}
$('hdRounds').onclick=e=>{const button=e.target.closest('[data-round]');if(button){manual=true;selectRound(button.dataset.round);}};
$('hdToday').onclick=()=>{manual=false;if(games.length)selectRound(currentRound(games));};
$('hdRefresh').onclick=()=>void load();
$('hdTeams').onclick=()=>document.querySelector('.tabs [data-tab="teamMetrics"]')?.click();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
setInterval(()=>{if(!document.hidden)void load();},300000);
void load();
})(typeof window!=='undefined'?window:globalThis);
