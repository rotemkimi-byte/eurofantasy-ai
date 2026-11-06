(function(root){
'use strict';
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
function summarize(games,range){
 const unique=new Map();for(const g of games||[])unique.set(g.code,g);
 const ordered=[...unique.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.code-a.code);
 const rows=Number(range)>0?ordered.slice(0,Number(range)):ordered;
 const values=rows.filter(g=>!g.dnp&&numeric(g.value)).map(g=>Number(g.value));
 return {rows,count:values.length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,total:values.length?values.reduce((a,b)=>a+b,0):null};
}
if(typeof module!=='undefined'&&module.exports){module.exports={summarize,roundSeries};return;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>numeric(v)?Number(v).toFixed(1):'—';
const name=p=>typeof reorderCommaName==='function'?reorderCommaName(p.name):p.name;
const date=d=>new Date(d).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'});
const button=document.createElement('button');button.dataset.tab='pirCompare';button.textContent='השוואת PIR';document.querySelector('nav.tabs').append(button);
const section=document.createElement('section');section.id='pirCompare';section.className='tab';
section.innerHTML=`<div class="card"><div class="sectionHead"><h3>השוואת PIR</h3><button class="secondary" data-refresh>רענן</button></div><div class="player-picker-modes" role="group" aria-label="בחירת רשימת שחקנים"><button type="button" data-scope="all" aria-pressed="true">כל השחקנים · לפי מחיר</button><button type="button" data-scope="team" aria-pressed="false">לפי קבוצה</button></div><div class="pc-controls player-picker-controls"><label data-team-label hidden>בחר קבוצה<select data-team><option value="">בחר קבוצה</option></select></label><label>הוסף שחקן · מהמחיר הגבוה לנמוך<select data-player></select></label><label>טווח תצוגה<select data-range><option value="1">אחרון</option><option value="3">3 אחרונים</option><option value="0" selected>כל העונה · 2026/27</option></select></label></div><p role="status" data-status></p><div class="pc-selection-head"><strong data-count>נבחרו 0 מתוך 6</strong><button type="button" data-compare disabled>השווה שחקנים</button><button type="button" data-clear disabled>נקה בחירה</button></div><div class="pc-selected" data-selected></div><div data-results></div><details data-picker open><summary>בחירת שחקנים · מהמחיר הגבוה לנמוך</summary><div class="pc-picker" data-options></div></details><details class="ef-help"><summary>הסבר</summary><p>PIR בפועל בעונת 2026/27, ללא בונוסים ומכפילים. הטווח נקבע לפי הרישומים האחרונים של כל שחקן, כולל רישום שבו לא שיחק. אי־השתתפות ונתון חסר אינם אפס ואינם נכנסים לממוצע; מוצג מספר המשחקים שנכללו. הגרף מציג מחזורים משותפים בציר האופקי. המקף מציין שאין PIR זמין באותו מחזור. הפירוט מחשב ממוצעים לפי המשחקים האחרונים של כל שחקן.</p></details></div>`;
document.querySelector('main').append(section);
const style=document.createElement('style');style.textContent=`.pc-controls{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.pc-controls label{flex:1;min-width:180px}.pc-controls input,.pc-controls select{margin-top:6px;min-height:44px;font-size:16px}.pc-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;max-height:260px;overflow:auto;padding:12px 2px}.pc-picker button{background:var(--card2);color:var(--text);border:1px solid var(--line);min-height:48px;text-align:right}.pc-picker button[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.pc-picker small,.pc-selected small{display:block}.pc-selected{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.pc-selected button{min-height:44px;background:var(--card2);color:var(--text);border:1px solid var(--line)}#pirCompare summary{cursor:pointer;padding:12px 0}.pc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:20px 0}.pc-card{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}.pc-card h4{margin:0 0 6px;font-size:17px}.pc-value{font-size:38px;font-weight:850;display:block;color:var(--accent);direction:ltr;text-align:right}.pc-value.negative{color:var(--bad)}.pc-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;margin:12px 0}.pc-game{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13px}.pc-game small{display:block;margin-top:4px}.pc-game strong{white-space:nowrap;direction:ltr}.pc-table-wrap{overflow:auto}.pc-table{min-width:600px}.pc-table th,.pc-table td{background:var(--card2);color:var(--text)}.pc-table .pc-current{font-weight:850;color:var(--accent)}`;style.textContent+=`
#pirCompare{--pc-bg:#fff;--pc-soft:#f2f5f9;--pc-text:#142237;--pc-muted:#526176;--pc-border:#b9c5d4;--pc-accent:#006b4c;--pc-selected:#e2f6ee;--pc-negative:#a9213e}
html[data-theme="dark"] #pirCompare{--pc-bg:#162237;--pc-soft:#203149;--pc-text:#f4f7fc;--pc-muted:#c0cde0;--pc-border:#667b98;--pc-accent:#76efbe;--pc-selected:#153f36;--pc-negative:#ff9eaf}
#pirCompare .card,#pirCompare .pc-card{background:var(--pc-bg);color:var(--pc-text)}
#pirCompare button:not(.player-picker-modes button){color:var(--pc-text);background:var(--pc-soft);border:1px solid var(--pc-border);min-height:44px}
#pirCompare button bdi,#pirCompare button strong{color:inherit}
#pirCompare .pc-picker button[aria-pressed="true"]{background:var(--pc-selected);color:var(--pc-text);border:2px solid var(--pc-accent)}
#pirCompare label,#pirCompare small{color:var(--pc-muted)}
#pirCompare input,#pirCompare select{background:var(--pc-bg);color:var(--pc-text);border-color:var(--pc-border)}
#pirCompare input::placeholder{color:var(--pc-muted);opacity:1}
#pirCompare .pc-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
#pirCompare [hidden]{display:none!important}
#pirCompare .pc-selection-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0}
#pirCompare .pc-selection-head strong{flex:1;min-width:130px}
#pirCompare [data-compare]:not(:disabled){background:var(--pc-accent);color:var(--pc-bg);border-color:var(--pc-accent)}
#pirCompare button:disabled{opacity:.55;cursor:default}
#pirCompare button:focus-visible,#pirCompare select:focus-visible,#pirCompare input:focus-visible{outline:3px solid var(--pc-accent);outline-offset:3px}
#pirCompare .pc-picker{display:flex;flex-direction:column;max-height:440px;gap:8px;padding:8px 3px;overscroll-behavior:contain}
#pirCompare .pc-picker button{display:grid;grid-template-columns:minmax(0,1fr) 60px 62px;gap:10px;align-items:center;padding:12px;text-align:right;min-height:76px;flex-shrink:0}
#pirCompare .pc-player-info{min-width:0}#pirCompare .pc-player-info bdi{display:block;font-size:16px;line-height:1.35;font-weight:800;overflow-wrap:anywhere}
#pirCompare .pc-player-info small{margin-top:5px;font-size:12px}
#pirCompare .pc-price{text-align:center}#pirCompare .pc-price strong{font-size:20px;direction:ltr;display:block}
#pirCompare .pc-pick-action{font-size:12px;font-weight:800;color:var(--pc-accent);text-align:center}
#pirCompare .pc-selected button{border-color:var(--pc-accent);background:var(--pc-selected)}
#pirCompare .pc-value,#pirCompare .pc-table .pc-current{color:var(--pc-accent)}#pirCompare .pc-value.negative{color:var(--pc-negative)}
#pirCompare .pc-table th,#pirCompare .pc-table td{background:var(--pc-soft);color:var(--pc-text);border-color:var(--pc-border)}
#pirCompare [data-results]{scroll-margin-top:110px}
.pc-chart{--pc-chart-bg:#f6f8fc;--pc-chart-grid:#a2b1c5;--pc-chart-guide:#60728d;--pc-line-1:#1b59ce;--pc-line-2:#08783d;--pc-line-3:#ad4e08;--pc-line-4:#823bc2;--pc-line-5:#ad235b;--pc-line-6:#007685;max-width:640px;margin:14px auto 0;padding:14px 10px 8px;border:1px solid var(--pc-border,var(--line));border-radius:16px;background:var(--pc-chart-bg)}
html[data-theme="dark"] .pc-chart{--pc-chart-bg:#080b10;--pc-chart-grid:#536175;--pc-chart-guide:#a8b7cb;--pc-line-1:#5b96ff;--pc-line-2:#59c475;--pc-line-3:#f2a750;--pc-line-4:#c59aff;--pc-line-5:#ff8cbc;--pc-line-6:#54d7e8}
.pc-chart h4{margin:0 4px 14px;font-size:clamp(17px,4vw,23px);color:var(--pc-text,var(--text))}
.pc-chart-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 4px 10px}
.pc-chart-legend div{border-inline-start:4px solid var(--pc-series);padding-inline-start:8px;line-height:1.25;overflow-wrap:anywhere;color:var(--pc-text,var(--text))}
.pc-chart-legend strong{display:block;font-size:24px}
.pc-chart svg{display:block;width:100%;height:auto;cursor:crosshair;direction:ltr}
.pc-chart svg:focus-visible{outline:2px solid var(--pc-accent,var(--accent));outline-offset:2px}
.pc-chart svg text{fill:var(--pc-muted,var(--muted));font-size:12px}
.pc-chart svg .pc-chart-round{fill:var(--pc-text,var(--text));font-weight:800}
.pc-chart svg .pc-zero{stroke:var(--pc-chart-guide)}
.pc-summary{margin-top:8px}
#pirCompare .pc-game{border-color:var(--pc-border)}
@media(max-width:360px){#pirCompare .pc-picker button{grid-template-columns:minmax(0,1fr) 48px 48px;gap:6px;padding:10px 8px}}
`;document.head.append(style);
const $=s=>section.querySelector(s);let data=null,selected=[],busy=false,scope='all';
try{const saved=JSON.parse(localStorage.getItem('efa-pir-compare')||'[]');if(Array.isArray(saved))selected=saved.filter(s=>typeof s==='string').slice(0,6);}catch{}
const persist=()=>{try{localStorage.setItem('efa-pir-compare',JSON.stringify(selected));}catch{}};
const playerKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
function catalog(){
 const pool=typeof players!=='undefined'?players:[];
 const market=new Map(pool.filter(p=>['G','F','C'].includes(p.pos)).map(p=>[playerKey(p.name),p]));
 const historical=[...data.players].map(([id,p])=>{const m=market.get(playerKey(p.name));return {id,p,name:m?.name||name(p),team:m?.team||p.team,price:numeric(m?.price)?Number(m.price):null,pos:m?.pos||p.games?.at(-1)?.pos||''};});
 const seen=new Set(historical.map(r=>playerKey(r.name)));
 for(const p of market.values())if(!seen.has(playerKey(p.name)))historical.push({id:lastThreeName(p.name),p,name:p.name,team:p.team,price:numeric(p.price)?Number(p.price):null,pos:p.pos});
 return historical.sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));
}
function options(){if(!data)return;
 const all=catalog(),old=$('[data-team]').value,teams=[...new Set(all.map(r=>r.team).filter(Boolean))].sort();
 $('[data-team]').innerHTML='<option value="">בחר קבוצה</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(teams.includes(old))$('[data-team]').value=old;
 $('[data-team-label]').hidden=scope!=='team';
 section.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));
 const rows=all.filter(r=>scope==='all'||r.team===$('[data-team]').value);
 const remaining=rows.filter(r=>!selected.includes(r.id));
 const picker=$('[data-player]');
 picker.replaceChildren(new Option(remaining.length?'בחר שחקן':'אין שחקנים לבחירה',''),...remaining.map(r=>new Option(r.name+' · '+(r.price===null?'מחיר לא זמין':fmt(r.price)+' cr'),r.id)));
 picker.disabled=selected.length>=6||!remaining.length;
 $('[data-options]').innerHTML=scope==='team'&&!$('[data-team]').value?'<p class="pc-empty">בחר קבוצה למעלה כדי לראות את השחקנים שלה.</p>':rows.map(r=>{const on=selected.includes(r.id);return `<button type="button" data-add="${esc(r.id)}" aria-pressed="${on}" ${!on&&selected.length>=6?'disabled':''}><span class="pc-player-info"><bdi>${esc(r.name)}</bdi><small>${esc(r.team)}${r.pos?' · '+esc(r.pos):''}</small></span><span class="pc-price"><strong>${fmt(r.price)}</strong><small>קרדיט</small></span><span class="pc-pick-action">${on?'✓ נבחר':'+ הוסף'}</span></button>`;}).join('')||'<p class="pc-empty">לא נמצאו שחקנים.</p>';
}
function roundSeries(picks,range){
 let latest=0;
 const series=picks.map(({p})=>{
  const values=new Map();
  for(const g of summarize(p.games,0).rows){
   const round=Number(g.round);
   if(!Number.isInteger(round)||round<1)continue;
   latest=Math.max(latest,round);
   if(!g.dnp&&numeric(g.value)&&!values.has(round)){
    values.set(round,Number(g.value));
   }
  }
  return {player:p,values};
 });
 if(!series.some(({values})=>values.size))return {series,rounds:[]};
 const first=Number(range)>0?Math.max(1,latest-Number(range)+1):1;
 return {series,rounds:Array.from({length:latest-first+1},(_,i)=>first+i)};
}

function drawComparisonChart(container,picks,range,{label='PIR',format=String}={}){
 const {series,rounds}=roundSeries(picks,range);
 const values=series.flatMap(s=>rounds.filter(round=>s.values.has(round)).map(round=>s.values.get(round)));
 if(!values.length){
  container.textContent=`אין נתוני ${label} זמינים להשוואה בטווח שנבחר.`;
  return;
 }
 const w=360,h=292,left=34,right=14,top=24,bottom=40,plotWidth=w-left-right;
 const last=rounds.length-1,stepX=plotWidth/Math.max(last,1);
 const x=i=>last?left+i*stepX:left+plotWidth/2;
 const min=Math.min(0,...values),max=Math.max(0,...values);
 const tickStep=Math.max(5,Math.ceil((max-min)/25)*5);
 const low=Math.floor((min-1)/tickStep)*tickStep,high=Math.ceil((max+1)/tickStep)*tickStep;
 const y=v=>top+(high-v)*(h-top-bottom)/(high-low);
 const grid=Array.from({length:(high-low)/tickStep+1},(_,i)=>low+i*tickStep);
 const labelEvery=Math.max(1,Math.ceil(last/5));
 const colors=series.map((_,i)=>`var(--pc-line-${i+1})`);
 // Use monotone curves so the line stays within adjacent PIR values.
 const lines=series.map(({values},n)=>{
  const points=rounds.map(round=>values.get(round));
  const slope=i=>{
   const previous=points[i]-points[i-1],next=points[i+1]-points[i];
   if(Number.isNaN(previous))return next;
   if(Number.isNaN(next))return previous;
   return previous*next>0?2*previous*next/(previous+next):0;
  };
  const path=points.map((value,i)=>{
   if(value===undefined)return '';
   if(points[i-1]===undefined)return `M ${x(i)} ${y(value)}`;
   return `C ${x(i-1)+stepX/3} ${y(points[i-1]+slope(i-1)/3)} ${x(i)-stepX/3} ${y(value-slope(i)/3)} ${x(i)} ${y(value)}`;
  }).join(' ');
  const isolated=points.map((v,i)=>v!==undefined&&points[i-1]===undefined&&points[i+1]===undefined
   ?`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${colors[n]}"/>`:'').join('');
  return `<path d="${path}" fill="none" stroke="${colors[n]}" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${isolated}`;
 }).join('');

 container.innerHTML=`<h4>${esc(label)} לפי מחזור · עונת <bdi>2026/27</bdi></h4>
  <div class="pc-chart-legend" data-round-values aria-live="polite"></div>
  <svg dir="ltr" viewBox="0 0 ${w} ${h}" tabindex="0" role="slider" aria-label="מחזור להשוואת ${esc(label)}" aria-valuemin="${rounds[0]}" aria-valuemax="${rounds[last]}">
   ${grid.map(v=>`<line x1="${left}" y1="${y(v)}" x2="${w-right}" y2="${y(v)}" stroke="var(--pc-chart-grid)" stroke-dasharray="2 4" class="${v===0?'pc-zero':''}"/><text x="${left-7}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('')}
   ${rounds.map((r,i)=>i===0||i===last||(i%labelEvery===0&&i<last-labelEvery/2)?`<text x="${x(i)}" y="${h-23}" text-anchor="middle">${r}</text>`:'').join('')}
   <text x="${left+plotWidth/2}" y="${h-5}" text-anchor="middle">מחזור</text>
   ${lines}<g data-round-cursor></g>
   <rect data-chart-hit x="${left-7}" y="0" width="${plotWidth+14}" height="${h-17}" fill="transparent"/>
  </svg>`;
 const svg=container.querySelector('svg'),cursor=container.querySelector('[data-round-cursor]');
 const legend=container.querySelector('[data-round-values]');
 let active=last;
 function selectRound(i){
  active=Math.max(0,Math.min(last,i));
  const round=rounds[active],xx=x(active);
  svg.setAttribute('aria-valuenow',round);
  svg.setAttribute('aria-valuetext',`מחזור ${round}`);
  legend.innerHTML=series.map(({player,values},n)=>`<div style="--pc-series:${colors[n]}"><bdi>${esc(name(player))}</bdi><strong><bdi>${values.has(round)?esc(format(values.get(round))):'—'}</bdi></strong></div>`).join('');
  cursor.innerHTML=`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${h-bottom}" stroke="var(--pc-chart-guide)"/><text class="pc-chart-round" x="${xx}" y="15" text-anchor="middle">${round}</text>`
   +series.map(({values},n)=>{
    const v=values.get(round);
    return v===undefined?'':`<circle cx="${xx}" cy="${y(v)}" r="5" fill="${colors[n]}" stroke="var(--pc-chart-bg)" stroke-width="1.5"/>`;
   }).join('');
 }
 svg.addEventListener('click',e=>{
  if(!e.target.hasAttribute('data-chart-hit'))return;
  const bounds=svg.getBoundingClientRect(),position=(e.clientX-bounds.left)*w/bounds.width;
  selectRound(Math.round((position-left)/stepX));
 });
 svg.addEventListener('keydown',e=>{
  const index={ArrowLeft:active-1,ArrowRight:active+1,ArrowDown:active-1,ArrowUp:active+1,Home:0,End:last}[e.key];
  if(index===undefined)return;
  e.preventDefault();
  selectRound(index);
 });
 selectRound(last);
}
root.drawRoundComparisonChart=drawComparisonChart;

function render(){if(!data)return;const range=$('[data-range]').value;const playersById=new Map(catalog().map(r=>[r.id,r]));const picks=selected.map(id=>playersById.get(id)).filter(Boolean);
 $('[data-count]').textContent=`נבחרו ${picks.length} מתוך 6`;$('[data-compare]').disabled=picks.length<2;$('[data-clear]').disabled=!picks.length;
 $('[data-selected]').innerHTML=picks.map(({id,p})=>`<button data-remove="${esc(id)}" aria-label="הסר את ${esc(name(p))}">${esc(name(p))} ×</button>`).join('');
 $('[data-results]').innerHTML=!picks.length?'<p>בחר שני שחקנים או יותר להשוואה, עד שישה שחקנים.</p>':`<div class="pc-chart" data-chart></div><details class="pc-summary"><summary>פירוט משחקים וממוצעים</summary><div class="pc-cards">${picks.map(({p})=>{const s=summarize(p.games,range);return `<article class="pc-card"><h4><bdi>${esc(name(p))}</bdi></h4><small>${esc(p.team)}</small><span class="pc-value ${s.average<0?'negative':''}">${fmt(s.average)}</span><span>${range==='1'?'PIR במשחק האחרון':'ממוצע PIR למשחק'}</span><div class="pc-meta"><span>${s.count}/${s.rows.length} משחקים עם PIR</span><span>סך PIR: ${fmt(s.total)}</span></div><details ${range==='0'?'':'open'}><summary>המשחקים שבבסיס ההשוואה</summary>${s.rows.map(g=>`<div class="pc-game"><span>${esc(g.opponent)}<small>${date(g.date)} · מחזור ${esc(g.round??'—')} · ${g.home?'בית':'חוץ'}</small></span><strong>${g.dnp?'לא שיחק':fmt(g.value)}</strong></div>`).join('')||'<p>אין משחקים זמינים.</p>'}</details></article>`;}).join('')}</div><div class="pc-table-wrap"><table class="pc-table"><thead><tr><th>שחקן</th><th>משחק אחרון</th><th>ממוצע 3 אחרונים</th><th>ממוצע עונה</th></tr></thead><tbody>${picks.map(({p})=>`<tr><th scope="row"><bdi>${esc(name(p))}</bdi></th>${[1,3,0].map(n=>{const s=summarize(p.games,n);return `<td class="${String(n)===range?'pc-current':''}">${fmt(s.average)}<br><small>${s.count}/${s.rows.length} משחקים</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div></details>`;
 if(picks.length)drawComparisonChart($('[data-chart]'),picks,range);
 options();
}
async function load(force=false){if(busy)return;busy=true;$('[data-refresh]').disabled=true;$('[data-status]').textContent='טוען דוחות משחק להשוואה…';try{await root.refreshFantasyLive?.();if(force&&typeof lastThreeRequests!=='undefined')lastThreeRequests.clear();if(force||!root.PIRHistoryUI.getData())await root.PIRHistoryUI.load();data=root.PIRHistoryUI.getData();if(!data)throw Error();const ids=new Set(catalog().map(r=>r.id));selected=selected.filter(id=>ids.has(id));render();$('[data-status]').textContent=`עונת 2026/27 · בחר עד 6 שחקנים${data.missing?' · חסרים '+data.missing+' דוחות משחק; ההשוואה חלקית':''}`;}catch{$('[data-status]').textContent='לא ניתן לטעון את הנתונים. לחץ על רענן לניסיון נוסף.';}finally{busy=false;$('[data-refresh]').disabled=false;}}
button.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(e=>e.classList.remove('active'));button.classList.add('active');section.classList.add('active');void load();};
$('[data-team]').onchange=options;
 for(const b of section.querySelectorAll('[data-scope]'))b.onclick=()=>{scope=b.dataset.scope;options();};
 $('[data-clear]').onclick=()=>{selected=[];persist();render();};
 $('[data-compare]').onclick=()=>{$('[data-picker]').open=false;const result=$('[data-results]');result.setAttribute('tabindex','-1');result.focus({preventScroll:true});result.scrollIntoView({block:'start',behavior:'smooth'});};
 $('[data-refresh]').onclick=()=>void load(true);$('[data-range]').onchange=render;
function toggle(id){
 if(!id)return;
 if(selected.includes(id))selected=selected.filter(k=>k!==id);
 else if(selected.length<6)selected.push(id);
 else return;
 persist();render();
 if(selected.length===2&&selected.includes(id))$('[data-chart]')?.scrollIntoView({block:'nearest'});
}
$('[data-player]').onchange=e=>toggle(e.target.value);
section.addEventListener('click',e=>{const b=e.target.closest('[data-add],[data-remove]');if(b)toggle(b.dataset.add||b.dataset.remove);});
})(typeof window!=='undefined'?window:globalThis);
