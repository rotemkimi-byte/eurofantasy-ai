const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',addEventListener(){}});return elements.get(id)};
const sandbox={window:{},document:{getElementById:element,createElement:()=>({}),head:{appendChild(){}}},console,Date,Map,Number,Promise,
 lastThreeName:n=>String(n).toLowerCase().replace(/,/g,'').split(/\s+/).sort().join(' '),
 lastThreeRequests:new Map(),lastThreeFetch:async path=>path==='./data/meta.json'?{matchday_number:6}:JSON.parse(fs.readFileSync(path.replace('./',''),'utf8')),renderMarket(){},renderTeam(){},esc:String};
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

assert.equal(ui.priceBaseline({matchday_number:6}),5);
assert.equal(ui.priceBaseline({matchday_number:7}),6);
assert.equal(ui.priceBaseline({matchday_number:1}),null);
assert.equal(ui.priceBaseline({}),null);
await ui.loadPrices();
const actual={name:'Sasha Vezenkov',price:17.5};
const previous=JSON.parse(fs.readFileSync('data/backtest/predictions-round-05.json')).predictions.find(p=>p.name===actual.name);
assert.equal(previous.price,17.6);assert.equal(actual.price,17.5);
assert.equal(ui.delta(actual),-.1);assert(ui.price(actual).includes('-0.1 cr'));
assert(ui.price(actual).includes('ממחזור 5 למחזור 6'));
// A missing round result remains unknown; it must not become an older score.
const samplePlayers=Array.from({length:8},(_,i)=>({name:'Player '+i,team:'A',pos:'G',price:10}));
Object.assign(sandbox,{myTeam:samplePlayers.map(p=>p.name),players:samplePlayers,COACHES:[],squadPreferences:{},canonicalTeam:n=>n,SQUAD_SLOTS:Array.from({length:6},()=>['G','מקום פנוי']),squadArrangement:ps=>({slots:ps.slice(0,6),bench:ps.slice(6)}),squadJersey:()=>'<svg class="squadJersey"></svg>'});
const histories=new Map(samplePlayers.map(p=>[sandbox.lastThreeName(p.name),{games:[{round:6,value:20,score:90,against:80,opponent:'B',home:true}]}]));
ui.renderReviewBody({players:histories,coaches:new Map()});
const rendered=element('roundReview').innerHTML;
assert(rendered.includes('squadCourt rr-court'));assert(rendered.includes('rr-bench'));assert(rendered.includes('שחקן שישי'));
assert.equal((rendered.match(/<article class="rr-card">/g)||[]).length,8);
assert.equal((rendered.match(/class="squadJersey"/g)||[]).length,8);
assert(!rendered.includes('undefined'));assert(rendered.includes('המחירים עבור תוצאות מחזור זה טרם פורסמו'));
console.log('PASS: real Vezenkov price change -0.1, market-round baseline, court, eight unique jerseys, bench, sixth player and repricing status');
})().catch(error=>{console.error(error);process.exitCode=1});
