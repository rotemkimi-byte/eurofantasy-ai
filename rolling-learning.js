(async()=>{
'use strict';
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
// Intercept the shared projection inputs rather than reconstruct them from its output.
const project=PersonalForecast.project;
PersonalForecast.project=function(player,recent,history,context,config){
 const x=project(player,recent,history,context,config);
 x.replayInput={player:clone(player),recent:clone(recent),history:clone(history),context:clone(context),config:clone(config),asOf:new Date().toISOString(),complete:false};return x;
};
const extension=MatchupContext.project;
MatchupContext.project=function(x,p,data){
 const y=extension(x,p,data);if(y.replayInput){const a=y.replayInput,opp=x.match?.opponent||p.opponent,k=PersonalForecast.key(p.name);
 a.match=clone(x.match);a.contextData=clone({schema:data?.schema,season:data?.season,updated_at:data?.updated_at,players:{[k]:data?.players?.[k]},defense:{[opp]:data?.defense?.[opp]},league:data?.league,teams:{[opp]:data?.teams?.[opp]}});
 a.complete=!!x.match&&MatchupContext.valid(data);a.asOf=new Date().toISOString();
 }return y;
};
window.__replayCaptureReady=true;
let report=null;try{const r=await fetch('./data/learning/rolling.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok)report=await r.json();}catch(e){console.warn('Rolling report unavailable',e);}
for(let i=0;i<320&&!window.__learningReady;i++)await new Promise(r=>setTimeout(r,150));
const ident=window.__rollingModelId,valid=report?.schema==='rolling-learning-v1'&&report.engineId===ident&&report.season==='E2026'&&Date.now()-Date.parse(report.updated_at)<36*3600000&&Date.parse(report.updated_at)<=Date.now();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(typeof model==='function'){
 const previous=model;
 model=function(p){let x=previous(p);if(!valid||x.learning?.applied)return x;
 const calibration={...report,schema:'learning-v1',modelId:ident,active:report.validation?.active};
 x=PersonalForecast.calibrate(x,p,calibration,ident);
 if(x.learning?.applied)x.source+=' + rolling replay validation';
 const interval=report.interval;
 if(interval?.active&&p.status==='active'&&['G','F','C'].includes(p.pos)&&x.minutes>=5){
  x.floor=x.expected-interval.radius;x.ceiling=x.expected+interval.radius;
  x.rollingInterval={targetCoverage:.8,validationCoverage:interval.coverage,n:interval.n,radius:interval.radius};
 }
 return x;};
}
window.__rollingReady=true;window.__rollingReport=report;
function panel(){
 const host=document.getElementById('learningReport');if(!host)return;
 let el=document.getElementById('rollingSummary');if(!el){el=document.createElement('details');el.id='rollingSummary';el.className='ac-method';host.appendChild(el);}
 const n=v=>v==null?'—':Number(v).toFixed(1);
 el.innerHTML='<summary>למידה מתגלגלת ושחזור משחקי עבר</summary>'+(valid?`<p>${report.diagnostic?.n||0} שחזורים חלקיים מהעבר — לא מפעילים תיקון.<br>${report.exactCount} שחזורים מקלט מלא · ${report.validation?.games||0} משחקי בדיקה.</p><p>טעות לפני ${n(report.validation?.baselineMae)}, אחרי ${n(report.validation?.candidateMae)} PIR. ${report.validation?.active?'תיקון מתגלגל פעיל':'התיקון המתגלגל טרם הוכיח שיפור מספיק'}.</p><p>טווח יעד 80%: ${report.interval?.active?'פעיל':'ממתין למדגם מספיק'} · כיסוי במשחקי בדיקה: ${n((report.interval?.coverage??NaN)*100)}%.</p><p>תיקון נבחן רק על משחקים מאוחרים שלא שימשו להתאמתו. שחזור חלקי אינו בדיקה מלאה של מודל האתר.</p>`:'<p>דוח הלמידה המתגלגלת עדיין אינו זמין לגרסת המודל הנוכחית.</p>');
 if(valid){el.insertAdjacentHTML('beforeend',`<details><summary>איפה הטעויות גדולות בשחזור?</summary>${(report.largestMisses||[]).slice(0,5).map(r=>`<p><b>${escape(r.name)}</b> · מחזור ${escape(r.round)} · ${r.replayKind==='partial-reconstruction'?'שחזור חלקי':'קלט מלא'}<br>צפוי ${n(r.basePir)} / בפועל ${n(r.actualPir)} PIR · ${{minutes:'הפער הגדול יותר בדקות',efficiency:'הפער הגדול יותר בביצועים לדקה',availability:'שיחק למרות תחזית לאפס דקות','did-not-play':'לא שיחק למרות דקות צפויות'}[r.reason]||'אין פירוק זמין'}.</p>`).join('')||'<p>אין עדיין בדיקות.</p>'}</details><details><summary>טעות לפי מחזור</summary>${(report.rounds||[]).map(r=>`<p>מחזור ${r.round} · ${r.kind==='partial-reconstruction'?'חלקי':'קלט מלא'}: ${r.n} בדיקות · טעות ${n(r.mae)} PIR.</p>`).join('')}</details>`);}
}
const host=document.getElementById('learningReport');if(host){const observer=new MutationObserver(()=>{if(!document.getElementById('rollingSummary'))panel();});observer.observe(host,{childList:true});panel();}
if(typeof renderAll==='function')renderAll();
})();
