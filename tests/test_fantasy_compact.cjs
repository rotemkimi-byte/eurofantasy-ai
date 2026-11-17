const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../surprises.js'),F=require('../free-throws.js'),I=require('../player-identity-core.js');
const lab=JSON.parse(fs.readFileSync('data/round-lab.json')),official=JSON.parse(fs.readFileSync('data/official-offense.json'));

for(const round of lab.rounds){
 const rows=S.players(round);assert(rows.every(p=>p.played===true&&p.price>=13&&p.pir<=10));
 const snapshot=JSON.parse(fs.readFileSync(`data/backtest/predictions-round-${String(round.round).padStart(2,'0')}.json`));
 const augmented=S.withForecasts(rows,round,snapshot,I);
 assert.deepEqual(augmented.map(({expectedPir,gap,...p})=>p),rows);
 for(const sort of ['price','pir','miss']){const sorted=S.sortPlayers(augmented,sort);assert.equal(sorted.length,rows.length);const key=sort==='price'?'price':sort==='pir'?'pir':'gap',values=sorted.map(r=>r[key]).filter(x=>x!==null);for(let i=1;i<values.length;i++)assert(sort==='price'?values[i]<=values[i-1]:values[i]>=values[i-1]);}
 assert(S.withForecasts(rows,round,{...snapshot,created_at:round.start},I).every(p=>p.expectedPir===null));
 assert(S.withForecasts(rows,round,{...snapshot,season:'E2025'},I).every(p=>p.expectedPir===null));
}
const row={name:'Wade Baldwin',pir:3};const report={round:1,start:'2026-10-01'};const snapshot={season:'E2026',round:1,created_at:'2026-09-30',predictions:[{name:'BALDWIN IV, WADE',expectedPir:13.25}]};
assert.equal(S.withForecasts([row],report,snapshot,I)[0].gap,-10.25);
assert.equal(S.withForecasts([row],report,{...snapshot,predictions:[...snapshot.predictions,...snapshot.predictions]},I)[0].expectedPir,null);
assert.equal(S.withForecasts([{name:'unknown',pir:3}],report,snapshot,I)[0].expectedPir,null);
assert.deepEqual(F.rank([{id:'B',s:{fta:2}},{id:'Z',s:{fta:null}},{id:'A',s:{fta:2}},{id:'C',s:{fta:12}}],'fta').map(r=>r.id),['C','A','B','Z']);

const T=require('../team-metrics-core.js');let comparisons=0;
for(const t of T.build(official).teams)for(const range of [1,3,0]){const games=F.select(t.games,range);assert.equal(F.summary(games,true).registered,games.length);comparisons++;}
const html=fs.readFileSync('index.html','utf8');let blocks=0;for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){if(/src=|type="application\//.test(m[1]))continue;new vm.Script(m[2]);blocks++;}
console.log(`PASS: ${lab.rounds.length} rounds pass surprise filter boundaries; 3 numeric sorts, ties/nulls, canonical Baldwin join, wrong-season/late/duplicate forecast guards; ${comparisons} team/range summaries; ${blocks} inline scripts parse.`);
