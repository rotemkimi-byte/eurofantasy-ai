(()=>{
'use strict';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Jerusalem'});
const image=url=>{
 const src=playerCardImageUrl(url);
 return src?'<img src="'+esc(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'';
};
function crest(team,url){
 const key=canonicalTeam(team);
 return '<span class="ef-game-crest" data-crest-team="'+esc(key)+'" aria-hidden="true">'+image(url||playerCardCrests.get(key))+
  '<b>'+esc(TEAM_KITS[key]?.[0]||'')+'</b></span>';
}
function card({game,heading,values=[]}){
 const timestamp=Date.parse(game?.date);
 const venue=game?.home===true?'בית':game?.home===false?'חוץ':'';
 return `<div class="ef-chart-game-card">${heading?`<bdi class="ef-chart-game-heading">${esc(heading)}</bdi>`:''}
  ${game?`<div class="ef-chart-game-identity">
   ${game.opponent?crest(game.opponent):''}
   <div><strong><bdi>${esc(game.opponent||'יריבה לא ידועה')}</bdi></strong>
    <small>${Number.isFinite(timestamp)?`<time dir="ltr" datetime="${esc(game.date)}">${date.format(timestamp)}</time>`:''}
    ${game.round?`<span>מחזור ${esc(game.round)}</span>`:''}
    ${venue?`<span class="pirGameVenue" data-home="${game.home}">${venue}</span>`:''}</small></div>
  </div>`:''}
  ${window.PlayerAnalysis.metrics(values.map(([label,value])=>[label,value??'—']))}
 </div>`;
}
document.addEventListener('fantasy-player-media-ready',()=>{
 for(const mark of document.querySelectorAll('.ef-game-crest[data-crest-team]:not(:has(img))')){
  mark.insertAdjacentHTML('afterbegin',image(playerCardCrests.get(mark.dataset.crestTeam)));
 }
});
document.addEventListener('error',event=>{
 if(event.target.matches?.('.ef-game-crest img,.pmHistoryPhoto img'))event.target.remove();
},true);
window.ChartGameCard={render:card,crest,image};
})();
