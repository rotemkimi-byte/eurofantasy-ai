(async()=>{
'use strict';
const A=window.AlgorithmLab,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n==null?'—':Number(n).toFixed(1),signed=n=>(n>0?'+':'')+fmt(n),storageKey='eurofantasy-algorithm-v1';
if(!A||document.getElementById('algorithm'))return;
let weights={...A.defaults},saved=null;
try{const value=JSON.parse(localStorage.getItem(storageKey));if(value?.version===1&&A.valid(value.weights)){weights={...value.weights};saved=value.savedAt;}}catch{}
const tab=document.createElement('button');tab.dataset.tab='algorithm';tab.textContent='אלגוריתם';
const nav=document.querySelector('.tabs');if(!nav)return;nav.insertBefore(tab,nav.querySelector('[data-tab="data"]'));
const section=document.createElement('section');section.id='algorithm';section.className='tab';
section.innerHTML=`<div class="card al-shell"><div class="al-heading"><div><h2>אלגוריתם</h2><p>קודם בודקים מה קרה, אחר כך מסתכלים קדימה.</p></div></div>
<div class="al-modes" role="group" aria-label="עבר או צפי"><button type="button" data-al-mode="history" aria-pressed="true">מה היה</button><button type="button" data-al-mode="next" aria-pressed="false">צפי למשחק הבא</button></div>
<div class="al-selectors"><label>קבוצה<select id="alTeam"><option value="">כל הקבוצות</option></select></label><label>שחקן<select id="alPlayer"></select></label><label id="alGameLabel">משחק שהסתיים<select id="alGame"></select></label></div>
<p id="alContext" class="al-context" aria-live="polite">טוען את נתוני המודל…</p>
<div id="alRecent"></div><div id="alHistoryActual"></div>
<details class="al-advanced"><summary>תרחיש ידני · מגרש ודקות</summary><p>שינוי כאן משפיע על הניסוי בלבד.</p><div class="al-selectors"><label>מגרש וקהל<select id="alVenue"><option value="unknown">לפי הנתונים · ללא תרחיש ידני</option><option value="home">בית עם קהל</option><option value="empty">בית ללא קהל</option><option value="away">משחק חוץ</option><option value="neutral">מגרש ניטרלי</option></select></label><label>דקות לתרחיש<input id="alMinutes" type="number" min="0" max="40" step="0.5" placeholder="לפי צפי המודל"></label></div></details>
<div id="alResult" aria-live="polite"></div><div id="alOfficial"></div>
<details class="al-status-details"><summary>מקור התחזית ואמינות הנתונים</summary><p id="alHistoryStatus"></p></details>
<details class="al-advanced al-weight-editor"><summary>עריכת משקלי האלגוריתם <b id="alTotal"></b></summary><p>ניסוי במכשיר הזה בלבד. המשקלים אינם משנים את תחזיות האתר. הסכום צריך להיות 100%; נתון חסר אינו מקבל השפעה.</p><div id="alWeights" class="al-table-wrap"><table class="al-table al-weight-table"><thead><tr><th scope="col">קריטריון</th><th scope="col">משקל %</th></tr></thead><tbody>${A.definitions.map(d=>`<tr><th scope="row"><label for="al-${d.id}">${esc(d.label)}</label><details><summary>הסבר</summary><p>${esc(d.description)}</p></details></th><td><input id="al-${d.id}" data-weight="${d.id}" type="number" min="0" max="100" step="1" value="${weights[d.id]}" aria-label="משקל ${esc(d.label)} באחוזים"><input hidden type="range" data-slider="${d.id}" min="0" max="100" step="1" value="${weights[d.id]}" aria-label="סרגל משקל ${esc(d.label)}"></td></tr>`).join('')}</tbody></table></div><div class="al-actions"><button id="alSave">שמור במכשיר</button><button id="alNormalize" class="secondary">התאם ל־100%</button><button id="alReset" class="secondary">משקלים מוצעים</button></div><p id="alSaved" role="status"></p></details>
<details class="al-method"><summary>איך החישוב עובד?</summary><p>בסיס PIR אישי + התרומה של כל קריטריון: בסיס × משקל / 100 × אות בין ‎−1 ל־1. השינוי הכולל מוגבל ל־60% לכל כיוון. האחוז הוא עוצמת השפעה, לא סיכוי להצלחה.</p><p>דקות משוות לממוצע שלושת המשחקים האחרונים; יכולת ומעורבות משוות לקצב הבסיס. מדגמים קטנים מקבלים השפעה מופחתת. בית וקהל בתרחיש הידני הם הנחות ניסוי, לא השפעות שנמדדו. שחקן בחוץ מקבל אפס; ספק מקבל הפחתת תרחיש של 18%, שאינה הסתברות השתתפות.</p><p>בעבר משתמשים רק בנתונים שנשמרו לפני המשחק. הניסוי עם המשקלים הנוכחיים הוא חישוב בדיעבד, ואינו התחזית המקורית. לפני החלפת המודל נדרשת בדיקה על מחזורים שלא שימשו לבחירת המשקלים.</p></details></div>`;
(document.querySelector('main')||document.body).appendChild(section);
const $=id=>document.getElementById(id);let ready=false,history=null,requestId=0,mode='history';const snapshots=new Map();let officialData=null,crowdData=null,schedule=null;
tab.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));tab.classList.add('active');section.classList.add('active');window.scrollTo({top:70,behavior:'smooth'});if(ready){options(true);gameOptions(true);void selectGame();}};
function roster(){return typeof players!=='undefined'?players.filter(p=>['G','F','C'].includes(p.pos)):[];}
function options(preserve=false){const list=roster(),teams=[...new Set(list.map(p=>p.team))].sort(),team=teams.includes($('alTeam').value)?$('alTeam').value:(list.find(p=>p.name==='Elijah Bryant')?.team||teams[0]||''),selected=preserve?$('alPlayer').value:'';
 $('alTeam').innerHTML=teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');$('alTeam').value=team;
 const available=list.filter(p=>p.team===team).sort((a,b)=>Number(b.price)-Number(a.price)||a.name.localeCompare(b.name));
 $('alPlayer').innerHTML=available.map(p=>`<option value="${esc(p.name)}">${esc(p.name)} · ${fmt(p.price)} CR · ${esc(p.pos)}</option>`).join('');
 if(available.some(p=>p.name===selected))$('alPlayer').value=selected;else if(available.some(p=>p.name==='Elijah Bryant'))$('alPlayer').value='Elijah Bryant';
}
function playerLogs(p){const profiles=window.__matchupContextData?.players||{},context=Object.values(profiles).find(q=>q.name===p?.name)?.logs||[];const observed=window.OfficialOffense&&officialData?.players?.[window.OfficialOffense.key(p?.name)];return observed?observed.games.filter(g=>g.team===p.team).map(g=>({...context.find(q=>q.gameCode===g.gameCode),...g,...g.stats,valuation:g.stats.valuation})):context;}
function gameOptions(preserve=false){
 const previous=preserve?$('alGame').value:'',p=roster().find(p=>p.name===$('alPlayer').value);
 const logs=playerLogs(p).filter(g=>Number(g.gameCode)>0&&Date.parse(g.date)<=Date.now()).slice().sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 $('alGameLabel').hidden=mode==='next';
 $('alGame').innerHTML=mode==='next'?'<option value="next">המשחק הבא</option>':logs.length?logs.map(g=>`<option value="${Number(g.gameCode)}">${esc(g.date?.slice(0,10))} · מול ${esc(g.opponent)}</option>`).join(''):'<option value="">אין משחקים זמינים</option>';
 if(mode==='history'&&logs.some(g=>String(g.gameCode)===previous))$('alGame').value=previous;
}
for(const button of section.querySelectorAll('[data-al-mode]'))button.onclick=()=>{
 mode=button.dataset.alMode;
 for(const item of section.querySelectorAll('[data-al-mode]'))item.setAttribute('aria-pressed',String(item===button));
 gameOptions();void selectGame();
};
function table(headers,rows,caption=''){
 return `<div class="al-table-wrap"><table class="al-table">${caption?`<caption>${esc(caption)}</caption>`:''}<thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((value,i)=>i===0?`<th scope="row">${value}</th>`:`<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function recentPanel(p,past){
 const logs=playerLogs(p).filter(g=>Date.parse(g.date)<=Date.now()&&(!past||!history||Date.parse(g.date)<=Date.parse(history.game.date))).slice().sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,3);
 $('alRecent').innerHTML=logs.length?table(['משחק','PIR בפועל','דקות'],logs.map(g=>[`${esc(g.opponent)}<small>${esc(g.date?.slice(0,10))}</small>`,fmt(g.valuation??g.pir),fmt(g.minutes)]),past?'התוצאות עד המשחק שנבחר':'לפני הצפי · 3 המשחקים האחרונים'):'<p class="notice">אין משחקים קודמים זמינים לשחקן.</p>';
}

async function selectGame(){const token=++requestId;history=null;$('alHistoryActual').innerHTML='';$('alOfficial').innerHTML='';$('alResult').innerHTML='';$('alRecent').innerHTML='';$('alVenue').value='unknown';$('alMinutes').value='';
 if(!$('alGame').value||$('alGame').value==='next'){draw();return;}
 const p=roster().find(p=>p.name===$('alPlayer').value),g=playerLogs(p).find(g=>String(g.gameCode)===$('alGame').value);if(!g)return;
 $('alContext').textContent='טוען את המשחק שנבחר…';$('alHistoryStatus').textContent='טוען נתונים שנשמרו לפני המשחק…';$('alResult').innerHTML='';
 let snap=snapshots.get(g.gameCode);
 if(!snap){try{const r=await fetch(`./data/learning/snapshots/E2026-${Number(g.gameCode)}.json`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){snap=await r.json();snapshots.set(g.gameCode,snap);}}catch{}}
 if(token!==requestId)return;
 history={...A.historical(p,g,snap,playerLogs(p)),game:g};draw();
}

function selectedFixture(p,x,past){
 if(past)return history.game;
 const normalize=t=>typeof canonicalTeam==='function'?canonicalTeam(t):t;
 const opponent=x.match?.opponent||p.opponent;
 const fixtures=(schedule?.data||[]).filter(g=>g.season?.code==='E2026'&&!g.played&&Date.parse(g.utcDate)>Date.now()&&[normalize(g.local?.club?.name),normalize(g.road?.club?.name)].includes(p.team)).sort((a,b)=>Date.parse(a.utcDate)-Date.parse(b.utcDate));
 const next=fixtures[0];if(!next)return null;
 const home=normalize(next.local?.club?.name)===p.team,opp=normalize((home?next.road:next.local)?.club?.name);
 // Never attach news for the next fixture to a stale model showing another opponent.
 return opp===opponent?{gameCode:next.gameCode,date:next.utcDate,home,opponent:opp}:null;
}
function verifiedCrowd(p,x,past){return A.crowdEvidence(crowdData,selectedFixture(p,x,past),past?(history.savedAt||history.game.date):undefined);}
function evidencePanel(p,x,past){
 const perf=A.performance(playerLogs(p),past?history.game:null),pair=perf.pair||[];
 const title=past?'שני המשחקים עד המשחק שנבחר':'שני המשחקים האחרונים';
 let chart='';
 if(pair.length){
  const low=Math.min(0,...pair.map(g=>g.pir)),high=Math.max(1,...pair.map(g=>g.pir)),y=v=>35+(high-v)/(high-low)*95,zero=y(0),xs=pair.map((g,i)=>pair.length===1?170:85+i*170);
  chart=`<figure class="al-mini-chart"><figcaption>${title} · PIR בפועל</figcaption><svg viewBox="0 0 340 165" role="img" aria-label="${esc(pair.map(g=>g.opponent+': '+fmt(g.pir)+' PIR').join(' · '))}"><line x1="30" x2="310" y1="${zero}" y2="${zero}" stroke="var(--muted)"/>${pair.length===2?`<line x1="${xs[0]}" y1="${y(pair[0].pir)}" x2="${xs[1]}" y2="${y(pair[1].pir)}" stroke="var(--accent)" stroke-width="3"/>`:''}${pair.map((g,i)=>`<circle cx="${xs[i]}" cy="${y(g.pir)}" r="5" fill="var(--accent)"/><text x="${xs[i]}" y="${y(g.pir)-12}" text-anchor="middle" fill="var(--text)">${fmt(g.pir)}</text><text x="${xs[i]}" y="153" text-anchor="middle" fill="var(--muted)" font-size="11">${esc(g.date.slice(5,10))}</text>`).join('')}</svg>${pair.map(g=>`<p><b>${esc(g.opponent)}</b> · ${esc(g.date.slice(0,10))} · <b>${fmt(g.pir)} PIR</b> · ${fmt(g.minutes)} דקות</p>`).join('')}<p>${perf.previous?`שינוי מול המשחק הקודם: <b dir="ltr">${signed(perf.pirDelta)} PIR</b>${perf.pirDeltaPct!==null?' ('+signed(perf.pirDeltaPct)+'%)':''}. `:''}${perf.rateDeltaPct!==null?`ביצוע לדקה: <b dir="ltr">${signed(perf.rateDeltaPct)}%</b> מול ${perf.priorGames} המשחקים שקדמו למשחק האחרון (${fmt(perf.rate)} מול ${fmt(perf.normalRate)} PIR לדקה).`:'אין בסיס חיובי מספיק לחישוב שינוי באחוזים.'}</p></figure>`;
 }
 const opponent=past?history.game.opponent:x.match?.opponent||p.opponent,cutoff=past?(history.savedAt||history.game.date):new Date().toISOString();
 const e=A.opponentEvidence(officialData,opponent,cutoff),a=e.allowed,l=e.league;
 let defense=`<h3>למה קשה או נוח מול ${esc(opponent||'היריבה')}?</h3>`;
 if(a.games>=3){
  const twoGap=a.rate2-l.rate2,threeGap=a.rate3-l.rate3,pointGap=a.points-l.points;
  defense+=`<ul><li><b>הגנת קליעה לשתיים:</b> היריבות קלעו ${fmt(a.rate2)}% (${a.m2} מתוך ${a.a2}) מול ${fmt(l.rate2)}% בליגה · פער ${signed(twoGap)} נקודות אחוז. ${twoGap<=-2?'נתון התומך בקושי בקליעה לשתיים.':twoGap>=2?'היריבה מאפשרת אחוז גבוה יחסית לשתיים.':'קרוב לממוצע הליגה.'} אחוז לשתיים כולל גם חצי מרחק; הוא אינו מדד מדויק להגנה בצבע.</li><li><b>הגנת שלשות:</b> ${fmt(a.rate3)}% (${a.m3} מתוך ${a.a3}) לעומת ${fmt(l.rate3)}% בליגה · פער ${signed(threeGap)} נקודות אחוז.</li><li><b>נקודות שספגה:</b> ${fmt(a.points)} למשחק מול ${fmt(l.points)} בליגה · ${signed(pointGap)} נקודות. הנתון מושפע מקצב המשחק.</li><li><b>חוזק לפי תוצאות:</b> ${e.wins} ניצחונות מתוך ${a.games} משחקים (${fmt(e.wins/a.games*100)}%).</li></ul><p class="muted">מדגם: ${a.games} משחקים שהסתיימו לפני ${esc(cutoff.slice(0,10))}. אלה נתונים תיאוריים; הם אינם מוכיחים מה גרם לביצוע של שחקן מסוים. אין נתוני מיקום זריקות שמאמתים ״צבע חזק״.</p>`;
 }else defense+='<p class="muted">אין לפחות שלושה משחקים קודמים עם בוקס סקור מלא להסבר הגנתי; לא נקבעת הגנה חזקה ללא מדגם.</p>';
 if(x.positionMatchPct!=null)defense+=`<p><b>מול העמדה ${esc(p.pos)}:</b> התאמת המודל ${signed(x.positionMatchPct)}% ב־PIR. ערך שלילי פירושו התאמה קשה יותר, ולא הוכחה שהשחקן ייכשל.</p>`;
 const news=(crowdData?.games||[]).filter(r=>[r.home,r.away].includes(past?history.game.team:p.team)&&Date.parse(r.publishedAt)<=Date.parse(cutoff));
 const crowd=verifiedCrowd(p,x,past);
 let crowdHTML=`<h3>אימות קהל מחדשות ספורט</h3><p>${crowd?`למשחק שנבחר: <b>${crowd.withoutCrowd?'ללא קהל':'עם קהל'}</b> · <a href="${esc(crowd.source)}" target="_blank" rel="noopener">${esc(crowd.publisher)}</a> · כתבה מ־${esc(crowd.publishedAt.slice(0,10))}`:'לא נמצא דיווח מאומת למשחק שנבחר.'}</p>`;
 if(news.length)crowdHTML+=news.map(r=>`<p class="notice"><b>${esc(r.home)} מול ${esc(r.away)} · ${esc(r.date.slice(0,10))}: ${r.withoutCrowd?'ללא קהל':'עם קהל'}</b><br><a href="${esc(r.source)}" target="_blank" rel="noopener">${esc(r.publisher)} · ${esc(r.publishedAt.slice(0,10))}</a> · נבדק ${esc(crowdData.checkedAt?.slice(0,10))}. האימות חל על משחק זה בלבד.</p>`).join('');
 return chart+defense+crowdHTML;
}
function factorAnswers(p,x,past){return A.answers(past?(history.player||{...p,team:history.game.team}):p,x,{game:past?history.game:null,home:past?(history.player?.home??history.game.home):undefined,logs:playerLogs(p),minutes:$('alMinutes').value,venue:$('alVenue').value}).map(r=>{const news=verifiedCrowd(p,x,past);return r.id==='crowd'&&news&&$('alVenue').value==='unknown'?{...r,value:news.withoutCrowd?'כן':'לא',kind:'דיווח מאומת',note:news.publisher+' · '+news.publishedAt.slice(0,10)+' · קישור למקור בהמשך'}:r;});}
function answerPanel(p,x,past){return table(['קריטריון',past?'במשחק שנבחר':'למשחק הבא'],factorAnswers(p,x,past).map(r=>[esc(r.label),`<b>${esc(r.value)}</b>${['בפועל','צפי'].includes(r.kind)?'':`<small class="al-kind">${esc(r.kind)}</small>`}<details class="al-cell-note"><summary aria-label="${esc(r.label)} · מקור והסבר">פרטים</summary><p>${esc(r.note)}</p></details>`]),past?'מה היה בכל קריטריון?':'מה צפוי בכל קריטריון?');}

function drawOfficial(p,x,past){
 const O=window.OfficialOffense,root=$('alOfficial');if(!O||!officialData){root.innerHTML='<p class="muted">נתוני ההתקפה הרשמיים עדיין אינם זמינים.</p>';return;}
 const minutes=$('alMinutes').value!==''?Number($('alMinutes').value):p.status==='out'?0:x?.minutes;
 const report=O.report(officialData,p,{gameCode:past?history.game.gameCode:null,minutes:minutes??null});
 if(!report){root.innerHTML='<p class="muted">אין נתונים רשמיים למשחק או לשחקן שנבחר.</p>';return;}
 const percent=n=>n==null?'אין נתון':fmt(n)+'%',stat=(label,value,note)=>`<tr><th scope="row">${esc(label)}</th><td><b>${esc(value)}</b><small>${esc(note)}</small></td></tr>`;
 const m=report.observed?.metrics,b=report.baseline,pr=report.projected;
 const rows=past?[['זריקות מהשדה',fmt(m?.fga),'ניסיונות במשחק'],['זריקות לשלוש',fmt(m?.threeAttempts),'ניסיונות במשחק'],['זריקות לשתיים',fmt(m?.twoAttempts),'ניסיונות במשחק'],['זריקות עונשין',fmt(m?.freeThrowAttempts),'ניסיונות במשחק'],['חלק בזריקות הקבוצה',percent(m?.shotSharePct),'מחושב מכלל ניסיונות הקבוצה במשחק'],['Usage',percent(m?.usagePct),'מחושב מהבוקס סקור הרשמי לפי נוסחת מרכז המשחקים'],['יעילות קליעה eFG%',percent(m?.efgPct),'מחושב מהקליעות והניסיונות במשחק'],['יעילות קליעה TS%',percent(m?.tsPct),'מחושב מנקודות, זריקות מהשדה ועונשין']]:[['צפי זריקות מהשדה',fmt(pr?.fga),'קצב שלושת המשחקים האחרונים × צפי הדקות'],['צפי זריקות לשלוש',fmt(pr?.three),'קצב שלושת המשחקים האחרונים × צפי הדקות'],['צפי זריקות לשתיים',fmt(pr?.two),'קצב שלושת המשחקים האחרונים × צפי הדקות'],['צפי זריקות עונשין',fmt(pr?.fta),'קצב שלושת המשחקים האחרונים × צפי הדקות'],['Usage כבסיס לצפי',percent(b.usagePct),`מחושב מ־${b.games} משחקים אחרונים; זהו נתון עבר`],['יעילות קליעה eFG%',percent(b.efgPct),'שלושה משחקים אחרונים — נתון עבר'],['יעילות קליעה TS%',percent(b.tsPct),'שלושה משחקים אחרונים — נתון עבר']];

 const observed=past?report.observed:report.latest,shot=A.shooting(observed?.stats),shotRow=(label,v)=>stat(label,v?`${v.made} מתוך ${v.attempts}`:'אין נתון',v?`${v.missed} החטאות${v.pct!==null?' · '+fmt(v.pct)+'% קליעה':''}`:'נתון חסר במקור');
 const actualShots=`<h3>קליעה ואיבודים · ${past?'המשחק שנבחר':'המשחק האחרון בפועל'}</h3><p class="muted">${esc(observed?.opponent)} · ${esc(observed?.date?.slice(0,10))} · ${fmt(shot.points)} נקודות · ${fmt(observed?.stats?.valuation)} PIR</p><div class="al-table-wrap"><table class="al-table"><thead><tr><th>נתון</th><th>בפועל</th></tr></thead><tbody>${shotRow('מהשדה',shot.field)}${shotRow('לשתיים',shot.two)}${shotRow('לשלוש',shot.three)}${shotRow('עונשין',shot.free)}${stat('איבודי כדור',fmt(shot.turnovers),'במשחק בפועל')}${stat('אסיסטים',fmt(shot.assists),'במשחק בפועל')}</tbody></table></div>`;
root.innerHTML=`<details class="al-advanced"><summary>נתוני קליעה והתקפה רשמיים</summary>`+actualShots+`<h3>נפח התקפי ו־Usage · ${past?'בפועל':'בסיס רשמי לצפי'}</h3><p class="muted">עונת 2026/27 · נתוני משחק מהמקור הרשמי. Usage ומדדי היעילות מחושבים מהם. זמן עם הכדור ומספר נגיעות אינם זמינים.</p><div class="al-table-wrap"><table class="al-table"><thead><tr><th>מדד</th><th>${past?'בפועל':'אומדן / בסיס מהעבר'}</th></tr></thead><tbody>${rows.map(r=>stat(...r)).join('')}</tbody></table></div><p class="notice">${report.trend==null?'אין מספיק משחקים להשוואת מגמת נפח.':`נפח הזריקות לדקה ${report.trend>=0?'עלה':'ירד'} ב־${fmt(Math.abs(report.trend))}% בשלושת המשחקים האחרונים לעומת המשחקים הקודמים. זו מגמה שנצפתה, לא הבטחה למשחק הבא.`}</p><h3>חברי קבוצה באותו תפקיד רשמי</h3><p class="muted">${esc(report.positionName||'תפקיד לא ידוע')} · אותם שחקנים עשויים לשחק יחד. ללא נתוני חילופים מאומתים אין קביעה שהם מחליפים זה את זה.</p><div class="al-table-wrap"><table class="al-table"><thead><tr><th>שחקן</th><th>דקות והשוואה</th></tr></thead><tbody>${report.peers.map(q=>stat(q.name,fmt(q.average.avgMinutes)+' דק׳',`ממוצע עד 3 הופעות אחרונות; שיחק בפעם האחרונה ב־${q.last.date.slice(0,10)}. `+(q.comparisonReady?`דקות השחקן הנבחר כשחבר הסגל שיחק: ${fmt(q.withPeer.avgMinutes)} (${q.withPeer.games} משחקים); כשנרשם ולא שיחק: ${fmt(q.withoutPeer.avgMinutes)} (${q.withoutPeer.games} משחקים). זו השוואה תיאורית.`:`השוואת דקות: ${q.withPeer.games} משחקים יחד, ${q.withoutPeer.games} משחקים שבהם החבר נרשם ולא שיחק; נדרשים לפחות 3 בכל מצב.`))).join('')||'<tr><td colspan="2">אין חברי קבוצה עם תפקיד תואם במדגם.</td></tr>'}</tbody></table></div><p class="muted"><a href="${esc(report.source)}" target="_blank" rel="noopener">מקור נתוני המשחק: EuroLeague</a> · <a href="https://mediagamecenter.euroleague.net/" target="_blank" rel="noopener">מקור נוסחאות המדדים</a><br>עודכן: ${esc(report.updatedAt?.slice(0,16).replace('T',' '))} UTC. הצפי לנפח הוא אומדן מדקות ומקצב זריקות, ומשמש להסבר בלשונית.</p></details><details class="al-advanced"><summary>היריבה, מגמת PIR ואימות קהל</summary>${evidencePanel(p,x,past)}</details>`;
}
function draw(){const valid=A.valid(weights),total=A.definitions.reduce((sum,d)=>sum+Number(weights[d.id]||0),0);$('alTotal').textContent=fmt(total)+'% / 100%';$('alTotal').className=valid?'al-good':'al-bad';$('alSave').disabled=!valid;
 if(!ready)return;
 const p=roster().find(p=>p.name===$('alPlayer').value);if(!p){$('alResult').textContent='אין שחקנים זמינים בקבוצה שנבחרה.';return;}
 const past=mode==='history';
 recentPanel(p,past);
 if(past&&!$('alGame').value){$('alContext').textContent=p.team+' · '+p.pos;$('alHistoryStatus').textContent='אין משחקים זמינים לשחקן הזה.';$('alHistoryActual').innerHTML='';$('alResult').innerHTML='<p class="notice">אין עדיין משחק שהסתיים. אפשר לעבור לצפי למשחק הבא.</p>';$('alOfficial').innerHTML='';return;}
 if(past&&!history){$('alResult').innerHTML='';return;}
 $('alHistoryStatus').textContent=past?(history.missing?'לא נמצאה תחזית שמורה תקינה מלפני המשחק. מוצגת התוצאה בלבד.':`תחזית מקורית נשמרה ב־${history.savedAt.slice(0,16).replace('T',' ')} UTC. ${history.partial?'פירוק חלקי: נתונים חסרים אינם מוחלפים בנתונים של היום.':'נתוני הקריטריונים נשמרו לפני המשחק.'} המשקולות הנוכחיות הן ניסוי בדיעבד, ולא המשקולות ששימשו בתחזית המקורית.`):'המשחק הבא: תחזית עתידית לפי הנתונים העדכניים והמשקולות שבחרת.';
 $('alHistoryActual').innerHTML=past?table(['מדד','בפועל','צפי שנשמר'],[['PIR',fmt(history.actual),fmt(history.savedExpected)],['דקות',fmt(history.actualMinutes),fmt(history.player?.expectedMinutes)]],'המשחק שנבחר · תוצאה מול הצפי המקורי')+(history.missing?'<p class="al-context">אין תחזית שמורה מלפני המשחק; מוצגים נתוני הביצוע בלבד.</p>':''):'';
 drawOfficial(p,past?(history.x||{}):model(p),past);
 if(past&&history.missing){$('alContext').textContent=`${history.game.date.slice(0,10)} · מול ${history.game.opponent}`;$('alResult').innerHTML=answerPanel(p,{},true);return;}
 const x=past?history.x:model(p),result=A.evaluate(past?history.player:p,x,weights,{venue:$('alVenue').value,minutes:$('alMinutes').value});
 $('alContext').textContent=`${p.team} · ${p.pos} · מול ${x.match?.opponent||p.opponent||'לא ידוע'} · ${x.match?.home===true?'מסומן כבית':x.match?.home===false?'מסומן כחוץ':'מיקום לא ידוע'} · ${verifiedCrowd(p,x,past)?'קיים דיווח קהל מאומת למשחק':'קהל: טרם אומת למשחק הזה'}`;
 if(result.error){$('alResult').innerHTML=answerPanel(p,x,past)+`<p class="notice">${esc(result.error)}</p>`;return;}
 const metrics=[['בסיס אישי',fmt(result.base)],[past?'צפי מקורי שנשמר':'תחזית האתר',fmt(result.live)],['ניסוי במשקלים הנוכחיים',fmt(result.expected)]];
 const experiment=`<details class="al-advanced"><summary>תחזית ניסיונית והשפעת המשקלים</summary>${table(['מדד','PIR'],metrics)}<p>${result.coverage}% מהמשקל נתמך בנתון או בתרחיש ידני · שינוי מהבסיס: <b dir="ltr">${signed(result.expected-result.base)} PIR</b></p>${result.out?'<p>השחקן בחוץ או שנבחרו אפס דקות: הניסוי אפס.</p>':result.questionable?'<p>ספק: הפחתת תרחיש של 18%.</p>':''}<p>הניסוי אינו תחזית שנבדקה היסטורית.${past?' המשקלים הנוכחיים מופעלים בדיעבד על קלט שנשמר לפני המשחק.':''}</p></details>`;
 $('alResult').innerHTML=(past?'':table(['מדד','צפי למשחק הבא'],[['PIR',fmt(result.live)],['דקות',fmt(x.minutes)]],'צפי המודל · המשחק הבא'))+answerPanel(p,x,past)+(past&&history.savedExpected!=null?`<p class="al-context">פער PIR מהצפי המקורי: <b dir="ltr">${signed(history.actual-history.savedExpected)}</b> (בפועל פחות הצפי)</p>`:'')+experiment;

}
section.querySelectorAll('[data-weight],[data-slider]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.weight||input.dataset.slider;weights[key]=input.value===''?NaN:Number(input.value);const other=section.querySelector(input.dataset.weight?`[data-slider="${key}"]`:`[data-weight="${key}"]`);other.value=input.value;$('alSaved').textContent='שינויים שטרם נשמרו';draw();}));
function sync(){A.definitions.forEach(d=>{section.querySelector(`[data-weight="${d.id}"]`).value=weights[d.id];section.querySelector(`[data-slider="${d.id}"]`).value=weights[d.id];});draw();}
$('alNormalize').onclick=()=>{weights=A.normalize(weights);$('alSaved').textContent='המשקלים הותאמו ל־100%; טרם נשמרו.';sync();};
$('alReset').onclick=()=>{weights={...A.defaults};$('alSaved').textContent='הוחזרו המשקלים המוצעים; לחץ שמירה כדי לשמור אותם.';sync();};
$('alSave').onclick=()=>{if(!A.valid(weights))return;try{saved=new Date().toISOString();localStorage.setItem(storageKey,JSON.stringify({version:1,weights,savedAt:saved}));$('alSaved').textContent='המשקלים נשמרו במכשיר. התחזית הקיימת באתר לא השתנתה.';}catch{$('alSaved').textContent='לא ניתן לשמור בדפדפן הזה. השינויים זמינים כל עוד הדף פתוח.';}};
$('alTeam').onchange=()=>{options();gameOptions();selectGame();};
$('alPlayer').onchange=()=>{gameOptions();selectGame();};
$('alGame').onchange=selectGame;
$('alVenue').onchange=draw;$('alMinutes').oninput=draw;
$('alSaved').textContent=saved?'נטענו המשקלים השמורים במכשיר.':'משקלים מוצעים להתחלת ניסוי — טרם כוילו.';draw();
for(let i=0;i<600&&!window.__rollingReady;i++)await new Promise(r=>setTimeout(r,100));
if(typeof model==='function'&&roster().length){ready=true;options();gameOptions();void selectGame();}else{$('alContext').textContent='נתוני השחקנים עדיין לא זמינים. רענן לאחר השלמת הסנכרון.';}
window.__algorithmLabReady=true;
if(typeof fetch==='function'){
 await Promise.all([['./data/crowd-evidence.json',d=>{if(d.schema==='crowd-evidence-v1')crowdData=d;}],['./data/context/E2026-schedule.json',d=>{if(Array.isArray(d.data))schedule=d;}]].map(async([url,apply])=>{try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok)apply(await r.json());}catch{}}));
 try{const r=await fetch('./data/official-offense.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok){const d=await r.json();if(d.schema==='official-offense-v1'&&d.season==='E2026'){officialData=d;if(ready){gameOptions(true);void selectGame();}}}}catch{}draw();}
})();

