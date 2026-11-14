(function (root) {
'use strict';

const positions = {1:'G', 2:'F', 3:'C'};
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const sum = (rows, read) => rows.reduce((total, row) => total + read(row), 0);

function fixture(schedule, club, canonical, now = Date.now()) {
  return (schedule?.data || []).flatMap(game => {
    const date = Date.parse(game.utcDate);
    if (game.season?.code !== 'E2026' || game.played !== false || !(date > now) ||
        !game.local?.club?.name || !game.road?.club?.name) return [];
    const home = canonical(game.local.club.name), away = canonical(game.road.club.name);
    if (home !== club && away !== club) return [];
    return [{ team: home === club ? away : home, home: home === club, date, round: game.round }];
  }).sort((a, b) => a.date - b.date)[0] || null;
}

function gameStats(data, canonical, now = Date.now()) {
  if (data?.season !== 'E2026' || data.schema !== 'official-offense-v1') return [];
  const finished = new Map((data.teamResults || []).filter(g => Date.parse(g.date) <= now)
    .map(g => [g.gameCode, [canonical(g.home), canonical(g.away)]]));
  return Object.values(data.players || {}).flatMap(player => {
    const seen = new Set();
    return (player.games || []).flatMap(game => {
      const team = canonical(game.team), opponent = canonical(game.opponent);
      const sides = finished.get(game.gameCode);
      if (!(game.minutes > 0) || !sides?.includes(team) || !sides.includes(opponent) ||
          team === opponent || !(Date.parse(game.date) <= now) || seen.has(game.gameCode)) return [];
      seen.add(game.gameCode);
      return [{...game, team, opponent, name: player.name, pos: positions[game.position]}];
    });
  });
}

function average(rows, field) {
  const available = rows.filter(row => number(row.stats?.[field]) !== null);
  return available.length ? sum(available, r => r.stats[field]) / available.length : null;
}

function comparison(games, pos, opponent) {
  const peers = games.filter(row => row.pos === pos);
  const against = peers.filter(row => row.opponent === opponent);
  const baseline = peers.filter(row => row.opponent !== opponent);
  const shooting = rows => {
    const available = rows.filter(row => {
      const made = number(row.stats?.fieldGoalsMade2), attempts = number(row.stats?.fieldGoalsAttempted2);
      return made !== null && attempts > 0 && made >= 0 && made <= attempts;
    });
    const attempts = sum(available, r => r.stats.fieldGoalsAttempted2);
    return attempts ? 100 * sum(available, r => r.stats.fieldGoalsMade2) / attempts : null;
  };
  return {
    games: new Set(against.map(row => row.gameCode)).size,
    appearances: against.length,
    rows: [
      {label:'PIR', normal:average(baseline, 'valuation'), actual:average(against, 'valuation')},
      {label:'ריבאונדים', normal:average(baseline, 'totalRebounds'), actual:average(against, 'totalRebounds')},
      {label:'קליעה ל־2', normal:shooting(baseline), actual:shooting(against), percent:true}
    ]
  };
}

function positionPlayer(games, roster, team, pos, key) {
  const ranked = roster.filter(p => p.pos === pos && p.status === 'active').flatMap(p => {
    const rows = games.filter(g => g.team === team && key(g.name) === key(p.name));
    if (rows.length < 3) return [];
    const minutes = sum(rows, g => g.minutes) / rows.length;
    return [{
      player:p, games:rows.length, minutes,
      pir:average(rows, 'valuation'), points:average(rows, 'points'),
      rebounds:average(rows, 'totalRebounds'), blocks:average(rows, 'blocksFavour')
    }];
  }).sort((a, b) => b.minutes - a.minutes);
  return ranked[0] || null;
}

const api = { fixture, gameStats, comparison, positionPlayer };
if (typeof module === 'object' && module.exports) module.exports = api;
else root.SquadMatchup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
