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

function signed(value,unit = '') {
  const n = Math.round(value*10)/10;
  return `${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(1)}${unit}`;
}

function compareTable(p) {
  const x=model(p), position=x.positionDefense;
  if(!position)return '<p class="squadPanelNote">אין מספיק נתוני הגנה בעמדה לעונת 2026/27.</p>';
  const o=position.observed,e=position.expected;
  const field=(label,key,threshold,negative=false)=>({label,normal:o[key]==null||e[key]==null?null:40*e[key],actual:o[key]==null?null:40*o[key],threshold,negative});
  const impactText={
   'ריבאונדים':['יותר ריבאונדים','פחות ריבאונדים'], 'קליעה ל־2':['אחוז טוב יותר ל־2','אחוז נמוך יותר ל־2'],
   'קליעה ל־3':['אחוז טוב יותר ל־3','אחוז נמוך יותר ל־3'], 'זריקות שנחסמו':['פחות זריקות נחסמות','יותר זריקות נחסמות'],
   'איבודים':['פחות איבודים','יותר איבודים'], 'סחיטת עבירות':['סוחטים יותר עבירות','סוחטים פחות עבירות'],
   'זריקות עונשין':['יותר זריקות עונשין','פחות זריקות עונשין']
  };
  const shooting=(label,made,attempt)=>({label,percent:true,threshold:2,normal:e[attempt]>0&&e[made]!=null?100*e[made]/e[attempt]:null,actual:o[attempt]>0&&o[made]!=null?100*o[made]/o[attempt]:null});
  const rows=[field('PIR','valuation',1),field('ריבאונדים','totalRebounds',0.5),
   shooting('קליעה ל־2','fieldGoalsMade2','fieldGoalsAttempted2'),shooting('קליעה ל־3','fieldGoalsMade3','fieldGoalsAttempted3'),
   field('זריקות שנחסמו','blocksAgainst',0.4,true),field('איבודים','turnovers',0.4,true),
   field('סחיטת עבירות','foulsReceived',0.4),field('זריקות עונשין','freeThrowsAttempted',0.5)]
   .map(row=>({...row,delta:row.normal===null||row.actual===null?null:row.actual-row.normal}));
  const [pir,...rest]=rows;
  const signals=rest.filter(r=>r.delta!==null&&Math.abs(r.delta)>=r.threshold)
   .sort((a,b)=>Math.abs(b.delta/b.threshold)-Math.abs(a.delta/a.threshold)).slice(0,3);
  const hasSample=position.sampleGames>=3;
  const good=r=>r.negative?r.delta<0:r.delta>0;
  const rowHtml=rows.map(r=>{
    const meaningful=r.delta!==null&&Math.abs(r.delta)>=r.threshold;
    return `<tr><th scope="row">${r.label}</th><td><bdi>${fmt(r.normal,r.percent?'%':'')}</bdi></td>
     <td><bdi>${fmt(r.actual,r.percent?'%':'')}</bdi></td>
     <td class="${meaningful?(good(r)?'up':'down'):''}">${r.delta===null?'—':`<bdi>${signed(r.delta)}</bdi>${r.percent?'<small>נק׳ אחוז</small>':''}`}</td></tr>`;
  }).join('');
  const direction=pir.delta===null?'אין מספיק נתוני PIR בעמדה':Math.abs(pir.delta)<pir.threshold
   ? 'PIR בעמדה קרוב לרגיל'
   : pir.delta<0?'היריבה מורידה את ה־PIR של שחקנים בעמדה':'היריבה מאפשרת יותר PIR לשחקנים בעמדה';
  return `<section class="squadMatchSummary"><h5>איך היריבה משפיעה על העמדה ${esc(p.pos)}?</h5>
   <p class="squadPanelNote">${hasSample?direction:'המדגם עדיין קטן · '+position.sampleGames+' משחקים'}</p>
   ${hasSample&&pir.delta!==null?`<p class="squadMatchHeadline"><bdi>${signed(pir.delta)}</bdi> PIR ל־40 דקות בעמדה</p>`:''}
   ${hasSample&&signals.length?`<ul>${signals.map(r=>`<li class="${good(r)?'up':'down'}">${impactText[r.label][good(r)?0:1]} <bdi>${signed(r.delta)}</bdi><small>${r.percent?'נק׳ אחוז':'ל־40 דק׳'}</small></li>`).join('')}</ul>`:''}
   <details class="squadInfluence"><summary>כל נתוני ההגנה בעמדה</summary>
    <p class="squadPanelNote">${position.sampleGames} משחקים · ${position.appearances} הופעות · ${fmt(position.minutes)} דקות</p>
    <table class="squadDefenseTable"><thead><tr><th scope="col">מדד</th><th scope="col">מול שאר הקבוצות</th><th scope="col">מול היריבה</th><th scope="col">פער</th></tr></thead>
    <tbody>${rowHtml}</tbody></table>
    <p class="squadPanelNote">ההשוואה מתייחסת לשחקנים בעמדה בעונת 2026/27. ממוצעי הפעולות מוצגים ל־40 דקות ואחוזי הקליעה לפי ניסיונות. הבסיס מיוצב לממוצע הליגה במדגם קטן.</p>
   </details></section>`;

}
function influenceDetails(x){
 const ledger=x.weightedMatchupLedger;
 if(!ledger)return '';
 const exact=v=>`${v>0?'+':v<0?'−':''}${Math.abs(v).toFixed(4)}`;
 const rows=ledger.rows.map(r=>`<tr><th scope="row">${esc(r.label)}</th><td><bdi>${fmt(r.weight)}%</bdi></td>
  <td class="${r.contribution>0?'up':r.contribution<0?'down':''}"><bdi>${exact(r.contribution)}</bdi></td><td>${r.id==='pirWeakness'&&!x.positionDefenseActive?'כבוי · הנתון הישן הוסר':!r.available?'אין מספיק נתונים':r.weight===0?'משקל כבוי':'פעיל'}</td></tr>`).join('');
 const pending=!x.positionDefenseActive?(x.positionFeatures||[]).map(r=>`<tr><th scope="row">${esc(r.label)} · עמדה</th><td><bdi>${fmt(x.matchupWeights?.[r.tool])}%</bdi></td><td>0.0000</td><td>${r.value===null?'אין מספיק נתונים':'לא הופעל · טרם עבר אימות'}</td></tr>`).join(''):'';
 return `<details class="squadInfluence"><summary>מה השפיע על התחזית?</summary>
  <table class="squadDefenseTable"><thead><tr><th>מדד</th><th>משקל הכלי</th><th>תרומת PIR</th><th>מצב</th></tr></thead><tbody>${rows}${pending}
  <tr><th>סך ההשפעה</th><td></td><td><bdi>${exact(ledger.total)}</bdi></td><td></td></tr></tbody></table>
  <p class="squadPanelNote">לפני: <bdi>${ledger.base.toFixed(4)}</bdi> · סופי: <bdi>${ledger.expected.toFixed(4)}</bdi>. התרומות מחושבות לפני עיגול; הפרש תצוגה אפשרי של עד 0.0001 לשורה.${ledger.clipped?' התרומות הותאמו לרצפת 0 PIR.':''} ${x.positionDefenseActive?'משקלי הכלים האישיים ומקדם שנלמד בתקופת האימון חלים על התרומות.':'נתוני העמדה המפורטים מוצגים לניתוח; השפעתם הנוספת כבויה עד לאימות כרונולוגי.'}</p>
  <p class="squadPanelNote">גובה, משקל וזהות השומר אינם מוסיפים PIR: אין זיהוי מאומת של שמירה ישירה או מקדמים מאומתים לחלוקת דקות הרוטציה.</p></details>`;
}

function matchupForecast(p, next) {
  const x = model(p);
  const expected = num(x.expected);
  let base = null, method = '';
  if (p.status !== 'out' && next && x.weightedForecast &&
      x.weightedMatchupOpponent === next.team && (x.match?.home === next.home || x.match?.home === Number(next.home))) {
    base = num(x.weightedMatchupBase);
    method = 'כל רכיבי היריבה, כולל חולשת PIR, נוטרלו בתחזית שלפני ההתאמה. ספי הסיווג ±0.5 PIR ראשוניים.';
  }
  if (base === null || expected === null) {
    return `<section class="squadForecastImpact"><h5>השפעה על תחזית PIR</h5>
     <p>התחזית המוצגת היא ${fmt(expected)} PIR. למודל אין כרגע השפעת מאצ׳אפ נפרדת שאפשר להציג למשחק הזה.</p></section>`;
  }
  const impact=S.impact(base,expected), rounded=impact.delta;
  const neutral=Math.abs(rounded)<0.05;
  return `<section class="squadForecastImpact"><h5>${impact.label} · תחזית PIR</h5>
    <div class="squadImpactMetrics">${metric('לפני ההתאמה',base)}
     <div class="squadPanelMetric ${neutral?'':rounded>0?'up':'down'}"><bdi>${neutral?'≈ 0':(rounded>0?'+':'')+impact.display}</bdi><small>השפעת מאצ׳אפ</small></div>
     ${metric('תחזית סופית',expected)}</div>
    <p>${method} ההשפעה כבר כלולה בתחזית הסופית. ${num(x.confidence)===null?'':esc(dataQuality(p,x))+' · איכות נתונים לתחזית.'}</p>${influenceDetails(x)}</section>`;
}

function matchup(p) {
  const next = nextGame(p);
  if (!next) return '<p class="squadPanelNote">המשחק הבא טרם אומת בלוח היורוליג. ניתוח יופיע כשיהיה משחק זמין.</p>';
  const fixture = `<div class="squadMatchHero"><strong>${name(next.team)}</strong><small>מחזור ${esc(next.round)} · ${next.home?'בית':'חוץ'} · עמדה ${esc(p.pos)}</small></div>`;
  if (!games?.length) return fixture+ (!games ?'<p class="squadPanelNote" role="status">טוען נתוני עונת 2026/27…</p>' : '<p class="squadPanelNote">אין דוחות משחק זמינים בעונה הנוכחית.</p>') + (games ? matchupForecast(p,next) : '');
  const rival = rivalFor(p, next);
  const identity = rival ? `<details class="squadInfluence"><summary>שחקן בולט ברוטציה של היריבה</summary><div class="squadRivalProfile">
    <button type="button" class="squadAltIdentity" data-details="${esc(rival.player.name)}" ${window.PlayerAnalysis.attrs(rival.player)}>${squadJersey(rival.player)}
     <span><small>שחקן רוטציה בעמדה ${esc(p.pos)}</small><strong>${name(rival.player.name)}</strong>
     <small>${name(next.team)} · ${rival.games} משחקים</small></span></button>
    ${physicalLine(rival.player,true)}
    <h5>ממוצעים אישיים של השחקן</h5><div class="squadRivalMetrics">
     ${metric('PIR',rival.pir)}${metric('נקודות',rival.points)}${metric('ריבאונדים',rival.rebounds)}${metric('חסימות',rival.blocks)}${metric('דקות',rival.minutes)}</div>
    <p class="squadPanelNote">מוביל בדקות בין השחקנים הזמינים בעמדה. אין זיהוי מאומת של השומר הישיר או נתוני הגנה בזמן שהיה על המגרש.</p>
   </div></details>` : '';
  return fixture + matchupForecast(p,next) + compareTable(p) + identity +
    '<p class="squadPanelNote">מקור: דוחות המשחק הרשמיים של יורוליג · 2026/27</p>';
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
  if (open.kind === 'matchup' && nextGame(p)) {
    if (!games) void loadStats().catch(() => {
      if (panel.isConnected) panel.querySelector('.squadPanelBody').innerHTML =
        '<p class="squadPanelNote" role="status">טעינת הנתונים נכשלה. סגור ופתח את הניתוח כדי לנסות שוב.</p>';
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
      open = {name:first.dataset.player,kind:'alternatives'};
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
