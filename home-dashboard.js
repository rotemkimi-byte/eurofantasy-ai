/* Home fixtures use official UTC timestamps, displayed in Israel time. */
(function(root){
'use strict';
const zone='Asia/Jerusalem';
const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function fixtures(payload){
 return (payload?.data||[]).filter(g=>g.season?.code==='E2026'&&g.phaseType?.code==='RS'&&Number.isFinite(Date.parse(g.utcDate))&&g.local?.club&&g.road?.club)
  .map(g=>({...g,day:dayKey(g.utcDate)})).sort((a,b)=>Date.parse(a.utcDate)-Date.parse(b.utcDate));
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
panel.innerHTML=`<section class="card hd-fixtures" aria-labelledby="hdTitle"><div class="hd-heading"><div><span class="hd-eyebrow">EUROLEAGUE · 2026/27</span><h2 id="hdTitle">משחקי המחזור</h2></div><button id="hdRefresh" class="secondary" type="button">רענון</button></div><div class="hd-controls"><label>מחזור<select id="hdRound" aria-label="בחירת מחזור"></select></label><button class="secondary" id="hdToday" type="button">המחזור הנוכחי</button><span>שעות ישראל</span></div><p id="hdGamesStatus" class="hd-note" role="status" aria-live="polite">טוען לוח משחקים…</p><div id="hdGames"></div></section><section class="card hd-league" aria-labelledby="hdLeagueTitle"><div class="hd-heading"><h2 id="hdLeagueTitle">טבלת הליגה</h2><button class="secondary" type="button" id="hdTeams">מדד קבוצות ←</button></div><p id="hdTableStatus" class="hd-note" role="status" aria-live="polite">טוען דירוג…</p><div id="hdStandings"></div></section>`;
hero.before(panel);
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>new Date(value).toLocaleDateString('he-IL',{timeZone:zone,weekday:'long',day:'numeric',month:'numeric',year:'numeric'});
const time=value=>new Date(value).toLocaleTimeString('he-IL',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false});
let games=[],busy=false,manual=false;
function club(c){return typeof canonicalTeam==='function'?canonicalTeam(c.name):c.abbreviatedName||c.name;}
function renderGames(){
 const selected=Number($('hdRound').value),rows=games.filter(g=>g.round===selected),days=[...new Set(rows.map(g=>g.day))],today=dayKey(Date.now());
 const halfway=Math.max(...games.map(g=>g.round))/2;
 $('hdGamesStatus').textContent=`מחזור ${selected} · סיבוב ${selected<=halfway?'ראשון':'שני'} של העונה · ${rows.length} משחקים`;
 $('hdGames').innerHTML=days.map((day,i)=>{
  const list=rows.filter(g=>g.day===day),label=i===0?'ראשון':i===1?'שני':String(i+1);
  return `<section class="hd-day"><h3><span>${day===today?'היום · ':''}${date(list[0].utcDate)}</span><small>יום ${label} של המחזור</small></h3><table class="hd-games-table"><thead><tr><th>שעה</th><th>בית</th><th>חוץ</th><th>תוצאה</th></tr></thead><tbody>${list.map(g=>`<tr><td><time datetime="${esc(g.utcDate)}">${g.confirmedHour===false?'טרם נקבעה':time(g.utcDate)}</time></td><td>${esc(club(g.local.club))}</td><td>${esc(club(g.road.club))}</td><td>${g.played?`<bdi>${g.local.score}–${g.road.score}</bdi>`:'—'}</td></tr>`).join('')}</tbody></table></section>`;
 }).join('')||'<p class="hd-note">אין משחקים זמינים למחזור הזה.</p>';
}
async function json(path){const r=await fetch(path+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Data unavailable');return r.json();}
async function loadGames(){
 try{
  const next=fixtures(await json('./data/context/E2026-schedule.json'));if(!next.length)throw Error('No fixtures');
  const old=Number($('hdRound').value);games=next;
  const rounds=[...new Set(games.map(g=>g.round))].sort((a,b)=>a-b);
  $('hdRound').replaceChildren(...rounds.map(r=>new Option('מחזור '+r,r)));
  $('hdRound').value=manual&&rounds.includes(old)?old:currentRound(games);renderGames();
 }catch{ $('hdGamesStatus').textContent=games.length?'הרענון נכשל · מוצג הלוח הקודם':'לוח המשחקים לא נטען. לחץ על רענון.'; }
}
async function loadTable(){
 try{
  const data=await json('./data/official-offense.json');if(data.season!=='E2026')throw Error('Wrong season');
  const report=root.TeamMetricsCore.build(data);if(!report.teams.length)throw Error('No standings');
  $('hdTableStatus').textContent=`${report.official?'דירוג רשמי':'דירוג מחושב לפי מאזן והפרש נקודות'} · עודכן ${new Date(data.updated_at).toLocaleString('he-IL',{timeZone:zone,day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}`;
  $('hdStandings').innerHTML=`<table class="hd-standings-table"><thead><tr><th>מקום</th><th>קבוצה</th><th>מש׳</th><th>ניצ׳</th><th>הפ׳</th></tr></thead><tbody>${report.teams.map(t=>`<tr><td><span class="hd-rank">${t.rank}</span></td><td>${esc(t.team)}</td><td>${t.played}</td><td>${t.wins}</td><td>${t.losses}</td></tr>`).join('')}</tbody></table>`;
 }catch{ $('hdTableStatus').textContent=$('hdStandings').children.length?'הרענון נכשל · מוצגת הטבלה הקודמת':'טבלת הדירוג לא נטענה. לחץ על רענון.'; }
}
async function load(){if(busy)return;busy=true;$('hdRefresh').disabled=true;await Promise.allSettled([loadGames(),loadTable()]);busy=false;$('hdRefresh').disabled=false;}
$('hdRound').onchange=()=>{manual=true;renderGames();};
$('hdToday').onclick=()=>{manual=false;if(games.length){$('hdRound').value=currentRound(games);renderGames();}};
$('hdRefresh').onclick=()=>void load();
$('hdTeams').onclick=()=>document.querySelector('.tabs [data-tab="teamMetrics"]')?.click();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
setInterval(()=>{if(!document.hidden)void load();},300000);
void load();
})(typeof window!=='undefined'?window:globalThis);
