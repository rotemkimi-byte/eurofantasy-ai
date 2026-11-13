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
<div class="player-picker-modes" role="group" aria-label="בחירת רשימת שחקנים"><button type="button" data-us-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button><button type="button" data-us-scope="team" aria-pressed="false">לפי קבוצה</button></div><div class="player-picker-controls"><label id="usTeamLabel" hidden>קבוצה<select id="usTeam"></select></label></div>
<div class="us-controls"><label>עמדה<select id="usPosition"><option value="">כל העמדות</option><option value="G">גארדים · G</option><option value="F">פורוורדים · F</option><option value="C">סנטרים · C</option></select></label><label>טווח משחקים<select id="usRange"><option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה</option></select></label></div>
<div class="us-view-picker player-result-picker">
<label class="player-picker-controls">שחקן · מהמחיר הגבוה לנמוך<select id="usPlayer"></select></label>
<div class="us-switch" role="group" aria-label="תצוגת Usage">
<button type="button" data-us-view="regular" data-us-metric aria-pressed="true" aria-controls="usSummaryPanel">Usage רגיל</button>
<button type="button" data-us-view="combined" aria-pressed="false" aria-controls="usSummaryPanel">Usage כולל · אמיתי</button>
<button type="button" data-us-view="games" aria-pressed="false" aria-controls="usGamesPanel">פירוט לפי משחק</button>
<button type="button" data-us-view="ranking" aria-pressed="false" aria-controls="usRankingPanel">טבלה כללית</button>
<button type="button" data-us-view="compare" aria-pressed="false" aria-controls="usComparePanel">השוואה</button>
</div></div>

<p id="usStatus" role="status" aria-live="polite">בחר בלשונית לטעינת הנתונים.</p>
<div id="usSummaryPanel"><div id="usResult" class="player-result-summary" aria-live="polite"></div><p id="usMetricNote" class="muted"></p></div>
<div id="usGamesPanel" hidden><h4 id="usGamesTitle"></h4><div id="usGames" class="us-games"></div></div>
<div id="usRankingPanel" hidden><div class="pa-sort" role="group" aria-label="סדר הטבלה"><button type="button" data-us-sort="metric" aria-pressed="true">לפי המדד ↓</button><button type="button" data-us-sort="price" aria-pressed="false">לפי קרדיט ↓</button></div><div class="pa-controls"><label>קרדיט מקסימלי<select id="usCreditCap"><option value="">ללא הגבלה</option>${[5,7,9,12,15].map(n=>`<option value="${n}">עד ${n} CR</option>`).join('')}</select></label></div><h4 id="usRankingTitle">דירוג Usage · מהגבוה לנמוך</h4><p id="usRankingNote" class="muted"></p><div id="usRanking"></div></div>
<div id="usComparePanel" class="pa-panel" hidden></div>
<details class="us-explain"><summary>מה ההבדל ואיך מחשבים?</summary><p><b>Usage רגיל:</b> אומדן חלקו של השחקן בסיומי ההתקפה: זריקות מהשדה, 0.44 מניסיונות העונשין ואיבודים, ביחס לאירועי הקבוצה בזמן דקותיו.</p><p><b>Usage כולל (״אמיתי״):</b> מדד המעורבות המורחב כאן מוסיף גם אסיסטים לאותו מונה. זהו מדד מותאם לאפליקציה, ואינו USG% רשמי. אסיסט וקליעה של חבר לקבוצה יכולים לתאר אותו פוזשן, ולכן זה אינו אחוז פוזשנים ייחודיים.</p><p class="us-formula">USG = 100 × (FGA + 0.44 × FTA + TOV) / exposure<br>Combined = 100 × (FGA + 0.44 × FTA + TOV + AST) / exposure<br>exposure = (player minutes / game minutes) × (team FGA + 0.44 × team FTA + team TOV)</p><p>החשיפה היא אומדן מבוקס סקור ודקות המשחק, כולל הארכות; אין כאן מדידה של זמן החזקת הכדור או נגיעות. בטווח של כמה משחקים מחברים מונים ומכנים, ולא עושים ממוצע פשוט של האחוזים. משחק ללא דקות מוצג כ״לא שיחק״. נתון חסר אינו מוחלף באפס.</p><p><a href="https://mediagamecenter.euroleague.net/" target="_blank" rel="noopener">מקור הנתונים ונוסחת ה־Usage הרגיל: EuroLeague</a> · המחירים הם המחירים העדכניים לבחירת השחקן.</p></details></div>`;
main.appendChild(section);
const $=id=>document.getElementById(id);let scope='all',metric='regular',view='regular',data=null,market=null,loading=null,loadedAt=0,records=[],rankingSort='metric';
const comparison=window.PlayerAnalysis.create($('usComparePanel'),{
 marketStyle:true,
 metrics:{regular:'Usage רגיל',combined:'Usage כולל · אמיתי'},
 rows:()=>data?records.map(p=>{
  const s=U.summarize(U.selectGames(data.players[p.id],$('usRange').value));
  return {...p,name:name(p.name),values:{regular:s.regular.value,combined:s.combined.value}};
 }):[],format:pct
});
function marketRows(){return market||(typeof players!=='undefined'?players:[]);}
function rememberPlayer(){
 window.playerToolSelection?.set(records.find(p=>p.id===$('usPlayer').value)?.name,$('usRange').value);
}
function restorePlayer(){
 const shared=window.playerToolSelection?.find(records);
 if(!shared)return;
 const select=$('usPlayer');
 if(![...select.options].some(o=>o.value===shared.row.id))return;
 select.value=shared.row.id;
 if(shared.range)$('usRange').value=shared.range;
 render();
}
function options(){
 const selected=$('usPlayer').value,oldTeam=$('usTeam').value,byKey=new Map();
 for(const p of marketRows())if(['G','F','C'].includes(p.pos)&&U.key(p.name))byKey.set(U.key(p.name),{...p,team:team(p.team),id:U.key(p.name),price:U.num(p.price)});
 for(const [id,p] of Object.entries(data?.players||{}))if(!byKey.has(id)){
  const latest=U.selectGames(p,'1')[0];byKey.set(id,{id,name:p.name,team:team(latest?.team)||'',price:null,pos:({1:'G',2:'F',3:'C'})[latest?.position]||''});
 }
 records=[...byKey.values()].sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));
 const teams=[...new Set(records.map(p=>p.team).filter(Boolean))].sort();
 $('usTeam').innerHTML=teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
 const selectedTeam=records.find(p=>p.id===selected)?.team;if(teams.includes(oldTeam))$('usTeam').value=oldTeam;else if(teams.includes(selectedTeam))$('usTeam').value=selectedTeam;
 $('usTeamLabel').hidden=scope!=='team';

 render();
}
function clubKit(t){return (typeof TEAM_KITS==='undefined'?null:TEAM_KITS[t])||['—','#536783','#fff'];}
function clubCrest(t){return typeof playerCardCrests==='undefined'?null:playerCardCrests.get(t);}
function image(url){return url?`<img src="${esc(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'';}
function portrait(p){
 const media=typeof playerCardProfile==='function'?playerCardProfile(p):null;
 const photo=typeof playerCardImageUrl==='function'?playerCardImageUrl(media?.photo):null;
 return `<span class="us-portrait" aria-hidden="true" style="--us-club:${clubKit(p.team)[1]}">${typeof squadJersey==='function'?squadJersey(p):''}${image(photo)}</span>`;
}
function meter(value,max=100){
 return value===null?'':`<span class="us-meter" aria-hidden="true"><i style="--us-fill:${Math.max(0,Math.min(100,value/max*100))}%"></i></span>`;
}
function gameCard(g){
 const opponent=team(g.opponent)||'יריבה לא זמינה';
 const [abbr,color,ink]=clubKit(opponent);
 const value=U.events(g)[metric],minutes=U.num(g.minutes);
 const venue=g.home===true?'בית':g.home===false?'חוץ':'מיקום לא ידוע';
 const report=g.source&&/^https:\/\//.test(g.source)?`<a href="${esc(g.source)}" target="_blank" rel="noopener">דוח המשחק <span aria-hidden="true">↗</span></a>`:'';
 return `<article class="us-game" style="--us-club:${color};--us-ink:${ink}">
  <div class="us-game-opponent"><span class="us-crest" aria-hidden="true"><bdi>${esc(abbr)}</bdi>${image(clubCrest(opponent))}</span>
   <div><b><bdi>${esc(opponent)}</bdi></b><small><bdi>${date(g.date)}</bdi>${g.round?' · מחזור '+esc(g.round):''}</small></div>
  </div>
  <div class="us-game-stats"><span>${minutes===0?'לא שיחק':`<bdi>${fmt(minutes)}</bdi> דק׳`}</span>
   <div class="us-value"><span>${metric==='regular'?'Usage':'Usage כולל'}</span><strong><bdi>${pct(value)}</bdi></strong>${meter(value)}</div>
  </div>
  <div class="us-game-meta"><span class="us-venue" data-home="${g.home===true}">${venue}</span>${report}</div>
 </article>`;
}
function renderRanking(){
 const selected=$('usPlayer').value;
 if(!data)return;
 const eligiblePlayers=U.rankPlayers(records,data.players,{team:scope==='team'?$('usTeam').value:'',position:$('usPosition').value,range:$('usRange').value,metric});
 const cap=Number($('usCreditCap').value);
 const ranked=eligiblePlayers.filter(p=>!cap||(p.price!==null&&p.price<=cap));
 if(rankingSort==='price')ranked.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));
 const available=ranked.filter(p=>p.value!==null),missing=ranked.length-available.length;
 $('usRankingTitle').textContent=(scope==='team'?'השוואה בתוך '+$('usTeam').value:'דירוג כל הליגה')+' · '+metricTitle()+(rankingSort==='metric'?' מהגבוה לנמוך':' · מיון לפי קרדיט');
 $('usRankingNote').textContent=`${available.length} שחקנים עם מדד${missing?' · '+missing+' ללא מדד':''}`;
 const eligible=new Set(eligiblePlayers.map(p=>p.id));
 $('usPlayer').innerHTML=records.filter(p=>eligible.has(p.id)).map((p,i)=>`<option value="${esc(p.id)}">${i+1}. ${esc(name(p.name))} · ${p.price===null?'מחיר לא זמין':fmt(p.price)+' cr'}</option>`).join('');
 $('usPlayer').disabled=!eligible.size;
 if(eligible.has(selected))$('usPlayer').value=selected;
 const max=Math.max(1,...available.map(p=>p.value));
 $('usRanking').innerHTML=ranked.length?`<div class="us-table-wrap us-ranking-wrap"><table class="us-table us-ranking"><caption class="us-sr-only">${esc($('usRankingTitle').textContent)}</caption><colgroup><col class="us-rank-col"><col class="us-name-col"><col class="us-value-col"><col class="us-min-col"><col class="us-games-col"></colgroup><thead><tr><th scope="col">#</th><th scope="col">שחקן / קבוצה</th><th scope="col" ${rankingSort==='metric'?'aria-sort="descending"':''}>${metric==='regular'?'Usage':'Usage כולל'}${rankingSort==='metric'?' ↓':''}</th><th scope="col">דק׳ ממוצע</th><th scope="col">הופעות בחישוב</th></tr></thead><tbody>${ranked.map((p,i)=>{
  const current=p.stats[metric],smallSample=current.covered>0&&current.covered<3;
  const selected=p.id===$('usPlayer').value;
  const minutes=p.stats.played&&p.stats.minutes!==null?p.stats.minutes/p.stats.played:null;
  const coverage=smallSample?'מדגם קטן':p.value===null?(p.stats.dnp&&!p.stats.played?'לא שיחק':'אין מדד זמין'):'';
  return `<tr data-us-row="${esc(p.id)}" class="${selected?'us-selected':''}">
   <td><span class="us-rank">${p.value===null?'—':i+1}</span></td>
   <td><button type="button" class="us-player-link" data-us-player="${esc(p.id)}" aria-pressed="${selected}">
    ${portrait(p)}<span class="us-ranking-identity"><bdi>${esc(name(p.name))}</bdi><small>${esc(p.team)} · ${esc(p.pos||'עמדה לא ידועה')}${p.price===null?'':' · '+fmt(p.price)+' CR'}</small></span>
   </button></td>
   <td><strong dir="ltr">${pct(p.value)}</strong>${meter(p.value,max)}${current.missing?'<small>חלקי</small>':''}</td>
   <td><bdi>${fmt(minutes)}</bdi></td>
   <td>${current.covered}${coverage?`<small>${esc(coverage)}</small>`:''}</td>
  </tr>`;
 }).join('')}</tbody></table></div>`:'<p class="notice">אין שחקנים בקבוצה ובעמדה שנבחרו.</p>';
}
function highlightSelection(){
 for(const row of $('usRanking').querySelectorAll('[data-us-row]')){
  const active=row.dataset.usRow===$('usPlayer').value;
  row.classList.toggle('us-selected',active);row.querySelector('button').setAttribute('aria-pressed',String(active));
 }
}
const metricTitle=()=>metric==='regular'?'Usage רגיל':'Usage כולל · אמיתי';
const viewButtons=section.querySelectorAll('[data-us-view]');
function showView(next){
 view=next;
 $('usSummaryPanel').hidden=view==='games'||view==='ranking'||view==='compare';
 $('usGamesPanel').hidden=view!=='games';
 $('usRankingPanel').hidden=view!=='ranking';
 $('usComparePanel').hidden=view!=='compare';
 comparison.show(view==='compare'?'compare':'detail');
 for(const button of viewButtons){
  button.setAttribute('aria-pressed',String(button.dataset.usView===view));
  button.toggleAttribute('data-us-metric',button.dataset.usView===metric);
 }
}
function render(updateRanking=true){
 $('usMetricNote').textContent=metric==='regular'?'Usage רגיל: זריקות, עונשין ואיבודים.':'Usage כולל: זריקות, עונשין, איבודים וגם אסיסטים · מדד מעורבות מותאם לאפליקציה.';
 if(!data)return;
 if(updateRanking)renderRanking();
 comparison.render();
 const p=records.find(p=>p.id===$('usPlayer').value),profile=data.players[p?.id],games=U.selectGames(profile,$('usRange').value),stats=U.summarize(games),current=stats[metric];
 const updated=data.updated_at?new Date(data.updated_at).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'}):'לא ידוע';
 $('usStatus').textContent=`עודכן ${updated}${view!=='ranking'&&view!=='compare'&&current.missing?' · נתונים חלקיים ב־'+current.missing+' הופעות':''}`;
 $('usGamesTitle').textContent='משחקים · '+metricTitle();
 if(!p||!games.length){$('usResult').innerHTML='<p class="notice">אין עדיין נתוני משחק לשחקן שנבחר בעונה הנוכחית.</p>';$('usGames').innerHTML='<p class="notice">אין משחקים זמינים לשחקן ולטווח שנבחרו.</p>';return;}
 const reason=stats.played===0&&stats.unknownMinutes===0?'לא שיחק':current.value===null?'אין מספיק נתונים לחישוב':`${current.covered} הופעות בחישוב · ${stats.dnp?stats.dnp+' ללא דקות · ':''}${games.length>1?'משוקלל לפי החשיפה':'לפי המשחק האחרון ברישום'}`;
 const metrics=[
  ['דקות בממוצע להופעה',stats.played&&stats.minutes!==null?stats.minutes/stats.played:null],
  ['זריקות מהשדה · סה״כ',stats.fga],
  ['ניסיונות עונשין · סה״כ',stats.fta],
  ['איבודים · סה״כ',stats.turnovers],
  ...(metric==='combined'?[['אסיסטים · סה״כ',stats.assists]]:[])
 ];
 const [,color,ink]=clubKit(p.team);
 $('usResult').innerHTML=`<article class="us-player-card" style="--us-club:${color};--us-ink:${ink}">
  <div class="us-score">
   ${portrait(p)}
   <div class="us-identity"><b><bdi>${esc(name(p.name))}</bdi></b>
    <span class="us-club">${image(clubCrest(p.team))}<bdi>${esc(p.team||'קבוצה לא זמינה')}</bdi></span>
    <span class="us-player-meta">${p.pos?`<bdi>${esc(p.pos)}</bdi>`:''}${p.price===null?'':`<bdi>${fmt(p.price)} CR</bdi>`}</span>
   </div>
   <div class="us-value"><span>${metricTitle()}</span><strong><bdi>${pct(current.value)}</bdi></strong>${meter(current.value)}</div>
  </div>
  <dl class="us-metrics">${metrics.map(([label,n])=>`<div><dt>${label}</dt><dd><bdi>${fmt(n)}</bdi></dd></div>`).join('')}</dl>
  <div class="us-sample">${esc(reason)}</div>
 </article>`;
 $('usGames').innerHTML=games.map(gameCard).join('');
}
async function load(force=false){
 if(loading)return loading;
 $('usReload').disabled=true;$('usStatus').textContent='טוען נתוני Usage מהדוחות הרשמיים…';
 loading=(async()=>{try{
  const next=await (window.loadGameData?window.loadGameData('official-offense.json',force):(async()=>{const response=await fetch('./data/official-offense.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Usage report unavailable');
  const next=await response.json();return next;})());if(next.schema!=='official-offense-v1'||next.season!=='E2026'||!next.players||typeof next.players!=='object')throw Error('Wrong Usage report');
  data=next;
  try{const r=await fetch('./data/players.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const rows=await r.json();if(Array.isArray(rows)&&rows.length)market=rows;}}catch{}
  loadedAt=Date.now();options();if(section.classList.contains('active'))restorePlayer();
 }catch(error){$('usStatus').textContent=data?'הרענון נכשל; מוצגים הנתונים שנטענו קודם.':'לא ניתן לטעון נתוני Usage כרגע. נסה ללחוץ על רענן.';}finally{$('usReload').disabled=false;loading=null;}})();return loading;
}
button.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));button.classList.add('active');section.classList.add('active');if(!data||Date.now()-loadedAt>60000)void load();else{options();restorePlayer();}};
for(const b of section.querySelectorAll('[data-us-scope]'))b.onclick=()=>{scope=b.dataset.usScope;for(const item of section.querySelectorAll('[data-us-scope]'))item.setAttribute('aria-pressed',String(item===b));options();};
for(const b of viewButtons)b.onclick=()=>{
 const next=b.dataset.usView;
 const changed=(next==='regular'||next==='combined')&&metric!==next;
 if(changed)metric=next;
 showView(next);
 render(changed);
};
function selectPlayer(){
 rememberPlayer();render(false);
 highlightSelection();
}
$('usRanking').onclick=e=>{
 const target=e.target.closest('[data-us-player]');if(!target)return;
 $('usPlayer').value=target.dataset.usPlayer;
 showView(metric);
 selectPlayer();
 $('usPlayer').focus({preventScroll:true});
 const result=$('usResult').getBoundingClientRect(),picker=$('usPlayer').closest('.us-view-picker').getBoundingClientRect();
 if(result.top<picker.bottom||result.top>=window.innerHeight)scrollBy(0,result.top-picker.bottom-8);
};
const sortButtons=section.querySelectorAll('[data-us-sort]');
for(const b of sortButtons)b.onclick=()=>{
 rankingSort=b.dataset.usSort;
 for(const item of sortButtons)item.setAttribute('aria-pressed',String(item===b));
 renderRanking();
};
$('usCreditCap').onchange=renderRanking;
$('usPosition').onchange=()=>render();$('usTeam').onchange=options;$('usPlayer').onchange=selectPlayer;$('usRange').onchange=()=>{rememberPlayer();render();};$('usReload').onclick=()=>void load(true);
section.addEventListener('error',event=>{if(event.target.matches('img'))event.target.remove();},true);
document.addEventListener('fantasy-player-media-ready',()=>render());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&section.classList.contains('active')&&Date.now()-loadedAt>60000)void load();});
window.UsageUI={load};
})();
