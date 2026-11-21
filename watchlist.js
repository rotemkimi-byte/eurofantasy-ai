(() => {
  'use strict';
  const key = 'efa2_watchlist_E2026';
  const root = document.getElementById('watchlistRows');
  function updateProfile() {
    document.querySelector('[data-watch-toggle]')?.dispatchEvent(new Event('watchlist-change'));
  }
  const stableKey = p => window.PlayerIdentity.key(p.name);
  const records = () => {
    const stored = cachedValue(key, []);
    return Array.isArray(stored) ? stored : [];
  };
  const find = (entry, pool) => entry && pool.find(p => stableKey(p) === entry.id || p.name === entry.name);
  const has = player => records().some(entry => find(entry, [player]));
  const number = v => v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(1);
  const stat = (label, value) => '<span><bdi>' + number(value) + '</bdi><small>' + label + '</small></span>';

  function render() {
    const saved = records();
    root.innerHTML = saved.length ? saved.map((entry, i) => {
      const player = find(entry, players);
      const x = player ? model(player) : null;
      return `<article class="watchlistRow">
        <div>${player ? `<button type="button" class="watchlistPlayer" data-watch-profile="${i}"><bdi>${esc(player.name)}</bdi></button>
          <small><bdi>${esc(canonicalTeam(player.team))}</bdi> · ${esc(player.pos)} · ${esc(statusText(player.status))}</small>`
          : `<strong><bdi>${esc(entry.name)}</bdi></strong><small>כרגע מחוץ לשוק</small>`}</div>
        <div class="watchlistMetrics">${stat('קרדיט',player?.price)}${stat('PIR צפוי',x?.expected)}${stat('דקות צפויות',x?.minutes)}</div>
        <button type="button" class="secondary" data-watch-remove="${i}" aria-label="הסר את ${esc(player?.name || entry.name)} מהשמורים">הסר</button>
      </article>`;
    }).join('') : '<p class="muted">אפשר לשמור שחקנים למעקב מתוך פרופיל השחקן.</p>';
  }

  function save(saved) {
    if (!cacheValue(key, JSON.stringify(saved))) return false;
    render();
    updateProfile();
    return true;
  }

  window.FantasyWatchlist = {
    has,
    toggle(player) {
      const saved = records();
      return save(has(player) ? saved.filter(entry => !find(entry, [player])) :
        [{id:stableKey(player), name:player.name}, ...saved]);
    }
  };
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const saved = records();
    if (button.dataset.watchProfile !== undefined) {
      const player = find(saved[Number(button.dataset.watchProfile)], players);
      if (player) window.PlayerAnalysis.open(player);
    } else if (button.dataset.watchRemove !== undefined) {
      const index = Number(button.dataset.watchRemove);
      if (save(saved.filter((_, i) => i !== index))) {
        (root.querySelectorAll('[data-watch-remove]')[Math.min(index, saved.length - 2)] || root.closest('section')).focus();
      }
    }
  });
  document.querySelector('[data-tab="watchlist"]').addEventListener('click', render);
  document.addEventListener('fantasy-live-updated', () => { if (root.closest('section').classList.contains('active')) render(); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    render();
    updateProfile();
  });
  render();
})();
