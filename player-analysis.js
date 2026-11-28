(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=n=>Number.isFinite(n)?n.toFixed(1):'—';
const ordered=(rows,get)=>[...rows].sort((a,b)=>(get(b)??-Infinity)-(get(a)??-Infinity)||a.name.localeCompare(b.name));
function source(p){
 if(!p||typeof p!=='object')return p;
 if(p.fantasyId!=null||p.fantasy_id!=null||p.playerCode!=null||p.euroleagueId!=null||p.official_id!=null)return p;
 const id=String(p.id??'');
 return /^P\d+$/i.test(id)||/^0\d{5}$/.test(id)?{...p,playerCode:id}:p;
}
function resolve(target){
 const pool=typeof players==='undefined'?[]:players;
 const api=window.PlayerIdentity;
 const input=source(target);
 if(input?.officialOnly)return input;
 const record=api.resolve(input);
 const fantasyId=input?.fantasy_id??input?.fantasyId??record?.fantasyId;
 if((input?.playerCode||input?.euroleagueId||input?.official_id)&&!record)return null;
 if(fantasyId!=null){
  const matches=pool.filter(p=>String(p.fantasy_id)===String(fantasyId));
  if(matches.length===1&&(!input?.playerCode||record))return matches[0];
 }
 if(record?.fantasyId!=null){
  const cached=pool.filter(p=>p.fantasy_id==null&&p.name===record.displayName);
  if(cached.length===1)return {...cached[0],fantasyId:record.fantasyId};
 }
 if(!record?.euroleagueId)return null;
 return {name:record.displayName||record.officialName,team:record.currentTeam||record.teamHistory.at(-1)?.team||'',playerCode:record.euroleagueId,officialOnly:true};
}
function profileKey(player){
 const p=resolve(player);
 if((p?.fantasy_id??p?.fantasyId)!=null)return 'fantasy:'+(p.fantasy_id??p.fantasyId);
 if(p?.playerCode)return 'official:'+p.playerCode;
 return '';
}
function open(player,compact=false){
 const key=profileKey(player);
 if(!key)return false;
 const [kind,id]=key.split(':');
 window.showPlayer(kind==='fantasy'?{fantasyId:id}:{playerCode:id},compact);
 return true;
}
function attrs(player,compact=false){
 const key=profileKey(player);
 return key?`data-player-profile="${esc(key)}" data-profile-compact="${compact}"`:'';
}
function control(player,body,cls='',compact=false){
 const target=attrs(player,compact);
 return target?`<button type="button" class="pa-profile-link ${cls}" ${target} aria-label="פרופיל ${esc(player.name)}">${body}</button>`:`<span class="${cls}">${body}</span>`;
}
const image=url=>url?'<img src="'+esc(url)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'';
function identity(player){
 const club=typeof canonicalTeam==='function'?canonicalTeam(player.team):player.team;
 const color=(typeof TEAM_KITS!=='undefined'&&TEAM_KITS[club]?.[1])||'#536783';
 const profile=typeof playerCardProfile==='function'?playerCardProfile(player):null;
 const photo=typeof playerCardImageUrl==='function'?playerCardImageUrl(profile?.photo):null;
 const crest=typeof playerCardCrests==='undefined'?null:playerCardCrests.get(club);
 return `<span class="pa-identity" style="--pa-club:${color}">
  ${control(player,`<span class="pa-portrait" aria-hidden="true">${typeof squadJersey==='function'?squadJersey(player):''}${image(photo)}</span>
  <span class="pa-person"><b><bdi>${esc(player.name)}</bdi></b><span class="pa-club">${image(crest)}<bdi>${esc(club||'קבוצה לא זמינה')}</bdi></span></span>`,'pa-identity-link')}
 </span>`;
}
function profile(player,{meta='',action='',stat=''}={}){
 return `<div class="pa-profile">${identity(player)}${action||stat}${meta?'<div class="pa-profile-meta">'+meta+'</div>':''}</div>`;
}
function metrics(items,{panel='',cell='',player=''}={}){
 if(!items.length)return '';
 return `<div class="pa-stat-panel ${panel}"${player?` data-recent-player="${esc(player)}"`:''}><dl class="pa-metrics">${items.map(([label,stat,note,tone,valueClass])=>{
  const negative=tone==='negative'||/^[\s\u200e\u200f]*[-−]\d/.test(String(stat));
  return `<div class="${cell}"${negative?' data-tone="negative"':''}><dt>${esc(label)}${note?`<small>${esc(note)}</small>`:''}</dt><dd><strong><bdi${valueClass?` class="${esc(valueClass)}"`:''}>${esc(stat)}</bdi></strong></dd></div>`;
 }).join('')}</dl></div>`;
}
let origin;
document.addEventListener('click',event=>{
 const trigger=event.target.closest('[data-player-profile]');if(!trigger)return;
 const [kind,id]=trigger.dataset.playerProfile.split(':');
 const target=kind==='fantasy'?{fantasyId:id}:{playerCode:id};
 const player=resolve(target);if(!player)return;
 event.preventDefault();
 event.stopPropagation();
 const modal=document.getElementById('playerModal');
 if(trigger.matches('[data-market-player],[data-pop-player],.pop-player,.fc-media,.fc-name'))window.playerToolSelection?.set(player.name);
 if(!modal.open)origin={trigger,top:window.scrollY,left:window.scrollX,tab:trigger.closest('.tab')};
 window.showPlayer(target,trigger.dataset.profileCompact==='true');
},true);
document.getElementById('playerModal')?.addEventListener('close',()=>{
 if(!origin)return;
 const {trigger,tab,top,left}=origin;origin=null;
 const replacement=trigger.isConnected?trigger:[...tab?.querySelectorAll('[data-player-profile]')||[]].find(b=>b.dataset.playerProfile===trigger.dataset.playerProfile&&b.getClientRects().length);
 replacement?.focus({preventScroll:true});
 window.scrollTo({top,left,behavior:'instant'});
});
document.addEventListener('error',event=>{
 if(event.target.matches?.('.pa-identity img'))event.target.remove();
},true);
function create(host,{metrics,rows,team=()=>'',initial=Object.keys(metrics)[0],format=value,comparisonScale,renderComparison,renderRanking}){
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
    ${selected.length?(comparisonCards(selected)+(renderComparison?'<div class="pc-chart" data-pa-comparison></div>':'')):'<p class="muted">בחר עד ארבעה שחקנים. אפשר לבחור שחקנים מקבוצות שונות.</p>'}`;
   if(selected.length&&renderComparison)renderComparison(host.querySelector('[data-pa-comparison]'),selected);
   return;
  }
  const club=team(),filtered=all.filter(r=>(!club||r.team===club)&&(!cap||(r.price!==null&&r.price<=Number(cap))));
  const ranked=ordered(filtered,r=>sort==='price'?r.price:r.values[metric]);
  host.innerHTML=`<div class="pa-sort" role="group" aria-label="סדר הטבלה"><button type="button" data-pa-sort="metric" aria-pressed="${sort==='metric'}">לפי המדד ↓</button><button type="button" data-pa-sort="price" aria-pressed="${sort==='price'}">לפי קרדיט ↓</button></div>
   <div class="pa-controls">${measure()}<label>קרדיט מקסימלי<select data-pa-cap><option value="">ללא הגבלה</option>${[5,7,9,12,15].map(n=>`<option value="${n}" ${String(n)===cap?'selected':''}>עד ${n} CR</option>`).join('')}</select></label></div>
   ${ranked.length?(renderRanking?renderRanking(ranked,sort):''):'<p class="muted">אין שחקנים במסנן שנבחר.</p>'}
   ${ranked.length?rankingTable(ranked):''}`;
  if(host.closest('.performance-tool'))window.PerformanceControls.styleButtons(host.querySelector('.pa-sort'),'data-pa-sort');
 }
 function comparisonBars(selected){
  const maximum=comparisonScale[metric]??Math.ceil(Math.max(1,...selected.map(r=>r.values[metric]??0)));
  return `<figure class="pa-comparison-bars">
   <figcaption>${esc(metrics[metric])}</figcaption>
   <div class="pa-comparison-axis" aria-hidden="true"><span>${esc(format(maximum,metric))}</span><span>${esc(format(0,metric))}</span></div>
   <ul>${selected.map(r=>{
    const n=r.values[metric];
    const width=Number.isFinite(n)?Math.max(0,Math.min(100,100*n/maximum)):0;
    return `<li class="pa-comparison-row">${identity(r)}
     <strong class="pa-comparison-number"><bdi>${esc(format(n,metric))}</bdi></strong>
     <div class="pa-comparison-bar" aria-hidden="true"><i style="inline-size:${width}%"></i></div>
    </li>`;
   }).join('')}</ul>
  </figure>`;
 }
 function comparisonCards(selected){
  if(comparisonScale)return comparisonBars(selected);
  const maximum=Math.max(1,...selected.map(r=>Math.abs(r.values[metric]??0)));
  return `<div class="pa-compare-list" aria-label="${esc(metrics[metric])}">${selected.map(r=>{
   const n=r.values[metric];
   const bar=Number.isFinite(n)?`<span class="pa-compare-track" aria-hidden="true"><i style="width:${Math.abs(n)/maximum*100}%" data-negative="${n<0}"></i></span>`:'';
   return `<article class="pa-compare-card">${identity(r)}${window.PlayerAnalysis.metrics([[metrics[metric],format(n,metric),value(r.price)+' CR']],{panel:'pa-compare-value'})}${bar}</article>`;
  }).join('')}</div>`;
 }
 function rankingTable(ranked){
  const more=ranked.length>limit?'<button type="button" data-pa-more>הצג עוד שחקנים</button>':'';
  const content=table(ranked.slice(0,limit))+more;
  return renderRanking?`<details data-pa-ranking-table><summary>טבלת דירוג מלאה</summary>${content}</details>`:content;
 }
 function table(list){
  return `<div class="pa-table-wrap"><table class="pa-table"><thead><tr><th scope="col">שחקן</th><th scope="col">${esc(metrics[metric])}</th><th scope="col">קרדיט</th></tr></thead><tbody>${list.map(r=>`<tr><th scope="row">${identity(r)}</th><td dir="ltr" class="pa-rank-value" data-tone="${r.values[metric]<0?'negative':''}">${esc(format(r.values[metric],metric))}</td><td dir="ltr"><bdi class="pa-credit">${Number.isFinite(r.price)?value(r.price)+' CR':'—'}</bdi></td></tr>`).join('')}</tbody></table></div>`;
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
  render();
  const controls=host.querySelector('.pa-controls');
  controls.tabIndex=-1;
  controls.focus({preventScroll:true});
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
window.PlayerAnalysis={create,mount,identity,profile,metrics,source,resolve,open,control,attrs};
})();
