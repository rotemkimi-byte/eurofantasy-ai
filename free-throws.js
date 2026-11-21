(function(root){
'use strict';
const num=v=>v==null||v===''||!Number.isFinite(Number(v))||Number(v)<0?null:Number(v);
function select(games,range){const seen=new Map();for(const g of games||[])if(Date.parse(g.date)<=Date.now())seen.set(g.gameCode??g.code,g);const rows=[...seen.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||Number(b.gameCode??b.code)-Number(a.gameCode??a.code));return Number(range)>0?rows.slice(0,Number(range)):rows;}
function summary(games,includeOpponent=false){const played=games.filter(g=>g.minutes===undefined||num(g.minutes)>0);const attempts=played.filter(g=>num(g.stats?.freeThrowsAttempted)!==null);const pairs=attempts.filter(g=>num(g.stats?.freeThrowsMade)!==null&&Number(g.stats.freeThrowsMade)<=Number(g.stats.freeThrowsAttempted));const fouls=played.filter(g=>num(g.stats?.foulsReceived)!==null);const sum=(rows,k)=>rows.reduce((s,g)=>s+Number(g.stats[k]),0);const a=sum(pairs,'freeThrowsAttempted');
 const against=includeOpponent?played.map(g=>num(g.opponentStats?.foulsReceived)).filter(v=>v!==null):[];
 const opponentFouls=against.length?against.reduce((total,value)=>total+value,0)/against.length:null;
 const committed=played.filter(g=>num(g.stats?.foulsCommited)!==null);
 return {games:played.length,registered:games.length,fta:attempts.length?sum(attempts,'freeThrowsAttempted')/attempts.length:null,ftm:pairs.length?sum(pairs,'freeThrowsMade')/pairs.length:null,pct:a>0?100*sum(pairs,'freeThrowsMade')/a:null,fouls:fouls.length?sum(fouls,'foulsReceived')/fouls.length:null,coverage:[attempts.length,pairs.length,fouls.length],made:sum(pairs,'freeThrowsMade'),attempts:a,opponentFouls,opponentFoulsGames:against.length,
  foulsCommitted:committed.length?sum(committed,'foulsCommited')/committed.length:null,foulsCommittedGames:committed.length};}
// Missing values sort last; canonical team IDs provide a deterministic tie break.
function rank(rows,metric){return rows.slice().sort((a,b)=>{
 const av=a.s[metric],bv=b.s[metric];
 if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;
 return (bv??0)-(av??0)||String(a.id).localeCompare(String(b.id));
});}
const api={select,summary,rank};if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}root.FreeThrowsCore=api;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const fmt=n=>n===null?'—':n.toFixed(1),pct=n=>n===null?'—':fmt(n)+'%';
const style=document.createElement('style');style.textContent=`
.ft-screen{--ft-bg:#fff;--ft-soft:#f2f5f9;--ft-ink:#142237;--ft-muted:#526176;--ft-line:#b9c5d4;--ft-accent:#006b4c;--ft-on:#e2f6ee;color:var(--ft-ink)}
html[data-theme="dark"] .ft-screen{--ft-bg:#162237;--ft-soft:#203149;--ft-ink:#f4f7fc;--ft-muted:#c0cde0;--ft-line:#667b98;--ft-accent:#76efbe;--ft-on:#153f36}
#playerFreeThrows .card,#teamFreeThrows .card{background:var(--ft-bg);color:var(--ft-ink)}
.ft-screen .ft-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:12px 0}
.ft-screen input,.ft-screen select{width:100%;min-width:0;min-height:44px;font-size:16px;background:var(--ft-bg);color:var(--ft-ink);border-color:var(--ft-line);margin-top:5px}
.ft-screen input::placeholder{color:var(--ft-muted);opacity:1}.ft-screen label,.ft-screen small{color:var(--ft-muted)}
#playerFreeThrows button:not(.player-picker-modes button,.pa-profile-link),#teamFreeThrows button:not(.player-picker-modes button){background:var(--ft-soft);color:var(--ft-ink);border:1px solid var(--ft-line);min-height:44px}
#playerFreeThrows button bdi,#teamFreeThrows button bdi{color:inherit}
.ft-screen [hidden]{display:none!important}.ft-screen :focus-visible{outline:3px solid var(--ft-accent);outline-offset:3px}
.ft-screen .ft-detail{scroll-margin-top:100px}.ft-screen .ft-profile{border:2px solid var(--ft-accent);background:var(--ft-bg);border-radius:16px;padding:14px;margin:16px 0}
.ft-screen .ft-profile h3{font-size:22px;margin:0 0 5px;overflow-wrap:anywhere;color:var(--ft-ink)}
.ft-screen .ft-records{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin:12px 0}
.ft-screen .ft-record{min-width:0;background:var(--ft-bg);border:1px solid var(--ft-line);border-radius:14px;padding:12px}
.ft-screen .ft-record h4{margin:0;font-size:17px;overflow-wrap:anywhere;color:var(--ft-ink)}
.ft-screen .ft-record small{display:block}.ft-screen .ft-record .ft-pick{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:right;padding:10px;font-size:16px;font-weight:800}
.ft-screen .ft-pick span{font-size:12px;color:var(--ft-accent);white-space:nowrap}.ft-screen .ft-record [aria-pressed="true"]{border:2px solid var(--ft-accent)!important;background:var(--ft-on)!important}
.ft-screen summary{cursor:pointer;color:var(--ft-ink);font-weight:750;min-height:44px;padding:12px 0}.ft-screen .ft-status{font-size:12px;color:var(--ft-muted);margin:12px 0;line-height:1.5}
.ft-screen .ft-empty{background:var(--ft-soft);padding:16px;border-radius:12px;color:var(--ft-ink)}
`;document.head.append(style);
let data=null,pending=null;
async function load(force=false){if(data&&!force)return data;if(pending)return pending;pending=(async()=>{const d=await (root.loadGameData?root.loadGameData('official-offense.json',force):(async()=>{const r=await fetch('./data/official-offense.json?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const d=await r.json();return d;})());if(d.season!=='E2026'||!d.players||!d.teamResults)throw Error();data=d;return d;})().finally(()=>pending=null);return pending;}
const ranges={'1':'משחק אחרון','3':'3 משחקים אחרונים','0':'כל העונה · 2026/27'};
const date=d=>new Date(d).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'});
const key = value => globalThis.PlayerIdentity.key(value);
function metrics(s,isTeam){const items=[['ניסיונות למשחק',fmt(s.fta),`${s.coverage[0]}/${s.games} הופעות עם נתון`],['קליעות למשחק',fmt(s.ftm),`${s.coverage[1]}/${s.games} הופעות עם נתון`],['דיוק מהקו',pct(s.pct),s.coverage[1]?`${s.made} קליעות מתוך ${s.attempts} זריקות`:'אין נתון זמין'],['עבירות שסחט למשחק',fmt(s.fouls),`${s.coverage[2]}/${s.games} הופעות עם נתון`]];
 if(isTeam)items.push(['עבירות שיריבות סחטו למשחק',fmt(s.opponentFouls),`${s.opponentFoulsGames}/${s.games} משחקים עם נתון`]);
 else items.push(['עבירות שביצע למשחק',fmt(s.foulsCommitted),`${s.foulsCommittedGames}/${s.games} הופעות עם נתון`]);
 if(!isTeam)return root.PlayerAnalysis.metrics([items[0],items[2],items[3],items[1],[...items[4],s.foulsCommitted>0?'negative':'']]);
 return root.PlayerAnalysis.metrics(items);}
for(const isTeam of [false,true]){
 const id=isTeam?'teamFreeThrows':'playerFreeThrows',button=document.createElement('button');button.dataset.tab=id;button.textContent='עונשין';document.querySelector('.tabs').append(button);
 const section=document.createElement('section');section.id=id;section.className='tab ft-screen';section.innerHTML=`<div class="card"><div class="sectionHead"><h3>עונשין · ${isTeam?'קבוצות':'שחקנים'}</h3><button data-reload>רענן</button></div>${isTeam?'':'<div class="player-picker-modes" role="group" aria-label="אופן בחירת שחקן"><button data-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button><button data-scope="team" aria-pressed="false">לפי קבוצה</button></div>'}<div class="ft-controls player-picker-controls"><label data-team-label hidden>קבוצה<select data-team></select></label>${isTeam?'<label>חיפוש קבוצה<input type="search" data-search placeholder="שם קבוצה"></label>':''}<label>${isTeam?'בחר קבוצה':'בחר שחקן · לפי מחיר'}<select data-entity><option value="">בחר מהרשימה</option></select></label><label>טווח הנתונים<select data-range>${Object.entries(ranges).map(([v,l])=>`<option value="${v}" ${v==='1'?'selected':''}>${l}</option>`).join('')}</select></label></div><p class="ft-status" role="status"></p><div class="ft-detail" data-detail></div>${isTeam?`<details data-league open><summary>כל הקבוצות · לחץ לבחירה</summary>
 <label>דירוג מהגבוה לנמוך לפי<select data-sort><option value="fta">ניסיונות עונשין למשחק</option><option value="ftm">קליעות עונשין למשחק</option><option value="pct">אחוזי דיוק</option><option value="fouls">עבירות שסחט</option><option value="opponentFouls">עבירות שיריבות סחטו</option></select></label>
 <div class="ft-records" data-ranking></div></details>`:''}<details class="pa-disclosure" data-disclosure="help"><summary>הסבר המדדים</summary><p>ניסיונות וקליעות הם ממוצעים למשחק עם נתון זמין. דיוק מחושב מסך הקליעות חלקי סך הניסיונות. עבירות שסחט כוללות גם עבירות שלא הובילו לזריקות. אי־השתתפות אינה אפס ואינה נכנסת לממוצע. הטווח מבוסס על הרישומים האחרונים; בפירוט לפי יריבה נבחרים המשחקים האחרונים מולה.</p></details></div>`;document.querySelector('main').append(section);
 const $=s=>section.querySelector(s);
 if(isTeam)$('[data-sort]').value='opponentFouls';
 if(!isTeam)document.addEventListener('fantasy-player-media-ready',()=>{if(chosen)detail();analytics.render();});
 if(isTeam)document.addEventListener('fantasy-player-media-ready',()=>{if(data)render();});
 const summarize=games=>summary(games,isTeam),showMetrics=s=>metrics(s,isTeam);
 let records=[],chosen='',scope='all';
 const analytics=isTeam?null:root.PlayerAnalysis.mount(section,$('.ft-controls'),$('.ft-status'),[$('[data-detail]')],{
  metrics:{fta:'ניסיונות למשחק',ftm:'קליעות למשחק',pct:'דיוק מהקו',fouls:'עבירות שסחט למשחק',foulsCommitted:'עבירות שביצע למשחק'},
  comparisonScale:{pct:100},
  team:()=>scope==='team'?$('[data-team]').value:'',
  rows:()=>records.map(r=>({...r,values:summarize(select(r.games,$('[data-range]').value))})),
  format:(n,metric)=>metric==='pct'?pct(n):fmt(n)
 });
 const syncRange=isTeam?null:window.PerformanceControls.mount(section,$('[data-range]'));
 function filtered(){const q=$('[data-search]')?.value.trim().toLowerCase();return records.filter(r=>(scope==='all'||r.team===$('[data-team]').value)&&(!q||(r.name+' '+r.team).toLowerCase().includes(q)));}
 function controls(){const old=$('[data-team]').value,teams=[...new Set(records.map(r=>r.team).filter(Boolean))].sort();$('[data-team]').innerHTML='<option value="">בחר קבוצה</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(teams.includes(old))$('[data-team]').value=old;$('[data-team-label]').hidden=isTeam||scope!=='team';const rows=filtered().sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));$('[data-entity]').innerHTML=`<option value="">${isTeam?'בחר קבוצה':'בחר שחקן'}</option>`+rows.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}${!isTeam?' · '+esc(r.team)+(r.price!==null?' · '+fmt(r.price)+' CR':''):''}</option>`).join('');if(rows.some(r=>r.id===chosen))$('[data-entity]').value=chosen;section.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));}
 function rankingTable(rows,sort){
  const labels={opponentFouls:'עבירות שיריבות סחטו',fouls:'עבירות שסחטה',fta:'ניסיונות עונשין',ftm:'קליעות עונשין',pct:'דיוק מהקו'};
  // Five compact columns keep the ranking readable at 375px. Full metrics stay in team details.
  const extras=sort==='fta'?['ftm','pct']:sort==='pct'?['ftm','fta']:['fta','pct'],format=(v,k)=>k==='pct'?pct(v):fmt(v);
  return `<table class="fc-table"><caption>${labels[sort]} · ${sort==='pct'?'אחוזים':'ממוצע למשחק'} · מהגבוה לנמוך</caption><thead><tr><th scope="col">#</th><th scope="col">קבוצה</th><th scope="col" aria-sort="descending">${labels[sort]}${sort==='pct'?' %':' למשחק'}</th>${extras.map(extra=>`<th scope="col">${labels[extra]}${extra==='pct'?' %':' למשחק'}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr data-pick="${esc(r.id)}" aria-selected="${chosen===r.id}"><td>${i+1}</td><td><button type="button" class="fc-team-pick" data-pick="${esc(r.id)}" aria-pressed="${chosen===r.id}" aria-label="פרטי ${esc(r.name)}">${root.FantasyCompactUI.teamLogo(r.name)}<bdi>${esc(r.name)}</bdi></button></td><td class="fc-active"><bdi>${format(r.s[sort],sort)}</bdi></td>${extras.map(extra=>`<td><bdi>${format(r.s[extra],extra)}</bdi></td>`).join('')}</tr>`).join('')}</tbody></table>`;
 }
 function render(){
  syncRange?.();
  if(!data)return;
  controls();
  analytics?.render();
  const rows=filtered();
  if(isTeam){
   const range=$('[data-range]').value,sort=$('[data-sort]').value;
   const ranked=rank(rows.map(r=>({...r,s:summarize(select(r.games,range))})),sort);
   $('[data-ranking]').innerHTML=ranked.length?rankingTable(ranked,sort):'<p class="ft-empty">לא נמצאו תוצאות.</p>';
  }
  detail();
  $('.ft-status').textContent=`עונת 2026/27 · ${rows.length} ${isTeam?'קבוצות':'שחקנים'} · עודכן ${date(data.updated_at)}`;
 }
 function detail(){
  const host=$('[data-detail]'),r=records.find(r=>r.id===chosen);
  if(!r){
   host.innerHTML=isTeam?'':`<p class="ft-empty">בחר שחקן מהרשימה למעלה.</p>`;
   return;
  }
  const range=$('[data-range]').value,all=select(r.games,0),rows=select(all,range),s=summarize(rows),latest=rows[0];
  const opponents=[...new Set(all.map(g=>g.opponent))];
  const sample=`${ranges[range]} · ${s.games} הופעות`;
  const lastGame=latest?`<bdi>${esc(latest.opponent)}</bdi> · ${date(latest.date)} · מחזור ${esc(latest.round??'—')}`:'';
  const header=isTeam
   ?`<h3><bdi>${esc(r.name)}</bdi></h3><p>${sample}</p>${lastGame?`<small>האחרון בטווח: ${lastGame}</small>`:''}`
   :root.PlayerAnalysis.profile(r,{
    stat:r.price!==null?`<bdi class="pa-credit">${fmt(r.price)} CR</bdi>`:'',
    meta:sample+(lastGame?'<br>'+lastGame:'')
   });
  const compare=isTeam?`<details class="pa-disclosure" data-disclosure="compare"><summary>השוואת הטווחים · אחרון / 3 / עונה</summary><div class="ft-records">${['1','3','0'].map(n=>`<article class="ft-record"><h4>${ranges[n]}</h4>${showMetrics(summarize(select(all,n)))}</article>`).join('')}</div></details>`:'';
  const games=isTeam?`<details class="pa-disclosure" data-disclosure="games"><summary>פירוט המשחקים בטווח</summary><div class="ft-records">${rows.map(g=>`<article class="ft-record"><h4>${esc(g.opponent)}</h4><small>${date(g.date)} · מחזור ${esc(g.round??'—')} · ${g.home?'בית':'חוץ'}${g.minutes===0?' · לא שיחק':''}</small>${showMetrics(summarize([g]))}</article>`).join('')}</div></details>`:'';
  host.innerHTML=`<article class="${isTeam?'ft-profile':'ft-player-report pa-report'}">${header}${showMetrics(s)}</article>${compare}<details class="pa-disclosure" data-disclosure="opponent"><summary>פירוט לפי יריבה</summary><div class="ft-records">${opponents.map(o=>`<article class="ft-record"><h4>${esc(o)}</h4><small>${ranges[range]} מול היריבה</small>${showMetrics(summarize(select(all.filter(g=>g.opponent===o),range)))}</article>`).join('')}</div></details>${games}`;
 }
 function choose(id){chosen=id;if(!isTeam)root.playerToolSelection?.set(records.find(r=>r.id===id)?.name,$('[data-range]').value);render();if(isTeam)$('[data-league]').open=true;if(chosen&&!section.classList.contains('pa-expanded')){$('[data-search]')?.blur();$('[data-detail]').scrollIntoView({block:'start',behavior:'smooth'});}}
 async function open(force=false){$('.ft-status').textContent='טוען נתוני עונשין…';$('[data-reload]').disabled=true;try{await Promise.all([load(force),root.refreshFantasyLive?.()]);const pool=typeof players!=='undefined'?players:[],market=new Map(pool.map(p=>[key(p),p]));records=isTeam?root.TeamMetricsCore.build(data).teams.map(t=>({id:t.team,name:t.team,team:'',price:null,games:t.games})):Object.entries(data.players).map(([id,p])=>{const m=market.get(key(p));return {id,name:m?.name||(typeof reorderCommaName==='function'?reorderCommaName(p.name):p.name),team:m?.team||select(p.games,1)[0]?.team||'',price:num(m?.price),playerCode:p.playerCode,fantasy_id:m?.fantasy_id,games:p.games};});if(!isTeam){const seen=new Set(records.map(p=>key(p)));for(const [id,p] of market)if(id&&['G','F','C'].includes(p.pos)&&!seen.has(id))records.push({id:'market:'+id,name:p.name,team:p.team,price:num(p.price),fantasy_id:p.fantasy_id,games:[]});
 const shared=section.classList.contains('active')?root.playerToolSelection?.find(records):null;
 if(shared){chosen=shared.row.id;if(shared.range)$('[data-range]').value=shared.range;}
 }render();}catch{$('.ft-status').textContent='הטעינה נכשלה. לחץ על רענן כדי לנסות שוב.';}finally{$('[data-reload]').disabled=false;}}
 button.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(e=>e.classList.remove('active'));button.classList.add('active');section.classList.add('active');void open();};$('[data-reload]').onclick=()=>void open(true);$('[data-search]')?.addEventListener('input',render);$('[data-entity]').onchange=()=>choose($('[data-entity]').value);$('[data-range]').onchange=()=>{if(!isTeam)root.playerToolSelection?.set(records.find(r=>r.id===chosen)?.name,$('[data-range]').value);render();};if(isTeam)$('[data-sort]').onchange=render;$('[data-team]').onchange=()=>{chosen='';if(isTeam)$('[data-league]').open=true;render();};for(const b of section.querySelectorAll('[data-scope]'))b.onclick=()=>{scope=b.dataset.scope;render();};section.addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(b)choose(b.dataset.pick);});
}
})(typeof window!=='undefined'?window:globalThis);

