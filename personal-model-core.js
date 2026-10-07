/* Shared forecast implementation: browser, historical replay and regression checks. */
(function (root) {
  'use strict';
  const clip = (v, a, b) => Math.max(a, Math.min(b, v));
  const number = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const key = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).sort().join(' ');
  const priorMinutes = price => price >= 14 ? 27 : price >= 10 ? 23 : price >= 7 ? 19 : 14;
  const team = value => {
    const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const aliases = [['efes','Anadolu Efes'],['armani','Milano'],['milan','Milano'],
      ['besiktas','Besiktas'],['crvena','Crvena Zvezda'],['red star','Crvena Zvezda'],
      ['dubai','Dubai'],['barcelona','Barcelona'],['bayern','Bayern Munich'],
      ['fenerbahce','Fenerbahce'],['hapoel','Hapoel Tel Aviv'],['baskonia','Baskonia'],
      ['asvel','ASVEL'],['maccabi','Maccabi Tel Aviv'],['olympiacos','Olympiacos'],
      ['panathinaikos','Panathinaikos'],['paris','Paris'],['partizan','Partizan'],
      ['real madrid','Real Madrid'],['valencia','Valencia'],['virtus','Virtus Bologna'],
      ['zalgiris','Zalgiris'],['monaco','Monaco']];
    return aliases.find(([needle]) => text.includes(needle))?.[1] || value;
  };

  function opportunity(player, roster) {
    let injuryBoost = 0, injuryUsagePct = 0;
    const missingStars = [];
    if (player.status !== 'active') return {injuryBoost, injuryUsagePct, missingStars};
    for (const mate of roster) {
      if (mate.team !== player.team || mate.name === player.name || !['out', 'questionable'].includes(mate.status)) continue;
      const star = clip((Number(mate.price) - 8) / 7, 0, 1);
      const absence = mate.status === 'out' ? 1 : clip(1 - Number(mate.probability_of_playing ?? .5), .2, .75);
      const role = clip((Number(player.price) - 5) / 8, .35, 1), same = mate.pos === player.pos;
      injuryBoost += star * absence * role * (same ? 2.2 : .7);
      injuryUsagePct += star * absence * role * (same ? 2.4 : 1.2);
      if (star * absence >= .25) missingStars.push(mate.name);
    }
    return {injuryBoost: clip(injuryBoost, 0, 4), injuryUsagePct: clip(injuryUsagePct, 0, 6), missingStars};
  }

  function project(player, recent, history, context = {}, config = {}) {
    const price = Math.max(0, number(player.price) ?? 0);
    const priceMinutes = priorMinutes(price), priceRate = price * .93 / priceMinutes;
    const historicalGames = Math.max(0, number(history?.games) ?? 0);
    const sameTeam = !!history && history.team === player.team;
    const usableHistory = historicalGames >= 5 && number(history.pirPerMinute) !== null &&
      number(history.avgMinutes) > 0;
    const historyWeight = usableHistory ? historicalGames / (historicalGames + 8) * (sameTeam ? 1 : .55) : 0;
    const priorRate = priceRate * (1 - historyWeight) + (number(history?.pirPerMinute) ?? priceRate) * historyWeight;
    const priorMin = priceMinutes * (1 - historyWeight) + (number(history?.avgMinutes) ?? priceMinutes) * historyWeight;
    const games = recent?.latestSeason === 'E2026' ? Math.max(0, number(recent.currentSeasonGames) ?? 0) : 0;
    const currentRate = number(recent?.season?.pirPerMinute);
    const currentMin = number(recent?.season?.avgMinutes);
    const hasCurrent = games > 0 && currentRate !== null && currentMin > 0;
    const recentWeight = hasCurrent ? games / (games + 4) : 0;
    const minutesWeight = hasCurrent ? games / (games + 2) : 0;
    let rate = priorRate, observedMin = currentMin;
    if (hasCurrent) {
      let observedRate = currentRate;
      // Only nonidentical samples receive a recent-form tilt.
      if (games > 5 && number(recent.last5?.games) === 5 && number(recent.last5?.avgMinutes) > 0 &&
          number(recent.last5?.avgPir) !== null) {
        observedRate = .7 * currentRate + .3 * recent.last5.avgPir / recent.last5.avgMinutes;
        observedMin = .7 * currentMin + .3 * recent.last5.avgMinutes;
      }
      rate = priorRate * (1 - recentWeight) + observedRate * recentWeight;
    }
    const unadjustedMinutes = priorMin * (1 - minutesWeight) + (observedMin ?? priorMin) * minutesWeight;
    let minutes = unadjustedMinutes + clip(number(context.injuryBoost) ?? 0, 0, 4);
    if (player.status === 'questionable') minutes *= .82;
    if ((number(context.margin) ?? 0) >= 10) minutes *= price >= 12 ? .97 : price <= 7 ? 1.05 : 1;
    minutes = clip(minutes, 0, 36);
    const teamFactor = 1 + clip(number(context.teamPct) ?? 0, -8, 8) / 100 * .6;
    const positionFactor = 1 + clip(number(context.positionPct) ?? 0, -12, 12) / 100 * .35;
    const usageFactor = 1 + clip(number(context.injuryUsagePct) ?? 0, 0, 6) / 100;
    let expected = Math.max(0, rate * minutes * teamFactor * positionFactor * usageFactor);
    let momentumPir = 0;
    const log = recent?.gameLog;
    const latest = Array.isArray(log) ? log.slice(-2) : [];
    const baselinePir = priorRate * unadjustedMinutes;
    const hot = hasCurrent && latest.length === 2 && latest.every(g => number(g.minutes) > 0 &&
      number(g.pir) !== null && g.pir >= Math.max(20, baselinePir * 1.15));
    if (hot && config.momentum?.active === true && sameTeam) {
      const totalMin = latest.reduce((s, g) => s + g.minutes, 0);
      const hotRate = latest.reduce((s, g) => s + g.pir, 0) / totalMin;
      const coefficient = clip(number(config.momentum.coefficient) ?? 0, 0, .3);
      momentumPir = clip(coefficient * clip(hotRate - priorRate, 0, .5) * minutes, 0, expected * .15);
      expected += momentumPir;
    }
    if (player.status === 'out' || !['G', 'F', 'C'].includes(player.pos)) {
      expected = 0; minutes = 0; momentumPir = 0;
    }
    return {expected, minutes, basePir: priorRate * priorMin, baseMin: priorMin,
      personalPrior: {historicalGames: usableHistory ? historicalGames : 0, historyWeight, sameTeam,
        avgPir: usableHistory ? history.avgPir : null, avgMinutes: usableHistory ? history.avgMinutes : null,
        currentSeasonWeight: recentWeight, minutesWeight, momentumPir, momentumEnabled: config.momentum?.active === true,
        hot, streaks: history?.streaks || []},
      recentRate: rate, currentSeasonGames: games, currentSeasonWeight: recentWeight,
      source: usableHistory ? '2025/26 personal prior + 2026/27 form' : 'price prior + 2026/27 form'};
  }
  function calibrate(x, player, report, modelId) {
    const pir = number(x.expected), minutes = number(x.minutes);
    x.learning = {basePir: pir, baseMinutes: minutes, applied: false};
    const active = report?.schema === 'learning-v1' && report.season === 'E2026' && report.active &&
      report.modelId === modelId && report.validation?.active && report.validation.n >= 60 && report.validation.games >= 6;
    if (!active || player.status !== 'active' || !['G', 'F', 'C'].includes(player.pos) ||
        pir === null || minutes === null || minutes < 5) return x;
    const c = report.coefficients?.[player.pos];
    if (!c || number(c.minutes) === null || number(c.efficiencyPir) === null) return x;
    const newMinutes = clip(minutes + clip(c.minutes, -2, 2), 5, 36);
    const expected = clip(pir / minutes * newMinutes + clip(c.efficiencyPir, -2, 2),
      Math.max(0, pir - Math.max(1, pir * .25)), pir + Math.max(1, pir * .25));
    const delta = expected - pir;
    x.expected = expected; x.minutes = newMinutes;
    if (number(x.floor) !== null) x.floor = Math.min(expected, Math.max(0, x.floor + delta));
    if (number(x.ceiling) !== null) x.ceiling = Math.max(expected, x.ceiling + delta);
    x.value = expected / Math.max(.1, Number(player.price));
    x.learning = {basePir: pir, baseMinutes: minutes, applied: true, pirChange: delta,
      minutesChange: newMinutes - minutes, sample: c.n};
    x.source += ' + validated calibration';
    return x;
  }
  const api = {project, key, team, opportunity, calibrate};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PersonalForecast = api;
})(typeof window !== 'undefined' ? window : globalThis);
