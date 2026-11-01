/* Negative fantasy surprises: observed results, never forecasts. */
(function(root){
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
function players(report){return (report?.players||[]).filter(p=>['G','F','C'].includes(p.pos)&&p.played===true&&num(p.price)!==null&&num(p.pir)!==null&&Number(p.price)>=13&&Number(p.pir)<=10).slice().sort((a,b)=>a.pir-b.pir||b.price-a.price);}
function teams(data){
 const seen=new Set(),games=(data?.teamResults||[]).filter(g=>{
  if(!g.home||!g.away||g.home===g.away||!Number.isFinite(Date.parse(g.date))||Date.parse(g.date)>Date.now()||num(g.homeScore)===null||num(g.awayScore)===null||Number(g.homeScore)===Number(g.awayScore)||seen.has(g.gameCode))return false;
  seen.add(g.gameCode);return true;
 }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const standings=new Map(),out=[];let uncertain=0;
 for(const g of games)for(const name of [g.home,g.away])if(!standings.has(name))standings.set(name,{wins:0,losses:0});
 // All simultaneous tip-offs use the same pre-game snapshot.
 for(let i=0;i<games.length;){let j=i;while(j<games.length&&Date.parse(games[j].date)===Date.parse(games[i].date))j++;
  for(const g of games.slice(i,j)){
   const winner=Number(g.homeScore)>Number(g.awayScore)?g.home:g.away,loser=winner===g.home?g.away:g.home,w=standings.get(winner),l=standings.get(loser);
   if(l.wins>w.wins)out.push({...g,winner,loser,winnerBefore:{...w},loserBefore:{...l}});
   else if(l.wins===w.wins)uncertain++;
  }
  for(const g of games.slice(i,j)){const home=standings.get(g.home),away=standings.get(g.away);if(Number(g.homeScore)>Number(g.awayScore)){home.wins++;away.losses++}else{away.wins++;home.losses++}}
  i=j;
 }
 return {rows:out.reverse(),uncertain};
}
const api={players,teams};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NegativeSurprisesCore=api;
if(typeof document==='undefined')return;
const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');if(!nav||!main)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>num(v)===null?'—':Number(v).toFixed(1),$=id=>document.getElementById(id);
nav.insertAdjacentHTML('beforeend','<button type="button" data-tab="negativeSurprises">הפתעות לרעה</button>');
main.insertAdjacentHTML('beforeend',`<section id="negativeSurprises" class="tab"><div class="card"><div class="sectionHead"><h3>הפתעות לרעה</h3><button id="nsReload" class="secondary" type="button">רענן</button></div><div class="filters"><label>מחזור<select id="nsRound"></select></label></div><details class="ef-help"><summary>הסבר</summary><div class="ef-help-body">שחקנים: מחיר מתועד לפני המחזור של 13 קרדיט ומעלה ו־10 PIR ומטה בפועל, כולל PIR שלילי. שחקנים שלא שיחקו ומחירים חסרים אינם נכללים.<br>קבוצות: משחזרים את מספר הניצחונות לפני שעת המשחק לפי תוצאות העונה. מוצגים הפסדים ליריבה עם פחות ניצחונות. אין ארכיון מלא של מיקומי הטבלה ושוברי השוויון, ולכן הפסדים בין קבוצות עם אותו מספר ניצחונות אינם מסווגים כאן. הנתונים מתייחסים לעונת 2026/27 בלבד.</div></details><p id="nsStatus" role="status" class="muted"></p><h4 class="nsTitle">שחקנים · 13+ CR / עד 10 PIR</h4><p id="nsPlayersStatus" class="muted" role="status"></p><div id="nsPlayers" class="nsGrid"></div><h4 class="nsTitle">קבוצות · הפסד ליריבה עם פחות ניצחונות</h4><p id="nsTeamsStatus" class="muted" role="status"></p><div id="nsTeams" class="nsGrid"></div></div></section>`);
const style=document.createElement('style');style.textContent=`.nsGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:12px}.nsCard{padding:15px;background:var(--card2);border:1px solid var(--line);border-inline-start:4px solid var(--bad);border-radius:14px;color:var(--text)}.nsCard h4{margin:0 0 8px;font-size:18px;line-height:1.5}.nsCard p{font-size:13px;line-height:1.6;margin:7px 0;color:var(--muted)}.nsMetrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}.nsMetrics>div{background:var(--card);border:1px solid var(--line);border-radius:10px;text-align:center;padding:10px 3px}.nsMetrics b{display:block;font-size:24px;color:var(--text)}.nsMetrics small{font-size:11px}.nsMetrics>div:first-child b{color:var(--bad)}.nsTitle{margin:24px 0 12px;font-size:17px}.nsScore{font-size:25px;font-weight:800;direction:ltr;text-align:center;color:var(--text);padding:8px}.nsEmpty{font-size:14px;padding:15px;border:1px dashed var(--line);border-radius:12px}`;document.head.append(style);
let lab=null,results=null,loading=false;
function render(){
 const round=Number($('nsRound').value),r=lab?.rounds?.find(x=>Number(x.round)===round),ps=players(r);
 $('nsPlayersStatus').textContent=!lab?'נתוני השחקנים לא נטענו.':!r?'דוח השחקנים למחזור הזה עדיין לא זמין.':`${ps.length} שחקנים · ${r.complete?'מחזור סופי':'מחזור חלקי'} · ${r.playedGames}/${r.totalGames} משחקים${r.unknownPrices?' · '+r.unknownPrices+' משתתפים ללא מחיר מתועד':''}`;
 $('nsPlayers').innerHTML=ps.map(p=>`<article class="nsCard"><h4><bdi>${esc(p.name)}</bdi></h4><p><bdi>${esc(p.team)}</bdi> · ${esc(p.pos)}</p><p>${(p.opponents||[]).map(o=>(o.home?'בית':'חוץ')+' מול '+esc(o.name)).join(' · ')}</p><div class="nsMetrics"><div><b>${fmt(p.pir)}</b><small>PIR בפועל</small></div><div><b>${fmt(p.price)}</b><small>CR לפני המחזור</small></div><div><b>${fmt(p.minutes)}</b><small>דקות בפועל</small></div></div></article>`).join('')||(r?'<p class="nsEmpty">אין שחקנים שעומדים בתנאים במחזור הזה.</p>':'');
 const ts=teams(results).rows.filter(g=>Number(g.round)===round);
 $('nsTeamsStatus').textContent=results?`${ts.length} הפסדים בסינון · לפי מאזן לפני המשחק`:'נתוני הקבוצות לא נטענו.';
 $('nsTeams').innerHTML=ts.map(g=>`<article class="nsCard"><h4><bdi>${esc(g.loser)}</bdi> הפסידה ל־<bdi>${esc(g.winner)}</bdi></h4><p>${new Date(g.date).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'})} · ${g.loser===g.home?'הפסד בית':'הפסד חוץ'}</p><div class="nsScore"><bdi>${esc(g.home)}</bdi> ${g.homeScore} – ${g.awayScore} <bdi>${esc(g.away)}</bdi></div><p>לפני המשחק: <bdi>${esc(g.loser)}</bdi> עם ${g.loserBefore.wins} ניצחונות ו־${g.loserBefore.losses} הפסדים; <bdi>${esc(g.winner)}</bdi> עם ${g.winnerBefore.wins} ניצחונות ו־${g.winnerBefore.losses} הפסדים.</p></article>`).join('')||(results?'<p class="nsEmpty">לא נמצאו הפסדים ליריבה עם פחות ניצחונות במחזור הזה. שוויון בניצחונות אינו נכלל.</p>':'');
}
async function load(){if(loading)return;loading=true;$('nsReload').disabled=true;$('nsStatus').textContent='טוען תוצאות בפועל…';
 const paths=['round-lab.json','official-offense.json'];
 const fetched=await Promise.allSettled(paths.map(async path=>{const r=await fetch('./data/'+path+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('fetch');const d=await r.json();if(d.season!=='E2026')throw Error('season');return d}));
 if(fetched[0].status==='fulfilled'&&Array.isArray(fetched[0].value.rounds))lab=fetched[0].value;else lab=null;
 if(fetched[1].status==='fulfilled'&&Array.isArray(fetched[1].value.teamResults))results=fetched[1].value;else results=null;
 const previous=$('nsRound').value,rounds=[...new Set([...(lab?.rounds||[]).map(r=>Number(r.round)),...(results?.teamResults||[]).map(g=>Number(g.round))])].filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>b-a);
 $('nsRound').replaceChildren(...rounds.map(r=>new Option('מחזור '+r,r)));if(rounds.includes(Number(previous)))$('nsRound').value=previous;
 $('nsStatus').textContent=lab&&results?'עונת 2026/27 · תוצאות בפועל':lab||results?'חלק מהנתונים לא נטענו. אפשר לנסות לרענן.':'הנתונים לא נטענו. נסה לרענן.';render();loading=false;$('nsReload').disabled=false;
}
$('nsReload').onclick=load;$('nsRound').onchange=render;
nav.querySelector('[data-tab="negativeSurprises"]').onclick=e=>{document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));e.currentTarget.classList.add('active');$('negativeSurprises').classList.add('active');void load();};
})(typeof window==='undefined'?globalThis:window);
