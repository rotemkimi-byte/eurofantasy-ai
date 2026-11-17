/* Fail publication on identity corruption, without inventing absent observations. */
const fs=require('node:fs'),path=require('node:path');
const I=require('../player-identity-core.js'),P=require('../personal-model-core.js');
const root=path.resolve(__dirname,'..');const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
function audit({registry=read('data/player-identities.json'),market=read('data/players.json'),official=read('data/official-offense.json'),recent=read('data/recent-form.json'),media=read('data/player-media.json'),advanced=read('data/advanced-players.json')}={}){
 const errors=[],warnings=[],rows=[],resolver=I.create(registry),seen={official:new Set(),fantasy:new Set()};
 for(const r of registry.players){
  for(const [kind,id] of [['official',r.euroleagueId&&I.code(r.euroleagueId)],['fantasy',r.fantasyId&&String(r.fantasyId)]])if(id){if(seen[kind].has(id))errors.push({kind:'duplicate-'+kind,id});seen[kind].add(id);}
  for(const a of [r.officialName,r.displayName,...r.aliases].filter(Boolean))if(!resolver.resolve(a))errors.push({kind:'ambiguous-alias',name:a});
 }
 for(const [name,d] of [['official',official],['recent',recent],['media',media],['advanced',advanced]])if((d.season||d.currentSeason)!=='E2026')errors.push({kind:'wrong-season',source:name});
 const lookup=(dict,p)=>{try{return I.lookup(dict,p)}catch(e){errors.push({kind:'identity-lookup-conflict',name:p.name,message:e.message});return null;}};
 const officialIds=new Map();
 for(const [k,p] of Object.entries(official.players||{})){
  const id=I.code(p.playerCode),identity=resolver.resolve(p);
  if(officialIds.has(id))errors.push({kind:'duplicate-official-profile',id});officialIds.set(id,p);
  if(!identity||identity.key!==resolver.key(p.name))errors.push({kind:'official-id-name-conflict',id,name:p.name});
  const codes=new Set();for(const g of p.games||[]){if(codes.has(String(g.gameCode)))errors.push({kind:'duplicate-appearance',id,gameCode:g.gameCode});codes.add(String(g.gameCode));
   const box=read(`data/backtest/cache/E2026-${g.gameCode}-stats.json`);const source=['local','road'].flatMap(s=>box[s]?.players||[]).find(r=>I.code(r.player?.person?.code)===id);
   if(!source||Math.abs(source.stats.timePlayed/60-g.minutes)>1e-8||source.stats.valuation!==g.stats.valuation)errors.push({kind:'box-mismatch',id,gameCode:g.gameCode});
  }
 }
 for(const g of Object.values(advanced.games||{}))for(const p of Object.values(g.players||{})){
  const r=resolver.resolve({playerCode:p.id}),named=resolver.resolve(p.name),o=officialIds.get(I.code(p.id)),og=o?.games.find(x=>String(x.gameCode)===String(g.gameCode));
  if(!r||!named||r!==named)errors.push({kind:'advanced-id-name-conflict',id:p.id,name:p.name});
  if(og&&(P.team(p.team)!==P.team(og.team)||Math.abs(p.minutes-og.minutes)>1e-8))errors.push({kind:'advanced-appearance-conflict',id:p.id,gameCode:g.gameCode});
 }
 const legacy=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ');
 const legacyAdvanced=s=>String(s.includes(',')?s.split(',').reverse().map(x=>x.trim()).join(' '):s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(Boolean).sort().join(' ');
 const rawRecent=new Map(Object.entries(recent.players||{}).map(([k,v])=>[legacy(k),v]));
 for(const p of market.filter(p=>['G','F','C'].includes(p.pos))){
  const r=resolver.resolve(p);if(!r){errors.push({kind:'market-without-identity',fantasyId:p.fantasy_id,name:p.name});continue;}
  const o=lookup(official.players,p),f=lookup(recent.players,p),m=lookup(media.players,p),recovered=I.recentFromOfficial(o,f),games=(o?.games||[]).filter(g=>g.minutes>0).length;
  if(o&&r.euroleagueId&&I.code(o.playerCode)!==I.code(r.euroleagueId))errors.push({kind:'market-official-id-conflict',name:p.name,id:r.euroleagueId,actual:o.playerCode});
  if(r.euroleagueId&&!o)errors.push({kind:'linked-without-official-data',name:p.name,id:r.euroleagueId});
  if(m?.playerCode&&r.euroleagueId&&I.code(m.playerCode)!==I.code(r.euroleagueId))errors.push({kind:'wrong-photo-identity',name:p.name});
  if(games&&!recovered?.currentSeasonGames)errors.push({kind:'unjustified-price-fallback',name:p.name,games});
  if(!r.euroleagueId)warnings.push({kind:'no-current-official-record',name:p.name,status:p.status});
  if(!m?.photo)warnings.push({kind:'no-photo',name:p.name});
  rows.push({name:p.name,fantasyId:p.fantasy_id,euroleagueId:r.euroleagueId,games,registered:o?.games?.length||0,recentGames:recovered?.currentSeasonGames||0,photo:!!m?.photo,advancedGames:r.euroleagueId?Object.values(advanced.games).filter(g=>Object.values(g.players||{}).some(x=>I.code(x.id)===I.code(r.euroleagueId)&&x.minutes>0)).length:0,officialJoinFixed:!!o&&!official.players[legacy(p.name)],recentJoinFixed:!!f&&!rawRecent.has(legacy(p.name)),photoJoinFixed:!!m&&!media.players[legacy(p.name)],advancedSelectorFixed:!!o&&legacyAdvanced(p.name)!==legacyAdvanced(o.name),officialRecovery:!!recovered?.identityRecovered,partial:!games});
 }
 return {schema:'player-identity-integrity-v1',season:'E2026',ok:!errors.length,counts:{players:rows.length,linked:rows.filter(r=>r.euroleagueId).length,withoutOfficial:rows.filter(r=>!r.euroleagueId).length,officialJoinFixed:rows.filter(r=>r.officialJoinFixed).length,recentJoinFixed:rows.filter(r=>r.recentJoinFixed).length,photoJoinFixed:rows.filter(r=>r.photoJoinFixed).length,officialRecovery:rows.filter(r=>r.officialRecovery).length,advancedSelectorFixed:rows.filter(r=>r.advancedSelectorFixed).length,affectedIdentities:rows.filter(r=>r.officialJoinFixed||r.recentJoinFixed||r.photoJoinFixed||r.officialRecovery||r.advancedSelectorFixed).length,partial:rows.filter(r=>r.partial).length},errors,warnings,players:rows};
}
module.exports={audit};
if(require.main===module){const report=audit();fs.mkdirSync(path.join(root,'data/integrity'),{recursive:true});fs.writeFileSync(path.join(root,'data/integrity/player-identities.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,counts:report.counts,errors:report.errors}));if(!report.ok)process.exitCode=1;}
