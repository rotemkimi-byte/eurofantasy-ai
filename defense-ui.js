(()=>{
'use strict';
const U=window.UsageCore,D=window.DefenseCore;if(!U||!D||document.getElementById('defense'))return;
const nav=document.querySelector('.tabs'),main=document.querySelector('main');if(!nav||!main)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>U.num(v)===null?'—':Number(v).toFixed(1),name=n=>typeof reorderCommaName==='function'?reorderCommaName(n):n,team=t=>typeof canonicalTeam==='function'?canonicalTeam(t):t;
const labels={stocks:'Stocks · חטיפות + חסימות',stl:'STL% · אחוז חטיפות',blk:'BLK% · אחוז חסימות',reb:'REB% · אחוז ריבאונד',orb:'OREB% · ריבאונד התקפה',drb:'DREB% · ריבאונד הגנה',per:'PER · יעילות מותאמת'};
const button=document.createElement('button');button.type='button';button.dataset.tab='defense';button.textContent='מדדי הגנה וריבאונד';const usage=nav.querySelector('[data-tab="usage"]');nav.insertBefore(button,usage?usage.nextSibling:nav.querySelector('[data-tab="data"]'));
const section=document.createElement('section');section.id='defense';section.className='tab';
section.innerHTML=`<div class="card"><div class="us-heading"><div><h3>הגנה, ריבאונד ו־PER</h3><p class="muted">ביצועים בפועל ומדדים ביחס לדקות המשחק</p></div><button type="button" id="dfReload" class="secondary">רענן</button></div>
<div class="us-switch" role="group" aria-label="בחירת שחקנים"><button type="button" data-df-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button><button type="button" data-df-scope="team" aria-pressed="false">לפי קבוצה</button></div>
<div class="us-controls"><label id="dfTeamLabel" hidden>קבוצה<select id="dfTeam"></select></label><label>שחקן · מהמחיר הגבוה לנמוך<select id="dfPlayer"></select></label><label>טווח משחקים<select id="dfRange"><option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option></select></label><label>מדד לפירוט לפי משחק<select id="dfMetric">${Object.entries(labels).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label></div>
<p id="dfStatus" role="status" aria-live="polite">בחר בלשונית לטעינת הנתונים.</p><div id="dfResult" aria-live="polite"></div><div id="dfGames"></div>
<details class="us-explain"><summary>הסבר המדדים והנוסחאות</summary><p><b>STL%:</b> חטיפות מתוך אומדן פוזשני היריבה בזמן דקות השחקן. פוזשנים נאמדים כזריקות מהשדה + 0.44 × זריקות עונשין − ריבאונד התקפה + איבודים.</p><p><b>BLK%:</b> חסימות ביחס לניסיונות היריבה לשתי נקודות בזמן דקות השחקן. המונה הוא מספר החסימות שנרשם, גם כשאין מידע על מרחק הזריקה שנחסמה.</p><p><b>Stocks:</b> חטיפות + חסימות. בטווח מרובה משחקים מוצגים הממוצע להופעה והסכום הכולל.</p><p><b>REB%:</b> ריבאונדים ביחס לסך ריבאונדי הקבוצה והיריבה. <b>OREB%:</b> ריבאונד התקפה ביחס לריבאונדי ההתקפה של הקבוצה וההגנה של היריבה. <b>DREB%:</b> ריבאונד הגנה ביחס לריבאונדי ההגנה של הקבוצה וההתקפה של היריבה. המכנים מותאמים לחלקו של השחקן בדקות המשחק, כולל הארכות; אלה אומדני בוקס סקור, לא ספירה מדויקת של הזדמנויות כשהוא על המגרש.</p><p><b>PER:</b> חישוב נוסחת Hollinger/Basketball Reference עם נתוני עונת היורוליג הנוכחית, התאמת קצב לפי אומדן הפוזשנים ותקנון ממוצע משוקלל בדקות ל־15 במדגם הזמין. זהו חישוב של האפליקציה, לא PER רשמי ולא PIR. במשחק יחיד משתמשים בקבועי העונה הנוכחיים; נתוני עבר עשויים להשתנות עם עדכון המדגם. מדד זה כולל גם התקפה, ואינו מדד הגנתי בלבד.</p><p>בטווח של כמה משחקים אחוזים משוקללים לפי ההזדמנויות המשוערות ו־PER משוקלל לפי דקות. נתון חסר נשאר חסר. משחק ללא דקות אינו נכלל בממוצעי ההופעות.</p><p><a href="https://www.basketball-reference.com/about/glossary.html" target="_blank" rel="noopener">הגדרות אחוזי ההגנה והריבאונד</a> · <a href="https://www.basketball-reference.com/about/per.html" target="_blank" rel="noopener">נוסחת PER</a> · <a href="https://mediagamecenter.euroleague.net/" target="_blank" rel="noopener">מקור הנתונים: EuroLeague</a></p></details></div>`;
main.appendChild(section);const $=id=>document.getElementById(id);let scope='all',data=null,env=null,market=null,records=[],loading=null,loadedAt=0;
function options(){
 const selected=$('dfPlayer').value,old=$('dfTeam').value,byKey=new Map(),pool=market||(typeof players!=='undefined'?players:[]);
 for(const p of pool)if(['G','F','C'].includes(p.pos)&&U.key(p.name))byKey.set(U.key(p.name),{...p,id:U.key(p.name),team:team(p.team),price:U.num(p.price)});
 for(const [id,p] of Object.entries(data?.players||{}))if(!byKey.has(id))byKey.set(id,{id,name:p.name,team:team(U.selectGames(p,'1')[0]?.team)||'',price:null});
 records=[...byKey.values()].sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));
 const teams=[...new Set(records.map(p=>p.team).filter(Boolean))].sort();$('dfTeam').innerHTML=teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(teams.includes(old))$('dfTeam').value=old;
 $('dfTeamLabel').hidden=scope!=='team';const list=records.filter(p=>scope!=='team'||p.team===$('dfTeam').value);
 $('dfPlayer').innerHTML=list.map((p,i)=>`<option value="${esc(p.id)}">${i+1}. ${esc(name(p.name))} · ${p.price===null?'מחיר לא זמין':fmt(p.price)+' cr'}</option>`).join('');if(list.some(p=>p.id===selected))$('dfPlayer').value=selected;render();
}
function table(headers,rows){return `<div class="us-table-wrap"><table class="us-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
const value=(metric,n)=>fmt(n)+(n!==null&&['stl','blk','reb','orb','drb'].includes(metric)?'%':'');
function render(){
 if(!data)return;const p=records.find(p=>p.id===$('dfPlayer').value),games=U.selectGames(data.players[p?.id],$('dfRange').value),metric=$('dfMetric').value||'stocks',s=D.summarize(games,data,env);
 $('dfStatus').textContent=`עונת 2026/27 · ${games.length} משחקים ברישום · ${s.played} עם דקות · בסיס PER: ${env.games} משחקים · עודכן ${new Date(data.updated_at).toLocaleString('he-IL',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'})}`;
 if(!p||!games.length){$('dfResult').innerHTML='<p class="notice">אין נתוני משחק לשחקן בעונה הנוכחית.</p>';$('dfGames').innerHTML='';return;}
 const stocks=s.stocks!==null&&s.played?s.stocks/s.played:null,selected=metric==='stocks'?stocks:s[metric].value;
 const counts={stl:s.steals,blk:s.blocks,reb:s.rebounds,orb:s.offensiveRebounds,drb:s.defensiveRebounds,stocks:s.stocks};
 $('dfResult').innerHTML=`<div class="us-score"><div><b><bdi>${esc(name(p.name))}</bdi></b><small>${esc(p.team)} · ${fmt(p.price)} קרדיט</small><small>${labels[metric]}${metric==='stocks'?' · ממוצע להופעה':''}</small></div><strong>${value(metric,selected)}</strong></div>`+table(['מדד','ערך בטווח','סה״כ'],Object.entries(labels).map(([k,label])=>[esc(label)+(k==='stocks'?'<small>ממוצע להופעה</small>':k==='per'?'<small>ממוצע המדגם: 15</small>':''),value(k,k==='stocks'?stocks:s[k].value)+(k!=='stocks'&&s[k].missing?'<small>נתונים חלקיים</small>':''),k==='per'?'—':fmt(counts[k])]))+'<p class="muted">האחוזים הם אומדנים מבוקס סקור ודקות. PER מחושב במדגם היורוליג הזמין.</p>';
 $('dfGames').innerHTML='<h4>פירוט לפי משחק · מהחדש לישן</h4>'+table(['משחק','דקות',labels[metric].split(' · ')[0]],games.map(g=>{const m=D.gameMetrics(g,data,env),v=U.num(g.minutes)>0?(metric==='stocks'?m.stocks:metric==='per'?m.per:m[metric].value):null;return [`<b>${esc(g.opponent)}</b><small>${new Date(g.date).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'})}${g.round?' · מ׳ '+esc(g.round):''}</small>`,U.num(g.minutes)===0?'לא שיחק':fmt(g.minutes),value(metric,v)];}));
}
async function load(){
 if(loading)return loading;$('dfReload').disabled=true;$('dfStatus').textContent='טוען חטיפות, חסימות, ריבאונדים ו־PER…';
 loading=(async()=>{try{
  const r=await fetch('./data/official-offense.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Missing report');const next=await r.json();
  if(next.season!=='E2026'||next.schema!=='official-offense-v1'||next.defenseVersion!==1||!next.teamGames)throw Error('Awaiting defensive data');
  const nextEnv=D.environment(next);data=next;env=nextEnv;
  try{const r=await fetch('./data/players.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const d=await r.json();if(Array.isArray(d)&&d.length)market=d;}}catch{}
  loadedAt=Date.now();options();
 }catch(error){$('dfStatus').textContent=data?'הרענון נכשל; מוצגים הנתונים הקודמים.':'נתוני המדדים עדיין לא זמינים. נסה לרענן לאחר סיום הסנכרון.';}finally{$('dfReload').disabled=false;loading=null;}})();return loading;
}
button.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));button.classList.add('active');section.classList.add('active');if(!data||Date.now()-loadedAt>60000)void load();else options();};
for(const b of section.querySelectorAll('[data-df-scope]'))b.onclick=()=>{scope=b.dataset.dfScope;for(const item of section.querySelectorAll('[data-df-scope]'))item.setAttribute('aria-pressed',String(item===b));options();};
$('dfPlayer').onchange=render;$('dfRange').onchange=render;$('dfMetric').onchange=render;$('dfTeam').onchange=options;$('dfReload').onclick=()=>void load();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&section.classList.contains('active')&&Date.now()-loadedAt>60000)void load();});window.DefenseUI={load};
})();
