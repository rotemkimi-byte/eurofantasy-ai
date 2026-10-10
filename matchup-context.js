(async()=>{
'use strict';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let data=null;
try{const res=await fetch('./data/matchup-context.json?t='+Date.now(),{cache:'no-store',...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(10000)}:{})});if(res.ok)data=await res.json();}catch(e){console.warn('Matchup context unavailable',e);}
for(let i=0;i<450&&!window.__stabilityModelPatched;i++)await pause(100);
window.__matchupContextData=data;
if(!window.MatchupContext||typeof model!=='function'){window.__matchupContextReady=true;return;}
if(!MatchupContext.valid(data)){window.__matchupContextReady=true;console.warn('No fresh matchup context; existing model preserved');return;}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(1);
const percent=v=>v==null?'—':Math.round(v*100)+'%';
MatchupContext.applyTeams(MATCHUPS,data);
for(const g of GAMES){const m=MATCHUPS[g.home];if(m?.context){g.homeMargin=m.margin;g.homeWinProb=m.winProb;g.awayWinProb=1-m.winProb;g.total=m.total;}}
const previous=model;model=p=>MatchupContext.project(previous(p),p,data);
const originalShow=window.showPlayer;
window.showPlayer=name=>{
 originalShow(name);const p=players.find(p=>p.name===name),body=document.getElementById('modalBody');if(!p||!body)return;
 const x=model(p),c=x.context;if(!c)return;const profile=c.profile,a=profile?.averages,r=c.rival;
 const section=document.createElement('section');section.className='playerSection forecast-results context-player';
 section.innerHTML=`<h3 class="sectionTitle">מעורבות, הגנה ותרחישי דקות</h3>
 <details open><summary>מעורבות בהתקפה</summary>${profile?`<p>${profile.games} משחקים בעונה · ${n(a.fieldGoalsAttempted2!=null&&a.fieldGoalsAttempted3!=null?a.fieldGoalsAttempted2+a.fieldGoalsAttempted3:null)} זריקות מהשדה, ${n(a.freeThrowsAttempted)} זריקות עונשין, ${n(a.assistances)} אסיסטים ו־${n(a.turnovers)} איבודים למשחק.</p><p>חלקו באירועי ההתקפה הנמדדים בקבוצה: ${percent(profile.offensiveShareProxy)} · שינוי נפח אחרון לדקה: ${profile.previousEventsPerMinute>0?percent(profile.recentEventsPerMinute/profile.previousEventsPerMinute-1):'אין מדגם קודם מספיק'}.</p>`:'<p>אין נתוני מעורבות מאומתים לשחקן.</p>'}<p class="muted">מדד נפח המבוסס על זריקות, עונשין ואיבודים; אינו USG% רשמי. התאמה לתחזית: ${n((c.involvementFactor-1)*100)}%.</p></details>
 <details><summary>הגנת ${escape(c.opponent)} מול סגנון השחקן</summary><p>${c.defenseSample} משחקים במדגם · התאמה לפי קליעה שהיריבה מאפשרת לשתי נקודות ולשלוש, משוקללת לפי סוג הזריקות של השחקן: ${n((c.defenseFactor-1)*100)}%.</p>${r?`<p>יריב משוער בעמדה לפי דקות: <b>${escape(r.name)}</b> · ${n(r.avgMinutes)} דק׳ · ${n(r.averages.steals)} חטיפות ו־${n(r.averages.blocksFavour)} חסימות למשחק · ${n(r.height)} ס״מ / ${n(r.weight)} ק״ג.</p>`:''}<p class="muted">זהו יריב בעמדה, לא זיהוי של השומר בפועל. אין במקור נתוני חילופים, שמירות אישיות או שיטת הגנה; נתוני היריב האישיים מוצגים ואינם מקבלים מקדם הגנה מומצא.</p></details>
 <details><summary>תרחישי דקות</summary><table class="lastThreeTable"><thead><tr><th>תרחיש</th><th>דקות</th><th>משקל</th><th>משחקי עבר</th></tr></thead><tbody>${c.scenarios.map(s=>`<tr><td>${{close:'משחק רגיל / צמוד','big-win':'ניצחון ב־15+','big-loss':'הפסד ב־15+'}[s.id]}</td><td>${n(s.minutes)}</td><td>${percent(s.weight)}</td><td>${s.observedGames}</td></tr>`).join('')}</tbody></table><p class="muted">משקלי תרחיש הם אומדן נוסחתי שטרם כויל. ${c.minutesCorrectionActive?'התאמת דקות מוגבלת ל־8% לעומת הבסיס.':'עד שמונה משחקים, התרחישים מרחיבים את טווח הסיכון ואינם משנים את ממוצע הדקות.'}</p></details>
 <p class="notice">השפעת ההרחבה: ${c.pirChange>=0?'+':''}${n(c.pirChange)} PIR · ${c.minutesChange>=0?'+':''}${n(c.minutesChange)} דקות. מקדמי ההרחבה מוגבלים וטרם עברו אימות היסטורי.</p>`;
 body.appendChild(section);
};
const originalGames=renderGames;
renderGames=function(){
 originalGames();const cards=document.querySelectorAll('#gameCards .gameCard');
 GAMES.forEach((g,i)=>{
 const card=cards[i],h=data.teams[g.home],a=data.teams[g.away];if(!card||!h||!a||MATCHUPS[g.home]?.context!==h)return;
 const details=document.createElement('details');details.className='secondaryDetails';
 const roster=t=>`<p><b>${escape(t===h?g.home:g.away)}</b>: ${t.availability.available} פעילים מתוך ${t.availability.rosterCount}. ${t.availability.missing.length?t.availability.missing.map(m=>`${escape(m.name)} (${m.status==='out'?'בחוץ':'בספק'}, ${n(m.avgMinutes)} דק׳)`).join(' · '):'אין חיסורים מסומנים'}.</p>`;
 const history=(t,name)=>`<p><b>${escape(name)}</b>: ${t.hardWins} ניצחונות מתוך ${t.hardGames} משחקים קשים בעונה.</p>${t.hardHistory.length?`<ul>${t.hardHistory.map(r=>`<li>${escape(r.opponent)} · ${r.home?'בית':'חוץ'} · ${r.won?'ניצחון':'הפסד'} · הפרש ${n(r.margin)} · סיכוי מוקדם ${percent(r.pregameWinProb)}</li>`).join('')}</ul>`:''}`;
 const cal=data.calibration;
 details.innerHTML=`<summary>סגל זמין, יריבות קשות וכיול</summary>${roster(h)}${roster(a)}<p>השפעת החיסורים על הפרש הבית: ${n(h.rosterDelta)} · תיקון חוזק יריבות: ${n(h.strengthDelta)} נקודות.</p>${history(h,g.home)}${history(a,g.away)}<p class="muted">משחק קשה: סיכוי מוקדם של עד 40% לפי דירוג שנבנה לפני המשחק. תוצאות אלו נכנסות לדירוג חוזק היריבות; אין תוספת כפולה על אותו ניצחון. השפעת הסגל היא אומדן מוגבל, לא פלוס־מינוס נמדד.</p><p><b>כיול: ${cal.active?'פעיל לאחר בדיקה כרונולוגית':'ממתין למדגם מאומת'}</b> · ${cal.n} משחקים עם תחזית מוקדמת של הגרסה הזו.</p>${cal.validationN?`<p>Brier בבדיקה: ${n(cal.baselineBrier)} לפני / ${n(cal.candidateBrier)} אחרי · ${cal.validationN} משחקי בדיקה.</p>`:''}<table class="lastThreeTable"><thead><tr><th>אחוז חזוי</th><th>משחקים</th><th>ניצחונות בפועל</th></tr></thead><tbody>${cal.bins.filter(b=>b.n).map(b=>`<tr><td>${b.from}–${b.to}%</td><td>${b.n}</td><td>${percent(b.observed)}</td></tr>`).join('')||'<tr><td colspan="3">אין עדיין תחזיות שהסתיימו בגרסה זו</td></tr>'}</tbody></table>`;
 card.appendChild(details);
 });
};
const help=document.querySelector('#matchups .card>p');if(help)help.textContent='הסתברויות מודל לפי תוצאות, ביתיות, חוזק יריבות וסגל זמין. כיול מופעל רק לאחר שיפור בבדיקה על משחקים מאוחרים; האחוזים אינם יחסי סוכנויות.';
window.__matchupContextReady=true;
if(typeof renderAll==='function')renderAll();
})();
