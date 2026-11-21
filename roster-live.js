(() => {
  'use strict';
  const api = 'https://fantaking-api.dunkest.com/api/v1';
  const syncButton = document.getElementById('refreshSquad');
  const historyButton = document.getElementById('squadOrigin');
  const status = document.getElementById('squadSyncStatus');
  const tabs = document.getElementById('teamView');
  let current, previous, preview = false, pending;
  let directRetry = 0;
  const readStorage = (key, store = 'localStorage') => {
    try { return window[store].getItem(key); } catch { return null; }
  };
  const read = async (url, token) => {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      ...(token ? {headers: {Authorization: 'Bearer ' + token}} : {})
    });
    if (!response.ok) throw new Error('Roster HTTP ' + response.status);
    return response.json();
  };
  const resolveNames = (names, pool) => {
    const index = new Map(pool.map(p => [window.PlayerIdentity.key(p.name), p.name]));
    return names.map(name => index.get(window.PlayerIdentity.key(name)) || name);
  };

  window.SquadRoster = {
    preview: () => preview ? previous : null,
    coach: () => current?.coach,
    current: () => current,
    resolveNames
  };

  function valid(roster) {
    return Number(roster?.team_id) > 0 && Array.isArray(roster.players) && roster.players.length > 0;
  }

  async function connectedRoster(teamId, token) {
    const config = await read(api + '/leagues/10/config');
    const league = config.data || config;
    const md = league.current_matchday;
    if (!(Number(md?.id) > 0)) throw new Error('Missing Fantasy matchday');
    async function load(day, historical) {
      const path = api + '/fantasy-teams/' + teamId + '/matchdays/' + Number(day.id) + '/roster';
      for (const url of historical ? [path] : [path + '/preview', path]) {
        const data = (await read(url, token).catch(() => null))?.data;
        const names = data?.players?.map(p => [p.first_name,p.last_name].filter(Boolean).join(' ').trim() || p.name || p.label).filter(Boolean);
        if (!names?.length) continue;
        const balance = ['available_credits','remaining_credits','credits_remaining','credits_available','remaining_budget']
          .map(key => data[key]).find(v => v != null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v)) && Number(v) >= 0);
        return {team_id:teamId, matchday_id:Number(day.id), matchday_number:Number(day.number),
          players:names, available_credits:balance == null ? null : Number(balance), updated_at:new Date().toISOString()};
      }
      return null;
    }
    const result = await load(md, false);
    if (!result) throw new Error('Roster unavailable');
    const schedule = await window.loadGameData('context/E2026-schedule.json', true).catch(() => null);
    const rounds = new Map();
    for (const game of schedule?.data || []) {
      if (game.season?.code !== 'E2026' || !Number(game.round)) continue;
      const round = Number(game.round);
      rounds.set(round, (rounds.get(round) ?? true) && game.played === true);
    }
    const completed = Math.max(0, ...[...rounds].filter(([, done]) => done).map(([round]) => round));
    const historical = league.matchdays?.find(day => Number(day.number) === completed);
    result.completed_matchday_id = Number(historical?.id) || null;
    if (result.completed_matchday_id && completed <= Number(md.number)) {
      result.previous = current?.previous?.matchday_id === Number(historical.id) && String(current.team_id) === teamId
        ? current.previous : await load(historical, true);
    }
    return result;
  }

  function paint() {
    historyButton.textContent = preview ? 'חזור לתצוגת אמת' : 'חזור למקור';
    historyButton.setAttribute('aria-pressed', String(preview));
    document.getElementById('clearTeam').disabled = preview;
    status.textContent = preview ? 'תצוגת סימולציה · הסגל ששיחק במחזור ' + previous.matchday_number
      : current ? 'סגל אמת · מחזור ' + current.matchday_number + ' · עודכן ב־' +
        new Date(current.updated_at).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'})
      : 'ממתין לסנכרון עם Fantasy';
  }

  function apply(roster, force = false) {
    const before = current;
    current = {...roster, coach:resolveNames(roster.players, COACHES).find(n => COACHES.some(c => c.name === n))};
    const historical = valid(roster.previous) && String(roster.previous.team_id) === String(roster.team_id)
      && Number(roster.previous.matchday_number) > 0 && Number(roster.previous.matchday_number) <= Number(roster.matchday_number)
      ? roster.previous : null;
    if (historical || !before || String(before.team_id) !== String(roster.team_id) ||
        (roster.completed_matchday_id && Number(previous?.matchday_id) !== Number(roster.completed_matchday_id))) previous = historical;
    if (preview && !previous) preview = false;
    const names = resolveNames(roster.players, players);
    const canonicalChanged = before && JSON.stringify(before.names) !== JSON.stringify(names);
    current.names = names;
    const snapshot = JSON.stringify([roster.team_id, roster.matchday_id, [...roster.players].sort()]);
    const changed = cachedValue('efa2_roster_snapshot', null) !== snapshot;
    cacheValue('efa2_roster_snapshot', JSON.stringify(snapshot));
    try { localStorage.setItem('efa2_roster_sync', roster.updated_at); } catch {}
    const overriding = cachedValue('efa2_optimizer_roster_override', null) === snapshot;
    const already = JSON.stringify(myTeam) === JSON.stringify(names);
    if ((force || !overriding) && (changed || !before || canonicalChanged || (force && !already))) {
      if (force) cacheValue('efa2_optimizer_roster_override', 'null');
      myTeam = names;
      if (current.coach && (force || !before || changed || before.coach !== current.coach)) {
        squadPreferences.coach = current.coach;
        squadSave();
      }
      cacheValue(LS.team, JSON.stringify(myTeam));
      renderAll();
    } else if (preview && historical) renderTeam();
    paint();
    document.dispatchEvent(new Event('fantasy-roster-updated'));
  }

  function refresh(force = false) {
    if (pending) return pending;
    const team = readStorage('efa2_fantasy_team_id');
    const token = readStorage('efa_fantasy_token') || readStorage('efa_fantasy_token', 'sessionStorage');
    pending = (async () => {
      syncButton.disabled = true;
      try {
        let roster;
        if (/^\d+$/.test(team || '') && token && (force || Date.now() >= directRetry)) {
          roster = await connectedRoster(team, token).catch(() => {
            directRetry = Date.now() + 5 * 60 * 1000;
            return null;
          });
        }
        if (!valid(roster)) {
          const published = await read('./data/roster.json?t=' + Date.now());
          if (!team || String(published.team_id) === team) roster = published;
          else {
            const all = await read('./data/rosters.json?t=' + Date.now());
            const selected = all.teams?.find(entry => String(entry.team_id) === team);
            if (selected) roster = {...all, ...selected};
          }
        }
        if (!valid(roster)) throw new Error('No roster for the selected team');
        if (current && String(current.team_id) === String(roster.team_id) &&
            Date.parse(current.updated_at) > Date.parse(roster.updated_at)) {
          const fallback = roster.previous;
          const usableHistory = !current.previous && fallback?.matchday_number <= current.matchday_number &&
            (!current.completed_matchday_id || Number(fallback.matchday_id) === current.completed_matchday_id);
          apply(usableHistory ? {...current, previous:fallback} : current, force);
        } else apply(roster, force);
        return true;
      } catch {
        if (!preview) status.textContent = 'הסגל לא התרענן כרגע. אפשר לנסות שוב.';
        return false;
      } finally {
        syncButton.disabled = false;
      }
    })().finally(() => { pending = null; });
    return pending;
  }

  syncButton.addEventListener('click', () => void refresh(true));
  historyButton.addEventListener('click', async () => {
    if (!previous) {
      historyButton.disabled = true;
      status.textContent = 'טוען את הסגל מהמחזור האחרון…';
      try { await refresh(); } finally { historyButton.disabled = false; }
      if (!previous) {
        status.textContent = 'הסגל הרשמי של המחזור האחרון עדיין לא זמין.';
        return;
      }
    }
    if (!preview) tabs.querySelector('[data-team-view="forecast"]').click();
    preview = !preview;
    paint();
    renderTeam();
  });
  tabs.addEventListener('click', event => {
    if (!event.target.closest('button') || !preview) return;
    preview = false;
    paint();
    renderTeam();
  }, true);
  document.querySelector('[data-tab="team"]').addEventListener('click', () => void refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  window.addEventListener('focus', () => void refresh());
  window.addEventListener('pageshow', () => void refresh());
  setInterval(() => { if (!document.hidden) void refresh(); }, 60 * 1000);
  document.addEventListener('fantasy-live-updated', () => void refresh());
  void refresh();
})();
