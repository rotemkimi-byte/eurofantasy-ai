const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',addEventListener(){}});return elements.get(id)};
const sandbox={window:{},document:{getElementById:element},console,Date,Map,Number,Promise,
 lastThreeName:n=>String(n).toLowerCase().replace(/,/g,'').split(/\s+/).sort().join(' '),
 lastThreeRequests:new Map(),lastThreeFetch:async()=>({data:[]}),renderMarket(){},renderTeam(){},esc:String};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('round-review.js','utf8'),sandbox);
const ui=sandbox.window.RoundReviewUI;
const game=(round,played,date,season='E2026')=>({round,played,utcDate:date,season:{code:season}});
assert.equal(ui.selectRound({data:[game(6,true,'2026-10-16'),game(7,false,'2026-10-20'),game(8,true,'2026-11-01'),game(9,true,'2025-01-01','E2025')]},Date.parse('2026-10-17')),6);
const p={name:'Test Player',price:10.2};const prices=new Map([['player test',10]]);
assert.equal(ui.delta(p,prices),.2);assert.equal(ui.delta({...p,price:9.7},prices),-.3);
assert.equal(ui.delta({...p,price:10},prices),0);assert.equal(ui.delta({...p,price:null},prices),null);assert.equal(ui.delta({name:'Unknown',price:10},prices),null);
assert.equal(ui.roundGames({games:[{round:5,value:30}]},6).length,0);
assert.equal(ui.totals([]).pir,null);
const t=ui.totals([{value:20,score:90,against:80},{value:10,score:70,against:80}]);assert.equal(t.pir,30);assert.equal(t.points,32);
assert.equal(ui.totals([{value:null,dnp:true}]).pir,0);
assert.equal(ui.totals([{value:null,dnp:false}]).pir,null);
assert.equal(ui.totals([{value:-10,score:70,against:90}],true).points,-10);
const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('window.PIRHistoryUI=')<html.indexOf('src="./round-review.js'));
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
console.log('PASS: round selection, missing values, signed prices, no previous-round substitution, DNP, win bonus, coach scoring, script order and inline syntax');
