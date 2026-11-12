/* Player forecasts across the app use the saved weights on this device. */
(async()=>{
'use strict';
const C=window.WeightedForecast, P=window.PersonalForecast;
const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');
if(!C||!P||!nav||!main)return;
const key='efa2_weighted_forecast_v1';
const money=new Intl.NumberFormat('he-IL',{maximumFractionDigits:1});
const effect=new Intl.NumberFormat('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const fmt=n=>Number.isFinite(n)?money.format(n):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let versions=[];
try{
 const saved=JSON.parse(localStorage.getItem(key)||'[]');
 if(Array.isArray(saved))versions=saved.filter(v=>C.valid(v?.weights)&&Number.isFinite(Date.parse(v.savedAt)))
  .sort((a,b)=>Date.parse(a.savedAt)-Date.parse(b.savedAt));
}catch{}
let weights=versions.at(-1)?.weights||C.defaults,draft={...weights};
let evidence=null,report=null,modelReady=false,loading=null,lastLoaded=0,lastError=false;
let reportLoading=null,reportError=false,auditLimit=5;
let signalCache=new WeakMap(),currentRoster=null;
const tab=document.createElement('button');
tab.type='button';tab.dataset.tab='algorithm';tab.textContent='משקלי האלגוריתם';
nav.append(tab);
const section=document.createElement('section');
section.id='algorithm';section.className='tab';
section.innerHTML=`<div class="card wf-shell">
 <header><span class="wf-kicker">EUROLEAGUE · 2026/27</span><h2>משקלי האלגוריתם</h2>
 <p>תחזית המשחק הבא משלבת בסיס אישי של תפוקה ודקות עם תרומות לפי המשקלים שבחרת.</p></header>
 <div class="wf-switch" role="group" aria-label="תצוגת האלגוריתם">
  <button type="button" data-mode="weights" aria-pressed="true">משקלים</button>
  <button type="button" data-mode="report" aria-pressed="false">דוח מחזור</button>
  <button type="button" data-mode="edit" aria-pressed="false">שיפור ידני</button>
 </div>
 <div class="wf-venue"><b>בית / חוץ</b><span>השפעה קבועה של מיקום המשחק</span></div>
 <p class="wf-muted" data-source role="status">טוען נתוני תחזית…</p>
 <div data-panel="weights">
  <div class="wf-controls"><label>קבוצה<select data-team></select></label><label>שחקן · לפי מחיר<select data-player></select></label></div>
  <div data-preview></div>
  <div class="wf-list" data-list></div>
 </div>
 <div data-panel="report" hidden>
  <div class="wf-controls"><label>מחזור<select data-round></select></label><label>שחקן<select data-report-player><option value="">כל השחקנים</option></select></label></div>
  <div class="wf-audit audit-compact">
   <h3>דיוק התחזיות</h3>
   <div data-audit-summary aria-live="polite"></div>
   <details data-audit-details hidden><summary>פגיעות ופספוסים לפי שחקן</summary>
    <div class="wf-controls"><label>תוצאה<select data-audit-filter><option value="all">כל התוצאות</option><option value="hit">פגיעות</option><option value="miss">פספוסים</option></select></label></div>
    <div data-audit-rows></div><button type="button" class="secondary" data-audit-more>הצג עוד</button>
   </details>
  </div>
  <h3>השפעת הכלים על הדיוק</h3>
  <div class="wf-controls"><label>משקלים לבדיקת ההשפעה<select data-report-mode><option value="site">ברירת המחדל של האתר</option><option value="device">המשקלים שנשמרו במכשיר לפני התחזית</option></select></label></div>
  <div data-report></div>
 </div>
 <div data-panel="edit" hidden>
  <p>המשקלים קובעים את חלקו של כל כלי בהתאמת התחזית. אם חסר נתון, החלק שלו נשאר ללא השפעה. יחד הכלים יכולים לשנות את הבסיס עד 30%, ועד 5 PIR.</p>
  <div class="wf-actions">
   <button type="button" data-save>שמור והחל</button><button type="button" class="secondary" data-balance>איזון ל־100%</button>
   <button type="button" class="secondary" data-reset>ברירת מחדל</button><strong data-total></strong>
  </div>
  <p class="wf-muted" role="status" data-feedback></p>
  <div class="wf-actions"><button type="button" class="secondary" data-export>ייצוא משקלים</button>
   <label>ייבוא משקלים <input type="file" accept=".json,application/json" data-import></label></div>
  <div class="wf-list">${C.definitions.map(d=>`<label class="wf-row"><span><b>${d.label}</b><small>${d.description}</small></span><span class="wf-input"><input type="number" min="0" max="100" step="1" inputmode="numeric" data-weight="${d.id}" value="${weights[d.id]}"><span>%</span></span></label>`).join('')}</div>
 </div>
 </div>`;
main.append(section);
const $=selector=>section.querySelector(selector),modeButtons=[...section.querySelectorAll('[data-mode]')];
const playerList=()=>typeof players!=='undefined'?players.filter(p=>['G','F','C'].includes(p.pos)):[];
function options(select,entries){
 const before=select.value;
 select.replaceChildren(...entries.map(([value,label])=>new Option(label,value)));
 if(entries.some(([value])=>value===before))select.value=before;
}
function rosterOptions(){
 const roster=playerList();
 const teams=[...new Set(roster.map(p=>P.team(p.team)))].filter(Boolean).sort();
 options($('[data-team]'),[['','כל הקבוצות'],...teams.map(t=>[t,t])]);
 const team=$('[data-team]').value;
 const rows=roster.filter(p=>!team||P.team(p.team)===team).sort((a,b)=>Number(b.price)-Number(a.price)||a.name.localeCompare(b.name));
 options($('[data-player]'),[['','בחר שחקן'],...rows.map(p=>[p.name,p.name+' · '+fmt(p.price)+' CR'])]);
}
const coverage=f=>C.definitions.reduce((sum,d,i)=>sum+(Number.isFinite(f.signals[i])?weights[d.id]:0),0);
function drawWeights(){
 const p=playerList().find(p=>p.name===$('[data-player]').value);
 const x=p&&modelReady?model(p):null,f=x?.weightedForecast;
 $('[data-preview]').innerHTML=p&&x?`<article class="wf-preview"><div><b><bdi>${esc(p.name)}</bdi></b><small><bdi>${esc(P.team(x.match?.opponent||p.opponent))}</bdi> · ${x.match?.home===true?'בית':x.match?.home===false?'חוץ':'מיקום לא זמין'}</small></div><div><b dir="ltr">${fmt(x.expected)} PIR</b><small>${f?'בסיס '+fmt(f.base)+' PIR · כלים '+effect.format(x.expected-f.base)+' · כיסוי '+coverage(f)+'%':'צפי קודם עד לטעינת הנתונים'}</small></div></article>`:'';
 $('[data-list]').innerHTML=C.definitions.map((d,i)=>{
  const active=f&&Number.isFinite(f.signals[i]),delta=active?f.scale*f.signals[i]*weights[d.id]/100:null;
  return `<article class="wf-row"><span><b>${d.label}</b><small>${d.description}</small></span><span class="wf-number"><b dir="ltr">${weights[d.id]}%</b>${f?`<small ${active?'dir="ltr"':''}>${active?effect.format(delta)+' PIR':'אין מדגם'}</small>`:''}</span></article>`;
 }).join('');
}
function drawAudit(round,rows){
 const host=$('[data-audit-summary]'),details=$('[data-audit-details]'),audit=window.AuditCompact;
 const sample=rows.filter(r=>Number(r.round)===round?.round&&(!$('[data-report-player]').value||r.name===$('[data-report-player]').value));
 details.hidden=!sample.length||!audit;
 if(details.hidden){
  host.textContent=window.__learningReport===undefined?'טוען את בדיקת התחזיות…':
   window.__learningReport===null?'בדיקת התחזיות לא זמינה כרגע.':'אין תחזיות שנבדקו במחזור הזה.';
  return;
 }
 const scope={round:String(round.round),source:'all',team:'',sort:'error'};
 const id=window.__learningModelId||window.__learningReport.modelId;
 const hits=audit.select(sample,{...scope,result:'hit'},id).length;
 const selected=audit.select(sample,{...scope,result:$('[data-audit-filter]').value},id);
 const games=new Set(sample.map(r=>r.gameCode)).size;
 host.innerHTML=`<p class="wf-muted">${round.complete===false?'מחזור פתוח · ':''}${games}${round.scheduled?' מתוך '+round.scheduled:''} משחקים נבדקו · פגיעה עד ±${audit.tolerance({round:round.round})} PIR${sample.some(r=>!audit.current(r,id))?' · כולל תחזיות מגרסאות קודמות':''}</p>
 <div class="ac-metrics"><div><b>${sample.length}</b><span>תחזיות שנבדקו</span></div><div data-result="better"><b>${hits}</b><span>פגיעות</span></div><div data-result="worse"><b>${sample.length-hits}</b><span>פספוסים</span></div></div>`;
 $('[data-audit-rows]').innerHTML=selected.slice(0,auditLimit).map(r=>audit.card(r,id)).join('')||'<p>אין תוצאות במסנן הזה.</p>';
 $('[data-audit-more]').hidden=selected.length<=auditLimit;
}
function drawReport(){
 const host=$('[data-report]'),select=$('[data-round]');
 const rows=window.__learningReport?.rows||[];
 const byRound=new Map((report?.rounds||[]).map(r=>[r.round,r]));
 for(const r of rows)if(!byRound.has(r.round))byRound.set(r.round,{round:r.round,games:[]});
 const rounds=[...byRound.values()].sort((a,b)=>b.round-a.round);
 const latest=rounds.find(r=>r.games.length||rows.some(row=>row.round===r.round));
 options(select,rounds.map(r=>[String(r.round),'מחזור '+r.round+(r.complete===false?' · פתוח':'')]));
 if(!$('[data-round]').dataset.chosen&&latest)select.value=String(latest.round);
 select.disabled=!rounds.length;
 const round=rounds.find(r=>String(r.round)===select.value);
 const names=[...new Set(rows.filter(r=>r.round===round?.round).map(r=>r.name))].sort();
 options($('[data-report-player]'),[['','כל השחקנים'],...names.map(name=>[name,name])]);
 drawAudit(round,rows);
 if(!report){host.textContent=reportError?'דוח ההשפעה לא זמין כרגע.':'טוען את דוח ההשפעה…';return;}
 if(!round?.games.length){host.textContent='אין עדיין משחקים במחזור הזה עם תוצאה וקלט שמור לבדיקת השפעת הכלים.';return;}
 const personal=$('[data-report-mode]').value==='device';
 const selectedName=$('[data-report-player]').value;
 const games=round.games.map(game=>({...game,players:game.players.filter(row=>!selectedName||row[4]?.name===selectedName)})).filter(game=>game.players.length);
 const result=C.assess(games,game=>personal?
  versions.findLast(v=>Date.parse(v.savedAt)<=Date.parse(game.savedAt))?.weights:(game.weights||C.defaults));
 if(!result.n){
  host.textContent=personal?'אין למחזור הזה משקלים ששמרת במכשיר לפני מועד צילום התחזית.':'אין עדיין תחזיות מוקדמות עם נתוני אמת למחזור הזה.';
  return;
 }
 if(selectedName){
  const game=games[0],row=game?.players[0],chosen=personal?versions.findLast(v=>Date.parse(v.savedAt)<=Date.parse(game.savedAt))?.weights:(game?.weights||C.defaults);
  if(!row||!chosen){host.textContent='אין פירוק שמור לשחקן ולמשקלים שנבחרו.';return;}
  const [actual,base,scale,signals,info]=row,frozen={base,scale,signals},full=C.project(frozen,chosen);
  host.innerHTML=`<p><b>${esc(selectedName)}</b> · PIR בפועל ${fmt(actual)} · תחזית משוקללת ${fmt(full)}</p>
  <p class="wf-muted">בכל שורה מוצגת התחזית כשהכלי פעיל ובהסרת תרומתו. הצבע מתאר את השינוי בטעות במשחק הזה. ${personal?'זהו שחזור לפי המשקלים האישיים.':''}</p>
  ${info?.freeThrowsAttempted!=null?`<p>עונשין בפועל · ${info.freeThrowsMade} מתוך ${info.freeThrowsAttempted} · עבירות שסחט ${info.foulsReceived??'—'}</p>`:''}
  <div class="wf-list">${C.definitions.map((d,i)=>{
   const without=C.project(frozen,chosen,i),delta=Math.abs(actual-without)-Math.abs(actual-full),shift=full-without;
   const missing=signals[i]==null,off=!chosen[d.id],direction=missing||off?'sample':delta>1e-9?'better':delta< -1e-9?'worse':'neutral';
   const label=off?'משקל אפס':missing?'חסר נתון שמור':direction==='better'?'עזר במשחק הזה':direction==='worse'?'הגדיל טעות':'ללא השפעה במשחק';
   const precise=n=>Number(n).toFixed(4);
   return `<article class="wf-row"><span><b>${d.label}</b><small>משקל ${chosen[d.id]}% · ${missing?'אין קלט להערכת התרומה':`תרומה לתחזית ${precise(shift)} PIR<br>עם הכלי ${precise(full)} · בלי הכלי ${precise(without)}`}</small></span><span class="wf-number"><b class="wf-badge" data-result="${direction}">${label}</b>${!missing&&!off?`<small>שינוי בדיוק ${precise(delta)} PIR</small>`:''}</span></article>`;
  }).join('')}</div>`;
  return;
 }
 host.innerHTML=`<p class="wf-report-summary"><b>${result.games} מתוך ${round.scheduled} משחקים · ${result.n} תחזיות שחקן</b>
 <span>טעות ממוצעת עם הכלים <b>${fmt(result.fullMae)} PIR</b> · בסיס ${fmt(result.baseMae)} PIR</span></p>
 <p class="wf-muted">${personal?'חישוב לפי נתוני התחזית שנשמרו לפני המשחק והמשקלים שכבר היו שמורים אז במכשיר. ':'נבדקו רק תחזיות שנשמרו לפני המשחק. '}כל כלי נבדק בנפרד. ירוק פירושו שטעות ה־PIR קטנה כשהכלי פעל. אדום פירושו שהטעות גדלה.</p>
 <div class="wf-list">${result.rows.map(r=>{
  const direction=!r.enabled?'off':r.available<5||r.n>0&&(r.n<5||r.games<2)?'sample':!r.n?'neutral':r.delta>=.005?'better':r.delta<=-.005?'worse':'neutral';
  const label={off:'משקל אפס',sample:'מדגם חסר',better:'שיפר דיוק',worse:'הגדיל טעות',neutral:'שינוי ממוצע קטן מ־0.005 PIR'}[direction];
  return `<article class="wf-row"><span><b>${r.label}</b><small>${r.n} תחזיות שחקן ב־${r.games} משחקים${r.weight===null?'':' · משקל ממוצע '+fmt(r.weight)+'%'}</small></span><span class="wf-number"><b class="wf-badge" data-result="${direction}">${label}</b>${r.n>=5&&r.games>=2?`<small dir="ltr">${effect.format(r.delta)} PIR</small>`:''}</span></article>`;
 }).join('')}</div>`;
}
function total(){
 const amount=Object.values(draft).reduce((s,v)=>s+(v||0),0);
 $('[data-total]').textContent=fmt(amount)+'% / 100%';
 $('[data-total]').dataset.valid=String(C.valid(draft));
 $('[data-save]').disabled=!C.valid(draft);
}
function syncInputs(){
 section.querySelectorAll('[data-weight]').forEach(el=>{el.value=draft[el.dataset.weight];});
 total();
}
function switchMode(mode){
 for(const b of modeButtons)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
 section.querySelectorAll('[data-panel]').forEach(el=>{el.hidden=el.dataset.panel!==mode;});
 if(mode==='weights'){rosterOptions();drawWeights();}
 if(mode==='report'){drawReport();void loadReport();}
 if(mode==='edit')syncInputs();
}
for(const b of modeButtons)b.onclick=()=>switchMode(b.dataset.mode);
section.addEventListener('input',e=>{
 const name=e.target.dataset.weight;if(!name)return;
 draft[name]=e.target.valueAsNumber;
 $('[data-feedback]').textContent='שינויים שטרם נשמרו.';total();
});
$('[data-balance]').onclick=()=>{draft=C.normalize(draft);syncInputs();};
$('[data-reset]').onclick=()=>{draft={...C.defaults};syncInputs();$('[data-feedback]').textContent='לחץ על שמור והחל כדי להפעיל את ברירת המחדל.';};
$('[data-save]').onclick=()=>{
 if(!C.valid(draft))return;
 weights={...draft};
 versions=[...versions,{weights,savedAt:new Date().toISOString()}];
 try{
  localStorage.setItem(key,JSON.stringify(versions));
  $('[data-feedback]').textContent='המשקלים נשמרו במכשיר והוחלו על התחזיות.';
 }catch{$('[data-feedback]').textContent='המשקלים הוחלו בדף הזה. הדפדפן חסם שמירה במכשיר.';}
 if(modelReady&&typeof renderAll==='function')renderAll();
 sourceText();drawWeights();drawReport();
};
$('[data-export]').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(weights)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='eurofantasy-weights.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('[data-import]').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>8192)throw Error('Invalid weights file');
  const imported=JSON.parse(await file.text());if(!C.valid(imported))throw Error('Invalid weights');
  draft=Object.fromEntries(C.definitions.map(d=>[d.id,imported[d.id]]));syncInputs();
  $('[data-feedback]').textContent='המשקלים נטענו. לחץ שמור והחל כדי להפעיל אותם.';
 }catch{$('[data-feedback]').textContent='לא ניתן לייבא את הקובץ. נדרש קובץ משקלים תקין.';}
 event.target.value='';
};
$('[data-team]').onchange=()=>{rosterOptions();drawWeights();};
$('[data-player]').onchange=drawWeights;
$('[data-round]').onchange=event=>{event.target.dataset.chosen='true';auditLimit=5;drawReport();};
$('[data-report-player]').onchange=()=>{auditLimit=5;$('[data-audit-details]').open=true;drawReport();};
$('[data-audit-filter]').onchange=()=>{auditLimit=5;drawReport();};
$('[data-audit-more]').onclick=()=>{auditLimit+=5;drawReport();};
$('[data-report-mode]').onchange=drawReport;
tab.onclick=()=>{
 document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));
 tab.classList.add('active');section.classList.add('active');
 rosterOptions();drawWeights();void refreshEvidence();void loadReport();
};
async function json(path){
 if(window.loadGameData)return window.loadGameData(path);
 const r=await fetch('./data/'+path,{cache:'no-cache',signal:AbortSignal.timeout(16000)});
 if(!r.ok)throw Error('Missing '+path);
 return r.json();
}
async function loadReport(){
 if(reportLoading)return reportLoading;
 reportLoading=(async()=>{
  try{
   const data=await json('learning/tool-impacts.json');
   if(data.schema!=='weighted-rounds-v1'||data.season!=='E2026')throw Error('Invalid round report');
   report=data;reportError=false;
  }catch{reportError=true;}
 })();
 await reportLoading;
 reportLoading=null;
 drawReport();
}
function sourceText(){
 $('[data-source]').textContent=!modelReady?'טוען נתוני תחזית…':evidence?
  (lastError?'תחזית משוקללת · מוצגים נתוני המשחק האחרונים שנטענו.':'המשקלים פעילים בתחזית השחקנים · עונת 2026/27.'):
  'נתוני הכלים עדיין לא זמינים. מוצגת התחזית הקודמת.';
 if(versions.length&&C.definitions.some(d=>weights[d.id]!==d.weight))
  $('[data-source]').textContent+=' · משקלים אישיים פעילים במכשיר זה.';
}
async function refreshEvidence(){
 if(loading)return loading;
 if(Date.now()-lastLoaded<10*60*1000)return;
 loading=(async()=>{
  lastLoaded=Date.now();
  try{
   const [official,advanced]=await Promise.all([json('official-offense.json'),json('advanced-players.json').catch(()=>null)]);
   if(official.season!=='E2026'||official.schema!=='official-offense-v1')throw Error('Wrong season');
   evidence=C.build(official,advanced,P);signalCache=new WeakMap();lastError=!advanced;
   if(modelReady&&typeof renderAll==='function')renderAll();
  }catch{lastError=true;}
  sourceText();if(section.classList.contains('active'))drawWeights();
 })().finally(()=>{loading=null;});
 return loading;
}
total();const initial=refreshEvidence();
for(let i=0;i<700&&!window.__rollingReady;i++)await new Promise(resolve=>setTimeout(resolve,100));
if(!window.__rollingReady||typeof model!=='function'){
 $('[data-source]').textContent='מודל הבסיס עדיין לא זמין. נסה לרענן את האפליקציה.';
 window.__weightedForecastReady=true;return;
}
const previous=model;
model=function(p){
 const x=previous(p);
 if(!evidence||!['G','F','C'].includes(p.pos))return x;
 if(currentRoster!==players){currentRoster=players;signalCache=new WeakMap();}
 const signature=[p.price,p.status,p.team,x.match?.opponent||p.opponent,x.basePir,x.baseMin,x.injuryBoost,
  x.injuryUsagePct,x.positionMatchPct,x.positionMatchup?.sampleGames].join('|');
 let row=signalCache.get(p);
 if(row?.signature!==signature){
  row={signature,signals:C.signals(p,x,evidence,players)};
  signalCache.set(p,row);
 }
 return C.apply(x,p,C.input(p,x,row.signals,evidence),weights);
};
await initial;
modelReady=true;
window.__weightedForecastReady=true;
sourceText();drawWeights();drawReport();
if(typeof renderAll==='function')renderAll();
window.addEventListener('focus',()=>void refreshEvidence());
document.addEventListener('fantasy-live-updated',()=>{
 signalCache=new WeakMap();
 if(section.classList.contains('active')){rosterOptions();drawWeights();}
 void refreshEvidence();
});
})();
