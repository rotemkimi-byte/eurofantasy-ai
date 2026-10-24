(()=>{
'use strict';
const U=window.UsageCore;if(!U||document.getElementById('usage'))return;
const nav=document.querySelector('.tabs'),main=document.querySelector('main');if(!nav||!main)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>U.num(v)===null?'—':Number(v).toFixed(1),pct=v=>U.num(v)===null?'—':fmt(v)+'%';
const name=n=>typeof reorderCommaName==='function'?reorderCommaName(n):n;
const team=t=>typeof canonicalTeam==='function'?canonicalTeam(t):t;
const date=d=>new Date(d).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'});
const button=document.createElement('button');button.type='button';button.dataset.tab='usage';button.textContent='מדד Usage';nav.insertBefore(button,nav.querySelector('[data-tab="data"]'));
const section=document.createElement('section');section.id='usage';section.className='tab';
section.innerHTML=`<div class="card"><div class="us-heading"><div><h3>מדד Usage</h3><p class="muted">סיומי התקפה ומעורבות כוללת · נתוני עבר בפועל</p></div><button type="button" id="usReload" class="secondary">רענן</button></div>
<div class="us-switch" role="group" aria-label="בחירת שחקנים"><button type="button" data-us-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button><button type="button" data-us-scope="team" aria-pressed="false">לפי קבוצה</button></div>
<div class="us-controls"><label id="usTeamLabel" hidden>קבוצה<select id="usTeam"></select></label><label>שחקן · מהמחיר הגבוה לנמוך<select id="usPlayer" aria-label="שחקנים לפי מחיר"></select></label><label>טווח משחקים<select id="usRange"><option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option></select></label></div>
<div class="us-switch" role="group" aria-label="סוג מדד Usage"><button type="button" data-us-metric="regular" aria-pressed="true">Usage רגיל</button><button type="button" data-us-metric="combined" aria-pressed="false">Usage כולל · אמיתי</button></div>
<p id="usMetricNote" class="muted"></p><p id="usStatus" role="status" aria-live="polite">בחר בלשונית לטעינת הנתונים.</p><div id="usResult" aria-live="polite"></div><div id="usGames"></div>
<details class="us-explain"><summary>מה ההבדל ואיך מחשבים?</summary><p><b>Usage רגיל:</b> אומדן חלקו של השחקן בסיומי ההתקפה: זריקות מהשדה, 0.44 מניסיונות העונשין ואיבודים, ביחס לאירועי הקבוצה בזמן דקותיו.</p><p><b>Usage כולל (״אמיתי״):</b> מדד המעורבות המורחב כאן מוסיף גם אסיסטים לאותו מונה. זהו מדד מותאם לאפליקציה, ואינו USG% רשמי. אסיסט וקליעה של חבר לקבוצה יכולים לתאר אותו פוזשן, ולכן זה אינו אחוז פוזשנים ייחודיים.</p><p class="us-formula">USG = 100 × (FGA + 0.44 × FTA + TOV) / exposure<br>Combined = 100 × (FGA + 0.44 × FTA + TOV + AST) / exposure<br>exposure = (player minutes / game minutes) × (team FGA + 0.44 × team FTA + team TOV)</p><p>החשיפה היא אומדן מבוקס סקור ודקות המשחק, כולל הארכות; אין כאן מדידה של זמן החזקת הכדור או נגיעות. בטווח של כמה משחקים מחברים מונים ומכנים, ולא עושים ממוצע פשוט של האחוזים. משחק ללא דקות מוצג כ״לא שיחק״. נתון חסר אינו מוחלף באפס.</p><p><a href="https://mediagamecenter.euroleague.net/" target="_blank" rel="noopener">מקור הנתונים ונוסחת ה־Usage הרגיל: EuroLeague</a> · המחירים הם המחירים העדכניים לבחירת השחקן.</p></details></div>`;
main.appendChild(section);
const $=id=>document.getElementById(id);let scope='all',metric='regular',data=null,market=null,loading=null,loadedAt=0,records=[];
function marketRows(){return market||(typeof players!=='undefined'?players:[]);}
function options(){
 const selected=$('usPlayer').value,oldTeam=$('usTeam').value,byKey=new Map();
 for(const p of marketRows())if(['G','F','C'].includes(p.pos)&&U.key(p.name))byKey.set(U.key(p.name),{...p,team:team(p.team),id:U.key(p.name),price:U.num(p.price)});
 for(const [id,p] of Object.entries(data?.players||{}))if(!byKey.has(id)){
  const latest=U.selectGames(p,'1')[0];byKey.set(id,{id,name:p.name,team:team(latest?.team)||'',price:null});
 }
 records=[...byKey.values()].sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));
 const teams=[...new Set(records.map(p=>p.team).filter(Boolean))].sort();
 $('usTeam').innerHTML=teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
 const selectedTeam=records.find(p=>p.id===selected)?.team;if(teams.includes(oldTeam))$('usTeam').value=oldTeam;else if(teams.includes(selectedTeam))$('usTeam').value=selectedTeam;
 $('usTeamLabel').hidden=scope!=='team';
 const visible=records.filter(p=>scope!=='team'||p.team===$('usTeam').value);
 $('usPlayer').innerHTML=visible.map((p,i)=>`<option value="${esc(p.id)}">${i+1}. ${esc(name(p.name))} · ${p.price===null?'מחיר לא זמין':fmt(p.price)+' cr'}</option>`).join('');
 if(visible.some(p=>p.id===selected))$('usPlayer').value=selected;
 render();
}
function table(headers,rows){return `<div class="us-table-wrap"><table class="us-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function render(){
 $('usMetricNote').textContent=metric==='regular'?'Usage רגיל: זריקות, עונשין ואיבודים.':'Usage כולל: זריקות, עונשין, איבודים וגם אסיסטים · מדד מעורבות מותאם לאפליקציה.';
 if(!data)return;
 const p=records.find(p=>p.id===$('usPlayer').value),profile=data.players[p?.id],games=U.selectGames(profile,$('usRange').value),stats=U.summarize(games),current=stats[metric];
 const updated=data.updated_at?new Date(data.updated_at).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'}):'לא ידוע';
 $('usStatus').textContent=`עונת 2026/27 · ${stats.registered} משחקים ברישום · ${stats.played} עם דקות · עודכן ${updated}${current.missing?' · חסר מדד ב־'+current.missing+' הופעות; החישוב חלקי':''}`;
 if(!p||!games.length){$('usResult').innerHTML='<p class="notice">אין עדיין נתוני משחק לשחקן שנבחר בעונה הנוכחית.</p>';$('usGames').innerHTML='';return;}
 const title=metric==='regular'?'Usage רגיל':'Usage כולל · אמיתי',reason=stats.played===0&&stats.unknownMinutes===0?'לא שיחק':current.value===null?'אין מספיק נתונים לחישוב':`${current.covered} הופעות בחישוב · ${stats.dnp?stats.dnp+' ללא דקות · ':''}${games.length>1?'משוקלל לפי החשיפה':'לפי המשחק האחרון ברישום'}`;
 $('usResult').innerHTML=`<div class="us-score"><div><b><bdi>${esc(name(p.name))}</bdi></b><small>${esc(p.team)} · ${p.price===null?'מחיר לא זמין':fmt(p.price)+' קרדיט'}</small><small>${title} · ${reason}</small></div><strong>${pct(current.value)}</strong></div>`+table(['מדד','בטווח שנבחר'],[[metric==='regular'?'Usage רגיל':'Usage כולל · עם אסיסטים',pct(current.value)],['דקות בממוצע להופעה',fmt(stats.played?stats.minutes/stats.played:null)],['זריקות מהשדה · סה״כ',fmt(stats.fga)],['ניסיונות עונשין · סה״כ',fmt(stats.fta)],['איבודים · סה״כ',fmt(stats.turnovers)],...(metric==='combined'?[['אסיסטים · סה״כ',fmt(stats.assists)]]:[])]);
 $('usGames').innerHTML='<h4>פירוט לפי משחק · מהחדש לישן</h4>'+table(['משחק','דקות',metric==='regular'?'Usage':'כולל'],games.map(g=>{const e=U.events(g);return [`<b>${esc(g.opponent)}</b><small>${date(g.date)}${g.round?' · מ׳ '+esc(g.round):''} · ${g.home===true?'בית':g.home===false?'חוץ':'מיקום לא ידוע'}</small>${g.source&&/^https:\/\//.test(g.source)?`<small><a href="${esc(g.source)}" target="_blank" rel="noopener">דוח המשחק</a></small>`:''}`,U.num(g.minutes)===0?'לא שיחק':fmt(g.minutes),pct(e[metric])]}));
}
async function load(){
 if(loading)return loading;
 $('usReload').disabled=true;$('usStatus').textContent='טוען נתוני Usage מהדוחות הרשמיים…';
 loading=(async()=>{try{
  const response=await fetch('./data/official-offense.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Usage report unavailable');
  const next=await response.json();if(next.schema!=='official-offense-v1'||next.season!=='E2026'||!next.players||typeof next.players!=='object')throw Error('Wrong Usage report');
  data=next;
  try{const r=await fetch('./data/players.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const rows=await r.json();if(Array.isArray(rows)&&rows.length)market=rows;}}catch{}
  loadedAt=Date.now();options();
 }catch(error){$('usStatus').textContent=data?'הרענון נכשל; מוצגים הנתונים שנטענו קודם.':'לא ניתן לטעון נתוני Usage כרגע. נסה ללחוץ על רענן.';}finally{$('usReload').disabled=false;loading=null;}})();return loading;
}
button.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));button.classList.add('active');section.classList.add('active');if(!data||Date.now()-loadedAt>60000)void load();else options();};
for(const b of section.querySelectorAll('[data-us-scope]'))b.onclick=()=>{scope=b.dataset.usScope;for(const item of section.querySelectorAll('[data-us-scope]'))item.setAttribute('aria-pressed',String(item===b));options();};
for(const b of section.querySelectorAll('[data-us-metric]'))b.onclick=()=>{metric=b.dataset.usMetric;for(const item of section.querySelectorAll('[data-us-metric]'))item.setAttribute('aria-pressed',String(item===b));render();};
$('usTeam').onchange=options;$('usPlayer').onchange=render;$('usRange').onchange=render;$('usReload').onclick=()=>void load();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&section.classList.contains('active')&&Date.now()-loadedAt>60000)void load();});
window.UsageUI={load};
})();
