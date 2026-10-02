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
  function stat(value,label){return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;}
  function auditCard(r){
    const f=r.features||{},s=r.actualStats||{},e=r.error??(r.actualPir-r.basePir),hit=Math.abs(e)<=5;
    const hints=[];
    if(r.reason==='minutes')hints.push('לבדוק את אומדן הדקות: הוא הרכיב הגדול יותר בפער.');
    if(r.reason==='efficiency')hints.push('לבדוק את אומדן ה־PIR לדקה: הוא הרכיב הגדול יותר בפער.');
    if(r.reason==='did-not-play'||r.reason==='availability')hints.push('לבדוק את נתוני הזמינות והסגל שהיו ידועים לפני המשחק.');
    if(s.foulsCommited>=4)hints.push(`נרשמו ${s.foulsCommited} עבירות; זה נתון לבדיקה, ולא הוכחה לסיבת הפער.`);
    return `<article class="auditCard"><div class="sectionHead"><b>${escape(r.name)}</b><span class="tag ${hit?'auditHit':'auditMiss'}">${hit?'פגיעה בטווח ±5':'פספוס'}</span></div><p class="muted">${escape(r.team)} מול ${escape(r.opponent)} · מחזור ${escape(r.round)} · ${r.home?'בית':'חוץ'}</p>
      <div class="grid3">${stat(num(r.basePir),'PIR צפוי')}${stat(num(r.actualPir),'PIR בפועל')}${stat(`${e>0?'+':''}${num(e)}`,'בפועל פחות תחזית')}</div>
      <p>דקות: ${num(r.baseMinutes)} צפויות ← ${num(r.actualMinutes)} בפועל<br>PIR לדקה: ${r.baseMinutes>0?num(r.basePir/r.baseMinutes):'—'} צפוי ← ${r.actualMinutes>0?num(r.actualPir/r.actualMinutes):'—'} בפועל</p>
      <p class="notice"><b>${escape(labels[r.reason]||'מקור פער לא ידוע')}</b><br>תרומת הדקות לפער: ${num(r.minutesContribution)} PIR<br>תרומת הביצועים לדקה: ${num(r.efficiencyContribution)} PIR<br>${hints.join('<br>')}</p>
      <details><summary>נתוני המשחק ורכיבי התחזית</summary><p>נקודות ${num(s.points)} · ריבאונדים ${num(s.totalRebounds)} · אסיסטים ${num(s.assistances)} · איבודים ${num(s.turnovers)} · עבירות ${num(s.foulsCommited)}<br>קליעות מהשדה: ${num(s.fieldGoalsMadeTotal)} מתוך ${num(s.fieldGoalsAttemptedTotal)}</p>
      <p>התאמה מול עמדה: ${num(f.positionMatchPct)}% · התאמה קבוצתית: ${num(f.teamMatchPct)}%<br>תוספת דקות עקב חוסרים: ${num(f.injuryBoost)} · תוספת נפח: ${num(f.injuryUsagePct)}%<br>משקל המשחק האחרון: ${f.lastGameWeight==null?'לא נשמר':num(f.lastGameWeight*100)+'%'}<br>חוסרים שנשמרו: ${Array.isArray(f.missingStars)?escape(f.missingStars.join(', ')||'אין'):'לא נשמרו'}.</p></details>
      <small class="muted">${r.eligible?'תחזית אתר שנשמרה לפני המשחק':'תחזית מגרסת עבר; אינה עדות לביצועי המודל הנוכחי'}. פירוק חשבוני; סיבה כמו פציעה או החלטת מאמן דורשת מקור נוסף.</small></article>`;
  }
  function groupCards(groups){return (groups||[]).map(g=>`<div class="auditCard"><b>${escape(g.label)}</b><p>${g.n} תחזיות · טעות ממוצעת ${num(g.mae)} PIR<br>פגיעות בטווח ±5: ${num(g.hitRate)}%<br>${g.bias>0?'נטייה לתחזית נמוכה מדי':'נטייה לתחזית גבוהה מדי'}: ${num(Math.abs(g.bias))} PIR<br>טעות דקות: ${num(g.minutesMae)}<br>${g.over} תחזיות גבוהות מדי · ${g.under} נמוכות מדי</p></div>`).join('');}
  function renderReport(){
    const el=document.getElementById('learningReport');if(!el)return;
    if(!data){el.innerHTML='<p class="muted">ממתין להרצה הראשונה.</p>';return;}
    const v=data.validation||{},m=data.metrics||{},a=data.eligibleMetrics||{},all=data.rows||data.largestMisses||[],b=data.breakdowns||{};
    el.innerHTML=`<p class="notice">${active?'תיקון אוטומטי פעיל ועבר בדיקה על משחקים מאוחרים יותר.':'איסוף ובדיקה: תיקון אוטומטי עדיין לא הופעל.'}</p>
      <div class="grid3">${stat(m.n||0,'השוואות שחקן־משחק')}${stat(num(m.mae),'טעות PIR ממוצעת')}${stat(num(m.hitRate)+'%','פגיעות בטווח ±5 PIR')}</div>
      <p class="muted">${a.n||0} בדיקות מהגרסה הנוכחית; ${data.legacyCount||0} מגרסאות עבר. יש לנתח אותן בנפרד. עודכן ${escape(data.updated_at?.slice(0,16).replace('T',' '))} UTC.</p>
      <details open><summary>מה האלגוריתם למד ומה השתנה</summary><p>בדיקה על משחקים מאוחרים: ${v.games||0} משחקים, ${v.n||0} תחזיות. טעות לפני תיקון ${num(v.baselineMae)}, אחרי ${num(v.candidateMae)} PIR.</p><p>התיקון הקיים מכייל דקות ו־PIR לדקה לפי עמדה. הוא מופעל רק לאחר 60 תחזיות לפחות בשישה משחקי בדיקה ושיפור של יותר מ־2%. הוא עדיין אינו לומד משקלים נפרדים לפציעות, בית/חוץ או מאצ׳אפ.</p>
      <div class="auditGrid">${Object.entries(data.coefficients||{}).map(([pos,c])=>`<div class="auditCard"><b>${escape(pos)} · ${c.n} דוגמאות</b><p>תיקון דקות מוצע: ${num(c.minutes)}<br>תיקון PIR לדקה במונחי PIR למשחק: ${num(c.efficiencyPir)}<br>${active?'פעיל לאחר אימות':'טרם אומת; אינו משנה תחזיות'}</p></div>`).join('')}</div></details>
      <h3>איפה פגע ואיפה פספס</h3><p class="muted">פגיעה מוגדרת כאן כטעות של עד 5 PIR. זה סף תצוגה, לא הבטחה לדיוק.</p>
      <div class="auditFilters"><input id="auditSearch" placeholder="חיפוש שחקן או קבוצה"><select id="auditRound"><option value="">כל המחזורים</option>${[...new Set(all.map(r=>r.round))].sort((a,b)=>a-b).map(r=>`<option value="${r}">מחזור ${r}</option>`).join('')}</select><select id="auditSource"><option value="">כל הגרסאות</option><option value="live">הגרסה הנוכחית</option><option value="old">גרסאות עבר</option></select><select id="auditResult"><option value="miss">פספוסים — מהגדול לקטן</option><option value="hit">פגיעות — מהמדויק ביותר</option><option value="all">כל ההשוואות</option></select></div><p id="auditCount" class="muted"></p><div id="auditRows" class="auditGrid"></div><button id="auditMore" type="button">הצג עוד השוואות</button>
      <h3>באילו חלקים יש נטייה לטעות</h3><p class="muted">הסיכומים מתארים קשרים בנתונים שנבחרו; מדגם קטן אינו מוכיח מה גרם לטעות. הטיה חיובית פירושה שהתוצאות גבוהות מהתחזיות.</p><div id="auditGroups"></div>
      <h3>תחזיות קבוצות למשחק הקרוב</h3><div id="auditTeams" class="auditGrid">טוען תחזיות קבוצות…</div>
      <h3>בדיקת תחזיות קבוצות מול תוצאות</h3><div id="auditTeamHistory"></div>`;
    let limit=20;
    const filtered=()=>all.filter(r=>{
      const q=document.getElementById('auditSearch').value.toLowerCase(),rnd=document.getElementById('auditRound').value,src=document.getElementById('auditSource').value,result=document.getElementById('auditResult').value;
      return (!q||`${r.name} ${r.team} ${r.opponent}`.toLowerCase().includes(q))&&(!rnd||String(r.round)===rnd)&&(!src||(src==='live'?(r.eligible&&r.modelId===data.modelId):!(r.eligible&&r.modelId===data.modelId)))&&(result==='all'||(result==='hit'?Math.abs(r.error)<=5:Math.abs(r.error)>5));
    });
    function draw(){
      const result=document.getElementById('auditResult').value,rows=filtered().sort((a,b)=>result==='hit'?Math.abs(a.error)-Math.abs(b.error):Math.abs(b.error)-Math.abs(a.error));
      document.getElementById('auditCount').textContent=`${rows.length} השוואות נמצאו; מוצגות ${Math.min(limit,rows.length)}.`;
      document.getElementById('auditRows').innerHTML=rows.slice(0,limit).map(auditCard).join('')||'<p class="muted">אין השוואות במסנן שנבחר.</p>';
      document.getElementById('auditMore').hidden=rows.length<=limit;
      const grouped=(field)=>{const groups={};for(const r of rows)(groups[String(r[field])]??=[]).push(r);return Object.entries(groups).map(([label,g])=>({label:field==='home'?(label==='true'?'בית':'חוץ'):label,n:g.length,mae:g.reduce((s,r)=>s+Math.abs(r.error),0)/g.length,bias:g.reduce((s,r)=>s+r.error,0)/g.length,minutesMae:g.reduce((s,r)=>s+Math.abs(r.actualMinutes-r.baseMinutes),0)/g.length,hitRate:g.filter(r=>Math.abs(r.error)<=5).length/g.length*100,over:g.filter(r=>r.error< -5).length,under:g.filter(r=>r.error>5).length}));};
      document.getElementById('auditGroups').innerHTML=[['pos','לפי עמדה'],['team','לפי קבוצה'],['round','לפי מחזור'],['home','בית וחוץ']].map(([field,label])=>`<details><summary>${label} — לפי המסננים למעלה</summary><div class="auditGrid">${groupCards(grouped(field))}</div></details>`).join('');
    }
    for(const id of ['auditSearch','auditRound','auditSource','auditResult'])document.getElementById(id).addEventListener(id==='auditSearch'?'input':'change',()=>{limit=20;draw();});
    document.getElementById('auditMore').onclick=()=>{limit+=20;draw();};draw();
    const t=data.teamAudit||{};
    document.getElementById('auditTeamHistory').innerHTML=t.n?`<div class="grid3">${stat(num(t.winnerAccuracy)+'%','זיהוי המנצחת')}${stat(num(t.marginMae),'טעות הפרש ממוצעת')}${stat(num(t.totalMae),'טעות טוטאל ממוצעת')}</div><p class="muted">${t.n} משחקים ייחודיים · Brier ${num(t.brier)} (נמוך יותר טוב; מודד את הסתברות הניצחון).</p><div class="auditGrid">${t.games.map(g=>`<div class="auditCard"><b>${escape(g.home)} מול ${escape(g.away)}</b><p>מחזור ${g.round} · ${g.winnerHit?'המנצחת זוהתה':'המנצחת לא זוהתה'}<br>תוצאה: ${g.homeScore}–${g.awayScore}<br>הפרש בית: צפוי ${num(g.forecast.margin)} ← בפועל ${num(g.actualMargin)}<br>טוטאל: צפוי ${num(g.forecast.total)} ← בפועל ${num(g.actualTotal)}<br>סיכוי לניצחון בית: ${num(g.forecast.winProb*100)}%</p></div>`).join('')}</div>`:'<p class="notice">עדיין אין תחזיות קבוצות שנשמרו לפני משחק שהסתיים. העדכון מתחיל לשמור אותן לקראת המשחקים הבאים; תחזית נוכחית אינה מוצגת כאילו ניתנה לפני משחק שכבר הסתיים.</p>';
    fetch('./data/matchups.json?t='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('missing teams');return r.json();}).then(d=>{
      const items=Object.entries(d.matchups||{}).filter(([team,m])=>m.home===true);
      document.getElementById('auditTeams').innerHTML=items.map(([team,m])=>`<article class="auditCard"><b>${escape(team)} מול ${escape(m.opponent)}</b><p>המנצחת הצפויה: ${escape(m.winProb>=.5?team:m.opponent)}<br>סיכוי בית לניצחון: ${num(m.winProb*100)}% · חוץ: ${num((1-m.winProb)*100)}%<br>הפרש צפוי לטובת הבית: ${num(m.margin)}<br>נקודות בית: ${num(m.teamPoints)} · חוץ: ${num(m.total-m.teamPoints)}<br>טוטאל: ${num(m.total)}<br>ניצחון בית ב־20+: ${num(m.p20*100)}% · חוץ ב־20+: ${num(m.l20*100)}%</p><small class="muted">משחקי העונה הנוכחית לקבוצת הבית: ${m.currentSeasonGames??'—'} · המדגם הכולל במודל: ${m.sampleGames??'—'}. תחזית קבוצות זו מגיעה מהמודל הקיים, הכולל גם מידע מעונות קודמות.</small></article>`).join('')||'אין תחזיות קבוצות זמינות.';
    }).catch(()=>{document.getElementById('auditTeams').textContent='לא ניתן לטעון תחזיות קבוצות כעת.';});
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
