(()=>{
'use strict';
const C=window.DnaCore,T=window.TeamMetricsCore,S=window.SeasonGamePicker;
const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');
if(!C||!T||!S||!nav||!main)return;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decimal=new Intl.NumberFormat('he-IL',{maximumFractionDigits:1});
const date=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric'});
const fullDate=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',year:'numeric'});
const unitLabels={'%':'%',per40:' ל־40 דק׳',per100:' ל־100 פוז׳',pos:' פוז׳ ל־40 דק׳',cm:' ס״מ'};
const sources={box:'בוקס־סקור',events:'יומן זריקות',estimated:'אומדן',lineups:'חמישיות מאומתות'};
const positionLabels={G:'גארדים',F:'פורוורדים',C:'סנטרים',Guard:'גארדים',Forward:'פורוורדים',Center:'סנטרים'};
const toPosition={Guard:'G',Forward:'F',Center:'C'};
const styleTags={assists:'יוצר משחק',usage:'מעורבות התקפית גבוהה',three:'זורק הרבה לשלוש',
 rim:'משחק ליד הסל',fastbreak:'שחקן מתפרצות',offRebound:'ריבאונד התקפה',defRebound:'ריבאונד הגנה',
 drawn:'סוחט עבירות',steals:'חוטף כדורים',blocks:'חוסם',secondChance:'הזדמנות שנייה'};
const sharedStyleMetrics=C.playerMetrics.filter(([id])=>['three','threeAccuracy','rim','fastbreak','secondChance'].includes(id));
const lowerTeamMetrics=new Set(['turnovers','allowedThree','allowedTwo','allowedRebound','allowedFouls']);
const fmt=(value,unit='')=>value==null?'—':decimal.format(value)+(unitLabels[unit]||'');
const price=p=>Number.isFinite(p.price)&&p.price>0?fmt(p.price)+' CR':'';
const labelName=name=>name.includes(',')?name.split(',').reverse().map(s=>s.trim()).join(' '):name;
const option=(value,name)=>new Option(name,value);
const empty=message=>'<p class="dna-empty">'+esc(message)+'</p>';
let model=null,fixtures=[],pending=null,lastLoad=0;
let teamGames=[],teamGame='',playerGame='',playerView='profile',manualPlayer=false;
let playerPhotos={},clubCrests=new Map();

async function json(path,force=false){
 if(window.loadGameData)return window.loadGameData(path,force);
 const response=await fetch('./data/'+path+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('DNA data unavailable');
 return response.json();
}
function roster(history,market){
 const listed=Array.isArray(market)?market.filter(p=>['G','F','C'].includes(p.pos)):[];
 const byName=new Map(listed.map(p=>[C.key(p.name),p]));
 const seen=new Set();
 const records=history.map(p=>{
  const match=byName.get(C.key(p.name));
  const marketTeam=match&&canonicalTeam(match.team);
  // A lagging market roster must not move a player back to an old club.
  const current=match&&(marketTeam===p.team||!p.games.some(g=>g.team===marketTeam))?match:null;
  const team=current?marketTeam:p.team;
  if(match)seen.add(match);
  return {...p,name:current?.name||labelName(p.name),team,position:current?.pos||toPosition[p.position]||p.position,
   price:match?.price,seasonGames:p.games,games:p.games.filter(g=>g.team===team)};
 });
 for(const p of listed)if(!seen.has(p))records.push({id:'market-'+p.fantasy_id,name:p.name,team:canonicalTeam(p.team),
  position:p.pos,price:p.price,seasonGames:[],games:[]});
 return records.sort((a,b)=>(b.price||0)-(a.price||0)||a.name.localeCompare(b.name));
}
function nextGame(team){
 return fixtures.find(g=>g.home===team||g.away===team);
}
function fixtureFor(team,opponent){
 const g=nextGame(team);
 if(!g||(g.home===team?g.away:g.home)!==opponent)return '';
 return 'מחזור '+g.round+' · '+date.format(new Date(g.date))+' · '+(g.neutral?'מגרש ניטרלי':g.home===team?'בית':'חוץ');
}
function updateOptions(select,options,initial=''){
 const saved=select.value;
 select.replaceChildren(...options);
 if(options.some(o=>o.value===saved))select.value=saved;
 else if(options.some(o=>o.value===initial))select.value=initial;
}
function panel(id,title,description,controls){
 const b=document.createElement('button');
 b.type='button';b.dataset.tab=id;b.textContent=title;
 nav.append(b);
 const section=document.createElement('section');
 section.id=id;section.className='tab dna-screen';
 section.innerHTML=`<div class="card dna-shell">
  <header class="dna-heading"><div><span class="dna-kicker">EUROLEAGUE · 2026/27</span><h2>${title}</h2>
  <p>${description}</p></div><button type="button" class="secondary" data-reload>רענון</button></header>
  <p class="dna-status" role="status"></p><div data-dna-controls hidden>${controls}</div><div data-dna-results></div>
 </div>`;
 main.append(section);
 const $=selector=>section.querySelector(selector);
 b.onclick=()=>{
  document.querySelectorAll('.tabs button,.tab').forEach(node=>node.classList.remove('active'));
  b.classList.add('active');section.classList.add('active');
  if(model)paint();
  if(!model||Date.now()-lastLoad>60000)void load();
 };
 $('[data-reload]').onclick=()=>void load(true);
 return {$,section,button:b};
}
const player=panel('playerDna','DNA שחקן','איך השחקן מייצר תפוקה, ואיך הוא נראה מול כל יריבה ביורוליג.',`
 <div class="dna-controls dna-player-controls">
  <label>קבוצה <select data-scope></select></label>
  <label>שחקן · לפי מחיר <select data-player></select></label>
  <label data-player-rival-label hidden>מול קבוצה <select data-player-rival></select></label>
 </div>
 <div data-range></div>
 <div class="dna-switch" data-player-switch role="group" aria-label="השוואת סגנון">
  <button type="button" data-player-view="profile" aria-pressed="true">פרופיל שחקן</button>
  <button type="button" data-player-view="player" aria-pressed="false">מול שחקן</button>
  <button type="button" data-player-view="team" aria-pressed="false">מול קבוצה</button>
 </div>
 <div class="dna-compare-controls">
  <label hidden>שחקן להשוואה <select data-compare-player></select></label>
  <label hidden>קבוצה להשוואה <select data-compare-club></select></label>
 </div>
 <div id="playerDnaGames" data-past-games hidden></div>`);
const teams=panel('teamDna','DNA קבוצתי','השוו סגנונות משחק, מדד מול מדד, על אותו סולם.',`
 <div class="dna-controls">
  <label>קבוצה <select data-team></select></label>
  <label data-team-pair>מול <select data-opponent></select></label>
 </div>
 <div data-range></div>
 <div id="teamDnaGames" data-past-games hidden></div>
 <div class="dna-switch" data-team-switch role="group" aria-label="סוג המדדים">
  <button type="button" data-view="offense" aria-pressed="true">סגנון התקפי והרכבים</button>
  <button type="button" data-view="defense" aria-pressed="false">הגנה · מה הקבוצות מאפשרות</button>
 </div>`);
const panels=[player,teams];
let view='offense';
const playerRange=S.picker(player.$('[data-range]'),player.$('[data-past-games]'),changed=>{
 if(changed){window.playerToolSelection?.set(selectedPlayer()?.name,playerRange.value);selectPlayerRivals();}
 paint();
});
const teamRange=S.picker(teams.$('[data-range]'),teams.$('[data-past-games]'),paint);

function selectPlayers(){
 const scope=player.$('[data-scope]').value;
 const select=player.$('[data-player]');
 const previous=select.value;
 const records=model.players.filter(p=>!scope||p.team===scope);
 updateOptions(select,records.length?records.map(p=>playerOption(p,!scope)):[option('','אין שחקנים בסינון')],records[0]?.id);
 if(!manualPlayer&&records.length)select.value=records[0].id;
 if(select.value!==previous)playerGame='';
}
function playerOption(p,showTeam=true){
 return option(p.id,p.name+(price(p)?' · '+price(p):'')+(showTeam?' · '+p.team:''));
}
function selectedPlayer(){
 return model.players.find(p=>p.id===player.$('[data-player]').value);
}
function nextOpponent(team){
 const g=nextGame(team);
 return g&&(g.home===team?g.away:g.home);
}
function selectPlayerRivals(){
 const record=selectedPlayer(),select=player.$('[data-player-rival]');
 player.$('[data-player-rival-label]').hidden=!record||(playerView!=='profile'&&playerRange.value!=='history');
 if(!record){select.replaceChildren();return;}
 const counts=new Map();
 for(const g of record.seasonGames)counts.set(g.opponent,(counts.get(g.opponent)||0)+1);
 const history=playerRange.value==='history';
 const rivals=model.teams.map(t=>t.team).filter(team=>team!==record.team||counts.has(team))
  .sort((a,b)=>(counts.get(b)||0)-(counts.get(a)||0)||a.localeCompare(b));
 const next=nextOpponent(record.team);
 const first=history?option('','כל היריבות'):rivals.includes(next)?option('next','היריבה הבאה · '+next):option('','בחר יריבה');
 const options=[first,...rivals.map(name=>{
  const count=counts.get(name);
  return option(name,name+(count?' · '+(count===1?'הופעה אחת':count+' הופעות'):' · ללא הופעות'));
 })];
 updateOptions(select,options,first.value);
}
function selectStyleTargets(){
 const record=selectedPlayer();
 const players=player.$('[data-compare-player]'),clubs=player.$('[data-compare-club]');
 updateOptions(players,[option('','בחר שחקן להשוואה'),...model.players.filter(p=>p!==record).map(p=>playerOption(p))]);
 const names=model.teams.map(t=>t.team).sort((a,b)=>a.localeCompare(b));
 const next=nextOpponent(record?.team);
 updateOptions(clubs,[
  ...(names.includes(next)?[option('next','היריבה הבאה · '+next)]:[]),
  ...names.map(name=>option(name,name))
 ],names.includes(next)?'next':record?.team);
}
function selectOpponents(){
 const own=teams.$('[data-team]').value,next=nextOpponent(own);
 const names=model.teams.filter(t=>t.team!==own);
 updateOptions(teams.$('[data-opponent]'),[
  ...(names.some(t=>t.team===next)?[option('next','היריבה הבאה · '+next)]:[]),
  option('league','ממוצע הליגה'),
  ...names.map(t=>option(t.team,t.team))
 ],next?'next':'league');
}
function selectors(){
 const names=model.teams.map(t=>t.team).sort((a,b)=>a.localeCompare(b));
 updateOptions(teams.$('[data-team]'),[option('','בחר קבוצה'),...names.map(t=>option(t,t))]);
 updateOptions(player.$('[data-scope]'),[option('','כל הקבוצות'),...names.map(t=>option(t,t))]);
 selectPlayers();selectPlayerRivals();selectStyleTargets();selectOpponents();
}
async function load(force=false){
 if(pending)return pending;
 for(const p of panels){
  p.$('[data-reload]').disabled=true;p.$('.dna-status').textContent='טוען נתוני יורוליג…';
 }
 pending=(async()=>{
  try{
   const [official,events,schedule,market,media]=await Promise.all([
    json('official-offense.json',force),json('advanced-players.json',force).catch(()=>null),
    json('context/E2026-schedule.json').catch(()=>null),json('players.json',force).catch(()=>null),
    json('player-media.json').catch(()=>null)
   ]);
   if(official.season!==C.season||!official.players||!official.teamResults?.length)throw Error('No season data');
   const built=C.build(official,events?.season===C.season?events:null,T);
   if(!built.teams.length)throw Error('No team records');
   model={...built,players:roster(built.players,market)};
   if(media?.season===C.season)playerPhotos=media.players||{};
   for(const g of schedule?.data||[]){
    for(const club of [g.local?.club,g.road?.club]){
     if(club?.name&&club.images?.crest)clubCrests.set(canonicalTeam(club.name),club.images.crest);
    }
   }
   const finished=new Set(official.teamResults.map(g=>Number(g.gameCode)));
   const now=Date.now();
   fixtures=(schedule?.data||[]).filter(g=>g.season?.code===C.season&&g.played===false&&
    !finished.has(Number(g.gameCode))&&Date.parse(g.utcDate)>now&&g.local?.club?.name&&g.road?.club?.name&&
    !g.local.club.isVirtual&&!g.road.club.isVirtual).map(g=>({home:canonicalTeam(g.local.club.name),
    away:canonicalTeam(g.road.club.name),date:g.utcDate,round:g.round,neutral:g.isNeutralVenue}))
    .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
   lastLoad=now;
   selectors();
   teamGames=built.teams.flatMap(t=>t.games.filter(g=>g.home));
   for(const p of panels){
    p.$('[data-dna-controls]').hidden=false;
    p.$('.dna-status').textContent=events?.season===C.season?'':'נתוני האירועים חסרים כרגע. מדדי הבוקס־סקור זמינים.';
   }
   paint();
  }catch{
   for(const p of panels)p.$('.dna-status').textContent=model?'הרענון נכשל. מוצגים הנתונים האחרונים.':'הנתונים לא נטענו. אפשר לנסות לרענן.';
  }finally{
   pending=null;
   for(const p of panels)p.$('[data-reload]').disabled=false;
  }
 })();
 return pending;
}
function portrait(name,url,kind){
 const initials=name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('');
 let image='';
 if(/^https:\/\/media-cdn\.(cortextech\.io|incrowdsports\.com|euroleague\.net)\//.test(url||'')){
  image=`<img src="${esc(url)}" alt="" decoding="async" referrerpolicy="no-referrer" hidden>`;
 }
 return `<span class="dna-portrait dna-portrait--${kind}" aria-hidden="true"><bdi>${esc(initials)}</bdi>${image}</span>`;
}
function loadPortraits(out){
 for(const img of out.querySelectorAll('.dna-portrait img')){
  const show=()=>{if(img.naturalWidth)img.hidden=false;};
  img.addEventListener('load',show,{once:true});
  if(img.complete)show();
 }
}
function playerProfile(record,games,tags=[]){
 const minutes=games.reduce((sum,g)=>sum+g.minutes,0);
 const pirs=games.map(g=>g.stats?.valuation).filter(Number.isFinite);
 const avgPir=pirs.length?pirs.reduce((sum,pir)=>sum+pir,0)/pirs.length:null;
 const stats=[
  ['מחיר',price(record)||'—','price'],['דקות למשחק',fmt(games.length?minutes/games.length:null)],
  ['PIR ממוצע',fmt(avgPir)],['הופעות',fmt(games.length)]
 ];
 const position=positionLabels[record.position];
 const crest=clubCrests.get(record.team);
 return `<section class="dna-profile dna-player-profile">
  <div class="dna-player-hero">
   <div class="dna-player-photo">${portrait(record.name,playerPhotos[C.key(record.name)]?.photo,'player')}</div>
   <div class="dna-player-card">
    <div class="dna-player-club">${crest?portrait(record.team,crest,'club'):''}<span><bdi>${esc(record.team)}</bdi>${position?' · '+position:''}</span></div>
    <h3><bdi>${esc(record.name)}</bdi></h3>
    <dl class="dna-headline-stats">${stats.map(([label,value,kind])=>`<div${kind?' class="dna-stat-price"':''}>
     <dt>${label}</dt><dd><bdi>${esc(value)}</bdi></dd></div>`).join('')}</dl>
   </div>
  </div>
  ${tags.length?`<div class="dna-player-traits"><h4>אפיוני משחק</h4><ul class="dna-tags">${tags.map(([,tag])=>'<li>'+tag+'</li>').join('')}</ul></div>`:''}
 </section>`;
}
function playerStyle(stats,ratings,position){
 const three=stats.three.value;
 const ranked=!!ratings;
 return `<section class="dna-player-style">
  <figure class="dna-shot-split">
   <figcaption>תמהיל הזריקות</figcaption><p>מתוך ניסיונות מהשדה</p>
   ${three==null?'<p class="dna-shot-missing">אין נתוני זריקות בטווח הזה.</p>':`
   <div class="dna-court">
    <svg viewBox="0 0 240 172" preserveAspectRatio="none" aria-hidden="true" focusable="false">
     <path class="dna-two-zone" d="M14 0V24A106 94 0 0 0 226 24V0Z"/>
     <path class="dna-court-lines" d="M14 0V24A106 94 0 0 0 226 24V0M88 0V43H152V0M88 43A32 25 0 0 0 152 43M105 11H135"/>
     <circle class="dna-court-lines" cx="120" cy="18" r="6"/>
    </svg>
    <div class="dna-shot-labels">
     <div><strong><bdi>${fmt(100-three,'%')}</bdi></strong><span>זריקות לשתיים</span></div>
     <div><strong><bdi>${fmt(three,'%')}</bdi></strong><span>זריקות לשלוש</span></div>
    </div>
   </div>
   <div class="dna-shot-strip" aria-hidden="true" style="--dna-two:${100-three}%"><i></i><i></i></div>`}
  </figure>
  <section class="dna-player-metrics" aria-labelledby="dnaPlayerMetricsTitle">
   <h4 id="dnaPlayerMetricsTitle">מדדים מרכזיים</h4>
   ${ranked?`<p>האחוזון משווה את השחקן ${position?'מול '+position:'לפי עמדה'} באותו טווח.</p>`:''}
   <table class="dna-player-table" aria-labelledby="dnaPlayerMetricsTitle">
    <thead><tr><th scope="col">מדד</th><th scope="col">ערך</th>${ranked?'<th scope="col">אחוזון</th>':''}</tr></thead>
    <tbody>${C.playerMetrics.map(([id,label,unit,source,help])=>{
     const stat=stats[id],rating=ratings?.[id];
     return `<tr data-metric="${id}"><th scope="row">
      <details class="dna-metric-method"><summary>${label}</summary><p>${help}</p></details>
      <small>${sources[source]}${ranked?' · '+stat.count+' / '+stat.total+' משחקים':''}</small>
      ${id==='usage'?'<small>התקפות הקבוצה שסיים בזריקה, בעונשין או באיבוד כשהיה על המגרש.</small>':''}
     </th><td><bdi>${stat.value==null?'—':fmt(stat.value,unit)}</bdi></td>
     ${ranked?`<td>${rating==null?'<span class="dna-rank-missing" aria-label="ללא דירוג">—</span>':`<div class="dna-percentile">
      <bdi>${rating}</bdi><span class="dna-track" aria-hidden="true"><i style="--dna-width:${rating}%"></i></span></div>`}</td>`:''}</tr>`;
    }).join('')}</tbody>
   </table>
  </section>
 </section>`;
}
function teamStyle(metrics,ownStats,rivalStats,ownName,rivalName){
 const ids=metrics===C.offense?['three','threeAccuracy','offRebound','assisted']:['allowedThree','allowedTwo','allowedRebound'];
 const rows=ids.map(id=>{
  const [,label]=metrics.find(metric=>metric[0]===id);
  const a=ownStats[id]?.value,b=rivalStats[id]?.value;
  return {id,label,a,b,gap:a!=null&&b!=null?Math.abs(a-b):null};
 }).filter(({a,b})=>a!=null||b!=null);
 if(!rows.length)return empty('אין מספיק נתונים להשוואת הסגנון בטווח הזה.');
 const biggest=rows.reduce((best,row)=>row.gap!=null&&(!best||row.gap>best.gap)?row:best,null);
 return `<figure class="dna-team-style">
  <figcaption>${metrics===C.offense?'איך הקבוצות משחקות בהתקפה':'מה הקבוצות מאפשרות בהגנה'}</figcaption>
  ${biggest&&biggest.gap>=0.1?`<p class="dna-gap-lead">הפער הגדול ביותר כאן הוא ב<strong>${biggest.label}</strong> · <bdi>${fmt(biggest.gap)}</bdi> נק׳ אחוז</p>`:''}
  ${legend(ownName,rivalName,true)}
  <div class="dna-team-scale" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
  <dl class="dna-team-chart">${rows.map(({id,label,a,b,gap})=>{
   const [ownSide,rivalSide]=teamSides(id,a,b);
   return `
   <div class="dna-team-line">
    <dt>${label}${gap==null?'':` <small>פער <bdi>${fmt(gap)}</bdi></small>`}</dt>
    <dd>
     <div class="dna-dot-track" aria-hidden="true">
      ${gap==null?'':`<i class="dna-dot-connector" style="--dna-start:${Math.min(a,b)}%;--dna-gap:${gap}%"></i>`}
      ${a==null?'':`<i class="dna-dot ${ownSide}" style="--dna-point:${a}%"></i>`}
      ${b==null?'':`<i class="dna-dot ${rivalSide}" style="--dna-point:${b}%"></i>`}
     </div>
     <div class="dna-dot-values">
      <bdi class="${ownSide}"><span class="dna-sr-only">${esc(ownName)} · </span>${teamIndicator(ownSide)}${fmt(a,'%')}</bdi>
      <bdi class="${rivalSide}"><span class="dna-sr-only">${esc(rivalName)} · </span>${teamIndicator(rivalSide)}${fmt(b,'%')}</bdi>
     </div>
    </dd>
   </div>`;
  }).join('')}</dl>
 </figure>`;
}
function metricDetails(out,content){
 const open=out.querySelector('.dna-expanded')?.open??true;
 return `<details class="dna-expanded"${open?' open':''}><summary>טבלת מדדים ומקורות</summary>${content}</details>`;
}
function teamMetricTable(title,description,rows){
 return `<section class="dna-team-metrics" aria-labelledby="dnaTeamMetricsTitle">
  <h4 id="dnaTeamMetricsTitle">${title}</h4>
  <p class="dna-explain">${description} לחיצה על מדד מציגה איך חושב.</p>
  <div class="dna-chart">${rows}</div>
 </section>`;
}
function teamSides(id,a,b){
 if(a==null||b==null||fmt(a)===fmt(b))return ['dna-own dna-even','dna-other dna-even'];
 const ownLeads=lowerTeamMetrics.has(id)?a<b:a>b;
 return ownLeads?['dna-own dna-ahead','dna-other dna-behind']:['dna-own dna-behind','dna-other dna-ahead'];
}
function teamIndicator(side){
 if(side.endsWith('dna-ahead'))return '<span class="dna-indicator" aria-label="מוביל במדד" role="img">▲</span>';
 if(side.endsWith('dna-behind'))return '<span class="dna-indicator" aria-label="מאחור במדד" role="img">▼</span>';
 return '';
}
function valueCell(stat,rating,unit,side,{league=false,singleGame=false,bar=rating,showRank=true,name}={}){
 const real=stat?.value!=null;
 const sample=league?(stat.count+' קבוצות במדגם'):(stat.count+' / '+stat.total+' משחקים');
 const display=real?fmt(stat.value,unit):'חסר נתון';
 return `<div class="dna-value ${side}">
  ${name?`<div class="dna-value-name"><bdi>${esc(name)}</bdi></div>`:''}
  <div class="dna-value-top"><strong>${teamIndicator(side)}<bdi>${esc(display)}</bdi></strong>${rating===null?'':`<bdi class="dna-rank">${rating}/100</bdi>`}</div>
  ${bar===null?'':`<div class="dna-track" aria-hidden="true"><i style="--dna-width:${bar}%"></i></div>`}
  ${singleGame?'':`<small>${esc(sample)}${showRank&&real&&!league&&rating===null?' · ללא דירוג':''}</small>`}
 </div>`;
}
function row(metric,left,right='',difference=''){
 const [id,label,,source,help]=metric;
 return `<details class="dna-row" data-metric="${id}">
  <summary><span class="dna-metric-name"><b>${label}</b><small>${sources[source]}${difference}</small></span>
  <div class="dna-values${right?' dna-pair':''}">${left}${right}</div>
  ${id==='usage'?'<span class="dna-context">החלק מהתקפות הקבוצה שהשחקן סיים בזריקה, בעונשין או באיבוד, כשהיה על המגרש.</span>':''}</summary>
  <p>${help}</p>
 </details>`;
}
function calc(records,gameLimit,metrics){
 return new Map(records.map(record=>[record,C.summarize(C.select(record.games,gameLimit),metrics)]));
}
function teamAnalysis(gameLimit,metrics){
 const stats=calc(model.teams,gameLimit,metrics);
 const benchmarks=Object.fromEntries(metrics.map(([id])=>[id,C.benchmark([...stats.values()].map(s=>s[id]),id)]));
 return {stats,benchmarks};
}
function playerHistory(record,games,heading){
 if(!games.length)return empty('אין לשחקן הופעות מול היריבה הזו ביורוליג העונה.');
 const metrics=[['דקות',g=>g.minutes],['נקודות',g=>g.stats?.points],['PIR',g=>g.stats?.valuation]];
 const usageMetric=C.playerMetrics.filter(([id])=>id==='usage');
 const usage=rows=>fmt(C.summarize(rows,usageMetric).usage.value,'%');
 const averages=rows=>metrics.map(([,value])=>{
  const values=rows.map(value).filter(Number.isFinite);
  return fmt(values.length?values.reduce((sum,n)=>sum+n,0)/values.length:null);
 });
 const cells=values=>values.map(v=>'<td><bdi>'+v+'</bdi></td>').join('');
 const averageRow=(rows,label)=>'<tr><th scope="row">'+label+'</th>'+cells([...averages(rows),usage(rows)])+'</tr>';
 return `<h4>${heading}</h4><table class="dna-history-table">
 <thead><tr><th scope="col">משחק</th>${metrics.map(([label])=>'<th scope="col">'+label+'</th>').join('')}<th scope="col">Usage</th></tr></thead>
 <tbody>${games.map(g=>`<tr><th scope="row"><bdi>${fullDate.format(new Date(g.date))}</bdi>
 <small>${g.home?'בית':'חוץ'}${g.team===record.team?'':' · '+esc(g.team)}</small></th>
 ${cells([...metrics.map(([,value])=>fmt(value(g)??null)),usage([g])])}</tr>`).join('')}</tbody>
 <tfoot>${games.length>1?averageRow(games,'ממוצע מולה'):''}${averageRow(record.seasonGames,'ממוצע העונה')}</tfoot></table>`;
}
function guidance(p,record,own,rival,gameLimit){
 const names=fixtureFor(own.team,rival.team);
 const metrics=[...C.offense,...C.defense];
 const {stats,benchmarks}=teamAnalysis(gameLimit,metrics);
 const ownStats=stats.get(own),rivalStats=stats.get(rival);
 const signals=[];
 const addSignal=(playerMetric,allowedMetric,text)=>{
  const a=p[playerMetric],b=benchmarks[allowedMetric].percentile(rivalStats[allowedMetric]);
  if(a==null||a<70||b==null||b<65)return;
  const [,label,unit]=C.defense.find(([id])=>id===allowedMetric);
  signals.push(`<li><strong>${text}</strong><span>${label} · ${fmt(rivalStats[allowedMetric].value,unit)} מול ${fmt(benchmarks[allowedMetric].mean,unit)} בליגה</span></li>`);
 };
 addSignal('three','allowedThree','יותר דיוק משלוש אצל יריבות הקבוצה');
 addSignal('offRebound','allowedRebound','היריבה מאפשרת יותר ריבאונד התקפה');
 addSignal('drawn','allowedFouls','היריבות סוחטות מולה יותר עבירות');
 const pace=benchmarks.pace;
 const rivalPace=rivalStats.pace,ownPace=ownStats.pace;
 if(pace.percentile(rivalPace)!==null&&pace.percentile(ownPace)!==null&&rivalPace.value+2<=ownPace.value){
  signals.push(`<li><strong>קצב היריבה איטי יותר במדגם</strong><span>${fmt(rivalPace.value,'pos')} מול ${fmt(ownPace.value,'pos')} לקבוצת השחקן</span></li>`);
 }
 const rivalProfile=metrics.filter(([id])=>['pace','allowedThree','allowedRebound','allowedFouls'].includes(id));
 return `<aside class="dna-match"><div class="dna-match-head"><div><span class="dna-kicker">${names?'המשחק הבא':'מאצ׳אפ מול קבוצה'}</span>
 <h3><bdi>${esc(own.team)}</bdi> מול <bdi>${esc(rival.team)}</bdi></h3>${names?'<small>'+esc(names)+'</small>':''}</div>
 <div class="dna-match-actions">
 <button type="button" class="secondary" data-player-past>משחקי עבר מול היריבה</button>
 <button type="button" class="secondary" data-compare-teams>השוואת הקבוצות</button></div></div>
 ${playerHistory(record,record.seasonGames.filter(g=>g.opponent===rival.team),'הופעות מול היריבה העונה')}
 <section class="dna-rival-profile"><h4>נתוני היריבה מול ממוצע הליגה</h4>
 <dl>${rivalProfile.map(([id,label,unit])=>`<div><dt>${label}</dt><dd><bdi>${fmt(rivalStats[id].value,unit)}</bdi>
 <small>ליגה · <bdi>${fmt(benchmarks[id].mean,unit)}</bdi></small></dd></div>`).join('')}</dl>
 ${signals.length?'<ul>'+signals.join('')+'</ul>':''}
 <p>נתוני הקבוצות לפי הטווח שבחרת.</p></section></aside>`;
}
function renderPlayerGame(out,record,games){
 const game=games.find(g=>String(g.gameCode)===playerGame);
 if(!game){out.innerHTML=games.length?empty('בחר משחק כדי לראות את נתוני השחקן.'):'';return;}
 const stats=C.summarize([game],C.playerMetrics);
 out.innerHTML=`${playerProfile(record,[game])}
 ${playerStyle(stats)}
 <div class="dna-match"><span class="dna-kicker">משחק עבר · 2026/27</span>
 <h3>נתוני המשחק</h3>
 <p><bdi>${esc(game.team)}</bdi> מול <bdi>${esc(game.opponent)}</bdi> · <bdi>${fullDate.format(new Date(game.date))}</bdi></p>
 ${playerHistory(record,[game],'נתוני המשחק מול ממוצע העונה')}</div>`;
 loadPortraits(out);
}
function playerStyleComparison(record,gameLimit,rival){
 const againstTeam=playerView==='team';
 const select=player.$(againstTeam?'[data-compare-club]':'[data-compare-player]');
 const opponent=againstTeam?rival:model.players.find(p=>p.id===select.value);
 if(!opponent)return empty(againstTeam?'בחר קבוצה כדי להשוות סגנונות.':'בחר שחקן כדי להשוות סגנונות.');
 const metrics=againstTeam?sharedStyleMetrics:C.playerMetrics;
 const opponentName=againstTeam?opponent.team:opponent.name;
 const ownGames=C.select(record.seasonGames,gameLimit);
 const otherGames=C.select(againstTeam?opponent.games:opponent.seasonGames,gameLimit);
 const ownStats=C.summarize(ownGames,metrics),otherStats=C.summarize(otherGames,metrics);
 const biggest=metrics.filter(([id,,unit])=>unit==='%'&&ownStats[id].value!=null&&otherStats[id].value!=null)
  .map(([id,label])=>({label,gap:ownStats[id].value-otherStats[id].value}))
  .sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap))[0];
 return `<section class="dna-style-compare">
  <h4>השוואת סגנון</h4>
  <p class="dna-explain">${againstTeam?'ההשוואה משתמשת בשיעורים שמחושבים באותו אופן לשחקן ולקבוצה. ':''}${gameLimit?'שלושת המשחקים האחרונים של כל צד.':'כל משחקי העונה הזמינים בטווח.'}</p>
  ${biggest&&fmt(biggest.gap)!==fmt(0)?`<p class="dna-gap-lead">הפער הגדול ביותר במדדי האחוזים · <strong>${biggest.label}</strong> · <bdi>${fmt(Math.abs(biggest.gap))}</bdi> נק׳ אחוז יותר אצל <bdi>${esc(biggest.gap>0?record.name:opponentName)}</bdi></p>`:''}
  ${legend(record.name,opponentName)}
  <div class="dna-chart">${comparisonRows(metrics,ownStats,otherStats,undefined,{teamColors:false,singleGame:false})}</div>
 </section>`;
}
function renderPlayer(){
 if(!model)return;
 const out=player.$('[data-dna-results]');
 const record=selectedPlayer();
 const compareAvailable=!!record&&playerRange.value!=='history';
 player.$('[data-player-switch]').hidden=!compareAvailable;
 for(const b of player.section.querySelectorAll('[data-player-view]')){
  b.setAttribute('aria-pressed',String(b.dataset.playerView===playerView));
 }
 player.$('[data-compare-player]').parentElement.hidden=!compareAvailable||playerView!=='player';
 player.$('[data-compare-club]').parentElement.hidden=!compareAvailable||playerView!=='team';
 if(!record){
  const prompt='בחר שחקן כדי לראות את פרופיל המשחק שלו.';
  if(playerRange.expanded)playerRange.games([],playerGame,null,'PIR',prompt);
  out.innerHTML=playerRange.expanded?'':empty(prompt);
  return;
 }
 const selectedRival=player.$('[data-player-rival]').value;
 if(playerRange.value==='history'){
  const games=record.seasonGames.filter(g=>!selectedRival||g.opponent===selectedRival);
  if(playerRange.expanded)playerRange.games(games.map(g=>({...g,code:g.gameCode,detail:fmt(g.stats?.valuation)})),playerGame,code=>{
   playerGame=code;renderPlayerGame(out,record,games);
  },'PIR','אין לשחקן הופעות העונה בסינון שנבחר.');
  renderPlayerGame(out,record,games);
  return;
 }
 const gameLimit=Number(playerRange.value),games=C.select(record.games,gameLimit);
 const position=positionLabels[record.position];
 const peers=model.players.filter(p=>record.position&&p.position===record.position);
 const stats=calc(peers,gameLimit,C.playerMetrics);
 const own=stats.get(record)||C.summarize(games,C.playerMetrics);
 const ratings=Object.fromEntries(C.playerMetrics.map(([id])=>[id,C.benchmark([...stats.values()].map(s=>s[id]),id,true).percentile(own[id])]));
 const tags=Object.entries(styleTags).filter(([id])=>ratings[id]>=70).sort(([a],[b])=>ratings[b]-ratings[a]);
 const target=playerView==='team'?player.$('[data-compare-club]').value:selectedRival;
 const opponent=target==='next'?nextOpponent(record.team):target;
 const club=model.teams.find(t=>t.team===record.team),rival=model.teams.find(t=>t.team===opponent);
 const matching=club&&rival&&club!==rival&&playerView!=='player'?guidance(ratings,record,club,rival,gameLimit):'';
 const style=playerView==='profile'
  ?games.length?playerStyle(own,ratings,position):empty('לשחקן אין הופעות מתועדות בקבוצה הזו בעונה הנוכחית.')
  :playerStyleComparison(record,gameLimit,rival);
 out.innerHTML=`${playerProfile(record,games,tags)}
 ${style}${matching}`;
 loadPortraits(out);
 const previous=out.querySelector('[data-player-past]');
 if(previous)previous.onclick=()=>{
  playerRange.set('history');
  playerGame='';
  selectPlayerRivals();
  player.$('[data-player-rival]').value=opponent;
  paint();
  playerRange.focusHistory();
 };
 const compare=out.querySelector('[data-compare-teams]');
 if(compare)compare.onclick=()=>{
  teams.$('[data-team]').value=record.team;
  selectOpponents();teams.$('[data-opponent]').value=target;
  teamRange.set('0');
  view='offense';
  teams.button.click();
  teams.section.setAttribute('tabindex','-1');
  teams.section.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'auto'});
 };
}
function comparisonRows(metrics,ownStats,rivalStats,benchmarks,{teamColors=true,singleGame=!benchmarks,names=[]}={}){
 return metrics.map(metric=>{
  const [id,,unit]=metric,ref=benchmarks?.[id],a=ownStats[id],b=rivalStats?.[id]||{value:ref.mean,count:ref.count};
  const gap=a.value==null||b.value==null?null:a.value-b.value;
  const diff=gap==null?'':` · פער <bdi>${fmt(Math.abs(gap))}</bdi>${unit==='%'?' נק׳ אחוז':unitLabels[unit]||''}`;
  const max=unit==='%'?100:Math.max(a.value??0,b.value??0);
  const width=stat=>stat.value==null?null:max>0?Math.min(100,stat.value/max*100):0;
  const [ownSide,rivalSide]=teamColors?teamSides(id,a.value,b.value):['dna-own','dna-other'];
  return row(metric,valueCell(a,ref?.percentile(a)??null,unit,ownSide,{singleGame,bar:ref?undefined:width(a),showRank:!!ref,name:names[0]}),
   valueCell(b,rivalStats?(ref?.percentile(b)??null):null,unit,rivalSide,{league:!rivalStats,singleGame,bar:ref?undefined:width(b),showRank:!!ref,name:names[1]}),diff);
 }).join('');
}
function legend(own,rival,teamColors=false){
 return `<div class="dna-legend"><span class="dna-own${teamColors?' dna-even':''}">${teamColors?'':'<i></i>'}<bdi>${esc(own)}</bdi></span><span class="dna-other${teamColors?' dna-even':''}">${teamColors?'':'<i></i>'}<bdi>${esc(rival)}</bdi></span></div>`;
}
function renderHistory(out,metrics,games){
 const game=games.find(g=>String(g.code)===teamGame);
 teams.$('[data-team-switch]').hidden=!game;
 if(!game){
  out.innerHTML=games.length?empty('בחר משחק כדי לראות את ההשוואה.'):'';
  return;
 }
 const other=model.teams.find(t=>t.team===game.opponent)?.games.find(g=>g.code===game.code);
 const ownStats=C.summarize([game],metrics),rivalStats=C.summarize(other?[other]:[],metrics);
 out.innerHTML=`<header class="dna-profile dna-compare-head"><span class="dna-kicker">מפגש עבר · 2026/27</span>
 <h3><bdi>${esc(game.team)}</bdi> <bdi>${game.points}–${game.against}</bdi> <bdi>${esc(game.opponent)}</bdi></h3>
 <p>${fullDate.format(new Date(game.date))}</p></header>
 ${teamMetricTable(view==='defense'?'מה היריבות עשו מול כל קבוצה במשחק':'איך הקבוצות שיחקו בהתקפה',
  view==='defense'?'מתחת לכל קבוצה מוצגים הנתונים של היריבה ששיחקה מולה.':'הערכים מתייחסים למשחק שנבחר.',
  comparisonRows(metrics,ownStats,rivalStats,undefined,{names:[game.team,game.opponent]}))}`;
}
function renderTeams(updateGames=true){
 if(!model)return;
 const out=teams.$('[data-dna-results]');
 for(const b of teams.section.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 const selectedRange=teamRange.value,metrics=view==='offense'?C.offense:C.defense;
 const history=selectedRange==='history';
 const own=model.teams.find(t=>t.team===teams.$('[data-team]').value);
 teams.$('[data-team-pair]').hidden=history;
 teams.$('[data-team]').options[0].textContent=history?'כל הקבוצות':'בחר קבוצה';
 if(history){
  const games=teamGames.filter(g=>!own||g.team===own.team||g.opponent===own.team);
  if(updateGames&&teamRange.expanded)teamRange.games(games.map(g=>({...g,detail:g.points+'–'+g.against})),teamGame,code=>{
   teamGame=code;renderTeams(false);
  },'תוצאה');
  renderHistory(out,metrics,games);
  return;
 }
 teams.$('[data-team-switch]').hidden=false;
 if(!own){out.innerHTML=empty('בחר קבוצה להשוואה מול היריבה הבאה, קבוצה אחרת או ממוצע הליגה.');return;}
 const compare=teams.$('[data-opponent]').value;
 const opponent=compare==='next'?nextOpponent(own.team):compare;
 const rival=model.teams.find(t=>t.team===opponent);
 const {stats,benchmarks}=teamAnalysis(Number(selectedRange),metrics);
 const ownStats=stats.get(own),rivalStats=stats.get(rival);
 const heading=rival?.team||'ממוצע הליגה';
 const match=rival?fixtureFor(own.team,rival.team):'';
 const sizeNote=view==='offense'&&model.bands?'<p class="dna-explain">נתוני חמישיות גבוהות ונמוכות מבוססים על דקות שבהן אפשר לאמת את ההרכב. ספי המדגם · נמוכה עד '+fmt(model.bands.low,'cm')+' · גבוהה החל מ־'+fmt(model.bands.high,'cm')+'</p>':'';
 const leagueStats=Object.fromEntries(metrics.map(([id])=>[id,{value:benchmarks[id].mean}]));
 const pace=ownStats.pace?.value,otherPace=(rivalStats||leagueStats).pace?.value;
 const [ownPaceSide,otherPaceSide]=teamSides('pace',pace,otherPace);
 const selectedGames=record=>C.select(record.games,Number(selectedRange)).length;
 const metricTable=view==='defense'
  ?teamMetricTable('מה היריבות עושות מול כל קבוצה',
   'הערך תחת כל קבוצה מתאר את ביצועי היריבות מולה. הדירוג הוא ביחס לליגה בטווח שנבחר.',
   comparisonRows(metrics,ownStats,rivalStats,benchmarks,{names:[own.team,heading]}))
  :teamStyle(metrics,ownStats,rivalStats||leagueStats,own.team,heading)+
   metricDetails(out,`<p class="dna-explain">הדירוגים בטבלה משווים כל קבוצה למדגם הליגה בטווח שנבחר. לחיצה על מדד מציגה איך חושב.</p>
   ${legend(own.team,heading,true)}
   <div class="dna-chart">${comparisonRows(metrics,ownStats,rivalStats,benchmarks)}</div>${sizeNote}`);
 out.innerHTML=`<section class="dna-profile">
 <span class="dna-kicker">השוואת סגנונות</span>
 <div class="dna-team-pair">
  <div class="dna-identity">${portrait(own.team,clubCrests.get(own.team),'club')}<div><h3><bdi>${esc(own.team)}</bdi></h3><p>${selectedGames(own)} משחקים בטווח</p></div></div>
  <span class="dna-versus">מול</span>
  <div class="dna-identity">${rival?portrait(heading,clubCrests.get(heading),'club'):''}<div><h3><bdi>${esc(heading)}</bdi></h3>${rival?`<p>${selectedGames(rival)} משחקים בטווח</p>`:''}</div></div>
 </div>${match?'<p class="dna-fixture">'+esc(match)+'</p>':''}
 ${pace!=null||otherPace!=null?`<div class="dna-pace"><bdi class="${ownPaceSide}">${teamIndicator(ownPaceSide)}${fmt(pace)}</bdi><span class="dna-pace-label">פוזשנים ל־40 דקות</span><bdi class="${otherPaceSide}">${teamIndicator(otherPaceSide)}${fmt(otherPace)}</bdi></div>`:''}</section>
 ${metricTable}`;
 loadPortraits(out);
}
function paint(){
 const visible=panels.find(p=>p.section.classList.contains('active'));
 if(visible===player)renderPlayer();
 if(visible===teams){
  renderTeams();
 }
}
function changePlayer(){
 manualPlayer=true;
 window.playerToolSelection?.set(selectedPlayer()?.name,playerRange.value);
 playerGame='';
 player.$('[data-player-rival]').value='';
 selectPlayerRivals();selectStyleTargets();
 paint();
}
player.$('[data-scope]').onchange=()=>{selectPlayers();changePlayer();};
player.$('[data-player]').onchange=changePlayer;
player.$('[data-player-rival]').onchange=()=>{playerGame='';paint();};
player.$('[data-compare-player]').onchange=paint;
player.$('[data-compare-club]').onchange=paint;
for(const b of player.section.querySelectorAll('[data-player-view]'))b.onclick=()=>{
 playerView=b.dataset.playerView;
 selectPlayerRivals();paint();
};
teams.$('[data-team]').onchange=()=>{
 teamGame='';selectOpponents();
 if([...teams.$('[data-opponent]').options].some(o=>o.value==='next'))teams.$('[data-opponent]').value='next';
 paint();
};
teams.$('[data-opponent]').onchange=paint;
for(const b of teams.section.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;renderTeams(false);};
})();
