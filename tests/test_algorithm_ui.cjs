const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const A=require('../algorithm-core.js'),storage=new Map();
async function boot(withHistory=false){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){}},addEventListener(event,fn){this[event]=fn;}});return elements.get(id);};
 const inputs=A.definitions.flatMap(d=>['weight','slider'].map(kind=>Object.assign(get(kind+d.id),{dataset:{[kind]:d.id},value:String(d.weight)})));
 const section={classList:{add(){}},querySelectorAll:()=>inputs,querySelector:s=>inputs.find(e=>Object.entries(e.dataset).some(([k,v])=>s===`[data-${k}="${v}"]`))};
 const doc={getElementById:id=>id==='algorithm'?null:get(id),createElement:tag=>tag==='section'?section:{dataset:{},classList:{add(){}}},querySelector:s=>s==='.tabs'?{insertBefore(){},querySelector(){return null;}}:{appendChild(){}},querySelectorAll:()=>[]};
 get('alVenue').value='unknown';get('alGame').value='next';
 const sandbox={window:{AlgorithmLab:A,__rollingReady:true,scrollTo(){}},document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},players:[{name:'Elijah Bryant',team:'A',pos:'G',price:17}],model:()=>({basePir:20,baseMin:30,expected:24}),setTimeout};
 if(withHistory){
 sandbox.AbortSignal=AbortSignal;
 sandbox.window.__matchupContextData={players:{b:{name:'Elijah Bryant',logs:[{gameCode:10,date:'2026-10-10T18:00:00Z',team:'A',opponent:'B',minutes:25,valuation:12},{gameCode:2,date:'2026-10-01T18:00:00Z',team:'A',minutes:20,valuation:10}]}}};
 sandbox.fetch=async()=>({ok:true,json:async()=>({season:'E2026',gameCode:10,created_at:'2026-10-09T18:00:00Z',predictions:[{name:'Elijah Bryant',team:'A',pos:'G',status:'active',opponent:'B',expectedPir:18,features:{basePir:20,baseMin:30}}]})});
 }
 vm.createContext(sandbox);await vm.runInContext(fs.readFileSync('algorithm-lab.js','utf8'),sandbox);return {get,inputs};
}
(async()=>{
 let ui=await boot();ui.get('alVenue').value='home';ui.get('alVenue').onchange();assert(ui.get('alResult').innerHTML.includes('22.0'));
 for(const [key,value] of [['venue','20'],['minutes','20']]){const input=ui.inputs.find(i=>i.dataset.weight===key);input.value=value;input.input();}
 ui.get('alSave').onclick();assert.equal(JSON.parse(storage.get('eurofantasy-algorithm-v1')).weights.venue,20);
 ui=await boot();ui.get('alVenue').value='home';ui.get('alVenue').onchange();assert(ui.get('alResult').innerHTML.includes('24.0'));assert(ui.get('alSaved').textContent.includes('נטענו'));
 ui=await boot(true);ui.get('alGame').value='10';await ui.get('alGame').onchange();assert(ui.get('alHistoryActual').innerHTML.includes('12.0'));assert(ui.get('alHistoryActual').innerHTML.includes('18.0'));assert(ui.get('alHistoryStatus').textContent.includes('פירוק חלקי'));assert(!ui.get('alResult').innerHTML.includes('NaN'));assert(ui.get('alResult').innerHTML.includes('<strong>25</strong>'));assert(!ui.get('alResult').innerHTML.includes('% משקל</span>'));assert(ui.get('alResult').innerHTML.includes('מה הושג במשחק?'));ui.get('alGame').value='next';await ui.get('alGame').onchange();assert.equal(ui.get('alHistoryActual').innerHTML,'');assert(ui.get('alHistoryStatus').textContent.includes('עתידית'));
 console.log('PASS: past/future game selection, actual and saved forecast display; UI weight edits update experimental forecast and survive reload via local storage');
})();
