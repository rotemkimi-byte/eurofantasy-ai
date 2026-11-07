'use strict';
const C=require('../advanced-player-core.js');
const check=(value,msg)=>{if(!value)throw Error(msg)};
const eq=(a,b,msg)=>check(JSON.stringify(a)===JSON.stringify(b),msg+': '+JSON.stringify(a));
check(C.n(null)===null&&C.n('')===null&&C.n(false)===null,'missing numbers');
const games=[{gameCode:1,date:'2026-01-01T00:00:00Z',minutes:10,stats:{plusMinus:4}},{gameCode:2,date:'2026-01-02T00:00:00Z',minutes:30,stats:{plusMinus:-2}},{gameCode:3,date:'2026-01-03T00:00:00Z',minutes:0,stats:{plusMinus:0}}];
eq(C.plus(games).per40,2,'weighted per40');eq(C.plus(games).mean,1,'DNP excluded');eq(C.plus([]).total,null,'missing != zero');
eq(C.select(games,'1')[0].gameCode,3,'last registered game includes DNP');eq(C.select(games,'game:1')[0].gameCode,1,'specific game');
eq(C.select([...games,games[0],{gameCode:4,date:'2099-01-01T00:00:00Z'}],0).length,3,'deduplicate and exclude future');
const boxMean=C.boxAverages([
 {minutes:10,stats:{timePlayed:600,points:0,valuation:-2,fieldGoalsMade3:0,fieldGoalsAttempted3:0}},
 {minutes:30,stats:{timePlayed:1800,points:12,fieldGoalsMade3:2,fieldGoalsAttempted3:5}},
 {minutes:20,stats:{timePlayed:1200,points:6,valuation:8,fieldGoalsMade3:1}},
 {minutes:0,stats:{timePlayed:0,points:99,valuation:99,fieldGoalsMade3:9,fieldGoalsAttempted3:9}}
],['timePlayed','points','valuation','steals']);
eq(boxMean.games,3,'only actual appearances');
eq(boxMean.stats.timePlayed,{mean:1200,covered:3},'average minutes from official seconds');
eq(boxMean.stats.points,{mean:6,covered:3},'real zero stays in the average');
eq(boxMean.stats.valuation,{mean:3,covered:2},'negative PIR and missing coverage');
eq(boxMean.stats.steals,{mean:null,covered:0},'all missing remains missing');
eq(boxMean.shooting[3],{made:1,attempted:2.5,covered:2},'same denominator for makes and attempts');
eq(C.negative([{stats:{fieldGoalsAttempted2:3,fieldGoalsMade2:4}}]).miss2.total,null,'reject impossible shooting');
eq(C.negative([{stats:{blocksAgainst:2,blocksFavour:5}}]).blocked.total,2,'shots blocked against player');
function row(id,club){return {player:{person:{code:id,name:id},club:{code:club,name:club}},stats:{startFive:true,timePlayed:2400,points:id==='a1'?2:0,fieldGoalsAttempted2:id==='a1'?1:0,fieldGoalsMade2:id==='a1'?1:0,fieldGoalsAttempted3:0,fieldGoalsMade3:0,freeThrowsAttempted:0,freeThrowsMade:0}};}
const box={local:{players:[1,2,3,4,5].map(i=>row('a'+i,'A'))},road:{players:[1,2,3,4,5].map(i=>row('b'+i,'B'))}};
const points={Rows:[{NUM_ANOT:2,TEAM:'A ',ID_PLAYER:'Pa1 ',ID_ACTION:'2FGM',COORD_X:0,COORD_Y:0,FASTBREAK:'1',SECOND_CHANCE:'1',POINTS_OFF_TURNOVER:'0'}]};
const pbp={Live:false,FirstQuarter:[{NUMBEROFPLAY:1,PLAYTYPE:'BP'},{NUMBEROFPLAY:2,PLAYTYPE:'2FGM',CODETEAM:'A',PLAYER_ID:'Pa1',MARKERTIME:'09:00'}],ForthQuarter:[{NUMBEROFPLAY:3,PLAYTYPE:'EG'}]};
const built=C.buildGame(box,points,pbp);
check(built.a1.shotCoverage&&built.a1.lineupCoverage,'verified shot ledger and lineup');
eq(built.a1.lineups[0].points,2,'personal points');
eq(built.a1.lineups[0].teammates.length,4,'four distinct teammates');
const dup=C.buildGame(box,{Rows:[...points.Rows,...points.Rows]},pbp);check(!dup.a1.shotCoverage,'duplicate shot rejected');
const absent=C.buildGame(box,null,null);check(!absent.a1.shotCoverage&&!absent.a1.lineupCoverage,'missing source not zero');
const bad=JSON.parse(JSON.stringify(pbp));bad.FirstQuarter[1].PLAYER_ID='Pb1';check(!C.buildGame(box,points,bad).a1.lineupCoverage,'wrong on-court scorer rejects team');
const a=C.attacks([{...built.a1,gameCode:1}]);eq(a[0].points,2,'fastbreak scoring');eq(a[1].points,2,'overlap preserved');
const noFlag=JSON.parse(JSON.stringify(built.a1));noFlag.shots[0].fastbreak=null;eq(C.attacks([noFlag])[0].covered,0,'unknown flag not false');
eq(C.lineups([{...built.a1,gameCode:1},{...built.a1,gameCode:2}])[0].points,4,'aggregate lineups across games');
console.log('Advanced player core: all checks passed');
