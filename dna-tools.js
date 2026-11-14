(()=>{
'use strict';
const C=window.DnaCore,T=window.TeamMetricsCore,S=window.SeasonGamePicker,M=window.PlayerDnaMetrics;
const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');
if(!C||!T||!S||!M||!nav||!main)return;

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
const lowerIsBetter=new Set(['turnovers','fouls','allowedThree','allowedTwo','allowedRebound','allowedFouls']);
const fmt=(value,unit='')=>value==null?'—':decimal.format(value)+(unitLabels[unit]||'');
const price=p=>Number.isFinite(p.price)&&p.price>0?fmt(p.price)+' CR':'';
const labelName=name=>name.includes(',')?name.split(',').reverse().map(s=>s.trim()).join(' '):name;
const option=(value,name)=>new Option(name,value);
const empty=message=>'<p class="dna-empty">'+esc(message)+'</p>';
let model=null,fixtures=[],pending=null,lastLoad=0;
let teamGames=[],teamGame='',playerGame='',playerView='profile',manualPlayer=false;
let playerPhotos={},clubCrests=new Map(),playerVenue='all';
let playerAnalysisCache;

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
 <div class="dna-switch dna-venue" data-player-venue role="group" aria-label="בית וחוץ">
  <button type="button" data-venue="all" aria-pressed="true">הכול</button>
  <button type="button" data-venue="home" aria-pressed="false">בית</button>
  <button type="button" data-venue="away" aria-pressed="false">חוץ</button>
 </div>
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
},[['0','כל העונה'],['5','5 משחקים'],['3','3 משחקים'],['1','משחק אחרון'],['history','משחקי עבר']]);
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
 player.$('[data-player-rival-label]').hidden=!record||playerRange.value!=='history';
 if(!record){select.replaceChildren();return;}
 const counts=new Map();
 for(const g of record.seasonGames)counts.set(g.opponent,(counts.get(g.opponent)||0)+1);
 const rivals=model.teams.map(t=>t.team).filter(team=>team!==record.team||counts.has(team))
  .sort((a,b)=>(counts.get(b)||0)-(counts.get(a)||0)||a.localeCompare(b));
 const first=option('','כל היריבות');
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
   const scheduleGames=(schedule?.data||[]).filter(g=>g.season?.code===C.season&&g.isNeutralVenue);
   const neutral=new Set(scheduleGames.map(g=>String(g.gameCode)));
   for(const p of built.players)for(const g of p.games)g.neutral=neutral.has(String(g.gameCode));
   for(const t of built.teams)for(const g of t.games)g.neutral=neutral.has(String(g.code));
   const dna=M.seasonContext({...official,teamResults:official.teamResults.map(g=>({...g,neutral:neutral.has(String(g.gameCode))}))},events);
   model={...built,players:roster(built.players,market),dna};
   playerAnalysisCache=null;
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
function playerStyle(stats,ratings,position,radar=''){
 const three=stats.three.value;
 const ranked=!!ratings;
 return `<section class="${radar?'dna-player-style-profile':'dna-player-style'}">
  ${radar?'<div class="dna-player-visuals">':''}
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
  ${radar}
  ${radar?'</div>':''}
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
     </th><td><bdi>${stat.value==null?'אין מספיק נתונים':fmt(stat.value,unit)}</bdi></td>
     ${ranked?`<td>${rating==null?'<span class="dna-rank-missing" aria-label="ללא דירוג">—</span>':`<div class="dna-percentile">
      <bdi>${rating}</bdi><span class="dna-track" aria-hidden="true"><i style="--dna-width:${rating}%"></i></span></div>`}</td>`:''}</tr>`;
    }).join('')}</tbody>
   </table>
  </section>
 </section>`;
}
function teamMetricTable(title,description,rows){
 return `<section class="dna-team-metrics" aria-labelledby="dnaTeamMetricsTitle">
  <h4 id="dnaTeamMetricsTitle">${title}</h4>
  <p class="dna-explain">${description} לחיצה על מדד מציגה איך חושב.</p>
  <div class="dna-chart">${rows}</div>
 </section>`;
}
function comparisonSides(id,a,b){
 if(a==null||b==null||fmt(a)===fmt(b))return ['dna-own dna-even','dna-other dna-even'];
 const ownLeads=lowerIsBetter.has(id)?a<b:a>b;
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
 const display=real?fmt(stat.value,unit):'אין מספיק נתונים';
 return `<div class="dna-value ${side}">
  ${name?`<div class="dna-value-name"><bdi>${esc(name)}</bdi></div>`:''}
  <div class="dna-value-top"><strong>${teamIndicator(side)}<bdi>${esc(display)}</bdi></strong>${rating===null?'':`<bdi class="dna-rank">${rating}/100</bdi>`}</div>
  ${bar===null?'':`<div class="dna-track" aria-hidden="true"><i style="--dna-width:${bar}%"></i></div>`}
  ${singleGame?'':`<small>${esc(sample)}${showRank&&real&&!league&&rating===null?' · ללא דירוג':''}</small>`}
 </div>`;
}
function row(metric,left,right='',difference='',playerComparison=false){
 const [id,label,,source,help]=metric;
 return `<details class="dna-row" data-metric="${id}">
  <summary><span class="dna-metric-name"><b>${label}</b><small>${sources[source]}${difference}</small></span>
  <div class="dna-values${right?' dna-pair':''}">${left}${right}</div>
 ${playerComparison?metricAction('מה זה אומר?','סגור הסבר'):''}
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
function renderPlayerGame(out,record,games){
 const game=games.find(g=>String(g.gameCode)===playerGame);
 if(!game){out.innerHTML=games.length?empty('בחר משחק כדי לראות את נתוני השחקן.'):'';return;}
 const stats=C.summarize([game],C.playerMetrics);
 out.innerHTML=`${playerProfile(record,[game])}
 ${playerStyle(stats)}
 ${expandedMetrics(M.summarize(record,model.dna,{gameCode:game.gameCode}),null)}
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
 const ownGames=M.select(record.games,gameLimit,playerVenue);
 const otherGames=M.select(opponent.games,gameLimit,playerVenue);
 const ownStats=C.summarize(ownGames,metrics),otherStats=C.summarize(otherGames,metrics);
 const biggest=metrics.filter(([id,,unit])=>unit==='%'&&ownStats[id].value!=null&&otherStats[id].value!=null)
  .map(([id,label])=>({label,gap:ownStats[id].value-otherStats[id].value}))
  .sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap))[0];
 return `<section class="dna-style-compare${againstTeam?'':' dna-player-compare'}">
  <h4>השוואת סגנון</h4>
  <p class="dna-explain">${againstTeam?'ההשוואה משתמשת בשיעורים שמחושבים באותו אופן לשחקן ולקבוצה. ':''}${gameLimit?gameLimit+' ההופעות האחרונות של כל צד (לפי הזמינות).':'כל משחקי העונה הזמינים בטווח.'}</p>
  ${biggest&&fmt(biggest.gap)!==fmt(0)?`<p class="dna-gap-lead">הפער הגדול ביותר במדדי האחוזים · <strong>${biggest.label}</strong> · <bdi>${fmt(Math.abs(biggest.gap))}</bdi> נק׳ אחוז יותר אצל <bdi>${esc(biggest.gap>0?record.name:opponentName)}</bdi></p>`:''}
  ${legend(record.name,opponentName)}
  <div class="dna-chart">${comparisonRows(metrics,ownStats,otherStats,undefined,{highlightAdvantage:!againstTeam,singleGame:false,names:[record.name,opponentName],playerComparison:!againstTeam})}</div>
 </section>`;
}
function buildPlayerAnalysis(options){
 const {limit,venue}=options;
 const base=new Map(),detail=new Map(),baseRanks=new Map(),detailRanks=new Map();
 for(const p of model.players){
  base.set(p,C.summarize(M.select(p.games,limit,venue),C.playerMetrics));
  detail.set(p,M.summarize(p,model.dna,options));
 }
 const positions=new Map();
 for(const p of model.players){
  if(!positions.has(p.position))positions.set(p.position,[]);
  positions.get(p.position).push(p);
 }
 for(const peers of positions.values()){
  const benchmarks=Object.fromEntries(C.playerMetrics.map(([id])=>[id,C.benchmark(peers.map(p=>base.get(p)[id]),id,true)]));
  const samples=Object.fromEntries(M.catalog.map(({id})=>[id,peers.map(p=>detail.get(p).stats[id])]));
  for(const p of peers){
   baseRanks.set(p,Object.fromEntries(C.playerMetrics.map(([id])=>[id,benchmarks[id].percentile(base.get(p)[id])])));
   detailRanks.set(p,Object.fromEntries(M.catalog.map(({id})=>[id,M.rank(detail.get(p).stats[id],id,samples[id])])));
  }
 }
 for(const id of ['defPir','defShare']){
  const league=[...detail.values()].map(r=>r.stats[id]);
  const mean=league.filter(stat=>stat.value!=null&&stat.count>=3&&stat.minutes>=45);
  const leagueMean=mean.length?mean.reduce((sum,stat)=>sum+stat.value,0)/mean.length:null;
  for(const r of detail.values()){
   const stat=r.stats[id];
   if(stat.value==null)continue;
   stat.details=[...(stat.details||[]),['ממוצע ליגה',leagueMean,M.catalog.find(m=>m.id===id).unit],
    ['אחוזון ליגה',M.rank(stat,id,league),'מתוך 100']];
  }
 }
 playerAnalysisCache={...options,base,detail,baseRanks,detailRanks,rivals:new Map()};
 return playerAnalysisCache;
}

const radarAxes=[
 ['קליעה',['ts']],['שלשות',['threeAccuracy']],['צבע',['rimAccuracy']],['יצירת משחק',['assists']],
 ['מתפרצות',['fastbreak']],['ריבאונד',['offRebound','defRebound']],['הגנה',['steals','blocks']],
 ['סחיטת עבירות',['drawn']],['יציבות',['pirStability']],['יעילות',['pir40']]
];
function playerRadar(reports,record,compare,{profile=false}={}){
 const values=p=>radarAxes.map(([,ids])=>{
  const ranks={...reports.baseRanks.get(p),...reports.detailRanks.get(p)};
  const available=ids.map(id=>ranks[id]).filter(Number.isFinite);
  return available.length===ids.length?available.reduce((a,b)=>a+b,0)/available.length:null;
 });
 const first=values(record),second=compare?values(compare):null;
 const point=(i,scale)=>{
  const angle=2*Math.PI*i/radarAxes.length-Math.PI/2;
  return [170+Math.cos(angle)*104*scale,129+Math.sin(angle)*104*scale];
 };
 const perimeter=scale=>radarAxes.map((_,i)=>point(i,scale).join(',')).join(' ');
 const rings=[.25,.5,.75,1].map(scale=>`<polygon points="${perimeter(scale)}"/>`).join('');
 const spokes=radarAxes.map((_,i)=>{
  const [x,y]=point(i,1);
  return `<line x1="170" y1="129" x2="${x}" y2="${y}"/>`;
 }).join('');
 const display=(r,kind)=>{
  const points=r.map((v,i)=>v==null?null:point(i,v/100));
  const area=points.every(Boolean)?`<polygon class="dna-radar-fill" points="${points.join(' ')}"/>`:'';
  const edges=points.map((p,i)=>{
   const next=points[(i+1)%points.length];
   return p&&next?`<line x1="${p[0]}" y1="${p[1]}" x2="${next[0]}" y2="${next[1]}"/>`:'';
  }).join('');
  const markers=points.map((p,i)=>p?`<g${profile?'':` data-radar-axis="${i}"`}>
   ${profile?'':`<circle class="dna-radar-hit" cx="${p[0]}" cy="${p[1]}" r="13"/>`}
   <circle class="dna-radar-dot" cx="${p[0]}" cy="${p[1]}" r="3.5"/></g>`:'').join('');
  return `<g class="${kind}">${area}${edges}${markers}</g>`;
 };
 const labels=radarAxes.map(([label],i)=>{
  const [x,y]=point(i,profile?1.19:1.14);
  const name=`<text x="${x}" y="${y}" direction="rtl">${label}</text>`;
  return profile?`${name}
   <text class="dna-radar-inline-score" x="${x}" y="${y+18}" direction="ltr">${fmt(first[i])}</text>`:name;
 }).join('');
 const score=(n,kind)=>`<bdi class="${kind}">${n??'—'}</bdi>`;
 const scores=profile?'':radarAxes.map(([label],i)=>{
  const text=[record,compare].filter(Boolean).map((p,j)=>{
   const rank=(j?second:first)[i];
   return `<span><bdi>${esc(p.name)}</bdi> · ${rank==null?'ללא דירוג':`<bdi>${rank}</bdi> מתוך 100`}</span>`;
  }).join('');
  return `<li><button type="button" data-radar-score="${i}" aria-pressed="false">
   <span>${label}</span><strong>${score(first[i],'dna-own')}${second?score(second[i],'dna-other'):''}</strong></button>
   <template>${label} · ${text}</template></li>`;
 }).join('');
 const accessibility=profile
  ?`role="img" aria-label="${radarAxes.map(([label],i)=>`${label}: ${first[i]==null?'ללא דירוג':fmt(first[i])+' מתוך 100'}`).join(', ')}"`
  :'aria-hidden="true"';
 return `<section class="dna-radar-card${profile?' dna-radar-profile':''}"><h4>רדאר DNA שחקן</h4>
 <p class="dna-explain">ככל שנקודה רחוקה מהמרכז, האחוזון של השחקן בעמדתו גבוה יותר בטווח שנבחר. נקודה חסרה מציינת מדגם שאינו מספיק לדירוג.</p>
 ${compare?legend(record.name,compare.name):''}
 <div class="dna-radar-layout"><div><svg viewBox="${profile?'-8 -5 356 291':'0 0 340 258'}" ${accessibility}>
  <g class="dna-radar-grid">${rings}${spokes}</g>${display(first,'dna-radar-own')}${second?display(second,'dna-radar-other'):''}${labels}
 </svg><div class="dna-radar-scale"><span>אחוזון</span><bdi>0 · 25 · 50 · 75 · 100</bdi></div></div>
 ${profile?'':`<ul class="dna-radar-scores" aria-label="ערכי הצירים">${scores}</ul>`}</div>
 ${profile?'':`<p class="dna-radar-selection" aria-live="polite">לחצו על נקודה או על שם ציר להצגת הציון המדויק.</p>`}</section>`;
}

function selectRadarAxis(event){
 const trigger=event.target.closest('[data-radar-axis],[data-radar-score]');
 if(!trigger)return;
 const card=trigger.closest('.dna-radar-card');
 const index=trigger.dataset.radarAxis??trigger.dataset.radarScore;
 const button=card.querySelector(`[data-radar-score="${index}"]`);
 for(const item of card.querySelectorAll('[data-radar-score]'))item.setAttribute('aria-pressed',String(item===button));
 for(const point of card.querySelectorAll('[data-radar-axis]'))point.classList.toggle('dna-point-selected',point.dataset.radarAxis===index);
 card.querySelector('.dna-radar-selection').replaceChildren(button.nextElementSibling.content.cloneNode(true));
}
player.$('[data-dna-results]').addEventListener('click',selectRadarAxis);

const metricById=new Map(M.catalog.map(m=>[m.id,m]));
const insideRows=new Set(Object.values(M.detailRows).flat());
const suffix=unit=>unit==='%'?'%':unit?' '+unit:'';
const expandedNumber=(v,unit)=>v==null?'אין מספיק נתונים':fmt(v)+suffix(unit);
const styleOnly=new Set(['usage','three','rim','fastbreak','secondChance']);
const barSpecs=[
 ...C.playerMetrics.map(([id,label,unit,source,help])=>({id,label,unit:unitLabels[unit].trim(),source:sources[source],help,
  direction:styleOnly.has(id)?0:lowerIsBetter.has(id)?-1:1})),
 ...['ts','rimAccuracy','pir40','pirStability'].map(id=>metricById.get(id))
];
const featuredBars=new Set(['ts','threeAccuracy','rimAccuracy','assists','drawn','offRebound','pir40']);
const interpretations={
 strong:['חוזקה יחסית לעמדה','dna-rank-strong'],
 middle:['בטווח הביניים בעמדה','dna-rank-middle'],
 weak:['חולשה יחסית לעמדה','dna-rank-weak'],
 neutral:['מתאר סגנון או היקף','dna-rank-neutral']
};
function rankBand(rank,direction){
 if(!direction)return 'neutral';
 // The existing percentile increases with the raw value, including for fouls and turnovers.
 const favorable=direction<0?100-rank:rank;
 return favorable>=75?'strong':favorable<=25?'weak':'middle';
}
function metricValue(stat,rank,spec,{name,side='',advantage=0,subject='עמדה'}={}){
 const visible=stat?.value!=null;
 const sample=stat?.total>0&&stat.count<=stat.total?`${stat.count} מתוך ${stat.total} משחקים`:stat?.count?`${stat.count} משחקים במדגם`:'';
 const [meaning,tone]=interpretations[rankBand(rank,spec.direction)];
 return `<div class="dna-expanded-value ${side} ${advantage>0?'dna-ahead':advantage<0?'dna-behind':''}">
  ${name?`<small class="dna-value-person"><bdi>${esc(name)}</bdi></small>`:''}
  <div class="dna-raw"><strong><bdi>${visible?fmt(stat.value):'אין מספיק נתונים'}</bdi></strong>
  ${visible&&spec.unit?`<span>${esc(spec.unit)}</span>`:''}</div>
  ${Number.isFinite(rank)?`<div class="dna-rank-line"><bdi>${rank} / 100</bdi><span>אחוזון ${subject}</span></div>
   <div class="dna-rank-track ${tone}" aria-hidden="true"><i style="--dna-width:${rank}%"></i></div>
   <small>${meaning}</small>`:`<small>${visible?'ללא אחוזון זמין':'אין ערך בטווח שנבחר'}</small>`}
  ${sample?`<small>${sample}</small>`:''}</div>`;
}
function metricPair(spec,stat,rank,comparison,subject){
 const {stat:other,rank:otherRank,name,ownName}=comparison||{};
 const paired=!!comparison;
 const gap=stat?.value!=null&&other?.value!=null?stat.value-other.value:null;
 const tied=gap!=null&&fmt(stat.value)===fmt(other.value);
 const advantage=gap==null||tied?0:Math.sign(spec.direction*gap);
 const unit=spec.unit==='%'?'נק׳ אחוז':spec.unit;
 return `<div class="dna-expanded-cells${paired?' dna-two-cells':''}">
  ${metricValue(stat,rank,spec,{name:ownName,side:paired?'dna-own':'',advantage,subject})}
  ${paired?metricValue(other,otherRank,spec,{name,side:'dna-other',advantage:-advantage}):''}</div>
  ${paired&&gap!=null?`<small class="dna-metric-gap">${tied?'שוויון בערכים המוצגים':`פער <bdi>${fmt(Math.abs(gap))}</bdi> ${esc(unit)}${advantage?` · יתרון ל־<bdi>${esc(advantage>0?ownName:name)}</bdi>`:''}`}</small>`:''}`;
}
function metricAction(label,close){
 return `<span class="dna-detail-action"><span>${label}</span><span>${close}</span><i aria-hidden="true"></i></span>`;
}
function playerBars(reports,record,compare){
 const ranks=p=>({...reports.baseRanks.get(p),...reports.detailRanks.get(p)});
 const stat=(p,id)=>reports.base.get(p)?.[id]??reports.detail.get(p)?.stats[id];
 const own=ranks(record),other=compare?ranks(compare):null;
 const bar=spec=>{
  const {id,label,help}=spec;
  return `<details class="dna-expanded-row dna-bar-row" data-dna-bar="${id}"><summary>
   <span class="dna-expanded-name"><b>${label}</b></span>
   ${metricPair(spec,stat(record,id),own[id],compare&&{stat:stat(compare,id),rank:other[id],name:compare.name,ownName:record.name})}
   ${metricAction('מה זה אומר?','סגור הסבר')}</summary><div class="dna-expanded-help"><p>${help}</p></div></details>`;
 };
 return `<section class="dna-bars"><h4>אחוזונים לפי מדד</h4>
 <p class="dna-explain">אורך הפס מציין את האחוזון בעמדה. צבע הפס מתחשב בכיוון המדד. למשל, פחות איבודים נחשבים ליתרון.</p>
 ${compare?legend(record.name,compare.name):''}
 <div class="dna-bars-grid">${barSpecs.filter(m=>featuredBars.has(m.id)).map(bar).join('')}</div>
 <details class="dna-more-bars"><summary>${metricAction('הצג מדדים נוספים','סגור מדדים נוספים')}</summary>
 <div class="dna-bars-grid">${barSpecs.filter(m=>!featuredBars.has(m.id)).map(bar).join('')}</div></details></section>`;
}

function playerDnaSummary(reports,record){
 const ranks={...reports.baseRanks.get(record),...reports.detailRanks.get(record)};
 const labeled=barSpecs.filter(({id,direction})=>direction&&Number.isFinite(ranks[id])).map(({id,label,direction})=>({
  label,direction,band:rankBand(ranks[id],direction),score:direction<0?100-ranks[id]:ranks[id]
 }));
 const names=(band,order)=>labeled.filter(m=>m.band===band).sort((a,b)=>order*(a.score-b.score)).slice(0,3)
  .map(({label,direction})=>direction<0?`${label} (${band==='strong'?'שיעור נמוך':'שיעור גבוה'})`:label);
 const strengths=names('strong',-1),weaknesses=names('weak',1);
 const list=new Intl.ListFormat('he',{type:'conjunction'});
 const lines=[];
 if(strengths.length)lines.push(`<p><strong class="dna-rank-strong">חוזקות ביחס לעמדה</strong> ${list.format(strengths)}</p>`);
 if(weaknesses.length)lines.push(`<p><strong class="dna-rank-weak">חולשות ביחס לעמדה</strong> ${list.format(weaknesses)}</p>`);
 if(!lines.length)lines.push(`<p>${labeled.length?'המדדים הזמינים עם כיוון מובהק נמצאים בטווח הביניים בעמדה.':'אין מספיק נתונים בטווח שנבחר לסיכום חוזקות וחולשות בעמדה.'}</p>`);
 return `<section class="dna-summary"><h4>סיכום DNA</h4>${lines.join('')}</section>`;
}

const categoryMeta={
 shooting:['◎','דיוק בקליעה ואזורי זריקה'],
 creation:['↗','מסירה, אסיסטים ומעורבות בהתקפה'],
 transition:['»','ייצור נקודות במעבר ואחרי ריבאונד התקפה'],
 boards:['▥','ריבאונד, חטיפות וחסימות'],
 fouls:['◉','סחיטת עבירות והגעה לקו'],
 negative:['−','איבודים, החטאות וחסימות שספג'],
 pir:['▤','תפוקה ורכיבי מדד היעילות'],
 role:['◷','דקות, פתיחה בחמישייה ושינויים בתפקיד'],
 opponent:['◇','מדדי היריבה והתאמה אליה'],
 lineups:['▦','תפוקה בחמישיות ועם שחקנים שונים'],
 summary:['≋','יציבות ותלות בדקות ובסגנון']
};
function expandedMetrics(report,ranks,{other,otherRanks,opponent,compareName,ownName,compact=false}={}){
 const metric=(spec,child=false)=>{
  const {id,group,label,source,help,unit}=spec,stat=report.stats[id];
  const compare=other&&group!=='opponent'&&!['matchFit','projection'].includes(id)
   ?{stat:other.stats[id],rank:otherRanks?.[id],name:compareName,ownName}:null;
  const subject=id==='matchFit'||id==='pirWeakness'?'בין יריבות':'עמדה';
  const detailItems=(rows,name)=>rows?.length?`<dl>${name?`<dt><bdi>${esc(name)}</bdi></dt><dd></dd>`:''}
   ${rows.map(([l,v,u])=>`<dt><bdi>${esc(l)}</bdi></dt><dd><bdi>${esc(expandedNumber(v,u??unit))}</bdi></dd>`).join('')}</dl>`:'';
  const ratioHint=id==='rebRatio'&&stat?.value!=null?`<p><bdi>${fmt(stat.value)}</bdi> ריבאונדי התקפה על כל ריבאונד הגנה אחד של השחקן.</p>`:'';
  const more=`<div class="dna-expanded-help"><p>${help}</p>${ratioHint}${detailItems(stat?.details,compare&&ownName)}
   ${detailItems(compare?.stat?.details,compareName)}
   ${(M.detailRows[id]||[]).map(key=>metric(metricById.get(key),true)).join('')}</div>`;
  return `<details class="dna-expanded-row${child?' dna-submetric':''}" data-metric="${id}"><summary>
   <span class="dna-expanded-name"><b>${label}</b><small>${source}${stat?.context?` · מול <bdi>${esc(stat.context)}</bdi>`:''}</small></span>
   ${metricPair(spec,stat,stat?.rank??ranks?.[id],compare,subject)}
   ${metricAction('מה זה אומר?','סגור הסבר')}</summary>${more}</details>`;
 };
 return `<section class="dna-expanded-groups${compact?' dna-compact-metrics':''}"><h4>ניתוח לפי קטגוריות</h4>
 ${Object.entries(M.groups).map(([group,label])=>{
  if(group==='opponent'&&!opponent&&!ownName)return '';
  const rows=M.catalog.filter(m=>m.group===group&&!insideRows.has(m.id));
  const [icon,description]=categoryMeta[group];
  return `<details class="dna-category" data-dna-group="${group}"><summary>
   <span class="dna-category-icon" aria-hidden="true">${icon}</span>
   <span class="dna-category-title"><b>${label}</b><small>${description}${group==='opponent'?` · <bdi>${esc(opponent||'אין יריבה מזוהה כרגע')}</bdi>`:''}</small></span>
   ${metricAction('הצג מדדים','סגור מדדים')}</summary>
   <div class="dna-category-grid">${rows.map(m=>metric(m)).join('')}
   ${M.missing.filter(([g])=>g===group).map(([,name,why])=>`<details class="dna-unavailable"><summary><b>${name}</b><small>אין מספיק נתונים</small>${metricAction('מה זה אומר?','סגור הסבר')}</summary><p>${why}</p></details>`).join('')}</div>
  </details>`;
 }).join('')}</section>`;
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
  const games=M.select(record.seasonGames,0,playerVenue).filter(g=>!selectedRival||g.opponent===selectedRival);
  if(playerRange.expanded)playerRange.games(games.map(g=>({...g,code:g.gameCode,detail:fmt(g.stats?.valuation)})),playerGame,code=>{
   playerGame=code;renderPlayerGame(out,record,games);
  },'PIR','אין לשחקן הופעות העונה בסינון שנבחר.');
  renderPlayerGame(out,record,games);
  return;
 }
 const limit=Number(playerRange.value),options={limit,venue:playerVenue};
 const reports=playerAnalysisCache?.limit===limit&&playerAnalysisCache?.venue===playerVenue
  ?playerAnalysisCache:buildPlayerAnalysis(options);
 const own=reports.base.get(record),report=reports.detail.get(record);
 const games=M.select(record.games,limit,playerVenue);
 const ratings=Object.fromEntries(C.playerMetrics.map(([id])=>[id,reports.baseRanks.get(record)[id]]));
 const tags=Object.entries(styleTags).filter(([id])=>ratings[id]>=70).sort(([a],[b])=>ratings[b]-ratings[a]);
 const target=player.$('[data-compare-club]').value;
 const opponent=playerView==='team'&&target!=='next'?target:nextOpponent(record.team);
 const rival=model.teams.find(t=>t.team===opponent);
 const compare=playerView==='player'?model.players.find(p=>p.id===player.$('[data-compare-player]').value):null;
 const other=reports.detail.get(compare);
 const withRival={...report,stats:{...report.stats}};
 if(rival){
  const next=nextGame(record.team);
  const venue=playerVenue!=='all'&&opponent===nextOpponent(record.team)&&!next?.neutral?(next?.home===opponent?'home':'away'):playerVenue;
  const rivals=reports.rivals.get(venue)||M.buildRivals(model.dna,{limit,venue});
  reports.rivals.set(venue,rivals);
  M.opponentReport(withRival,model.dna,rivals,opponent,record.team,model,{limit,venue});
 }
 if(playerView==='profile'){
  const forecast=window.getPlayerDnaForecast?.(record.name);
  const projection=forecast&&M.projection(forecast.frozen,window.WeightedForecast,forecast.weights,forecast.profile);
  if(projection)withRival.stats.projection={...projection,context:forecast.opponent};
 }
 const profile=playerView==='profile';
 const hasChart=games.length||compare&&M.select(compare.games,limit,playerVenue).length;
 const radar=hasChart?playerRadar(reports,record,compare,{profile}):'';
 const charts=!profile&&hasChart?radar+playerBars(reports,record,compare)+playerDnaSummary(reports,record):'';
 const style=profile
  ?games.length?playerStyle(own,ratings,positionLabels[record.position],radar):empty('אין מספיק נתונים להופעות בטווח ובסינון שנבחרו.')
  :playerStyleComparison(record,limit,rival);
 out.innerHTML=`${playerProfile(record,games,tags)}
 ${style}
 ${charts}
 ${expandedMetrics(withRival,reports.detailRanks.get(record),{other,otherRanks:reports.detailRanks.get(compare),opponent,compareName:compare?.name,ownName:record.name,compact:profile})}`;
 loadPortraits(out);
}
function comparisonRows(metrics,ownStats,rivalStats,benchmarks,{highlightAdvantage=true,singleGame=!benchmarks,names=[],playerComparison=false}={}){
 return metrics.map(metric=>{
  const [id,,unit]=metric,ref=benchmarks?.[id],a=ownStats[id],b=rivalStats?.[id]||{value:ref.mean,count:ref.count};
  const gap=a.value==null||b.value==null?null:a.value-b.value;
  const lead=playerComparison&&gap!=null&&fmt(a.value)!==fmt(b.value)&&!styleOnly.has(id)
   ?names[(lowerIsBetter.has(id)?gap<0:gap>0)?0:1]:null;
  const diff=gap==null?'':` · פער <bdi>${fmt(Math.abs(gap))}</bdi>${unit==='%'?' נק׳ אחוז':unitLabels[unit]||''}${lead?` · יתרון ל־<bdi>${esc(lead)}</bdi>`:''}`;
  const max=unit==='%'?100:Math.max(a.value??0,b.value??0);
  const width=stat=>stat.value==null?null:max>0?Math.min(100,stat.value/max*100):0;
  const [ownSide,rivalSide]=highlightAdvantage&&(!playerComparison||!styleOnly.has(id))?comparisonSides(id,a.value,b.value):['dna-own','dna-other'];
  return row(metric,valueCell(a,ref?.percentile(a)??null,unit,ownSide,{singleGame,bar:ref?undefined:width(a),showRank:!!ref,name:names[0]}),
   valueCell(b,rivalStats?(ref?.percentile(b)??null):null,unit,rivalSide,{league:!rivalStats,singleGame,bar:ref?undefined:width(b),showRank:!!ref,name:names[1]}),diff,playerComparison);
 }).join('');
}
function legend(own,rival){
 return `<div class="dna-legend"><span class="dna-own"><i></i><bdi>${esc(own)}</bdi></span><span class="dna-other"><i></i><bdi>${esc(rival)}</bdi></span></div>`;
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
  view==='defense'?'מדדי היריבה מופיעים תחת הקבוצה שמולה שיחקה. חטיפות הן של הקבוצה עצמה.':'הערכים מתייחסים למשחק שנבחר.',
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
 const selectedGames=record=>C.select(record.games,Number(selectedRange)).length;
 const title=view==='defense'?'מה היריבות עושות מול כל קבוצה':'סגנון התקפי והרכבים';
 const description=(view==='defense'?'מדדי היריבות מופיעים תחת הקבוצה שמולה שיחקו. חטיפות הן של הקבוצה עצמה. ':'')+
  'הדירוג הוא ביחס לליגה בטווח שנבחר.';
 const metricTable=teamMetricTable(title,description,comparisonRows(metrics,ownStats,rivalStats,benchmarks,{names:[own.team,heading]}));
 out.innerHTML=`<section class="dna-profile">
 <span class="dna-kicker">השוואת סגנונות</span>
 <div class="dna-team-pair">
  <div class="dna-identity">${portrait(own.team,clubCrests.get(own.team),'club')}<div><h3><bdi>${esc(own.team)}</bdi></h3><p>${selectedGames(own)} משחקים בטווח</p></div></div>
  <span class="dna-versus">מול</span>
  <div class="dna-identity">${rival?portrait(heading,clubCrests.get(heading),'club'):''}<div><h3><bdi>${esc(heading)}</bdi></h3>${rival?`<p>${selectedGames(rival)} משחקים בטווח</p>`:''}</div></div>
 </div>${match?'<p class="dna-fixture">'+esc(match)+'</p>':''}</section>
 ${metricTable}${sizeNote}`;
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
for(const b of player.section.querySelectorAll('[data-venue]'))b.onclick=()=>{
 playerVenue=b.dataset.venue;playerGame='';
 for(const choice of player.section.querySelectorAll('[data-venue]'))choice.setAttribute('aria-pressed',String(choice===b));
 paint();
};
window.addEventListener('player-dna-forecast-ready',()=>{if(playerView==='profile')paint();});
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
