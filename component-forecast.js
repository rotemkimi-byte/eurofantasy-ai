/* Read-only experiment. The active forecasting and weight settings live elsewhere. */
(()=>{
'use strict';

const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');
if(!nav||!main)return;
const tab=document.createElement('button');
tab.type='button';
tab.dataset.tab='componentForecast';
tab.textContent='מודל חדש';
nav.append(tab);
const section=document.createElement('section');
section.id='componentForecast';
section.className='tab';
section.innerHTML=`<div class="card cf-shell">
 <header><h2>מודל חדש</h2><p>חיזוי רכיבי PIR · EuroLeague 2026/27 · ניסיוני</p></header>
 <div class="cf-switch" role="group" aria-label="תצוגת מודל חדש">
  <button type="button" data-view="forecast" aria-pressed="true">תחזית</button>
  <button type="button" data-view="performance" aria-pressed="false">ביצועים</button>
 </div>
 <p data-state role="status"></p>
 <div data-panel="forecast">
  <div class="cf-controls">
   <label>קבוצה<select data-team></select></label>
   <label>שחקן · לפי מחיר<select data-player></select></label>
  </div>
  <div data-forecast aria-live="polite"></div>
 </div>
 <div data-panel="performance" hidden>
  <div data-metrics></div>
  <h3>תחזיות לפי משחק</h3>
  <div class="cf-controls">
   <label>שלב<select data-phase><option value="holdout">מדגם מבחן</option><option value="development">מחזורי פיתוח</option><option value="prospective">תחזיות שנשמרו לפני המשחק</option><option value="all">כל המחזורים</option></select></label>
   <label>מחזור<select data-round></select></label>
   <label>קבוצה<select data-history-team></select></label>
   <label>שחקן<select data-history-player></select></label>
   <label>מיון<select data-order><option value="miss">טעות מהגדולה לקטנה</option><option value="hit">התחזיות המדויקות ביותר</option><option value="round">לפי מחזור</option><option value="team">לפי קבוצה</option><option value="player">לפי שחקן</option></select></label>
  </div>
  <button type="button" class="secondary" data-shorts>כל המשחקים של טי. ג׳יי. שורטס</button>
  <div data-history aria-live="polite"></div>
  <button type="button" class="secondary" data-more hidden>הצג עוד</button>
  <details data-audit><summary>מדדי DNA ומקורות שנבדקו</summary><div data-feature-audit></div></details>
 </div>
 </div>`;
main.append(section);
const $=selector=>section.querySelector(selector);
const n=(value,digits=1)=>Number.isFinite(value)?value.toFixed(digits):'—';
const sign=(value,digits=1)=>Number.isFinite(value)?(value>0?'+':'')+n(value,digits):'—';
const pct=value=>Number.isFinite(value)?n(100*value)+'%':'—';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const teamName=code=>window.PersonalForecast?.team(code)||code;
const date=value=>new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date(value));
const names={
 minutes:'דקות',twoAttempts:'זריקות לשתיים',twoAccuracy:'דיוק לשתיים',threeAttempts:'זריקות לשלוש',threeAccuracy:'דיוק לשלוש',
 freeAttempts:'זריקות עונשין',freeAccuracy:'דיוק בעונשין',offRebounds:'ריבאונד התקפה',defRebounds:'ריבאונד הגנה',
 assists:'אסיסטים',steals:'חטיפות',blocks:'חסימות',turnovers:'איבודים',fouls:'עבירות שביצע',drawn:'עבירות שסחט',blocked:'זריקות שנחסמו'
};
const adjustment=(key,value)=>key.endsWith('Accuracy')?sign(100*value)+' נק׳ אחוז':sign(value);
const valueFor=(key,value)=>key.endsWith('Accuracy')?pct(value):n(value);
const roster=()=>typeof players!=='undefined'?players.filter(p=>['G','F','C'].includes(p.pos)):[];
let view='forecast',live=null,performance=null,limit=20;
const load=async kind=>{
 const r=await fetch('./data/component-forecast/'+kind+'.json.gz',{cache:'no-cache'});
 if(!r.ok)throw Error('Missing forecast '+kind);
 const bytes=new Uint8Array(await r.arrayBuffer());
 const blob=new Blob([bytes]);
 const d=bytes[0]===31&&bytes[1]===139
  ?await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).json()
  :JSON.parse(await blob.text());
 if(d.season!=='E2026')throw Error('Unexpected forecast season');
 return d;
};
function options(select,entries){
 const prev=select.value;
 select.replaceChildren(...entries.map(([key,label])=>new Option(label,key)));
 if(entries.some(([key])=>String(key)===prev))select.value=prev;
}
function playerOptions(){
 const all=roster().filter(p=>p.fantasy_id!=null),clubs=[...new Set(all.map(p=>teamName(p.team)))].sort();
 options($('[data-team]'),[['','כל הקבוצות'],...clubs.map(team=>[team,team])]);
 const team=$('[data-team]').value;
 const rows=all.filter(p=>!team||teamName(p.team)===team).sort((a,b)=>b.price-a.price||a.name.localeCompare(b.name));
 options($('[data-player]'),rows.map(p=>[p.fantasy_id,p.name+' · '+n(p.price)+' CR']));
}
function effectDetails(factors){
 return factors.map(f=>`<details class="cf-factor"><summary><span>${esc(f.label)}</span><strong class="${f.impact>0?'cf-positive':'cf-negative'}" dir="ltr">${sign(f.impact,2)} PIR</strong></summary>
  <p>${esc(f.source)} · ${n(f.value,2)} ${esc(f.unit)}${f.games?' · '+f.games+' משחקים':''}</p>
  <ul>${f.components.map(([key,value])=>`<li>${names[key]} <bdi>${adjustment(key,value)}</bdi></li>`).join('')}</ul>
 </details>`).join('');
}
function riskDetails(risk){
 return risk?.length?`<details><summary>סיכון ופוטנציאל</summary><ul>${risk.map(note=>`<li>${esc(note.label)} <bdi>${n(note.value)} ${esc(note.unit)}</bdi></li>`).join('')}</ul></details>`:'';
}
function drawForecast(){
 const box=$('[data-forecast]');
 const p=roster().find(p=>String(p.fantasy_id)===$('[data-player]').value);
 if(!p||!live){box.replaceChildren();return;}
 const team=teamName(p.team),opponent=teamName(p.opponent);
 const match=live.predictions.find(r=>String(r.fantasyId)===String(p.fantasy_id)&&r.team===team&&r.opponent===opponent);
 const line=match&&Date.parse(match.kickoff)>Date.now()?match:null;
 const baseline=window.__weightedForecastReady&&typeof model==='function'?model(p).expected:null;
 const minutes=line?.components?.minutes;
 box.innerHTML=`<article class="pa-report">${window.PlayerAnalysis.profile(p,{
  stat:`<bdi class="pa-credit">${n(p.price)} CR</bdi>`,meta:`מול <bdi>${esc(opponent||'טרם נקבעה יריבה')}</bdi>`
 })}${window.PlayerAnalysis.metrics([['PIR · אלגוריתם קיים',n(baseline)],['PIR · מודל חדש',n(line?.D)]])}</article>
 ${line?.components?`<p class="cf-delta">הפרש <bdi>${sign(Number.isFinite(baseline)?line.D-baseline:null)} PIR</bdi>${line.interval?` · טווח היסטורי <bdi>${n(line.interval.low)}–${n(line.interval.high)}</bdi>`:''}</p>
 <p class="cf-muted">${line.samples} הופעות קודמות בקבוצה · עודכן ${date(live.generatedAt)}</p>
 <div class="cf-components">
  ${card('דקות',minutes)}${card('נקודות',line.points)}${card('ריבאונדים',line.rebounds)}${card('אסיסטים',line.components.assists)}
  ${card('חטיפות וחסימות',line.defense)}${card('הפחתות ל־PIR',-line.negatives)}
 </div>
 <details><summary>כל רכיבי התחזית</summary><dl class="cf-ledger">${Object.entries(names).map(([key,label])=>`<div><dt>${label}</dt><dd dir="ltr">${valueFor(key,line.components[key])}</dd></div>`).join('')}</dl></details>
 <h3>מה משפיע על התחזית?</h3>
 ${effectDetails(line.factors)||'<p>לא נמצאו התאמות משמעותיות לבסיס האישי.</p>'}
 ${riskDetails(line.risk)}`:`<p role="status">${line?.status==='out'?'השחקן מסומן בחוץ.':line?'אין כיסוי נתונים מספיק לתחזית הניסוי.':'תחזית הניסוי למשחק הבא עדיין אינה זמינה.'}</p>`}`;
}
const variants={A:'A · אלגוריתם קיים',B:'B · רכיבי PIR',C:'C · רכיבים ו־DNA שחקן',D:'D · מודל מלא'};
const headings=['מודל','MAE','RMSE','±3','±5','10+','הטיה','תחזיות','משחקים','שחקנים'];
const cell=(value,label)=>`<td data-label="${esc(label)}"><bdi>${value}</bdi></td>`;
function scoreTable(scores){
 return `<table class="cf-table cf-scores"><thead><tr>${headings.map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead>
 <tbody>${Object.entries(scores).map(([key,m])=>`<tr><th scope="row">${variants[key]}</th>${[n(m.mae,2),n(m.rmse,2),pct(m.within3),pct(m.within5),m.misses10,
  sign(m.bias,2),m.n,m.games,m.players].map((value,i)=>cell(value,headings[i+1])).join('')}</tr>`).join('')}</tbody></table>`;
}
function drawMetrics(){
 const {paired,coverage,currentAlgorithm,intervals}=performance;
 $('[data-metrics]').innerHTML=`<h3>מדגם מבחן · מחזורים ${performance.firstTest}–${performance.lastBenchmark}</h3>
 <p>${paired.D.mae>paired.A.mae?'במדגם המשותף האלגוריתם הקיים מדויק יותר לפי MAE.':'תוצאות מדגם המבחן המשותף.'}
 ${paired.D.n} תחזיות משותפות מתוך ${coverage.modelRecords} תחזיות D שנבדקו במדגם.</p>
 ${scoreTable(paired)}
 <p class="cf-muted">הטיה חיובית מציינת תחזית גבוהה מהתוצאה. הטווח ההיסטורי הכיל ${pct(intervals.coverage)} מ־${intervals.n} התוצאות.</p>
 <details><summary>השוואה לגרסה המשוקללת בלבד</summary>${scoreTable(currentAlgorithm)}</details>
 <details><summary>כיסוי ובדיקת תחזיות שנשמרו מראש</summary><p>${coverage.boxFixtures} משחקים עם בוקס־סקור מתוך ${coverage.fixtures}. מחזורים 1–8 שימשו לפיתוח ולהרצות כרונולוגיות.</p>
 ${performance.prospective.D.n?scoreTable(performance.prospective):'<p>ניקוד יופיע אחרי קליטת תוצאות למשחקים עם תחזית שמורה.</p>'}</details>`;
}
function historyOptions(){
 const rows=performance.rows,clubs=[...new Set(rows.map(r=>r.team))].sort();
 options($('[data-round]'),[['','כל המחזורים'],...[...new Set(rows.map(r=>r.round))].sort((a,b)=>a-b).map(round=>[round,round])]);
 options($('[data-history-team]'),[['','כל הקבוצות'],...clubs.map(team=>[team,team])]);
 const team=$('[data-history-team]').value;
 const people=[...new Map(rows.filter(r=>!team||r.team===team).map(r=>[r.id,r.name])).entries()].sort(([,a],[,b])=>a.localeCompare(b));
 options($('[data-history-player]'),[['','כל השחקנים'],...people]);
}
function drawHistory(){
 const phase=$('[data-phase]').value,round=$('[data-round]').value,team=$('[data-history-team]').value,player=$('[data-history-player]').value;
 const order=$('[data-order]').value,err=r=>Number.isFinite(r.D)?Math.abs(r.D-r.actual):null;
 const missing=(a,b)=>Number(err(a)===null)-Number(err(b)===null);
 const rows=performance.rows.filter(r=>Number.isFinite(r.actual)&&(phase==='all'||r.phase===phase)&&(!round||String(r.round)===round)&&(!team||r.team===team)&&(!player||r.id===player));
 rows.sort((a,b)=>order==='team'?a.team.localeCompare(b.team)||a.round-b.round:order==='player'?a.name.localeCompare(b.name)||a.round-b.round:
  order==='round'?a.round-b.round||a.gameCode-b.gameCode||a.name.localeCompare(b.name):missing(a,b)||(order==='hit'?1:-1)*(err(a)-err(b)));
 $('[data-more]').hidden=rows.length<=limit;
 const labels=['שחקן','מחזור','יריבה','PIR בפועל','קיים','חדש','טעות'];
 $('[data-history]').innerHTML=rows.length?`<table class="cf-table cf-history pa-scored-table"><thead><tr>${labels.map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>
  ${rows.slice(0,limit).map(r=>`<tr><th scope="row">${window.PlayerAnalysis.identity(r)}</th>
   ${[r.round,esc(r.opponent),n(r.actual),n(r.A),n(r.D),Number.isFinite(r.D)?sign(r.D-r.actual):'—'].map((v,i)=>cell(v,labels[i+1])).join('')}</tr>`).join('')}
 </tbody></table>${player?rows.filter(r=>r.line&&r.actualLine).slice(0,limit).map(r=>`<details><summary>מחזור ${r.round} · ${esc(r.opponent)} · רכיבי התחזית</summary>
 <table class="cf-table"><thead><tr><th>רכיב</th><th>בסיס אישי</th><th>מודל חדש</th><th>בפועל</th></tr></thead><tbody>${Object.entries(names).map(([key,label])=>`<tr><th scope="row">${label}</th>${cell(valueFor(key,r.baseLine?.[key]),'בסיס אישי')}${cell(valueFor(key,r.line[key]),'מודל חדש')}${cell(valueFor(key,r.actualLine[key]),'בפועל')}</tr>`).join('')}</tbody></table>
 ${effectDetails(r.factors||[])}${riskDetails(r.risk)}</details>`).join(''):''}`:'<p>אין משחקים בחיתוך הזה.</p>';
}
async function activate(){
 const status=$('[data-state]');
 if(!(view==='forecast'?live:performance))status.textContent='טוען נתוני מודל…';
 try{
  if(view==='forecast'){
   live??=await load('live');
   if(view==='forecast'){playerOptions();drawForecast();}
  }else{
   performance??=await load('performance');
   if(view==='performance'){drawMetrics();historyOptions();drawHistory();}
  }
  status.textContent='';
 }catch{status.textContent='נתוני המודל אינם זמינים כרגע. לחיצה על הלשונית תנסה לטעון שוב.';}
}
section.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{
 view=button.dataset.view;
 section.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 section.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==view);
 void activate();
});
for(const key of ['phase','round','history-team','history-player','order']){
 $('[data-'+key+']').onchange=()=>{if(!performance)return;limit=20;historyOptions();drawHistory();};
}
$('[data-more]').onclick=()=>{limit+=20;drawHistory();};
$('[data-team]').onchange=()=>{playerOptions();drawForecast();};
$('[data-player]').onchange=drawForecast;
$('[data-shorts]').onclick=()=>{
 if(!performance)return;
 const shorts=performance.rows.find(r=>r.id==='012608');
 if(!shorts)return;
 $('[data-phase]').value='all';$('[data-round]').value='';$('[data-history-team]').value='';
 historyOptions();$('[data-history-player]').value=shorts.id;$('[data-order]').value='round';limit=20;drawHistory();
};
$('[data-audit]').ontoggle=()=>{
 const target=$('[data-feature-audit]');
 if(!$('[data-audit]').open||!performance||target.children.length)return;
 target.innerHTML=`<p>${performance.metricsAudited} מדדי DNA. הכיסוי מציג שורות עם ערך זמין במדגם, לכל מדד בנפרד.</p><ul>${performance.features.map(f=>`<li><b>${esc(f.label)}</b> · ${esc(f.source)} · ${f.holdoutCoverage} שורות · ${esc(f.excluded||(f.selected.length?'נבחר: '+f.selected.map(x=>names[x.target]).join(', '):f.eligible.length?'נבדק וסונן':'כיסוי אימות נמוך'))}</li>`).join('')}</ul>`;
};
tab.onclick=()=>{
 document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));
 tab.classList.add('active');section.classList.add('active');void activate();
};
const refreshed=()=>{if(tab.classList.contains('active')&&view==='forecast'&&live){playerOptions();drawForecast();}};
window.addEventListener('player-dna-forecast-ready',refreshed);
document.addEventListener('fantasy-live-updated',refreshed);
})();
