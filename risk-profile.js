(() => {
'use strict';
const R=window.PlayerRiskProfile, picker=window.playerToolSelection;
const button=document.createElement('button'), section=document.createElement('section');
button.type='button';
button.dataset.tab='playerRisk';
button.textContent='פרופיל סיכון';
document.querySelector('nav.tabs').append(button);
section.id='playerRisk';
section.className='tab';
section.setAttribute('aria-label','פרופיל סיכון');
section.innerHTML=`<div class="risk-shell" dir="rtl">
 <div class="player-picker-modes" role="group" aria-label="בחירת רשימת שחקנים">
  <button type="button" data-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button>
  <button type="button" data-scope="team" aria-pressed="false">לפי קבוצה</button>
 </div>
 <div class="player-picker-controls risk-picker">
  <label hidden>קבוצה<select data-team></select></label>
  <label class="risk-player-picker">שחקן · לפי מחיר<select data-player></select></label>
  <button type="button" class="risk-refresh" data-refresh>רענון</button>
 </div>
 <p class="risk-status" data-status role="status"></p>
 <div data-result></div>
 </div>`;
document.querySelector('main').append(section);

const $=s=>section.querySelector(s), decimal=new Intl.NumberFormat('he-IL',{maximumFractionDigits:1}),
 date=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric'});
const levels=['נמוך','בינוני','גבוה','גבוה מאוד'];
const titles={low:'10 PIR ומטה',miss5:'5 PIR ומעלה מתחת לתחזית',miss10:'10 PIR ומעלה מתחת לתחזית'};
const positions={G:'גארד',F:'פורוורד',C:'סנטר'};
const out=$('[data-result]'), select=$('[data-player]'), team=$('[data-team]'), status=$('[data-status]');
let data, pending, loadedAt=0, scope='all', selected='', shownProfile;
const fmt=(value,unit='')=>!Number.isFinite(value)?'—':decimal.format(value)+(unit==='%'?'%':unit?' '+unit:'');
const text=value=>'<bdi>'+esc(value)+'</bdi>';
const sample=(id,count)=>['positionLow','peerLow'].includes(id)?count+' הופעות יריבים':
 ['allowedThree','allowedFouls','allowedRebound','pirWeakness','forced','pace','allowedRim','allowedZones','matchFit','lineFit'].includes(id)?
 count+' משחקי יריבה':id==='availability'?'עדכון סגל':count+' הופעות';
const identity=() => {
 const rows=players.filter(p=>positions[p.pos]).map(p=>({...p,id:String(p.fantasy_id||p.name),team:canonicalTeam(p.team)}))
  .sort((a,b)=>(Number(b.price)||0)-(Number(a.price)||0)||a.name.localeCompare(b.name));
 const clubs=[...new Set(rows.map(p=>p.team))].sort();
 const oldTeam=team.value;
 team.replaceChildren(...clubs.map(name=>new Option(name,name)));
 const previous=rows.find(p=>p.id===selected);
 team.value=clubs.includes(oldTeam)?oldTeam:previous?.team||clubs[0]||'';
 const choices=picker.rows(rows,scope==='team'?team.value:'');
 select.replaceChildren(...choices.map(p=>picker.option(p,scope==='all')));
 if (choices.some(p=>p.id===selected)) select.value=selected;
 select.disabled=!choices.length;
 return choices.find(p=>p.id===select.value);
};
const image=(src,className='')=>src?'<img class="'+className+'" src="'+esc(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'';
function imageFallbacks() {
 for (const img of out.querySelectorAll('img')) {
  const fail=()=>{img.hidden=true;};
  img.addEventListener('error',fail,{once:true});
  if (img.complete && !img.naturalWidth) fail();
 }
}
const descriptions=new Map(R.metrics.map(m=>[m.id,m.help]));
function details(f) {
 return f.details?.length?'<ul class="risk-details">'+f.details.map(([label,value,unit])=>
  '<li><span>'+esc(label)+'</span><bdi>'+esc(Number.isFinite(value)?fmt(value,unit):value??'—')+'</bdi></li>').join('')+'</ul>':'';
}
function evidence(f,tone) {
 return `<article class="risk-evidence" data-factor="${esc(f.id)}"${tone?' data-tone="'+tone+'"':''}>
   <div><b>${esc(f.label)}</b><small>${sample(f.id,f.count)}</small></div><strong>${text(f.id==='availability'?f.details[0][0]:fmt(f.value,f.unit))}</strong>
   ${tone && descriptions.has(f.id)?'<p class="risk-factor-info">'+esc(descriptions.get(f.id))+'</p>':''}
   ${f.id==='availability'?'':details(f)}</article>`;
}
function riskTile(id,result) {
 return `<article class="risk-tile"><span>${titles[id]}</span>${result?
  `<strong data-level="${result.level}">${result.probability==null?levels[result.level]:text(Math.round(100*result.probability)+'%')}</strong>
   <small>ביטחון ${result.confidence} · ${result.sample} תחזיות היסטוריות</small>`:
  '<strong class="risk-unrated">אין דירוג</strong><small>נדרש מדגם מתאים</small>'}</article>`;
}
function fixtureFor(player) {
 const games=data?.fixtures||[];
 const now=Date.now();
 const game=games.find(g=>g.start>now&&(g.home===player.team||g.away===player.team));
 if (!game) return null;
 const home=game.home===player.team;
 return {...game,home,opponent:home?game.away:game.home,crest:home?game.awayCrest:game.homeCrest};
}
function forecastCard(label,value,caption='') {
 return `<article class="risk-tile"><span>${label}</span><strong>${text(value)}</strong>${caption?'<small>'+caption+'</small>':''}</article>`;
}
function render() {
 const p=identity();
 if (!data || !p) {out.replaceChildren();return;}
 const f=fixtureFor(p);
 const x=model(p);
 const currentOpponent=canonicalTeam(x.match?.opponent||p.opponent);
 // During round rollover the schedule can advance ahead of the market inputs.
 const forecast=f && currentOpponent===f.opponent ? x : {};
 const cacheKey=[p.id,p.status,p.price,p.team,f?.code,forecast.expected,forecast.minutes,
  forecast.missingStars?.join('|')].join('/');
 if (shownProfile?.key!==cacheKey) {
  const profile=R.describe(data.prepared,p,f||{},forecast);
  shownProfile={key:cacheKey,profile,analysis:R.evaluate(profile,forecast,p,data.calibration)};
 }
 const {profile,analysis}=shownProfile, {risks,factors}=analysis;
 const primary=risks.miss5;
 const photo=playerCardImageUrl(playerCardProfile(p)?.photo);
 const opponentCrest=f && (playerCardCrests.get(f.opponent)||playerCardImageUrl(f.crest));
 const best=factors.slice(0,6);
 const positives=best.filter(r=>r.effect<0), negatives=best.filter(r=>r.effect>0);
 const projection=window.getPlayerDnaForecast?.(p.name);
 const projected=f && projection?.opponent===f.opponent ?
  window.PlayerDnaMetrics.projection(projection.frozen,window.WeightedForecast,projection.weights,projection.profile):null;
 const allStats={...profile.rows};
 if (projected) allStats.projection={id:'projection',label:'התאמת PIR צפוי לסגנון',unit:'PIR',...projected};
 const riskSummary=p.status==='out'?'מסומן בחוץ':primary?'סיכון '+levels[primary.level]:'אין דירוג סיכון';
 const expanded=out.querySelector('.risk-full')?.open;
 const oldName=out.dataset.renderedPlayer;
 out.dataset.renderedPlayer=p.id;
 const range=Number.isFinite(forecast.floor)&&Number.isFinite(forecast.ceiling)?
  fmt(forecast.floor)+'–'+fmt(forecast.ceiling):'—';
 out.innerHTML=`<article class="risk-hero">
  <div class="risk-player"><div class="risk-portrait">${image(photo,'risk-photo')}${squadJersey(p)}</div>
   <div><h3>${text(typeof reorderCommaName==='function'?reorderCommaName(p.name):p.name)}</h3>
   <p>${text(p.team)} · ${positions[p.pos]} · ${text(fmt(Number(p.price),'CR'))}</p>
   <span class="risk-badge" data-level="${primary?.level??'unknown'}">${riskSummary}</span>
   ${primary?'<small>5 PIR ומעלה מתחת לתחזית · ביטחון '+primary.confidence+'</small>':''}</div></div>
  <div class="risk-opponent">${image(opponentCrest)}<div>
   <b>${f?'מול '+text(f.opponent):'היריבה טרם נקבעה'}</b>
   ${f?'<small>מחזור '+esc(f.round)+' · '+date.format(f.start)+' · '+(f.neutral?'ניטרלי':f.home?'בית':'חוץ')+'</small>':''}
  </div></div>
 </article>
 ${f && currentOpponent!==f.opponent?'<p class="risk-note">ממתין לסנכרון התחזית מול היריבה הבאה.</p>':''}
 ${p.status==='questionable'?'<p class="risk-note">השחקן בספק. דירוג הסיכון מתייחס למקרה שבו ישחק.</p>':''}
 <div class="risk-grid" aria-label="תחזית למשחק">
  ${forecastCard('PIR צפוי',fmt(forecast.expected))}
  ${forecastCard('דקות צפויות',fmt(forecast.minutes))}
  ${forecastCard('טווח PIR חזוי',range,range==='—'?'':forecast.rangeSample?'מבוסס על שגיאות עבר':'טווח נוסחתי של מנוע החיזוי')}
  ${riskTile('low',risks.low)}
  ${riskTile('miss5',risks.miss5)}
  ${riskTile('miss10',risks.miss10)}
 </div>
 ${R.endpoints.some(id=>risks[id] && risks[id].probability==null)?
  '<p class="risk-note">רמות הסיכון הן דירוג יחסי לפי מחזורי העונה שנבדקו. הסתברות מוצגת אחרי כיול מול משחקים מחוץ לאימון.</p>':''}
 ${best.length?`<section class="risk-factors"><h3>מה משפיע על הסיכון?</h3>
  <div class="risk-grid">${best.map(r=>`<article class="risk-tile" data-tone="${r.effect<0?'support':r===negatives[0]?'risk':'watch'}">
  <span>${esc(r.label)}</span><strong>${text(r.id==='availability'?r.details[0][0]:fmt(r.value,r.unit))}</strong><small>${sample(r.id,r.count)}</small></article>`).join('')}</div>
  <p class="risk-note">הכיוון מבוסס על מודל ההחמצה של 5 PIR. המדדים מתארים קשר היסטורי.</p>
  ${negatives.length?`<div class="risk-direction" data-tone="risk"><h4>מעלים את דירוג הסיכון</h4>${negatives.map((f,i)=>evidence(f,i?'watch':'risk')).join('')}</div>`:''}
  ${positives.length?`<div class="risk-direction" data-tone="support"><h4>תומכים בביצוע טוב</h4>${positives.map(f=>evidence(f,'support')).join('')}</div>`:''}</section>`:
  '<p class="risk-note">נדרש מדגם מתאים כדי לדרג את הגורמים. המדדים הזמינים מופיעים בניתוח המלא.</p>'}
 <details class="risk-full"${expanded && oldName===p.id?' open':''}><summary>ניתוח מלא</summary>
  <p class="risk-note">${profile.games} הופעות בקבוצה הנוכחית · ${R.metrics.filter(m=>allStats[m.id]).length} מתוך ${R.metrics.length} מדדי DNA זמינים בהקשר הזה</p>
  <div class="risk-analysis">${Object.values(allStats).map(f=>evidence(f)).join('')||'<p>אין עדיין נתוני משחק לשחקן בקבוצה הנוכחית.</p>'}</div>
 </details>`;
 imageFallbacks();
}
function refresh(force=false) {
 if (pending) return pending;
 if (!force && data && Date.now()-loadedAt<120000) {render();return;}
 status.textContent='טוען את נתוני עונת 2026/27…';
 $('[data-refresh]').disabled=true;
 const get=(name,optional=false)=>window.loadGameData(name,force).catch(error=>{
  if (optional) return null;
  throw error;
 });
 pending=Promise.all([
  get('official-offense.json'),get('context/E2026-schedule.json'),get('advanced-players.json',true),
  get('player-dna-events.json',true),get('team-dna-events.json',true),get('risk-profile.json',true)
 ]).then(([official,schedule,events,dnaEvents,teamEvents,calibration])=>{
  if (official.season!==R.season) throw Error('Wrong season');
  const now=Date.now();
  const neutral=new Set(schedule.data.filter(g=>g.isNeutralVenue).map(g=>Number(g.gameCode)));
  const finished=new Set(official.teamResults.map(g=>Number(g.gameCode)));
  const fixtures=schedule.data.filter(g=>g.season?.code===R.season && g.played===false && !finished.has(Number(g.gameCode)) &&
   g.local?.club?.name && g.road?.club?.name && !g.local.club.isVirtual && !g.road.club.isVirtual)
   .map(g=>({code:g.gameCode,round:g.round,start:Date.parse(g.utcDate),neutral:g.isNeutralVenue===true,
    home:canonicalTeam(g.local.club.name),away:canonicalTeam(g.road.club.name),
    homeCrest:g.local.club.images?.crest,awayCrest:g.road.club.images?.crest})).sort((a,b)=>a.start-b.start);
  const prepared=R.prepare({...official,teamResults:official.teamResults.map(g=>({...g,neutral:neutral.has(Number(g.gameCode))}))},
   events,now,{dnaEvents,teamEvents});
  data={prepared,fixtures,calibration};
  loadedAt=now;
  shownProfile=null;
  status.textContent='';
  if (section.classList.contains('active')) render();
 }).catch(()=>{
  status.textContent=data?'הרענון לא הצליח. מוצגים הנתונים האחרונים.':'לא ניתן לטעון את נתוני הסיכון כרגע.';
 }).finally(()=>{
  pending=null;
  $('[data-refresh]').disabled=false;
 });
 return pending;
}
button.onclick=()=>{
 document.querySelectorAll('.tabs button,.tab').forEach(node=>node.classList.remove('active'));
 button.classList.add('active');
 section.classList.add('active');
 identity();
 void refresh();
};
for (const b of section.querySelectorAll('[data-scope]')) b.onclick=()=>{
 scope=b.dataset.scope;
 for (const mode of section.querySelectorAll('[data-scope]')) mode.setAttribute('aria-pressed',String(mode===b));
 team.closest('label').hidden=scope==='all';
 render();
};
team.onchange=()=>{selected='';render();};
select.onchange=()=>{
 selected=select.value;
 picker.set(players.find(p=>String(p.fantasy_id||p.name)===selected)?.name);
 render();
};
$('[data-refresh]').onclick=()=>{
 void window.refreshFantasyLive?.();
 void refresh(true);
};
document.addEventListener('fantasy-live-updated',()=>{if(section.classList.contains('active')) void refresh();});
document.addEventListener('fantasy-player-media-ready',()=>{if(section.classList.contains('active')) render();});
window.addEventListener('player-dna-forecast-ready',()=>{if(section.classList.contains('active')) render();});
})();
