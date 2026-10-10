const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
(async()=>{
const root=path.resolve(__dirname,'..'),sandbox={window:{__learningReady:true,__rollingModelId:'test'},Date,console,fetch:async()=>({ok:false}),AbortSignal,document:{getElementById:()=>null},setTimeout,model:()=>({}),renderAll(){}};vm.createContext(sandbox);
for(const file of ['personal-model-core.js','matchup-context-core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);
sandbox.PersonalForecast=sandbox.window.PersonalForecast;sandbox.MatchupContext=sandbox.window.MatchupContext;
await vm.runInContext(fs.readFileSync(path.join(root,'rolling-learning.js'),'utf8'),sandbox);
const p={name:'Test',team:'A',opponent:'B',pos:'C',price:10,status:'active'},ctx={margin:0};
const x=sandbox.PersonalForecast.project(p,null,null,ctx,{});x.match={opponent:'B',margin:0,winProb:.5};
const data={schema:'matchup-context-v1',season:'E2026',updated_at:new Date().toISOString(),players:{},defense:{},teams:{},league:{}};
const y=sandbox.MatchupContext.project(x,p,data);assert(y.replayInput.complete);assert.equal(y.replayInput.player.price,10);
p.price=99;ctx.margin=99;assert.equal(y.replayInput.player.price,10);assert.equal(y.replayInput.context.margin,0);
const replay=JSON.parse(JSON.stringify(y.replayInput));assert(replay.match);assert(replay.contextData);assert(sandbox.window.__rollingReady);
const cp=require('child_process'),run=cp.spawnSync('node',[path.join(root,'scripts/replay-engine.cjs')],{input:JSON.stringify([{input:replay}]),encoding:'utf8'});assert.equal(run.status,0,run.stderr);const restored=JSON.parse(run.stdout)[0];assert.equal(restored.basePir,y.expected);assert.equal(restored.baseMinutes,y.minutes);
console.log('PASS: immutable complete pregame capture and readiness');
})();
