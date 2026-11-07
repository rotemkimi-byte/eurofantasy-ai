(()=>{
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'});
const ranges=[['0','כל העונה'],['5','5 משחקים אחרונים'],['history','משחקי עבר']];
const buttons=()=>'<div class="season-ranges" role="group" aria-label="טווח משחקים">'+ranges.map(([value,label])=>
 `<button type="button" class="season-choice" data-season-range="${value}" aria-pressed="${value==='0'}">${label}</button>`).join('')+'</div>';
function picker(root,onChange){
 let current='0';
 function set(value){
  current=value;
  for(const button of root.querySelectorAll('[data-season-range]')){
   button.setAttribute('aria-pressed',String(button.dataset.seasonRange===value));
  }
 }
 root.innerHTML=buttons();
 root.onclick=e=>{
  const value=e.target.closest('[data-season-range]')?.dataset.seasonRange;
  if(value===undefined||value===current)return;
  set(value);onChange();
 };
 return {get value(){return current;},set};
}
const latestFirst=(a,b)=>Date.parse(b.date)-Date.parse(a.date)||Number(b.code)-Number(a.code);
function games(root,rows,selected,onPick,extraTitle,emptyMessage='אין משחקים שהסתיימו העונה בסינון שנבחר.'){
 root.hidden=false;
 root.innerHTML=rows.length?`<p class="season-list-note">${rows.length} משחקים · מהחדש לישן</p>
 <div class="season-game-scroll" tabindex="0" role="region" aria-label="משחקי עבר בגלילה">
 <table class="season-game-table"><thead><tr><th scope="col">תאריך</th><th scope="col">משחק</th><th scope="col">${escape(extraTitle)}</th></tr></thead>
 <tbody>${[...rows].sort(latestFirst).map(g=>`<tr><td><bdi>${date.format(new Date(g.date))}</bdi></td>
 <td><button type="button" class="season-choice season-game" data-season-game="${escape(g.code)}" aria-pressed="false">
 <bdi>${escape(g.team)}</bdi> מול <bdi>${escape(g.opponent)}</bdi></button></td>
 <td><bdi>${escape(g.detail??'—')}</bdi></td></tr>`).join('')}</tbody></table></div>`
 :`<p class="season-list-note">${escape(emptyMessage)}</p>`;
 function mark(code){
  for(const b of root.querySelectorAll('[data-season-game]')){
   b.setAttribute('aria-pressed',String(b.dataset.seasonGame===String(code)));
  }
 }
 mark(selected);
 root.onclick=e=>{
  const code=e.target.closest('[data-season-game]')?.dataset.seasonGame;
  if(!code)return;
  mark(code);onPick(code);
 };
}
window.SeasonGamePicker={picker,games,latestFirst};
})();
