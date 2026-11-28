(() => {
'use strict';

const C = window.SquadHistoryCore;
const resolved = new Map();
const boxes = new Map();
const timelines = new Map();
const pending = [];
let inFlight = 0;
const dateFormat = new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'numeric',year:'2-digit',timeZone:'Asia/Jerusalem'});
const text = value => '<bdi>'+esc(value)+'</bdi>';
const value = v => v == null ? '—' : new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(v);
const signed = v => v == null ? '—' : (v > 0 ? '+' : '')+value(v);
const playerKey = p => window.PlayerIdentity.key(typeof p === 'string' ? p : p.name);
const labels = {
  points:'נקודות', rebounds:'ריבאונדים', assists:'אסיסטים', blocks:'חסימות',
  steals:'חטיפות', drawn:'סחיטת עבירות', turnovers:'איבודים', fouls:'עבירות'
};

function limit(run) {
  return new Promise((resolve,reject) => {
    pending.push({run,resolve,reject});
    drain();
  });
}

function drain() {
  while (inFlight < 6 && pending.length) {
    const job = pending.shift();
    inFlight++;
    Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(() => {
      inFlight--;
      drain();
    });
  }
}

async function official(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),9000);
  try {
    const response = await fetch(url,{signal:controller.signal});
    if (!response.ok) throw Error('Data unavailable');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function boxPlayers(game) {
  if (!boxes.has(game.code)) {
    const local = './data/backtest/cache/E2026-'+game.code+'-stats.json';
    const api = 'https://api-live.euroleague.net/v3/competitions/E/seasons/E2026/games/'+game.code+'/stats';
    const parse = data => {
      const roster = C.boxPlayers(game,data,reorderCommaName);
      if (!roster.some(p=>p.home) || !roster.some(p=>!p.home)) throw Error('Incomplete box score');
      return roster;
    };
    const request = limit(() => lastThreeFetch(local).then(parse).catch(() => official(api).then(parse)))
      .catch(error => {boxes.delete(game.code);throw error;});
    boxes.set(game.code,request);
  }
  return boxes.get(game.code);
}

function gameTimeline(game) {
  if (!timelines.has(game.code)) {
    const url = 'https://live.euroleague.net/api/PlaybyPlay?gamecode='+game.code+'&seasoncode=E2026';
    const request = limit(() => official(url).then(feed => C.onCourt(game,game.roster,feed)))
      .catch(error => { timelines.delete(game.code); throw error; });
    timelines.set(game.code,request);
  }
  return timelines.get(game.code);
}

async function history(p, publish) {
  const key = playerKey(p);
  const [schedule, data] = await Promise.all([
    lastThreeFetch('./data/context/E2026-schedule.json'),
    lastThreeFetch('./data/euroleague-live-E2026.json')
  ]);
  const fixtures = C.scheduleGames(schedule,canonicalTeam);
  const logs = C.gameLogs(data,fixtures,playerKey);
  const season = logs.get(key) || [];
  const games = await Promise.all(season.map(async game => {
    try {
      const roster = await boxPlayers(game);
      const own = roster.find(player => playerKey(player.rawName) === key);
      if (own) return {...game, own, roster};
    } catch {}
    return game;
  }));
  const dataFor = matches => {
    const attack = [], defense = [];
    for (const {game,pair} of matches) {
      const {own} = game;
      const rival = pair?.rival;
      const side = own.home ? 'away' : 'home';
      const common = {code:game.code,date:game.date,round:game.round,home:own.home,
        opponent:game[side],abbr:game[side+'Abbr'],rival,overlap:pair?.overlap};
      attack.push({...common, pir:own.pir ?? game.pir, minutes:own.seconds/60, metrics:own.metrics});
      if (!rival) continue;
      const stint = pair.stint;
      defense.push({...common, pir:stint?.pir ?? rival.pir, minutes:stint ? pair.overlap/60 : rival.seconds/60,
        metrics:stint?.metrics ?? rival.metrics, stint:!!stint,
        ...C.prior(logs.get(playerKey(rival.rawName)),game)});
    }
    return {season,attack,defense,missing:games.length-matches.length};
  };
  const matches = games.filter(game => game.own).map(game => ({
    game, pair:C.matchOpponents(game.own,game.roster.filter(r => r.home !== game.own.home),null)
  }));
  publish(dataFor(matches), matches.some(({pair})=>pair.rival));
  const enriched = await Promise.all(matches.map(async match => {
    if (!match.pair.rival) return match;
    const {game} = match;
    try {
      const timeline = await gameTimeline(game);
      return {...match,pair:C.matchOpponents(game.own,game.roster.filter(r => r.home !== game.own.home),timeline)};
    } catch {
      return match;
    }
  }));
  publish(dataFor(enriched),false);
}

function historyRequest(p, listener) {
  const key = playerKey(p);
  let task = resolved.get(key);
  if (!task) {
    task = {listeners:new Set()};
    resolved.set(key,task);
    const publish = (data, loading) => {
      task.data = data;
      task.loading = loading;
      for (const notify of task.listeners) notify(data,loading);
      if (!loading) {
        task.listeners.clear();
        if (data.missing) resolved.delete(key);
      }
    };
    void history(p,publish).catch(() => {
      resolved.delete(key);
      publish(null,false);
    });
  }
  if (task.loading !== false) task.listeners.add(listener);
  if (task.data) listener(task.data,task.loading);
}

const filters = [
  ['mode','יחידת PIR',[['raw','PIR בפועל'],['rate','PIR ל־40 דק׳']]],
  ['range','טווח משחקים',[['all','כל העונה'],['5','5 אחרונים'],['3','3 אחרונים']]],
  ['venue','בית או חוץ',[['all','בית וחוץ'],['home','משחקי בית'],['away','משחקי חוץ']]]
];
const controls = settings => '<div class="sgh-controls">'+filters.map(([key,label,options]) =>
  '<select aria-label="'+label+'" data-sgh-filter="'+key+'">'+options.map(([k,v]) =>
    '<option value="'+k+'"'+(settings[key]===k?' selected':'')+'>'+v+'</option>').join('')+
    '</select>').join('')+'</div>';
const kit = (point, number = '') => squadJersey({team:point.opponent,jerseyNumber:number});
const metric = (label,val) => '<div><strong>'+text(val)+'</strong><small>'+label+'</small></div>';
const set = (points, defense) => {
  if (defense) return points;
  const teams = new Map();
  for (const point of points) {
    if (!teams.has(point.opponent)) teams.set(point.opponent,[]);
    teams.get(point.opponent).push(point);
  }
  return [...teams.values()].sort((a,b) => a.at(-1).date-b.at(-1).date || a.at(-1).code-b.at(-1).code).flat();
};

function gameDetail(point, defense, mode) {
  const rival = point.rival;
  const title = defense ? rival.name : point.opponent;
  const sub = [defense ? point.opponent : (rival?.name ?? 'אין יריב מזוהה בעמדה'),
    dateFormat.format(point.date),point.round ? 'מחזור '+point.round : '',point.home?'בית':'חוץ'].filter(Boolean);
  return '<div class="sgh-detail-head">'+kit(point,rival?.jerseyNumber)+'<div><b>'+text(title)+'</b>'+
    '<small>'+sub.map(text).join(' · ')+'</small></div>'+
    '<button type="button" data-sgh-close aria-label="סגור פירוט">×</button></div>'+
    '<div class="sgh-detail-stats">'+metric(defense && point.stint ? 'PIR בחפיפה' : 'PIR בפועל',value(point.pir))+
    metric(defense && point.stint?'דקות חפיפה':'דקות משחק',value(point.minutes))+
    (mode === 'rate' ? metric('PIR ל־40 דק׳',value(point.value)) : '')+
    (defense ? metric('ממוצע אישי לפני המשחק',value(point.priorAverage))+
      metric(mode==='rate'?'בסיס ל־40 דק׳':'בסיס לאותן דקות',value(point.normal))+
      (point.stint ? metric('דקות במשחק המלא',value(rival.seconds/60))+metric('PIR במשחק המלא',value(rival.pir)) :
        metric('דקות חפיפה',value(point.overlap == null ? null : point.overlap/60))) : '')+
    metric(defense?'פער מהבסיס':'פער מהממוצע האישי',signed(point.delta))+
    Object.entries(labels).map(([k,l]) => metric(l,value(point.metrics[k]))).join('')+'</div>'+
    '<p class="sgh-source">'+(defense ?
      (point.stint?'PIR באירועים שבדקות החפיפה.':'מאצ׳אפ משוער · PIR של המשחק המלא.')+
      ' '+(point.priorCount ? 'הבסיס חושב לפי '+point.priorCount+' משחקים קודמים העונה.' : 'עדיין אין משחקים קודמים העונה להשוואה.') :
      (rival ? 'היריב בעמדה זוהה '+(point.overlap > 0 ? 'לפי מירב דקות החפיפה.':'לפי החמישייה ודקות הרוטציה.') : 'נתוני היריב בעמדה חסרים במשחק הזה.'))+'</p>';
}

function grid(points, reference, defense, upcoming, mode) {
  const bounds = [0,...points.map(p => p.value)];
  if (reference !== null) bounds.push(reference);
  const lo = Math.min(...bounds), hi = Math.max(...bounds);
  const step = Math.max(1, Math.ceil((hi-lo || 4)/4));
  const min = Math.floor(lo/step)*step;
  const max = Math.max(min+step*4, Math.ceil(hi/step)*step);
  const y = v => (max-v)/(max-min)*100;
  const lines = Array.from({length:Math.round((max-min)/step)+1},(_,i) => max-i*step);
  const line = v => '<i class="sgh-gridline" style="--y:'+y(v)+'%"></i>';
  const axis = mode==='rate'?'PIR / 40':'PIR';
  const alt = (p, marker) => (defense?p.rival.name:p.opponent)+' · '+dateFormat.format(p.date)+' · '+axis+' '+value(p.value)+' · '+marker;
  return '<div class="sgh-chart'+(defense?' sgh-chart-defense':'')+'" dir="ltr"><div class="sgh-axis"><strong>'+axis+'</strong><div>'+
    lines.map(v => '<span style="--y:'+y(v)+'%">'+value(v)+'</span>').join('')+'</div></div>'+
    '<div class="sgh-scroll" tabindex="0" aria-label="גרף הניתן לגלילה אופקית"><div class="sgh-plot" style="--columns:'+points.length+'">'+
    '<div class="sgh-grid" aria-hidden="true">'+lines.map(line).join('')+
    (reference===null?'':'<i class="sgh-reference" style="--y:'+y(reference)+'%"></i>')+'</div>'+
    points.map((p,i) => {
      const marker = p.delta===null?'אין בסיס להשוואה':p.tone==='near'?'סביב הממוצע':p.delta>0?'מעל הממוצע':'מתחת לממוצע';
      const highlight = !defense && upcoming && p.opponent===upcoming;
      const groupStart = i===0 || points[i-1].opponent!==p.opponent;
      return '<div class="sgh-column'+(highlight?' sgh-upcoming':'')+'"'+(highlight?' title="היריבה הבאה"':'')+'>'+
        '<div class="sgh-track"><button type="button" class="sgh-point" data-sgh-point="'+i+'" data-tone="'+p.tone+
        '" data-sgh-game="'+p.code+'" data-method="'+(defense ? (p.stint?'overlap':'full'):'offense')+'" style="--y:'+y(p.value)+
        '%" data-baseline="'+(p.delta===null?'missing':'available')+'" aria-label="'+esc(alt(p,marker))+'" aria-expanded="false">'+
        '<span class="sgh-point-id">'+kit(p,p.rival?.jerseyNumber)+'<bdi>'+esc(p.rival?.short ?? '—')+'</bdi></span>'+
        '<span class="sgh-dot"></span><strong>'+value(p.value)+'</strong></button></div>'+
        (defense?'':'<span class="sgh-x" title="'+esc(p.opponent)+'">'+
          (groupStart?esc(p.abbr || p.opponent):'')+'</span>')+'</div>';
    }).join('')+'</div></div></div>';
}

function renderChart(el, data, next, defense, settings, loading, refresh = false) {
  const priorScroll = refresh ? el.querySelector('.sgh-scroll')?.scrollLeft : null;
  const activePoint = refresh ? el.querySelector('[data-sgh-game][aria-expanded="true"]')?.dataset.sghGame : null;
  const selectedGames = new Set(C.select(data.attack,settings.range,settings.venue).map(row=>row.code));
  const rows = (defense?data.defense:data.attack).filter(row=>selectedGames.has(row.code));
  const stats = C.sample(rows,data.season,settings.mode,defense);
  const points = set(stats.points,defense);
  const summary = defense ? [
    ['ממוצע PIR יריבים',value(stats.actual)],['ממוצע רגיל מתואם',value(stats.reference)],
    ['פער ממוצע',signed(stats.difference)],['מאצ׳אפים במדגם',points.length]
  ] : [
    ['ממוצע PIR עונתי',value(stats.reference)],['מעל הממוצע',stats.above],
    ['מתחת לממוצע',stats.below],['משחקים במדגם',points.length]
  ];
  const reference = stats.reference===null?'':'<span class="sgh-baseline"><i></i> '+(defense?'בסיס מתואם':'ממוצע עונתי')+' '+text(value(stats.reference))+'</span>';
  const optionsId = defense?'sgh-defense-options':'sgh-attack-options';
  const optionsLabel = defense?'סינון וסיכום הגנתיים':'סינון וסיכום התקפיים';
  const sliders = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-5 1v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  el.innerHTML = '<div class="sgh-heading"><h5>'+(defense?'הגנה · PIR של היריבים':'התקפה · PIR מול יריבות')+'</h5>'+
    '<button type="button" data-sgh-options aria-label="'+optionsLabel+'" aria-controls="'+optionsId+'" aria-expanded="'+Boolean(settings.options)+'">'+sliders+'</button></div>'+
    (points.length?grid(points,stats.reference,defense,next?.team,settings.mode):
    '<p class="sgh-empty">'+(data.season.length?'אין נתונים למדגם שנבחר.':'אין הופעות מתועדות בעונה זו.')+'</p>')+
    '<div class="sgh-options" id="'+optionsId+'"'+(settings.options?'':' hidden')+'>'+controls(settings)+
    '<div class="sgh-legend">'+reference+'<span data-tone="good"><i></i> '+(defense?'פחות מהרגיל':'מעל הממוצע')+'</span>'+
    '<span data-tone="near"><i></i> סביב הממוצע (עד 1)</span><span data-tone="bad"><i></i> '+(defense?'יותר מהרגיל':'מתחת לממוצע')+'</span></div>'+
    '<div class="sgh-summary">'+summary.map(([label,val]) => metric(label,val)).join('')+'</div>'+
    (defense?'<p class="sgh-source">'+(loading?'בודק דקות חפיפה מול דוחות המשחק…':'● חפיפה מאומתת · ◆ מאצ׳אפ משוער, משחק מלא')+
      (stats.comparable<points.length?' · בסיס להשוואה ל־'+stats.comparable+' מתוך '+points.length:'')+
      ' · חפיפה משקפת נוכחות משותפת על המגרש.</p>':
      (data.missing?'<p class="sgh-source">בוקס סקור חסר ל־'+data.missing+' משחקים.</p>':''))+
    '</div><div class="sgh-detail" hidden dir="rtl"></div>';
  const strip = el.querySelector('.sgh-scroll');
  if (strip) strip.scrollLeft = priorScroll ?? strip.scrollWidth;
  el.onchange = event => {
    const key = event.target.dataset.sghFilter;
    if (!key) return;
    settings[key] = event.target.value;
    renderChart(el,data,next,defense,settings,loading);
    el.querySelector('[data-sgh-filter="'+key+'"]').focus({preventScroll:true});
  };
  let selected = null;
  const detail = el.querySelector('.sgh-detail');
  function close(restoreFocus) {
    selected?.setAttribute('aria-expanded','false');
    if (restoreFocus) selected?.focus({preventScroll:true});
    selected = null;
    detail.hidden = true;
  }
  function openDetail(button, focus) {
    close(false);
    selected = button;
    selected.setAttribute('aria-expanded','true');
    detail.innerHTML = gameDetail(points[Number(button.dataset.sghPoint)],defense,settings.mode);
    detail.hidden = false;
    if (focus) detail.querySelector('[data-sgh-close]').focus({preventScroll:true});
  }
  el.onclick = event => {
    const toggle = event.target.closest('[data-sgh-options]');
    if (toggle) {
      settings.options = !settings.options;
      toggle.setAttribute('aria-expanded',String(settings.options));
      el.querySelector('.sgh-options').hidden = !settings.options;
      return;
    }
    const button = event.target.closest('[data-sgh-point]');
    if (event.target.closest('[data-sgh-close]') || (button && button===selected)) return close(true);
    if (button) openDetail(button,true);
  };
  const restore = activePoint && el.querySelector('[data-sgh-game="'+activePoint+'"]');
  if (restore) openDetail(restore,false);
  el.onkeydown = event => {
    if (event.key === 'Escape' && !detail.hidden) {
      event.stopPropagation();
      close(true);
    }
  };
}

function mount(root, player, next, settings) {
  root.innerHTML = '<p class="sgh-loading" role="status">טוען משחקים מעונת 2026/27…</p>';
  historyRequest(player,(data,loading) => {
    if (!root.isConnected) return;
    if (!data) {
      root.innerHTML = '<p class="sgh-loading" role="status">נתוני המשחקים אינם זמינים כרגע.</p><button type="button" class="sgh-retry">נסה שוב</button>';
      root.querySelector('button').onclick = () => mount(root,player,next,settings);
      return;
    }
    if (!root.querySelector('section')) root.innerHTML = '<section class="sgh-card" aria-label="גרף התקפי"></section><section class="sgh-card" aria-label="גרף הגנתי"></section>';
    const [attack,defense] = root.querySelectorAll('section');
    renderChart(attack,data,next,false,settings.attack,loading,attack.hasChildNodes());
    renderChart(defense,data,next,true,settings.defense,loading,defense.hasChildNodes());
  });
}

window.SquadHistory = {mount,settings:()=>({attack:{mode:'raw',range:'all',venue:'all'},defense:{mode:'raw',range:'all',venue:'all'}})};
})();
