(() => {
  'use strict';

  const nav = document.querySelector('nav.tabs');
  const main = document.querySelector('main');
  if (!nav || !main) return;

  const positions = { G: 'גארד', F: 'פורוורד', C: 'סנטר' };
  const percent = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
  const format = value => percent.format(value) + '%';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  nav.insertAdjacentHTML('beforeend', '<button type="button" data-tab="popularity">מדד פופולריות</button>');
  main.insertAdjacentHTML('beforeend', `
    <section id="popularity" class="tab">
      <div class="pop-shell">
        <div class="pop-hero">
          <div class="pop-heading">
            <div><h3>מדד פופולריות</h3><p id="popStatus" role="status"></p></div>
            <button type="button" id="popReload" class="pop-reload" aria-label="רענן את מדד הפופולריות">↻</button>
          </div>
          <div id="popLeaders" class="pop-leaders" aria-label="מובילי אחוזי הבחירה" hidden></div>
        </div>
        <div class="pop-filters">
          <label>תקופה
            <select id="popPeriod">
              <option value="round">לפי מחזור</option>
              <option value="season">כל העונה</option>
            </select>
          </label>
          <label id="popRoundField">מחזור
            <select id="popRound" disabled></select>
          </label>
          <label>עמדה
            <select id="popPosition">
              <option value="">כל העמדות</option>
              <option value="G">גארדים</option>
              <option value="F">פורוורדים</option>
              <option value="C">סנטרים</option>
            </select>
          </label>
        </div>
        <div id="popTableWrap" class="tablewrap" hidden>
          <table aria-label="דירוג שחקנים לפי אחוז בחירה">
            <thead>
              <tr><th scope="col">#</th><th scope="col">שחקן</th><th scope="col" id="popRate" aria-sort="descending">אחוז בחירה</th><th scope="col" id="popSample">מחזורים</th></tr>
            </thead>
            <tbody id="popRows"></tbody>
          </table>
        </div>
      </div>
      <dialog id="popHistory" aria-labelledby="popHistoryName">
        <form method="dialog"><button class="secondary" autofocus>סגור</button></form>
        <h3 id="popHistoryName"></h3>
        <p id="popHistoryTeam"></p>
        <ul id="popHistoryRounds"></ul>
      </dialog>
    </section>`);

  const $ = id => document.getElementById(id);
  let rounds = new Map();
  let latestRound = 0;
  let loading = false;
  let loaded = false;
  let captureTimes = new Map();
  let activeRound = 0;
  let displayed = new Map();
  const timestamp = new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem'
  });

  function validRow(row) {
    return row && row.id != null && row.name && Object.hasOwn(positions, row.pos)
      && Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100;
  }

  function ranking(selected, position) {
    const players = new Map();
    for (const rows of selected) {
      for (const player of rows.values()) {
        const entry = players.get(String(player.id));
        players.set(String(player.id), {
          ...player,
          total: (entry?.total ?? 0) + player.percent,
          count: (entry?.count ?? 0) + 1
        });
      }
    }
    return [...players.values()]
      .filter(player => !position || player.pos === position)
      .map(player => ({ ...player, average: player.total / player.count }))
      .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
  }

  function image(url, className, lazy = false) {
    const safe = playerCardImageUrl(url);
    return safe ? `<img class="${className}" src="${escape(safe)}" alt="" ${lazy ? 'loading="lazy"' : ''} decoding="async" referrerpolicy="no-referrer">` : '';
  }

  function decorate(player) {
    const team = canonicalTeam(player.team);
    const profile = playerCardProfile(player);
    const photo = image(profile?.photo, 'pop-photo');
    const crest = image(playerCardCrests.get(team) || (canonicalTeam(profile?.club) === team ? profile?.crest : null), 'pop-crest', true);
    const initials = player.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('');
    const kit = TEAM_KITS[team];
    return { photo, crest, initials, color: kit?.[1] || '#4a6b91' };
  }

  function leader(player, index) {
    const { photo, crest, initials, color } = decorate(player);
    return `<button type="button" class="pop-leader pop-leader-${index + 1}" data-pop-player="${escape(player.id)}"
      aria-label="פרטי ${escape(player.name)}, מקום ${player.rank}, ${format(player.average)}" style="--pop-club:${color}">
      <span class="pop-leader-rank">${player.rank}</span>
      <span class="pop-leader-art" aria-hidden="true"><span>${escape(initials)}</span>${photo}${crest}</span>
      <span class="pop-leader-caption"><bdi class="pop-leader-name">${escape(player.name)}</bdi>
        <bdi class="pop-leader-value">${format(player.average)}</bdi></span>
    </button>`;
  }

  function tableRow(player, season) {
    const { crest, initials } = decorate(player);
    return `<tr data-pop-player="${escape(player.id)}">
      <td><span class="pop-rank">${player.rank}</span></td>
      <th scope="row"><button class="pop-player" type="button" aria-label="פרטי ${escape(player.name)}">
        <span class="pop-avatar" aria-hidden="true"><span>${escape(initials)}</span>${crest}</span>
        <span class="pop-identity"><bdi>${escape(player.name)}</bdi><small>${positions[player.pos]} · <bdi>${escape(player.team)}</bdi></small></span>
        <span class="pop-chevron" aria-hidden="true">‹</span>
      </button></th>
      <td><span class="pop-score"><bdi>${format(player.average)}</bdi><span class="pop-track" aria-hidden="true"><span style="width:${player.average}%"></span></span></span></td>
      ${season ? `<td class="pop-count">${player.count}</td>` : ''}
    </tr>`;
  }

  function openPlayer(player) {
    const match = players.find(row => row.fantasy_id != null && String(row.fantasy_id) === String(player.id))
      || players.find(row => window.UsageCore.key(row.name) === window.UsageCore.key(player.name));
    if (match) {
      window.playerToolSelection?.set(match.name);
      window.showPlayer(match.name, true);
      return;
    }
    $('popHistoryName').textContent = player.name;
    $('popHistoryTeam').textContent = `${positions[player.pos]} · ${player.team}`;
    $('popHistoryRounds').innerHTML = [...rounds].reverse().map(([round, rows]) => {
      const snapshot = rows.get(String(player.id));
      return snapshot ? `<li><span>מחזור ${round}</span><bdi>${format(snapshot.percent)}</bdi></li>` : '';
    }).join('');
    $('popHistory').showModal();
  }

  function render() {
    const season = $('popPeriod').value === 'season';
    const round = Number($('popRound').value);
    const selected = season ? [...rounds.values()] : [rounds.get(round)].filter(Boolean);
    const players = ranking(selected, $('popPosition').value);
    $('popRoundField').hidden = season;
    $('popRate').textContent = season ? 'ממוצע בחירה' : 'אחוז בחירה';
    $('popSample').hidden = !season;
    $('popTableWrap').hidden = !players.length;
    $('popLeaders').hidden = !players.length;

    if (loading) {
      $('popStatus').textContent = 'טוען אחוזי בחירה…';
    } else if (!selected.length) {
      $('popStatus').textContent = round && !season
        ? `אחוזי הבחירה למחזור ${round} עדיין אינם זמינים.`
        : 'הממוצע יהיה זמין לאחר שיישמרו אחוזי בחירה.';
    } else if (!players.length) {
      $('popStatus').textContent = 'אין נתוני בחירה לעמדה שבחרת בתקופה הזו.';
    } else {
      $('popStatus').textContent = season
        ? `עונת 2026/27 · נתונים ל־${selected.length} מתוך ${latestRound} מחזורים · ממוצע לכל שחקן לפי המחזורים שבהם יש לו נתון.`
        : `מחזור ${round} · אחוז מסגלי הפנטזי · עדכון ${timestamp.format(captureTimes.get(round))}`;
    }

    let rank = 0;
    players.forEach((player, index) => {
      if (!index || format(player.average) !== format(players[index - 1].average)) rank = index + 1;
      player.rank = rank;
    });
    displayed = new Map(players.map(player => [String(player.id), player]));
    $('popLeaders').innerHTML = players.slice(0, 3).map(leader).join('');
    $('popRows').innerHTML = players.map(player => tableRow(player, season)).join('');
  }

  async function fetchData(url) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Popularity data unavailable');
    return response.json();
  }

  async function load() {
    if (loading) return;
    loading = true;
    $('popReload').disabled = true;
    render();

    const archivePath = 'data/popularity-snapshots.json';
    // The sync can publish a newer snapshot before GitHub Pages redeploys.
    const published = location.hostname === 'rotemkimi-byte.github.io'
      ? fetchData('https://raw.githubusercontent.com/rotemkimi-byte/eurofantasy-ai/main/' + archivePath)
          .catch(() => fetchData('./' + archivePath))
      : fetchData('./' + archivePath);
    const [archive, meta] = await Promise.allSettled([published, fetchData('./data/meta.json')]);
    const matchday = meta.value?.matchday_number;
    if (meta.value?.players_list_id === 49 && Number.isInteger(matchday)) activeRound = matchday;

    if (archive.value?.season === 'E2026') {
      const snapshots = new Map();
      captureTimes = new Map();
      for (const [key, snapshot] of Object.entries(archive.value.rounds || {})) {
        const round = Number(key);
        const captured = Date.parse(snapshot.captured_at);
        if (!Number.isInteger(round) || round < 1 || !Number.isFinite(captured) || !Array.isArray(snapshot.players)) continue;
        const rows = snapshot.players.filter(validRow);
        if (!rows.length) continue;
        snapshots.set(round, new Map(rows.map(row => [String(row.id), row])));
        captureTimes.set(round, captured);
      }
      rounds = new Map([...snapshots].sort(([a], [b]) => a - b));
    }

    latestRound = Math.max(activeRound, ...rounds.keys());
    const picker = $('popRound');
    const previous = picker.value;
    picker.replaceChildren(...Array.from({ length: latestRound }, (_, index) => {
      const round = latestRound - index;
      return new Option('מחזור ' + round + (rounds.has(round) ? (round === activeRound ? ' · נוכחי' : '') : ' · אין נתונים'), round);
    }));
    if (previous && Number(previous) <= latestRound) picker.value = previous;
    else if (rounds.size) picker.value = Math.max(...rounds.keys());
    picker.disabled = !latestRound;
    loading = false;
    loaded = rounds.size > 0;
    $('popReload').disabled = false;
    render();
  }

  $('popReload').onclick = load;
  $('popularity').addEventListener('click', event => {
    const target = event.target.closest('[data-pop-player]');
    const player = displayed.get(target?.dataset.popPlayer);
    if (player) openPlayer(player);
  });
  $('popularity').addEventListener('error', event => {
    if (event.target.matches('.pop-photo,.pop-crest')) event.target.remove();
  }, true);
  document.addEventListener('fantasy-player-media-ready', () => {
    if (!loaded) return;
    const focused = document.activeElement;
    if (!focused?.closest('[data-pop-player]')) render();
  });
  for (const id of ['popPeriod', 'popRound', 'popPosition']) $(id).onchange = render;
  nav.querySelector('[data-tab="popularity"]').onclick = event => {
    document.querySelectorAll('.tabs button,.tab').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    $('popularity').classList.add('active');
    if (!loaded) void load();
  };
})();
