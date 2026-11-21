/* One E2026 identity registry for browser and Node. No fuzzy name joins. */
(function(root){
'use strict';
const registry=typeof module!=='undefined'&&module.exports?require('./data/player-identities.json'):root.PlayerIdentityRegistry;
function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');}
const code=value=>String(value??'').trim().replace(/^P/i,'').replace(/^0+(?=\d)/,'');
function create(data){
 const records=data?.season==='E2026'?data.players||[]:[],official=new Map(),fantasy=new Map(),names=new Map();
 const add=(map,k,r)=>{if(!k)return;const a=map.get(k)||[];if(!a.includes(r))a.push(r);map.set(k,a);};
 for(const r of records){add(official,code(r.euroleagueId),r);add(fantasy,String(r.fantasyId??''),r);for(const name of [r.officialName,r.displayName,...r.aliases||[]])add(names,normalize(name),r);}
 function resolve(value){
  const p=typeof value==='string'?{name:value}:value||{},eid=p.euroleagueId??p.playerCode??p.official_id,fid=p.fantasyId??p.fantasy_id;
  const byOfficial=eid!=null?official.get(code(eid))||[]:null,byFantasy=fid!=null?fantasy.get(String(fid))||[]:null;
  if(byOfficial&&byFantasy){const both=byOfficial.filter(r=>byFantasy.includes(r));return both.length===1?both[0]:null;}
  const candidates=byOfficial||byFantasy||names.get(normalize(p.name))||[];
  return candidates.length===1?candidates[0]:null;
 }
 // Legacy dictionaries retain normalized official-name keys; identities select that
 // key via stable IDs first, keeping all consumers on the same verified mapping.
 const key=value=>{const p=resolve(value);if(p)return p.key;
  if(value&&typeof value==='object'&&(value.euroleagueId!=null||value.playerCode!=null||value.official_id!=null||value.fantasyId!=null||value.fantasy_id!=null))return 'unresolved:'+String(value.euroleagueId??value.playerCode??value.official_id??value.fantasyId??value.fantasy_id);
  const n=normalize(typeof value==='object'?value?.name:value);return (names.get(n)?.length>1?'ambiguous:':'')+n;};
 function lookup(dictionary,value){
  if(!dictionary)return null;const r=resolve(value),k=key(value);if(k.startsWith('ambiguous:')||k.startsWith('unresolved:'))return null;
  const direct=dictionary[k];if(direct){if(r?.euroleagueId&&direct.playerCode&&code(direct.playerCode)!==code(r.euroleagueId))throw Error('Conflicting official identity '+k);return direct;}
  const matches=Object.entries(dictionary).filter(([name,row])=>key(row?.playerCode?row:row?.name||name)===k);
  return matches.length===1?matches[0][1]:null;
 }
 const teamAt=(value,gameCode)=>resolve(value)?.teamHistory?.find(g=>String(g.gameCode)===String(gameCode))?.team??null;
 return {resolve,key,lookup,teamAt,records};
}
function recentFromOfficial(profile,provided,asOf=Date.now()){
 if(provided?.latestSeason==='E2026'&&Number(provided.currentSeasonGames)>0)return provided;
 const rows=(profile?.games||[]).filter(g=>g.minutes>0&&Number.isFinite(Number(g.stats?.valuation))&&Date.parse(g.date)<asOf)
  .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).map(g=>({season:'E2026',gameCode:g.gameCode,date:g.date,minutes:g.minutes,pir:Number(g.stats.valuation),team:g.team}));
 if(!rows.length)return null;
 const summarize=a=>{const minutes=a.reduce((s,g)=>s+g.minutes,0),pir=a.reduce((s,g)=>s+g.pir,0),avg=pir/a.length;return {games:a.length,avgPir:avg,avgMinutes:minutes/a.length,pirPerMinute:pir/minutes,sdPir:Math.sqrt(a.reduce((s,g)=>s+(g.pir-avg)**2,0)/a.length)};};
 return {name:profile.name,latestSeason:'E2026',currentSeasonGames:rows.length,gamesAvailable:rows.length,season:summarize(rows),last5:summarize(rows.slice(-5)),last10:summarize(rows.slice(-10)),previous4:rows.length>1?summarize(rows.slice(-5,-1)):null,lastGame:{...rows.at(-1),pirPerMinute:rows.at(-1).pir/rows.at(-1).minutes},gameLog:rows,identityRecovered:true};
}
const api={normalize,code,create,recentFromOfficial,...create(registry)};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PlayerIdentity=api;
})(typeof window!=='undefined'?window:globalThis);
