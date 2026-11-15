'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const R = require('../risk-profile-core.js');
const D = require('../dna-core.js');
const P = require('../personal-model-core.js');
const root = path.resolve(__dirname,'..');
const read = file => JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8'));
const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const schedule = Object.values(read('data/learning/schedule.json')).filter(g => g.played);
const fixtures = read('data/context/E2026-schedule.json').data;
const neutral = new Set(fixtures.filter(g => g.isNeutralVenue).map(g => Number(g.gameCode)));
const cache = new Map();
const archive = file => {
 const revisions = git('log','--first-parent','--format=%H %cI','--',file).trim().split('\n').filter(Boolean)
  .map(line => line.split(' ')).map(([sha,stamp]) => [sha,Date.parse(stamp)]);
 let previous;
 return cutoff => {
  for (const [sha,stamp] of revisions) {
   if (stamp>cutoff) continue;
   const blob = git('rev-parse',sha+':'+file).trim();
   if (previous?.blob === blob && Date.parse(previous.data.updated_at)<=cutoff) return previous;
   if (!cache.has(blob)) {
    const data = JSON.parse(git('cat-file','blob',blob));
    cache.set(blob,data);
    // Keep the largest snapshots from accumulating over the entire season.
    if (cache.size>18) cache.delete(cache.keys().next().value);
   }
   const stored = cache.get(blob);
   const data = stored.updated_at ? stored : {...stored,updated_at:new Date(stamp).toISOString()};
   if (data.season===R.season && Date.parse(data.updated_at)<=cutoff) {
    previous = {sha,blob,data};
    return previous;
   }
  }
  return null;
 };
};
const latest = read('data/official-offense.json');
const completedFixture = new Set(latest.teamResults.map(g => Number(g.gameCode)));
const fixturesWithSnapshots = schedule.filter(g => completedFixture.has(g.gameCode) &&
 fs.existsSync(path.resolve(root,'data/learning/snapshots/E2026-'+g.gameCode+'.json')));
const through = Math.max(0,...fixturesWithSnapshots.map(g => Date.parse(g.start)));
const fixtureCount = fixturesWithSnapshots.length;
const modelArg = process.argv.find(arg => arg.startsWith('--model='));
if (modelArg && process.argv.includes('--refresh')) {
 try {
  const model = read(modelArg.slice(8));
  if (model.version===R.version && model.season===R.season &&
      model.through===through && model.fixtureCount===fixtureCount) process.exit(0);
 } catch (error) {
  if (error.code!=='ENOENT') throw error;
 }
}
const publishedOfficial = archive('data/official-offense.json');
const rawDir = 'data/backtest/cache';
const publishedBoxes = new Map();
let sha, stamp;
for (const line of git('log','--first-parent','--diff-filter=A','--format=%H %cI','--name-only','--',rawDir).split('\n')) {
 const commit = /^([a-f0-9]{40}) (.+)$/.exec(line);
 if (commit) {sha=commit[1];stamp=Date.parse(commit[2]);}
 const box = /\/E2026-(\d+)-stats\.json$/.exec(line);
 if (box) publishedBoxes.set(Number(box[1]),{sha,stamp,file:line});
}
let lastRaw;
function officialAt(cutoff) {
 if (cutoff===Infinity) return {data:latest};
 const saved = publishedOfficial(cutoff);
 const eligible = fixtures.filter(g => {
  const box = publishedBoxes.get(Number(g.gameCode));
  return g.season?.code===R.season && g.played && box?.stamp<=cutoff && Date.parse(g.utcDate)+4*3600000<=cutoff;
 });
 if (!eligible.length) return saved;
 const key = (saved?.blob || '')+'|'+eligible.map(g => g.gameCode).join(',');
 if (lastRaw?.blob===key) return lastRaw;
 const boxes = Object.fromEntries(eligible.map(g => {
  const box = publishedBoxes.get(Number(g.gameCode));
  if (!box.data) box.data=JSON.parse(git('show',box.sha+':'+box.file));
  return [g.gameCode,box.data];
 }));
 const input = JSON.stringify({cutoff:new Date(cutoff).toISOString(),schedule:{data:eligible},boxes});
 const code = 'import json,sys; from build_official_metrics import build; print(json.dumps(build(replay=json.load(sys.stdin))))';
 const raw = JSON.parse(execFileSync('python3',['-c',code],{
  cwd:path.join(root,'scripts'),input,encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}
 }));
 const official = saved?.data;
 if (official) {
  const rawGames = new Set(raw.teamResults.map(g => g.gameCode));
  raw.teamResults.push(...(official.teamResults || []).filter(g => !rawGames.has(g.gameCode)));
  raw.teamGames = {...official.teamGames,...raw.teamGames};
  const byId = new Map(Object.values(raw.players).map(p => [p.playerCode,p]));
  for (const [key,p] of Object.entries(official.players || {})) {
   const rebuilt = byId.get(p.playerCode);
   if (!rebuilt) raw.players[key] = {...p,games:p.games.filter(g => !rawGames.has(g.gameCode))};
   else rebuilt.games.push(...p.games.filter(g => !rawGames.has(g.gameCode)));
  }
 }
 for (const g of raw.teamResults) g.neutral=neutral.has(Number(g.gameCode));
 lastRaw = {blob:key,data:raw};
 return lastRaw;
}
const eventsAt = archive('data/advanced-players.json');
const dnaAt = archive('data/player-dna-events.json');
const teamAt = archive('data/team-dna-events.json');

const resultKey = (game, name, team) => [game,D.key(name),team].join('|');
function observations(official) {
 const map = new Map();
 for (const p of Object.values(official?.players || {})) for (const g of p.games) {
  if (g.minutes>0 && Number.isFinite(g.stats?.valuation)) {
   const key = resultKey(g.gameCode,p.name,g.team);
   map.set(key,map.has(key)?null:g.stats.valuation);
  }
 }
 return map;
}

const actuals = observations(latest);
const coverage = {};
const rows = [], profiles = new Map();
let contextCache;
function roundStatus(round) {
 return coverage[round] ??= {played:0,official:0,withForecast:0,withArchivedInputs:0,rows:0,gameForecasts:0,roundForecasts:0};
}
for (const game of schedule.sort((a,b) => Date.parse(a.start)-Date.parse(b.start))) {
 const status = roundStatus(game.round);
 status.played++;
 if (!completedFixture.has(game.gameCode)) continue;
 status.official++;
 const kickoff = Date.parse(game.start);
 const saves = [];
 for (const [source,file] of [
  ['game','data/learning/snapshots/E2026-'+game.gameCode+'.json'],
  ['round','data/backtest/predictions-round-'+String(game.round).padStart(2,'0')+'.json']
 ]) {
  if (!fs.existsSync(path.resolve(root,file))) continue;
  const saved = read(file), cutoff = Date.parse(saved.created_at);
  if (saved.season!==R.season || saved.round!==game.round || !(cutoff<kickoff) ||
      (source==='game' && saved.gameCode!==game.gameCode)) continue;
  saves.push({source,saved,cutoff});
 }
 if (saves.length) status.withForecast++;
 const entry = saves.map(save => ({...save,official:officialAt(save.cutoff)})).find(save => save.official);
 if (!entry) continue;
 const {cutoff,official,saved,source} = entry;
 status.withArchivedInputs++;
 status[source==='game'?'gameForecasts':'roundForecasts']++;
 const events = eventsAt(cutoff), dna = dnaAt(cutoff), team = teamAt(cutoff);
 const contextKey = [official.blob,events?.blob,dna?.blob,team?.blob].join('|');
 // Official and event snapshots already predate the cutoff. Keep the time and
 // fixture boundary explicit inside the shared player DNA core as well.
 if (contextCache?.key!==contextKey || contextCache.cutoff!==cutoff) {
  contextCache = {key:contextKey,cutoff,data:R.prepare(official.data,events?.data,cutoff,{
   pregame:true,fixtureCode:game.gameCode,dnaEvents:dna?.data,teamEvents:team?.data
  })};
 }
 const seen = new Set();
 for (const p of saved.predictions) {
  const team = P.team(p.team);
  if (team!==game.home && team!==game.away) continue;
  const home = team===game.home, opponent = home?game.away:game.home;
  if (P.team(p.opponent)!==opponent || !['active','questionable'].includes(p.status) ||
      !(p.expectedMinutes>=5) || !Number.isFinite(p.expectedPir)) continue;
  const key = resultKey(game.gameCode,p.name,team), actual = actuals.get(key);
  if (seen.has(key) || !Number.isFinite(actual)) continue;
  seen.add(key);
  const forecast = {expected:p.expectedPir,minutes:p.expectedMinutes,
   missingStars:p.algorithmInputs?.missingStars || p.detail?.missingStars};
  const profile = R.describe(contextCache.data,{...p,team},{home,opponent,start:kickoff,neutral:neutral.has(game.gameCode)},forecast);
  if (profile.games<3) continue;
  const row = {round:game.round,game:game.gameCode,cutoff,source,key,name:p.name,actual,expected:p.expectedPir,values:profile.values};
  rows.push(row);
  status.rows++;
  if (process.argv.some(a => a==='--case='+game.gameCode)) profiles.set(row,{forecast,profile,player:p});
 }
}

function trainAt(cutoff, round) {
 const known = observations(officialAt(cutoff)?.data);
 return rows.filter(r => r.round<round && r.cutoff<cutoff && Number.isFinite(known.get(r.key)))
  .map(r => ({...r,actual:known.get(r.key)}));
}
const enough = train => train.length>=120 && new Set(train.map(r => r.game)).size>=10;
const wilson = ({events,count}) => {
 const p = events/count, z = 1.96, correction = 1+z*z/count;
 const center = (p+z*z/(2*count))/correction;
 const radius = z*Math.sqrt(p*(1-p)/count+z*z/(4*count*count))/correction;
 return [center-radius,center+radius];
};
const newGroup = () => ({count:0,events:0,games:new Set(),predicted:0});
const bags = Object.fromEntries(R.endpoints.map(id => [id,{
 groups:Array.from({length:4},newGroup),brier:0,baseBrier:0,forecastBrier:0,foldWins:0,rounds:0
}]));
const effects = new Map(), folds = [], cases = [];
let absBase=0,absExperiment=0,sqBase=0,sqExperiment=0,count=0;
for (const round of [...new Set(rows.map(r => r.round))].sort((a,b) => a-b)) {
 const test = rows.filter(r => r.round===round);
 const train = trainAt(Math.min(...test.map(r => r.cutoff)),round);
 if (!enough(train)) continue;
 const models = Object.fromEntries(R.endpoints.map(id => [id,R.fit(train,id)]));
 const baselineModels = Object.fromEntries(R.endpoints.map(id => [id,R.fit(train.map(r=>({...r,values:{}})),id)]));
 const residual = R.fit(train,'residual');
 const fold = {round,train:train.length,test:test.length,maeBase:0,maeExperiment:0};
 const split = Object.fromEntries(R.endpoints.map(id => [id,{brier:0,base:0,forecast:0}]));
 for (const r of test) {
  const raw = r.actual-r.expected;
  const adjustment = Math.min(3,Math.max(-3,R.score(r,residual)));
  const adjusted = raw-adjustment;
  absBase+=Math.abs(raw);
  absExperiment+=Math.abs(adjusted);
  sqBase+=raw**2;
  sqExperiment+=adjusted**2;
  count++;
  fold.maeBase+=Math.abs(raw)/test.length;
  fold.maeExperiment+=Math.abs(adjusted)/test.length;
  const result = {};
  for (const id of R.endpoints) {
   const model = models[id], bucket = R.tier(R.score(r,model),model);
   const probabilities = R.eventRate(model.groups[bucket]);
   const hit = Number(R.outcome[id](r.actual,r.expected));
   const group = bags[id].groups[bucket];
   group.count++;
   group.games.add(r.game);
   group.events+=hit;
   group.predicted+=probabilities;
   split[id].brier+=(probabilities-hit)**2;
   split[id].base+=(model.base-hit)**2;
   const baseline = baselineModels[id];
   const baselineGroup = baseline.groups[R.tier(R.score({...r,values:{}},baseline),baseline)];
   split[id].forecast+=(R.eventRate(baselineGroup)-hit)**2;
   result[id]={bucket,hit};
  }
  const sample = profiles.get(r);
  const detail = R.evaluate(sample?.profile || {games:6,rows:Object.fromEntries(Object.keys(r.values)
   .map(id => [id,{id}])),values:r.values},sample?.forecast || {expected:r.expected},
   sample?.player || {status:'active'},{version:R.version,season:R.season,models,
    validation:{low:{},miss5:{},miss10:{}}});
  if (result.miss5.bucket>=2) {
   const group = detail.factors.filter(f => f.effect>0).slice(0,2).map(f => f.group).sort().join(' + ');
   if (group) {
    const tally = effects.get(group) || {group,count:0,events:0};
    tally.count++;
    tally.events+=result.miss5.hit;
    effects.set(group,tally);
   }
  }
  if (sample) cases.push({name:r.name,game:r.game,forecast:sample.forecast,actual:r.actual,cutoff:new Date(r.cutoff),
   games:sample.profile.games,metrics:sample.profile.rows,levels:result,topFactors:detail.factors.slice(0,6)});
 }
 for (const id of R.endpoints) {
  const bag = bags[id];
  bag.brier+=split[id].brier;
  bag.baseBrier+=split[id].base;
  bag.rounds++;
  bag.forecastBrier+=split[id].forecast;
  bag.foldWins+=Number(split[id].brier<Math.min(split[id].base,split[id].forecast));
 }
 folds.push(fold);
}
const summarized = Object.fromEntries(R.endpoints.map(id => {
 const bag = bags[id];
 const groups = bag.groups.map(g => ({n:g.count,events:g.events,games:g.games.size,
  rate:g.count?g.events/g.count:null,forecast:g.count?g.predicted/g.count:null,
  interval:g.count?wilson(g):null}));
 const high = groups.slice(2), low = groups.slice(0,2);
 const directional = bag.brier<Math.min(bag.baseBrier,bag.forecastBrier) && bag.foldWins>bag.rounds/2 &&
  groups.every((g,i) => g.n>0 && (!i || g.rate>=groups[i-1].rate));
 const calibrated = directional && count>=200 && bag.rounds>=4 && groups.every(g =>
  g.n>=40 && g.games>=12 && g.events>=10 && g.n-g.events>=10 &&
  g.forecast>=g.interval[0] && g.forecast<=g.interval[1]);
 return [id,{directional,calibrated,groups,brier:count?bag.brier/count:null,baseBrier:count?bag.baseBrier/count:null,
  forecastBrier:count?bag.forecastBrier/count:null,roundsWon:bag.foldWins,alerts:high.reduce((s,g) => s+g.n,0),
  hits:high.reduce((s,g) => s+g.events,0),falseAlerts:high.reduce((s,g) => s+g.n-g.events,0),
  missed:low.reduce((s,g) => s+g.events,0)}];
}));
const activeTrain = trainAt(Infinity,Infinity);
const runtime = {version:R.version,season:R.season,through,fixtureCount,sample:activeTrain.length,
 models:enough(activeTrain)?Object.fromEntries(R.endpoints.map(id => [id,R.fit(activeTrain,id)])):{},
 validation:Object.fromEntries(R.endpoints.map(id => [id,{
  directional:summarized[id].directional,calibrated:summarized[id].calibrated
 }]))};
for (const arg of process.argv.slice(2)) {
 if (arg.startsWith('--model=')) fs.writeFileSync(path.resolve(root,arg.slice(8)),JSON.stringify(runtime)+'\n');
}
console.log(JSON.stringify({coverage,folds,count,fitSample:runtime.sample,risks:summarized,
 forecast:{maeBefore:count?absBase/count:null,maeAfter:count?absExperiment/count:null,
  rmseBefore:count?Math.sqrt(sqBase/count):null,rmseAfter:count?Math.sqrt(sqExperiment/count):null},
 combinations:[...effects.values()].sort((a,b) => b.events-a.events),cases},null,2));
