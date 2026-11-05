(()=>{
'use strict';
const C=window.AdvancedPlayerCore;if(!C)return;
const tools=[['playerNegative','פעולות שליליות','negative'],['playerShots','מפת זריקות','shots'],['playerPlusMinus','פלוס־מינוס','plus'],['playerLineups','הרכבי קליעה','lineups'],['playerAttacks','סוגי התקפות','attacks']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('he-IL',{maximumFractionDigits:1});
const date=s=>new Date(s).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'});
const name=s=>String(s||'').includes(',')?s.split(',').reverse().map(x=>x.trim()).join(' '):s;
const empty=s=>'<p class="ap-empty">'+esc(s)+'</p>';
const metric=(label,value,note='')=>'<div class="ap-metric"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span><small>'+esc(note)+'</small></div>';
const note=(count,total)=>count+' מתוך '+total+' הופעות עם נתון מאומת';
let data=null,pending=null;
async function load(force){
 if(data&&!force)return data;
 if(pending)return pending;
 pending=(async()=>{const r=await fetch('./data/advanced-players.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.season!=='E2026'||d.schema!=='advanced-players-v1')throw Error('Wrong season');data=d;return d;})().finally(()=>pending=null);return pending;
}
function profiles(){
 const map=new Map();
 for(const g of Object.values(data.games))for(const p of Object.values(g.players)){
  let r=map.get(p.id);if(!r){r={id:p.id,name:name(p.name),games:[]};map.set(p.id,r);}
  r.games.push({...p,gameCode:g.gameCode,date:g.date,round:g.round});
 }
 for(const p of map.values()){p.games=C.select(p.games,0);p.team=p.games[0]?.team||'';}
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function negative(games){
 const s=C.negative(games),labels={turnovers:'איבודים',miss2:'החטאות ל־2',miss3:'החטאות ל־3',missFT:'החטאות עונשין',fouls:'עבירות שביצע',blocked:'זריקות שנחסמו'};
 return '<div class="ap-metrics">'+Object.entries(labels).map(([k,l])=>metric(l+' למשחק',fmt(s[k].mean),'סה״כ '+fmt(s[k].total)+' · '+note(s[k].covered,games.length))).join('')+'</div>';
}
function plus(games){
 const s=C.plus(games);return '<p class="ap-status">'+note(s.covered,games.length)+'</p><div class="ap-metrics">'+metric('פלוס־מינוס מצטבר',fmt(s.total))+metric('ממוצע למשחק',fmt(s.mean))+metric('ל־40 דקות',fmt(s.per40))+metric('דקות במדגם',fmt(s.minutes))+'</div>';
}
function shots(games,filter){
 const covered=games.filter(g=>g.shotCoverage),all=covered.flatMap(g=>g.shots).filter(s=>!s.type.startsWith('FT'));
 const shown=all.filter(s=>filter==='all'||(filter==='made'?s.made:!s.made)),coords=shown.filter(s=>s.x!==null&&s.y!==null);
 if(!covered.length)return empty('אין מפת זריקות מאומתת בטווח שנבחר. בחר משחק אחר או טווח רחב יותר.');
 const long=coords.some(s=>s.y>1242.5),height=long?2800:1400;
 const dots=coords.map(s=>{const x=s.x+750,y=s.y+157.5,title=esc((s.made?'קליעה':'החטאה')+' · '+(s.type.startsWith('3')?'3':'2')+' נק׳');return s.made?'<circle cx="'+x+'" cy="'+y+'" r="17" fill="#087748" stroke="#fff" stroke-width="5"><title>'+title+'</title></circle>':'<path d="M'+(x-14)+' '+(y-14)+'l28 28m0 -28l-28 28" stroke="#c32733" stroke-width="10"><title>'+title+'</title></path>';}).join('');
 const court='<svg class="ap-court" viewBox="0 0 1500 '+height+'" role="img" aria-label="מפת זריקות: עיגולים ירוקים קליעות, איקסים אדומים החטאות"><g fill="none" stroke="#806e4e" stroke-width="8"><path d="M0 0H1500V'+height+'H0Z M505 0V580H995V0 M660 120H840 M75 0V299 A675 675 0 0 0 1425 299V0"/><circle cx="750" cy="157.5" r="22.5"/><circle cx="750" cy="580" r="180"/><path d="M0 1400H1500"/></g>'+dots+'</svg>';
 const zones=[['סמוך לסל',s=>Math.hypot(s.x,s.y)<=200],['2 נק׳ מחוץ לאזור הסל',s=>s.type.startsWith('2')&&Math.hypot(s.x,s.y)>200],['3 נקודות',s=>s.type.startsWith('3')]];
 return '<p class="ap-status">'+note(covered.length,games.length)+' · '+coords.length+' מתוך '+shown.length+' זריקות בסינון עם מיקום</p><div class="ap-legend"><span>● קליעה</span><span>× החטאה</span></div>'+court+'<div class="ap-grid">'+zones.map(([label,pred])=>{const a=all.filter(s=>s.x!==null&&s.y!==null&&pred(s)),made=a.filter(s=>s.made).length;return '<article class="ap-record"><h4>'+label+'</h4>'+fmt(a.length?100*made/a.length:null)+'% · '+made+'/'+a.length+'</article>';}).join('')+'</div>';
}
function attacks(games){
 const labels={fastbreak:'מתפרצת',secondChance:'הזדמנות שנייה',offTurnover:'לאחר איבוד של היריבה',other:'ללא שלושת הסימונים'};
 return '<div class="ap-grid">'+C.attacks(games).map(r=>'<article class="ap-record"><h4>'+labels[r.key]+'</h4><small>'+note(r.covered,games.length)+'</small><div class="ap-metrics">'+metric('נקודות',r.covered?fmt(r.points):'—')+metric('דיוק מהשדה',r.covered&&r.fga?fmt(100*r.fgm/r.fga)+'%':'—',r.covered?r.fgm+'/'+r.fga:'אין נתון')+metric('נקודות למשחק',r.covered?fmt(r.points/r.covered):'—')+metric('עונשין',r.covered?r.ftm+'/'+r.fta:'—')+'</div></article>').join('')+'</div>';
}
function lineups(games){
 const covered=games.filter(g=>g.lineupCoverage),rows=C.lineups(games);
 if(!covered.length)return empty('אין בטווח הזה הרכבים שניתן לאמת מול רצף החילופים והניקוד. נסה משחק אחר או את כל העונה.');
 return '<p class="ap-status">'+note(covered.length,games.length)+' · מיון לפי הנקודות של השחקן עם ארבעת חבריו להרכב</p><div class="ap-grid">'+rows.map((r,i)=>'<article class="ap-record"><h4>הרכב '+(i+1)+' · '+r.points+' נקודות</h4><ol>'+r.teammates.map(p=>'<li><bdi>'+esc(name(p.name))+'</bdi></li>').join('')+'</ol><small>'+r.games+' משחקים · דקות משותפות: '+fmt(r.minutes)+'</small></article>').join('')+'</div>';
}
const help={
negative:'ממוצע לכל הופעה עם נתון זמין. אין סכום מאוחד: חסימה עשויה להיות גם החטאה, ועבירת תוקף עשויה להיות גם איבוד. חסימות שהשחקן ביצע אינן פעולה שלילית.',
plus:'הפרש נקודות הקבוצה מול היריבה בזמן שהשחקן על המגרש, לפי הבוקס סקור הרשמי. ל־40 דקות מחושב מסך ההפרש חלקי סך הדקות כפול 40. זה אינו מדד סיבתי לאיכות השחקן.',
shots:'מיקומי זריקות מהשדה מתוך המקור הרשמי בלבד. עונשין אינו ממופה. האחוזים לפי אזור מחושבים מכל הקליעות וההחטאות עם מיקום, גם כאשר מסננים את הנקודות במפה. סמוך לסל: עד 2 מטר מהטבעת. משחק נכלל רק אם יומן הזריקות תואם לבוקס סקור.',
lineups:'הנקודות האישיות של השחקן עם כל ארבעה שחקנים נוספים, כולל עונשין. השחזור מתחיל בחמישייה הפותחת ועוקב אחר חילופים בסדר הרשמי. משחק עם סתירה בהרכב או בניקוד אינו נכלל. דקות מוצגות רק כאשר גם שעון האירועים והדקות בבוקס סקור מתיישבים. נפח נקודות גבוה אינו מוכיח שההרכב יעיל יותר.',
attacks:'סימוני מתפרצת, הזדמנות שנייה ונקודות לאחר איבוד מגיעים מהמקור הרשמי ועשויים לחפוף. אין לחבר את הקטגוריות. ״ללא שלושת הסימונים״ אינו סיווג טקטי. אין כאן נתוני פיק־אנד־רול או בידודים. דיוק מהשדה אינו כולל עונשין.'
};
for(const [id,title,kind] of tools){
 const b=document.createElement('button');b.dataset.tab=id;b.textContent=title;document.querySelector('nav.tabs').append(b);
 const section=document.createElement('section');section.id=id;section.className='tab ap-screen';
 section.innerHTML='<div class="ap-shell"><div class="ap-top"><h3>'+title+'</h3><button type="button" data-refresh>רענן</button></div><div class="ap-controls"><label class="ap-search-control">חיפוש שחקן<input data-search type="search" placeholder="הקלד שם שחקן…" autocomplete="off"></label><label>קבוצה<select data-team><option value="">כל הקבוצות</option></select></label><label>טווח נתונים<select data-range><option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option></select></label><label>מיון שחקנים<select data-sort><option value="name">שם · א–ת</option><option value="team">לפי קבוצה</option><option value="minutes">דקות · מהגבוה</option>'+(kind==='plus'?'<option value="plus">פלוס־מינוס · מהגבוה</option>':'')+'</select></label>'+(kind==='shots'?'<label>הצג במפה<select data-shot><option value="all">הכול</option><option value="made">קליעות</option><option value="missed">החטאות</option></select></label>':'')+'</div><p class="ap-status" role="status"></p><div data-picked hidden></div><div data-browser aria-label="רשימת שחקנים"></div><div data-output hidden></div><details class="ap-help"><summary>הסבר הנתונים</summary><p>'+help[kind]+'</p><a class="ap-link" href="https://mediagamecenter.euroleague.net/" target="_blank" rel="noopener">מקור: EuroLeague Game Center</a></details></div>';
 document.querySelector('main').append(section);
 const $=s=>section.querySelector(s);let records=[],selected='',browseOpen=true,shown=36;
 function renderBrowser(){
  const host=$('[data-browser]');host.hidden=!browseOpen;if(!browseOpen)return;
  const q=$('[data-search]').value.trim().toLocaleLowerCase(),team=$('[data-team]').value,range=$('[data-range]').value,sort=$('[data-sort]').value;
  const rows=records.filter(p=>(!team||p.team===team)&&(!q||(p.name+' '+p.team).toLocaleLowerCase().includes(q))).map(p=>{
   const games=C.select(p.games,range).filter(g=>g.minutes>0),minutes=games.reduce((sum,g)=>sum+(Number(g.minutes)||0),0);
   return {p,games:games.length,minutes,pm:kind==='plus'?C.plus(games).total:null};
  });
  const cmpName=(a,b)=>a.p.name.localeCompare(b.p.name,'he');
  rows.sort((a,b)=>sort==='minutes'?b.minutes-a.minutes||cmpName(a,b):sort==='plus'&&kind==='plus'?(b.pm??-Infinity)-(a.pm??-Infinity)||cmpName(a,b):sort==='team'?a.p.team.localeCompare(b.p.team,'he')||cmpName(a,b):cmpName(a,b));
  const visible=rows.slice(0,shown),metricLabel=kind==='plus'?'פלוס־מינוס':'דקות';
  const pickRows=visible.map(({p,games,minutes,pm})=>'<button type="button" class="ap-player-row'+(kind==='plus'?'':' ap-no-plus')+(p.id===selected?' is-selected':'')+'" data-pick="'+esc(p.id)+'" aria-label="בחר '+esc(p.name)+'"><span class="ap-row-name"><strong><bdi>'+esc(p.name)+'</bdi></strong><small>'+esc(p.team)+'</small></span><span class="ap-row-appearances"><b>'+games+'</b><small>הופעות</small></span><span class="ap-row-stat"><b>'+fmt(minutes)+'</b><small>דקות</small></span>'+(kind==='plus'?'<span class="ap-row-stat ap-plus-value"><b>'+fmt(pm)+'</b><small>+/−</small></span>':'')+'<span class="ap-row-arrow" aria-hidden="true">‹</span></button>').join('');
  host.innerHTML='<div class="ap-browser-head"><div><h4>בחר שחקן</h4><p>'+rows.length+' שחקנים'+(team?' · '+esc(team):' מכל הקבוצות')+' · לחיצה על שורה מציגה ניתוח</p></div></div><div class="ap-player-list">'+(rows.length?pickRows:empty('לא נמצאו שחקנים. אפשר לשנות קבוצה או חיפוש.'))+'</div>'+(rows.length>shown?'<button type="button" class="ap-show-more" data-more>הצג עוד '+Math.min(36,rows.length-shown)+' שחקנים · '+visible.length+'/'+rows.length+'</button>':'');
 }
 function controls(){renderBrowser();}
 function ranges(){
  const old=$('[data-range]').value,p=records.find(p=>p.id===selected);
  $('[data-range]').innerHTML='<option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option>'+(p?.games||[]).map(g=>'<option value="game:'+g.gameCode+'">'+esc(date(g.date)+' · '+(g.opponent||'משחק '+g.gameCode)+(g.minutes===0?' · לא שיחק':''))+'</option>').join('');
  if([...$('[data-range]').options].some(o=>o.value===old))$('[data-range]').value=old;
 }
 function render(){
  const p=records.find(p=>p.id===selected),picked=$('[data-picked]'),output=$('[data-output]');
  picked.hidden=!p;output.hidden=!p||browseOpen;
  if(!p){output.innerHTML='';return;}
  picked.innerHTML='<div class="ap-picked-inner"><span><b><bdi>'+esc(p.name)+'</bdi></b><small>'+esc(p.team)+'</small></span><button type="button" data-change>החלף שחקן</button></div>';
  const selectedGames=C.select(p.games,$('[data-range]').value),games=selectedGames.filter(g=>g.minutes>0),latest=selectedGames[0];
  const header='<div class="ap-profile"><h3><bdi>'+esc(p.name)+'</bdi></h3><small>'+esc(p.team)+' · '+games.length+' הופעות בטווח</small>'+(latest?'<small>הרישום האחרון בטווח: '+esc(latest.opponent||'')+' · '+date(latest.date)+' · מחזור '+esc(latest.round??'—')+'</small>':'')+'</div>';
  const show=gs=>kind==='negative'?negative(gs):kind==='plus'?plus(gs):kind==='shots'?shots(gs,$('[data-shot]').value):kind==='lineups'?lineups(gs):attacks(gs);
  $('[data-output]').innerHTML=header+(games.length?show(games):empty('אין הופעה עם דקות משחק בטווח שנבחר. אי־השתתפות אינה מוצגת כאפס.'))+
   (games.length&&['negative','plus'].includes(kind)?'<details><summary>פירוט לפי משחק</summary><div class="ap-grid">'+games.map(g=>'<article class="ap-record"><h4>'+esc(g.opponent||'משחק '+g.gameCode)+'</h4><small>'+date(g.date)+' · '+(g.home?'בית':'חוץ')+' · '+fmt(g.minutes)+' דקות</small>'+show([g])+'</article>').join('')+'</div></details>':'');
 }
 async function open(force=false){
  $('[role=status]').textContent='טוען נתונים רשמיים…';$('[data-refresh]').disabled=true;
  try{await load(force);records=profiles();const team=$('[data-team]').value;
   $('[data-team]').innerHTML='<option value="">כל הקבוצות</option>'+[...new Set(records.map(p=>p.team))].sort().map(t=>'<option>'+esc(t)+'</option>').join('');
   if([...$('[data-team]').options].some(o=>o.value===team))$('[data-team]').value=team;
   controls();ranges();render();$('[role=status]').textContent='עונת 2026/27 · עודכן '+date(data.updated_at)+' · '+Object.keys(data.games).length+' משחקים במאגר';
  }catch{$('[role=status]').textContent='טעינת הנתונים נכשלה. לחץ על רענן כדי לנסות שוב.';$('[data-output]').innerHTML=empty('הנתונים אינם זמינים כרגע.');}finally{$('[data-refresh]').disabled=false;}
 }
 b.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(e=>e.classList.remove('active'));b.classList.add('active');section.classList.add('active');void open();};
 $('[data-refresh]').onclick=()=>void open(true);
 $('[data-team]').onchange=()=>{
  const team=$('[data-team]').value;
  if(team&&selected&&records.find(p=>p.id===selected)?.team!==team)selected='';
  browseOpen=true;shown=36;controls();ranges();render();
 };
 $('[data-search]').oninput=()=>{browseOpen=true;shown=36;controls();};
 $('[data-sort]').onchange=()=>{shown=36;controls();};
 $('[data-range]').onchange=()=>{shown=36;renderBrowser();render();};
 if($('[data-shot]'))$('[data-shot]').onchange=render;
 section.addEventListener('click',e=>{
  const row=e.target.closest('[data-pick]');
  if(row){selected=row.dataset.pick;browseOpen=false;ranges();render();renderBrowser();return;}
  if(e.target.closest('[data-change]')){browseOpen=true;shown=36;renderBrowser();return;}
  if(e.target.closest('[data-more]')){shown+=36;renderBrowser();}
 });
}
})();
