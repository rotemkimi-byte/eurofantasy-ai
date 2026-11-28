(()=>{
'use strict';
const C=window.AdvancedPlayerCore;if(!C)return;
const tools=[['playerBoxScore','נתונים נקיים','boxScore'],['playerNegative','פעולות שליליות','negative'],['playerShots','מפת זריקות','shots'],['playerPlusMinus','פלוס־מינוס','plus'],['playerLineups','הרכבי קליעה','lineups']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('he-IL',{maximumFractionDigits:1});
const date=s=>new Date(s).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'});
const name=s=>String(s||'').includes(',')?s.split(',').reverse().map(x=>x.trim()).join(' '):s;
const empty=s=>'<p class="ap-empty">'+esc(s)+'</p>';
const metric=(label,value,note,tone)=>[label,value,note,tone];
const signed=n=>n>0?'+'+fmt(n):fmt(n);
const note=(count,total)=>count+' מתוך '+total+' הופעות עם נתון מאומת';
let data=null,pending=null;
async function load(force){
 if(data&&!force)return data;
 if(pending)return pending;
 pending=(async()=>{const d=await (window.loadGameData?window.loadGameData('advanced-players.json',force):(async()=>{const r=await fetch('./data/advanced-players.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();return d;})());if(d.season!=='E2026'||d.schema!=='advanced-players-v1')throw Error('Wrong season');data=d;return d;})().finally(()=>pending=null);return pending;
}
const marketKey=value=>window.PlayerIdentity.key(value);
function marketPrices(){
 const map=new Map();
 for(const p of (typeof players!=='undefined'&&Array.isArray(players)?players:[])){
  if(p.pos==='COACH')continue;
  const key=marketKey(p.name),price=Number(p.price);
  if(!key||!Number.isFinite(price)||price<=0)continue;
  map.set(key,map.has(key)?null:price);
 }
 return map;
}
function profiles(){
 const map=new Map();
 for(const g of Object.values(data.games))for(const p of Object.values(g.players)){
  let r=map.get(p.id);if(!r){r={id:p.id,playerCode:p.id,name:name(p.name),games:[]};map.set(p.id,r);}
  r.games.push({...p,gameCode:g.gameCode,date:g.date,round:g.round});
 }
 const market=new Map((typeof players!=='undefined'?players:[]).filter(p=>['G','F','C'].includes(p.pos)).map(p=>[marketKey(p.name),p]));
 for(const p of map.values()){
  p.games=C.select(p.games,0);
  const key=marketKey(p.name),current=market.get(key);
  p.team=current?.team||p.games[0]?.team||'';
  market.delete(key);
 }
 for(const [key,p] of market)if(key)map.set('market:'+key,{id:'market:'+key,name:p.name,team:p.team,fantasy_id:p.fantasy_id,games:[]});
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
const boxFields=[['PIR','valuation'],['דקות','timePlayed'],['נקודות','points'],['קליעות ל־3',3],['קליעות ל־2',2],
 ['איבודים','turnovers'],['חטיפות','steals'],['חסימות','blocksFavour'],['עבירות','foulsCommited'],
 ['ריבאונדים','totalRebounds'],['אסיסטים','assistances']];
function boxMinutes(seconds){
 if(seconds===null)return '—';
 const rounded=Math.round(seconds);
 return Math.floor(rounded/60)+':'+String(rounded%60).padStart(2,'0');
}
const boxShooting=(made,attempted)=>made===null?'—':attempted===null?fmt(made):fmt(made)+'/'+fmt(attempted);
function scouting(items,cls=''){
 return window.PlayerAnalysis.metrics(items,{panel:`ap-metrics ${cls}`,cell:'ap-metric'});
}
const boxTiles=render=>scouting(boxFields.map(([label,key])=>render(label,key)),'ap-box-metrics');
function boxAverageCards(games,range){
 const a=C.boxAverages(games,boxFields.map(([,key])=>key).filter(key=>typeof key==='string'));
 const title=range==='3'?'ממוצע למשחק · 3 הופעות אחרונות':'ממוצע למשחק · כל העונה';
 const coverage=count=>count<a.games?note(count,a.games):'';
 const tiles=a.games?boxTiles((label,key)=>{
  if(typeof key==='number'){
   const s=a.shooting[key];
   return metric(label,boxShooting(s.made,s.attempted),coverage(s.covered));
  }
  const {mean,covered}=a.stats[key];
  return metric(label,key==='timePlayed'?boxMinutes(mean):fmt(mean),coverage(covered));
 }):empty('אין הופעות עם דקות משחק בטווח שנבחר.');
 return '<article class="ap-box-game ap-box-average"><h4>'+title+'</h4><small>'+a.games+' הופעות בחישוב</small>'+tiles+'</article>';
}
function boxScore(p,games){
 if(!games.length)return empty('אין עדיין נתוני משחק לשחקן בעונה הנוכחית.');
 return games.map(g=>{
  const stats=g.stats||{},seconds=C.n(stats.timePlayed);
  const title='המספרים של '+p.name+(g.opponent?' מול '+g.opponent:'');
  const details=date(g.date)+' · '+(g.home?'בית':'חוץ')+' · מחזור '+(g.round??'—');
  const tiles=seconds===0?empty('לא שיחק במשחק הזה.'):boxTiles((label,key)=>metric(label,
   typeof key==='number'?boxShooting(C.n(stats['fieldGoalsMade'+key]),C.n(stats['fieldGoalsAttempted'+key])):
   key==='timePlayed'?boxMinutes(seconds):fmt(C.n(stats[key]))));
  return '<article class="ap-box-game"><h4><bdi>'+esc(title)+'</bdi></h4>'+tiles+'<small>'+esc(details)+'</small></article>';
 }).join('');
}
const negativeLabels={turnovers:'איבודים',miss2:'החטאות ל־2',miss3:'החטאות ל־3',missFT:'החטאות עונשין',fouls:'עבירות שביצע',blocked:'זריקות שנחסמו'};
function negative(games){
 const s=C.negative(games);
 return scouting(Object.entries(negativeLabels).map(([k,l])=>{
  const row=s[k],coverage=row.covered<games.length?' · '+note(row.covered,games.length):'';
  return metric(l,fmt(row.mean),'סה״כ '+fmt(row.total)+coverage,row.mean>0?'negative':'');
 }),'ap-negative-metrics');
}
function plus(games){
 const s=C.plus(games);
 const score=(label,n)=>metric(label,signed(n),'',n<0?'negative':n>0?'positive':'');
 return scouting([
  score('פלוס־מינוס מצטבר',s.total),score('ממוצע למשחק',s.mean),score('ל־40 דקות',s.per40),
  metric('דקות במדגם',fmt(s.minutes),note(s.covered,games.length))
 ]);
}
function shotCourt(coords){
 const long=coords.some(s=>s.y>1242.5);
 const height=long?2800:1400;
 const projection=.72;
 const displayHeight=height*projection;
 const marks=coords.map(s=>{
  const x=s.x+750,y=(s.y+157.5)*projection;
  const title=esc((s.made?'קליעה':'החטאה')+' · '+(s.type.startsWith('3')?'3':'2')+' נק׳');
  const shape=s.made?'#ap-shot-made':'#ap-shot-missed';
  const color=s.made?'#007846':'#c9182b';
  return `<g class="ap-shot-marker ${s.made?'is-made':'is-missed'}" transform="translate(${x} ${y})" stroke-linejoin="round">
   <title>${title}</title>
   <use href="${shape}" fill="none" stroke="#172433" stroke-width="13"/>
   <use href="${shape}" fill="${color}" stroke="#fff" stroke-width="6"/>
  </g>`;
 }).join('');
 return `<svg class="ap-court" viewBox="-36 -36 1572 ${displayHeight+72}" role="img" aria-label="מפת זריקות: עיגולים ירוקים קליעות, איקסים אדומים החטאות">
  <defs>
   <circle id="ap-shot-made" r="26"/>
   <path id="ap-shot-missed" d="M-25-16-16-25 0-9 16-25 25-16 9 0 25 16 16 25 0 9-16 25-25 16-9 0Z"/>
   <linearGradient id="ap-shot-wood" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop stop-color="#f0cd9c"/><stop offset="1" stop-color="#e3b781"/>
   </linearGradient>
   <pattern id="ap-shot-plank-seams" width="480" height="144" patternUnits="userSpaceOnUse">
    <path d="M0 0H480M0 48H480M0 96H480M95 0V48M293 48V96M178 96V144" fill="none" stroke="#754b24" stroke-opacity=".1" stroke-width="2"/>
   </pattern>
   <linearGradient id="ap-shot-key" x2="0%" y2="100%">
    <stop stop-color="#0b2e54"/><stop offset="1" stop-color="#155785"/>
   </linearGradient>
   <g id="ap-shot-half">
    <path d="M505 0H995V580H505Z" fill="url(#ap-shot-key)"/>
    <path d="M75 0V299 A675 675 0 0 0 1425 299V0 M570 580A180 180 0 0 0 930 580" fill="none" stroke="#64432c" stroke-width="7"/>
    <path d="M505 0V580H995V0" fill="none" stroke="#fff8e9" stroke-width="8"/>
    <path d="M570 580A180 180 0 0 1 930 580" fill="none" stroke="#e9f7ff" stroke-width="7" stroke-dasharray="24 17"/>
    <g class="ap-hoop">
     <path d="M650 103H850" stroke="#16324c" stroke-width="20"/>
     <path d="M650 98H850" stroke="#f2faff" stroke-width="12"/>
     <path d="M750 104V128" stroke="#f97a27" stroke-width="8"/>
     <g transform="translate(0 7.5)">
      <path d="M719 156Q724 187 739 201Q750 208 761 201Q776 187 781 156 M723 164L760 202M733 169L747 205M745 173L739 201M757 173L729 186M770 168L745 204M779 159L759 203M726 180Q750 196 775 180M732 193Q750 205 768 193" fill="none" stroke="#eaf6ff" stroke-width="2.7"/>
      <ellipse cx="750" cy="150" rx="32" ry="31" fill="none" stroke="#fd7928" stroke-width="7"/>
     </g>
    </g>
   </g>
  </defs>
  <g transform="scale(1 ${projection})">
   <rect width="1500" height="${height}" fill="url(#ap-shot-wood)"/>
   <rect width="1500" height="${height}" fill="url(#ap-shot-plank-seams)"/>
   <use href="#ap-shot-half"/>
   ${long?'<use href="#ap-shot-half" transform="translate(1500 2800) rotate(180)"/>':''}
   ${long?'<g fill="none" stroke="#64432c" stroke-width="7"><path d="M0 1400H1500"/><circle cx="750" cy="1400" r="180"/></g>':''}
  </g>
  <rect class="ap-court-frame" width="1500" height="${displayHeight}" fill="none" stroke="#ecfaff" stroke-width="9"/>
  ${marks}
 </svg>`;
}

function shots(games,filter){
 const covered=games.filter(g=>g.shotCoverage),all=covered.flatMap(g=>g.shots).filter(s=>!s.type.startsWith('FT'));
 const shown=all.filter(s=>filter==='all'||(filter==='made'?s.made:!s.made)),coords=shown.filter(s=>s.x!==null&&s.y!==null);
 if(!covered.length)return empty('אין מפת זריקות מאומתת בטווח שנבחר. בחר משחק אחר או טווח רחב יותר.');
 const zones=[['סמוך לסל',s=>Math.hypot(s.x,s.y)<=200],['2 נק׳ מחוץ לאזור הסל',s=>s.type.startsWith('2')&&Math.hypot(s.x,s.y)>200],['3 נקודות',s=>s.type.startsWith('3')]];
 return '<p class="ap-status">'+note(covered.length,games.length)+' · '+coords.length+' מתוך '+shown.length+' זריקות בסינון עם מיקום</p><div class="ap-legend"><span><b class="ap-legend-made" aria-hidden="true">●</b> קליעה</span><span><b class="ap-legend-missed" aria-hidden="true">×</b> החטאה</span></div>'+shotCourt(coords)+'<div class="ap-grid">'+zones.map(([label,pred])=>{const a=all.filter(s=>s.x!==null&&s.y!==null&&pred(s)),made=a.filter(s=>s.made).length;return '<article class="ap-record"><h4>'+label+'</h4>'+fmt(a.length?100*made/a.length:null)+'% · '+made+'/'+a.length+'</article>';}).join('')+'</div>';
}
function lineups(games){
 const covered=games.filter(g=>g.lineupCoverage),rows=C.lineups(games);
 if(!covered.length)return empty('אין בטווח הזה הרכבים שניתן לאמת מול רצף החילופים והניקוד. נסה משחק אחר או את כל העונה.');
 if(!rows.length)return empty('אין הרכבי קליעה בטווח שנבחר.');
 const maximum=Math.max(1,rows[0].points);
 return `<p class="ap-status">${note(covered.length,games.length)} · לפי סך הנקודות של השחקן בכל חמישייה</p>
  <div class="ap-lineups">${rows.map((row,index)=>`
   <article class="ap-lineup-card">
    <div class="ap-lineup-heading">
     <h4>הרכב ${index+1}</h4>
     <span class="ap-lineup-score"><strong><bdi>${fmt(row.points)}</bdi></strong> נק׳</span>
    </div>
    <div class="ap-lineup-bar" aria-hidden="true"><span style="inline-size:${100*row.points/maximum}%"></span></div>
    <ul class="ap-lineup-players" aria-label="ארבעת חברי ההרכב">${row.teammates.map(teammate=>{
     const identity=window.PlayerAnalysis;
     const player=identity.resolve(teammate)??{...teammate,name:name(teammate.name)};
     return `<li>${identity.identity(player)}</li>`;
    }).join('')}</ul>
    <div class="ap-lineup-meta">
     <span><bdi>${row.games}</bdi> משחקים</span>
     <span>דקות משותפות · <bdi>${fmt(row.minutes)}</bdi></span>
    </div>
   </article>`).join('')}</div>`;
}
const help={
boxScore:'נתוני הבוקס סקור הרשמיים. בשלוש הופעות אחרונות ובעונה מוצג ממוצע למשחק שבו השחקן שיחק. קליעות מוצגות כקליעות מתוך ניסיונות, ובממוצע נכללות רק הופעות עם שני הנתונים. מקף מציין נתון חסר.',
negative:'ממוצע לכל הופעה עם נתון זמין. אין סכום מאוחד: חסימה עשויה להיות גם החטאה, ועבירת תוקף עשויה להיות גם איבוד. חסימות שהשחקן ביצע אינן פעולה שלילית.',
plus:'הפרש נקודות הקבוצה מול היריבה בזמן שהשחקן על המגרש, לפי הבוקס סקור הרשמי. ל־40 דקות מחושב מסך ההפרש חלקי סך הדקות כפול 40. זה אינו מדד סיבתי לאיכות השחקן.',
shots:'מיקומי זריקות מהשדה מתוך המקור הרשמי בלבד. עונשין אינו ממופה. האחוזים לפי אזור מחושבים מכל הקליעות וההחטאות עם מיקום, גם כאשר מסננים את הנקודות במפה. סמוך לסל: עד 2 מטר מהטבעת. משחק נכלל רק אם יומן הזריקות תואם לבוקס סקור.',
lineups:'הנקודות האישיות של השחקן עם כל ארבעה שחקנים נוספים, כולל עונשין. השחזור מתחיל בחמישייה הפותחת ועוקב אחר חילופים בסדר הרשמי. משחק עם סתירה בהרכב או בניקוד אינו נכלל. דקות מוצגות רק כאשר גם שעון האירועים והדקות בבוקס סקור מתיישבים. נפח נקודות גבוה אינו מוכיח שההרכב יעיל יותר.'
};
for(const [id,title,kind] of tools){
 const b=document.createElement('button');b.dataset.tab=id;b.textContent=title;document.querySelector('nav.tabs').append(b);
 const section=document.createElement('section');section.id=id;section.className='tab ap-screen';
 section.innerHTML='<div class="ap-shell"><div class="ap-top"><h3>'+title+'</h3><button type="button" data-refresh>רענן</button></div><div class="player-picker-modes" role="group" aria-label="בחירת רשימת שחקנים"><button type="button" data-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button><button type="button" data-scope="team" aria-pressed="false">לפי קבוצה</button></div><div class="ap-controls player-picker-controls"><label data-team-label hidden>קבוצה<select data-team><option value="">כל הקבוצות</option></select></label><label data-player-label>שחקן · מהמחיר הגבוה לנמוך<select data-player></select></label><label>טווח נתונים<select data-range><option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option></select></label><label>מיון שחקנים<select data-sort><option value="price" selected>מחיר · מהגבוה לנמוך</option><option value="name">שם · א–ת</option><option value="team">לפי קבוצה</option><option value="minutes">דקות · מהגבוה</option><option value="pir">PIR · המשחק האחרון</option>'+(kind==='plus'?'<option value="plus">פלוס־מינוס · מהגבוה</option>':'')+'</select></label>'+(kind==='shots'?'<label>הצג במפה<select data-shot><option value="all">הכול</option><option value="made">קליעות</option><option value="missed">החטאות</option></select></label>':'')+'</div><p class="ap-status" role="status"></p><div class="ap-profile" data-picked hidden></div><div data-browser aria-label="רשימת שחקנים"></div><div data-output hidden></div><details class="ap-help pa-disclosure" data-disclosure="help"><summary>הסבר הנתונים</summary><p>'+help[kind]+'</p><a class="ap-link" href="https://mediagamecenter.euroleague.net/" target="_blank" rel="noopener">מקור: EuroLeague Game Center</a></details></div>';
 document.querySelector('main').append(section);
 document.addEventListener('fantasy-player-media-ready',()=>{if(browseOpen)renderBrowser();render();});
 const $=s=>section.querySelector(s);let records=[],selected='',browseOpen=true,shown=36,scope='all';
 const analysisMetrics=kind==='negative'?Object.fromEntries(Object.entries(negativeLabels).map(([k,l])=>[k,l+' למשחק'])):
  kind==='plus'?{total:'פלוס־מינוס מצטבר',mean:'ממוצע למשחק',per40:'ל־40 דקות'}:null;
 const analytics=analysisMetrics?window.PlayerAnalysis.mount(section,$('.ap-controls'),$('[role=status]'),[$('[data-picked]'),$('[data-browser]'),$('[data-output]')],{
  metrics:analysisMetrics,team:()=>scope==='team'?$('[data-team]').value:'',
  rows:()=>{
   const prices=marketPrices(),range=$('[data-range]').value;
   return records.map(p=>{
    const games=C.select(p.games,range).filter(g=>g.minutes>0);
    const values=kind==='plus'?C.plus(games):Object.fromEntries(Object.entries(C.negative(games)).map(([key,stat])=>[key,stat.mean]));
    return {...p,price:prices.get(marketKey(p.name))??null,values};
   });
  },format:fmt
 }):null;
 const alwaysPickPlayer=['boxScore','negative','plus'].includes(kind);
 const syncRange=alwaysPickPlayer
  ?window.PerformanceControls.mount(section,$('[data-range]'),{specificGames:true}):null;
 if(alwaysPickPlayer)$('[data-player-label]').firstChild.textContent='בחר שחקן';
 function renderBrowser(){
  const showPicker=browseOpen||alwaysPickPlayer;
  $('[data-team-label]').hidden=scope!=='team'||!showPicker;
  $('[data-player-label]').hidden=!showPicker;
  $('.player-picker-modes').hidden=!showPicker;
  const host=$('[data-browser]');host.hidden=!browseOpen;if(!showPicker)return;
  const team=scope==='team'?$('[data-team]').value:'',range=$('[data-range]').value,sort=$('[data-sort]').value;
  const prices=marketPrices();
  const cmpName=(a,b)=>a.p.name.localeCompare(b.p.name,'he');
  const rows=records.filter(p=>scope==='all'||p.team===team).map(p=>({p,price:prices.get(marketKey(p.name))??null}));
  const byPrice=[...rows].sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||cmpName(a,b));
  const player=$('[data-player]');
  player.replaceChildren(new Option(byPrice.length?'בחר שחקן':scope==='team'&&!team?'בחר קבוצה תחילה':'לא נמצאו שחקנים',''),...byPrice.map(({p,price})=>new Option(p.name+' · '+(price===null?'מחיר לא זמין':fmt(price)+' cr'),p.id)));
  if(byPrice.some(({p})=>p.id===selected))player.value=selected;
  if(!browseOpen)return;
  for(const row of rows){
   const games=C.select(row.p.games,range).filter(g=>g.minutes>0);
   row.games=games.length;
   row.minutes=games.reduce((sum,g)=>sum+(Number(g.minutes)||0),0);
   row.pir=games.length?C.n(games[0].stats?.valuation):null;
   row.pm=kind==='plus'?C.plus(games).total:null;
  }
  rows.sort((a,b)=>sort==='price'?(b.price??-Infinity)-(a.price??-Infinity)||cmpName(a,b):sort==='minutes'?b.minutes-a.minutes||cmpName(a,b):sort==='pir'?(b.pir??-Infinity)-(a.pir??-Infinity)||cmpName(a,b):sort==='plus'&&kind==='plus'?(b.pm??-Infinity)-(a.pm??-Infinity)||cmpName(a,b):sort==='team'?a.p.team.localeCompare(b.p.team,'he')||cmpName(a,b):cmpName(a,b));
  const visible=rows.slice(0,shown);
  const pickRows=visible.map(({p,price,games,minutes,pir,pm})=>`<div class="ap-player-row${kind==='lineups'?' ap-lineup-picker':kind==='plus'?'':' ap-no-plus'}${p.id===selected?' is-selected':''}">
   <span class="ap-row-name">${window.PlayerAnalysis.identity(p)}<small>${games} הופעות</small></span>
   ${kind==='lineups'?`<button type="button" class="ap-lineup-open" data-pick="${esc(p.id)}" aria-label="הרכב קליעה של ${esc(p.name)}">הרכב קליעה</button>`:`<bdi class="pa-credit">${fmt(price)} CR</bdi>
   <span class="ap-row-stat"><b>${fmt(sort==='pir'?pir:minutes)}</b><small>${sort==='pir'?'PIR':'דקות'}</small></span>
   ${kind==='plus'?`<span class="ap-row-stat ap-plus-value"><b>${signed(pm)}</b><small>+/−</small></span>`:''}
   <button type="button" class="ap-row-arrow" data-pick="${esc(p.id)}" aria-pressed="${p.id===selected}" aria-label="בחר ${esc(p.name)}">‹</button>`}
  </div>`).join('');
  host.innerHTML='<div class="ap-browser-head"><div><h4 tabindex="-1">בחר שחקן</h4><p>'+rows.length+' שחקנים'+(team?' · '+esc(team):' מכל הקבוצות')+' · '+esc($('[data-sort]').selectedOptions[0].textContent)+'</p></div></div><div class="ap-player-list">'+(rows.length?pickRows:empty('לא נמצאו שחקנים. אפשר לשנות קבוצה או חיפוש.'))+'</div>'+(rows.length>shown?'<button type="button" class="ap-show-more" data-more>הצג עוד '+Math.min(36,rows.length-shown)+' שחקנים · '+visible.length+'/'+rows.length+'</button>':'');
 }
 function controls(){renderBrowser();}
 function ranges(){
  const old=$('[data-range]').value,p=records.find(p=>p.id===selected);
  $('[data-range]').innerHTML='<option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option>'+(p?.games||[]).map(g=>'<option value="game:'+g.gameCode+'">'+esc(date(g.date)+' · '+(g.opponent||'משחק '+g.gameCode)+(g.minutes===0?' · לא שיחק':''))+'</option>').join('');
  if([...$('[data-range]').options].some(o=>o.value===old))$('[data-range]').value=old;
 }
 function render(){
  syncRange?.();
  analytics?.render();
  const p=records.find(p=>p.id===selected),picked=$('[data-picked]'),output=$('[data-output]');
  picked.hidden=!p||browseOpen;output.hidden=!p||browseOpen;
  section.classList.toggle('ap-detail-open',!!p&&!browseOpen);
  if(!p){output.innerHTML='';return;}
  const selectedGames=C.select(p.games,$('[data-range]').value),games=selectedGames.filter(g=>g.minutes>0),latest=selectedGames[0];
  const price=marketPrices().get(marketKey(p.name));
  const meta=latest?'<bdi>'+esc(latest.opponent||'')+'</bdi> · '+date(latest.date)+' · מחזור '+esc(latest.round??'—'):'';
  picked.innerHTML=window.PlayerAnalysis.profile(p,{
   meta:games.length+' הופעות בטווח'+(meta?' · '+meta:''),
   action:'<div class="pa-profile-actions">'+(price!=null?'<bdi class="pa-credit">'+fmt(price)+' CR</bdi>':'')+
    (alwaysPickPlayer?'':'<button type="button" data-control="back" data-back>חזרה לרשימה <span aria-hidden="true">←</span></button>')+'</div>'
  });
  if(kind==='boxScore'){
   const range=$('[data-range]').value;
   const multi=range==='3'||range==='0';
   const rows=range==='3'?C.select(p.games.filter(g=>g.minutes>0),range):selectedGames;
   output.innerHTML=multi?boxAverageCards(rows,range)+(rows.length?'<details class="pa-disclosure" data-disclosure="games"><summary>פירוט המשחקים בטווח</summary>'+boxScore(p,rows)+'</details>':''):boxScore(p,rows);
   return;
  }
  const show=gs=>kind==='negative'?negative(gs):kind==='plus'?plus(gs):kind==='shots'?shots(gs,$('[data-shot]').value):lineups(gs);
  $('[data-output]').innerHTML=(games.length?(kind==='negative'?'<h4 class="pa-stats-heading">ממוצע למשחק <small>'+games.length+' הופעות</small></h4>':'')+show(games):empty(p.games.length?'אין הופעה עם דקות משחק בטווח שנבחר.':'אין עדיין נתוני משחק לשחקן בעונה הנוכחית.'))+
   (games.length&&['negative','plus'].includes(kind)?'<details class="pa-disclosure" data-disclosure="games"><summary>פירוט לפי משחק</summary><div class="ap-grid">'+games.map(g=>'<article class="ap-record"><h4>'+esc(g.opponent||'משחק '+g.gameCode)+'</h4><small>'+date(g.date)+' · '+(g.home?'בית':'חוץ')+' · '+fmt(g.minutes)+' דקות</small>'+show([g])+'</article>').join('')+'</div></details>':'');
 }
 async function open(force=false){
  $('[role=status]').textContent='טוען נתונים רשמיים…';$('[data-refresh]').disabled=true;
  try{await Promise.all([load(force),window.refreshFantasyLive?.()]);records=profiles();const team=$('[data-team]').value;
   $('[data-team]').innerHTML='<option value="">בחר קבוצה</option>'+[...new Set(records.map(p=>p.team))].sort().map(t=>'<option>'+esc(t)+'</option>').join('');
   if([...$('[data-team]').options].some(o=>o.value===team))$('[data-team]').value=team;
   const shared=section.classList.contains('active')?window.playerToolSelection?.find(records):null;
   if(shared){
    selected=shared.row.id;browseOpen=false;
    if(alwaysPickPlayer&&scope==='team')$('[data-team]').value=shared.row.team;
   }
   controls();ranges();
   if(shared?.range)$('[data-range]').value=shared.range;
   render();$('[role=status]').textContent='עונת 2026/27 · עודכן '+date(data.updated_at)+' · '+Object.keys(data.games).length+' משחקים במאגר';
  }catch{$('[role=status]').textContent='טעינת הנתונים נכשלה. לחץ על רענן כדי לנסות שוב.';$('[data-output]').innerHTML=empty('הנתונים אינם זמינים כרגע.');}finally{$('[data-refresh]').disabled=false;}
 }
 b.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(e=>e.classList.remove('active'));b.classList.add('active');section.classList.add('active');void open();};
 $('[data-refresh]').onclick=()=>void open(true);
 for(const button of section.querySelectorAll('[data-scope]'))button.onclick=()=>{
  scope=button.dataset.scope;
  for(const item of section.querySelectorAll('[data-scope]'))item.setAttribute('aria-pressed',String(item===button));
  $('[data-sort]').value='price';shown=36;
  if(alwaysPickPlayer){
   browseOpen=true;ranges();render();
  }else analytics?.render();
  renderBrowser();
 };
 function choose(id){
  if(!id)return;selected=id;browseOpen=false;ranges();
  window.playerToolSelection?.set(records.find(p=>p.id===id)?.name,$('[data-range]').value);
  render();renderBrowser();
 }
 $('[data-player]').onchange=()=>choose($('[data-player]').value);
 $('[data-team]').onchange=()=>{
  const team=$('[data-team]').value;
  if(selected&&(team||alwaysPickPlayer)&&records.find(p=>p.id===selected)?.team!==team)selected='';
  browseOpen=true;shown=36;ranges();controls();render();
 };
 $('[data-sort]').onchange=()=>{shown=36;controls();};
 $('[data-range]').onchange=()=>{window.playerToolSelection?.set(records.find(p=>p.id===selected)?.name,$('[data-range]').value);shown=36;renderBrowser();render();};
 if($('[data-shot]'))$('[data-shot]').onchange=render;
 section.addEventListener('click',e=>{
  const row=e.target.closest('[data-pick]');
  if(row){choose(row.dataset.pick);return;}
  if(e.target.closest('[data-back]')){browseOpen=true;renderBrowser();render();$('[data-browser] h4').focus();return;}
  if(e.target.closest('[data-more]')){shown+=36;renderBrowser();}
 });
}
})();
