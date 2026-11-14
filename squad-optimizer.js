(() => {
'use strict';
const root = document.getElementById('teamCards');
const tabs = document.getElementById('teamView');
const optimizer = document.getElementById('squadOptimizer');
const forecast = tabs.querySelector('[data-team-view="forecast"]');
const S = window.SquadMatchup;
const num = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const fmt = (value, unit = '') => num(value) === null ? '—' : Number(value).toFixed(1) + unit;
const name = value => '<bdi>' + esc(value) + '</bdi>';
const chart = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13V8m5 5V4m5 9V2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
let open = null, schedule = null, games = null, statsRequest = null;

function nextGame(p) {
  if (!schedule) return null;
  return S.fixture(schedule, canonicalTeam(p.team), canonicalTeam);
}

function controls(id) {
  const button = (kind, label, icon) => `<button type="button" data-squad-panel="${kind}" aria-expanded="false" aria-controls="${id}">${icon}${label}</button>`;
  return `<div class="squadPanelControls">${button('alternatives','חלופות','<span aria-hidden="true">⇄</span>')}${button('matchup','ניתוח יריב',chart)}</div>`;
}

function fixtureLine(p) {
  const next = nextGame(p);
  return `<div class="squadFixture">${next ? `${name(next.team)} <b>${next.home?'בית':'חוץ'}</b>` : 'מועד המשחק טרם אומת'}</div>`;
}

window.SquadOptimizer = {controls, fixtureLine};

function rank(source, pool, owned) {
  const price = num(source.price);
  if (!(price > 0)) return [];
  return pool.filter(q => q.p.name !== source.name && !owned.has(q.p.name) &&
    q.p.pos === source.pos && q.p.status !== 'out' && q.price > 0 &&
    q.price <= price + 1e-8 && q.score !== null)
    .sort((a,b) => b.score-a.score || a.price-b.price || a.p.name.localeCompare(b.p.name)).slice(0,3);
}

function playerAlternatives(p) {
  const currentPrice = num(p.price);
  if (!(currentPrice > 0)) return [];
  const owned = new Set(myTeam);
  const pool = players.filter(q => q.pos === p.pos && !owned.has(q.name) && q.status !== 'out')
    .filter(q => num(q.price)>0 && num(q.price)<=currentPrice+1e-8)
    .map(q => ({p:q, price:num(q.price), score:num(model(q).expected)}));
  return rank(p, pool, owned);
}

function metric(label, value, unit) {
  return `<div class="squadPanelMetric"><bdi>${fmt(value,unit)}</bdi><small>${label}</small></div>`;
}

function alternatives(p) {
  const options = playerAlternatives(p);
  return `<p class="squadPanelNote">עמדה ${esc(p.pos)} · עד ${fmt(p.price)} קרדיט · לפי PIR צפוי</p>
   ${options.map(({p:q,price,score}) => `<article class="squadAltRow">
    <button type="button" class="squadAltIdentity" data-details="${esc(q.name)}" aria-label="פרטי ${esc(q.name)}">
     ${squadJersey(q)}<span><strong>${name(q.name)}</strong><small>${name(canonicalTeam(q.team))} · ${esc(q.pos)} · ${esc(statusText(q.status))}</small></span></button>
    ${metric('קרדיט',price)}${metric('PIR צפוי',score)}
    <button type="button" class="squadSwap" data-squad-swap="${esc(q.name)}" aria-label="החלף ל־${esc(q.name)}">החלף</button>
   </article>`).join('') || '<p class="squadPanelNote">אין חלופות זמינות בעמדה ובמחיר הזה.</p>'}`;
}

function signed(value,unit = '') {
  const n = Math.round(value*10)/10;
  return `${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(1)}${unit}`;
}

function compareTable(p, next) {
  const result = S.comparison(games, p.pos, next.team);
  const rows = result.rows.map(({label,normal,actual,percent}) => {
    const delta = normal === null || actual === null ? null : (Math.round(actual*10)-Math.round(normal*10))/10;
    const color = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
    return `<tr><th scope="row">${label}</th><td><bdi>${fmt(normal,percent?'%':'')}</bdi></td>
     <td><bdi>${fmt(actual,percent?'%':'')}</bdi></td>
     <td class="${color}">${delta===null?'—':`<span aria-hidden="true">${delta>0?'↑':delta<0?'↓':'='}</span> <bdi>${signed(delta)}</bdi>${percent?'<small>נק׳ אחוז</small>':''}`}</td></tr>`;
  }).join('');
  return `<h5>מה הקבוצה מאפשרת בעמדה ${esc(p.pos)}?</h5>
   <p class="squadPanelNote">הגנת קבוצה · ${result.games} משחקים · ${result.appearances} הופעות בעמדה${result.games<3?' · מדגם קטן':''}</p>
   <table class="squadDefenseTable"><thead><tr><th scope="col">מדד</th><th scope="col">ממוצע רגיל</th><th scope="col">מול הקבוצה</th><th scope="col">שינוי</th></tr></thead>
   <tbody>${rows}</tbody></table>
   <p class="squadPanelNote">הממוצע מבוסס על הופעות בעמדה מול שאר הליגה. אחוזי קליעה משוקללים לפי מספר הזריקות.</p>`;
}

function matchupForecast(p, next) {
  const x = model(p);
  const expected = num(x.expected);
  let base = null, method = '';
  if (p.status !== 'out' && next && x.weightedForecast &&
      x.weightedMatchupOpponent === next.team && (x.match?.home === next.home || x.match?.home === Number(next.home))) {
    base = num(x.weightedMatchupBase);
    method = 'השפעת רכיבי מאצ׳אפ מעונת 2026/27 במודל המשוקלל. מקדם העמדה ההיסטורי נשאר זהה בשתי התחזיות.';
  } else if (next && !x.weightedForecast && x.context?.opponent === next.team &&
      (x.match?.home === next.home || x.match?.home === Number(next.home)) &&
      num(x.context.defensePointsDelta) !== null && x.context.defenseSample >= 3 && x.context.defenseFactor > 0) {
    base = expected === null ? null : expected / x.context.defenseFactor;
    method = `התאמת קליעה לפי הגנת הקבוצה · ${x.context.defenseSample} משחקים. יתר רכיבי התחזית נשמרו.`;
  }
  if (base === null || expected === null) {
    return `<section class="squadForecastImpact"><h5>השפעה על תחזית PIR</h5>
     <p>התחזית המוצגת היא ${fmt(expected)} PIR. למודל אין כרגע השפעת מאצ׳אפ נפרדת שאפשר להציג למשחק הזה.</p></section>`;
  }
  const rounded = (Math.round(expected*10)-Math.round(base*10))/10;
  return `<section class="squadForecastImpact"><h5>${rounded>0?'מאצ׳אפ חיובי':rounded<0?'מאצ׳אפ קשה':'השפעה זניחה'} · תחזית PIR</h5>
    <div class="squadImpactMetrics">${metric('לפני ההתאמה',base)}
     <div class="squadPanelMetric ${rounded>0?'up':rounded<0?'down':''}"><bdi>${signed(rounded)}</bdi><small>השפעת מאצ׳אפ</small></div>
     ${metric('תחזית סופית',expected)}</div>
    <p>${method} ההשפעה כבר כלולה בתחזית הסופית. ${num(x.confidence)===null?'':esc(dataQuality(p,x))+' · איכות נתונים לתחזית.'}</p></section>`;
}

function matchup(p) {
  const next = nextGame(p);
  if (!next) return '<p class="squadPanelNote">המשחק הבא טרם אומת בלוח היורוליג. ניתוח יופיע כשיהיה משחק זמין.</p>';
  const fixture = `<div class="squadMatchHero"><strong>${name(next.team)}</strong><small>מחזור ${esc(next.round)} · ${next.home?'בית':'חוץ'} · עמדה ${esc(p.pos)}</small></div>`;
  if (!games?.length) return fixture+ (!games ?'<p class="squadPanelNote" role="status">טוען נתוני עונת 2026/27…</p>' : '<p class="squadPanelNote">אין דוחות משחק זמינים בעונה הנוכחית.</p>') + (games ? matchupForecast(p,next) : '');
  const rival = S.positionPlayer(games, players.filter(q => canonicalTeam(q.team)===next.team),
    next.team, p.pos, window.OfficialOffense.key);
  const profile = rival && window.__matchupContextData?.season === 'E2026'
    ? window.__matchupContextData.players?.[window.OfficialOffense.key(rival.player.name)] : null;
  const height = profile?.team === next.team ? num(profile.height) : num(rival?.player.height);
  const identity = rival ? `<div class="squadRivalProfile">
    <button type="button" class="squadAltIdentity" data-details="${esc(rival.player.name)}">${squadJersey(rival.player)}
     <span><small>שחקן רוטציה בעמדה ${esc(p.pos)}</small><strong>${name(rival.player.name)}</strong>
     <small>${name(next.team)} · ${height>0?height+' ס״מ':'גובה חסר'} · ${rival.games} משחקים</small></span></button>
    <h5>ממוצעים אישיים של השחקן</h5><div class="squadRivalMetrics">
     ${metric('PIR',rival.pir)}${metric('נקודות',rival.points)}${metric('ריבאונדים',rival.rebounds)}${metric('חסימות',rival.blocks)}${metric('דקות',rival.minutes)}</div>
    <p class="squadPanelNote">מוביל בדקות בין השחקנים הזמינים בעמדה. אין זיהוי מאומת של השומר הישיר או נתוני הגנה בזמן שהיה על המגרש.</p>
   </div>` : '<p class="squadPanelNote">אין זיהוי מאומת של יריב ישיר. ההשוואה מבוססת על הגנת הקבוצה.</p>';
  return fixture + identity + compareTable(p,next) + matchupForecast(p,next) +
    '<p class="squadPanelNote">מקור: דוחות המשחק הרשמיים של יורוליג · 2026/27</p>';
}

function loadStats(panel, p) {
  if (games) return;
  statsRequest ||= window.loadGameData('official-offense.json').then(data => {
    if (data.season !== 'E2026' || data.schema !== 'official-offense-v1') throw Error('Unexpected season');
    games = S.gameStats(data, canonicalTeam);
  }).finally(() => { statsRequest = null; });
  statsRequest.then(() => {
    if (panel.isConnected) panel.querySelector('.squadPanelBody').innerHTML = matchup(p);
  }).catch(() => {
    if (panel.isConnected) panel.querySelector('.squadPanelBody').innerHTML =
      '<p class="squadPanelNote" role="status">טעינת הנתונים נכשלה. סגור ופתח את הניתוח כדי לנסות שוב.</p>';
  });
}

function playerCard(value) {
  return [...root.querySelectorAll('.squadPlayer[data-player]')].find(card => card.dataset.player === value);
}

function removePanel() {
  const prior = root.querySelector('.squadExpansion');
  prior?.remove();
  root.querySelector('[data-squad-panel][aria-expanded="true"]')?.setAttribute('aria-expanded','false');
}

function paint() {
  removePanel();
  if (!open) return;
  const card = playerCard(open.name);
  const p = players.find(q => q.name === open.name);
  const button = card?.querySelector(`[data-squad-panel="${open.kind}"]`);
  if (!button || !p) { open = null; return; }
  const title = open.kind === 'alternatives' ? 'חלופות מומלצות' : 'ניתוח יריב';
  const panel = document.createElement('section');
  panel.className = 'squadExpansion';
  panel.id = button.getAttribute('aria-controls');
  panel.setAttribute('aria-label', title + ' · ' + p.name);
  panel.innerHTML = `<div class="squadPanelHead"><h4>${title} · ${name(p.name)}</h4>
   <button type="button" data-squad-close aria-label="סגור ${title}">⌃</button></div>
   <div class="squadPanelBody">${open.kind==='alternatives'?alternatives(p):matchup(p)}</div>`;
  const row = card.closest('.squadCourtRow');
  // A bench panel occupies the grid row after the selected player's pair.
  if (row) row.after(panel);
  else if (card.parentElement.matches('.squadBenchGrid')) {
    const index = [...card.parentElement.children].indexOf(card);
    const lastInRow = index % 2 === 0 ? card.nextElementSibling || card : card;
    lastInRow.after(panel);
  } else card.after(panel);
  button.setAttribute('aria-expanded','true');
  if (open.kind === 'matchup' && nextGame(p)) loadStats(panel,p);
}

function paintCoach() {
  const card = root.querySelector('.squadCoach');
  const current = COACHES.find(c => c.name === squadPreferences.coach);
  if (!card || !current) return;
  const pool = COACHES.map(c => {
    const team = canonicalTeam(c.team), match = MATCHUPS[team];
    return {p:{...c,pos:'coach'},price:num(c.price),score:match?num(coachExpected(team)):null,match};
  });
  const panel = document.createElement('details');
  panel.className = 'squadCoachAlternatives';
  panel.innerHTML = '<summary>חלופות למאמן</summary>' +
    (rank({...current,pos:'coach'},pool,new Set()).map(({p,price,score,match}) => `<div class="squadAltRow">
      <span><b>${name(p.name)}</b><small>${name(p.team)} · מול ${name(match.opponent)}</small></span>
      ${metric('קרדיט',price)}${metric('נק׳ צפויות',score)}<small>ניצחון ${pct(match.winProb)}</small>
     </div>`).join('') || '<p>אין חלופות זמינות במחיר הזה.</p>');
  card.after(panel);
}

function replace(candidate) {
  const p = players.find(q => q.name === open?.name);
  if (!p || !myTeam.includes(p.name) || !playerAlternatives(p).some(q => q.p.name === candidate)) {
    paint();
    return;
  }
  const {slots} = squadArrangement(myTeam.map(n => players.find(q => q.name === n))
    .filter(q => q && ['G','F','C'].includes(q.pos)));
  squadPreferences.slots = slots.map(q => q?.name === p.name ? candidate : q?.name || null);
  if (squadPreferences.captain === p.name) squadPreferences.captain = candidate;
  myTeam = myTeam.map(n => n === p.name ? candidate : n);
  const synced = cachedValue('efa2_roster_snapshot',null);
  if (synced) cacheValue('efa2_optimizer_roster_override',JSON.stringify(synced));
  squadSave();
  save();
  open = null;
  renderAll();
  playerCard(candidate)?.querySelector('[data-squad-panel="alternatives"]')?.focus({preventScroll:true});
}

const original = renderTeam;
renderTeam = function () {
  original();
  if (root.classList.contains('squadOptimizing')) {
    paint();
    paintCoach();
  }
};

root.addEventListener('click', event => {
  const action = event.target.closest('[data-squad-panel],[data-squad-close],[data-squad-swap]');
  if (!action) return;
  if (action.hasAttribute('data-squad-swap')) {
    replace(action.dataset.squadSwap);
  } else if (action.hasAttribute('data-squad-close')) {
    const button = playerCard(open?.name)?.querySelector('[aria-expanded="true"]');
    open = null;
    removePanel();
    button?.focus({preventScroll:true});
  } else {
    const value = action.closest('.squadPlayer').dataset.player;
    const kind = action.dataset.squadPanel;
    open = open?.name === value && open.kind === kind ? null : {name:value,kind};
    paint();
  }
});

function setMode(active) {
  root.classList.toggle('squadOptimizing',active);
  optimizer.setAttribute('aria-pressed',String(active));
  if (!active) open = null;
  renderTeam();
}

tabs.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button === optimizer) {
    const active = optimizer.getAttribute('aria-pressed') !== 'true';
    forecast.click();
    setMode(active);
    if (active) {
      forecast.setAttribute('aria-pressed','false');
      void window.loadGameData('context/E2026-schedule.json').then(data => {
        if (schedule === data) return;
        schedule = data;
        if (root.classList.contains('squadOptimizing')) renderTeam();
      }).catch(() => {});
    }
  } else if (button?.dataset.teamView && root.classList.contains('squadOptimizing')) {
    setMode(false);
  }
});
})();
