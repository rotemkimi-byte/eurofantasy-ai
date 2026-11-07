(()=>{
'use strict';
const C=window.DnaCore,T=window.TeamMetricsCore;
const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');
if(!C||!T||!nav||!main)return;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decimal=new Intl.NumberFormat('he-IL',{maximumFractionDigits:1});
const date=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric'});
const unitLabels={'%':'%',per40:' ל־40 דק׳',per100:' ל־100 פוז׳',pos:' פוז׳ ל־40 דק׳',cm:' ס״מ'};
const sources={box:'בוקס־סקור',events:'יומן זריקות',estimated:'אומדן',lineups:'חמישיות מאומתות'};
const positionLabels={G:'גארדים',F:'פורוורדים',C:'סנטרים',Guard:'גארדים',Forward:'פורוורדים',Center:'סנטרים'};
const toPosition={Guard:'G',Forward:'F',Center:'C'};
const styleTags={assists:'יוצר משחק',usage:'מעורבות התקפית גבוהה',three:'זורק הרבה לשלוש',
 rim:'משחק ליד הסל',fastbreak:'שחקן מתפרצות',offRebound:'ריבאונד התקפה',defRebound:'ריבאונד הגנה',
 drawn:'סוחט עבירות',steals:'חוטף כדורים',blocks:'חוסם',secondChance:'הזדמנות שנייה'};
const fmt=(value,unit='')=>value==null?'—':decimal.format(value)+(unitLabels[unit]||'');
const price=p=>Number.isFinite(p.price)&&p.price>0?fmt(p.price)+' CR':'';
const labelName=name=>name.includes(',')?name.split(',').reverse().map(s=>s.trim()).join(' '):name;
const option=(value,name)=>new Option(name,value);
const empty=message=>'<p class="dna-empty">'+esc(message)+'</p>';
let model=null,fixtures=[],pending=null,lastLoad=0;

async function json(path){
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
   price:current?.price,games:p.games.filter(g=>g.team===team)};
 });
 for(const p of listed)if(!seen.has(p))records.push({id:'market-'+p.fantasy_id,name:p.name,team:canonicalTeam(p.team),
  position:p.pos,price:p.price,games:[]});
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
 $('[data-reload]').onclick=()=>void load();
 return {$,section,button:b};
}
const range=title=>`<label>טווח <select data-range><option value="0">כל העונה</option><option value="5">5 ${title} אחרונים</option><option value="3">3 ${title} אחרונים</option></select></label>`;
const player=panel('playerDna','DNA שחקן','איך השחקן מייצר תפוקה ואיך הסגנון שלו פוגש את היריבה הבאה.',`
 <div class="dna-controls dna-player-controls">
  <label>קבוצה <select data-scope></select></label>
  <label>שחקן · לפי מחיר <select data-player></select></label>
  ${range('משחקים')}
 </div>`);
const teams=panel('teamDna','DNA קבוצתי','השוו סגנונות משחק, מדד מול מדד, על אותו סולם.',`
 <div class="dna-controls">
  <label>קבוצה <select data-team></select></label>
  <label>מול <select data-opponent></select></label>
  ${range('משחקים')}
 </div>
 <div class="dna-switch" role="group" aria-label="סוג המדדים">
  <button type="button" data-view="offense" aria-pressed="true">סגנון התקפי והרכבים</button>
  <button type="button" data-view="defense" aria-pressed="false">הגנה · מה הקבוצות מאפשרות</button>
 </div>`);
const panels=[player,teams];
let view='offense';

function selectPlayers(){
 const scope=player.$('[data-scope]').value;
 updateOptions(player.$('[data-player]'),[option('','בחר שחקן'),...model.players.filter(p=>!scope||p.team===scope)
  .map(p=>option(p.id,p.name+(price(p)?' · '+price(p):'')+(scope?'':' · '+p.team)))]);
}
function selectOpponents(){
 const own=teams.$('[data-team]').value,g=nextGame(own);
 const next=g&&(g.home===own?g.away:g.home);
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
 selectPlayers();selectOpponents();
}
async function load(){
 if(pending)return pending;
 for(const p of panels){
  p.$('[data-reload]').disabled=true;p.$('.dna-status').textContent='טוען נתוני יורוליג…';
 }
 pending=(async()=>{
  try{
   const [official,events,schedule,market]=await Promise.all([
    json('official-offense.json'),json('advanced-players.json').catch(()=>null),
    json('context/E2026-schedule.json').catch(()=>null),json('players.json').catch(()=>null)
   ]);
   if(official.season!==C.season||!official.players||!official.teamResults?.length)throw Error('No season data');
   const built=C.build(official,events?.season===C.season?events:null,T);
   if(!built.teams.length)throw Error('No team records');
   model={...built,players:roster(built.players,market)};
   const finished=new Set(official.teamResults.map(g=>Number(g.gameCode)));
   const now=Date.now();
   fixtures=(schedule?.data||[]).filter(g=>g.season?.code===C.season&&g.played===false&&
    !finished.has(Number(g.gameCode))&&Date.parse(g.utcDate)>now&&g.local?.club?.name&&g.road?.club?.name&&
    !g.local.club.isVirtual&&!g.road.club.isVirtual).map(g=>({home:canonicalTeam(g.local.club.name),
    away:canonicalTeam(g.road.club.name),date:g.utcDate,round:g.round,neutral:g.isNeutralVenue}))
    .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
   lastLoad=now;
   selectors();
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
function valueCell(stat,rating,unit,side,{league=false,playerRank=false,valueSuffix=''}={}){
 const real=stat?.value!=null;
 const sample=league?(stat.count+' קבוצות במדגם'):(stat.count+' / '+stat.total+' משחקים');
 const display=real?fmt(stat.value,unit)+valueSuffix:'חסר נתון';
 const rank=playerRank?'אחוזון '+rating:rating+'/100';
 return `<div class="dna-value ${side}">
  <div class="dna-value-top"><strong><bdi>${esc(display)}</bdi></strong>${rating===null?'':`<bdi class="dna-rank">${rank}</bdi>`}</div>
  ${rating===null?'':`<div class="dna-track" aria-hidden="true"><i style="--dna-width:${rating}%"></i></div>`}
  <small>${esc(sample)}${real&&!league&&rating===null?' · ללא דירוג':''}</small>
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
function guidance(p,own,rival,gameLimit){
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
 return `<aside class="dna-match"><div class="dna-match-head"><div><span class="dna-kicker">המשחק הבא</span>
 <h3><bdi>${esc(own.team)}</bdi> מול <bdi>${esc(rival.team)}</bdi></h3><small>${esc(names)}</small></div>
 <button type="button" class="secondary" data-compare-teams>השוואת הקבוצות</button></div>
 ${signals.length?'<ul>'+signals.join('')+'</ul>':empty('אין כרגע פער בולט עם מדגם מספיק במדדים שנבדקו.')}
 <p>ההשוואה מבוססת על משחקים שהסתיימו ועל טווח המשחקים שבחרת.</p></aside>`;
}
function renderPlayer(){
 if(!model)return;
 const out=player.$('[data-dna-results]');
 const record=model.players.find(p=>p.id===player.$('[data-player]').value);
 if(!record){out.innerHTML=empty('בחר שחקן כדי לראות את פרופיל המשחק שלו.');return;}
 const gameLimit=Number(player.$('[data-range]').value),games=C.select(record.games,gameLimit);
 const position=positionLabels[record.position];
 const peers=model.players.filter(p=>record.position&&p.position===record.position);
 const stats=calc(peers,gameLimit,C.playerMetrics);
 const own=stats.get(record)||C.summarize(games,C.playerMetrics);
 const ratings=Object.fromEntries(C.playerMetrics.map(([id])=>[id,C.benchmark([...stats.values()].map(s=>s[id]),id,true).percentile(own[id])]));
 const tags=Object.entries(styleTags).filter(([id])=>ratings[id]>=70).sort(([a],[b])=>ratings[b]-ratings[a]).slice(0,3);
 const minutes=games.reduce((sum,g)=>sum+g.minutes,0);
 const pirs=games.map(g=>g.stats?.valuation).filter(Number.isFinite);
 const avgPir=pirs.length?pirs.reduce((sum,pir)=>sum+pir,0)/pirs.length:null;
 const g=nextGame(record.team),opponent=g&&(g.home===record.team?g.away:g.home);
 const club=model.teams.find(t=>t.team===record.team),rival=model.teams.find(t=>t.team===opponent);
 const matching=club&&rival?guidance(ratings,club,rival,gameLimit):'';
 out.innerHTML=`<header class="dna-profile"><span class="dna-kicker"><bdi>${esc(record.team)}</bdi> ${position?'· '+position:''}</span>
 <h3><bdi>${esc(record.name)}</bdi></h3>
 ${games.length?`<p>${games.length} הופעות · ${fmt(minutes/games.length)} דק׳ למשחק · ${fmt(avgPir)} PIR בממוצע${price(record)?' · '+esc(price(record)):''}</p>`:''}
 ${tags.length?'<div class="dna-tags">'+tags.map(([,tag])=>'<span>'+tag+'</span>').join('')+'</div>':''}</header>
 ${games.length?`<p class="dna-explain">מימין מופיע הערך של השחקן. הפס הירוק מציג את האחוזון ${position?'מול '+position:'לפי עמדה'} באותו טווח. אחוזון 50 הוא אמצע הדירוג.</p>
 <div class="dna-chart">${C.playerMetrics.map(metric=>{
  const [id,,unit]=metric;
  return row(metric,valueCell(own[id],ratings[id],unit,'dna-own',{playerRank:true,valueSuffix:id==='usage'?' מהפוזשנים':''}));
 }).join('')}</div>`
 :empty('לשחקן אין הופעות מתועדות בקבוצה הזו בעונה הנוכחית.')}
 ${matching}`;
 const compare=out.querySelector('[data-compare-teams]');
 if(compare)compare.onclick=()=>{
  teams.$('[data-team]').value=record.team;
  selectOpponents();teams.$('[data-opponent]').value='next';
  teams.$('[data-range]').value=String(gameLimit);
  view='offense';
  teams.button.click();
  teams.section.setAttribute('tabindex','-1');
  teams.section.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'auto'});
 };
}
function renderTeams(){
 if(!model)return;
 const out=teams.$('[data-dna-results]');
 const own=model.teams.find(t=>t.team===teams.$('[data-team]').value);
 if(!own){out.innerHTML=empty('בחר קבוצה להשוואה מול היריבה הבאה, קבוצה אחרת או ממוצע הליגה.');return;}
 const compare=teams.$('[data-opponent]').value,g=nextGame(own.team);
 const opponent=compare==='next'?(g?.home===own.team?g.away:g?.home):compare;
 const rival=model.teams.find(t=>t.team===opponent);
 const gameLimit=Number(teams.$('[data-range]').value),metrics=view==='offense'?C.offense:C.defense;
 const {stats,benchmarks}=teamAnalysis(gameLimit,metrics);
 const ownStats=stats.get(own),rivalStats=stats.get(rival);
 const heading=rival?.team||'ממוצע הליגה';
 const match=rival?fixtureFor(own.team,rival.team):'';
 const sizeNote=view==='offense'&&model.bands?'<p class="dna-explain">נתוני חמישיות גבוהות ונמוכות מבוססים על דקות שבהן אפשר לאמת את ההרכב. ספי המדגם · נמוכה עד '+fmt(model.bands.low,'cm')+' · גבוהה החל מ־'+fmt(model.bands.high,'cm')+'</p>':'';
 out.innerHTML=`<header class="dna-profile dna-compare-head"><span class="dna-kicker">השוואת סגנונות</span>
 <h3><bdi>${esc(own.team)}</bdi> מול <bdi>${esc(heading)}</bdi></h3>
 ${match?'<p>'+esc(match)+'</p>':''}</header>
 <p class="dna-explain">הפסים מראים דירוג יחסי לליגה בטווח שנבחר. 50 נמצא במרכז ההתפלגות.</p>
 <div class="dna-legend"><span class="dna-own"><i></i><bdi>${esc(own.team)}</bdi></span><span class="dna-other"><i></i><bdi>${esc(heading)}</bdi></span></div>
 <div class="dna-chart">${metrics.map(metric=>{
  const [id,,unit]=metric,ref=benchmarks[id],a=ownStats[id],b=rivalStats?.[id]||{value:ref.mean,count:ref.count};
  const diff=a.value==null||b.value==null?'':` · <bdi>${esc((a.value>b.value?'+':'')+decimal.format(a.value-b.value))}</bdi> ${unit==='%'?'נק׳ אחוז':'פער'}`;
  return row(metric,valueCell(a,ref.percentile(a),unit,'dna-own'),
   valueCell(b,rival?ref.percentile(b):null,unit,'dna-other',{league:!rival}),diff);
 }).join('')}</div>${sizeNote}`;
}
function paint(){
 const visible=panels.find(p=>p.section.classList.contains('active'));
 if(visible===player)renderPlayer();
 if(visible===teams){
  for(const b of teams.section.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
  renderTeams();
 }
}
player.$('[data-scope]').onchange=()=>{selectPlayers();paint();};
player.$('[data-player]').onchange=player.$('[data-range]').onchange=paint;
teams.$('[data-team]').onchange=()=>{
 selectOpponents();
 if([...teams.$('[data-opponent]').options].some(o=>o.value==='next'))teams.$('[data-opponent]').value='next';
 paint();
};
teams.$('[data-opponent]').onchange=teams.$('[data-range]').onchange=paint;
for(const b of teams.section.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;paint();};
})();
