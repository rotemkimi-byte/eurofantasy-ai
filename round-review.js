/* Actual round results for the current squad; never substitute an older game. */
(() => {
'use strict';
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const key=n=>lastThreeName(n||'');
const fmt=v=>num(v)===null?'—':Number(v).toFixed(1);
const signed=v=>num(v)===null?'—':`${v>0?'+':''}${Number(v).toFixed(1)}`;
const tone=v=>v>0?'good':v<0?'bad':'muted';
const state={round:null,priceRound:null,prices:null,schedule:[],loading:null,error:false,review:false};

function selectRound(schedule,now=Date.now()) {
 const games=(schedule?.data||[]).filter(g=>(!g.season?.code||g.season.code==='E2026')&&g.played===true&&Date.parse(g.utcDate||g.date)<now);
 return games.length?Math.max(...games.map(g=>Number(g.round)).filter(Number.isFinite)):null;
}
function priceBaseline(meta) {
 const round=num(meta?.matchday_number);return Number.isInteger(round)&&round>1?round-1:null;
}
function delta(player,prices=state.prices) {
 const before=prices?.get(key(player.name)),after=num(player.price);
 return before==null||after===null?null:Math.round((after-before)*10)/10;
}
function price(player) {
 const d=delta(player),label=state.priceRound?`שינוי מחיר ממחזור ${state.priceRound-1} למחזור ${state.priceRound}`:'שינוי מחיר';
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
   const [schedule,meta]=await Promise.all([lastThreeFetch('./data/context/E2026-schedule.json'),lastThreeFetch('./data/meta.json')]);
   state.schedule=schedule.data||[];state.round=selectRound(schedule);
   if(state.round===null)throw Error('No current-season results');
   const baseline=priceBaseline(meta);state.priceRound=num(meta.matchday_number);
   if(baseline===null)throw Error('No previous market round');
   const snapshot=await lastThreeFetch(`./data/backtest/predictions-round-${String(baseline).padStart(2,'0')}.json`);
   if(snapshot.season!=='E2026'||Number(snapshot.round)!==baseline)throw Error('Invalid price snapshot');
   // Snapshot must predate the first fixture; never compare against a mid-round price.
   const start=Math.min(...state.schedule.filter(g=>Number(g.round)===baseline).map(g=>Date.parse(g.utcDate||g.date)).filter(Number.isFinite));
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
 const cards=new Map(rows.map(({p,coach,entity})=>{
  const games=roundGames(entity,round),t=totals(games,coach),d=coach?null:delta(p);
  if(!coach&&t.pir!==null){pir+=t.pir;pirCount++}if(t.points!==null){points+=t.points;pointsCount++}if(d!==null){change+=d;priceCount++}
  const fixture=state.schedule.find(g=>Number(g.round)===round&&[g.local?.club?.name,g.road?.club?.name].some(n=>canonicalTeam(n)===canonicalTeam(p.team)));
  const status=games.length?(games.every(g=>g.dnp)?'לא שיחק':games.map(g=>`${g.home?'בית':'חוץ'} מול ${g.opponent}`).join(' · ')):(fixture?.played?'אין נתוני שחקן למחזור הזה':'טרם שיחק במחזור הזה');
  return [p.name,`<article class="rr-card"><button class="rr-name" ${coach?'':`data-rr-player="${esc(p.name)}"`}><b>${squadJersey(p,coach)}${esc(p.name)}</b><small>${esc(p.team)} · ${coach?'מאמן':esc(p.pos)}</small></button><div>${price(p)}</div><p class="muted">${esc(status)}</p><div class="rr-metrics"><div><b>${coach?'—':fmt(t.pir)}</b><small>PIR בפועל</small></div><div><b>${fmt(t.points)}</b><small>נק׳ פנטזי בסיס</small></div><div><b class="${tone(d)}" dir="ltr">${signed(d)}</b><small>שינוי קרדיט</small></div></div></article>`];
 }));
 const basket=selected.filter(p=>['G','F','C'].includes(p.pos));
 const {slots,bench}=squadArrangement(basket);
 const tile=(p,slot)=>p?cards.get(p.name):`<div class="squadEmpty"><span>${slot<5?SQUAD_SLOTS[slot][1]:'שחקן שישי'}</span></div>`;
 const court=`<div class="rr-board"><div class="squadCourt rr-court"><div class="squadCourtLines" aria-hidden="true"></div><div class="squadCourtRow squadCenter">${tile(slots[0],0)}</div><div class="squadCourtRow">${tile(slots[1],1)}${tile(slots[2],2)}</div><div class="squadCourtRow">${tile(slots[3],3)}${tile(slots[4],4)}</div></div><div class="rr-lower"><section><h4>שחקן שישי</h4>${tile(slots[5],5)}<h4>מאמן</h4>${coach?cards.get(coach.name):'<p class="muted">לא נבחר מאמן</p>'}</section><section><h4>ספסל</h4><div class="rr-bench">${bench.map(p=>tile(p,'bench')).join('')||'<p class="muted">אין שחקני ספסל</p>'}</div></section></div></div>`;
 const fixtures=state.schedule.filter(g=>Number(g.round)===round),complete=fixtures.length>0&&fixtures.every(g=>g.played);
 root.innerHTML=`<h3>מה היה · מחזור ${round}${complete?'':' · בתהליך'}</h3><p class="muted rr-note">הסגל הנוכחי מול תוצאות המחזור. נק׳ פנטזי בסיס כוללות בונוס ניצחון 10%, לפני מכפילי הרכב וקפטן. ${state.prices?`שינוי המחיר האחרון שפורסם: ממחזור ${state.priceRound-1} למחזור ${state.priceRound}. ${state.priceRound<=round?'המחירים עבור תוצאות מחזור זה טרם פורסמו.':''}`:'נתוני שינוי המחיר אינם זמינים כרגע.'} סידור השחקנים הוא לפי ההרכב הנוכחי.</p><div class="rr-summary"><div><b>${pirCount?fmt(pir):'—'}</b><small>סך PIR · ${pirCount}/${selected.length} שחקנים</small></div><div><b>${pointsCount?fmt(points):'—'}</b><small>נק׳ בסיס · ${pointsCount}/${rows.length}</small></div><div><b class="${tone(change)}" dir="ltr">${priceCount?signed(change):'—'}</b><small>שינוי קרדיט · ${priceCount}/${selected.length} שחקנים</small></div></div>${priceCount<selected.length?'<p class="muted rr-note">— מציין נתון חסר; הסיכומים כוללים רק נתונים זמינים.</p>':''}${rows.length?court:'<p class="notice">הוסף שחקנים לסגל כדי לראות את תוצאותיהם.</p>'}`;
}
async function renderReview() {
 const root=document.getElementById('roundReview');
 if(!root||!state.review)return;
 root.innerHTML='<p class="notice" role="status">טוען תוצאות המחזור האחרון…</p>';
 await loadPrices();
 try{await window.PIRHistoryUI.load();if(state.review)renderReviewBody(window.PIRHistoryUI.getData())}
 catch(error){if(state.review)renderReviewBody(null)}
}
window.RoundReviewUI={price,delta,selectRound,roundGames,totals,priceBaseline,renderReviewBody,loadPrices};
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
 if(e.target.id==='rrRetry'){state.loading=null;state.error=false;lastThreeRequests.delete('./data/context/E2026-schedule.json');lastThreeRequests.delete('./data/meta.json');void renderReview()}
});
const css=document.createElement('style');css.textContent='\n.rr-court .rr-card{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:calc(50% - 7px);max-width:210px;min-width:0;padding:8px 5px;background:#fffffff0;color:#25133c;text-align:center;border-color:#ffffffb0;gap:7px;box-shadow:0 4px 10px #0002}.rr-card .squadJersey{display:block;margin:0 auto 5px;width:58px;height:72px}.rr-court .rr-name{color:#25133c;text-align:center;font-size:12px}.rr-court .rr-name small,.rr-court .muted,.rr-court .rr-metrics small{color:#675978}.rr-court .rr-price{align-items:center;text-align:center}.rr-court .rr-price>span{color:#116c4e}.rr-court .good{color:#087c4c}.rr-court .bad{color:#c42535}.rr-court .rr-metrics{width:100%;grid-template-columns:1fr 1fr}.rr-court .rr-metrics>div{background:#f0edf5}.rr-court .rr-metrics>div:last-child{grid-column:1/-1}.rr-court .rr-metrics b{font-size:20px}.rr-court .rr-card>p{font-size:9px}.rr-court .squadCourtRow{display:flex;justify-content:center;align-items:start;gap:12px}.rr-court .squadCenter .rr-card{width:55%}.rr-lower{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.rr-lower>section{min-width:0}.rr-lower .rr-card{display:flex;flex-direction:column;text-align:center;padding:10px 6px}.rr-lower .rr-name{text-align:center;font-size:11px}.rr-lower .rr-price{align-items:center;text-align:center}.rr-lower .rr-metrics{grid-template-columns:1fr 1fr}.rr-lower .rr-metrics>div:last-child{grid-column:1/-1}.rr-bench{display:grid;gap:10px}.rr-lower h4{margin:10px 0;color:var(--accent)}.rr-lower .rr-card>p{font-size:10px}.rr-lower .rr-metrics b{font-size:18px}@media(max-width:400px){.rr-court .rr-name{font-size:11px}.rr-court .rr-price small{font-size:10px}.rr-court .rr-metrics small{font-size:9px}}\n';document.head.appendChild(css);
void loadPrices();
})();
