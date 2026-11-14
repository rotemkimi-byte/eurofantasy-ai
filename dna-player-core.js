(function(root){
'use strict';
const node=typeof module==='object'&&module.exports;
const A=node?require('./advanced-player-core.js'):root.AdvancedPlayerCore;
const O=node?require('./official-offense-core.js'):root.OfficialOffense;
const U=node?require('./usage-core.js'):root.UsageCore;
const F=node?require('./free-throws.js'):root.FreeThrowsCore;
const P=node?require('./unified-forecast-core.js'):root.UnifiedForecast;
const D=node?require('./dna-core.js'):root.DnaCore;

const groups={
 shooting:'קליעה וצבע',creation:'יצירת משחק',transition:'מתפרצות והזדמנות שנייה',
 boards:'ריבאונד והגנה',fouls:'עבירות ועונשין',negative:'פעולות שליליות',
 pir:'תפוקת PIR',role:'דקות ותפקיד',opponent:'התאמה ליריבה',lineups:'הרכבים וחברי קבוצה',summary:'מדדים משולבים'
};
const box='בוקס־סקור',events='מפת זריקות / יומן זריקות',lineups='חמישיות מאומתות',estimate='אומדן מבוקס־סקור';
const catalog=[];
const metrics=(group,source,rows)=>rows.forEach(([id,label,unit,help,direction=0,origin='new'])=>
 catalog.push({id,group,source,label,unit,help,direction,origin}));
metrics('shooting',box,[
 ['ts','TS%','%','נקודות חלקי פעמיים סכום ניסיונות השדה ו־0.44 מניסיונות העונשין.',1,'linked'],
 ['efg','eFG%','%','קליעות שדה עם משקל של 1.5 לשלשה, חלקי ניסיונות השדה.',1,'linked'],
 ['fga40','זריקות שדה','ל־40 דק׳','ניסיונות לשתיים ולשלוש, מנורמלים ל־40 דקות.',0,'linked'],
 ['threePoints','נקודות משלשות','%','שלוש נקודות לכל שלשה שקלע, מתוך סך נקודותיו.']
]);
metrics('shooting',events,[
 ['distance','מרחק זריקה ממוצע','מ׳','מרחק אווירי מהטבעת בכל ניסיונות השדה עם יומן שלם.'],
 ['midVolume','זריקות מחצי מרחק','למשחק','ניסיונות לשתיים מחוץ לצבע ומעבר לשני מטר מהטבעת.'],
 ['midAccuracy','דיוק מחצי מרחק','%','קליעות מחצי מרחק מתוך ניסיונות מאותו אזור.',1],
 ['paintPoints','נקודות מהצבע','%','נקודות מסלי שדה במלבן הצבע, מתוך כלל נקודות השחקן.'],
 ['paintPerGame','נקודות מהצבע','למשחק','נקודות מסלי שדה במלבן הצבע, ללא עונשין.'],
 ['rimAttempts','זריקות ליד הטבעת','זריקות','כל ניסיונות השדה לשתיים עד שני מטרים מהטבעת במדגם.'],
 ['rimAccuracy','דיוק ליד הטבעת','%','קליעות מתוך ניסיונות לשתיים עד שני מטרים מהטבעת.',1,'linked'],
 ['rim40','זריקות ליד הטבעת','ל־40 דק׳','ניסיונות עד שני מטרים מהטבעת ביחס לדקות במדגם הזריקות.'],
 ['otherPaint','דיוק בצבע מחוץ לאזור הטבעת','%','קליעות מהצבע במרחק מעל שני מטרים מהטבעת. יחד עם דיוק ליד הטבעת, מחצי מרחק ומ־3, זה מכסה את אזורי הזריקה.',1]
]);
metrics('creation',box,[
 ['astTo','יחס אסיסטים לאיבודים','יחס','סך אסיסטים חלקי סך איבודים. היחס אינו מוגדר במדגם ללא איבודים.',1],
 ['teamShare','חלקו בנקודות הקבוצה','%','נקודות השחקן מתוך מלוא נקודות הקבוצה במשחקים שבהם השתתף.'],
 ['astVar','תנודתיות באסיסטים','אס׳','סטיית תקן של אסיסטים למשחק. ערך נמוך מעיד על פיזור קטן יותר.',-1],
 ['astTrend','מגמת אסיסטים','אס׳ למשחק','ממוצע ב־3 הופעות אחרונות פחות הממוצע בהופעות הקודמות בעונה.']
]);
metrics('creation',estimate,[
 ['involvement','מעורבות התקפית משולבת','%','Usage בתוספת אסיסטים לאותה חשיפה משוערת. הנתון מתאר מעורבות ויכול לכלול גם זריקה וגם מסירה באותו מהלך.',0,'linked'],
 ['usageDelta','פער מהממוצע העונתי ב־Usage','נק׳ אחוז','Usage בטווח פחות Usage בכל ההופעות העונתיות של השחקן.']
]);
metrics('transition',events,[
 ['fastFga','ניסיונות במתפרצת','זריקות','מספר ניסיונות השדה שסומנו במתפרצת.',0,'linked'],
 ['fastPct','דיוק במתפרצת','%','קליעות מהשדה מתוך ניסיונות שסומנו במתפרצת.',1,'linked'],
 ['fastShare','שיעור זריקות במתפרצת','%','ניסיונות שדה במתפרצות מתוך כל ניסיונות השדה במדגם.'],
 ['turnoverPoints','נקודות אחרי איבוד יריבה','נק׳ למשחק','נקודות שסומנו ביומן כנקודות אחרי איבוד, חלקי משחקים מכוסים.',0,'linked'],
 ['secondTs','יעילות בהזדמנות שנייה','%','TS% על זריקות שסומנו כהזדמנות שנייה. עונשין משוקלל ב־0.44.',1],
 ['otherAttack','נקודות מהתקפות אחרות','%','בחלוקה הבלעדית, מתפרצת מקבלת קדימות והזדמנות שנייה סופרת רק נקודות מחוץ למתפרצת. היתר הוא התקפות אחרות.']
]);
metrics('boards',box,[
 ['rebPir','תרומת ריבאונד ל־PIR','PIR למשחק','נקודת PIR אחת לכל ריבאונד התקפה או הגנה.',1],
 ['rebRatio','ריבאונד התקפה לעומת הגנה','יחס','ריבאונד התקפה חלקי ריבאונד הגנה.'],
 ['rebVar','תנודתיות בתרומת הריבאונד','PIR','סטיית תקן של תרומת הריבאונד ל־PIR בין משחקים.',-1],
 ['defPir','תרומת הגנה ישירה ל־PIR','PIR למשחק','חטיפות וחסימות, נקודת PIR לכל פעולה.'],
 ['defShare','חלקן של חטיפות וחסימות ב־PIR','%','חטיפות וחסימות חלקי PIR רשמי מצטבר, כשה־PIR הכולל חיובי.']
]);
metrics('fouls',box,[
 ['foulRatio','עבירות שסחט לעומת שביצע','יחס','עבירות שנסחטו חלקי עבירות שבוצעו.',1,'linked'],
 ['fta40','ניסיונות עונשין','ל־40 דק׳','ניסיונות מהקו ביחס לדקות.',0,'linked'],
 ['ftr','יחס עונשין לזריקות שדה','%','ניסיונות מהקו חלקי ניסיונות שדה.'],
 ['ftPoints','נקודות מהקו','%','נקודות מעונשין מתוך כלל נקודות השחקן.'],
 ['foulPir','תרומת עבירות נטו ל־PIR','PIR למשחק','עבירות שנסחטו פחות עבירות שבוצעו.',1],
 ['ftaTrend','מגמת הגעה לקו','זריקות למשחק','ניסיונות עונשין למשחק ב־3 האחרונות פחות הממוצע הקודם בעונה.']
]);
metrics('negative',estimate,[
 ['tovPct','שיעור איבודים (TOV%)','%','איבודים חלקי ניסיונות שדה, איבודים ו־0.44 מניסיונות העונשין. זהו אומדן סיומי הפוזשנים.',-1]
]);
metrics('negative',box,[
 ['negativePir','נזק מצטבר ל־PIR','PIR','סכום ההפחתות מהחטאות, איבודים, עבירות וזריקות שנחסמו.',0,'linked'],
 ['missPct','שיעור החטאות מהשדה','%','החטאות לשתיים ולשלוש ביחס לניסיונות השדה.',-1,'linked'],
 ['negRate','פעולות שליליות','לדקה','יחידות PIR שהופחתו לדקה. חסימה שספג נרשמת גם כהחטאה בהתאם לנוסחת PIR.',-1,'linked'],
 ['tovTrend','שינוי בתדירות איבודים','איב׳ ל־40 דק׳','איבודים ל־40 דקות בשלוש האחרונות פחות ההופעות הקודמות בעונה.',-1],
 ['pirRatio','תרומה חיובית לעומת שלילית','יחס','סך תוספות ה־PIR חלקי סך ההפחתות.',1],
 ['blockedPct','זריקות שנחסמו','%','חסימות שספג מתוך ניסיונות שדה.',-1,'linked']
]);
metrics('pir',box,[
 ['pir40','PIR ל־40 דקות','PIR','PIR מצטבר מנורמל ל־40 דקות.',1,'linked'],
 ['pirMinute','PIR לדקה','PIR','PIR מצטבר חלקי דקות ששיחק.',1,'linked'],
 ['positivePir','תרומות חיוביות לפי מרכיב','PIR','סכום נקודות, ריבאונדים, אסיסטים, חטיפות, חסימות ועבירות שנסחטו. הפירוט מצטבר במדגם.'],
 ['scoringShare','חלק הקליעה ב־PIR','%','נקודות פחות החטאות שדה ועונשין וחסימות שספג, חלקי PIR כולל חיובי.'],
 ['otherShare','חלק הפעולות ללא קליעה ב־PIR','%','יתרת ה־PIR אחרי תרומת הקליעה, חלקי PIR כולל חיובי. שני החלקים מסתכמים ל־100%.'],
 ['pirVar','סטיית תקן של PIR','PIR','פיזור PIR למשחק סביב הממוצע במדגם של שלוש הופעות לפחות.',-1]
]);
metrics('role',box,[
 ['starts','פתיחה בחמישייה','%','שיעור ההופעות שבהן נרשמה פתיחה בחמישייה.',0,'linked'],
 ['minVar','סטיית תקן של דקות','דק׳','פיזור דקות המשחק במדגם של שלוש הופעות לפחות.'],
 ['shotTrend','שינוי בזריקות שדה לדקה','זריקות לדקה','שלוש אחרונות פחות ההופעות הקודמות בעונה.'],
 ['astRateTrend','שינוי באסיסטים לדקה','אס׳ לדקה','שלוש אחרונות פחות ההופעות הקודמות בעונה.'],
 ['rest','זמן בין הופעות ביורוליג','ימים','זמן בין מועדי הפתיחה של שתי ההופעות האחרונות עד סוף הטווח שנבחר.'],
 ['load','עומס דקות ביורוליג','דק׳','סך דקות ב־5 ההופעות האחרונות עד סוף הטווח, עם לפחות 3 הופעות.']
]);
metrics('opponent',box,[
 ['allowedThree','דיוק שהיריבה מאפשרת משלוש','%','קליעות היריבות משלוש מתוך ניסיונותיהן.',0,'linked'],
 ['allowedFouls','עבירות שהיריבה מבצעת','ל־40 דק׳','עבירות שביצעה הקבוצה היריבה ביחס לאורך המשחק.',0,'linked'],
 ['allowedRebound','ריבאונד התקפה שהיריבה מאפשרת','%','ריבאונד התקפה מולה מתוך הסכום שלו ושל ריבאונד ההגנה שלה.',0,'linked'],
 ['pirWeakness','PIR שהיריבה מאפשרת לעמדה','PIR ל־40 דק׳','PIR ל־40 דקות שהיריבה אפשרה לעמדה, בעונת 2026/27. האחוזון כאן משווה בין יריבות.']
]);
metrics('opponent',estimate,[
 ['forced','איבודים מול היריבה','ל־100 פוז׳','איבודי הקבוצות ששיחקו נגדה ל־100 פוזשנים משוערים.',0,'linked'],
 ['pace','קצב צפוי','פוז׳ ל־40 דק׳','ממוצע קצב הפוזשנים המשוער של קבוצת השחקן ושל היריבה.',0,'linked']
]);
metrics('opponent',events,[
 ['allowedRim','דיוק שהיריבה מאפשרת ליד הטבעת','%','אחוז קליעה עד שני מטרים מהטבעת במדגם עם כיסוי של לפחות 80% מניסיונות השדה בכל משחק.'],
 ['allowedZones','זריקות שהיריבה מאפשרת לפי אזור','למשחק','ניסיונות מאומתים למשחק לפי אזור. המדגם כולל רק משחקים עם כיסוי של לפחות 80% מניסיונות השדה.']
]);
metrics('lineups',lineups,[
 ['lineupRate','קצב קליעה בחמישייה','נק׳ ל־40 דק׳','קצב הקליעה האישי בחמישייה המאומתת עם הכי הרבה דקות, מתוך חמישיות ששיחקו לפחות 10 דקות. הפירוט מציג עד שלוש חמישיות.',0,'linked']
]);
metrics('lineups',box,[
 ['absenceMin','שינוי דקות בהיעדר חבר מרכזי','דק׳ למשחק','דקות משחק ללא החבר פחות דקות איתו. נדרש רישום רשמי בכל משחק ולפחות שלוש הופעות בכל קבוצה.'],
 ['absenceUsage','שינוי Usage בהיעדר חבר מרכזי','נק׳ אחוז','Usage ללא החבר פחות Usage איתו, לפי אותן הופעות.']
]);
metrics('summary','בוקס־סקור ומפת זריקות',[
 ['scoringDependence','תלות בסגנון קליעה','%','שיעור מקור הקליעה הגדול ביותר מכל נקודות השחקן. ארבעה מקורות בלעדיים: שלשות, צבע, עונשין ושאר נקודות לשתיים.'],
 ['matchFit','התאמת DNA ליריבה','מתוך 100','אחוזון בין יריבות אפשריות לפי הדיוק שהן מאפשרות בכל אזור, משוקלל בתמהיל הזריקות של השחקן. 50 הוא אמצע המדגם.']
]);
metrics('summary',box,[
 ['pirStability','יציבות תרומה ביום קליעה חלש','%','PIR לדקה בשליש ההופעות שבהן תרומת הקליעה הייתה הנמוכה ביותר לדקה, ביחס לקצב PIR הרגיל. לפחות 6 הופעות.',1],
 ['minutesDependence','תלות בדקות','מתאם','מתאם פירסון בין דקות ל־PIR למשחק, ולצדו PIR לדקה. נדרשות 6 הופעות.'],
 ['teammateDependence','תלות בחבר מרכזי','PIR ל־40 דק׳','פער בתפוקה ל־40 דקות ללא החבר המרכזי לעומת איתו. השוואה תיאורית בין משחקים, המושפעת גם מיריבות ומתפקיד.'],
 ['roleChange','שינוי באחריות התקפית','פעולות ל־40 דק׳','פער בסך זריקות, אסיסטים, איבודים ו־0.44 מניסיונות העונשין ל־40 דקות בין שלוש האחרונות לשאר העונה. לא משתמש באחוזי קליעה.']
]);
metrics('summary','התחזית המשוקללת',[
 ['projection','התאמת PIR צפוי לסגנון','PIR','הפירוט אומד רכיבי PIR לפי קצב עונתי ודקות חזויות, משלים את הפער לבסיס האישי ומציג את תרומות כלי החיזוי לאחר שקלול. הסכום שווה לתחזית הפעילה.',0,'linked']
]);
const missing=[
 ['creation','AST%','חסר מספר סלי החברים בזמן שהשחקן היה על המגרש.'],
 ['boards','ORB% ו־DRB%','קיימים אומדנים לפי דקות, והמדד המדויק דורש הזדמנויות ריבאונד ששויכו לפוזשנים בזמן שהשחקן שיחק.'],
 ['boards','יעילות הגנתית על המגרש / Defensive Rating','חסרים ניקוד יריבה ופוזשנים מאומתים בזמן שהשחקן שיחק.'],
 ['lineups','Usage, נפח זריקות ויעילות קליעה לפי חמישייה','נתוני החמישיות הקיימים מייחסים לשחקן נקודות ודקות. נדרש גם שיוך מאומת של ניסיונות שדה, עונשין ואיבודים.'],
 ['lineups','Net Rating ו־PIR מלא לפי חמישייה','חסרים פוזשנים, ניקוד יריבה ושיוך כל רכיבי PIR לחמישייה.']
];

const finite=Number.isFinite;
const sum=values=>values.reduce((a,b)=>a+b,0);
const avg=values=>values.length?sum(values)/values.length:null;
const ratio=(n,d,k=1)=>finite(n)&&finite(d)&&d>0?k*n/d:null;
const diff=(a,b)=>finite(a)&&finite(b)?a-b:null;
function value(rows,read){
 const values=rows.map(read);
 return values.length&&values.every(finite)?sum(values):null;
}
const get=(g,k)=>g.stats?.[k];
const total=(rows,k)=>value(rows,g=>get(g,k));
const fga=g=>finite(get(g,'fieldGoalsAttempted2'))&&finite(get(g,'fieldGoalsAttempted3'))?get(g,'fieldGoalsAttempted2')+get(g,'fieldGoalsAttempted3'):null;
function sd(values){
 if(values.length<3||!values.every(finite))return null;
 const mean=avg(values);
 return Math.sqrt(avg(values.map(v=>(v-mean)**2)));
}
const count={rimAccuracy:10,midAccuracy:10,otherPaint:10,fastPct:8,ts:20,efg:20};
const labels=['ליד הטבעת','צבע מחוץ לאזור הטבעת','חצי מרחק','שלוש'];
const contextLabels=['מתפרצות','הזדמנות שנייה','התקפות אחרות'];
const positiveLabels={points:'נקודות',offensiveRebounds:'ריבאונד התקפה',defensiveRebounds:'ריבאונד הגנה',assists:'אסיסטים',steals:'חטיפות',blocks:'חסימות',foulsDrawn:'עבירות שנסחטו'};
const negativeLabels={miss2:'החטאות לשתיים',miss3:'החטאות לשלוש',missFT:'החטאות עונשין',turnovers:'איבודים',fouls:'עבירות',blocked:'זריקות שנחסמו'};
const parts=(record,labels)=>Object.entries(labels).map(([id,label])=>[label,record[id]]);

function select(games,limit=0,venue='all'){
 const rows=venue==='all'?games:games.filter(g=>g.home===(venue==='home')&&!g.neutral);
 return limit>0?rows.slice(0,limit):rows;
}

function seasonContext(official,advanced,asOf=Date.now(),{pregame=false,fixtureCode=null}={}){
 const empty={games:new Map(),players:new Map(),through:asOf,opponents:new Map(),positional:new Map(),pregame};
 if(official?.season!=='E2026'||!finite(asOf))return empty;
 const published=data=>Date.parse(data?.updated_at)<=asOf;
 if(pregame&&!published(official))return empty;
 const events=advanced?.season==='E2026'&&(!pregame||published(advanced))?advanced.games||{}:{};
 const games=new Map((official.teamResults||[]).filter(g=>Number(g.gameCode)>0&&String(g.gameCode)!==String(fixtureCode)&&
  Date.parse(g.date)+(pregame?4*3600000:0)<=asOf&&g.home&&g.away&&g.home!==g.away&&
  finite(g.homeScore)&&finite(g.awayScore)&&g.homeScore!==g.awayScore).map(g=>[String(g.gameCode),g]));
 const players=new Map();
 for(const p of Object.values(official.players||{})){
  const id=String(p.playerCode||'').replace(/^P/,'');
  if(!id||players.has(id))continue;
  const rows=new Map();
  for(const g of p.games||[]){
   const code=String(g.gameCode),game=games.get(code);
   if(!game||Date.parse(g.date)!==Date.parse(game.date)||!finite(g.minutes)||g.minutes<0||typeof g.home!=='boolean'||g.team!==(g.home?game.home:game.away)||g.opponent!==(g.home?game.away:game.home))continue;
   const candidate=events[code],event=candidate?.players?.[id],side=official.teamGames?.[code]?.[g.home?'local':'road'];
   const ev=event?.team===g.team&&Date.parse(candidate.date)===Date.parse(g.date)&&event.minutes===g.minutes&&
    ['points','fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3','freeThrowsMade','freeThrowsAttempted']
     .every(k=>finite(g.stats?.[k])&&g.stats[k]===event.stats?.[k])?event:null;
   rows.set(code,{...g,event:ev,teamScore:g.home?game.homeScore:game.awayScore,teamStats:side?.team===g.team?side.stats:null,
    neutral:game.neutral===true||game.isNeutralVenue===true});
  }
  players.set(id,{id,name:p.name,games:[...rows.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.gameCode-a.gameCode)});
 }
 const opponents=new Map(),allowed=new Map(),positional=new Map();
 const append=(map,key,row)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(row);};
 for(const p of players.values())for(const g of p.games){
  if(g.minutes===0)continue;
  append(allowed,g.opponent+'|'+g.gameCode,g);
  if(finite(g.stats?.valuation)&&g.positionName)append(positional,g.opponent+'|'+g.positionName,g);
 }
 for(const [code,g] of games)for(const home of [true,false]){
  const box=official.teamGames?.[code],team=home?g.home:g.away,rival=home?g.away:g.home;
  const a=box?.[home?'local':'road'],b=box?.[home?'road':'local'];
  if(a?.team===team&&b?.team===rival&&a.gameMinutes>0)append(opponents,team,{...g,home,minutes:a.gameMinutes,own:a.stats,rival:b.stats,shots:allowed.get(team+'|'+code)||[]});
 }
 for(const rows of opponents.values())rows.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.gameCode-a.gameCode);
 return {...empty,games,players,opponents,positional};
}

function zone(s){
 if(s.type.startsWith('3'))return 3;
 if(Math.hypot(s.x,s.y)<=200)return 0;
 return Math.abs(s.x)<=245&&s.y<=422.5?1:2;
}

function shotLedger(g){
 if(!g.event?.shotCoverage)return null;
 const rows=g.event.shots.filter(s=>!s.type.startsWith('FT'));
 if(rows.length!==fga(g)||!rows.every(s=>finite(s.x)&&finite(s.y)))return null;
 const bins=Array.from({length:4},()=>({attempts:0,made:0,points:0}));
 let distance=0,paint=0;
 for(const s of rows){
  const bin=bins[zone(s)];
  bin.attempts++;bin.made+=Number(s.made);bin.points+=s.points;
  distance+=Math.hypot(s.x,s.y)/100;
  if(s.type.startsWith('2')&&Math.abs(s.x)<=245&&s.y<=422.5)paint+=s.points;
 }
 return {bins,distance,paint,attempts:rows.length};
}

function zoneTotals(rows){
 const bins=Array.from({length:4},()=>({attempts:0,made:0,points:0}));
 for(const {ledger} of rows)ledger.bins.forEach((b,i)=>Object.keys(b).forEach(k=>{bins[i][k]+=b[k];}));
 return bins;
}

function pirLedger(games){
 const rows=[];
 for(const g of games){
  const ledger=P.components(g.stats);
  if(!ledger||!finite(g.stats.valuation)||!finite(g.stats.points)||
     g.stats.points!==ledger.fieldScoring+g.stats.freeThrowsMade||sum(Object.values(ledger))!==g.stats.valuation)continue;
  rows.push(g);
 }
 if(!rows.length)return null;
 const negative=Object.fromEntries(Object.entries(A.negative(rows)).map(([id,v])=>[id,-v.total]));
 const positive={points:total(rows,'points'),offensiveRebounds:total(rows,'offensiveRebounds'),defensiveRebounds:total(rows,'defensiveRebounds'),
  assists:total(rows,'assistances'),steals:total(rows,'steals'),blocks:total(rows,'blocksFavour'),foulsDrawn:total(rows,'foulsReceived')};
 const net=total(rows,'valuation'),plus=sum(Object.values(positive)),minus=sum(Object.values(negative));
 return plus+minus===net?{rows,positive,negative,net,plus,minus,scoring:positive.points+negative.miss2+negative.miss3+negative.missFT+negative.blocked}:null;
}

function teammate(context,record,season,recent){
 if(!season.length)return null;
 const codes=new Set(season.map(g=>String(g.gameCode)));
 const team=season[0].team;
 const candidates=[];
 for(const p of context.players.values()){
  if(p.id===record.id)continue;
  const together=p.games.filter(g=>g.team===team&&codes.has(String(g.gameCode)));
  const played=together.filter(g=>g.minutes>0);
  if(played.length<3||avg(played.map(g=>g.minutes))<18)continue;
  const minutes=avg(played.map(g=>g.minutes));
  const byCode=new Map(together.map(g=>[g.gameCode,g.minutes]));
  const withMate=recent.filter(g=>byCode.get(g.gameCode)>0);
  const without=recent.filter(g=>byCode.get(g.gameCode)===0);
  if(withMate.length>=3&&without.length>=3)candidates.push({name:p.name,minutes,withMate,without});
 }
 return candidates.sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name))[0]||null;
}

function summarize(record,context,options={}){
 const {limit=0,venue='all',gameCode=null}=options;
 const season=context.players.get(record.id)?.games.filter(g=>g.minutes>0)||[];
 const club=options.club||record.team;
 const current=season.filter(g=>g.team===club);
 const games=gameCode!=null?season.filter(g=>String(g.gameCode)===String(gameCode)):select(current,limit,venue);
 const history=season.filter(g=>!games.length||Date.parse(g.date)<=Date.parse(games[0].date));
 const sample=history.filter(g=>g.team===(games[0]?.team||club));
 const stats=Object.fromEntries(catalog.map(({id})=>[id,{value:null,count:0,total:games.length,minutes:0,denominator:0}]));
 const set=(id,x,rows=games,denominator=0,details=null)=>{
  if(finite(x)&&rows.length)stats[id]={value:x,count:rows.length,total:games.length,minutes:sum(rows.map(g=>g.minutes)),denominator,details};
 };
 const rate=(rows,k,exposure=rows.length,multiple=1)=>ratio(total(rows,k),exposure,multiple);
 const minuteSum=rows=>sum(rows.map(g=>g.minutes));
 const m=minuteSum(games),f=value(games,fga),p=total(games,'points'),tov=total(games,'turnovers'),ast=total(games,'assistances');
 const off=O.aggregate(games),usage=U.summarize(games),ft=F.summary(games),neg=A.negative(games);
 const ftAttempt=ft.coverage[0]===games.length&&finite(ft.fta)?ft.fta*games.length:null;
 const draw=ft.coverage[2]===games.length&&finite(ft.fouls)?ft.fouls*games.length:null;
 const fouls=ft.foulsCommittedGames===games.length&&finite(ft.foulsCommitted)?ft.foulsCommitted*games.length:null;
 const madeFt=ft.coverage[1]===games.length&&games.length?ft.made:null;
 const u=rows=>{const v=U.summarize(rows).regular;return v.covered===rows.length?v.value:null;};
 const pirRate=rows=>rate(rows,'valuation',minuteSum(rows),40);
 set('ts',off.tsPct,games,f);set('efg',off.efgPct,games,f);
 set('fga40',finite(off.fgaPerMinute)?40*off.fgaPerMinute:null);
 set('threePoints',rate(games,'fieldGoalsMade3',p,300));
 set('astTo',ratio(ast,tov));set('teamShare',ratio(p,value(games,g=>g.teamScore),100));
 set('astVar',sd(games.map(g=>get(g,'assistances'))));
 set('involvement',usage.combined.covered===games.length?usage.combined.value:null);
 set('usageDelta',diff(u(games),u(history)));
 const chartGames=games.map(g=>({g,ledger:shotLedger(g)})).filter(r=>r.ledger);
 const bins=zoneTotals(chartGames),[rim,paint,mid]=bins,covered=chartGames.map(r=>r.g);
 const chartPoints=value(covered,g=>get(g,'points'));
 const inPaint=sum(chartGames.map(r=>r.ledger.paint));
 set('distance',ratio(sum(chartGames.map(r=>r.ledger.distance)),sum(bins.map(z=>z.attempts))),covered);
 set('midVolume',ratio(mid.attempts,covered.length),covered);
 set('midAccuracy',ratio(mid.made,mid.attempts,100),covered,mid.attempts);
 set('paintPoints',ratio(inPaint,chartPoints,100),covered);
 set('paintPerGame',ratio(inPaint,covered.length),covered);
 set('rimAttempts',rim.attempts,covered);set('rimAccuracy',ratio(rim.made,rim.attempts,100),covered,rim.attempts);
 set('rim40',ratio(rim.attempts,minuteSum(covered),40),covered);
 set('otherPaint',ratio(paint.made,paint.attempts,100),covered,paint.attempts);
 const eventGames=games.filter(g=>g.event?.shotCoverage);
 const eventRows=eventGames.map(g=>({...g.event,gameCode:g.gameCode}));
 const attacks=A.attacks(eventRows);
 const coveredFor=k=>eventGames.filter(g=>g.event.shots.every(s=>typeof s[k]==='boolean'));
 const [fast,second,turnover]=attacks,fastRows=coveredFor('fastbreak');
 set('fastFga',fast.fga,fastRows);set('fastPct',ratio(fast.fgm,fast.fga,100),fastRows,fast.fga);
 set('fastShare',ratio(fast.fga,value(fastRows,fga),100),fastRows);
 set('turnoverPoints',ratio(turnover.points,turnover.covered),coveredFor('offTurnover'));
 set('secondTs',ratio(second.points,2*(second.fga+.44*second.fta),100),coveredFor('secondChance'));
 const tagged=eventGames.filter(g=>g.event.shots.filter(s=>s.made).every(s=>typeof s.fastbreak==='boolean'&&typeof s.secondChance==='boolean'));
 const allocation=[0,0,0];
 for(const g of tagged)for(const s of g.event.shots)if(s.made)allocation[s.fastbreak?0:s.secondChance?1:2]+=s.points;
 const allocTotal=sum(allocation);
 set('otherAttack',ratio(allocation[2],allocTotal,100),tagged,0,contextLabels.map((l,i)=>[l,ratio(allocation[i],allocTotal,100),'%']));
 const reb=g=>{const a=get(g,'offensiveRebounds'),b=get(g,'defensiveRebounds');return finite(a)&&finite(b)?a+b:null;};
 set('rebRatio',rate(games,'offensiveRebounds',total(games,'defensiveRebounds')));
 set('rebVar',sd(games.map(reb)));
 set('foulRatio',ratio(draw,fouls));set('fta40',ratio(ftAttempt,m,40));set('ftr',ratio(ftAttempt,f,100));
 set('ftPoints',ratio(madeFt,p,100));
 const endings=finite(f)&&finite(ftAttempt)&&finite(tov)?f+.44*ftAttempt+tov:null;
 set('tovPct',ratio(tov,endings,100));
 const miss=neg.miss2.covered===games.length&&neg.miss3.covered===games.length&&finite(f)?neg.miss2.total+neg.miss3.total:null;
 set('missPct',ratio(miss,f,100));set('blockedPct',ratio(neg.blocked.covered===games.length?neg.blocked.total:null,f,100));
 set('pir40',pirRate(games));set('pirMinute',rate(games,'valuation',m));
 set('pirVar',sd(games.map(g=>get(g,'valuation'))));
 const ledger=pirLedger(games);
 if(ledger){
  const {rows,positive,negative,plus,minus,net,scoring}=ledger;
  const stocks=positive.steals+positive.blocks;
  set('rebPir',(positive.offensiveRebounds+positive.defensiveRebounds)/rows.length,rows);
  set('defPir',stocks/rows.length,rows,0,parts(positive,{steals:'חטיפות',blocks:'חסימות'}));
  set('defShare',ratio(stocks,net,100),rows);
  set('foulPir',(positive.foulsDrawn+negative.fouls)/rows.length,rows);
  set('negativePir',minus,rows,0,parts(negative,negativeLabels));
  set('positivePir',plus,rows,0,parts(positive,positiveLabels));
  set('negRate',ratio(-minus,minuteSum(rows)),rows);set('pirRatio',ratio(plus,-minus),rows);
  set('scoringShare',ratio(scoring,net,100),rows);
  set('otherShare',ratio(net-scoring,net,100),rows);
 }
 const starts=games.filter(g=>typeof g.event?.stats?.startFive==='boolean');
 set('starts',ratio(starts.filter(g=>g.event.stats.startFive).length,starts.length,100),starts);
 set('minVar',sd(games.map(g=>g.minutes)));
 const recent=select(sample,3,venue),prior=select(sample,0,venue).slice(3);
 if(games.length&&recent.length===3&&prior.length>=3){
  const trend=(id,read)=>set(id,diff(read(recent),read(prior)),recent.concat(prior));
  trend('astTrend',rows=>rate(rows,'assistances'));
  trend('ftaTrend',rows=>rate(rows,'freeThrowsAttempted'));
  trend('tovTrend',rows=>rate(rows,'turnovers',minuteSum(rows),40));
  trend('shotTrend',rows=>ratio(value(rows,fga),minuteSum(rows)));
  trend('astRateTrend',rows=>rate(rows,'assistances',minuteSum(rows)));
  trend('roleChange',rows=>{
   const a=value(rows,fga),b=total(rows,'freeThrowsAttempted'),c=total(rows,'turnovers'),d=total(rows,'assistances');
   return [a,b,c,d].every(finite)?ratio(a+.44*b+c+d,minuteSum(rows),40):null;
  });
 }
 if(history.length>=2&&games.length)set('rest',(Date.parse(history[0].date)-Date.parse(history[1].date))/86400000,history.slice(0,2));
 if(history.length>=3&&games.length)set('load',minuteSum(history.slice(0,5)),history.slice(0,5));
 const lineupRows=games.filter(g=>g.event?.lineupCoverage&&g.event.lineups.every(l=>finite(l.minutes))&&g.event.lineups.some(l=>l.minutes>0));
 const combination=A.lineups(lineupRows.map(g=>({...g.event,gameCode:g.gameCode}))).filter(l=>l.minutes>=10).sort((a,b)=>b.minutes-a.minutes);
 if(combination.length)set('lineupRate',combination[0].per40,lineupRows,0,
  combination.slice(0,3).map(l=>[l.teammates.map(t=>t.name).join(' · '),l.per40,'נק׳ ל־40 דק׳']));
 if(games.length>=6){
  const mate=teammate(context,record,sample,games);
  if(mate){
   const {withMate,without,name}=mate,detailsFor=(a,b,unit)=>[[name+' · איתו',a,unit],[name+' · בלעדיו',b,unit]];
   const rows=withMate.concat(without),a=minuteSum(withMate)/withMate.length,b=minuteSum(without)/without.length;
   set('absenceMin',b-a,rows,0,detailsFor(a,b,'דק׳'));
   set('absenceUsage',diff(u(without),u(withMate)),rows,0,detailsFor(u(withMate),u(without),'%'));
   set('teammateDependence',diff(pirRate(without),pirRate(withMate)),rows,0,detailsFor(pirRate(withMate),pirRate(without),'PIR ל־40 דק׳'));
  }
  const rates=games.map(g=>[g.minutes,get(g,'valuation')]);
  if(rates.every(([,v])=>finite(v))){
   const x=avg(rates.map(r=>r[0])),y=avg(rates.map(r=>r[1]));
   const centered=rates.map(([a,b])=>[a-x,b-y]);
   const correlation=ratio(sum(centered.map(([a,b])=>a*b)),Math.sqrt(sum(centered.map(([a])=>a*a))*sum(centered.map(([,b])=>b*b))));
   set('minutesDependence',correlation,games,0,[['PIR לדקה',stats.pirMinute.value,'']]);
  }
 }
 if(ledger?.rows.length>=6){
  const cold=ledger.rows.map(g=>({g,scoring:pirLedger([g]).scoring/g.minutes})).sort((a,b)=>a.scoring-b.scoring)
   .slice(0,Math.ceil(ledger.rows.length/3)).map(r=>r.g);
  set('pirStability',ratio(pirRate(cold),pirRate(ledger.rows),100),ledger.rows,0,[['PIR ל־40 דק׳ בקליעה חלשה',pirRate(cold),''],['PIR ל־40 דק׳ בטווח',pirRate(ledger.rows),'']]);
 }
 if(covered.length&&chartPoints>0){
  const three=total(covered,'fieldGoalsMade3')*3,free=total(covered,'freeThrowsMade');
  const shares=[three,inPaint,free,chartPoints-three-inPaint-free];
  if(shares.every(v=>finite(v)&&v>=0))set('scoringDependence',ratio(Math.max(...shares),chartPoints,100),covered,0,
   ['שלשות','צבע','עונשין','שאר נקודות לשתיים'].map((l,i)=>[l,ratio(shares[i],chartPoints,100),'%']));
 }
 return {stats,games,bins,shotGames:covered.length,position:games[0]?.positionName||record.position};
}

function opponentZones(rows){
 const covered=[];
 let verified=0,attempted=0;
 for(const g of rows){
  const expected=fga({stats:g.rival});
  if(!(expected>0)||value(g.shots,fga)!==expected)continue;
  const ledgers=g.shots.map(shotLedger).filter(Boolean);
  const checked=sum(ledgers.map(l=>l.attempts));
  if(checked<expected*.8)continue;
  covered.push({g,ledger:{bins:zoneTotals(ledgers.map(ledger=>({ledger})))}});
  verified+=checked;attempted+=expected;
 }
 return {bins:zoneTotals(covered),covered:covered.map(r=>r.g),verified,attempted};
}

function buildRivals(context,{limit=0,venue='all'}={}){
 const clubs=new Map();
 for(const [team,history] of context.opponents){
  const rows=select(history,limit,venue);
  const stats=opponentZones(rows);
  clubs.set(team,{...stats,rows});
 }
 return clubs;
}

function opponentReport(report,context,clubs,opponent,ownTeam,teamModel,{limit=0,venue='all'}={}){
 const rival=clubs.get(opponent);
 if(!rival)return report;
 const rows=rival.rows,stats=report.stats;
 const set=(id,x,covered=rows,details=null)=>{
  if(finite(x)&&covered.length)stats[id]={value:x,count:covered.length,total:rows.length,minutes:sum(covered.map(g=>g.minutes)),denominator:0,details};
 };
 const fromTeam=(team,range,ids)=>{
  const rows=select(teamModel?.teams.find(t=>t.team===team)?.games||[],limit,range);
  return D.summarize(rows,ids);
 };
 const defense=D.defense.filter(([id])=>['allowedThree','allowedRebound','forced'].includes(id));
 const existing=fromTeam(opponent,venue,defense);
 for(const [id] of defense)if(finite(existing[id]?.value))stats[id]=existing[id];
 set('allowedFouls',ratio(value(rows,g=>g.own?.foulsCommited),sum(rows.map(g=>g.minutes)),40));
 const paceSpec=D.offense.filter(([id])=>id==='pace');
 const otherVenue=venue==='home'?'away':venue==='away'?'home':'all';
 const own=fromTeam(ownTeam,otherVenue,paceSpec).pace,rivalPace=fromTeam(opponent,venue,paceSpec).pace;
 if(finite(own.value)&&finite(rivalPace.value))
  set('pace',(own.value+rivalPace.value)/2,rows,[['קבוצת השחקן',own.value],['היריבה',rivalPace.value]]);
 const position=({G:'Guard',F:'Forward',C:'Center'})[report.position]||report.position;
 const positional=(team,rows)=>{
  const codes=new Set(rows.map(g=>String(g.gameCode)));
  const p=(context.positional.get(team+'|'+position)||[]).filter(g=>codes.has(String(g.gameCode)));
  return ratio(total(p,'valuation'),sum(p.map(g=>g.minutes)),40);
 };
 const vulnerability=positional(opponent,rows);
 set('pirWeakness',vulnerability);
 const posValues=[...clubs].map(([team,r])=>positional(team,r.rows)).filter(finite);
 if(posValues.length>=6&&finite(vulnerability))stats.pirWeakness.rank=percentile(vulnerability,posValues);
 const rim=rival.bins[0];
 const coverage=['ניסיונות שדה מאומתים במדגם',ratio(rival.verified,rival.attempted,100),'%'];
 set('allowedRim',ratio(rim.made,rim.attempts,100),rival.covered,[coverage]);
 if(rival.covered.length){
  const details=[...rival.bins.map((z,i)=>[labels[i],z.attempts/rival.covered.length,'למשחק']),coverage];
  set('allowedZones',sum(rival.bins.map(z=>z.attempts))/rival.covered.length,rival.covered,details);
 }
 const active=report.bins.map(z=>z.attempts);
 const idx=active.map((n,i)=>n>=5?i:null).filter(i=>i!==null);
 const sample=sum(idx.map(i=>active[i]));
 if(sample>=20&&report.shotGames>=2){
  const scores=[];
  for(const [name,club] of clubs){
   if(name===ownTeam||club.covered.length<2||idx.some(i=>club.bins[i].attempts<12))continue;
   scores.push([name,sum(idx.map(i=>active[i]*club.bins[i].made/club.bins[i].attempts))/sample]);
  }
  const chosen=scores.find(([name])=>name===opponent)?.[1];
  if(finite(chosen)&&scores.length>=6){
   const rank=percentile(chosen,scores.map(([,v])=>v));
   set('matchFit',rank,rival.covered,[['אחוז קליעה משוקלל שהיריבה מאפשרת',100*chosen,'%'],
    ['יריבות במדגם',scores.length,'קבוצות'],coverage]);
  }
 }
 return report;
}

function percentile(v,values){
 const below=values.filter(n=>n<v).length,equal=values.filter(n=>n===v).length;
 return Math.round(100*(below+equal/2)/values.length);
}

function rank(stat,id,cohort){
 const eligible=s=>finite(s?.value)&&s.count>=3&&s.minutes>=45&&s.denominator>=(count[id]||0);
 if(!eligible(stat))return null;
 const values=cohort.filter(eligible).map(s=>s.value);
 return values.length>=6?percentile(stat.value,values):null;
}

function projection(frozen,weighted,weights,profile){
 if(!frozen||!weighted||!weights||!weighted.valid(weights))return null;
 const expected=weighted.project(frozen,weights);
 const values=weighted.definitions.map(({id,label},i)=>[id,label,frozen.scale*(frozen.signals[i]??0)*weights[id]/100]);
 const chosen=new Set(['shotMap','playerDna','teamDna']);
 const applied=sum(values.map(row=>row[2]));
 const adjustment=expected-frozen.base-applied;
 const style=values.filter(([id])=>chosen.has(id));
 const rates=profile?.componentRates;
 const minutes=frozen.minutes;
 const baseline=rates&&minutes>0?[
  ['קליעה והחטאות שדה',(rates.fieldScoring+rates.fieldMisses+rates.shotsBlocked)*minutes],
  ['עונשין נטו',rates.freeThrows*minutes],
  ['ריבאונד',(rates.offensiveRebounds+rates.defensiveRebounds)*minutes],
  ['אסיסטים ואיבודים',(rates.assists+rates.turnovers)*minutes],
  ['חטיפות וחסימות',(rates.steals+rates.blocks)*minutes],
  ['עבירות נטו',(rates.foulsDrawn+rates.fouls)*minutes]
 ]:null;
 const baseParts=baseline?[...baseline,['התאמת המודל לבסיס האישי',frozen.base-sum(baseline.map(([,v])=>v))]]
  :[['בסיס אישי',frozen.base]];
 return {value:expected,count:1,total:1,details:[
  ...baseParts.map(([label,v])=>[label,v,'PIR']),
  ...style.map(([,label,v])=>[label,v,'PIR']),
  ['שאר כלי החיזוי',applied-sum(style.map(row=>row[2])),'PIR'],
  ...(Math.abs(adjustment)>1e-8?[['התאמת רצפת התחזית',adjustment,'PIR']]:[])
 ]};
}

function features(record,context){
 // These aggregates describe different dimensions; volume and Usage stay out of
 // shot mix and stability so callers can replace related signals in experiments.
 if(!context.pregame)throw new TypeError('Pregame DNA context is required');
 const {stats}=summarize(record,context);
 return Object.freeze({season:'E2026',asOf:context.through,
  efficiency:stats.efg.value,stability:stats.pirStability.value,
  offensiveRole:stats.roleChange.value,teammateContext:stats.teammateDependence.value});
}

// Closely related values share one expandable row and retain their own units,
 // sample, definition and rank.
const detailRows={
 midVolume:['midAccuracy'],rimAttempts:['rim40'],fta40:['ftr'],pir40:['pirMinute'],
 scoringShare:['otherShare'],allowedRim:['allowedZones'],absenceMin:['absenceUsage']
};
const api={catalog,groups,detailRows,missing,select,seasonContext,summarize,pirLedger,buildRivals,opponentReport,rank,projection,features};
if(node)module.exports=api;else root.PlayerDnaMetrics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
