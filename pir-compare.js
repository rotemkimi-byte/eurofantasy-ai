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
if(typeof module!=='undefined'&&module.exports){module.exports={summarize};return;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>numeric(v)?Number(v).toFixed(1):'—';
const name=p=>typeof reorderCommaName==='function'?reorderCommaName(p.name):p.name;
const date=d=>new Date(d).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'});
const button=document.createElement('button');button.dataset.tab='pirCompare';button.textContent='השוואת PIR';document.querySelector('nav.tabs').append(button);
const section=document.createElement('section');section.id='pirCompare';section.className='tab';
section.innerHTML=`<div class="card"><div class="sectionHead"><h3>השוואת PIR</h3><button class="secondary" data-refresh>רענן</button></div><div class="pc-mode" role="group" aria-label="בחירת רשימת שחקנים"><button type="button" data-scope="all" aria-pressed="true">כל השחקנים</button><button type="button" data-scope="team" aria-pressed="false">לפי קבוצה</button></div><div class="pc-controls"><label data-team-label hidden>בחר קבוצה<select data-team><option value="">בחר קבוצה</option></select></label><label>חיפוש שחקן<input type="search" data-search placeholder="שם שחקן או קבוצה"></label><label>טווח ההשוואה<select data-range><option value="1">משחק אחרון</option><option value="3">3 משחקים אחרונים</option><option value="0">כל העונה · 2026/27</option></select></label></div><p role="status" data-status></p><div class="pc-selection-head"><strong data-count>נבחרו 0 מתוך 6</strong><button type="button" data-compare disabled>השווה שחקנים</button><button type="button" data-clear disabled>נקה בחירה</button></div><div class="pc-selected" data-selected></div><details data-picker open><summary>בחירת שחקנים · מהמחיר הגבוה לנמוך</summary><div class="pc-picker" data-options></div></details><div data-results></div><details class="ef-help"><summary>הסבר</summary><p>PIR בפועל בעונת 2026/27, ללא בונוסים ומכפילים. הטווח נקבע לפי הרישומים האחרונים של כל שחקן, כולל רישום שבו לא שיחק. אי־השתתפות ונתון חסר אינם אפס ואינם נכנסים לממוצע; מוצג מספר המשחקים שנכללו. תאריכי המשחקים עשויים להיות שונים בין השחקנים.</p></details></div>`;
document.querySelector('main').append(section);
const style=document.createElement('style');style.textContent=`.pc-controls{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.pc-controls label{flex:1;min-width:180px}.pc-controls input,.pc-controls select{margin-top:6px;min-height:44px;font-size:16px}.pc-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;max-height:260px;overflow:auto;padding:12px 2px}.pc-picker button{background:var(--card2);color:var(--text);border:1px solid var(--line);min-height:48px;text-align:right}.pc-picker button[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.pc-picker small,.pc-selected small{display:block}.pc-selected{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.pc-selected button{min-height:44px;background:var(--card2);color:var(--text);border:1px solid var(--line)}#pirCompare summary{cursor:pointer;padding:12px 0}.pc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:20px 0}.pc-card{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}.pc-card h4{margin:0 0 6px;font-size:17px}.pc-value{font-size:38px;font-weight:850;display:block;color:var(--accent);direction:ltr;text-align:right}.pc-value.negative{color:var(--bad)}.pc-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;margin:12px 0}.pc-game{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:13px}.pc-game small{display:block;margin-top:4px}.pc-game strong{white-space:nowrap;direction:ltr}.pc-table-wrap{overflow:auto}.pc-table{min-width:600px}.pc-table th,.pc-table td{background:var(--card2);color:var(--text)}.pc-table .pc-current{font-weight:850;color:var(--accent)}`;style.textContent+=`
#pirCompare{--pc-bg:#fff;--pc-soft:#f2f5f9;--pc-text:#142237;--pc-muted:#526176;--pc-border:#b9c5d4;--pc-accent:#006b4c;--pc-selected:#e2f6ee;--pc-negative:#a9213e}
html[data-theme="dark"] #pirCompare{--pc-bg:#162237;--pc-soft:#203149;--pc-text:#f4f7fc;--pc-muted:#c0cde0;--pc-border:#667b98;--pc-accent:#76efbe;--pc-selected:#153f36;--pc-negative:#ff9eaf}
#pirCompare .card,#pirCompare .pc-card{background:var(--pc-bg);color:var(--pc-text)}
#pirCompare .pc-mode{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 10px}
#pirCompare button{color:var(--pc-text);background:var(--pc-soft);border:1px solid var(--pc-border);min-height:44px}
#pirCompare button bdi,#pirCompare button strong{color:inherit}
#pirCompare .pc-mode button[aria-pressed="true"],#pirCompare .pc-picker button[aria-pressed="true"]{background:var(--pc-selected);color:var(--pc-text);border:2px solid var(--pc-accent)}
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
#pirCompare [data-results]{scroll-margin-top:110px}#pirCompare .pc-game{border-color:var(--pc-border)}
@media(max-width:360px){#pirCompare .pc-picker button{grid-template-columns:minmax(0,1fr) 48px 48px;gap:6px;padding:10px 8px}}
`;document.head.append(style);
const $=s=>section.querySelector(s);let data=null,selected=[],busy=false,scope='all';
try{const saved=JSON.parse(localStorage.getItem('efa-pir-compare')||'[]');if(Array.isArray(saved))selected=saved.filter(s=>typeof s==='string').slice(0,6);}catch{}
const persist=()=>{try{localStorage.setItem('efa-pir-compare',JSON.stringify(selected));}catch{}};
const playerKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
function catalog(){
 const pool=typeof players!=='undefined'?players:[];
 const market=new Map(pool.filter(p=>['G','F','C'].includes(p.pos)).map(p=>[playerKey(p.name),p]));
 return [...data.players].map(([id,p])=>{const m=market.get(playerKey(p.name));return {id,p,name:m?.name||name(p),team:m?.team||p.team,price:numeric(m?.price)?Number(m.price):null,pos:m?.pos||p.games?.at(-1)?.pos||''};}).sort((a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||a.name.localeCompare(b.name));
}
function options(){if(!data)return;
 const all=catalog(),old=$('[data-team]').value,teams=[...new Set(all.map(r=>r.team).filter(Boolean))].sort();
 $('[data-team]').innerHTML='<option value="">בחר קבוצה</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(teams.includes(old))$('[data-team]').value=old;
 $('[data-team-label]').hidden=scope!=='team';
 section.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)));
 const q=$('[data-search]').value.trim().toLowerCase();const rows=all.filter(r=>(scope==='all'||r.team===$('[data-team]').value)&&(!q||(r.name+' '+name(r.p)+' '+r.team).toLowerCase().includes(q)));
 $('[data-options]').innerHTML=scope==='team'&&!$('[data-team]').value?'<p class="pc-empty">בחר קבוצה למעלה כדי לראות את השחקנים שלה.</p>':rows.map(r=>{const on=selected.includes(r.id);return `<button type="button" data-add="${esc(r.id)}" aria-pressed="${on}" ${!on&&selected.length>=6?'disabled':''}><span class="pc-player-info"><bdi>${esc(r.name)}</bdi><small>${esc(r.team)}${r.pos?' · '+esc(r.pos):''}</small></span><span class="pc-price"><strong>${fmt(r.price)}</strong><small>קרדיט</small></span><span class="pc-pick-action">${on?'✓ נבחר':'+ הוסף'}</span></button>`;}).join('')||'<p class="pc-empty">לא נמצאו שחקנים לחיפוש הזה.</p>';
}
function render(){if(!data)return;const range=$('[data-range]').value;const picks=selected.map(id=>({id,p:data.players.get(id)})).filter(r=>r.p);
 $('[data-count]').textContent=`נבחרו ${picks.length} מתוך 6`;$('[data-compare]').disabled=picks.length<2;$('[data-clear]').disabled=!picks.length;
 $('[data-selected]').innerHTML=picks.map(({id,p})=>`<button data-remove="${esc(id)}" aria-label="הסר את ${esc(name(p))}">${esc(name(p))} ×</button>`).join('');
 $('[data-results]').innerHTML=!picks.length?'<p>בחר שני שחקנים או יותר להשוואה, עד שישה שחקנים.</p>':`<div class="pc-cards">${picks.map(({p})=>{const s=summarize(p.games,range);return `<article class="pc-card"><h4><bdi>${esc(name(p))}</bdi></h4><small>${esc(p.team)}</small><span class="pc-value ${s.average<0?'negative':''}">${fmt(s.average)}</span><span>${range==='1'?'PIR במשחק האחרון':'ממוצע PIR למשחק'}</span><div class="pc-meta"><span>${s.count}/${s.rows.length} משחקים עם PIR</span><span>סך PIR: ${fmt(s.total)}</span></div><details ${range==='0'?'':'open'}><summary>המשחקים שבבסיס ההשוואה</summary>${s.rows.map(g=>`<div class="pc-game"><span>${esc(g.opponent)}<small>${date(g.date)} · מחזור ${esc(g.round??'—')} · ${g.home?'בית':'חוץ'}</small></span><strong>${g.dnp?'לא שיחק':fmt(g.value)}</strong></div>`).join('')||'<p>אין משחקים זמינים.</p>'}</details></article>`;}).join('')}</div><div class="pc-table-wrap"><table class="pc-table"><thead><tr><th>שחקן</th><th>משחק אחרון</th><th>ממוצע 3 אחרונים</th><th>ממוצע עונה</th></tr></thead><tbody>${picks.map(({p})=>`<tr><th scope="row"><bdi>${esc(name(p))}</bdi></th>${[1,3,0].map(n=>{const s=summarize(p.games,n);return `<td class="${String(n)===range?'pc-current':''}">${fmt(s.average)}<br><small>${s.count}/${s.rows.length} משחקים</small></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
 options();
}
async function load(force=false){if(busy)return;busy=true;$('[data-refresh]').disabled=true;$('[data-status]').textContent='טוען דוחות משחק להשוואה…';try{if(force&&typeof lastThreeRequests!=='undefined')lastThreeRequests.clear();if(force||!root.PIRHistoryUI.getData())await root.PIRHistoryUI.load();data=root.PIRHistoryUI.getData();if(!data)throw Error();selected=selected.filter(id=>data.players.has(id));render();$('[data-status]').textContent=`עונת 2026/27 · בחר עד 6 שחקנים${data.missing?' · חסרים '+data.missing+' דוחות משחק; ההשוואה חלקית':''}`;}catch{$('[data-status]').textContent='לא ניתן לטעון את הנתונים. לחץ על רענן לניסיון נוסף.';}finally{busy=false;$('[data-refresh]').disabled=false;}}
button.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(e=>e.classList.remove('active'));button.classList.add('active');section.classList.add('active');void load();};
$('[data-team]').onchange=options;
 for(const b of section.querySelectorAll('[data-scope]'))b.onclick=()=>{scope=b.dataset.scope;$('[data-search]').value='';options();};
 $('[data-clear]').onclick=()=>{selected=[];persist();render();};
 $('[data-compare]').onclick=()=>{$('[data-search]').blur();$('[data-picker]').open=false;const result=$('[data-results]');result.setAttribute('tabindex','-1');result.focus({preventScroll:true});result.scrollIntoView({block:'start',behavior:'smooth'});};
 $('[data-refresh]').onclick=()=>void load(true);$('[data-search]').oninput=options;$('[data-range]').onchange=render;
section.addEventListener('click',e=>{const b=e.target.closest('[data-add],[data-remove]');if(!b)return;const id=b.dataset.add||b.dataset.remove;if(selected.includes(id))selected=selected.filter(k=>k!==id);else if(selected.length<6)selected.push(id);else{$('[data-status]').textContent='אפשר להשוות עד 6 שחקנים. הסר שחקן כדי לבחור אחר.';return;}persist();render();});
})(typeof window!=='undefined'?window:globalThis);
