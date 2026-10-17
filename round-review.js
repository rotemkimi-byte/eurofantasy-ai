/* Actual round results for the current squad; never substitute an older game. */
(() => {
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const key=n=>lastThreeName(n||'');
const fmt=v=>num(v)===null?'—':Number(v).toFixed(1);
const signed=v=>num(v)===null?'—':`${v>0?'+':''}${Number(v).toFixed(1)}`;
const tone=v=>v>0?'good':v<0?'bad':'muted';
const state={round:null,prices:null,schedule:[],loading:null,error:false,review:false};

function selectRound(schedule,now=Date.now()) {
 const games=(schedule?.data||[]).filter(g=>(!g.season?.code||g.season.code==='E2026')&&g.played===true&&Date.parse(g.utcDate||g.date)<now);
 return games.length?Math.max(...games.map(g=>Number(g.round)).filter(Number.isFinite)):null;
}
function delta(player,prices=state.prices) {
 const before=prices?.get(key(player.name)),after=num(player.price);
 return before==null||after===null?null:Math.round((after-before)*10)/10;
}
function price(player) {
 const d=delta(player),label=state.round?`מאז פתיחת מחזור ${state.round}`:'שינוי מחיר';
 return `<span class="rr-price"><span>${fmt(player.price)} <small>cr</small></span><small class="rr-delta ${tone(d)}" dir="ltr" title="${label}" aria-label="${label}: ${signed(d)} קרדיט">${d===null?'—':`${d>0?'▲ ':d<0?'▼ ':''}${signed(d)} cr`}</small></span>`;
}
function roundGames(entity,round) {return (entity?.games||[]).filter(g=>Number(g.round)===round)}
function totals(games,coach=false) {
 if(!games.length)return {pir:null,points:null};
 if(games.some(g=>!g.dnp&&num(g.value)===null))return {pir:null,points:null};
 return games.reduce((sum,g)=>{
  const value=g.dnp?0:Number(g.value);
  sum.pir+=value;sum.points+=coach?value:value*(g.score>g.against?1.1:1);return sum;
 },{pir:0,points:0});
}
async function loadPrices() {
 if(state.loading)return state.loading;
 state.loading=(async()=>{
  try{
   const schedule=await lastThreeFetch('./data/context/E2026-schedule.json');
   state.schedule=schedule.data||[];state.round=selectRound(schedule);
   if(state.round===null)throw Error('No current-season results');
   const snapshot=await lastThreeFetch(`./data/backtest/predictions-round-${String(state.round).padStart(2,'0')}.json`);
   if(snapshot.season!=='E2026'||Number(snapshot.round)!==state.round)throw Error('Invalid price snapshot');
   // Snapshot must predate the first fixture; never compare against a mid-round price.
   const start=Math.min(...state.schedule.filter(g=>Number(g.round)===state.round).map(g=>Date.parse(g.utcDate||g.date)).filter(Number.isFinite));
   if(!(Date.parse(snapshot.created_at)<start))throw Error('Snapshot is not pre-round');
   state.prices=new Map((snapshot.predictions||[]).filter(p=>num(p.price)!==null).map(p=>[key(p.name),Number(p.price)]));
  }catch(error){state.error=true;console.warn('Round prices unavailable',error)}
  renderMarket();
 })();return state.loading;
}
function renderReviewBody(history) {
 const root=document.getElementById('roundReview'),round=state.round;
 if(!history||round===null){root.innerHTML='<p class="notice">אין כרגע נתוני מחזור זמינים. <button id="rrRetry" class="secondary">נסה שוב</button></p>';return}
 const selected=myTeam.map(n=>players.find(p=>p.name===n)).filter(Boolean);
 const coach=COACHES.find(c=>c.name===squadPreferences.coach);
 const rows=selected.map(p=>({p,coach:false,entity:history.players.get(key(p.name))}));
 if(coach)rows.push({p:coach,coach:true,entity:history.coaches.get(key(coach.name))});
 let pir=0,points=0,change=0,pirCount=0,pointsCount=0,priceCount=0;
 const cards=rows.map(({p,coach,entity})=>{
  const games=roundGames(entity,round),t=totals(games,coach),d=coach?null:delta(p);
  if(!coach&&t.pir!==null){pir+=t.pir;pirCount++}if(t.points!==null){points+=t.points;pointsCount++}if(d!==null){change+=d;priceCount++}
  const fixture=state.schedule.find(g=>Number(g.round)===round&&[g.local?.club?.name,g.road?.club?.name].some(n=>canonicalTeam(n)===canonicalTeam(p.team)));
  const status=games.length?(games.every(g=>g.dnp)?'לא שיחק':games.map(g=>`${g.home?'בית':'חוץ'} מול ${g.opponent}`).join(' · ')):(fixture?.played?'אין נתוני שחקן למחזור הזה':'טרם שיחק במחזור הזה');
  return `<article class="rr-card"><button class="rr-name" ${coach?'':`data-rr-player="${esc(p.name)}"`}><b>${esc(p.name)}</b><small>${esc(p.team)} · ${coach?'מאמן':esc(p.pos)}</small></button><div>${price(p)}</div><p class="muted">${esc(status)}</p><div class="rr-metrics"><div><b>${coach?'—':fmt(t.pir)}</b><small>PIR בפועל</small></div><div><b>${fmt(t.points)}</b><small>נק׳ פנטזי בסיס</small></div><div><b class="${tone(d)}" dir="ltr">${signed(d)}</b><small>שינוי קרדיט</small></div></div></article>`;
 }).join('');
 const fixtures=state.schedule.filter(g=>Number(g.round)===round),complete=fixtures.length>0&&fixtures.every(g=>g.played);
 root.innerHTML=`<h3>מה היה · מחזור ${round}${complete?'':' · בתהליך'}</h3><p class="muted rr-note">הסגל הנוכחי מול תוצאות המחזור. נק׳ פנטזי בסיס כוללות בונוס ניצחון 10%, לפני מכפילי הרכב וקפטן. שינוי מחיר מאז פתיחת המחזור; הוא מתעדכן כשהמחיר בשוק משתנה.</p><div class="rr-summary"><div><b>${pirCount?fmt(pir):'—'}</b><small>סך PIR · ${pirCount}/${selected.length} שחקנים</small></div><div><b>${pointsCount?fmt(points):'—'}</b><small>נק׳ בסיס · ${pointsCount}/${rows.length}</small></div><div><b class="${tone(change)}" dir="ltr">${priceCount?signed(change):'—'}</b><small>שינוי קרדיט · ${priceCount}/${selected.length} שחקנים</small></div></div>${priceCount<selected.length?'<p class="muted rr-note">— מציין נתון חסר; הסיכומים כוללים רק נתונים זמינים.</p>':''}<div class="rr-list">${cards||'<p class="notice">הוסף שחקנים לסגל כדי לראות את תוצאותיהם.</p>'}</div>`;
}
async function renderReview() {
 const root=document.getElementById('roundReview');
 if(!root||!state.review)return;
 root.innerHTML='<p class="notice" role="status">טוען תוצאות המחזור האחרון…</p>';
 await loadPrices();
 try{await window.PIRHistoryUI.load();if(state.review)renderReviewBody(window.PIRHistoryUI.getData())}
 catch(error){if(state.review)renderReviewBody(null)}
}
window.RoundReviewUI={price,delta,selectRound,roundGames,totals};
const originalTeam=renderTeam;
renderTeam=function(){originalTeam();if(state.review)void renderReview()};
document.getElementById('teamView').addEventListener('click',e=>{
 const button=e.target.closest('[data-team-view]');if(!button)return;
 state.review=button.dataset.teamView==='review';
 document.querySelectorAll('[data-team-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.getElementById('teamCards').hidden=state.review;
 document.getElementById('roundReview').hidden=!state.review;
 if(state.review)void renderReview();
});
document.getElementById('roundReview').addEventListener('click',e=>{
 const player=e.target.closest('[data-rr-player]');if(player)showPlayer(player.dataset.rrPlayer);
 if(e.target.id==='rrRetry'){state.loading=null;state.error=false;lastThreeRequests.delete('./data/context/E2026-schedule.json');void renderReview()}
});
void loadPrices();
})();
