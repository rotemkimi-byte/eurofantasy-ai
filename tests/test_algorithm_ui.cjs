const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes=new Map(),modes=[],weights=[],sliders=[];
class Element{
 constructor(id='',tag='div'){this.id=id;this.tagName=tag.toUpperCase();this.dataset={};this.attrs={};this._value='';this._html='';this.hidden=false;this.classList={add(){},remove(){}};this.listeners={};}
 set value(v){this._value=String(v)} get value(){return this._value}
 set innerHTML(value){this._html=value;if(this.tagName==='SELECT'){this._value=[...value.matchAll(/<option value="([^"]*)"/g)][0]?.[1]||'';}
  if(this.id==='algorithm'){
   for(const m of value.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(m[2],m[1]);nodes.set(n.id,n)}
   for(const [attr,list] of [['weight',weights],['slider',sliders],['al-mode',modes]])for(const m of value.matchAll(new RegExp('<[^>]+data-'+attr+'="([^"]+)"[^>]*>','g'))){const n=new Element();n.dataset[attr==='al-mode'?'alMode':attr]=m[1];n.value=m[0].match(/value="([^"]*)"/)?.[1]||'';list.push(n)}
  }
 }
 get innerHTML(){return this._html}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,v){this.listeners[k]=v}
 querySelectorAll(q){if(q==='[data-al-mode]')return modes;if(q==='[data-weight],[data-slider]')return [...weights,...sliders];return []}
 querySelector(q){const m=q.match(/\[data-(weight|slider)="([^"]+)"\]/);return m?(m[1]==='weight'?weights:sliders).find(n=>n.dataset[m[1]]===m[2]):null}
 appendChild(n){if(n.id)nodes.set(n.id,n)} insertBefore(){}
}
const nav=new Element(),main=new Element();
const document={createElement:tag=>new Element('',tag),getElementById:id=>nodes.get(id),querySelector:q=>q==='.tabs'?nav:q==='main'?main:null,querySelectorAll:()=>[]};
const games=[1,2,3].map(i=>({gameCode:i,date:`2026-10-${10+i}T18:00:00Z`,team:'Team A',opponent:'Opponent '+i,home:true,minutes:20+i,valuation:10*i,stats:{valuation:10*i}}));
const player={name:'Elijah Bryant',team:'Team A',pos:'G',price:20,status:'available',opponent:'Next Opponent'};
const model=()=>({basePir:20,baseMin:25,expected:22,minutes:26,match:{opponent:'Next Opponent',home:true},context:{profile:{logs:games}},recentForm:{currentSeasonGames:3,season:{pirPerMinute:.8}}});
const snapshot=code=>({season:'E2026',gameCode:code,created_at:`2026-10-${10+code}T10:00:00Z`,predictions:[{...player,expectedPir:18,expectedMinutes:24,home:true,opponent:'Opponent '+code,algorithmInputs:model()}]});
let missing=false;
const context={document,console,Map,Set,Date,Number,String,JSON,Math,AbortSignal,setTimeout,clearTimeout,players:[player,{...player,name:'Teammate',price:10},{...player,name:'Other Team Player',team:'Team B'}],model,localStorage:{getItem(){return null},setItem(){}},fetch:async url=>({ok:!missing,json:async()=>url.includes('snapshots')?snapshot(Number(url.match(/E2026-(\d+)/)[1])):url.includes('official-offense')?{schema:'official-offense-v1',season:'E2026',players:{}}:{data:[]}})};
context.window=context;context.window.scrollTo=()=>{};context.__rollingReady=true;context.__matchupContextData={players:{test:{name:player.name,logs:games}}};
vm.createContext(context);vm.runInContext(fs.readFileSync('algorithm-core.js','utf8'),context);
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};
(async()=>{
 await vm.runInContext(fs.readFileSync('algorithm-lab.js','utf8'),context);await settle();
 const n=id=>nodes.get(id),out=()=>[...nodes].map(([id,n])=>`<div data-test-id="${id}">${n.innerHTML}</div>`).join('');
 assert.equal(n('alGame').value,'3','default is latest historical game');assert(!n('alGame').innerHTML.includes('value="next"'));assert(!n('alPlayer').innerHTML.includes('Other Team Player'),'roster restricted to team');assert(n('alHistoryActual').innerHTML.includes('30.0'));assert(n('alHistoryActual').innerHTML.includes('18.0'));
 
 n('alGame').value='1';await n('alGame').onchange();await settle();assert(!n('alRecent').innerHTML.includes('Opponent 3'),'older view excludes later games');
 modes[1].onclick();await settle();assert.equal(n('alGame').value,'next');assert(n('alGameLabel').hidden);assert(n('alResult').innerHTML.includes('22.0'));assert(n('alRecent').innerHTML.includes('30.0'));
 // Weights remain editable and saving continues to validate the sum.
 weights[0].value='100';weights[0].listeners.input();assert(n('alSave').disabled);n('alNormalize').onclick();assert(!n('alSave').disabled);
 modes[0].onclick();await settle();assert.equal(n('alGame').value,'3');
 n('alTeam').value='Team B';n('alTeam').onchange();await settle();assert.equal(n('alGame').value,'');assert(n('alResult').innerHTML.includes('אין עדיין משחק'));
 console.log('PASS: history default, latest game, team filtering, historical cutoff, forecast toggle, weight editing, no-history state.');
})().catch(e=>{console.error(e);process.exit(1)});
