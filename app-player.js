/* Player dashboard: official current-season data, shared Usage/defense formulas. */
(()=>{
'use strict';
const original=window.showPlayer,U=window.UsageCore,D=window.DefenseCore;
if(typeof original!=='function'||!U||!D)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>U.num(v)===null?'—':Number(v).toFixed(1);
const date=d=>new Date(d).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'});
let cached=null,loaded=0,pending=null,mediaPromise=null;
function dataset(){if(cached&&Date.now()-loaded<60000)return Promise.resolve(cached);if(pending)return pending;
 pending=fetch('./data/official-offense.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(d=>{if(d.season!=='E2026'||d.schema!=='official-offense-v1')throw Error('season');cached=d;loaded=Date.now();return d;}).finally(()=>{pending=null;});return pending;}
function media(){if(!mediaPromise)mediaPromise=fetch('./data/player-media.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('media');return r.json();}).catch(()=>{mediaPromise=null;return null;});return mediaPromise;}
function safeImage(url){try{const u=new URL(url);return u.protocol==='https:'&&['media-cdn.cortextech.io','media-cdn.incrowdsports.com','media-cdn.euroleague.net'].includes(u.hostname)?url:null;}catch{return null;}}
function photo(host,url,alt){if(!host||!safeImage(url))return;const img=new Image();img.alt=alt;img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{if(host.isConnected){host.replaceChildren(img);host.removeAttribute('aria-hidden');}};img.src=url;}
const metric=(label,value,note='')=>`<div class="ef-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${note?`<span>${esc(note)}</span>`:''}</div>`;
const rate=(label,r)=>metric(label,r.value===null?'—':fmt(r.value)+'%',`${r.covered} הופעות בחישוב${r.missing?' · '+r.missing+' חסרות':''}`);
function chart(games){
 const rows=games.slice().reverse(),valid=rows.filter(g=>g.minutes>0&&U.num(g.stats?.valuation)!==null);
 if(!valid.length)return '<p class="muted">אין נתוני PIR למשחקים בטווח הזה.</p>';
 const lo=Math.min(0,...valid.map(g=>g.stats.valuation)),hi=Math.max(10,...valid.map(g=>g.stats.valuation)),span=hi-lo||1;
 const x=i=>42+(rows.length===1?150:i*300/(rows.length-1)),y=v=>160-(v-lo)/span*130;
 let paths=[],current=[];rows.forEach((g,i)=>{if(g.minutes>0&&U.num(g.stats?.valuation)!==null)current.push(`${x(i)},${y(g.stats.valuation)}`);else if(current.length){paths.push(current);current=[];}});if(current.length)paths.push(current);
 return `<svg class="ef-trend-svg" viewBox="0 0 372 202" role="img" aria-label="PIR בפועל, מהישן לחדש"><title>PIR בפועל · עונת 2026/27</title>${[0,.5,1].map(t=>{const v=lo+span*t;return `<line x1="42" x2="342" y1="${y(v)}" y2="${y(v)}" class="ef-gridline"/><text x="32" y="${y(v)+4}" text-anchor="end">${Math.round(v)}</text>`;}).join('')}${paths.map(p=>`<polygon points="${p[0].split(',')[0]},160 ${p.join(' ')} ${p.at(-1).split(',')[0]},160" fill="currentColor" opacity=".08"/><polyline points="${p.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5"/>`).join('')}${rows.map((g,i)=>{const ok=g.minutes>0&&U.num(g.stats?.valuation)!==null;return `${ok?`<circle class="pirPoint" data-game-index="${i}" tabindex="0" role="button" aria-label="${esc(date(g.date)+' '+g.opponent+' PIR '+g.stats.valuation)}" cx="${x(i)}" cy="${y(g.stats.valuation)}" r="4.5" fill="currentColor"><title>${esc(g.opponent)} · ${fmt(g.stats.valuation)}</title></circle>`:''}${rows.length<=5||i===0||i===rows.length-1?`<text x="${x(i)}" y="185" text-anchor="middle">${date(g.date)}</text>`:''}`;}).join('')}</svg>`;
}
window.showPlayer=function(name){
 original.apply(this,arguments);
 const body=document.getElementById('modalBody'),hero=body?.querySelector('.ef-player-hero');if(!hero)return;
 body.classList.add('ef-dashboard');body.querySelector('.ef-player-jumps')?.remove();
 const tabs=document.createElement('div');tabs.className='ef-player-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','נתוני שחקן');
 const labels={overview:'סקירה',usage:'Usage',defense:'הגנה',games:'משחקים'},panes={};
 for(const [id,label] of Object.entries(labels)){const pane=document.createElement('section');pane.id='efPane-'+id;pane.className='ef-player-pane';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','efTab-'+id);pane.hidden=id!=='overview';panes[id]=pane;tabs.insertAdjacentHTML('beforeend',`<button type="button" role="tab" id="efTab-${id}" aria-controls="efPane-${id}" aria-selected="${id==='overview'}" tabindex="${id==='overview'?0:-1}" data-player-tab="${id}">${label}</button>`);}
 for(const child of [...body.children])if(child!==hero)panes.overview.append(child);
 const actual=panes.overview.querySelector('.actual-results');if(actual){const details=document.createElement('details');details.className='ef-extra-stats';details.innerHTML='<summary>נתונים נוספים ושינויי קרדיט</summary>';details.append(actual);panes.games.append(details);}
 body.append(tabs);
 const controls=document.createElement('div');controls.className='ef-chart-ranges';controls.setAttribute('role','group');controls.setAttribute('aria-label','טווח נתוני השחקן');controls.innerHTML=[['1','אחרון'],['3','3 משחקים'],['5','5 משחקים'],['0','עונה']].map(([n,l])=>`<button type="button" data-range="${n}" aria-pressed="${n==='5'}">${l}</button>`).join('');body.append(controls);
 const status=document.createElement('p');status.className='ef-data-status muted';status.setAttribute('role','status');status.textContent='טוען נתוני משחק מאומתים…';body.append(status,...Object.values(panes));
 const overview=document.createElement('div');overview.className='ef-overview-data';panes.overview.prepend(overview);
 const gamesList=document.createElement('div');panes.games.prepend(gamesList);
 let range='5',data=null,profile=null,selected=[],currentTab='overview';
 function activate(id,focus=false){currentTab=id;for(const [key,pane] of Object.entries(panes))pane.hidden=key!==id;for(const b of tabs.children){const on=b.dataset.playerTab===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();}}
 tabs.onclick=e=>{const b=e.target.closest('[data-player-tab]');if(b)activate(b.dataset.playerTab);};
 tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=Object.keys(labels),i=ids.indexOf(currentTab);activate(e.key==='Home'?ids[0]:e.key==='End'?ids.at(-1):ids[(i+(e.key==='ArrowLeft'?1:3))%4],true);};
 controls.onclick=e=>{const b=e.target.closest('[data-range]');if(!b)return;range=b.dataset.range;for(const el of controls.children)el.setAttribute('aria-pressed',String(el===b));render();};
 function gameCard(g){const s=g.stats||{};return `<article class="ef-game-card"><header><div><b>${esc(g.opponent)}</b><small>${date(g.date)} · ${g.home===true?'בית':g.home===false?'חוץ':'מיקום לא ידוע'}${g.round?' · מחזור '+esc(g.round):''}</small></div>${safeLink(g.source)}</header>${g.minutes===0?'<p class="muted">לא שיחק</p>':`<div class="ef-game-numbers">${metric('PIR',g.minutes>0?fmt(s.valuation):'—')}${metric('נקודות',fmt(s.points))}${metric('דקות',fmt(g.minutes))}</div>`}</article>`;}
 function render(){
  if(!data)return;selected=U.selectGames(profile,range);const usage=U.summarize(selected),df=D.summarize(selected,data,null),played=selected.filter(g=>g.minutes>0),latest=U.selectGames(profile,'1')[0];
  const avg=k=>played.length&&played.every(g=>U.num(g.stats?.[k])!==null)?played.reduce((s,g)=>s+Number(g.stats[k]),0)/played.length:null;
  const tag=range==='1'?'משחק אחרון':range==='0'?'כל העונה':range+' משחקים אחרונים';
  status.textContent=`עונת 2026/27 · ${tag} · ${selected.length} משחקים ברישום, ${played.length} עם דקות`;
  const stats=hero.querySelector('.ef-player-stats'),price=typeof players!=='undefined'?players.find(p=>p.name===name)?.price:null;
  stats.innerHTML=[['מחיר נוכחי · קרדיט',price],['ממוצע PIR · הטווח שנבחר',avg('valuation')],['ממוצע דקות · הטווח שנבחר',played.length?usage.minutes===null?null:usage.minutes/played.length:null],['ממוצע נקודות · הטווח שנבחר',avg('points')]].map(([l,v])=>`<div><small>${l}</small><b>${fmt(v)}</b></div>`).join('');
  overview.innerHTML=`<section class="playerSection ef-player-history"><h3 class="sectionTitle">מגמת ביצועים · PIR</h3><p class="muted">תוצאות בפועל · מהישן לחדש</p>${chart(selected)}<p class="ef-chart-detail muted" aria-live="polite">לחץ על נקודה להצגת המשחק</p></section><div class="ef-metric-grid ef-usage-preview">${rate('Usage רגיל',usage.regular)}${rate('Usage כולל · עם אסיסטים',usage.combined)}</div><p class="ef-method muted">אומדנים מבוקס סקור ודקות; Usage כולל הוא מדד מותאם, לא אחוז פוזשנים ייחודיים.</p><h3 class="ef-last-title">המשחק האחרון</h3>${latest?gameCard(latest):'<p class="muted">אין משחקים זמינים לשחקן בעונה הנוכחית.</p>'}`;
  panes.usage.innerHTML=`<h3>מעורבות בהתקפה</h3><div class="ef-metric-grid">${rate('Usage רגיל',usage.regular)}${rate('Usage כולל · עם אסיסטים',usage.combined)}${metric('זריקות מהשדה · סה״כ',fmt(usage.fga))}${metric('ניסיונות עונשין · סה״כ',fmt(usage.fta))}${metric('אסיסטים · סה״כ',fmt(usage.assists))}${metric('איבודים · סה״כ',fmt(usage.turnovers))}</div><p class="ef-method">Usage רגיל: זריקות מהשדה + 0.44 מניסיונות העונשין + איבודים, ביחס לאומדן אירועי הקבוצה בזמן דקות השחקן. Usage כולל מוסיף אסיסטים; הוא מדד מעורבות מותאם לאפליקציה. אין כאן מדידה של זמן החזקת כדור. כמה משחקים משוקללים לפי החשיפה, ולא בממוצע פשוט.</p>`;
  panes.defense.innerHTML=`<h3>הגנה וריבאונד</h3><div class="ef-metric-grid">${rate('אחוז חטיפות משוער',df.stl)}${rate('אחוז חסימות משוער',df.blk)}${rate('אחוז ריבאונד משוער',df.reb)}${rate('אחוז ריבאונד הגנה משוער',df.drb)}${metric('חטיפות · סה״כ',fmt(df.steals))}${metric('חסימות · סה״כ',fmt(df.blocks))}${metric('ריבאונדים · סה״כ',fmt(df.rebounds))}${metric('ריבאונד התקפה · סה״כ',fmt(df.offensiveRebounds))}</div><p class="ef-method">אחוזים משוערים מנתוני הבוקס סקור ודקות המשחק. הם מתארים פעולות מסוימות ואינם ציון כולל לאיכות ההגנה. נתון חסר מוצג כ־—.</p>`;
  gamesList.innerHTML='<h3>משחקים · מהחדש לישן</h3>'+(selected.length?selected.map(gameCard).join(''):'<p class="muted">אין משחקים זמינים בטווח שנבחר.</p>');
  overview.querySelectorAll('[data-game-index]').forEach(point=>{const show=()=>{const g=selected.slice().reverse()[Number(point.dataset.gameIndex)];overview.querySelector('.ef-chart-detail').textContent=`${date(g.date)} · ${g.opponent} · PIR ${fmt(g.stats.valuation)} · ${fmt(g.minutes)} דקות`;};point.onclick=show;point.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};});
 }
 dataset().then(d=>{if(!body.contains(hero))return;data=d;profile=d.players[U.key(name)];render();}).catch(()=>{if(body.contains(hero)){status.textContent='לא ניתן לטעון את הנתונים כרגע. סגור ופתח את השחקן כדי לנסות שוב.';}});
 media().then(d=>{if(!body.contains(hero)||d?.season!=='E2026')return;const m=d.players?.[U.key(name)];if(!m)return;photo(hero.querySelector('.ef-player-avatar'),m.photo,'תמונה של '+name);const p=typeof players!=='undefined'?players.find(p=>p.name===name):null;
 if(m.crest&&p&&typeof canonicalTeam==='function'&&canonicalTeam(m.club)===canonicalTeam(p.team)){const crest=document.createElement('span');crest.className='ef-club-crest';hero.querySelector('.ef-player-identity p').prepend(crest);photo(crest,m.crest,m.club);}
 });
};
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='api-live.euroleague.net'?`<a href="${esc(url)}" target="_blank" rel="noopener">מקור רשמי ↗</a>`:'';}catch{return '';}}
})();
