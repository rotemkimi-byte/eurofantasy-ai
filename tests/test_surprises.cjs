const assert=require('node:assert/strict');
const C=require('../surprises.js');
const base={pos:'G',played:true,price:13,pir:10};
assert.equal(C.players({players:[base]}).length,1);
assert.equal(C.players({players:[{...base,pir:-4}]}).length,1);
for(const patch of [{price:12.9},{pir:10.1},{pir:null},{price:null},{played:false},{pos:'H'}])assert.equal(C.players({players:[{...base,...patch}]}).length,0);
const game=(gameCode,date,home,away,homeScore,awayScore,round=1)=>({gameCode,date,home,away,homeScore,awayScore,round});
const a=game(1,'2026-01-01T10:00:00Z','A','B',80,70);
const b=game(2,'2026-01-02T10:00:00Z','A','B',60,70,2);
let result=C.teams({teamResults:[b,a,a]});assert.equal(result.rows.length,1);assert.equal(result.rows[0].loser,'A');assert.equal(result.rows[0].loserBefore.wins,1);assert.equal(result.rows[0].winnerBefore.wins,0);
assert.equal(C.teams({teamResults:[a]}).rows.length,0);
assert.equal(C.teams({teamResults:[a,{...b,homeScore:null}]}).rows.length,0);
assert.equal(C.teams({teamResults:[a,{...b,date:a.date}]}).rows.length,0);
const fs=require('node:fs');const lab=JSON.parse(fs.readFileSync('data/round-lab.json'));const data=JSON.parse(fs.readFileSync('data/official-offense.json'));
console.log('Passed boundary, DNP, missing data, pre-game ordering, duplicate and simultaneous-game tests.');
console.log('Existing data:',lab.rounds.map(r=>({round:r.round,players:C.players(r).length})), 'team surprises:',C.teams(data).rows.length);
// Reconstruct all 20 current ranks without reading the official rank values.
const reconstructed=C.standings(data.teamResults,data.officialStandings.rows.map(t=>t.team));
for(const row of data.officialStandings.rows)assert.equal(reconstructed.get(row.team).rank,row.rank,row.team);
const regular=(id,home,away,h,a,date='2026-01-01T10:00:00Z')=>({...game(id,date,home,away,h,a),homeStandingsScore:h,awayStandingsScore:a});
let history=[regular(1,'A','C',90,60),regular(2,'B','D',80,70)];
let ranks=C.standings(history,['A','B','C','D']);assert(ranks.get('A').rank<ranks.get('B').rank);
const upset=regular(3,'A','B',70,80,'2026-01-02T10:00:00Z');
assert(C.teams({teamResults:[...history,upset]}).rows.some(g=>g.gameCode===3));
// Today's later results must never change today's baseline.
const later=regular(4,'C','D',200,10,'2026-01-02T18:00:00Z');
assert.deepEqual(C.teams({teamResults:[...history,upset,later]}).rows.find(g=>g.gameCode===3).loserBefore,C.teams({teamResults:[...history,upset]}).rows[0].loserBefore);
// Missing regulation score is unresolved, not silently replaced with an OT score.
ranks=C.standings([{...history[0],homeStandingsScore:null},history[1]],['A','B','C','D']);assert.equal(ranks.get('A').rank,ranks.get('B').rank);
// Equal wins: fewer games outranks a larger point differential.
ranks=C.standings([...history,regular(5,'C','A',80,70)],['A','B','C','D']);assert(ranks.get('B').rank<ranks.get('A').rank);
// Two head-to-head meetings: direct differential takes precedence over overall differential.
ranks=C.standings([regular(1,'A','B',80,60),regular(2,'B','A',80,70),regular(3,'A','C',80,79),regular(4,'B','D',120,60)],['A','B','C','D']);assert(ranks.get('A').rank<ranks.get('B').rank);
// Full ties remain shared; zero games never produce a first-day upset.
ranks=C.standings([],['A','B']);assert.equal(ranks.get('A').rank,ranks.get('B').rank);
console.log('PASS: all official ranks match; equal-win upsets, fewer games, H2H, missing regulation scores and no same-day leakage.');
