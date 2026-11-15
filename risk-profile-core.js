(function (root) {
'use strict';
const node = typeof module === 'object' && module.exports;
const M = node ? require('./dna-player-core.js') : root.PlayerDnaMetrics;
const D = node ? require('./dna-core.js') : root.DnaCore;
const T = node ? require('./team-metrics-core.js') : root.TeamMetricsCore;
const F = node ? require('./free-throws.js') : root.FreeThrowsCore;
const A = node ? require('./advanced-player-core.js') : root.AdvancedPlayerCore;
const U = node ? require('./usage-core.js') : root.UsageCore;
const season = 'E2026';
const version = 1;
const finite = Number.isFinite;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
const difference = (a, b) => finite(a) && finite(b) ? a - b : null;
const positions = {G:'Guard', F:'Forward', C:'Center'};
const metrics = [...M.catalog, ...M.addedMetrics];
const spec = new Map(metrics.map(m => [m.id,m]));
const endpoints = ['low','miss5','miss10'];
const outcome = {
 low: (actual) => actual <= 10,
 miss5: (actual, expected) => actual <= expected - 5,
 miss10: (actual, expected) => actual <= expected - 10
};

const families = {
 stability: ['pirStability','pirVar','pirGap'],
 line: ['ftPoints','lineFit'],
 zones: ['threePoints','paintPoints','matchFit'],
 possession: ['missPct','tovPct'],
 position: ['pirWeakness','positionLow','peerLow','pace'],
 rotation: ['minuteGap','minVar','minutesDependence','usageTrend','absenceEffect','availability'],
 calendar: ['venueGap','daysOff','weekMinutes']
};
const featureIds = Object.values(families).flat();
const factorLabels = {
 pirGap:['ממוצע PIR לעומת התחזית','PIR'], minuteGap:['פער דקות ביחס לממוצע','דק׳'], lineFit:['התאמת הגעה לקו מול היריבה','נק׳ אחוז'],
 positionLow:['10 PIR ומטה מול היריבה','%'], peerLow:['10 PIR ומטה לפרופילים דומים','%'],
 usageTrend:['שינוי ב־Usage','נק׳ אחוז'], absenceEffect:['השפעת היעדרות חבר מרכזי','PIR ל־40 דק׳'],
 availability:['סטטוס שחקן',''], venueGap:['פער PIR בבית או בחוץ','PIR'],
 daysOff:['זמן מהמשחק האחרון','ימים'], weekMinutes:['דקות בשבעת הימים שלפני המשחק','דק׳'],
 fta:['ניסיונות עונשין למשחק',''], turnovers:['איבודים למשחק','']
};

function prepare(official, advanced, asOf, options = {}) {
 const context = M.seasonContext(official, advanced, asOf, options);
 // Use the core's verified fixtures as the common boundary for the team tools.
 const teamData = {...official, players:official?.players || {}, teamResults:[...context.games.values()]};
 const teamModel = D.build(teamData, context.events, T, asOf, options.teamEvents);
 const byName = new Map();
 for (const record of context.players.values()) {
  const key = D.key(record.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(record);
 }
 const rivals = M.buildRivals(context);
 const foulRates = [...rivals.values()].map(r => r.rows)
  .filter(r => r.length && r.every(g => finite(g.own?.foulsCommited) && g.minutes > 0))
  .map(r => 40*r.reduce((s,g) => s+g.own.foulsCommited,0)/r.reduce((s,g) => s+g.minutes,0));
 return {context, teamModel, byName, rivals, leagueFouls:mean(foulRates), profiles:new Map(),
  peerProfiles:new Map(), venueRivals:new Map()};
}

function reportFor(data, record, team, position) {
 const key = record.id + '|' + team + '|' + position;
 if (!data.profiles.has(key)) {
  data.profiles.set(key, M.summarize({...record, team, position}, data.context));
 }
 const report = data.profiles.get(key);
 return {...report, stats:{...report.stats}, position:positions[position] || report.position};
}

function describe(data, player, fixture, forecast) {
 const record = data.byName.get(D.key(player.name));
 const p = record?.length === 1 ? record[0] : {id:null};
 const report = reportFor(data, p, player.team, player.pos);
 const {games, stats} = report;
 const {opponent, home, neutral, start} = fixture;
 const venue = neutral || typeof home!=='boolean' ? 'all' : home ? 'away' : 'home';
 if (!data.venueRivals.has(venue)) data.venueRivals.set(venue, M.buildRivals(data.context,{venue}));
 M.opponentReport(report,data.context,data.rivals,opponent,player.team,data.teamModel);
 // Matchup features use the opponent's full season. The venue split stays
 // available as supporting evidence, with its own sample.
 const venueReport = {...report, stats:{...stats}};
 M.opponentReport(venueReport,data.context,data.venueRivals.get(venue),opponent,player.team,data.teamModel,{venue});
 const rows = {};
 const set = (id,value,count,unit,details = [], total = count) => {
  const [label, fallbackUnit] = factorLabels[id] || [spec.get(id)?.label,spec.get(id)?.unit];
  if (finite(value) && count > 0) rows[id] = {id,label,value,count,total,unit:unit ?? fallbackUnit,details};
 };
 for (const m of metrics) {
  const s = stats[m.id];
  if (s) set(m.id,s.value,s.count,m.unit,s.details || [],s.total);
 }
 const minutes = mean(games.map(g => g.minutes));
 const ft = F.summary(games), neg = A.negative(games);
 set('fta',ft.fta,ft.coverage[0],'');
 set('turnovers',neg.turnovers.mean,neg.turnovers.covered,'');
 const opponentRows = data.context.positional.get(opponent+'|'+report.position) || [];
 const regulars = opponentRows.filter(g => g.minutes >= 20);
 const cohort = (id,list,details) => {
  const low = list.filter(g => g.stats.valuation <= 10).length;
  if (list.length) set(id,100*low/list.length,list.length,'%',[[details,low+' מתוך '+list.length,'']]);
 };
 cohort('positionLow',regulars,'הופעות בעמדה ב־20 דקות ומעלה');
 if (rows.pirWeakness && finite(venueReport.stats.pirWeakness?.value) && !neutral) {
  rows.pirWeakness.details = [[home?'כשהיריבה שיחקה בחוץ':'כשהיריבה שיחקה בבית',
   venueReport.stats.pirWeakness.value,'PIR ל־40 דק׳'],['משחקי יריבה בפיצול',venueReport.stats.pirWeakness.count,'']];
 }
 // Compare players by position, minute role and scoring mix known at the cutoff.
 // Leave out their games versus this opponent when describing their style.
 if (games.length >= 3 && finite(stats.ftPoints?.value) && finite(stats.threePoints?.value)) {
  const nearest = [];
  for (const peer of data.context.players.values()) {
   if (peer.id === p.id) continue;
   const against = regulars.filter(g => peer.games.includes(g));
   if (!against.length) continue;
   const other = peer.games.filter(g => g.minutes > 0 && g.opponent !== opponent);
   if (other.length < 3) continue;
   const peerKey = peer.id+'|'+opponent;
   if (!data.peerProfiles.has(peerKey)) data.peerProfiles.set(peerKey,
    M.summarize({...peer,team:other[0].team},{...data.context,players:new Map([[peer.id,{...peer,games:other}]])}));
   const comparison = data.peerProfiles.get(peerKey);
   const ftShare = comparison.stats.ftPoints.value, threeShare = comparison.stats.threePoints.value;
   if (!finite(ftShare) || !finite(threeShare)) continue;
   const role = mean(comparison.games.map(g => g.minutes));
   const distance = Math.hypot((role-minutes)/10,(ftShare-stats.ftPoints.value)/20,
    (threeShare-stats.threePoints.value)/25);
   nearest.push({distance,against,id:peer.id});
  }
  nearest.sort((a,b) => a.distance-b.distance || a.id.localeCompare(b.id));
  cohort('peerLow',nearest.slice(0,5).flatMap(p => p.against),'עד חמישה דומים בעמדה, בדקות ובתמהיל קליעה');
 }
 const fouls = stats.allowedFouls, league = data.leagueFouls;
 if (fouls?.count && finite(stats.ftPoints?.value) && league > 0) {
  set('lineFit',stats.ftPoints.value*(fouls.value/league-1),fouls.count,
   'נק׳ אחוז',[['עבירות יריבה ל־40 דקות',fouls.value,''],['ממוצע קבוצות',league,'']]);
 }
 set('minuteGap',difference(forecast.minutes,minutes),games.length,'דק׳',[['ממוצע עונתי',minutes,'דק׳']]);
 if (games.length >= 6) {
  const recent = U.summarize(games.slice(0,3)).regular, prior = U.summarize(games.slice(3)).regular;
  if (recent.covered === 3 && prior.covered === games.length-3) {
   set('usageTrend',difference(recent.value,prior.value),games.length,'נק׳ אחוז',
    [['שלוש הופעות אחרונות',recent.value,'%'],['יתר ההופעות',prior.value,'%']]);
  }
 }
 const absent = forecast.missingStars || [];
 const mate = stats.teammateDependence;
 if (mate?.details?.length && absent.some(name => D.key(name) === D.key(mate.details[0][0].split(' · ')[0]))) {
  set('absenceEffect',mate.value,mate.count,'PIR ל־40 דק׳',mate.details);
 }
 if (['active','questionable','out'].includes(player.status)) {
  set('availability',player.status==='active'?0:1,1,'',
   [[player.status==='questionable'?'בספק':player.status==='out'?'בחוץ':'כשיר','עדכון סגל','']]);
 }
 const pirs = games.filter(g => finite(g.stats.valuation));
 const seasonPir = mean(pirs.map(g => g.stats.valuation));
 set('pirGap',difference(seasonPir,forecast.expected),pirs.length,'PIR',[['PIR ממוצע',seasonPir,'']]);
 const sameVenue = pirs.filter(g => !g.neutral && g.home === home);
 if (!neutral && sameVenue.length >= 2) {
  const inVenue = mean(sameVenue.map(g => g.stats.valuation));
  set('venueGap',difference(inVenue,seasonPir),sameVenue.length,'PIR',
   [[home?'ממוצע בית':'ממוצע חוץ',inVenue,'PIR']]);
 }
 if (games.length && finite(start)) {
  const day = 86400000;
  set('daysOff',(start-Date.parse(games[0].date))/day,1,'ימים');
  const week = games.filter(g => start-Date.parse(g.date) <= 7*day);
  set('weekMinutes',week.reduce((s,g) => s+g.minutes,0),games.length,'דק׳',
   [['הופעות בשבוע שלפני המשחק',week.length,'']]);
 }
 const values = Object.fromEntries(featureIds.map(id => [id,rows[id]?.value ?? null]));
 for (const id of ['positionLow','peerLow']) if ((rows[id]?.count || 0)<3) values[id]=null;
 return {rows,values,games:games.length};
}

const percentile = (sorted,p) => sorted[Math.floor((sorted.length-1)*p)];
const design = ['expected',...featureIds];
const familySize = Object.fromEntries(Object.values(families).flatMap(ids => ids.map(id => [id,ids.length])));

function vector(row, scales) {
 return [1,...scales.map(({center,spread,weight},i) => {
  const id = design[i], x = id==='expected' ? row.expected : row.values[id];
  return finite(x) && spread > 0 ? weight*clamp((x-center)/spread,-3,3) : 0;
 })];
}

function solve(matrix, target) {
 for (let j=0;j<target.length;j++) {
  const pivot = matrix[j][j];
  for (let k=j;k<target.length;k++) matrix[j][k] /= pivot;
  target[j] /= pivot;
  for (let i=0;i<target.length;i++) {
   if (i===j) continue;
   const multiplier = matrix[i][j];
   for (let k=j;k<target.length;k++) matrix[i][k] -= matrix[j][k]*multiplier;
   target[i] -= target[j]*multiplier;
  }
 }
 return target;
}

function fit(rows, kind, calibrate = true) {
 const scales = design.map(id => {
  const known = rows.map(r => id==='expected'?r.expected:r.values[id]).filter(finite);
  const center = mean(known);
  const spread = known.length >= 30 ? Math.sqrt(mean(known.map(x => (x-center)**2))) : 0;
  return {center,spread,weight:1/Math.sqrt(familySize[id] || 1)};
 });
 const n = design.length+1;
 const matrix = Array.from({length:n},(_,i) => Array.from({length:n},(_,j) => i===j && i>0 ? 25 : 0));
 const target = Array(n).fill(0);
 const truth = r => kind==='residual' ? r.actual-r.expected : Number(outcome[kind](r.actual,r.expected));
 for (const r of rows) {
  const x = vector(r,scales), y = truth(r);
  for (let i=0;i<n;i++) {
   target[i] += x[i]*y;
   for (let j=0;j<n;j++) matrix[i][j] += x[i]*x[j];
  }
 }
 const model = {scales,weights:solve(matrix,target),base:mean(rows.map(truth))};
 if (kind==='residual' || !calibrate) return model;
 const scores = rows.map(r => ({s:score(r,model),y:truth(r)})).sort((a,b) => a.s-b.s);
 model.cuts = [.25,.5,.75].map(p => percentile(scores,p).s);
 model.groups = Array.from({length:4},() => ({count:0,events:0}));
 for (const {s,y} of scores) {
  const bucket = model.groups[tier(s,model)];
  bucket.count++;
  bucket.events += y;
 }
 return model;
}

const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
const score = (row,model) => dot(vector(row,model.scales),model.weights);
const tier = (s,model) => model.cuts.filter(cut => s>cut).length;
function eventRate(group) {
 return (group.events+1)/(group.count+2);
}

function evaluate(profile, forecast, player, model) {
 const row = {expected:forecast.expected,values:profile.values};
 const valid = model?.version===version && model.season===season &&
  profile.games>=3 && finite(row.expected) && ['active','questionable'].includes(player.status);
 const risks = Object.fromEntries(endpoints.map(id => {
  const fit = valid ? model.models?.[id] : null;
  if (!fit) return [id,null];
  const level = tier(score(row,fit),fit), group = fit.groups[level];
  if (group.count<30) return [id,null];
  const validation = model.validation?.[id] || {};
  return [id,{level, sample:group.count, confidence:validation.directional?'בינונית':'נמוכה',
   probability:validation.calibrated && profile.games>=6 ? eventRate(group) : null}];
 }));
 // Independently calibrated endpoints must respect inclusion for this player.
 if (risks.miss10?.probability != null && risks.miss5?.probability != null &&
     risks.miss10.probability > risks.miss5.probability) {
  risks.miss5.probability = risks.miss10.probability = null;
 }
 if (risks.low?.probability != null) for (const [key,delta] of [['miss5',5],['miss10',10]]) {
  if (risks[key]?.probability != null &&
      (row.expected-delta <= 10 ? risks[key].probability > risks.low.probability :
       risks[key].probability < risks.low.probability)) risks[key].probability = risks.low.probability = null;
 }
 const fit = valid ? model.models?.miss5 : null;
 const x = fit ? vector(row,fit.scales) : null;
 const factors = Object.entries(families).map(([group,ids]) => {
  const members = ids.flatMap(id => {
   const stat = profile.rows[id];
   const index = featureIds.indexOf(id)+2;
   return stat && x && row.values[id]!=null && x[index] ? [{stat,effect:x[index]*fit.weights[index]}] : [];
  });
  if (!members.length) return null;
  const effect = members.reduce((s,m) => s+m.effect,0);
  const representative = members.sort((a,b) => (Math.sign(b.effect)===Math.sign(effect))-(Math.sign(a.effect)===Math.sign(effect)) ||
   Math.abs(b.effect)-Math.abs(a.effect))[0];
  const supporting = {stability:['pirStability','pirVar'],line:['ftPoints','fta'],
   position:['positionLow','pirWeakness'],possession:['tovPct','turnovers']}[group] || [];
  const details = [...representative.stat.details || []];
  for (const id of supporting) {
   const stat = profile.rows[id];
   if (stat && stat.id!==representative.stat.id) details.push([stat.label,stat.value,stat.unit]);
  }
  return {...representative.stat,details,group,effect};
 }).filter(f => f && Math.abs(f.effect)>1e-8).sort((a,b) => Math.abs(b.effect)-Math.abs(a.effect));
 return {risks,factors};
}
const api = {season,version,metrics,endpoints,outcome,prepare,describe,fit,score,tier,eventRate,evaluate};
if (node) module.exports = api;
else root.PlayerRiskProfile = api;
})(globalThis);
