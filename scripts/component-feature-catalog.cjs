'use strict';

const DNA=require('../dna-player-core.js');
const {targets}=require('../component-forecast-core.cjs');
const minutes=['minutes'], volume=['twoAttempts','threeAttempts','freeAttempts'];
const accuracy=['twoAccuracy','threeAccuracy','freeAccuracy'];
const offense=[...volume,'assists','turnovers','drawn'];
const boards=['offRebounds','defRebounds'], defense=['steals','blocks'];
const fallback={
 shooting:[...volume,...accuracy],creation:['assists','turnovers',...volume],transition:['twoAttempts','twoAccuracy','threeAttempts'],
 boards:[...boards,...defense],fouls:['freeAttempts','freeAccuracy','fouls','drawn'],
 negative:['twoAccuracy','threeAccuracy','turnovers','blocked','fouls'],pir:targets,role:[...minutes,...offense],
 opponent:targets,lineups:[...minutes,...offense,...accuracy],summary:targets
};
const explicit={
 ts:accuracy,efg:accuracy.slice(0,2),fga40:volume.slice(0,2),threePoints:['threeAttempts','threeAccuracy'],
 distance:['twoAttempts','threeAttempts','twoAccuracy'],midVolume:['twoAttempts'],midAccuracy:['twoAccuracy'],
 paintPoints:['twoAttempts','twoAccuracy'],paintPerGame:['twoAttempts','twoAccuracy'],rimAttempts:['twoAttempts'],
 rimAccuracy:['twoAccuracy'],rim40:['twoAttempts'],otherPaint:['twoAccuracy'],
 astVar:['assists'],astTrend:['assists'],orbPct:['offRebounds'],drbPct:['defRebounds'],astPct:['assists'],
 fta40:['freeAttempts'],ftaTrend:['freeAttempts'],ftPoints:['freeAttempts','freeAccuracy'],
 tovTrend:['turnovers'],tovPct:['turnovers'],missPct:accuracy.slice(0,2),blockedPct:['blocked'],
 starts:minutes,minVar:minutes,rest:minutes,load:minutes,shotTrend:volume.slice(0,2),astRateTrend:['assists'],
 absenceMin:minutes,absenceUsage:offense,scoringDependence:[...volume,...accuracy],
 minutesDependence:minutes,roleChange:offense,allowedThree:['threeAccuracy'],allowedRim:['twoAccuracy'],
 allowedZones:volume.slice(0,2),allowedFouls:['drawn','freeAttempts'],allowedRebound:boards,
 forced:['turnovers'],pace:targets.filter(k=>k!=='minutes'&&!accuracy.includes(k)),
 matchFit:accuracy.slice(0,2)
};
const dna=[...DNA.catalog,...DNA.addedMetrics].map(spec=>({
 ...spec,level:spec.group==='opponent'||spec.group==='lineups'||['matchFit','teammateDependence'].includes(spec.id)?'D':'C',
 targets:explicit[spec.id]||fallback[spec.group],
 excluded:spec.id==='projection'?'תחזית נגזרת של האלגוריתם הפעיל':spec.id==='usageDelta'?'בטווח עונה המדד מחסר את העונה מעצמה':null
}));
const context=[
 ['home','בית / חוץ','לוח המשחקים',targets],
 ['pace','קצב צפוי','DNA קבוצתי',explicit.pace],
 ['opportunity2','נפח זריקות לשתיים מול היריבה','הגנה לפי עמדה',['twoAttempts']],
 ['opportunity3','נפח זריקות לשלוש מול היריבה','הגנה לפי עמדה',['threeAttempts']],
 ['opponent2','דיוק לשתיים מול היריבה','הגנה לפי עמדה',['twoAccuracy']],
 ['opponent3','דיוק לשלוש מול היריבה','הגנה לפי עמדה',['threeAccuracy']],
 ['zone2','דיוק צפוי לפי תמהיל הזריקות לשתיים','מפת זריקות ו־DNA הגנתי',['twoAccuracy']],
 ['zoneVolume2','נפח זריקות לפי אזור מול היריבה','מפת זריקות ו־DNA הגנתי',['twoAttempts']],
 ['drawnAllowed','סחיטת עבירות מול היריבה','הגנה לפי עמדה',['drawn','freeAttempts']],
 ['forcedTurnovers','איבודים מול היריבה','הגנה לפי עמדה',['turnovers']],
 ['offBoardsAllowed','ריבאונד התקפה מול היריבה','הגנה לפי עמדה',['offRebounds']],
 ['defBoardsAllowed','ריבאונד הגנה מול היריבה','הגנה לפי עמדה',['defRebounds']],
 ['blockedAllowed','חסימות שסופגים מול היריבה','הגנה לפי עמדה',['blocked','twoAccuracy']],
 ['absenceMinutes','דקות קודמות של חברים חסרים','תמונת מצב לפני המשחק ודקות העונה',[...minutes,...offense]],
 ['mainTeammateOut','היעדר חבר מרכזי','תמונת מצב לפני המשחק ו־DNA שחקן',[...minutes,...offense]],
 ['available','סטטוס השחקן לפני המשחק','תמונת מצב מסגל הפנטזי',minutes],
 ['headToHead','יעילות במפגשים קודמים באותה עונה','מאצ׳אפ שחקנים וקבוצות',accuracy.slice(0,2)],
 ['similarTwo','דיוק לשתיים מול הגנות דומות','סגנון הגנה ומפת זריקות',['twoAccuracy']],
 ['similarThree','דיוק לשלוש מול הגנות דומות','סגנון הגנה ומפת זריקות',['threeAccuracy']]
].map(([id,label,source,targets])=>({id:'context.'+id,label,source,targets,level:'D'}));

module.exports={dna,context,catalog:[...dna,...context]};
