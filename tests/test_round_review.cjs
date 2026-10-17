const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
let marketPrice=17.5,marketRound=6,timer,hidden=false;
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',addEventListener(){}});return elements.get(id)};
const p={name:'Sasha Vezenkov',team:'Olympiacos',pos:'F',price:17.5};
const schedule={data:[{season:{code:'E2026'},round:6,played:true,utcDate:'2026-10-16T16:00:00Z'}]};
const sandbox={window:{PIRHistoryUI:{getData:()=>null}},document:{getElementById:element,createElement:()=>({}),head:{appendChild(){}},addEventListener(){},get hidden(){return hidden}},Date,console,
 lastThreeName:n=>String(n).toLowerCase().split(/\s+/).sort().join(' '),lastThreeRequests:new Map(),renderMarket(){},renderTeam(){},esc:String,players:[p],
 setInterval(fn,ms){timer=fn;assert.equal(ms,60000)},
 fetch:async(url,options)=>{assert.equal(options.cache,'no-store');let data;
 if(url.startsWith('./data/context/'))data=schedule;
 else if(url.startsWith('./data/meta'))data={matchday_number:marketRound};
 else if(url.startsWith('./data/players'))data=[{...p,price:marketPrice}];
 else {assert(url.includes('predictions-round-06.json'));data={season:'E2026',round:6,created_at:'2026-10-15T05:00:00Z',predictions:[{...p,price:17.5}]}}
 return {ok:true,json:async()=>data};}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('round-review.js','utf8'),sandbox);
const ui=sandbox.window.RoundReviewUI;await ui.loadPrices();
assert.equal(ui.delta(p),0);assert(ui.price(p).includes('0.0 cr'));assert(!ui.price(p).includes('ממחזור 5'));
// Publication for round 6 may arrive after the market switches to round 7.
marketPrice=18;marketRound=7;timer();await ui.loadPrices();
assert.equal(p.price,18);assert.equal(ui.delta(p),.5);assert(ui.price(p).includes('+0.5 cr'));
marketPrice=17.2;await ui.loadPrices(true);assert.equal(ui.delta(p),-.3);
assert.equal(ui.delta({name:'Missing',price:10}),null);
assert.equal(ui.priceBaseline({matchday_number:7},6),6);
const source=fs.readFileSync('round-review.js','utf8');assert(source.includes('squadCourt rr-court'));assert(source.includes('rr-bench'));
assert(!source.includes('שינוי המחיר האחרון שפורסם'));
console.log('PASS: current round stays 0.0 before repricing; automatic refresh displays published +0.5/-0.3 without rollover reset; missing data stays unknown; court preserved');
})().catch(error=>{console.error(error);process.exitCode=1});
