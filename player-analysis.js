(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=n=>Number.isFinite(n)?n.toFixed(1):'—';
const ordered=(rows,get)=>[...rows].sort((a,b)=>(get(b)??-Infinity)-(get(a)??-Infinity)||a.name.localeCompare(b.name));
function create(host,{metrics,rows,team=()=>'',initial=Object.keys(metrics)[0],format=value,renderComparison,renderRanking}){
 let metric=initial,mode='detail',sort='metric',cap='',limit=40,picks=[];
 const measure=()=>Object.keys(metrics).length>1?`<label>מדד<select data-pa-metric>${Object.entries(metrics).map(([key,label])=>`<option value="${esc(key)}" ${key===metric?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`:'';
 function render(){
  if(mode==='detail')return;
  const all=rows();
  if(mode==='compare'){
   const byPrice=ordered(all,r=>r.price),selected=picks.map(id=>all.find(r=>String(r.id)===id)).filter(Boolean);
   picks=selected.map(p=>String(p.id));
   host.innerHTML=`<div class="pa-controls">${measure()}<label>הוסף להשוואה<select data-pa-add ${picks.length>=4?'disabled':''}><option value="">בחר שחקן מהרשימה</option>${byPrice.filter(r=>!picks.includes(String(r.id))).map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${esc(r.team)} · ${value(r.price)} CR</option>`).join('')}</select></label></div>
    <div class="pa-picks">${selected.map(r=>`<button type="button" data-pa-remove="${esc(r.id)}" aria-label="הסר ${esc(r.name)}"><bdi>${esc(r.name)}</bdi> ×</button>`).join('')}</div>
    ${selected.length?(renderComparison?'<div class="pc-chart" data-pa-comparison></div>':table(selected)):'<p class="muted">בחר עד ארבעה שחקנים. אפשר לבחור שחקנים מקבוצות שונות.</p>'}`;
   if(selected.length&&renderComparison)renderComparison(host.querySelector('[data-pa-comparison]'),selected);
   return;
  }
  const club=team(),filtered=all.filter(r=>(!club||r.team===club)&&(!cap||(r.price!==null&&r.price<=Number(cap))));
  const ranked=ordered(filtered,r=>sort==='price'?r.price:r.values[metric]);
  host.innerHTML=`<div class="pa-sort" role="group" aria-label="סדר הטבלה"><button type="button" data-pa-sort="metric" aria-pressed="${sort==='metric'}">לפי המדד ↓</button><button type="button" data-pa-sort="price" aria-pressed="${sort==='price'}">לפי קרדיט ↓</button></div>
   <div class="pa-controls">${measure()}<label>קרדיט מקסימלי<select data-pa-cap><option value="">ללא הגבלה</option>${[5,7,9,12,15].map(n=>`<option value="${n}" ${String(n)===cap?'selected':''}>עד ${n} CR</option>`).join('')}</select></label></div>
   ${ranked.length?(renderRanking?renderRanking(ranked,sort):''):'<p class="muted">אין שחקנים במסנן שנבחר.</p>'}
   ${ranked.length?rankingTable(ranked):''}`;
 }
 function rankingTable(ranked){
  const more=ranked.length>limit?'<button type="button" data-pa-more>הצג עוד שחקנים</button>':'';
  const content=table(ranked.slice(0,limit))+more;
  return renderRanking?`<details data-pa-ranking-table><summary>טבלת דירוג מלאה</summary>${content}</details>`:content;
 }
 function table(list){
  return `<div class="pa-table-wrap"><table class="pa-table"><thead><tr><th scope="col">שחקן</th><th scope="col">${esc(metrics[metric])}</th><th scope="col">קרדיט</th></tr></thead><tbody>${list.map(r=>`<tr><th scope="row"><bdi>${esc(r.name)}</bdi><small>${esc(r.team)}</small></th><td dir="ltr">${esc(format(r.values[metric],metric))}</td><td dir="ltr">${value(r.price)}</td></tr>`).join('')}</tbody></table></div>`;
 }
 host.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  const {paSort,paRemove,paMore}=button.dataset;
  if(paSort){sort=paSort;limit=40;}
  else if(paRemove){picks=picks.filter(id=>id!==paRemove);}
  else if(paMore!==undefined){limit+=40;}
  else return;
  render();
  if(paSort)host.querySelector(`[data-pa-sort="${sort}"]`)?.focus({preventScroll:true});
  if(paMore!==undefined&&renderRanking)host.querySelector('[data-pa-ranking-table]').open=true;
 });
 host.addEventListener('change',e=>{
  const input=e.target;
  if(input.matches('[data-pa-metric]')){metric=input.value;limit=40;}
  else if(input.matches('[data-pa-cap]')){cap=input.value;limit=40;}
  else if(input.matches('[data-pa-add]')&&input.value&&picks.length<4&&!picks.includes(input.value)){picks.push(input.value);}
  else return;
  const field=input.getAttributeNames().find(name=>name.startsWith('data-pa-'));
  render();
  if(field)host.querySelector(`[${field}]`)?.focus({preventScroll:true});
 });
 return {render,show(next){mode=next;render();}};
}
function mount(section,anchor,output,details,config){
 const views=config.views||[['detail','תצוגה אישית'],['ranking','טבלה כללית'],['compare','השוואה']];
 const nav=document.createElement('div'),panel=document.createElement('div');
 nav.className='pa-views';nav.setAttribute('role','group');nav.setAttribute('aria-label','תצוגת הכלי');
 nav.innerHTML=views.map(([id,label])=>`<button type="button" data-pa-view="${id}" aria-pressed="${id==='detail'}">${label}</button>`).join('');
 panel.className='pa-panel';panel.hidden=true;
 anchor.after(nav);output.after(panel);
 for(const element of details)element.classList.add('pa-detail');
 const ui=create(panel,config);
 nav.addEventListener('click',e=>{
  const b=e.target.closest('[data-pa-view]');if(!b)return;
  const mode=b.dataset.paView;
  section.classList.toggle('pa-expanded',mode!=='detail');
  panel.hidden=mode==='detail';
  for(const control of nav.children)control.setAttribute('aria-pressed',String(control===b));
  ui.show(mode);
 });
 return ui;
}
window.PlayerAnalysis={create,mount};
})();
