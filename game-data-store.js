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

  const key = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().match(/[a-z0-9\u0590-\u05ff]+/g)?.sort().join(' ');
  let selected = null;
  window.playerToolSelection = {
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
