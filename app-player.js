/* Player timeline uses the existing official season feed and chart renderer. */
(()=>{
'use strict';
const original=window.showPlayer;if(typeof original!=='function')return;
window.showPlayer=function(name){
 original.apply(this,arguments);
 const body=document.getElementById('modalBody');if(!body||!window.PIRHistoryCore)return;
 const section=document.createElement('section');section.className='playerSection ef-player-history';
 section.innerHTML='<h3 class="sectionTitle">מגמת ביצועים · PIR</h3><div class="ef-chart-ranges" role="group" aria-label="טווח גרף"><button type="button" data-range="3" aria-pressed="false">3 משחקים</button><button type="button" data-range="5" aria-pressed="true">5 משחקים</button><button type="button" data-range="0" aria-pressed="false">כל העונה</button></div><p class="ef-chart-status muted" role="status">טוען משחקים…</p><div class="pirChart" dir="ltr"></div><p class="ef-chart-detail muted" aria-live="polite"></p>';
 body.querySelector('.actual-results')?.before(section);
 let rows=[],range=5,selected=[];
 const chart=section.querySelector('.pirChart'),status=section.querySelector('.ef-chart-status'),detail=section.querySelector('.ef-chart-detail');
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const date=d=>new Date(d).toLocaleDateString('he-IL',{day:'numeric',month:'numeric'});
 function describe(g){detail.textContent=g?`${date(g.date)} · ${g.value===null?'PIR לא זמין':'PIR '+g.value.toFixed(1)} · ${g.minutes===null?'דקות לא זמינות':g.minutes.toFixed(1)+' דקות'}`:'';}
 function render(){
  selected=range?rows.slice(-range):rows;
  for(const b of section.querySelectorAll('[data-range]'))b.setAttribute('aria-pressed',String(Number(b.dataset.range)===range));
  chart.innerHTML=window.PIRHistoryCore.svgChart(selected,'PIR בפועל · עונת 2026/27');
  status.textContent=rows.length?'תוצאות בפועל · מהישן לחדש':'אין משחקים זמינים בעונת 2026/27';
  describe(selected.at(-1));requestAnimationFrame(()=>{if(chart.isConnected)chart.scrollLeft=chart.scrollWidth;});
 }
 section.addEventListener('click',e=>{const b=e.target.closest('[data-range]');if(b){range=Number(b.dataset.range);render();}const point=e.target.closest('[data-pir-index]');if(point)describe(selected[Number(point.dataset.pirIndex)]);});
 section.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-pir-index]')){e.preventDefault();e.target.closest('[data-pir-index]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 lastThreeFetch('./data/euroleague-live-E2026.json').then(data=>{
  if(!section.isConnected)return;if(data.season!=='E2026')throw Error('wrong season');
  const key=lastThreeName(name),seen=new Set();
  rows=Object.values(data.games||{}).flatMap(g=>(g.rows||[]).filter(r=>r.season==='E2026'&&lastThreeName(r.name)===key).map(r=>({code:r.gameCode||g.gameCode,date:r.date||g.date,minutes:finite(r.minutes)?Number(r.minutes):null,value:Number(r.minutes)>0&&finite(r.pir)?Number(r.pir):null,opponent:r.opponent||'',round:r.round||g.round}))).filter(g=>{if(seen.has(g.code)||!Number.isFinite(Date.parse(g.date))||Date.parse(g.date)>Date.now())return false;seen.add(g.code);return true;}).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.code-b.code);
  render();
 }).catch(()=>{if(section.isConnected)status.textContent='נתוני הגרף לא זמינים כרגע. אפשר לסגור ולפתוח את השחקן כדי לנסות שוב.';});
};
})();
