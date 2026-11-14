/* Shared controls for the player performance tools. */
(()=>{
'use strict';
const views={
 detail:['bar','נתוני שחקן'],
 ranking:['sort','דירוג שחקנים'],
 compare:['scale','שחקן מול שחקן'],
 regular:['gauge','סיומי התקפה'],
 combined:['mixed','כולל אסיסטים'],
 games:['calendar','משחק אחר משחק']
};
function icon(name){
 const shape=name==='gauge'?'<path d="M3 19a9 9 0 1 1 18 0M12 14l4-5"/>':'<use href="#pir-icon-'+name+'"/>';
 return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+shape+'</svg>';
}
function decorate(button,name,description,title=button.textContent.trim()){
 const label=document.createElement('span');
 label.className='pir-control-title';
 label.textContent=title;
 const caption=document.createElement('small');
 caption.textContent=description;
 button.replaceChildren(label,caption);
 button.insertAdjacentHTML('afterbegin',icon(name));
}
function styleButtons(row,attribute){
 row.classList.add('pir-control-row');
 for(const button of row.querySelectorAll('button')){
  const value=button.getAttribute(attribute);
  const [name,description]=attribute==='data-pa-sort'||attribute==='data-us-sort'
   ? (value==='price'?['coins','מחיר מהגבוה']:['sort','ערך מהגבוה'])
   :views[value];
  decorate(button,name,description);
 }
}
function mount(section,range,{specificGames=false}={}){
 section.classList.add('performance-tool');
 const picker=section.querySelector('.player-picker-modes');
 picker.classList.add('pir-control-row','performance-picker-row');
 decorate(picker.children[0],'sort','כל השחקנים');
 decorate(picker.children[1],'shield','בחירת סגל');

 const label=range.closest('label');
 const toolbar=document.createElement('div');
 toolbar.className='pir-toolbar performance-toolbar';
 picker.before(toolbar);
 const rangeGroup=document.createElement('div');
 rangeGroup.className='pir-control-group';
 rangeGroup.setAttribute('role','group');
 rangeGroup.setAttribute('aria-label','טווח נתונים');
 rangeGroup.innerHTML='<span aria-hidden="true" class="pir-control-label">טווח נתונים</span><div class="pir-control-row pir-control-three"></div>';
 const pickerGroup=document.createElement('div');
 pickerGroup.className='pir-control-group';
 pickerGroup.innerHTML='<span aria-hidden="true" class="pir-control-label">בחירת שחקנים</span>';
 pickerGroup.append(picker);
 toolbar.append(rangeGroup,pickerGroup);

 label.hidden=true;
 let gameSelect;
 const choose=value=>{
  range.value=value;
  sync();
  range.dispatchEvent(new Event('change',{bubbles:true}));
 };
 const row=rangeGroup.lastElementChild;
 for(const [value,name,title,description] of [
  ['1','calendar','משחק אחד','אחרון'],
  ['3','layers','3 משחקים','אחרונים'],
  ['0','trophy','עונה שלמה','2026/27']
 ]){
  if(![...range.options].some(option=>option.value===value))continue;
  const button=document.createElement('button');
  button.type='button';
  button.dataset.performanceRange=value;
  decorate(button,name,description,title);
  button.onclick=()=>choose(value);
  row.append(button);
 }
 if(specificGames){
  const gameLabel=document.createElement('label');
  gameLabel.className='performance-game-picker';
  gameLabel.textContent='משחק מסוים';
  gameSelect=document.createElement('select');
  gameSelect.onchange=()=>choose(gameSelect.value||'1');
  gameLabel.append(gameSelect);
  label.after(gameLabel);
 }
 function sync(){
  for(const button of row.children)button.setAttribute('aria-pressed',String(button.dataset.performanceRange===range.value));
  if(gameSelect)gameSelect.value=range.value.startsWith('game:')?range.value:'';
 }
 function updateGames(){
  const games=[...range.options].filter(option=>option.value.startsWith('game:'));
  gameSelect.closest('label').hidden=!games.length;
  gameSelect.replaceChildren(new Option('בחר לפי תאריך או יריבה',''),...games.map(option=>option.cloneNode(true)));
  sync();
 }
 if(specificGames){
  updateGames();
  new MutationObserver(updateGames).observe(range,{childList:true});
 }
 range.addEventListener('change',sync);
 sync();
 const nav=section.querySelector('.pa-views');
 if(nav)styleButtons(nav,'data-pa-view');
 return sync;
}
window.PerformanceControls={mount,styleButtons};
})();
