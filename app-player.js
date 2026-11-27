/* Player dashboard: official current-season data, shared Usage/defense formulas. */
(()=>{
'use strict';
const original=window.showPlayer,U=window.UsageCore,D=window.DefenseCore;
if(typeof original!=='function'||!U||!D)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>U.num(v)===null?'—':Number(v).toFixed(1);
const date=d=>new Date(d).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'});
const historyDate=new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',timeZone:'Asia/Jerusalem'});
const fixtureNames={
 BAR:'ברצלונה',PAR:'פרטיזן',OLY:'אולימפיאקוס',PAM:'ולנסיה',BES:'בשיקטאש',
 VIR:'וירטוס בולוניה',DUB:'דובאי',ASV:'וילרבאן',PRS:'פריז',MUN:'באיירן',
 PAN:'פנאתינייקוס',MAD:'ריאל מדריד',TEL:'מכבי ת״א',BAS:'באסקוניה',RED:'הכוכב האדום',
 MIL:'מילאנו',IST:'אנאדולו אפס',HTA:'הפועל ת״א',ZAL:'ז׳לגיריס',ULK:'פנרבחצ׳ה'
};
function upcomingGames(schedule,team,now=Date.now()){
 const club=canonicalTeam(team);
 const fixtures=[];
 for(const game of schedule.data){
  if(game.season?.code!=='E2026'||game.played!==false||!(Date.parse(game.utcDate)>now))continue;
  const local=game.local?.club,road=game.road?.club;
  if(!local?.name||!road?.name||local.isVirtual||road.isVirtual)continue;
  const home=canonicalTeam(local.name)===club;
  if(!home&&canonicalTeam(road.name)!==club)continue;
  const opponent=home?road:local;
  fixtures.push({
   name:fixtureNames[opponent.code]||canonicalTeam(opponent.name),
   date:game.utcDate,venue:game.isNeutralVenue?'ניטרלי':home?'בית':'חוץ'
  });
 }
 return fixtures.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(0,3);
}
function renderFixtures(hero,team){
 const row=document.createElement('div');
 row.className='ef-player-fixtures';
 row.innerHTML='<strong>המשחקים הבאים:</strong><span>טוען…</span>';
 hero.querySelector('.ef-player-identity > div:last-child').append(row);
 lastThreeFetch('./data/context/E2026-schedule.json').then(schedule=>{
  if(!row.isConnected)return;
  const fixtures=upcomingGames(schedule,team);
  row.lastElementChild.outerHTML=fixtures.length?`<ul role="list">${fixtures.map(g=>
   `<li title="${date(g.date)} · ${g.venue}"><bdi>${esc(g.name)}</bdi> <abbr title="${g.venue}">(${g.venue[0]})</abbr></li>`
  ).join('')}</ul>`:'<span>אין משחקים מתוכננים</span>';
 }).catch(()=>{if(row.isConnected)row.lastElementChild.textContent='לוח המשחקים לא זמין';});
}
let cached=null,loaded=0,pending=null,mediaPromise=null,creditPromise=null;
function dataset(){if(cached&&Date.now()-loaded<60000)return Promise.resolve(cached);if(pending)return pending;
 pending=fetch('./data/official-offense.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(d=>{if(d.season!=='E2026'||d.schema!=='official-offense-v1')throw Error('season');cached=d;loaded=Date.now();return d;}).finally(()=>{pending=null;});return pending;}
function media(){if(!mediaPromise)mediaPromise=fetch('./data/player-media.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('media');return r.json();}).catch(()=>{mediaPromise=null;return null;});return mediaPromise;}
function creditHistory(force=false){
 if(force)creditPromise=null;
 if(!creditPromise)creditPromise=fetch('./data/round-lab.json',{cache:'no-cache'})
  .then(r=>{if(!r.ok)throw Error('credits');return r.json();})
  .then(d=>{if(d.season!=='E2026'||!Array.isArray(d.rounds))throw Error('season');return d.rounds;})
  .catch(error=>{creditPromise=null;throw error;});
 return creditPromise;
}
function creditRows(rounds,player){
 const key=U.key(player),prices=new Map();
 let last=0;
 for(const r of rounds){
  const round=Number(r.round);
  if(!Number.isInteger(round)||round<=0)continue;
  last=Math.max(last,round);
  if(r.priceSource==='pre-round')prices.set(round,U.num(r.players?.find(p=>U.key(p)===key)?.price));
 }
 const rows=Array.from({length:last},(_,i)=>({round:i+1,price:prices.get(i+1)??null}));
 const current=U.num(player.price);
 if(current>0)rows.push({round:last+1,price:current,current:true});
 return rows;
}
window.PlayerCredits={load:creditHistory,rows:creditRows};
function creditChart(rows,showDetails){
 if(!rows.length)return '<h3>קרדיטים</h3><span class="muted" aria-label="אין נתוני קרדיטים">—</span>';
 const prices=rows.map(r=>r.price),lo=Math.min(...prices),hi=Math.max(...prices);
 const center=(lo+hi)/2,half=Math.max(Math.ceil((hi-lo)*5)/10,.3);
 const first=rows[0].round,end=rows.at(-1).round;
 const width=Math.max(348,83+(end-first)*35), rightEdge=width-40;
 const x=r=>first===end?width/2:43+(rightEdge-43)*(r.round-first)/(end-first);
 const y=value=>54-(value-center)*29/half;
 const label=r=>r.current?'עכשיו':'מחזור '+r.round;
 const value=r=>label(r)+' · '+fmt(r.price)+' CR';
 const chosen=rows.at(-1);
 return `<h3>קרדיטים</h3>
 <div class="ef-trend-scroll"><svg class="ef-credit-chart" viewBox="0 0 ${width} 106"${width>348?` style="min-width:${width}px"`: ''} role="group" aria-label="קרדיטים לפי מחזור, מהישן לחדש">
  ${[center+half,center,center-half].map(t=>`<line class="ef-gridline" x1="43" x2="${rightEdge}" y1="${y(t)}" y2="${y(t)}"/><text x="34" y="${y(t)+4}" text-anchor="end">${fmt(t)}</text>`).join('')}
  <polyline points="${rows.map(r=>x(r)+','+y(r.price)).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
  ${rows.map((r,i)=>{
   const cx=x(r),left=i?(x(rows[i-1])+cx)/2:35,right=i<rows.length-1?(cx+x(rows[i+1]))/2:width-7;
   const tick=r.current||i===0||i===rows.length-1||(r.round-first)%Math.ceil((end-first)/4)===0&&end-r.round>1;
   return `<g role="button" tabindex="0" data-credit-point="${i}" aria-label="${value(r)}" aria-pressed="${r===chosen}">
    <rect x="${left}" y="0" width="${right-left}" height="106" fill="transparent"/>
    <circle cx="${cx}" cy="${y(r.price)}" r="3.5" fill="currentColor"/>
    <text class="ef-credit-value" x="${cx}" y="${y(r.price)-9}" text-anchor="middle" aria-hidden="true">${fmt(r.price)}</text>
    ${tick?`<text x="${cx}" y="101" text-anchor="middle">${r.current?'עכשיו':r.round}</text>`:''}
   </g>`;
  }).join('')}
 </svg></div>${showDetails?'<div class="ef-credit-detail" aria-live="polite"></div>':''}`;
}
function safeImage(url){try{const u=new URL(url);return u.protocol==='https:'&&['media-cdn.cortextech.io','media-cdn.incrowdsports.com','media-cdn.euroleague.net'].includes(u.hostname)?url:null;}catch{return null;}}
function photo(host,url,alt){if(!host||!safeImage(url))return;const img=new Image();img.alt=alt;img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{if(host.isConnected){host.replaceChildren(img);host.removeAttribute('aria-hidden');}};img.src=url;}
const metrics=(items,options)=>window.PlayerAnalysis.metrics(items,options);
const metric=(label,value,note)=>[label,value,note];
const rate=(label,r)=>metric(label,r.value===null?'—':fmt(r.value)+'%',`${r.covered} הופעות בחישוב${r.missing?' · '+r.missing+' חסרות':''}`);
const pirTrend={label:'PIR',field:'valuation',scale:10};
const minutesTrend={label:'דקות משחק',scale:40};
const freeThrowsTrend={label:'עונשין',field:'freeThrowsMade',scale:2};
function trendValue(game,trend){
 const minutes=U.num(game.minutes);
 if(trend===minutesTrend)return minutes!==null&&minutes>=0?minutes:null;
 return minutes>0?U.num(game.stats?.[trend.field]):null;
}
function duration(minutes){
 if(minutes===null)return '—';
 const seconds=Math.round(minutes*60);
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
const freeThrowValue=game=>`${trendValue(game,freeThrowsTrend)??'—'}/${U.num(game.stats?.freeThrowsAttempted)??'—'}`;
function trendDetail(game,trend){
 if(trend===freeThrowsTrend)return 'עונשין · '+freeThrowValue(game);
 if(trend===minutesTrend)return 'דקות משחק · '+duration(trendValue(game,trend));
 return 'PIR '+fmt(trendValue(game,trend));
}
function gameValues(game,minutesFormat=fmt){
 return game?[
  ['PIR בפועל',fmt(trendValue(game,pirTrend))],['דקות בפועל',minutesFormat(trendValue(game,minutesTrend))]
 ]:[];
}
function chart(games,trend){
 const rows=games.slice().reverse(),values=rows.map(g=>trendValue(g,trend));
 const valid=values.filter(value=>value!==null);
 if(!valid.length)return `<p class="muted">אין נתוני ${trend.label} בטווח הזה.</p>`;
 const lo=Math.min(0,...valid),hi=Math.max(trend.scale,...valid),span=hi-lo;
 const freeThrows=trend===freeThrowsTrend;
 const width=Math.max(372,72+(rows.length-1)*(trend===pirTrend?29:46)),left=42,right=width-30;
 const x=i=>rows.length===1?(left+right)/2:left+i*(right-left)/(rows.length-1);
 const y=value=>160-(value-lo)/span*130;
 const paths=[];
 let current=[];
 values.forEach((value,i)=>{
  if(value!==null)current.push(`${x(i)},${y(value)}`);
  else if(current.length){paths.push(current);current=[];}
 });
 if(current.length)paths.push(current);
 const grid=[0,.5,1].map(t=>{
  const value=lo+span*t;
  return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" class="ef-gridline"/><text x="32" y="${y(value)+4}" text-anchor="end">${trend===pirTrend?Math.round(value):value}</text>`;
 }).join('');
 const lines=paths.map(path=>`<polygon points="${path[0].split(',')[0]},160 ${path.join(' ')} ${path.at(-1).split(',')[0]},160" fill="currentColor" opacity=".08"/><polyline points="${path.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5"/>`).join('');
 const points=rows.map((game,i)=>{
  const value=values[i],cx=x(i);
  const label=freeThrows?freeThrowValue(game):trend===minutesTrend?duration(value):value;
  const point=value!==null?`<g class="ef-trend-point" data-game-index="${i}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(date(game.date)+' '+game.opponent+' · '+trendDetail(game,trend))}">
   <title>${esc(game.opponent)} · ${esc(trendDetail(game,trend))}</title>
   <circle cx="${cx}" cy="${y(value)}" r="16" fill="transparent"/>
   <circle class="${freeThrows?'ef-ft-point':'pirPoint'}" cx="${cx}" cy="${y(value)}" r="4.5" fill="currentColor"/>
   <text class="${freeThrows?'ef-ft-value':'ef-pir-value'}" x="${cx}" y="${y(value)-10}" text-anchor="middle" aria-hidden="true">${label}</text></g>`:'';
  const tick=rows.length<=5||i===0||i===rows.length-1?`<text x="${cx}" y="185" text-anchor="middle">${date(game.date)}</text>`:'';
  return point+tick;
 }).join('');
 const wide=width>372?` style="min-width:${width}px"`:'';
 return `<div class="ef-trend-scroll"><svg class="ef-trend-svg" viewBox="0 0 ${width} 202"${wide} role="group" aria-label="${trend.label} בפועל, מהישן לחדש"><title>${trend.label} בפועל · עונת 2026/27</title>${grid}${lines}${points}</svg></div>`;
}
const gameVenue=g=>g.home===true?'בית':g.home===false?'חוץ':'מיקום לא ידוע';
function marketGameRow(g){
 const opponent=canonicalTeam(g.opponent)||'יריבה לא ידועה';
 const kit=TEAM_KITS[opponent];
 const clubColor=['Baskonia','Besiktas'].includes(opponent)?kit?.[3]:opponent==='Real Madrid'?kit?.[2]:kit?.[1];
 const venue=gameVenue(g);
 const played=g.minutes>0,dnp=U.num(g.minutes)===0,s=g.stats||{};
 const pir=played?U.num(s.valuation):null;
 const pirBar=Math.max(0,Math.min(100,(pir??0)*5));
 const stat=(label,value)=>`<span class="ef-history-value" dir="ltr" aria-label="${label} ${value}">${value}</span>`;
 return `<details class="ef-history-game">
 <summary class="ef-history-grid">
  <span class="ef-history-opponent"${clubColor?` style="--ef-history-club:${clubColor}"`:''}>
   <bdi>${esc(opponent)}</bdi>
   <small><time dir="ltr" datetime="${esc(g.date)}">${historyDate.format(new Date(g.date))}</time> · ${venue}${dnp?' · לא שיחק':''}</small>
  </span>
  <span class="ef-history-pir${pir!==null&&pir>=18?' is-high':''}">
   ${stat('PIR',fmt(pir))}
   ${pir===null?'':`<span class="ef-history-track" aria-hidden="true"><i style="width:${pirBar}%"></i></span>`}
  </span>
  ${stat('נקודות',dnp?'—':fmt(s.points))}
  ${stat('דקות',dnp?'—':fmt(g.minutes))}
  <span class="ef-history-chevron" aria-hidden="true"></span>
 </summary>
 <div class="ef-history-detail">
  <div class="ef-history-detail-head">${g.round?`<span>מחזור ${esc(g.round)}</span>`:''}${safeLink(g.source)}</div>
  ${played?metrics([['ריבאונדים',s.totalRebounds],['אסיסטים',s.assistances],['חטיפות',s.steals],['חסימות',s.blocksFavour],['איבודים',s.turnovers],['עבירות שסחט',s.foulsReceived]].map(([label,value])=>
   [label,U.num(value)??'—','',label==='איבודים'&&U.num(value)>0?'negative':''])):''}
 </div>
 </details>`;
}
window.showPlayer=function(target){
 const player=window.PlayerAnalysis.resolve(target);if(!player)return;
 original.apply(this,arguments);
 const name=player.name;
 const body=document.getElementById('modalBody'),hero=body?.querySelector('.ef-player-hero');if(!player||!hero)return;
 const compactMarket=body.classList.contains('ef-market-player');
 body.classList.add('ef-dashboard');body.querySelector('.ef-player-jumps')?.remove();
 renderFixtures(hero,player.team);
 const watch=document.createElement('button');
 watch.type='button';watch.className='ef-player-watch';
 const paintWatch=()=>{
  const saved=window.FantasyWatchlist.has(player);
  watch.setAttribute('aria-pressed',String(saved));
  watch.textContent=saved?'★ שמור · הסר':'☆ שמור למעקב';
 };
 if(window.FantasyWatchlist&&!player.officialOnly){
  paintWatch();
  watch.onclick=()=>{if(!window.FantasyWatchlist.toggle(player))watch.textContent='השמירה נכשלה · נסה שוב';};
  if(!compactMarket)hero.querySelector('.ef-player-identity > div:last-child').append(watch);
  watch.setAttribute('data-watch-toggle','');
  watch.addEventListener('watchlist-change',paintWatch);
 }
 const tabs=document.createElement('div');tabs.className='ef-player-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','נתוני שחקן');
 const labels={overview:'סקירה',usage:'Usage',defense:'הגנה',games:'משחקים'},panes={};
 for(const [id,label] of Object.entries(labels)){const pane=document.createElement('section');pane.id='efPane-'+id;pane.className='ef-player-pane';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','efTab-'+id);pane.hidden=id!=='overview';panes[id]=pane;tabs.insertAdjacentHTML('beforeend',`<button type="button" role="tab" id="efTab-${id}" aria-controls="efPane-${id}" aria-selected="${id==='overview'}" tabindex="${id==='overview'?0:-1}" data-player-tab="${id}">${label}</button>`);}
 for(const child of [...body.children])if(child!==hero)panes.overview.append(child);
 const actual=panes.overview.querySelector('.actual-results');if(actual){const details=document.createElement('details');details.className='ef-extra-stats pa-disclosure';details.dataset.disclosure='games';details.innerHTML='<summary>נתונים נוספים ושינויי קרדיט</summary>';details.append(actual);panes.games.append(details);}
 if(compactMarket&&watch.hasAttribute('data-watch-toggle'))body.append(watch);
 body.append(tabs);
 const controls=document.createElement('div');controls.className='ef-chart-ranges';controls.setAttribute('role','group');controls.setAttribute('aria-label','טווח נתוני השחקן');controls.innerHTML=[['1','אחרון'],['3','3 משחקים'],['0','עונה']].map(([n,l])=>`<button type="button" data-range="${n}" aria-pressed="${n==='0'}">${l}</button>`).join('');body.append(controls);
 const status=document.createElement('p');status.className='ef-data-status muted';status.setAttribute('role','status');status.textContent='טוען נתוני משחק מאומתים…';body.append(status,...Object.values(panes));
 const overview=document.createElement('div');overview.className='ef-overview-data';panes.overview.prepend(overview);
 overview.innerHTML=`<section class="playerSection ef-player-history">
  <div class="ef-history-toolbar">
   <div><h3 class="sectionTitle">מגמת ביצועים · PIR</h3><p class="muted">תוצאות בפועל · מהישן לחדש</p></div>
   <div class="ef-venue-filters" role="group" aria-label="בית וחוץ">
    <button type="button" data-player-venue="all" aria-pressed="true">הכול</button>
    <button type="button" data-player-venue="home" aria-pressed="false">בית</button>
    <button type="button" data-player-venue="away" aria-pressed="false">חוץ</button>
   </div>
  </div>
  <div class="ef-history-plot"></div>
 </section><div class="ef-overview-summary"></div>`;
 const plot=overview.querySelector('.ef-history-plot'),summary=overview.querySelector('.ef-overview-summary');
 const venueControls=overview.querySelector('[aria-label="בית וחוץ"]');

 const credits=document.createElement('section');credits.className='ef-market-credits';
 const minutes=document.createElement('section');
 minutes.className='playerSection ef-player-history ef-player-minutes';
 minutes.innerHTML='<h3 class="sectionTitle">דקות משחק</h3><div class="ef-history-plot"></div>';
 const freeThrows=document.createElement('section');
 freeThrows.className='playerSection ef-player-history ef-player-free-throws';
 freeThrows.innerHTML='<h3 class="sectionTitle">עונשין</h3><p class="muted">קליעות מתוך ניסיונות בכל משחק</p><div class="ef-history-plot"></div>';
 overview.after(minutes,freeThrows,credits);
 const minutesPlot=minutes.querySelector('.ef-history-plot');
 const freeThrowsPlot=freeThrows.querySelector('.ef-history-plot');
 let creditPoints=[],activeCredit=null;
 function showCredit(point){
  if(!point)return;
  activeCredit?.setAttribute('aria-pressed','false');
  activeCredit=point;
  point.setAttribute('aria-pressed','true');
  const detail=credits.querySelector('.ef-credit-detail');
  if(!detail)return;
  const row=creditPoints[Number(point.dataset.creditPoint)];
  const game=row.current?null:seasonGames.find(g=>Number(g.round)===row.round);
  detail.innerHTML=window.ChartGameCard.render({
   game,heading:row.current?'מחיר נוכחי':'מחיר לפני מחזור '+row.round,
   values:[...gameValues(game),['קרדיט',fmt(row.price)]]
  });
 }
 const draw=rounds=>{
  creditPoints=creditRows(rounds,player).filter(r=>r.price>0);
  credits.innerHTML=creditChart(creditPoints,!compactMarket);
  showCredit(credits.querySelector('[aria-pressed="true"]'));
 };
 const select=e=>{
  const point=e.target.closest('[data-credit-point]');if(!point)return;
  if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
  if(e.type==='keydown')e.preventDefault();
  showCredit(point);
 };
 credits.onclick=select;
 credits.onkeydown=select;
 const gamesList=document.createElement('div');panes.games.prepend(gamesList);
 let range='0',venue='all',data=null,seasonGames=[],selected=[],currentTab='overview';
 draw([]);
 creditHistory().then(rounds=>{if(body.contains(credits))draw(rounds);},()=>{});
 function activate(id,focus=false){currentTab=id;for(const [key,pane] of Object.entries(panes))pane.hidden=key!==id;for(const b of tabs.children){const on=b.dataset.playerTab===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();}}
 tabs.onclick=e=>{const b=e.target.closest('[data-player-tab]');if(b)activate(b.dataset.playerTab);};
 tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=Object.keys(labels),i=ids.indexOf(currentTab);activate(e.key==='Home'?ids[0]:e.key==='End'?ids.at(-1):ids[(i+(e.key==='ArrowLeft'?1:3))%4],true);};
 controls.onclick=e=>{const b=e.target.closest('[data-range]');if(!b)return;range=b.dataset.range;for(const el of controls.children)el.setAttribute('aria-pressed',String(el===b));render();};
 venueControls.onclick=e=>{
  const button=e.target.closest('[data-player-venue]');
  if(!button)return;
  venue=button.dataset.playerVenue;
  for(const el of venueControls.children)el.setAttribute('aria-pressed',String(el===button));
  render();
 };
 function gameCard(g){const s=g.stats||{};return `<article class="ef-game-card"><header><div><b>${esc(g.opponent)}</b><small>${date(g.date)} · ${g.home===true?'בית':g.home===false?'חוץ':'מיקום לא ידוע'}${g.round?' · מחזור '+esc(g.round):''}</small></div>${safeLink(g.source)}</header>${g.minutes===0?'<p class="muted">לא שיחק</p>':metrics([['PIR',g.minutes>0?fmt(s.valuation):'—'],['נקודות',fmt(s.points)],['דקות',fmt(g.minutes)],['עבירות שסחט',fmt(s.foulsReceived)]])}</article>`;}
 function render(){
  if(!data)return;
  const venueGames=venue==='all'?seasonGames:seasonGames.filter(game=>game.home===(venue==='home'));
  selected=range==='0'?venueGames:venueGames.slice(0,Number(range));
  const usage=U.summarize(selected),df=D.summarize(selected,data,null),played=selected.filter(g=>g.minutes>0),latest=selected[0];
  const avg=k=>played.length&&played.every(g=>U.num(g.stats?.[k])!==null)?played.reduce((s,g)=>s+Number(g.stats[k]),0)/played.length:null;
  const tag=range==='1'?'משחק אחרון':range==='0'?'כל העונה':range+' משחקים אחרונים';
  const location=venue==='home'?' · בית':venue==='away'?' · חוץ':'';
  status.textContent=`עונת 2026/27 · ${tag}${location} · ${selected.length} משחקים ברישום, ${played.length} עם דקות`;
  const stats=hero.querySelector('.ef-player-stats'),price=player.price;
  stats.innerHTML=metrics([['מחיר נוכחי · קרדיט',price],['ממוצע PIR · הטווח שנבחר',avg('valuation')],['ממוצע דקות · הטווח שנבחר',played.length?usage.minutes===null?null:usage.minutes/played.length:null],['ממוצע נקודות · הטווח שנבחר',avg('points')]].map(([label,value])=>[label,fmt(value)]));
  renderTrend(plot,pirTrend);
  renderTrend(minutesPlot,minutesTrend);
  renderTrend(freeThrowsPlot,freeThrowsTrend);
  summary.innerHTML=`${metrics([rate('Usage רגיל',usage.regular),rate('Usage כולל · עם אסיסטים',usage.combined),metric('עבירות שסחט למשחק',fmt(avg('foulsReceived')))],{panel:'ef-usage-preview'})}${compactMarket?'':`<p class="ef-method muted">אומדנים מבוקס סקור ודקות; Usage כולל הוא מדד מותאם, לא אחוז פוזשנים ייחודיים.</p><h3 class="ef-last-title">המשחק האחרון</h3>${latest?gameCard(latest):'<p class="muted">אין משחקים זמינים בסינון שנבחר.</p>'}`}`;
  panes.usage.innerHTML=`<h3>מעורבות בהתקפה</h3>${metrics([rate('Usage רגיל',usage.regular),rate('Usage כולל · עם אסיסטים',usage.combined),metric('זריקות מהשדה · סה״כ',fmt(usage.fga)),metric('ניסיונות עונשין · סה״כ',fmt(usage.fta)),metric('אסיסטים · סה״כ',fmt(usage.assists)),['איבודים · סה״כ',fmt(usage.turnovers),'',usage.turnovers>0?'negative':'']])}<p class="ef-method">Usage רגיל: זריקות מהשדה + 0.44 מניסיונות העונשין + איבודים, ביחס לאומדן אירועי הקבוצה בזמן דקות השחקן. Usage כולל מוסיף אסיסטים; הוא מדד מעורבות מותאם לאפליקציה. אין כאן מדידה של זמן החזקת כדור. כמה משחקים משוקללים לפי החשיפה, ולא בממוצע פשוט.</p>`;
  panes.defense.innerHTML=`<h3>הגנה וריבאונד</h3>${metrics([rate('אחוז חטיפות משוער',df.stl),rate('אחוז חסימות משוער',df.blk),rate('אחוז ריבאונד משוער',df.reb),rate('אחוז ריבאונד הגנה משוער',df.drb),metric('חטיפות · סה״כ',fmt(df.steals)),metric('חסימות · סה״כ',fmt(df.blocks)),metric('ריבאונדים · סה״כ',fmt(df.rebounds)),metric('ריבאונד התקפה · סה״כ',fmt(df.offensiveRebounds))])}<p class="ef-method">אחוזים משוערים מנתוני הבוקס סקור ודקות המשחק. הם מתארים פעולות מסוימות ואינם ציון כולל לאיכות ההגנה. נתון חסר מוצג כ־—.</p>`;
  gamesList.innerHTML='<h3>משחקים · מהחדש לישן</h3>'+(selected.length
   ?compactMarket
    ?`<div class="ef-history-grid ef-history-head" aria-hidden="true"><span>יריבה</span><span>PIR</span><span>נקודות</span><span>דקות</span></div>${selected.map(marketGameRow).join('')}`
    :selected.map(gameCard).join('')
   :'<p class="muted">אין משחקים זמינים בטווח שנבחר.</p>');
 }
 function renderTrend(target,metric){
  target.innerHTML=chart(selected,metric);
  const points=target.querySelectorAll('[data-game-index]');
  if(!points.length)return;
  const marketSelection=compactMarket&&metric!==freeThrowsTrend;
  const detail=marketSelection?document.createElement('p'):compactMarket?null:document.createElement('div');
  if(detail){
   detail.className=marketSelection?'ef-pir-selection':metric===freeThrowsTrend?'ef-ft-detail':'ef-chart-detail';
   detail.setAttribute('aria-live','polite');
   target.append(detail);
  }
  const games=selected.slice().reverse();
  const show=point=>{
   target.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed','false');
   point.setAttribute('aria-pressed','true');
   if(!detail)return;
   const game=games[Number(point.dataset.gameIndex)];
   if(marketSelection){
    const opponent=canonicalTeam(game.opponent)||'יריבה לא ידועה';
    const value=metric===minutesTrend?trendDetail(game,metric)+' · ':'';
    detail.textContent=`${value}מול ${opponent} · ${gameVenue(game)} · ${date(game.date)}`;
    return;
   }
   const values=gameValues(game,metric===minutesTrend?duration:fmt);
   if(metric===freeThrowsTrend)values.push(['עונשין · קליעות/ניסיונות',freeThrowValue(game)]);
   detail.innerHTML=window.ChartGameCard.render({game,values});
  };
  for(const point of points){
   point.onclick=()=>show(point);
   point.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(point);}};
  }
  const latest=points[points.length-1];
  if(marketSelection)latest.setAttribute('aria-pressed','true');
  else show(latest);
 }
 dataset().then(d=>{
  if(!body.contains(hero))return;
  data=d;seasonGames=U.selectGames(window.PlayerIdentity.lookup(d.players,player),'0');
  render();showCredit(activeCredit);
 }).catch(()=>{if(body.contains(hero)){status.textContent='לא ניתן לטעון את הנתונים כרגע. סגור ופתח את השחקן כדי לנסות שוב.';}});
 media().then(d=>{if(!body.contains(hero)||d?.season!=='E2026')return;const m=window.PlayerIdentity.lookup(d.players,player);if(!m||canonicalTeam(m.club)!==canonicalTeam(player.team))return;photo(hero.querySelector('.ef-player-avatar'),m.photo,'תמונה של '+name);
 if(m.crest&&canonicalTeam(m.club)===canonicalTeam(player.team)){const crest=document.createElement('span');crest.className='ef-club-crest';hero.querySelector('.ef-player-identity p').prepend(crest);photo(crest,m.crest,m.club);}
 });
};
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='api-live.euroleague.net'?`<a href="${esc(url)}" target="_blank" rel="noopener">מקור רשמי ↗</a>`:'';}catch{return '';}}
})();
