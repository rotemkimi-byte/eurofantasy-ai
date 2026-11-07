/* Navigation adapts the existing tabs; their handlers and data loaders remain authoritative. */
(()=>{
'use strict';
const original=document.querySelector('nav.tabs'),main=document.querySelector('main');
if(!original||!main||document.getElementById('efNavigation'))return;
const groups=[
 {id:'home',title:'בית',description:'הסגל שלך, סנכרון וכל הכלים',tabs:['team','data'],icon:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10'},
 {id:'players',title:'שחקנים',description:'שוק שחקנים, ביצועים ומדדים',tabs:['market','playerDna','playerMatchups','pirGraph','playerBoxScore','usage','playerFreeThrows','playerNegative','playerShots','playerPlusMinus','playerLineups','defense','injuries'],icon:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3'},
 {id:'clubs',title:'קבוצות',description:'סגלים, תוצאות ומאצ׳אפים',tabs:['clubMarket','teamDna','teamMetrics','teamFreeThrows','matchups','pirWeakness'],icon:'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6 21v-3a6 6 0 0 1 12 0v3M3 8v6m18-6v6M2 21v-3m20 3v-3'},
 {id:'model',title:'אלגוריתם',description:'תחזיות, משקלים ובדיקה מול תוצאות',tabs:['algorithm','learning'],icon:'M12 4 3 20h18L12 4M12 4v10M3 20l9-6 9 6'},
 {id:'fantasy',title:'פנטזי',description:'בניית סגל, מציאות וקפטנים',tabs:['negativeSurprises','absencePicks','optimizer','superSquad','bargains','captain','coach'],icon:'M7 3h10v7a5 5 0 0 1-10 0V3M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6m-5 0h10'}
];
const icon=g=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${g.icon}"/></svg>`;
const toolPaths={team:'M8 3l4 2 4-2 6 5-4 4-2-2v12H8V10l-2 2-4-4 6-5',data:'M4 20V12h3v8M11 20V7h3v13M18 20V3h3v17',market:'M3 6c0-4 18-4 18 0s-18 4-18 0m0 0v12c0 4 18 4 18 0V6M3 12c0 4 18 4 18 0',pirGraph:'M3 18l6-7 5 3 7-10M3 21h18',usage:'M3 19a10 10 0 1 1 18 0M12 13l5-6M6 14h1m10 0h1M12 5v2',defense:'M12 3l8 3v7c0 5-8 9-8 9s-8-4-8-9V6l8-3',injuries:'M8 3l13 13-5 5L3 8zM16 3 3 16l5 5L21 8z',learning:'M9 3h6m-5 0v7L4 20h16l-6-10V3',algorithm:'M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',matchups:'M7 3h10v7a5 5 0 0 1-10 0V3M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6m-5 0h10',playerMatchups:'M3 3l18 18M3 7V3h4M21 3 3 21m14-18h4v4',clubMarket:'M12 3 2 8l10 5 10-5-10-5M2 13l10 5 10-5M2 18l10 5 10-5',teamMetrics:'M4 20V12h3v8M11 20V7h3v13M18 20V3h3v17',pirWeakness:'M20 12a8 8 0 1 1-8-8M16 12a4 4 0 1 1-4-4M12 12 22 2m-5 0h5v5'};
const toolIcon=(b,g)=>icon({icon:toolPaths[b.dataset.tab]||g.icon});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buttons=()=>Array.from(original.querySelectorAll('button[data-tab]'));
const groupFor=id=>groups.find(g=>g.tabs.includes(id))||groups[0];
const shortcuts={
 players:['market','playerDna','playerMatchups','pirGraph'],
 clubs:['clubMarket','teamDna','teamMetrics','matchups'],
 fantasy:['optimizer','captain','bargains']
};
const playerSections=[
 ['בחירה והשוואה',['market','playerMatchups','injuries']],
 ['ביצועים בפועל',['pirGraph','playerBoxScore','usage','playerFreeThrows','playerNegative','playerPlusMinus','defense']],
 ['סגנון משחק',['playerDna','playerShots','playerLineups']]
];
let group='home',landing=true,filter='';
let currentTool=null;
const home=document.createElement('section');home.id='efHome';home.className='tab';
home.innerHTML='<div class="ef-intro"><p class="ef-kicker">EUROFANTASY AI</p><h2 tabindex="-1" id="efPageTitle">כל הכלים שלך</h2><p id="efPageDescription">כל הלשוניות, במקום מסודר אחד</p></div><details class="ef-search"><summary>מצא כלי</summary><label><span>חיפוש כלי או מדד</span><input id="efToolSearch" type="search" placeholder="למשל: Usage, קפטן או PIR" autocomplete="off"></label></details><div id="efToolGroups"></div><p id="efNoTools" hidden role="status">לא נמצאו כלים מתאימים. נסה חיפוש אחר.</p>';
original.after(home);
const toolbar=document.createElement('div');toolbar.id='efToolbar';toolbar.innerHTML='<button type="button" id="efAllTools" class="secondary">כל הכלים</button><span id="efCurrentSection"></span><button type="button" id="efCategory" class="secondary">כלי האזור</button>';
original.before(toolbar);
const subnav=document.createElement('nav');subnav.id='efSectionNavigation';subnav.setAttribute('aria-label','כלים באזור הנבחר');toolbar.after(subnav);
const bottom=document.createElement('nav');bottom.id='efNavigation';bottom.setAttribute('aria-label','ניווט ראשי');bottom.innerHTML=groups.map(g=>`<button type="button" data-ef-group="${g.id}">${icon(g)}<span>${g.title}</span></button>`).join('');document.body.appendChild(bottom);
function tools(g){
 const byId=new Map(buttons().map(b=>[b.dataset.tab,b]));
 return [...g.tabs,...(g.id==='home'?[...byId.keys()].filter(id=>!groups.some(group=>group.tabs.includes(id))):[])]
  .map(id=>byId.get(id)).filter(Boolean);
}
const aliases={playerDna:'סגנון שחקן מתפרצות',teamDna:'סגנון קבוצה קצב',playerBoxScore:'בוקס סקור סטטיסטיקה נקודות',usage:'יוסג שימוש פוזשנים',pirGraph:'PIR דקות קרדיט השוואה גרף משולב',optimizer:'אופטימייזר תקציב'};
const toolButton=(b,g)=>`<button type="button" data-ef-tool="${esc(b.dataset.tab)}">${toolIcon(b,g)}<span>${esc(b.textContent)}</span><span aria-hidden="true">‹</span></button>`;
function updateAddress(id,tool){
 const hash=tool?'#tool='+encodeURIComponent(id):id==='home'?'':'#area='+encodeURIComponent(id);
 if(location.hash!==hash)history.pushState(null,'',location.pathname+location.search+hash);
}
function renderLanding(){
 const selected=groups.find(g=>g.id===group)||groups[0];
 document.getElementById('efPageTitle').textContent=group==='home'?'כל הכלים שלך':selected.title;
 document.getElementById('efPageDescription').textContent=group==='home'?'כל הלשוניות, במקום מסודר אחד':selected.description;
 const shown=filter?groups:group==='home'?groups:[selected];let count=0;
 document.getElementById('efToolGroups').innerHTML=shown.map(g=>{
  const list=tools(g).filter(b=>!filter||(b.textContent+' '+g.title+(' '+(aliases[b.dataset.tab]||''))).toLocaleLowerCase().includes(filter));count+=list.length;
  if(!list.length)return '';
  const content=g.id==='players'&&!filter?playerSections.map(([title,ids])=>{
   const items=list.filter(b=>ids.includes(b.dataset.tab));
   return items.length?`<h4 class="ef-tool-subtitle">${title}</h4><div class="ef-tool-grid">${items.map(b=>toolButton(b,g)).join('')}</div>`:'';
  }).join(''):`<div class="ef-tool-grid">${list.map(b=>toolButton(b,g)).join('')}</div>`;
  return `<article class="ef-tool-card" data-category="${g.id}"><h3>${icon(g)}${esc(g.title)}</h3>${content}</article>`;
 }).join('');document.getElementById('efNoTools').hidden=count>0;
}
function paint(){
 const selected=groups.find(g=>g.id===group)||groups[0];
 for(const b of bottom.querySelectorAll('button')){const on=b.dataset.efGroup===group;b.setAttribute('aria-current',on?'page':'false');}
 const active=original.querySelector('button.active');
 document.getElementById('efCurrentSection').textContent=landing?selected.title:(active?.textContent||selected.title);
 document.getElementById('efCategory').hidden=landing;
 subnav.hidden=landing;
 const quick=shortcuts[group];
 subnav.innerHTML=landing?'':tools(selected).filter(b=>!quick||quick.includes(b.dataset.tab)||b===active).map(b=>`<button type="button" data-ef-tool="${esc(b.dataset.tab)}" aria-current="${b===active?'page':'false'}">${esc(b.textContent)}</button>`).join('');
 document.body.classList.toggle('ef-on-home',landing&&group==='home');
 if(landing)renderLanding();
}
function openGroup(id,focus=true,record=true){
 if(record)updateAddress(id,false);currentTool=null;
 group=id;landing=true;filter='';document.getElementById('efToolSearch').value='';
 document.querySelectorAll('.tabs button,.tab').forEach(e=>e.classList.remove('active'));home.classList.add('active');paint();
 if(focus){document.getElementById('efPageTitle').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});}
}
function openTool(id,record=true){const b=buttons().find(b=>b.dataset.tab===id);if(!b)return false;if(record)updateAddress(id,true);currentTool=id;landing=false;group=groupFor(id).id;b.click();paint();const section=document.getElementById(id);if(section){section.setAttribute('tabindex','-1');section.focus({preventScroll:true});}window.scrollTo({top:0,behavior:'auto'});return true;}
for(const root of [home,subnav])root.addEventListener('click',e=>{const b=e.target.closest('[data-ef-tool]');if(b)openTool(b.dataset.efTool);});
bottom.addEventListener('click',e=>{const b=e.target.closest('[data-ef-group]');if(b)openGroup(b.dataset.efGroup);});
document.getElementById('efAllTools').onclick=()=>openGroup('home');
document.getElementById('efCategory').onclick=()=>openGroup(group);
document.getElementById('efToolSearch').addEventListener('input',e=>{filter=e.target.value.trim().toLocaleLowerCase();renderLanding();});
// Catch original/programmatic tab activation, including tabs inserted by asynchronous modules.
new MutationObserver(()=>{const active=original.querySelector('button.active');if(active){landing=false;group=groupFor(active.dataset.tab).id;if(currentTool!==active.dataset.tab){currentTool=active.dataset.tab;updateAddress(currentTool,true);}}paint();}).observe(original,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
document.documentElement.classList.add('ef-redesign');
original.setAttribute('aria-hidden','true');
function restoreAddress(){
 const route=new URLSearchParams(location.hash.slice(1));
 const tool=route.get('tool'),area=route.get('area');
 if(tool&&openTool(tool,false))return;
 openGroup(groups.some(g=>g.id===area)?area:'home',false,false);
}
window.addEventListener('popstate',restoreAddress);
restoreAddress();
})();
