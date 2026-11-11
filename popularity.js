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
  let captureTimes = new Map();
  let activeRound = 0;
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
        : 'הממוצע יהיה זמין לאחר שיישמרו אחוזי בחירה.';
    } else if (!players.length) {
      $('popStatus').textContent = 'אין נתוני בחירה לעמדה שבחרת בתקופה הזו.';
    } else {
      $('popStatus').textContent = season
        ? `עונת 2026/27 · נתונים ל־${selected.length} מתוך ${latestRound} מחזורים · ממוצע לכל שחקן לפי המחזורים שבהם יש לו נתון.`
        : `מחזור ${round} · אחוז מסגלי הפנטזי שבחרו בשחקן · צילום מצב מ־${timestamp.format(captureTimes.get(round))}`;
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

    const [archive, meta] = await Promise.allSettled([
      fetchData('popularity-snapshots.json'), fetchData('meta.json')
    ]);
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
  for (const id of ['popPeriod', 'popRound', 'popPosition']) $(id).onchange = render;
  nav.querySelector('[data-tab="popularity"]').onclick = event => {
    document.querySelectorAll('.tabs button,.tab').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    $('popularity').classList.add('active');
    if (!loaded) void load();
  };
})();
