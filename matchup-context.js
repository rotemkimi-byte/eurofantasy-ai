(async()=>{
'use strict';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let data=null;
try{const res=await fetch('./data/matchup-context.json?t='+Date.now(),{cache:'no-store',...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(10000)}:{})});if(res.ok)data=await res.json();}catch(e){console.warn('Matchup context unavailable',e);}
for(let i=0;i<450&&!window.__stabilityModelPatched;i++)await pause(100);
window.__matchupContextData=data;
if(!window.MatchupContext||typeof model!=='function'){window.__matchupContextReady=true;return;}
if(!MatchupContext.valid(data))console.warn('No fresh matchup context; existing model preserved');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toFixed(1);
const percent=v=>v==null?'—':Math.round(v*100)+'%';
window.refreshMatchupContext=next=>{
 if(MatchupContext.valid(next)&&(!MatchupContext.valid(data)||Date.parse(next.updated_at)>=Date.parse(data.updated_at))){data=next;window.__matchupContextData=data;}
 const roster=typeof canonicalTeam==='function'?players.map(p=>({...p,team:canonicalTeam(p.team)})):players;
 MatchupContext.applyTeams(MATCHUPS,data,roster);
 for(const g of GAMES){const m=MATCHUPS[g.home];if(m){g.homeMargin=m.margin;g.homeWinProb=m.winProb;g.awayWinProb=1-m.winProb;g.total=m.total;}}
};
window.refreshMatchupContext();
const previous=model;model=p=>MatchupContext.project(previous(p),p,data);
const originalGames=renderGames;
renderGames=function(){
 originalGames();const cards=document.querySelectorAll('#gameCards .gameCard');
 GAMES.forEach((g,i)=>{
 const card=cards[i],h=data?.teams?.[g.home],a=data?.teams?.[g.away];if(!card||!h||!a||MATCHUPS[g.home]?.context!==h)return;
 const details=document.createElement('details');details.className='secondaryDetails';
 const history=(t,name)=>`<p><b>${escape(name)}</b>: ${t.hardWins} ניצחונות מתוך ${t.hardGames} משחקים קשים בעונה.</p>${t.hardHistory.length?`<ul>${t.hardHistory.map(r=>`<li>${escape(r.opponent)} · ${r.home?'בית':'חוץ'} · ${r.won?'ניצחון':'הפסד'} · הפרש ${n(r.margin)} · סיכוי מוקדם ${percent(r.pregameWinProb)}</li>`).join('')}</ul>`:''}`;
 const cal=data.calibration;
 details.innerHTML=`<summary>היסטוריית יריבות ובדיקת המודל</summary><p>השפעת החיסורים על הפרש הבית: ${n(h.rosterDelta)} · תיקון חוזק יריבות: ${n(h.strengthDelta)} נקודות.</p>${history(h,g.home)}${history(a,g.away)}<p class="muted">משחק קשה: סיכוי מוקדם של עד 40% לפי דירוג שנבנה לפני המשחק. תוצאות אלו נכנסות לדירוג חוזק היריבות; אין תוספת כפולה על אותו ניצחון. השפעת הסגל היא אומדן מוגבל, לא פלוס־מינוס נמדד.</p><p><b>כיול: ${cal.active?'פעיל לאחר בדיקה כרונולוגית':'ממתין למדגם מאומת'}</b> · ${cal.n} משחקים עם תחזית מוקדמת של הגרסה הזו.</p>${cal.validationN?`<p>Brier בבדיקה: ${n(cal.baselineBrier)} לפני / ${n(cal.candidateBrier)} אחרי · ${cal.validationN} משחקי בדיקה.</p>`:''}<table class="lastThreeTable"><thead><tr><th>אחוז חזוי</th><th>משחקים</th><th>ניצחונות בפועל</th></tr></thead><tbody>${cal.bins.filter(b=>b.n).map(b=>`<tr><td>${b.from}–${b.to}%</td><td>${b.n}</td><td>${percent(b.observed)}</td></tr>`).join('')||'<tr><td colspan="3">אין עדיין תחזיות שהסתיימו בגרסה זו</td></tr>'}</tbody></table>`;
 card.appendChild(details);
 });
};
const help=document.querySelector('#matchups .card>p');if(help)help.textContent='הסתברויות מודל לפי תוצאות, ביתיות, חוזק יריבות וסגל זמין. כיול מופעל רק לאחר שיפור בבדיקה על משחקים מאוחרים; האחוזים אינם יחסי סוכנויות.';
window.__matchupContextReady=true;
if(typeof renderAll==='function')renderAll();
})();
