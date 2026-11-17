/* Share one request and one parsed dataset across the statistics tools. */
(() => {
  'use strict';
  const requests = new Map();
  const maxAge = 2 * 60 * 1000;
  window.loadGameData = function (path, force = false) {
    const current = requests.get(path);
    if (current && (!current.loadedAt || (!force && Date.now() - current.loadedAt < maxAge))) {
      return current.promise;
    }
    const entry = { loadedAt: 0 };
    entry.promise = fetch('./data/' + path, { cache: 'no-cache', signal: AbortSignal.timeout(25000) })
      .then(response => {
        if (!response.ok) throw new Error('Data request failed: ' + response.status);
        return response.json();
      })
      .then(data => {
        entry.loadedAt = Date.now();
        return data;
      })
      .catch(error => {
        if (requests.get(path) === entry) requests.delete(path);
        throw error;
      });
    requests.set(path, entry);
    return entry.promise;
  };

  const key = value => globalThis.PlayerIdentity.key(value);
  let selected = null;
  const creditFormat = new Intl.NumberFormat('he-IL',{maximumFractionDigits:1});
  window.playerToolSelection = {
    rows(rows, team) {
      return rows.filter(row => !team || row.team === team);
    },
    option(player, showTeam = true) {
      const price = Number(player.price);
      const amount = Number.isFinite(price) && price > 0
        ? ' · ' + creditFormat.format(price) + ' CR' : '';
      return new Option(player.name + amount + (showTeam ? ' · ' + player.team : ''),player.id);
    },
    set(name, range) {
      const id = key(name);
      if (id) selected = { id, range: ['1', '3', '0'].includes(range) ? range : selected?.range };
    },
    find(rows) {
      if (!selected) return null;
      const matches = rows.filter(row => key(row.name) === selected.id);
      return matches.length === 1 ? { row: matches[0], range: selected.range } : null;
    }
  };
})();
