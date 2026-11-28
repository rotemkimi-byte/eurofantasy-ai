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
let open = null, autoOpen = false, schedule = null, games = null, statsRequest = null;

function nextGame(p) {
  if (!schedule) return null;
  return S.fixture(schedule, canonicalTeam(p.team), canonicalTeam);
}

function controls(id, optimizing) {
  const button = (kind, label, icon) => `<button type="button" data-squad-panel="${kind}" aria-expanded="false" aria-controls="${id}">${icon}${label}</button>`;
  return `<div class="squadPanelControls">${optimizing?button('alternatives','חלופות','<span aria-hidden="true">⇄</span>'):''}${button('matchup','ניתוח יריב',chart)}</div>`;
}

function fixtureLine(p) {
  const next = nextGame(p);
  return `<div class="squadFixture">${next ? `${name(next.team)} <b>${next.home?'בית':'חוץ'}</b>` : 'מועד המשחק טרם אומת'}</div>`;
}

function rivalFor(p, next) {
  if (!games || !next) return null;
  return S.positionPlayer(games, players.filter(q => canonicalTeam(q.team)===next.team),
    next.team, p.pos, window.OfficialOffense.key);
}

function rivalPreview(p) {
  const next = nextGame(p);
  const rival = rivalFor(p, next);
  if (!rival) return `<div class="squadRivalPreview squadRivalUnavailable">${next && games ? 'אין שחקן יריב מזוהה בעמדה' : ''}</div>`;
  return `<div class="squadRivalPreview">
    <button type="button" class="squadAltIdentity" data-details="${esc(rival.player.name)}" ${window.PlayerAnalysis.attrs(rival.player)} aria-label="פרטי ${esc(rival.player.name)}">
     ${squadJersey(rival.player)}<span><small>יריב בעמדה ${esc(p.pos)}</small><strong>${name(rival.player.name)}</strong></span></button>
    ${physicalLine(rival.player,true)}
  </div>`;
}

window.SquadOptimizer = {controls, fixtureLine, rivalPreview};

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
    <button type="button" class="squadAltIdentity" data-details="${esc(q.name)}" ${window.PlayerAnalysis.attrs(q)} aria-label="פרטי ${esc(q.name)}">
     ${squadJersey(q)}<span><strong>${name(q.name)}</strong><small>${name(canonicalTeam(q.team))} · ${esc(q.pos)} · ${esc(statusText(q.status))}</small></span></button>
    ${metric('קרדיט',price)}${metric('PIR צפוי',score)}
    <button type="button" class="squadSwap" data-squad-swap="${esc(q.name)}" aria-label="החלף ל־${esc(q.name)}">החלף</button>
   </article>`).join('') || '<p class="squadPanelNote">אין חלופות זמינות בעמדה ובמחיר הזה.</p>'}`;
}

function matchup(p, next, rival) {
  if (!next) return '<p class="squadPanelNote">היריבה במחזור הקרוב טרם אומתה.</p>';
  const fixture = `מחזור ${esc(next.round)} · ${next.home?'בית':'חוץ'}`;
  if (!rival) {
    const message = games ? 'אין יריב מזוהה בעמדה ' + esc(p.pos) : 'מאתר את היריב בעמדה…';
    return `<div class="sgh-rival"><div><strong>${name(next.team)}</strong><small>${fixture}</small></div></div>
      <p class="squadPanelNote" role="status">${message}</p>`;
  }
  return `<div class="sgh-rival">${squadJersey(rival)}<div>
    <strong>${name(rival.name)}</strong>
    <small>יריב משוער · ${name(next.team)} · ${fixture}</small>
  </div></div><div class="sgh-root"></div>`;
}

function loadStats() {
  if (games) return Promise.resolve();
  statsRequest ||= window.loadGameData('official-offense.json').then(data => {
    if (data.season !== 'E2026' || data.schema !== 'official-offense-v1') throw Error('Unexpected season');
    games = S.gameStats(data, canonicalTeam);
    renderTeam();
  }).finally(() => { statsRequest = null; });
  return statsRequest;
}

function playerCard(value) {
  return [...root.querySelectorAll('.squadPlayer[data-player]')].find(card => card.dataset.player === value);
}

function selectionCard(selection) {
  if (!selection?.coach) return playerCard(selection?.name);
  const card = root.querySelector('[data-coach]');
  return card?.dataset.coach === selection.name ? card : null;
}

function removePanel() {
  const prior = root.querySelector('.squadExpansion');
  prior?.remove();
  root.querySelector('[data-squad-panel][aria-expanded="true"]')?.setAttribute('aria-expanded','false');
}

function paint(revealMatchup = false) {
  removePanel();
  if (!open) return;
  const card = selectionCard(open);
  const roster = open.coach ? COACHES : players;
  const p = roster.find(q => q.name === open.name);
  const button = card?.querySelector(`[data-squad-panel="${open.kind}"]`);
  if (!button || !p) { open = null; return; }
  const title = open.kind === 'alternatives' ? 'חלופות מומלצות' : 'ניתוח יריב';
  const panel = document.createElement('section');
  const isMatchup = open.kind === 'matchup';
  panel.className = isMatchup ? 'squadExpansion squadMatchupExpansion' : 'squadExpansion';
  panel.id = button.getAttribute('aria-controls');
  panel.setAttribute('aria-label', title + ' · ' + p.name);
  const next = isMatchup ? nextGame(p) : null;
  const rival = isMatchup && !open.coach ? rivalFor(p,next)?.player : null;
  const coachMatchup = open.coach && next;
  const body = coachMatchup
    ? `<div class="sgh-rival">${squadJersey({team:next.team})}<div><strong>${name(next.team)}</strong>
       <small>היריבה הבאה של ${name(p.team)} · מחזור ${esc(next.round)} · ${next.home?'בית':'חוץ'}</small></div></div><div class="sgh-root"></div>`
    : isMatchup ? matchup(p,next,rival) : alternatives(p);
  panel.innerHTML = `<div class="squadPanelHead"><h4>${title}${isMatchup?'':' · '+name(p.name)}</h4>
   <button type="button" data-squad-close aria-label="סגור ${title}">⌃</button></div>
   <div class="squadPanelBody">${body}</div>`;
  const row = card.closest('.squadCourtRow');
  // A bench panel occupies the grid row after the selected player's pair.
  if (row) row.after(panel);
  else if (card.parentElement.matches('.squadBenchGrid')) {
    const index = [...card.parentElement.children].indexOf(card);
    const lastInRow = index % 2 === 0 ? card.nextElementSibling || card : card;
    lastInRow.after(panel);
  } else card.after(panel);
  button.setAttribute('aria-expanded','true');
  if (coachMatchup) {
    open.historySettings ||= window.SquadHistory.settings();
    window.SquadHistory.mountTeam(panel.querySelector('.sgh-root'),schedule,next.team,canonicalTeam(p.team),open.historySettings);
  } else if (rival) {
    open.historySettings ||= window.SquadHistory.settings();
    window.SquadHistory.mount(panel.querySelector('.sgh-root'),rival,canonicalTeam(p.team),open.historySettings);
  } else if (next && !games) {
    void loadStats().catch(() => {
      const status = panel.querySelector('[role="status"]');
      if (status?.isConnected) status.textContent = 'נתוני היריב אינם זמינים כרגע. סגור ופתח שוב כדי לנסות מחדש.';
    });
  }
  if (isMatchup && revealMatchup && matchMedia('(max-width: 760px)').matches) {
    panel.querySelector('[data-squad-close]').focus({preventScroll:true});
    const scroller = document.getElementById('efPageScroll') || document.scrollingElement;
    const inset = parseFloat(getComputedStyle(panel).scrollMarginTop);
    scroller.scrollTo({
      top: scroller.scrollTop + panel.getBoundingClientRect().top - inset,
      behavior: 'instant'
    });
  }
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
  if (autoOpen) {
    const first = root.querySelector('.squadPlayer[data-player]');
    if (first) {
      autoOpen = false;
      open = {name:first.dataset.player,kind:'alternatives',coach:false};
    }
  }
  paint();
  const rivals = new Set([...root.querySelectorAll('.squadRivalPreview [data-physical-player]')]
    .map(el => el.dataset.physicalPlayer));
  if (rivals.size) void physicalLoad(players.filter(p => rivals.has(p.name)));
  if (root.classList.contains('squadOptimizing')) paintCoach();
  renderUpgrade();
};

root.addEventListener('click', event => {
  const action = event.target.closest('[data-squad-panel],[data-squad-close],[data-squad-swap]');
  if (!action) return;
  if (action.hasAttribute('data-squad-swap')) {
    replace(action.dataset.squadSwap);
  } else if (action.hasAttribute('data-squad-close')) {
    const button = selectionCard(open)?.querySelector('[data-squad-panel][aria-expanded="true"]');
    const wasMatchup = open?.kind === 'matchup';
    open = null;
    removePanel();
    button?.focus({preventScroll:!wasMatchup});
  } else {
    const card = action.closest('[data-player],[data-coach]');
    if (!card) return;
    const coach = card.hasAttribute('data-coach');
    const value = coach ? card.dataset.coach : card.dataset.player;
    const kind = action.dataset.squadPanel;
    open = open?.name === value && open.kind === kind && open.coach === coach ? null : {name:value,kind,coach};
    paint(kind === 'matchup');
  }
});

function setMode(active) {
  root.classList.toggle('squadOptimizing',active);
  optimizer.setAttribute('aria-pressed',String(active));
  open = null;
  autoOpen = active;
  renderTeam();
}

function loadSchedule() {
  return window.loadGameData('context/E2026-schedule.json').then(data => {
    if (schedule !== data) {
      schedule = data;
      renderTeam();
    }
    return loadStats();
  }).catch(() => {});
}

tabs.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button === optimizer) {
    const active = optimizer.getAttribute('aria-pressed') !== 'true';
    forecast.click();
    setMode(active);
    if (active) forecast.setAttribute('aria-pressed','false');
  } else if (button?.dataset.teamView) {
    if (root.classList.contains('squadOptimizing')) setMode(false);
    if (button.dataset.teamView === 'upgrade') renderUpgrade();
    if (button === forecast) void loadSchedule();
    else {
      open = null;
      removePanel();
    }
  }
});

document.querySelector('[data-tab="team"]').addEventListener('click',loadSchedule);
renderTeam();
if (document.getElementById('team').classList.contains('active')) void loadSchedule();
})();
