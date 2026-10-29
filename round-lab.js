/* Historical bargains and proven best fixed fantasy lineups, from round-lab.json. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const fmt=v=>num(v)===null?'—':Number(v).toFixed(1);
const key=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)?.sort().join(' ')||'';
function bargainRows(report,{min=0,max=9.9,minPir=15,pos='',sort='points',current=false}={}){
 return (report?.players||[]).filter(p=>['G','F','C'].includes(p.pos)&&p.played&&num(p.pir)!==null&&p.pir>=minPir&&(!pos||p.pos===pos)&&num(current?p.currentPrice:p.price)!==null&&(current?p.currentPrice:p.price)>=min&&(current?p.currentPrice:p.price)<=max).slice().sort((a,b)=>sort==='price'?(current?a.currentPrice-b.currentPrice:a.price-b.price)||b.points-a.points:sort==='ratio'?b.points/(current?b.currentPrice:b.price)-a.points/(current?a.currentPrice:a.price):b[sort]-a[sort]||a.price-b.price||a.name.localeCompare(b.name));
}
function nextFixture(player,market){
 const current=(market||[]).find(p=>key(p.name)===key(player.name));
 if(!current?.opponent)return null;
 return {name:current.opponent,home:current.home===true||Number(current.home)===1};
}
window.RoundLabCore={bargainRows,nextFixture};
const nav=document.querySelector('.tabs'),main=document.querySelector('main');if(!nav||!main)return;
nav.insertAdjacentHTML('beforeend','<button type="button" data-tab="bargains">מציאות</button><button type="button" data-tab="superSquad">סופר סגל</button>');
main.insertAdjacentHTML('beforeend',`<section id="bargains" class="tab roundLab"><div class="card"><div class="sectionHead"><div><h3>מציאות המחזור</h3><p class="muted rlHelp">מי כיכב במחיר נמוך? ביצועים בפועל בלבד, ללא תחזיות.</p></div><button type="button" class="secondary" data-rl-reload>רענן</button></div><div class="rlFilters"><label>מחזור<select id="bargainRound"></select></label><label>טווח מחיר<select id="bargainRange"><option value="0,9.9">פחות מ־10 קרדיט</option><option value="4,6">4–6 קרדיט</option><option value="6,9">6–9 קרדיט</option><option value="9,9.9">9 עד פחות מ־10</option><option value="custom">טווח אישי</option></select></label><label>ממחיר<input id="bargainMin" type="number" min="0" max="100" step=".1" value="0" disabled></label><label>עד מחיר<input id="bargainMax" type="number" min="0" max="100" step=".1" value="9.9" disabled></label><div class="rlPirControl"><span>מינימום PIR</span><details class="rlPirPicker"><summary><output id="bargainPirValue" for="bargainPir">15</output><span class="rlSliderHint">שנה סף ▾</span></summary><label class="rlSliderPanel">בחירת מינימום PIR<input id="bargainPir" type="range" min="-20" max="60" step="1" value="15"><span class="rlSliderEnds"><span>−20</span><span>60</span></span></label></details></div><label>עמדה<select id="bargainPos"><option value="">כל העמדות</option><option value="G">גארדים</option><option value="F">פורוורדים</option><option value="C">סנטרים</option></select></label><label>איזה מחיר?<select id="bargainPrice"><option value="round">לפני המחזור</option><option value="current">מחיר כעת</option></select></label><label>מיון<select id="bargainSort"><option value="points">נקודות פנטזי בפועל</option><option value="pir">PIR בפועל</option><option value="price">מחיר: מהנמוך לגבוה</option></select></label></div><p class="muted rlHelp">„כיכב” מוגדר כאן כ־15 PIR ומעלה; אפשר לשנות את הסף. טווחי 4–6 ו־6–9 כוללים את שני הקצוות.</p><p id="bargainStatus" class="rlStatus" role="status" aria-live="polite"></p><div id="bargainList" class="rlGrid"></div></div></section><section id="superSquad" class="tab roundLab"><div class="card"><div class="sectionHead"><div><h3>סופר סגל · המקסימום בדיעבד</h3><p class="muted rlHelp">הקומבינציה הטובה ביותר לפי התוצאות שהושגו במחזור.</p></div><button type="button" class="secondary" data-rl-reload>רענן</button></div><div class="rlFilters"><label>מחזור<select id="superRound"></select></label><label>תקציב כולל מאמן<select id="superBudget"><option value="100">100 קרדיט</option></select></label></div><p class="muted rlHelp">4 גארדים, 4 פורוורדים, 2 סנטרים ומאמן, בחמישייה חוקית: קפטן ×2, שחקן שישי ×1, ארבעה מחליפים ×0.5 ומאמן ×1. החישוב בוחר סגל והרכב קבוע בדיעבד, ללא חילופים בין ימי המחזור וללא בוסטרים. המחיר הוא המחיר המתועד לפני תחילת המחזור.</p><p class="rlHelp muted"><a href="https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules" target="_blank" rel="noopener">כללי הניקוד</a> · עד 6 נציגים לקבוצה. „ללא הגבלת תקציב” מראה את תקרת הניקוד של הסגל הזמין.</p><p id="superStatus" class="rlStatus" role="status" aria-live="polite"></p><div id="superResult"></div></div></section>`);
let data=null,loading=null,lastLoaded=0;
function report(id){return data?.rounds.find(r=>String(r.round)===$(id).value)}
function activate(button){document.querySelectorAll('.tabs button,.tab').forEach(el=>el.classList.remove('active'));button.classList.add('active');$(button.dataset.tab).classList.add('active');window.scrollTo({top:70,behavior:'smooth'});if(!data||Date.now()-lastLoaded>60000)void load();else render();}
for(const id of ['bargains','superSquad'])document.querySelector(`[data-tab="${id}"]`).onclick=e=>activate(e.currentTarget);
function price(p){return `<span>מחיר במחזור <b>${fmt(p.price)}</b> cr</span><span>מחיר כעת <b>${fmt(p.currentPrice)}</b> cr</span>`}
function creditChange(p){
 const before=num(p.price),now=num(p.currentPrice);
 if(before===null||now===null)return '<span class="rlCreditChange rlCreditUnknown">שינוי קרדיט לא זמין</span>';
 const delta=Math.round((now-before)*10)/10;
 return `<span class="rlCreditChange ${delta>0?'rlCreditUp':delta<0?'rlCreditDown':'rlCreditFlat'}"><b dir="ltr">${delta>0?'+':''}${fmt(delta)} cr</b><small>שינוי מהמחיר המקורי למחיר הנוכחי</small></span>`;
}
function playerButton(p){return `<button class="rlName" data-rl-player="${esc(p.id)}"><bdi>${esc(p.name)}</bdi></button>`}
function opponent(p){return (p.opponents||[]).map(g=>`${g.home?'בית':'חוץ'} מול ${esc(g.name)}`).join(' · ')}
function nextOpponent(p){
 const fixture=nextFixture(p,typeof players==='undefined'?[]:players);
 const upcoming=fixture?`${fixture.home?'בית':'חוץ'} מול ${esc(fixture.name)}`:'יריבה טרם זמינה';
 return `<b>המשחק הבא: ${upcoming}</b><br><small class="muted">במחזור שנבחר: ${opponent(p)||'אין יריבה מתועדת'}</small>`;
}
function caveat(r){return `${r.complete?'מחזור סופי':'מחזור חלקי · המוביל כרגע עשוי להשתנות'} · ${r.playedGames}/${r.totalGames} משחקים${r.missingBoxes.length?' · חסרים '+r.missingBoxes.length+' דוחות משחק':''}${r.unknownPrices?' · '+r.unknownPrices+' משתתפים ללא מחיר מתועד לא נכללו':''}`}
function renderBargains(){
 const r=report('bargainRound');if(!r)return;
 const min=num($('bargainMin').value),max=num($('bargainMax').value),minPir=num($('bargainPir').value);
 if(min===null||max===null||minPir===null||min<0||max<min){$('bargainStatus').textContent='יש להזין טווח מחיר תקין וסף PIR.';$('bargainList').innerHTML='';return}
 const current=$('bargainPrice').value==='current',rows=bargainRows(r,{min,max,minPir,pos:$('bargainPos').value,sort:$('bargainSort').value,current});
 $('bargainStatus').textContent=`מחזור ${r.round} · ${rows.length} מציאות · ${caveat(r)}`;
 $('bargainList').innerHTML=rows.map((p,i)=>`<article class="rlPlayer"><div class="rlHead"><span class="rlRank">${i+1}</span><div>${playerButton(p)}<small class="rlPlayerInfo"><bdi>${esc(p.team)}</bdi> · ${{G:"גארד",F:"פורוורד",C:"סנטר"}[p.pos]||esc(p.pos)}</small></div></div><p class="rlOpponent">${nextOpponent(p)}</p><div class="rlMetrics"><div><b>${fmt(p.pir)}</b><small>PIR בפועל</small></div><div><b>${fmt(p.currentPrice)}</b><small>מחיר נוכחי · cr</small></div><div><b>${fmt(p.minutes)}</b><small>דקות</small></div></div><div class="rlPrices rlBargainPrices"><span>מחיר קודם <b>${fmt(p.price)}</b> cr</span>${creditChange(p)}</div></article>`).join('')||'<p class="notice">אין שחקנים בטווח ובסף שבחרת. נסה להרחיב את טווח המחיר או להוריד את סף ה־PIR.</p>';
}
function renderSuper(){
 const r=report('superRound');if(!r)return;
 const solution=r.solutions[$('superBudget').value];
 $('superStatus').textContent=`מחזור ${r.round} · ${caveat(r)}`;
 if(!solution||!['optimal','feasible'].includes(solution.status)){$('superResult').innerHTML=`<p class="notice">${esc(solution?.reason||'אין חישוב זמין לתקציב הזה.')}</p>`;return}
 const byId=new Map(r.players.map(p=>[p.id,p]));
 const tile=row=>{
  const p=byId.get(row.id);if(!p)return '';
  return `<article class="rlPlayer ${row.role==='captain'?'rlCaptain':''}"><div class="rlRole">${({captain:'קפטן · ×2',starter:'חמישייה · ×1',sixth:'שחקן שישי · ×1',bench:'ספסל · ×0.5',coach:'מאמן · ×1'})[row.role]}</div><div class="rlHead">${typeof squadJersey==='function'?squadJersey(p,p.pos==='H'):''}<div>${playerButton(p)}<small>${esc(p.team)} · ${p.pos==='H'?'מאמן':esc(p.pos)}</small></div></div><p class="rlOpponent">${opponent(p)}</p><div class="rlMetrics"><div><b>${fmt(p.points)}</b><small>נק׳ בסיס</small></div><div><b>${fmt(row.contribution)}</b><small>תרומה לסגל</small></div><div><b>${fmt(p.price)}</b><small>קרדיט במחזור</small></div></div></article>`;
 };
 const group=(title,roles)=>`<h4 class="rlGroupTitle">${title}</h4><div class="rlGrid">${solution.roster.filter(r=>roles.includes(r.role)).sort((a,b)=>b.contribution-a.contribution).map(tile).join('')}</div>`;
 $('superResult').innerHTML=`<div class="rlSummary"><div><b>${fmt(solution.score)}</b><small>נקודות פנטזי לסגל</small></div><div><b>${fmt(solution.cost)}</b><small>עלות כולל מאמן</small></div><div><b>${solution.formation.join('–')}</b><small>מערך G–F–C</small></div></div><p class="rlHelp ${solution.status==='optimal'?'good':'warn'}">${solution.status==='optimal'?'נמצא מקסימום מתמטי לפי הנתונים הזמינים והתקציב שנבחר.':'זה הסגל הטוב ביותר שנמצא בזמן החישוב; טרם הוכח שהוא המקסימום.'}${r.complete?'':' המחזור עדיין חלקי.'}</p>${group('החמישייה · כולל קפטן',['starter','captain'])}${group('השחקן השישי והמאמן',['sixth','coach'])}${group('ארבעת שחקני הספסל',['bench'])}<p class="muted rlHelp">נק׳ בסיס לשחקנים הן PIR ובונוס ניצחון 10%; תרומה לסגל כוללת את מכפיל התפקיד. התוצאה מחושבת מתוך המשתתפים עם מחיר וניקוד זמינים ואינה תחזית למחזור הבא.</p>`;
}
function render(){renderBargains();renderSuper()}
function selectors(){
 const rounds=data.rounds.slice().sort((a,b)=>b.round-a.round);
 for(const id of ['bargainRound','superRound']){const selected=$(id).value;$(id).replaceChildren(...rounds.map(r=>new Option(`מחזור ${r.round}${r.complete?'':' · חלקי'}`,r.round)));if(rounds.some(r=>String(r.round)===selected))$(id).value=selected}
 const selected=$('superBudget').value;$('superBudget').replaceChildren(...data.budgets.map(b=>new Option(b===null?'ללא הגבלת תקציב':`${b} קרדיט`,b===null?'unlimited':String(b))));if([...$('superBudget').options].some(o=>o.value===selected))$('superBudget').value=selected;else $('superBudget').value='100';
}
async function load(){
 if(loading)return loading;
 for(const id of ['bargainStatus','superStatus'])$(id).textContent='טוען תוצאות, מחירי המחזור וסגלים…';
 loading=(async()=>{try{
  const response=await fetch('./data/round-lab.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('missing report');const result=await response.json();
  if(result.season!=='E2026'||result.version!==1||!Array.isArray(result.rounds)||!result.rounds.length)throw Error('invalid report');
  data=result;lastLoaded=Date.now();selectors();render();
  if(typeof window.refreshFantasyLive==='function')await window.refreshFantasyLive();
  renderBargains();
 }catch(error){for(const id of ['bargainStatus','superStatus'])$(id).textContent='הנתונים לא נטענו. נסה ללחוץ על רענן; לאחר התקנה ראשונית יש להמתין לסיום החישוב.';if(!data){$('superResult').innerHTML='';$('bargainList').innerHTML=''}}finally{loading=null}})();return loading;
}
$('bargainPir').addEventListener('input',()=>{$('bargainPirValue').textContent=$('bargainPir').value;renderBargains()});
$('bargainRange').onchange=()=>{const custom=$('bargainRange').value==='custom';$('bargainMin').disabled=!custom;$('bargainMax').disabled=!custom;if(!custom){const [lo,hi]=$('bargainRange').value.split(',');$('bargainMin').value=lo;$('bargainMax').value=hi}renderBargains()};
for(const id of ['bargainRound','bargainMin','bargainMax','bargainPir','bargainPos','bargainPrice','bargainSort'])$(id).addEventListener('change',renderBargains);
for(const id of ['superRound','superBudget'])$(id).addEventListener('change',renderSuper);
for(const button of document.querySelectorAll('[data-rl-reload]'))button.onclick=()=>void load();
for(const id of ['bargains','superSquad'])$(id).addEventListener('click',event=>{
 const button=event.target.closest('[data-rl-player]');if(!button)return;
 const player=typeof players==='undefined'?null:players.find(p=>key(p.name)===button.dataset.rlPlayer);
 if(player&&typeof showPlayer==='function')showPlayer(player.name);
});
document.addEventListener('fantasy-live-updated',()=>{if(data)renderBargains()});
const active=()=>['bargains','superSquad'].some(id=>$(id).classList.contains('active'));
setInterval(()=>{if(!document.hidden&&active())void load()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active()&&Date.now()-lastLoaded>60000)void load()});
})();

