/* The same weight calculation serves live predictions and frozen round reports. */
(function(root){
'use strict';
const definitions=[
 ['market','שוק שחקנים',3,'מחיר השוק מול הצפי האישי ההיסטורי.'],
 ['playerMatchup','מאצ׳אפ שחקנים',8,'PIR לדקה מול היריבה, עם הפחתה על מדגם קטן.'],
 ['performance','גרפי ביצועים',16,'שינוי בנקודות מהשדה לניסיון קליעה בשלוש ההופעות האחרונות. דקות וזריקות נמדדות בנפרד.'],
 ['injuries','פציעות',8,'תוספת דקות ומעורבות שמקורה בחיסורי חברי סגל. סטטוס שחקן בחוץ נשמר בחישוב הבסיס.'],
 ['usage','מדד Usage',8,'שינוי ב־Usage מהבוקס־סקור הרשמי, לפי אירועים וחשיפה.'],
 ['defense','מדדי הגנה וריבאונד',5,'סיכויי ריבאונד לפי ההחטאות והריבאונד שהיריבה מאפשרת, ביחס לסגנון השחקן.'],
 ['freeThrows','עונשין · שחקנים',4,'שינוי בתפוקת העונשין לדקה, כולל מחיר ההחטאות ב־PIR.'],
 ['box','נתונים נקיים',8,'מגמת אסיסטים, ריבאונד הגנה, חטיפות וחסימות לדקה.'],
 ['negative','פעולות שליליות',4,'מגמת איבודים, עבירות, זריקות שנחסמו והחטאות מהשדה לדקה.'],
 ['shotMap','מפת זריקות',4,'דיוק שמאפשרת היריבה ליד הסל, מחצי מרחק ומחוץ לקשת, לפי תמהיל הזריקות.'],
 ['plusMinus','פלוס־מינוס',2,'שינוי בפלוס־מינוס ל־40 דקות. משקל נמוך בגלל השפעת ההרכב והיריבה.'],
 ['lineups','הרכבי קליעה',2,'קצב קליעה בהרכבים מאומתים שכל חבריהם זמינים, מול שאר הדקות המאומתות.'],
 ['playerDna','DNA שחקן',4,'שיעור נקודות במתפרצת, בהזדמנות שנייה ואחרי איבוד, מול מה שהיריבה מאפשרת.'],
 ['teamMarket','שוק קבוצות',2,'מגמת חלקו של השחקן בדקות הקבוצה.'],
 ['teamMatchup','מאצ׳אפ קבוצות',4,'קצב הפוזשנים של שתי הקבוצות לעומת הליגה.'],
 ['pirWeakness','חולשת PIR',7,'PIR לדקה שהיריבה מאפשרת לעמדת השחקן, לפי המדד הקיים.'],
 ['teamMetrics','מדד קבוצות',2,'נקודות שהיריבה מאפשרת ל־100 פוזשנים לעומת הליגה.'],
 ['teamFreeThrows','עונשין · קבוצות',2,'עבירות שהיריבה מבצעת ל־100 פוזשנים, לפי הנטייה של השחקן לסחוט עבירות.'],
 ['teamDna','DNA קבוצתי',2,'התאמה בין סגנון המסירות של קבוצת השחקן, המסירות שהיריבה מאפשרת ותמהיל הקליעה שלו.'],
 ['absence','המלצות חיסורים',3,'שינוי בדקות בעבר כששחקן שחסר כעת נרשם ושיחק או נרשם וישב.'],
 ['bargains','מציאות',1,'תפוקת עבר של שחקן מתחת ל־10 קרדיט, ביחס לסף של PIR אחד לקרדיט.'],
 ['surprises','הפתעות לרעה',1,'תדירות הופעות של עד 10 PIR בקרב שחקנים שמחירם הנוכחי 13 קרדיט ומעלה.']
].map(([id,label,weight,description])=>({id,label,weight,description}));
const defaults=Object.fromEntries(definitions.map(d=>[d.id,d.weight]));
const num=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const clip=(n,low,high)=>Math.max(low,Math.min(high,n));
const divide=(a,b)=>num(a)!==null&&b>0?a/b:null;
const sum=(rows,read)=>rows.reduce((s,r)=>s+read(r),0);
function rate(rows,read,exposure=r=>r.minutes){
 const values=rows.map(r=>[read(r),exposure(r)]).filter(([a,b])=>num(a)!==null&&num(b)!==null&&b>0);
 return divide(sum(values,r=>r[0]),sum(values,r=>r[1]));
}
const stat=(...keys)=>r=>keys.every(k=>num(r.stats?.[k])!==null)?sum(keys,k=>r.stats[k]):null;
const difference=(a,b)=>num(a)===null||num(b)===null?null:a-b;
const compare=(a,b,scale)=>{const d=difference(a,b);return d===null?null:d/scale;};
const relative=(a,b,scale)=>b>0?compare(a,b,b*scale):null;
const strength=(v,n,k=4)=>num(v)===null?null:clip(v,-1,1)*n/(n+k);
const average=values=>{const a=values.filter(v=>num(v)!==null);return a.length?sum(a,v=>v)/a.length:null;};
function valid(weights){
 return definitions.every(({id})=>num(weights?.[id])!==null&&weights[id]>=0&&weights[id]<=100)
  &&Math.abs(sum(definitions,d=>weights[d.id])-100)<.00001;
}
function normalize(weights){
 const values=definitions.map(d=>clip(num(weights?.[d.id])??0,0,100));
 const total=sum(values,v=>v);
 if(!total)return {...defaults};
 const raw=values.map(v=>v/total*100),rounded=raw.map(Math.floor);
 raw.map((v,i)=>[i,v-rounded[i]]).sort((a,b)=>b[1]-a[1])
  .slice(0,100-sum(rounded,v=>v)).forEach(([i])=>rounded[i]++);
 return Object.fromEntries(definitions.map(({id},i)=>[id,rounded[i]]));
}
const shotZone=s=>s.type?.startsWith('3')?2:Math.hypot(s.x,s.y)<=200?0:1;
const attackKeys=['fastbreak','secondChance','offTurnover'];
function events(){
 return {zones:Array.from({length:3},()=>[0,0]),attacks:attackKeys.map(()=>[0,0]),games:0};
}
function addEvents(target,rows){
 let covered=false;
 for(const r of rows){
  if(!r.shotCoverage)continue;
  covered=true;
  for(const s of r.shots||[]){
   if(s.type?.startsWith('FT'))continue;
   if(num(s.x)!==null&&num(s.y)!==null){
    const z=target.zones[shotZone(s)];z[0]+=Number(!!s.made);z[1]++;
   }
  }
  for(const s of r.shots||[]){
   if(!s.made||!s.points)continue;
   attackKeys.forEach((key,i)=>{
    if(typeof s[key]!=='boolean')return;
    target.attacks[i][0]+=s[key]?s.points:0;
    target.attacks[i][1]+=s.points;
   });
  }
 }
 if(covered)target.games++;
}
function build(official,advanced,{key,team,asOf=Date.now()}){
 // Official results files contain completed box scores. This additional gate
 // also excludes the current fixture and protects replay from future rows.
 const before=date=>Date.parse(date)+4*3600000<=asOf;
 const profiles=new Map(),teams=new Map(),league=[],allowed=new Map(),leagueEvents=events(),byGame=new Map();
 for(const [code,g] of Object.entries(official?.teamGames||{})){
  if(!before(g.date)||!g.local?.stats||!g.road?.stats)continue;
  for(const [side,other] of [[g.local,g.road],[g.road,g.local]]){
   const own=side.stats,opp=other.stats;
   const possessions=s=>{
    const attempts=stat('fieldGoalsAttempted2','fieldGoalsAttempted3','turnovers')({stats:s});
    return attempts!==null&&num(s.freeThrowsAttempted)!==null&&num(s.offensiveRebounds)!==null
     ? attempts+.44*s.freeThrowsAttempted-s.offensiveRebounds:null;
   };
   const a=possessions(own),b=possessions(opp),pace=a>0&&b>0?(a+b)/2:null;
   const row={own,opp,pace,minutes:side.gameMinutes};
   const name=team(side.team);
   if(!teams.has(name))teams.set(name,[]);
   teams.get(name).push(row);
   byGame.set(code+'|'+name,row);league.push(row);
  }
 }
 const advancedGames=advanced?.season==='E2026'?advanced.games:{};
 const eventRows=new Map(),rosters=new Map();
 for(const [code,g] of Object.entries(advancedGames||{})){
  if(!before(g.date))continue;
  const byOpponent=new Map(),roster=new Map();
  for(const p of Object.values(g.players||{})){
   const name=key(p.name),club=team(p.team),opponent=team(p.opponent);
   eventRows.set(code+'|'+name+'|'+club,p);
   roster.set(name+'|'+club,p.minutes);
   if(!opponent)continue;
   if(!byOpponent.has(opponent))byOpponent.set(opponent,[]);
   byOpponent.get(opponent).push(p);
  }
  rosters.set(code,roster);
  for(const [opp,rows] of byOpponent){
   if(!allowed.has(opp))allowed.set(opp,events());
   addEvents(allowed.get(opp),rows);addEvents(leagueEvents,rows);
  }
 }
 for(const p of Object.values(official?.players||{})){
  const id=key(p.name);
  const rows=(p.games||[]).filter(g=>g.minutes>0&&before(g.date)).map(g=>{
   const club=team(g.team),code=String(g.gameCode),a=eventRows.get(code+'|'+id+'|'+club);
   return {...g,team:club,opponent:team(g.opponent),stats:{...a?.stats,...g.stats},
    teamMinutes:byGame.get(code+'|'+club)?.minutes,event:a,roster:rosters.get(code)};
  }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  if(rows.length)profiles.set(id,profiles.has(id)?null:rows);
 }
 const teamSummary=rows=>{
  const perPoss=read=>rate(rows,read,r=>r.pace);
  return {games:rows.length,pace:rate(rows,r=>r.pace,r=>r.minutes),allowed:perPoss(r=>r.opp.points),
   fouls:perPoss(r=>r.own.foulsCommited),misses:perPoss(r=>{
    const s=r.opp;
    const a=stat('fieldGoalsAttempted2','fieldGoalsAttempted3')({stats:s}),m=stat('fieldGoalsMade2','fieldGoalsMade3')({stats:s});
    return difference(a,m);
   }),oreb:rate(rows,r=>r.opp.offensiveRebounds,r=>{
    const a=r.opp.offensiveRebounds,b=r.own.defensiveRebounds;return num(a)!==null&&num(b)!==null?a+b:null;
   }),assists:rate(rows,r=>r.own.assistances,r=>stat('fieldGoalsMade2','fieldGoalsMade3')({stats:r.own})),
   allowedAssists:rate(rows,r=>r.opp.assistances,r=>stat('fieldGoalsMade2','fieldGoalsMade3')({stats:r.opp}))};
 };
 const all=teamSummary(league),clubs=new Map([...teams].map(([name,rows])=>[name,teamSummary(rows)]));
 const personalEvents=new Map();
 for(const [id,rows] of profiles){
  if(!rows)continue;
  const e=events();
  for(const row of rows)if(row.event)addEvents(e,[row.event]);
  personalEvents.set(id,e);
 }
 return {key,team,profiles,clubs,all,allowed,leagueEvents,personalEvents};
}
function signals(p,x,data,roster){
 const {key,team,profiles,clubs,all,allowed,leagueEvents,personalEvents}=data;
 const id=key(p.name),club=team(p.team),opp=team(x.match?.opponent||p.opponent);
 const rows=profiles.get(id)||[],same=rows.filter(g=>g.team===club),recent=rows.slice(-3),prior=rows.slice(0,-3);
 const opposed=rows.filter(g=>g.opponent===opp),other=rows.filter(g=>g.opponent!==opp);
 const own=clubs.get(club),rival=clubs.get(opp),coverage=rival?.games>=3;
 const s=Object.fromEntries(definitions.map(d=>[d.id,null]));
 const set=(k,v,n,kappa)=>{s[k]=strength(v,n,kappa);};
 const pir=stat('valuation'),perf=group=>rate(group,pir);
 const trend=(read,scale,exposure)=>prior.length>=2?compare(rate(recent,read,exposure),rate(prior,read,exposure),scale):null;
 const price=num(p.price),base=num(x.basePir);
 if(price>0&&base>0)set('market',compare(price*.93,base,Math.max(4,base*.35)),5);
 if(opposed.length&&other.length>=3)set('playerMatchup',compare(perf(opposed),perf(other),.35),opposed.length,4);
 const fieldPoints=g=>{
  const points=num(g.stats.points),free=num(g.stats.freeThrowsMade);
  return points===null||free===null?null:points-free;
 };
 set('performance',trend(fieldPoints,.40,stat('fieldGoalsAttempted2','fieldGoalsAttempted3')),prior.length);
 if(num(x.injuryBoost)!==null&&num(x.injuryUsagePct)!==null&&x.baseMin>0)
  set('injuries',(x.injuryBoost/x.baseMin+x.injuryUsagePct/100)/.18,6);
 set('usage',trend(g=>g.metrics?.usageEvents,.09,g=>g.metrics?.usageExposure),prior.length);
 const rebounds=rate(rows,stat('totalRebounds')),offRebounds=rate(rows,stat('offensiveRebounds'));
 if(coverage&&rebounds!==null&&offRebounds!==null){
  const off=compare(rival.oreb,all.oreb,.12),miss=relative(rival.misses,all.misses,.2);
  if(off!==null&&miss!==null)set('defense',off*clip(offRebounds/.10,0,1)+miss*clip((rebounds-offRebounds)/.18,0,1),rival.games);
 }
 const free=g=>{const a=g.stats.freeThrowsAttempted,m=g.stats.freeThrowsMade;return num(a)!==null&&num(m)!==null?2*m-a:null;};
 set('freeThrows',trend(free,.12),prior.length);
 set('box',trend(stat('assistances','defensiveRebounds','steals','blocksFavour'),.25),prior.length);
 const negative=g=>{
  const n=stat('turnovers','foulsCommited','blocksAgainst','fieldGoalsAttempted2','fieldGoalsAttempted3')(g);
  const m=stat('fieldGoalsMade2','fieldGoalsMade3')(g);
  return difference(n,m);
 };
 const negativeTrend=trend(negative,.20);
 if(negativeTrend!==null)set('negative',-negativeTrend,prior.length);
 set('plusMinus',trend(stat('plusMinus'),.55),prior.length);
 const playerEvents=personalEvents.get(id),against=allowed.get(opp);
 if(playerEvents&&against?.games>=3){
  let adjustment=0,attempts=0;
  against.zones.forEach(([made,n],i)=>{
   const [lm,ln]=leagueEvents.zones[i],taken=playerEvents.zones[i][1];
   if(n<20||ln<100||!taken)return;
   adjustment+=(made/n-lm/ln)*taken;attempts+=taken;
  });
  if(attempts>=15)set('shotMap',adjustment/attempts/.09,against.games);
  const dna=against.attacks.map(([scored,n],i)=>{
   const [ownPoints,ownN]=playerEvents.attacks[i],[leaguePoints,leagueN]=leagueEvents.attacks[i];
   return n>=60&&ownN>=20&&leagueN>=100?((scored/n-leaguePoints/leagueN)/.1)*clip(ownPoints/ownN/.2,0,1):null;
  });
  set('playerDna',average(dna),against.games);
 }
 const mates=new Map(roster.filter(q=>team(q.team)===club).map(q=>[key(q.name),q.status]));
 const knownLineups=same.flatMap(g=>g.event?.lineupCoverage?g.event.lineups:[]).filter(r=>r.minutes>0);
 const lineRate=r=>rate(r,l=>l.points,l=>l.minutes);
 const available=knownLineups.filter(l=>l.teammates.every(t=>mates.get(key(t.name))==='active'));
 if(sum(available,l=>l.minutes)>=15&&sum(knownLineups,l=>l.minutes)>=35)
  set('lineups',compare(lineRate(available),lineRate(knownLineups),.22),same.length);
 if(same.length>=5)set('teamMarket',compare(rate(same.slice(-3),g=>g.minutes,g=>g.teamMinutes),
  rate(same.slice(0,-3),g=>g.minutes,g=>g.teamMinutes),.16),same.length);
 if(coverage&&own?.games>=3&&own.pace>0&&rival.pace>0)set('teamMatchup',relative((own.pace+rival.pace)/2,all.pace,.08),Math.min(own.games,rival.games));
 if(x.positionMatchup?.sampleGames>=3)set('pirWeakness',compare(num(x.positionMatchPct),0,12),x.positionMatchup.sampleGames,8);
 if(coverage){
  set('teamMetrics',relative(rival.allowed,all.allowed,.13),rival.games);
  const fouls=relative(rival.fouls,all.fouls,.25),drawn=rate(rows,stat('foulsReceived'));
  if(fouls!==null&&drawn!==null)set('teamFreeThrows',fouls*clip(drawn/.14,0,1),rival.games);
  const assist=compare(rival.allowedAssists,all.allowedAssists,.14),style=compare(own?.assists,all.assists,.18);
  const three=rate(rows,stat('fieldGoalsAttempted3'),stat('fieldGoalsAttempted2','fieldGoalsAttempted3'));
  if(assist!==null&&style!==null&&three!==null)set('teamDna',(assist+style)*.5*clip(three*1.8,0,1),rival.games);
 }
 const absence=[];
 for(const [mate,status] of mates){
  if(mate===id||status!=='out')continue;
  const withMate=same.filter(g=>(g.roster?.get(mate+'|'+club)??0)>0);
  const without=same.filter(g=>g.roster?.get(mate+'|'+club)===0);
  if(withMate.length>=2&&without.length>=2)
   absence.push(strength(compare(rate(without,g=>g.minutes,()=>1),rate(withMate,g=>g.minutes,()=>1),8),Math.min(withMate.length,without.length)));
 }
 set('absence',average(absence),absence.length,1);
 if(rows.length>=5&&price>0&&price<10)set('bargains',compare(divide(rate(rows,pir,()=>1),price),1,.7),rows.length);
 const rated=rows.map(pir).filter(v=>v!==null);
 if(price>=13&&rated.length>=5)
  set('surprises',-rated.filter(v=>v<=10).length/rated.length,rated.length);
 return definitions.map(({id})=>s[id]);
}
function baseline(p,x,data){
 const rows=data.profiles.get(data.key(p.name))||[];
 const stable=rows.length>=5?rows.slice(0,-3):rows;
 const minutes=rate(stable,g=>g.minutes,()=>1)??num(x.personalPrior?.avgMinutes)??15;
 const observed=rate(stable,stat('valuation'));
 const prior=divide(num(x.personalPrior?.avgPir),num(x.personalPrior?.avgMinutes))??.5;
 const sample=observed===null?0:stable.length;
 const efficiency=((observed??0)*sample+prior*4)/(sample+4);
 const venue=x.match?.home??p.home;
 const venueFactor=1+((venue===true||venue===1)?1:venue===false||venue===0?-1:0)*1.5*.006*.6;
 const availability=p.status==='out'?0:p.status==='questionable'?.82:1;
 return {expected:Math.max(0,minutes*availability*efficiency*venueFactor),
  minutes:minutes*availability};
}
function input(p,x,values,data){
 if(data)x=baseline(p,x,data);
 if(!['G','F','C'].includes(p.pos)||num(x.expected)===null)return null;
 const base=x.expected;
 return {base,scale:p.status==='out'||!(x.minutes>0)?0:Math.min(5,Math.max(0,base)*.30),signals:values,...(data?{minutes:x.minutes}:{})};
}
function project(frozen,weights=defaults,omit=-1){
 const w=valid(weights)?weights:defaults;
 return Math.max(0,frozen.base+frozen.scale*sum(definitions,({id})=>{
  const i=indices[id];return i===omit?0:(frozen.signals[i]??0)*w[id]/100;
 }));
}
const indices=Object.fromEntries(definitions.map(({id},i)=>[id,i]));
function apply(x,p,frozen,weights){
 if(!frozen)return x;
 const expected=project(frozen,weights),delta=expected-x.expected;
 x.weightedForecast=frozen;
 x.expected=expected;
 if(num(frozen.minutes)!==null){
  const w=valid(weights)?weights:defaults;
  const minutesDelta=(frozen.signals[indices.teamMarket]??0)*w.teamMarket*.15
   +(frozen.signals[indices.injuries]??0)*w.injuries*.1
   +(frozen.signals[indices.absence]??0)*w.absence*.1;
  x.minutes=clip(frozen.minutes+minutesDelta*(p.status==='out'?0:p.status==='questionable'?.82:1),0,36);
  x.learning={basePir:frozen.base,baseMinutes:frozen.minutes,applied:false};
  x.source='בסיס אישי ותרומות לפי משקל';

 }
 if(Number.isFinite(x.floor))x.floor=Math.min(expected,Math.max(0,x.floor+delta));
 if(Number.isFinite(x.ceiling))x.ceiling=Math.max(expected,x.ceiling+delta);
 x.value=expected/Math.max(.1,Number(p.price)||0);
 return x;
}
function assess(games,settingsFor=game=>game.weights||defaults){
 const totals=definitions.map(d=>({...d,n:0,delta:0,weightSum:0,enabled:0,available:0,games:0}));
 let n=0,baseError=0,fullError=0,coveredGames=0;
 for(const game of games){
  const weights=settingsFor(game);
  if(!valid(weights))continue;
  let used=false;
  const gameFactors=new Set();
  for(const [actual,base,scale,signals] of game.players){
   const row={base,scale,signals},full=project(row,weights),error=Math.abs(actual-full);
   n++;used=true;fullError+=error;baseError+=Math.abs(actual-base);
   totals.forEach((item,i)=>{
    if(!weights[item.id])return;
    item.enabled++;
    if(!scale||num(signals[i])===null)return;
    item.available++;
    if(signals[i]===0)return;
    item.n++;item.weightSum+=weights[item.id];gameFactors.add(item);
    item.delta+=Math.abs(actual-project(row,weights,i))-error;
   });
  }
  if(used)coveredGames++;
  for(const item of gameFactors)item.games++;
 }
 return {n,games:coveredGames,baseMae:divide(baseError,n),fullMae:divide(fullError,n),
  rows:totals.map(({weightSum,delta,...r})=>({...r,weight:divide(weightSum,r.n),delta:divide(delta,r.n)}))};
}
const api={definitions,defaults,valid,normalize,build,signals,input,project,apply,assess};
if(typeof module==='object'&&module.exports)module.exports=api;else root.WeightedForecast=api;
})(typeof globalThis!=='undefined'?globalThis:this);
