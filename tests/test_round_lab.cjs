const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={window:{},document:{querySelector:()=>null},console};vm.createContext(context);vm.runInContext(fs.readFileSync('round-lab.js','utf8'),context);
const rows=[{id:'a',pos:'G',played:true,price:4,currentPrice:6,pir:20,points:22},{id:'b',pos:'F',played:true,price:6,currentPrice:10,pir:15,points:15},{id:'c',pos:'C',played:true,price:9.9,currentPrice:9.9,pir:30,points:33},{id:'d',pos:'G',played:true,price:10,currentPrice:10,pir:40,points:44},{id:'coach',pos:'H',played:true,price:5,pir:null,points:25},{id:'absent',pos:'G',played:false,price:4,pir:0,points:0}].map(p=>({...p,name:p.id}));
const filter=options=>Array.from(context.window.RoundLabCore.bargainRows({players:rows},options),r=>r.id);
assert.deepEqual(filter(),['c','a','b']);
assert.deepEqual(filter({min:4,max:6}),['a','b']);
assert.deepEqual(filter({min:6,max:9}),['b']);
assert.deepEqual(filter({current:true}),['c','a']);
assert.deepEqual(filter({pos:'C'}),['c']);
assert.deepEqual(filter({minPir:25}),['c']);
assert.deepEqual(filter({sort:'price'}),['a','b','c']);
assert.deepEqual(filter({min:4,max:4}),['a']);
assert(!filter({minPir:-100}).includes('absent'));
console.log('PASS: bargains enforce under 10, inclusive ranges, historical/current prices, PIR, position and no DNP/coaches');


const fixture=context.window.RoundLabCore.nextFixture;
const faye={name:'Mouhamed Faye',opponents:[{name:'Dubai',home:false}]};
assert.equal(fixture(faye,[{name:'Mouhamed Faye',opponent:'Maccabi Tel Aviv',home:0}]).name,'Maccabi Tel Aviv');
assert.equal(fixture(faye,[{name:'Mouhamed Faye',opponent:'Maccabi Tel Aviv',home:0}]).home,false);
assert.equal(fixture(faye,[{name:'Mouhamed Faye',opponent:'Maccabi Tel Aviv',home:1}]).home,true);
assert.equal(fixture(faye,[]),null);
assert.equal(faye.opponents[0].name,'Dubai');
console.log('PASS: next fixture follows live market and preserves historical opponent');
