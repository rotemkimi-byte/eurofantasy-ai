const assert=require('node:assert/strict');
const {summarize,roundSeries}=require('../pir-compare.js');
const games=[{code:1,date:'2026-10-01',value:30},{code:2,date:'2026-10-02',value:-6},{code:3,date:'2026-10-03',value:0},{code:4,date:'2026-10-04',value:null,dnp:true}];
assert.equal(summarize(games,1).average,null);
assert.equal(summarize(games,3).average,-3);
assert.equal(summarize(games,0).average,8);
assert.equal(summarize([...games,games[0]],0).count,3);
assert.equal(summarize([],3).average,null);
assert.equal(summarize([{code:1,date:'2026-10-01',value:null}],1).count,0);
const picks=[
 {p:{games:[{code:3,round:1,value:30},{code:2,round:3,value:-6},{code:8,round:4,value:null,dnp:true}]}},
 {p:{games:[{code:10,round:2,value:0},{code:15,round:3,value:22},{code:18,round:4,value:27,dnp:true},{code:20,round:null,value:18}]}}
];
const {series,rounds}=roundSeries(picks,0);
assert.deepEqual(rounds,[1,2,3,4]);
assert.equal(series[0].values.get(3),-6);
assert.equal(series[0].values.has(2),false);
assert.equal(series[1].values.get(2),0);
assert.equal(series[1].values.get(3),22);
assert.equal(series[1].values.has(4),false);
assert.deepEqual(roundSeries(picks,3).rounds,[2,3,4]);
assert.deepEqual(roundSeries(picks,1).rounds,[4]);
assert.deepEqual(roundSeries([{p:{games:[]}}],0).rounds,[]);
console.log('PIR compare calculations and round alignment passed');
