const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const I=require('../player-identity-core.js'),P=require('../personal-model-core.js');
const official=require('../data/official-offense.json'),recent=require('../data/recent-form.json'),media=require('../data/player-media.json'),market=require('../data/players.json');
const cases=[[3771,'009863'],[8567,'014124'],[4096,'012606'],[7197,'014127'],[11517,'015162'],[11494,'014728'],[11512,'014734'],[4758,'012742']];
for(const [fid,eid] of cases){const p=market.find(p=>p.fantasy_id===fid),r=I.resolve(p);assert.equal(r.euroleagueId,eid,p.name);assert.equal(I.key(p),I.key({playerCode:'P'+eid}));assert(I.lookup(official.players,p)?.games.length>0);assert(I.lookup(media.players,p)?.photo,p.name);assert(I.recentFromOfficial(I.lookup(official.players,p),I.lookup(recent.players,p)).currentSeasonGames>0);}
// These acceptance totals describe rounds 1–11, not an ever-growing season.
for(const [fid,pir,min] of [[3771,13.8181818,23.860606],[8567,14.090909,20.696969]]){const p=market.find(p=>p.fantasy_id===fid),games=I.lookup(official.players,p).games.filter(g=>g.minutes>0&&Date.parse(g.date)<Date.parse('2026-11-14T00:00:00Z'));assert.equal(games.length,11);assert(Math.abs(games.reduce((s,g)=>s+g.stats.valuation,0)/11-pir)<.01);assert(Math.abs(games.reduce((s,g)=>s+g.minutes,0)/11-min)<.01);}
assert.equal(I.key('Talen Horton-Tucker'),I.key('HORTON TUCKER, TALEN'));
assert.notEqual(I.key('Wade Baldwin'),I.key('Kamar Baldwin'));
assert.notEqual(I.key('Wade Baldwin'),I.key('Patrick Baldwin Jr'));
assert.equal(I.resolve({fantasy_id:3771,playerCode:'014124'}),null);
assert.equal(I.lookup(official.players,{name:'Wade Baldwin',playerCode:'999999'}),null);
const collision=I.create({season:'E2026',players:[{key:'a',euroleagueId:'1',aliases:['Same Name']},{key:'b',euroleagueId:'2',aliases:['Same Name']}]});
assert.equal(collision.resolve('Same Name'),null);assert.equal(collision.lookup({'same name':{bad:true}},'Same Name'),null);
const profile=I.lookup(official.players,{fantasy_id:3771});const cutoff=Date.parse(profile.games[3].date);
const recovered=I.recentFromOfficial(profile,null,cutoff);assert(recovered.gameLog.every(g=>Date.parse(g.date)<cutoff));assert(!recovered.gameLog.some(g=>g.gameCode===profile.games[3].gameCode));
const empty=P.project({name:'Unknown',price:10,status:'active'},null,null,{});assert(empty.dataQuality.partial);assert.equal(empty.confidence,35);
const sandbox={};vm.createContext(sandbox);for(const f of ['player-identities.js','player-identity-core.js','personal-model-core.js','usage-core.js','official-offense-core.js','dna-core.js'])vm.runInContext(fs.readFileSync(f,'utf8'),sandbox,{filename:f});
for(const p of market){if(!['G','F','C'].includes(p.pos))continue;assert.equal(sandbox.PlayerIdentity.key(p),I.key(p));assert.equal(sandbox.UsageCore.key(p),I.key(p));assert.equal(sandbox.PersonalForecast.key(p),I.key(p));}
const py=cp.spawnSync('python',['-c',"import sys,json;sys.path.insert(0,'scripts');from player_identity import key;print(json.dumps([key(p) for p in json.load(open('data/players.json'))]))"],{encoding:'utf8'});assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout),market.map(p=>I.key(p)));
const {audit}=require('../scripts/audit_player_identities.cjs');const report=audit();assert(report.ok,JSON.stringify(report.errors));assert.equal(report.counts.players,342);
const bad=JSON.parse(fs.readFileSync('data/player-identities.json'));bad.players.push(bad.players[0]);assert(!audit({registry:bad}).ok,'Duplicate IDs must block publishing');
const wrong=JSON.parse(JSON.stringify(official));const keys=Object.keys(wrong.players);wrong.players[keys[0]].playerCode=wrong.players[keys[1]].playerCode;assert(!audit({official:wrong}).ok,'Misattribution must block publishing');
console.log('Identity: eight acceptance players, all 342 market players, browser/Node/Python parity, collision isolation, past cutoffs and corrupt-data publication gates passed.');
