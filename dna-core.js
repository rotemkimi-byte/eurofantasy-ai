(function(root){
'use strict';

const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const add=(a,b)=>a===null||b===null?null:a+b;
const pair=(a,b)=>a===null||b===null||b<0?null:[a,b];
const key=name=>String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
const field=(s,k)=>number(s?.[k]);
const totalShots=s=>add(field(s,'fieldGoalsAttempted2'),field(s,'fieldGoalsAttempted3'));
const madeShots=s=>add(field(s,'fieldGoalsMade2'),field(s,'fieldGoalsMade3'));
const attempts=(s,points)=>field(s,'fieldGoalsAttempted'+points);
const made=(s,points)=>field(s,'fieldGoalsMade'+points);
const leagueMinimum=6;
const season='E2026';

const offense=[
 ['pace','קצב משחק','pos','estimated','אומדן פוזשנים ל־40 דקות, ממוצע של אומדני שתי הקבוצות במשחק.'],
 ['three','נפח שלשות','%','box','ניסיונות ל־3 מתוך ניסיונות מהשדה.'],
 ['threeAccuracy','דיוק משלוש','%','box','קליעות ל־3 מתוך ניסיונות ל־3.'],
 ['rim','זריקות ליד הסל','%','events','ניסיונות עד 2 מטר מהטבעת מתוך הזריקות עם מיקום.'],
 ['fastbreak','מתפרצות','%','events','נקודות שסומנו במתפרצת מתוך נקודות ביומן הזריקות המאומת.'],
 ['offRebound','ריבאונד התקפה','%','box','ריבאונד התקפה מתוך ריבאונד ההתקפה שלך וריבאונד ההגנה של היריבה.'],
 ['secondChance','הזדמנות שנייה','%','events','נקודות שסומנו כהזדמנות שנייה מתוך נקודות ביומן הזריקות המאומת.'],
 ['assisted','משחק מסירות','%','box','אסיסטים ביחס לסלים מהשדה.'],
 ['turnovers','איבודים','per100','estimated','איבודים ל־100 פוזשנים התקפיים משוערים.'],
 ['drawn','סחיטת עבירות','per40','box','עבירות שהקבוצה סחטה ל־40 דקות.'],
 ['height','גובה ממוצע על המגרש','cm','box','ממוצע הגובה של השחקנים, משוקלל לפי דקות המשחק הרשמיות שלהם.'],
 ['low','חמישיות נמוכות','%','lineups','אחוז הדקות בחמישיות ברבעון התחתון של גובה החמישיות במדגם הליגה, משוקלל לפי דקות.'],
 ['high','חמישיות גבוהות','%','lineups','אחוז הדקות בחמישיות ברבעון העליון של גובה החמישיות במדגם הליגה, משוקלל לפי דקות.']
];
const defense=[
 ['allowedThree','דיוק יריבות משלוש','%','box','קליעות היריבות ל־3 מתוך ניסיונותיהן ל־3.'],
 ['allowedTwo','דיוק יריבות לשתיים','%','box','קליעות היריבות ל־2 מתוך ניסיונותיהן ל־2.'],
 ['allowedRebound','ריבאונד התקפה ליריבות','%','box','שיעור ריבאונד ההתקפה של היריבות מול הקבוצה.'],
 ['forced','איבודי יריבות','per100','estimated','איבודי היריבות ל־100 פוזשנים התקפיים משוערים של היריבות.'],
 ['steals','חטיפות','per40','box','חטיפות של הקבוצה ל־40 דקות.'],
 ['allowedFouls','עבירות שסחטו היריבות','per40','box','עבירות שהיריבות סחטו ל־40 דקות.']
];
const playerMetrics=[
 ['assists','יצירת משחק','per40','box','אסיסטים ל־40 דקות.'],
 ['usage','מעורבות התקפית','%','estimated','אומדן Usage לפי זריקות, עונשין ואיבודים, משוקלל לפי חשיפה לפוזשנים.'],
 ['three','נפח שלשות','%','box','ניסיונות ל־3 מתוך ניסיונות מהשדה.'],
 ['threeAccuracy','דיוק משלוש','%','box','קליעות ל־3 מתוך ניסיונות ל־3.'],
 ['rim','זריקות ליד הסל','%','events','ניסיונות עד 2 מטר מהטבעת מתוך הזריקות עם מיקום.'],
 ['fastbreak','מתפרצות','%','events','נקודות שסומנו במתפרצת מתוך נקודות ביומן הזריקות המאומת.'],
 ['offRebound','ריבאונד התקפה','per40','box','ריבאונדי התקפה ל־40 דקות.'],
 ['defRebound','ריבאונד הגנה','per40','box','ריבאונדי הגנה ל־40 דקות.'],
 ['secondChance','הזדמנות שנייה','%','events','נקודות שסומנו כהזדמנות שנייה מתוך נקודות ביומן הזריקות המאומת.'],
 ['drawn','סחיטת עבירות','per40','box','עבירות שנסחטו ל־40 דקות.'],
 ['steals','חטיפות','per40','box','חטיפות ל־40 דקות.'],
 ['blocks','חסימות','per40','box','חסימות ל־40 דקות.'],
 ['turnovers','איבודים','per40','box','איבודים ל־40 דקות.'],
 ['fouls','עבירות שביצע','per40','box','עבירות שביצע ל־40 דקות.']
];
const units={'%':100,per40:40,per100:100,pos:40,cm:1};
const shootingMinimum={three:20,threeAccuracy:10,rim:20,fastbreak:20,secondChance:20,allowedThree:10,allowedTwo:10};

function shots(rows){
 if(!rows.length||!rows.every(p=>p.styleShots))return {};
 const entries=rows.map(p=>p.styleShots);
 const sum=k=>entries.reduce((total,r)=>total+r[k],0);
 const located=sum('located');
 const marked=k=>entries.every(r=>r[k])
  ?entries.reduce(([n,d],r)=>[n+r[k][0],d+r[k][1]],[0,0]):null;
 return {
  rim:located>=sum('fieldAttempts')*.8?pair(sum('nearRim'),located):null,
  fastbreak:marked('fastbreak'),secondChance:marked('secondChance')
 };
}

function validHeight(value){
 return Number.isFinite(value)&&value>=150&&value<=250;
}
function courtHeight(appearances,gameMinutes){
 if(!appearances.length||!(gameMinutes>0)||appearances.some(p=>!validHeight(p.height)))return null;
 const minutes=appearances.reduce((total,p)=>total+p.minutes,0);
 if(Math.abs(minutes-gameMinutes*5)>.25)return null;
 return pair(appearances.reduce((total,p)=>total+p.height*p.minutes,0),minutes);
}

function lineupSizes(appearances,gameMinutes){
 if(!appearances.length||!(gameMinutes>0))return [];
 const groups=new Map();
 const byId=new Map(appearances.map(p=>[p.id,p]));
 for(const p of appearances){
  if(!p.lineupCoverage)return [];
  for(const row of p.lineups||[]){
   if(!(row.minutes>0))continue;
   const ids=[p.id,...row.teammates.map(t=>t.id)].sort(),group=ids.join('|');
   if(ids.length!==5||new Set(ids).size!==5)return [];
   const sizes=ids.map(id=>byId.get(id)?.height);
   if(sizes.some(h=>!validHeight(h)))return [];
   const old=groups.get(group);
   if(old&&Math.abs(old.minutes-row.minutes)>0.001)return [];
   if(old)old.confirmations++;
   else groups.set(group,{height:sizes.reduce((sum,h)=>sum+h,0)/5,minutes:row.minutes,confirmations:1});
  }
 }
 const lineups=[...groups.values()];
 const minutes=lineups.reduce((sum,r)=>sum+r.minutes,0);
 return lineups.every(r=>r.confirmations===5)&&Math.abs(minutes-gameMinutes)<.05?lineups:[];
}
function heightBands(teams){
 const all=teams.flatMap(t=>t.games.flatMap(g=>g.lineups)).sort((a,b)=>a.height-b.height);
 const minutes=all.reduce((sum,r)=>sum+r.minutes,0);
 let elapsed=0,low=null;
 for(const r of all){
  elapsed+=r.minutes;
  if(low===null&&elapsed>=minutes*.25)low=r.height;
  if(elapsed>=minutes*.75)return {low,high:r.height};
 }
 return null;
}

function teamGames(team,official,events){
 const possession=s=>{
  const fields=[totalShots(s),field(s,'freeThrowsAttempted'),field(s,'offensiveRebounds'),field(s,'turnovers')];
  return fields.includes(null)?null:fields[0]+.44*fields[1]-fields[2]+fields[3];
 };
 const rebound=(s,o)=>pair(field(s,'offensiveRebounds'),add(field(s,'offensiveRebounds'),field(o,'defensiveRebounds')));
 return team.games.map(g=>{
  const s=g.stats,o=g.opponentStats,p=possession(s),q=possession(o);
  const side=official.teamGames?.[g.code]?.[g.home?'local':'road'];
  const minutes=side?.team===g.team?number(side.gameMinutes):null;
  const active=Object.values(events?.games?.[g.code]?.players||{}).filter(r=>r.team===g.team&&r.minutes>0);
  const boxAttempts=active.every(r=>totalShots(r.stats)!==null)?active.reduce((sum,r)=>sum+totalShots(r.stats),0):null;
  const boxPoints=active.every(r=>field(r.stats,'points')!==null)?active.reduce((sum,r)=>sum+r.stats.points,0):null;
  const coverage=boxAttempts===totalShots(s)&&boxPoints===g.points?shots(active):{};
  return {...g,lineups:lineupSizes(active,minutes),metrics:{
   pace:p>0&&q>0?pair((p+q)/2,minutes):null,three:pair(attempts(s,3),totalShots(s)),
   threeAccuracy:pair(made(s,3),attempts(s,3)),offRebound:rebound(s,o),
   assisted:pair(field(s,'assistances'),madeShots(s)),turnovers:pair(field(s,'turnovers'),p),
   drawn:pair(field(s,'foulsReceived'),minutes),height:courtHeight(active,minutes),...coverage,
   allowedThree:pair(made(o,3),attempts(o,3)),allowedTwo:pair(made(o,2),attempts(o,2)),
   allowedRebound:rebound(o,s),forced:pair(field(o,'turnovers'),q),steals:pair(field(s,'steals'),minutes),
   allowedFouls:pair(field(o,'foulsReceived'),minutes)
  }};
 });
}
function build(official,events,teamCore,now=Date.now()){
 const teams=teamCore.build(official,now).teams.map(t=>({...t,games:teamGames(t,official,events)}));
 const bands=heightBands(teams);
 for(const t of teams)for(const g of t.games){
  if(!g.lineups.length)continue;
  const sum=f=>g.lineups.reduce((acc,r)=>acc+f(r),0),minutes=sum(r=>r.minutes);
  if(bands.low<bands.high){
   g.metrics.low=pair(sum(r=>r.height<=bands.low?r.minutes:0),minutes);
   g.metrics.high=pair(sum(r=>r.height>=bands.high?r.minutes:0),minutes);
  }
 }
 const players=Object.values(official.players).map(p=>{
  const id=String(p.playerCode||'').replace(/^P/,'');
  const eligible=p.games.filter(g=>g.minutes>0&&Date.parse(g.date)<=now);
  const unique=[...new Map(eligible.map(g=>[g.gameCode,g])).values()];
  const games=unique.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.gameCode-a.gameCode).map(g=>{
   const s=g.stats,minutes=g.minutes,ev=events?.games?.[g.gameCode]?.players?.[id];
   const per=k=>pair(field(s,k),minutes);
   const usage=pair(field(g.metrics,'usageEvents'),field(g.metrics,'usageExposure'));
   return {...g,metrics:{
    assists:per('assistances'),usage,three:pair(attempts(s,3),totalShots(s)),threeAccuracy:pair(made(s,3),attempts(s,3)),
    offRebound:per('offensiveRebounds'),defRebound:per('defensiveRebounds'),drawn:per('foulsReceived'),
    steals:per('steals'),blocks:per('blocksFavour'),turnovers:per('turnovers'),fouls:per('foulsCommited'),
    ...(ev?.team===g.team?shots([ev]):{})
   }};
  });
  return {id,name:p.name,team:games[0]?.team,position:games[0]?.positionName,games};
 }).filter(p=>p.id&&p.games.length);
 return {teams,players,bands};
}
function select(games,range){
 return range>0?games.slice(0,range):games;
}
function summarize(games,metrics){
 return Object.fromEntries(metrics.map(([id,,unit])=>{
  let n=0,d=0,count=0,minutes=0;
  for(const g of games){
   const values=g.metrics[id];
   if(!values)continue;
   n+=values[0];d+=values[1];count++;minutes+=g.minutes||0;
  }
  return [id,{value:d>0?units[unit]*n/d:null,count,total:games.length,denominator:d,minutes}];
 }));
}
function comparable(stat,id,player=false){
 return stat?.value!=null&&stat.count>=3&&(!player||stat.minutes>=60)&&stat.denominator>=(shootingMinimum[id]||0);
}
function benchmark(stats,id,player=false){
 const values=stats.filter(s=>comparable(s,id,player)).map(s=>s.value);
 const count=values.length;
 return {count,mean:count>=leagueMinimum?values.reduce((sum,v)=>sum+v,0)/count:null,
  percentile(stat){
   if(count<leagueMinimum||!comparable(stat,id,player))return null;
   const below=values.filter(v=>v<stat.value).length,equal=values.filter(v=>v===stat.value).length;
   return Math.round(100*(below+equal/2)/count);
  }};
}

const api={season,key,offense,defense,playerMetrics,build,select,summarize,benchmark};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.DnaCore=api;
})(typeof window!=='undefined'?window:globalThis);
