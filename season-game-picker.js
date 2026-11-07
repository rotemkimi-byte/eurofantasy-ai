(()=>{
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'});
const ranges=[['0','כל העונה'],['3','ממוצע 3 משחקים'],['history','משחקי עבר']];
const latestFirst=(a,b)=>Date.parse(b.date)-Date.parse(a.date)||Number(b.code)-Number(a.code);

function picker(root,list,onChange){
 let current='0';
 root.innerHTML='<div class="season-ranges" role="group" aria-label="טווח משחקים">'+ranges.map(([value,label])=>
  `<button type="button" class="season-choice" data-season-range="${value}" aria-pressed="${value==='0'}">${label}</button>`).join('')+'</div>';
 const history=root.querySelector('[data-season-range="history"]');
 history.setAttribute('aria-controls',list.id);
 function show(open){
  list.hidden=!open;
  history.setAttribute('aria-expanded',String(open));
 }
 function set(value){
  current=value;
  for(const button of root.querySelectorAll('[data-season-range]')){
   button.setAttribute('aria-pressed',String(button.dataset.seasonRange===value));
  }
  show(value==='history');
 }
 function focusHistory(){
  history.focus({preventScroll:true});
  history.scrollIntoView({block:'nearest'});
 }
 set(current);
 root.onclick=e=>{
  const value=e.target.closest('[data-season-range]')?.dataset.seasonRange;
  if(value===undefined)return;
  if(value===current){
   if(value!=='history')return;
   show(list.hidden);
   onChange(false);
   return;
  }
  set(value);onChange(true);
 };
 list.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  e.preventDefault();
  show(false);focusHistory();
 });
 function games(rows,selected,onPick,extraTitle,emptyMessage='אין משחקים שהסתיימו העונה בסינון שנבחר.'){
  list.innerHTML=rows.length?`<p class="season-list-note">${rows.length} משחקים · מהחדש לישן</p>
  <div class="season-game-scroll" tabindex="0" role="region" aria-label="משחקי עבר בגלילה">
  <ul class="season-game-list">${[...rows].sort(latestFirst).map(g=>`<li>
  <button type="button" class="season-choice season-game" data-season-game="${escape(g.code)}" aria-pressed="${String(g.code)===selected}">
  <time dir="ltr" datetime="${escape(g.date)}">${date.format(new Date(g.date))}</time>
  <span class="season-game-teams"><bdi>${escape(g.team)}</bdi> מול <bdi>${escape(g.opponent)}</bdi></span>
  <bdi class="season-game-detail" dir="ltr"><span class="season-game-label">${escape(extraTitle)}</span> ${escape(g.detail??'—')}</bdi>
  </button></li>`).join('')}</ul></div>`
  :`<p class="season-list-note">${escape(emptyMessage)}</p>`;
  list.onclick=e=>{
   const code=e.target.closest('[data-season-game]')?.dataset.seasonGame;
   if(!code)return;
   show(false);onPick(code);focusHistory();
  };
 }
 return {get value(){return current;},get expanded(){return !list.hidden;},set,games,focusHistory};
}
window.SeasonGamePicker={picker,latestFirst};
})();
