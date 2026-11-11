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
      <div class="card">
        <div class="sectionHead">
          <h3>מדד פופולריות</h3>
          <button type="button" id="popReload" class="secondary">רענן</button>
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
        <p id="popStatus" class="muted" role="status"></p>
        <div id="popTableWrap" class="tablewrap" hidden>
          <table aria-label="דירוג שחקנים לפי אחוז בחירה">
            <thead>
              <tr><th scope="col">#</th><th scope="col">שחקן / קבוצה</th><th scope="col">עמדה</th><th scope="col" id="popRate" aria-sort="descending">אחוז בחירה</th><th scope="col" id="popSample">מחזורים</th></tr>
            </thead>
            <tbody id="popRows"></tbody>
          </table>
        </div>
      </div>
    </section>`);

  const $ = id => document.getElementById(id);
  let rounds = new Map();
  let latestRound = 0;
  let loading = false;
  let loaded = false;
  let archiveData = null;
  let liveData = [];

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

  function render() {
    const season = $('popPeriod').value === 'season';
    const round = Number($('popRound').value);
    const selected = season ? [...rounds.values()] : [rounds.get(round)].filter(Boolean);
    const players = ranking(selected, $('popPosition').value);
    $('popRoundField').hidden = season;
    $('popRate').textContent = season ? 'ממוצע בחירה' : 'אחוז בחירה';
    $('popSample').hidden = !season;
    $('popTableWrap').hidden = !players.length;

    if (loading) {
      $('popStatus').textContent = 'טוען אחוזי בחירה…';
    } else if (!selected.length) {
      $('popStatus').textContent = round && !season
        ? `אחוזי הבחירה למחזור ${round} עדיין אינם זמינים.`
        : 'אחוזי הבחירה אינם זמינים כרגע. אפשר לנסות לרענן.';
    } else if (!players.length) {
      $('popStatus').textContent = 'אין נתוני בחירה לעמדה שבחרת בתקופה הזו.';
    } else {
      $('popStatus').textContent = season
        ? `עונת 2026/27 · נתונים ל־${rounds.size} מתוך ${latestRound} מחזורים · ממוצע לכל שחקן לפי המחזורים שבהם יש לו נתון.`
        : `מחזור ${round} · ${players.length} שחקנים · אחוז מסגלי הפנטזי שבחרו בשחקן.`;
    }

    let rank = 0;
    $('popRows').innerHTML = players.map((player, index) => {
      if (!index || format(player.average) !== format(players[index - 1].average)) rank = index + 1;
      return `<tr>
        <td>${rank}</td>
        <th scope="row"><bdi>${escape(player.name)}</bdi><small><bdi>${escape(player.team)}</bdi></small></th>
        <td>${positions[player.pos]}</td>
        <td><bdi class="pop-value">${format(player.average)}</bdi></td>
        ${season ? `<td>${player.count}</td>` : ''}
      </tr>`;
    }).join('');
  }

  async function fetchData(file) {
    const response = await fetch('./data/' + file, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Popularity data unavailable');
    return response.json();
  }

  async function load() {
    if (loading) return;
    loading = true;
    $('popReload').disabled = true;
    render();

    const [archive, live] = await Promise.allSettled([fetchData('popularity.json'), fetchData('players.json')]);
    if (archive.value?.season === 'E2026') archiveData = archive.value.rounds;
    if (Array.isArray(live.value)) liveData = live.value;

    const snapshots = new Map();
    for (const [key, rows] of Object.entries(archiveData || {})) {
      const round = Number(key);
      if (Number.isInteger(round) && round > 0 && Array.isArray(rows)) {
        snapshots.set(round, new Map(rows.filter(validRow).map(row => [String(row.id), row])));
      }
    }

    let liveRound = 0;
    const fallback = new Map();
    for (const player of liveData) {
      const round = player.popularity_round;
      if (!Number.isInteger(round) || round < 1) continue;
      liveRound = Math.max(round, liveRound);
      const row = { id: player.fantasy_id, name: player.name, team: player.team,
        pos: player.pos, percent: player.previous_round_popularity };
      if (!validRow(row)) continue;
      if (!fallback.has(round)) fallback.set(round, new Map());
      fallback.get(round).set(String(row.id), row);
    }
    for (const [round, rows] of fallback) {
      if (!snapshots.get(round)?.size) snapshots.set(round, rows);
    }

    rounds = new Map([...snapshots].filter(([, rows]) => rows.size).sort(([a], [b]) => a - b));
    latestRound = Math.max(liveRound, ...rounds.keys());
    const picker = $('popRound');
    const previous = picker.value;
    picker.replaceChildren(...Array.from({ length: latestRound }, (_, index) => {
      const round = latestRound - index;
      return new Option('מחזור ' + round + (rounds.has(round) ? '' : ' · אין נתונים'), round);
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
  for (const id of ['popPeriod', 'popRound', 'popPosition']) $(id).onchange = render;
  nav.querySelector('[data-tab="popularity"]').onclick = event => {
    document.querySelectorAll('.tabs button,.tab').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    $('popularity').classList.add('active');
    if (!loaded) void load();
  };
})();
