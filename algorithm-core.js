/* Experimental, transparent weighted sensitivity model. Does not alter live forecasts. */
(function(root){
'use strict';
const definitions=[
 ['minutes','דקות משחק',30,'ממוצע שלושת המשחקים האחרונים לעומת דקות הבסיס.'],
 ['form','יכולת בעונה הנוכחית',20,'PIR לדקה בעונה מול קצב הבסיס האישי; כך דקות אינן נספרות שוב.'],
 ['venue','בית, חוץ וקהל',10,'מצב אחד בלבד: בית עם קהל, בית ללא קהל, חוץ או מגרש ניטרלי.'],
 ['injuries','חיסורים בסגל',10,'אומדן תוספת דקות ומעורבות עקב חיסורי חברים לסגל.'],
 ['position','היריבה מול העמדה',10,'התאמה לפי PIR שהיריבה מאפשרת לעמדה, ולא בונוס קבוע לגארד או סנטר.'],
 ['involvement','מעורבות בהתקפה',5,'שינוי בזריקות, עונשין ואיבודים לדקה לעומת התקופה הקודמת.'],
 ['defense','הגנה מול סגנון הקליעה',5,'ההתאמה בין סוג הזריקות של השחקן לקליעה שהיריבה מאפשרת.'],
 ['streak','רצף משחקים טובים או חלשים',5,'לפחות שני משחקים ברצף בקצב PIR לדקה גבוה או נמוך ב־15% מהעונה.'],
 ['blowout','סיכון לירידה בדקות',5,'ממוצע הדקות בתרחישי משחק צמוד, ניצחון גדול והפסד גדול.'],
 ['rest','מנוחה ועומס',0,'דורש לוח מלא, כולל הליגה המקומית. ללא מידע מאומת אינו משפיע.']
].map(([id,label,weight,description])=>({id,label,weight,description}));
const defaults=Object.fromEntries(definitions.map(d=>[d.id,d.weight]));
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
function valid(weights){return definitions.every(d=>num(weights?.[d.id])!==null&&weights[d.id]>=0&&weights[d.id]<=100)&&Math.abs(definitions.reduce((s,d)=>s+Number(weights[d.id]),0)-100)<.001;}
function normalize(weights){const values=definitions.map(d=>clip(num(weights?.[d.id])??0,0,100)),sum=values.reduce((a,b)=>a+b,0);if(!sum)return {...defaults};const raw=values.map(v=>v/sum*100),out=raw.map(Math.floor);let remaining=100-out.reduce((a,b)=>a+b,0);raw.map((v,i)=>({i,remainder:v-out[i]})).sort((a,b)=>b.remainder-a.remainder).slice(0,remaining).forEach(x=>out[x.i]++);return Object.fromEntries(definitions.map((d,i)=>[d.id,out[i]]));}
function evaluate(player,x,weights,overrides={}){
 if(num(overrides.minutes)!==null&&(Number(overrides.minutes)<0||Number(overrides.minutes)>40))return {error:'דקות התרחיש צריכות להיות בין 0 ל־40.'};
 if(!valid(weights))return {error:'סכום המשקלים חייב להיות 100%.'};
 const base=num(x.basePir),baseMinutes=num(x.baseMin);
 if(base===null||base<0||!(baseMinutes>0))return {error:'חסר בסיס אישי תקין לחישוב.'};
 if(!['G','F','C'].includes(player.pos))return {error:'החישוב מיועד לשחקנים בלבד.'};
 const recent=x.recentForm,context=x.context,profile=context?.profile;
 const logs=(profile?.logs||[]).filter(g=>num(g.minutes)>0&&num(g.valuation??g.pir)!==null).slice().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const latest=logs.slice(-3),count=Number(recent?.currentSeasonGames||profile?.games||0),reliability=count/(count+4);
 const rate=base/baseMinutes,seasonRate=num(recent?.season?.pirPerMinute),signals={};
 const set=(id,value,note)=>signals[id]={signal:value==null?null:clip(value,-1,1),note};
 const lastMinutes=latest.length?latest.reduce((s,g)=>s+g.minutes,0)/latest.length:null;
 const manual=num(overrides.minutes),target=manual!==null?clip(manual,0,40):lastMinutes;
 set('minutes',target==null?null:(target/baseMinutes-1)/.30,manual!==null?'תרחיש דקות ידני: '+target.toFixed(1):lastMinutes==null?'אין משחקים אחרונים זמינים':`ממוצע ${latest.length} משחקים: ${lastMinutes.toFixed(1)} דקות; בסיס ${baseMinutes.toFixed(1)}`);
 set('form',seasonRate==null?null:(seasonRate/rate-1)/.20*reliability,seasonRate==null?'חסר PIR לדקה בעונה':`${seasonRate.toFixed(2)} PIR לדקה בעונה לעומת ${rate.toFixed(2)} בבסיס · ${count} משחקים`);
 const venue={home:1,empty:.25,away:-1,neutral:0};
 set('venue',venue[overrides.venue]??null,{home:'תרחיש ידני: בית עם קהל',empty:'תרחיש ידני: בית ללא קהל',away:'תרחיש ידני: חוץ',neutral:'תרחיש ידני: מגרש ניטרלי'}[overrides.venue]||'מצב הקהל והמגרש לא אומת; אין התאמה אוטומטית');
 const injuryMinutes=num(x.injuryBoost),injuryUsage=num(x.injuryUsagePct);
 set('injuries',injuryMinutes==null||injuryUsage==null?null:(injuryMinutes/baseMinutes+injuryUsage/100)/.10,injuryMinutes==null?'חסרים נתוני חיסורים':`${(x.missingStars||[]).join(', ')||'אין חיסורים משפיעים מסומנים'} · אומדן ${injuryMinutes.toFixed(1)} דקות נוספות`);
 set('position',x.positionMatchup?Number(x.positionMatchPct||0)/10:null,x.positionMatchup?`עמדה ${player.pos} מול ${x.match?.opponent||player.opponent} · התאמה ${Number(x.positionMatchPct||0).toFixed(1)}%`:'אין נתוני הגנה מאומתים לעמדה');
 set('involvement',profile?.previousGames>=3&&profile?.recentGames>=2&&profile.previousEventsPerMinute>0?(profile.recentEventsPerMinute/profile.previousEventsPerMinute-1)*reliability/.20:null,profile?.previousGames>=3?'השינוי בנפח ההתקפי לדקה, עם הפחתה במדגם קטן':'אין מספיק משחקים להשוואת מעורבות');
 set('defense',context?.defenseSample>=3&&num(context.defensePointsDelta)!==null?context.defensePointsDelta/Math.max(10,base)*.35/.05:null,context?.defenseSample>=3?'השפעת קליעה לשתיים ולשלוש מול היריבה':'מדגם הגנה קטן או חסר');
 const pair=latest.slice(-2),ratios=seasonRate>0?pair.map(g=>Number(g.valuation??g.pir)/g.minutes/seasonRate):[];
 const streak=ratios.length===2?(ratios.every(v=>v>=1.15)?1:ratios.every(v=>v<=.85)?-1:0):null;
 set('streak',streak==null?null:streak*reliability,streak===1?'שני משחקים רצופים מעל קצב העונה':streak===-1?'שני משחקים רצופים מתחת לקצב העונה':streak===0?'אין רצף מובהק בשני המשחקים האחרונים':'אין מדגם מספיק לרצף');
 const scenarios=context?.scenarios,scenarioMinutes=scenarios?.length?scenarios.reduce((s,g)=>s+g.minutes*g.weight,0):null;
 set('blowout',context?.minutesCorrectionActive&&scenarioMinutes!=null&&num(x.minutes)>0?(scenarioMinutes/(x.minutes-Number(context.minutesChange||0))-1)/.05:null,context?.minutesCorrectionActive?'שינוי דקות משוקלל לפי תרחישי הפרש':'פחות משמונה משחקים או אין תרחישים: ללא השפעה');
 set('rest',null,'אין מקור מאומת לכל המשחקים, הטיסות וימי המנוחה');
 const rows=definitions.map(d=>{const a=signals[d.id],weight=Number(weights[d.id]),change=base*weight/100*(a.signal??0);return {...d,...a,weight,change};});
 const raw=rows.reduce((s,r)=>s+r.change,0),bounded=clip(raw,-base*.60,base*.60),out=player.status==='out'||manual===0;
 const availability=player.status==='questionable'?.82:1;
 const beforeAvailability=Math.max(0,base+bounded),expected=out?0:beforeAvailability*availability;
 return {base,baseMinutes,rows,rawChange:raw,capChange:bounded-raw,availabilityChange:expected-beforeAvailability,expected,live:num(x.expected),coverage:rows.filter(r=>r.signal!==null).reduce((s,r)=>s+r.weight,0),out,questionable:player.status==='questionable',targetMinutes:target};
}
const api={definitions,defaults,valid,normalize,evaluate};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AlgorithmLab=api;
})(typeof window!=='undefined'?window:globalThis);
