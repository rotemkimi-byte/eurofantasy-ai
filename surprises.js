/* Negative fantasy surprises: observed results, never forecasts. */
(function(root){
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
function players(report){return (report?.players||[]).filter(p=>['G','F','C'].includes(p.pos)&&p.played===true&&num(p.price)!==null&&num(p.pir)!==null&&Number(p.price)>=13&&Number(p.pir)<=10).slice().sort((a,b)=>a.pir-b.pir||b.price-a.price);}
// Bylaws Article 19. Unresolved ties share a rank; names never break ties.
function standings(games,names){
 const table=new Map(names.map(name=>[name,{team:name,wins:0,losses:0,played:0,for:0,against:0,ratio:0,valid:true}]));
 for(const g of games)for(const home of [true,false]){
  const t=table.get(home?g.home:g.away);if(!t)continue;
  const points=Number(home?g.homeScore:g.awayScore),against=Number(home?g.awayScore:g.homeScore);
  const scored=num(home?g.homeStandingsScore:g.awayStandingsScore),allowed=num(home?g.awayStandingsScore:g.homeStandingsScore);
  t.played++;if(points>against)t.wins++;else t.losses++;
  if(scored===null||allowed===null||scored+allowed<=0){t.valid=false;continue}
  t.for+=scored;t.against+=allowed;t.ratio+=allowed?scored/allowed:0;
 }
 function partition(rows,value){const groups=new Map();for(const r of rows){const k=value(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}return [...groups.entries()].sort((a,b)=>b[0]-a[0]).map(x=>x[1])}
 function overall(rows,criteria=0){
  if(rows.length<2||criteria>=3||rows.some(t=>!t.valid))return [rows];
  const values=[t=>t.for-t.against,t=>t.for,t=>Math.round(t.ratio*100000)];
  return partition(rows,values[criteria]).flatMap(g=>overall(g,criteria+1));
 }
 function tied(rows){
  if(rows.length<2)return [rows];
  const set=new Set(rows.map(t=>t.team)),meetings=games.filter(g=>set.has(g.home)&&set.has(g.away));
  const twice=rows.every(a=>rows.every(b=>a===b||meetings.some(g=>g.home===a.team&&g.away===b.team)&&meetings.some(g=>g.home===b.team&&g.away===a.team)));
  if(!twice)return overall(rows);
  const wins=new Map(rows.map(t=>[t.team,0])),diff=new Map(rows.map(t=>[t.team,0]));let valid=true;
  for(const g of meetings){const w=Number(g.homeScore)>Number(g.awayScore)?g.home:g.away;wins.set(w,wins.get(w)+1);const h=num(g.homeStandingsScore),a=num(g.awayStandingsScore);if(h===null||a===null||h+a<=0){valid=false;continue}diff.set(g.home,diff.get(g.home)+h-a);diff.set(g.away,diff.get(g.away)+a-h)}
  const winGroups=partition(rows,t=>wins.get(t.team));
  if(winGroups.length>1)return winGroups.flatMap(tied);
  if(!valid)return [rows];
  const diffGroups=partition(rows,t=>diff.get(t.team));
  if(diffGroups.length>1)return diffGroups.flatMap(tied);
  const groups=overall(rows);return groups.length>1?groups.flatMap(tied):groups;
 }
 const groups=partition([...table.values()],t=>t.wins).flatMap(g=>partition(g,t=>-t.played).flatMap(tied));
 let rank=1;for(const g of groups){for(const t of g){t.rank=rank;t.rankEnd=rank+g.length-1}rank+=g.length}
 return table;
}
const day=g=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.date));
function teams(data){
 const seen=new Set(),games=(data?.teamResults||[]).filter(g=>{
  if(!g.home||!g.away||g.home===g.away||!Number.isFinite(Date.parse(g.date))||Date.parse(g.date)>Date.now()||num(g.homeScore)===null||num(g.awayScore)===null||Number(g.homeScore)===Number(g.awayScore)||seen.has(String(g.gameCode)))return false;
  seen.add(String(g.gameCode));return true;
 }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const names=[...new Set([...(data?.officialStandings?.rows||[]).map(r=>r.team),...games.flatMap(g=>[g.home,g.away])])],out=[];let uncertain=0;
 // End times are unavailable. Freeze before the Israeli match day, excluding all same-day results.
 for(let i=0;i<games.length;){let j=i;while(j<games.length&&day(games[j])===day(games[i]))j++;
  const table=standings(games.slice(0,i),names);
  for(const g of games.slice(i,j)){
   const winner=Number(g.homeScore)>Number(g.awayScore)?g.home:g.away,loser=winner===g.home?g.away:g.home,w=table.get(winner),l=table.get(loser);
   if(l.rankEnd<w.rank)out.push({...g,winner,loser,winnerBefore:{...w},loserBefore:{...l},rankBasis:'start-of-match-day'});
   else if(l.rank===w.rank)uncertain++;
  }
  i=j;
 }
 return {rows:out.reverse(),uncertain};
}
const api={players,teams,standings};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NegativeSurprisesCore=api;
if(typeof document==='undefined')return;
const nav=document.querySelector('nav.tabs'),main=document.querySelector('main');if(!nav||!main)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>num(v)===null?'—':Number(v).toFixed(1),$=id=>document.getElementById(id);
nav.insertAdjacentHTML('beforeend','<button type="button" data-tab="negativeSurprises">הפתעות לרעה</button>');
main.insertAdjacentHTML('beforeend',`<section id="negativeSurprises" class="tab"><div class="card"><div class="sectionHead"><h3>הפתעות לרעה</h3><button id="nsReload" class="secondary" type="button">רענן</button></div><div class="filters"><label>מחזור<select id="nsRound"></select></label></div><details class="ef-help"><summary>הסבר</summary><div class="ef-help-body">שחקנים: מחיר מתועד לפני המחזור של 13 קרדיט ומעלה ו־10 PIR ומטה בפועל, כולל PIR שלילי. שחקנים שלא שיחקו ומחירים חסרים אינם נכללים.<br>קבוצות: משחזרים את הטבלה בתחילת יום המשחק (שעון ישראל), לפני תוצאות אותו יום. הדירוג כולל ניצחונות, פחות משחקים ושוברי שוויון: הפרש סלים, נקודות זכות ויחס סלים; אחרי שני מפגשים בין כל הקבוצות השוות — תחילה המאזן וההפרש ביניהן. נקודות הארכה אינן נכללות בשוברי השוויון. מיקום משותף או נתוני שובר שוויון חסרים אינם מוכרעים באופן שרירותי. זהו דירוג משוחזר מתוצאות המשחקים; התאמות משמעת אינן כלולות. <a href="https://ftpserver.euroleague.net/general/2025_26_EuroLeague_Bylaws.pdf" target="_blank" rel="noopener">מקור הכללים: סעיף 19</a>. הנתונים מתייחסים לעונת 2026/27 בלבד.</div></details><p id="nsStatus" role="status" class="muted"></p><h4 class="nsTitle">שחקנים · 13+ CR / עד 10 PIR</h4><p id="nsPlayersStatus" class="muted" role="status"></p><div id="nsPlayers" class="nsGrid"></div><h4 class="nsTitle">קבוצות · הפסד ליריבה נמוכה בטבלה</h4><p id="nsTeamsStatus" class="muted" role="status"></p><div id="nsTeams" class="nsGrid"></div></div></section>`);
const style=document.createElement('style');style.textContent=`.nsGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:12px}.nsCard{padding:15px;background:var(--card2);border:1px solid var(--line);border-inline-start:4px solid var(--bad);border-radius:14px;color:var(--text)}.nsCard h4{margin:0 0 8px;font-size:18px;line-height:1.5}.nsCard p{font-size:13px;line-height:1.6;margin:7px 0;color:var(--muted)}.nsMetrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}.nsMetrics>div{background:var(--card);border:1px solid var(--line);border-radius:10px;text-align:center;padding:10px 3px}.nsMetrics b{display:block;font-size:24px;color:var(--text)}.nsMetrics small{font-size:11px}.nsMetrics>div:first-child b{color:var(--bad)}.nsTitle{margin:24px 0 12px;font-size:17px}.nsScore{font-size:25px;font-weight:800;direction:ltr;text-align:center;color:var(--text);padding:8px}.nsEmpty{font-size:14px;padding:15px;border:1px dashed var(--line);border-radius:12px}`;document.head.append(style);
let lab=null,results=null,loading=false;
function render(){
 const round=Number($('nsRound').value),r=lab?.rounds?.find(x=>Number(x.round)===round),ps=players(r);
 $('nsPlayersStatus').textContent=!lab?'נתוני השחקנים לא נטענו.':!r?'דוח השחקנים למחזור הזה עדיין לא זמין.':`${ps.length} שחקנים · ${r.complete?'מחזור סופי':'מחזור חלקי'} · ${r.playedGames}/${r.totalGames} משחקים${r.unknownPrices?' · '+r.unknownPrices+' משתתפים ללא מחיר מתועד':''}`;
 $('nsPlayers').innerHTML=ps.map(p=>`<article class="nsCard"><h4><bdi>${esc(p.name)}</bdi></h4><p><bdi>${esc(p.team)}</bdi> · ${esc(p.pos)}</p><p>${(p.opponents||[]).map(o=>(o.home?'בית':'חוץ')+' מול '+esc(o.name)).join(' · ')}</p><div class="nsMetrics"><div><b>${fmt(p.pir)}</b><small>PIR בפועל</small></div><div><b>${fmt(p.price)}</b><small>CR לפני המחזור</small></div><div><b>${fmt(p.minutes)}</b><small>דקות בפועל</small></div></div></article>`).join('')||(r?'<p class="nsEmpty">אין שחקנים שעומדים בתנאים במחזור הזה.</p>':'');
 const ts=teams(results).rows.filter(g=>Number(g.round)===round);
 $('nsTeamsStatus').textContent=results?`${ts.length} הפסדים בסינון · טבלה משוחזרת לתחילת יום המשחק`:'נתוני הקבוצות לא נטענו.';
 $('nsTeams').innerHTML=ts.map(g=>`<article class="nsCard"><h4><bdi>${esc(g.loser)}</bdi> הפסידה ל־<bdi>${esc(g.winner)}</bdi></h4><p>${new Date(g.date).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'})} · ${g.loser===g.home?'הפסד בית':'הפסד חוץ'}</p><div class="nsScore"><bdi>${esc(g.home)}</bdi> ${g.homeScore} – ${g.awayScore} <bdi>${esc(g.away)}</bdi></div><div class="nsMetrics"><div><b>${g.loserBefore.rank===g.loserBefore.rankEnd?g.loserBefore.rank:g.loserBefore.rank+"–"+g.loserBefore.rankEnd}</b><small>מיקום המפסידה</small></div><div><b>${g.winnerBefore.rank===g.winnerBefore.rankEnd?g.winnerBefore.rank:g.winnerBefore.rank+"–"+g.winnerBefore.rankEnd}</b><small>מיקום המנצחת</small></div><div><b>${g.winnerBefore.rank-g.loserBefore.rankEnd}</b><small>פער מיקומים לפחות</small></div></div><p>בתחילת יום המשחק: <bdi>${esc(g.loser)}</bdi> עם ${g.loserBefore.wins} ניצחונות ו־${g.loserBefore.losses} הפסדים; <bdi>${esc(g.winner)}</bdi> עם ${g.winnerBefore.wins} ניצחונות ו־${g.winnerBefore.losses} הפסדים.</p></article>`).join('')||(results?'<p class="nsEmpty">לא נמצאו הפסדים ליריבה נמוכה יותר בטבלה המשוחזרת במחזור הזה. שוויון שלא הוכרע אינו נכלל.</p>':'');
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
