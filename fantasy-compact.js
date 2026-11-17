/* Presentation only: use the shared identity registry and existing player profile. */
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function marketPlayer(p){
 const identity=root.PlayerIdentity?.resolve(p);if(!identity)return null;
 const pool=typeof players==='undefined'?[]:players;
 const matches=pool.filter(row=>root.PlayerIdentity.resolve(row)?.key===identity.key);
 return matches.length===1?matches[0]:null;
}
function teamLogo(team){
 const name=typeof canonicalTeam==='function'?canonicalTeam(team):team;
 const url=typeof playerCardCrests==='undefined'?null:playerCardCrests.get(name);
 return url?`<img class="fc-crest" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'';
}
function header(p,rank){
 const identity=root.PlayerIdentity?.resolve(p),current=marketPlayer(p);
 const media=identity&&typeof playerCardMedia!=='undefined'?playerCardMedia?.players?.[identity.key]:null;
 const photo=typeof playerCardImageUrl==='function'?playerCardImageUrl(media?.photo):null;
 const action=identity&&current?`data-fc-player="${esc(identity.key)}"`:'';
 const button=(body,cls,label)=>action?`<button type="button" class="${cls}" ${action} aria-label="${esc(label)}">${body}</button>`:`<span class="${cls}">${body}</span>`;
 const jersey=typeof squadJersey==='function'?squadJersey(p):'';
 return `<div class="fc-head">${button(`<span class="fc-photo">${photo?`<img src="${esc(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:jersey}</span>${photo?`<span class="fc-kit">${jersey}</span>`:''}`,'fc-media','פרופיל '+p.name)}<div class="fc-identity">${button(`<bdi>${esc(p.name)}</bdi>`,'fc-name','פרופיל '+p.name)}<span class="fc-meta">${teamLogo(p.team)}<bdi>${esc(p.team)}</bdi><b class="fc-position">${esc(p.pos)}</b></span></div><span class="fc-rank" aria-label="דירוג ${rank}">${rank}</span></div>`;
}
function metrics(rows){return `<div class="fc-metrics">${rows.map(([label,value,tone])=>`<div class="${tone||''}"><strong><bdi>${esc(value)}</bdi></strong><small>${esc(label)}</small></div>`).join('')}</div>`;}
root.FantasyCompactUI={header,metrics,teamLogo,marketPlayer};
if(typeof document==='undefined')return;
document.addEventListener('click',e=>{const target=e.target.closest('[data-fc-player]');if(!target)return;
 const identity=root.PlayerIdentity?.records.find(r=>r.key===target.dataset.fcPlayer),p=identity?marketPlayer({euroleagueId:identity.euroleagueId}):null;
 if(p){root.playerToolSelection?.set(p.name);root.showPlayer(p.name,true);}
});
document.addEventListener('error',e=>{if(e.target.matches?.('.fc-photo img,.fc-crest'))e.target.remove();},true);
})(typeof window==='undefined'?globalThis:window);
