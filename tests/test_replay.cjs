const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),core=require(path.join(root,'personal-model-core.js'));
const input={asOf:'2026-09-01T12:00:00Z',player:{name:'Test',team:'A',opponent:'B',pos:'C',price:10,status:'active'},recent:null,history:null,context:{margin:0},config:{},match:{opponent:'B',margin:0},contextData:null};
const rows=[{input,actualPir:10},{input,actualPir:100}];
const run=cp.spawnSync('node',[path.join(root,'scripts/replay-engine.cjs')],{input:JSON.stringify(rows),encoding:'utf8'});assert.equal(run.status,0,run.stderr);
const out=JSON.parse(run.stdout),direct=core.project(input.player,null,null,input.context,input.config);
assert.equal(out[0].basePir,direct.expected);assert.equal(out[0].baseMinutes,direct.minutes);assert.equal(out[0].basePir,out[1].basePir);
console.log('PASS: shared core replay, frozen inputs and independence from target outcome');
