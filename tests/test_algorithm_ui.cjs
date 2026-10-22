const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const A=require('../algorithm-core.js'),storage=new Map();
async function boot(){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){}},addEventListener(event,fn){this[event]=fn;}});return elements.get(id);};
 const inputs=A.definitions.flatMap(d=>['weight','slider'].map(kind=>Object.assign(get(kind+d.id),{dataset:{[kind]:d.id},value:String(d.weight)})));
 const section={classList:{add(){}},querySelectorAll:()=>inputs,querySelector:s=>inputs.find(e=>Object.entries(e.dataset).some(([k,v])=>s===`[data-${k}="${v}"]`))};
 const doc={getElementById:id=>id==='algorithm'?null:get(id),createElement:tag=>tag==='section'?section:{dataset:{},classList:{add(){}}},querySelector:s=>s==='.tabs'?{insertBefore(){},querySelector(){return null;}}:{appendChild(){}},querySelectorAll:()=>[]};
 get('alVenue').value='unknown';
 const sandbox={window:{AlgorithmLab:A,__rollingReady:true,scrollTo(){}},document:doc,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},players:[{name:'Elijah Bryant',team:'A',pos:'G',price:17}],model:()=>({basePir:20,baseMin:30,expected:24}),setTimeout};
 vm.createContext(sandbox);await vm.runInContext(fs.readFileSync('algorithm-lab.js','utf8'),sandbox);return {get,inputs};
}
(async()=>{
 let ui=await boot();ui.get('alVenue').value='home';ui.get('alVenue').onchange();assert(ui.get('alResult').innerHTML.includes('22.0'));
 for(const [key,value] of [['venue','20'],['minutes','20']]){const input=ui.inputs.find(i=>i.dataset.weight===key);input.value=value;input.input();}
 ui.get('alSave').onclick();assert.equal(JSON.parse(storage.get('eurofantasy-algorithm-v1')).weights.venue,20);
 ui=await boot();ui.get('alVenue').value='home';ui.get('alVenue').onchange();assert(ui.get('alResult').innerHTML.includes('24.0'));assert(ui.get('alSaved').textContent.includes('נטענו'));
 console.log('PASS: UI weight edits update experimental forecast and survive reload via local storage');
})();
