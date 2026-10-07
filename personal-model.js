(async () => {
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const requestOptions = () => ({cache: 'no-store',
    ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? {signal: AbortSignal.timeout(8000)} : {})});
  let history = null;
  try {
    const response = await fetch('./data/player-history.json', requestOptions());
    if (response.ok) history = await response.json();
  } catch (error) { console.warn('Personal history unavailable', error); }
  if (history?.schema !== 'player-history-v1' || history.season !== 'E2025' ||
      history.currentSeason !== 'E2026' || history.complete !== true) history = null;
  for (let i = 0; i < 150 && !window.__recentFormPatched; i++) await pause(100);
  if (typeof model !== 'function' || !window.PersonalForecast) {
    window.__personalModelReady = true; return;
  }
  const previous = model;
  const form = window.__recentFormData?.currentSeason === 'E2026' ? window.__recentFormData.players || {} : {};
  const byKey = Object.fromEntries(Object.entries(form).map(([k, v]) => [PersonalForecast.key(k), v]));
  // Reconstruct only current-season played games; the three-games card stays E2026-only.
  let gameData = null;
  try {
    const response = history?.config?.momentum?.active === true ?
      await fetch('./data/euroleague-live-E2026.json', requestOptions()) : null;
    if (response?.ok) gameData = await response.json();
  } catch (error) { console.warn('Momentum game log unavailable', error); }
  const logs = {};
  if (gameData?.season === 'E2026') for (const game of Object.values(gameData.games || {})) {
    for (const row of game.rows || []) {
      if (row.season !== 'E2026' || Number(row.minutes) <= 0) continue;
      const k = PersonalForecast.key(row.name);
      (logs[k] ||= []).push({...row, date: row.date || game.date, gameCode: row.gameCode || game.gameCode});
    }
  }
  for (const [k, rows] of Object.entries(logs)) {
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.gameCode - b.gameCode);
    logs[k] = rows.filter((g, i) => rows.findIndex(x => x.gameCode === g.gameCode) === i);
  }
  window.__playerHistory = history;
  model = function (p) {
    const x = previous(p), k = PersonalForecast.key(p.name);
    const recent = byKey[k] ? {...byKey[k], gameLog: logs[k] || []} : null;
    const h = history?.players?.[k];
    const injury = PersonalForecast.opportunity(p, players);
    Object.assign(x, injury);
    const position = window.__positionDefense?.[PersonalForecast.team(x.match?.opponent || p.opponent)]?.[p.pos];
    const positionPct = (Number(position?.factor || 1) - 1) * 100;
    const teamPct = (Math.max(.92, Math.min(1.08, 1 + (Number(x.match?.teamPoints ?? 84) - 84) * .006)) - 1) * 100;
    Object.assign(x, {positionMatchPct: positionPct, positionMatchup: position || null, teamMatchPct: teamPct});
    const projection = PersonalForecast.project(p, recent, h, {
      injuryBoost: injury.injuryBoost, injuryUsagePct: injury.injuryUsagePct,
      margin: x.match?.margin, teamPct, positionPct
    }, history?.config);
    Object.assign(x, projection, {recentForm: recent, livePrice: Number(p.price), rangeSample: null});
    const uncertainty = 1 - Math.min(84, 40 + projection.currentSeasonGames * 5) / 100;
    x.floor = projection.expected * (.6 - .25 * uncertainty);
    x.ceiling = projection.expected * (1.35 + .4 * uncertainty);
    x.value = projection.expected / Math.max(.1, Number(p.price));
    x.personalModel = true;
    return x;
  };
  window.__personalModelReady = true;
  if (typeof renderAll === 'function') renderAll();
})();
