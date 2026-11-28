(function (root) {
'use strict';

const season = 'E2026';
const positions = {1:'G', 2:'F', 3:'C'};
const number = value => Number.isFinite(value) ? value : null;
const sum = (rows, read) => rows.reduce((total, row) => total + read(row), 0);
const mean = rows => rows.length ? sum(rows, x => x) / rows.length : null;
const order = (a, b) => a.date - b.date || a.code - b.code;
const fields = {
  points:'points', rebounds:'totalRebounds', assists:'assistances', blocks:'blocksFavour',
  steals:'steals', drawn:'foulsReceived', turnovers:'turnovers', fouls:'foulsCommited',
  blocked:'blocksAgainst', made2:'fieldGoalsMade2', missed2:'fieldGoalsAttempted2',
  made3:'fieldGoalsMade3', missed3:'fieldGoalsAttempted3', madeFT:'freeThrowsMade',
  missedFT:'freeThrowsAttempted'
};
const scores = {
  '2FGM':['made2',2], '3FGM':['made3',3], FTM:['madeFT',1],
  '2FGA':['missed2'], '3FGA':['missed3'], FTA:['missedFT'],
  O:['rebounds'], D:['rebounds'], AS:['assists'], FV:['blocks'], ST:['steals'],
  RV:['drawn'], TO:['turnovers'], CM:['fouls'], OF:['fouls'], AG:['blocked']
};
const negative = ['turnovers','fouls','blocked','missed2','missed3','missedFT'];
const positive = ['points','rebounds','assists','blocks','steals','drawn'];
const pir = stats => sum(positive,k => stats[k]) - sum(negative,k => stats[k]);
const empty = () => Object.fromEntries(Object.keys(fields).map(k => [k,0]));

function scheduleGames(schedule, canonical, now = Date.now()) {
  const games = new Map();
  for (const game of schedule?.data || []) {
    const date = Date.parse(game.utcDate);
    const home = game.local?.club, away = game.road?.club;
    if (game.season?.code !== season || game.played !== true || !(date <= now) ||
        !Number.isInteger(game.gameCode) || !home?.name || !away?.name) continue;
    games.set(game.gameCode, {code:game.gameCode, date, round:game.round,
      home:canonical(home.name), away:canonical(away.name), homeCode:home.code, awayCode:away.code,
      homeAbbr:home.tvCode, awayAbbr:away.tvCode,
      homeScore:number(game.local.score), awayScore:number(game.road.score)});
  }
  return games;
}

function gameLogs(data, schedule, key) {
  if (data?.season !== season) throw Error('Unexpected game log season');
  const logs = new Map();
  for (const game of Object.values(data.games || {})) {
    const fixture = schedule.get(game.gameCode);
    if (!fixture) continue;
    for (const row of game.rows || []) {
      if (row.season !== season || !row.name || !(number(row.minutes) > 0) || number(row.pir) === null) continue;
      const id = key(row.name);
      if (!id) continue;
      if (!logs.has(id)) logs.set(id, []);
      const entries = logs.get(id);
      if (!entries.some(g => g.code === fixture.code)) entries.push({...fixture, minutes:row.minutes, pir:row.pir});
    }
  }
  for (const rows of logs.values()) rows.sort(order);
  return logs;
}

function boxPlayers(game, box, displayName) {
  if (!box?.local?.players || !box?.road?.players) return [];
  return ['local','road'].flatMap(side => box[side].players.flatMap(({player,stats}) => {
    const person = player?.person;
    const home = side === 'local';
    const club = home ? game.homeCode : game.awayCode;
    if (player?.season?.code !== season || player.club?.code !== club || !person?.code || !person.name ||
        !(number(stats?.timePlayed) > 0)) return [];
    const metrics = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, number(stats[field])]));
    for (const [missed,made] of [['missed2','made2'],['missed3','made3'],['missedFT','madeFT']]) {
      if (metrics[missed] !== null && metrics[made] !== null) metrics[missed] -= metrics[made];
    }
    return [{
      code:person.code, rawName:person.name, name:displayName(person.name),
      short:person.jerseyName?.trim() || person.name.split(',')[0],
      jerseyNumber:player.dorsal ?? '', pos:positions[player.position],
      team:home ? game.home : game.away, club, home, starter:stats.startFive === true,
      pir:number(stats.valuation), seconds:stats.timePlayed, metrics
    }];
  }));
}

// Carry the on-court five between periods. Period-start substitutions are
// explicitly logged at 10:00 (5:00 in overtime) and apply to the next interval.
function onCourt(game, roster, feed) {
  if (feed?.Live !== false || feed.CodeTeamA?.trim() !== game.homeCode ||
      feed.CodeTeamB?.trim() !== game.awayCode) return null;
  const periods = ['FirstQuarter','SecondQuarter','ThirdQuarter','ForthQuarter'].map(k => feed[k]);
  if (periods.some(p => !Array.isArray(p) || !p.length)) return null;
  for (const play of feed.ExtraTime || []) {
    const end = /^(EP|EG)$/.test(play.PLAYTYPE?.trim());
    const period = 4 + Math.floor((play.MINUTE - 41 - Number(end)) / 5);
    if (!Number.isInteger(period) || period < 4 || period > 12) return null;
    (periods[period] ||= []).push(play);
  }
  const byCode = new Map(roster.map(p => [p.code,p]));
  const floor = new Set(roster.filter(p => p.starter).map(p => p.code));
  const totals = new Map(roster.map(p => [p.code,{seconds:0, metrics:empty(), valid:true}]));
  const stints = [], actions = [];
  let elapsed = 0;
  function advance(end) {
    if (end < elapsed) return false;
    if (end === elapsed) return true;
    if (floor.size !== 10 || [...floor].filter(code => byCode.get(code).home).length !== 5) return false;
    const lineup = new Set(floor);
    stints.push({seconds:end-elapsed, lineup});
    for (const code of floor) totals.get(code).seconds += end-elapsed;
    elapsed = end;
    return true;
  }
  let start = 0;
  for (let i=0; i<periods.length; i++) {
    const period = periods[i], duration = i<4 ? 600 : 300;
    if (!period?.length || !period.some(p => /^(EP|EG)$/.test(p.PLAYTYPE?.trim()))) return null;
    // The feed occasionally lists a corrected action after a later clock.
    // Keep feed order for equal clocks, where substitutions may split actions.
    const chronological = [...period].sort((a,b) =>
      (b.MARKERTIME || '').trim().localeCompare((a.MARKERTIME || '').trim()));
    for (const play of chronological) {
      const type = play.PLAYTYPE?.trim(), id = play.PLAYER_ID?.trim().replace(/^P/,'');
      const substitution = type === 'IN' || type === 'OUT';
      const score = scores[type] || (/^CM[A-Z0-9_]+$/.test(type) ? scores.CM : null);
      if (!id || (!score && !substitution)) continue;
      const entry = totals.get(id);
      if (!entry) {
        if (substitution) return null;
        continue;
      }
      const clock = /^(\d{2}):([0-5]\d)$/.exec(play.MARKERTIME?.trim());
      if (!clock) return null;
      const remaining = Number(clock[1])*60+Number(clock[2]);
      if (remaining > duration || !advance(start+duration-remaining)) return null;
      if (substitution) {
        if (floor.has(id) === (type === 'IN')) return null;
        if (type === 'IN') floor.add(id);
        else floor.delete(id);
      } else {
        const [stat,points = 0] = score;
        entry.metrics[stat]++;
        entry.metrics.points += points;
        if (!floor.has(id)) entry.valid = false;
        actions.push({id,stat,points,lineup:new Set(floor)});
      }
    }
    start += duration;
    if (!advance(start)) return null;
  }
  for (const p of roster) {
    const t = totals.get(p.code);
    t.minutesValid = Math.abs(t.seconds-p.seconds) <= 5;
    t.scoreValid = t.valid && p.pir === pir(t.metrics) &&
      Object.keys(fields).every(key => p.metrics[key] === t.metrics[key]);
  }
  return {totals, stints, actions};
}

function matchOpponents(own, rivals, timeline) {
  const rotation = rivals.filter(p => own.pos && p.pos === own.pos && p.pir !== null)
    .sort((a,b) => Number(b.starter === own.starter)-Number(a.starter === own.starter) ||
      b.seconds-a.seconds || a.code.localeCompare(b.code));
  const fallback = rotation[0];
  if (!fallback) return {rival:null, overlap:null};
  if (timeline?.totals.get(own.code)?.minutesValid && rotation.every(p => timeline.totals.get(p.code)?.minutesValid)) {
    const pairs = rotation.map(rival => ({
      rival, overlap:sum(timeline.stints, s => s.lineup.has(own.code) && s.lineup.has(rival.code) ? s.seconds : 0)
    })).sort((a,b) => b.overlap-a.overlap);
    const best = pairs[0];
    if (best.overlap > 0) {
      if (!timeline.totals.get(best.rival.code).scoreValid) return best;
      const metrics = empty();
      for (const a of timeline.actions) {
        if (a.id !== best.rival.code || !a.lineup.has(own.code)) continue;
        metrics[a.stat]++;
        metrics.points += a.points;
      }
      return {...best, stint:{pir:pir(metrics), metrics}};
    }
    return {rival:fallback, overlap:0};
  }
  return {rival:fallback, overlap:null};
}

function select(rows, range, venue) {
  const eligible = rows.filter(row => venue === 'all' || row.home === (venue === 'home'));
  return range === 'all' ? eligible : eligible.slice(-Number(range));
}

function sample(rows, seasonRows, mode, defense) {
  const rate = mode === 'rate';
  const ownRate = sum(seasonRows,r => r.pir) / sum(seasonRows,r => r.minutes);
  const ownAverage = rate ? (seasonRows.length ? ownRate*40 : null) : mean(seasonRows.map(r => r.pir));
  const points = rows.map(row => {
    const value = rate ? row.pir*40/row.minutes : row.pir;
    const normal = defense ? (row.priorRate === null ? null : row.priorRate*(rate?40:row.minutes)) : ownAverage;
    const delta = normal === null ? null : value-normal;
    const direction = delta === null || Math.abs(delta) <= 1 ? 'near' : delta > 0 ? 'above' : 'below';
    const tone = direction === 'near' ? 'near' : (direction === (defense?'below':'above')?'good':'bad');
    return {...row, value, normal, delta, direction, tone};
  });
  const comparable = points.filter(p => p.normal !== null);
  const reference = defense ? mean(comparable.map(p => p.normal)) : ownAverage;
  return {points, reference, comparable:comparable.length,
    difference:mean(comparable.map(p => p.delta)), actual:mean(points.map(p => p.value)),
    above:points.filter(p => p.direction === 'above').length, below:points.filter(p => p.direction === 'below').length};
}

function prior(rows, game) {
  const before = (rows || []).filter(row => row.date < game.date);
  return {priorCount:before.length, priorAverage:mean(before.map(r => r.pir)),
    priorRate:before.length ? sum(before,r => r.pir) / sum(before,r => r.minutes) : null};
}

const api = {scheduleGames, gameLogs, boxPlayers, onCourt, matchOpponents, select, sample, prior};
if (typeof module === 'object' && module.exports) module.exports = api;
else root.SquadHistoryCore = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
