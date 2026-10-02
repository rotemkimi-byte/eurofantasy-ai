(async()=>{
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>n==null||!Number.isFinite(Number(n))?'—':Number(n).toFixed(1);
  const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ');
  const labels={minutes:'פער בדקות המשחק',efficiency:'פער בביצועים לדקה',availability:'שיחק למרות תחזית לאפס דקות','did-not-play':'לא שיחק למרות דקות צפויות'};
  let data=null;
  try{const r=await fetch('./data/learning/latest.json?t='+Date.now(),{cache:'no-store'});if(r.ok)data=await r.json();}catch(e){console.warn('Learning report unavailable',e);}
  if(data?.season!=='E2026'||data?.schema!=='learning-v1')data=null;
  window.__learningReport=data;
  for(let i=0;i<450&&!window.__stabilityModelPatched;i++)await new Promise(r=>setTimeout(r,100));
  if(!window.__stabilityModelPatched||typeof model!=='function'){window.__learningReady=false;return;}
  const baseModel=model;
  const active=!!(data?.active&&data.modelId===window.__learningModelId&&data.validation?.active&&data.validation.n>=60&&data.validation.games>=6);
  const clip=(n,a,b)=>Math.max(a,Math.min(b,n));
  model=function(p){
    const x=baseModel(p);const pir=Number(x.expected),minutes=Number(x.minutes);
    x.learning={basePir:pir,baseMinutes:minutes,applied:false};
    if(!active||p.status!=='active'||!['G','F','C'].includes(p.pos)||minutes<5||!Number.isFinite(pir)||!Number.isFinite(minutes))return x;
    const c=data.coefficients?.[p.pos];if(!c||!Number.isFinite(c.minutes)||!Number.isFinite(c.efficiencyPir))return x;
    const newMinutes=clip(minutes+clip(c.minutes,-2,2),5,36);
    const expected=clip(pir/minutes*newMinutes+clip(c.efficiencyPir,-2,2),Math.max(0,pir-Math.max(1,pir*.25)),pir+Math.max(1,pir*.25));
    const delta=expected-pir;
    x.expected=expected;x.minutes=newMinutes;
    x.floor=Math.min(expected,Math.max(0,Number(x.floor)+delta));x.ceiling=Math.max(expected,Number(x.ceiling)+delta);
    x.value=expected/Math.max(.1,Number(p.price));
    x.learning={basePir:pir,baseMinutes:minutes,applied:true,pirChange:delta,minutesChange:newMinutes-minutes,sample:c.n};
    x.source+=' + validated calibration';return x;
  };
  function gameRows(rows){return rows.map(r=>`<tr><td>${escape(r.name)}<small>${escape(r.opponent)} · מחזור ${escape(r.round)}</small></td><td>${num(r.basePir)}</td><td>${num(r.actualPir)}</td><td dir="ltr">${num(r.baseMinutes)} / ${num(r.actualMinutes)}</td><td>${escape(labels[r.reason]||'—')}<small>${r.eligible?'תחזית האתר':'מודל בדיקה ישן'}</small></td></tr>`).join('');}
  function renderReport(){
    const el=document.getElementById('learningReport');if(!el)return;
    if(!data){el.innerHTML='<p class="muted">ממתין להרצה הראשונה. תחזיות יישמרו לפני המשחקים הבאים.</p>';return;}
    const v=data.validation||{},m=data.metrics||{},a=data.eligibleMetrics||{};
    el.innerHTML=`<p class="notice">${active?'תיקון אוטומטי פעיל: עבר בדיקה על משחקים מאוחרים יותר.':'איסוף ובדיקה: תיקון אוטומטי עדיין לא הופעל.'}</p>
      <div class="grid3"><div class="stat"><b>${a.n||0}</b><span>בדיקות מהמודל הנוכחי של האתר</span></div><div class="stat"><b>${num(m.mae)}</b><span>טעות PIR ממוצעת · כל התחזיות שנבדקו</span></div><div class="stat"><b>${num(m.minutesMae)}</b><span>טעות דקות ממוצעת · כל התחזיות שנבדקו</span></div></div>
      <p class="muted" style="margin-top:12px">${data.legacyCount||0} רשומות ממודלי עבר או גרסאות אחרות מוצגות לניתוח. רק תחזיות מוקדמות מהגרסה הנוכחית משמשות ללמידה. הנתונים עודכנו: ${escape(data.updated_at?.slice(0,16).replace('T',' '))} UTC.</p>
      <p class="muted">בדיקה על משחקים מאוחרים: ${v.games||0} משחקים, ${v.n||0} תחזיות. טעות לפני תיקון: ${num(v.baselineMae)}; לאחר תיקון: ${num(v.candidateMae)}. ${v.improvementPct==null?'':`שינוי בדיוק: ${num(v.improvementPct)}%.`}</p>
      <h3>הפספוסים הגדולים</h3><div class="learningTableWrap"><table class="learningTable"><thead><tr><th>שחקן / יריבה</th><th>PIR צפוי</th><th>PIR בפועל</th><th>דקות צפוי / בפועל</th><th>מקור הפער</th></tr></thead><tbody>${gameRows(data.largestMisses||[])}</tbody></table></div>
      <p class="muted" style="margin-top:12px">פירוק הפער הוא חשבוני. הוא אינו מוכיח שפציעה, עבירות או החלטת מאמן גרמו לשינוי. אי־הופעה נכללת במדידת השגיאה ומוצגת בנפרד; היא אינה משמשת לתיקון ביצועים לדקה.</p>`;
  }
  const originalShow=window.showPlayer;
  window.showPlayer=function(name){
    originalShow(name);const body=document.getElementById('modalBody');if(!body)return;
    const p=players.find(p=>p.name===name);if(!p)return;
    const x=model(p),audit=data?.players?.[key(name)];
    const section=document.createElement('section');section.className='playerSection learning-player';
    let content='<h3 class="sectionTitle">בדיקת תחזיות קודמות</h3>';
    if(audit?.games?.length){content+=`<p class="muted">${audit.n} בדיקות · טעות PIR ממוצעת ${num(audit.metrics?.mae)}</p>`;
      content+=audit.games.slice(0,3).map(r=>`<div class="notice" style="margin-top:8px"><b>${escape(r.opponent)} · מחזור ${r.round}</b><br>PIR צפוי ${num(r.basePir)} → בפועל ${num(r.actualPir)}<br>דקות צפויות ${num(r.baseMinutes)} → בפועל ${num(r.actualMinutes)}<br>${escape(labels[r.reason])}${r.minutesContribution==null?'':` · תרומת הדקות לפער: ${num(r.minutesContribution)} PIR; תרומת הביצועים: ${num(r.efficiencyContribution)} PIR`}<br><small>${r.eligible?'תחזית האתר שנשמרה לפני המשחק':'תחזית מודל הבדיקה הישן; אינה משמשת לתיקון המודל הנוכחי'}</small></div>`).join('');
    }else content+='<p class="muted">עדיין אין תחזית מוקדמת שניתן להשוות לתוצאה.</p>';
    if(x.learning?.applied)content+=`<p class="notice" style="margin-top:8px">תיקון שנבדק: ${num(x.learning.pirChange)} PIR, ${num(x.learning.minutesChange)} דקות. ${x.learning.sample} דוגמאות בעמדה.</p>`;
    section.innerHTML=content;body.appendChild(section);
  };
  renderReport();window.__learningReady=true;
  if(typeof renderAll==='function')renderAll();
})();
