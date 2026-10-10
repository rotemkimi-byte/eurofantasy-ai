/* Replays immutable pregame inputs; virtual time keeps context freshness historical. */
const fs=require('fs'),path=require('path'),vm=require('vm');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{
 const rows=JSON.parse(input),root=path.resolve(__dirname,'..'),outputs=[];
 for(const r of rows){
  const cutoff=Date.parse(r.input.asOf);if(!Number.isFinite(cutoff))throw Error('Missing replay cutoff');
  class HistoricalDate extends Date{static now(){return cutoff;}}
  const sandbox={Date:HistoricalDate};vm.createContext(sandbox);
  for(const file of ['personal-model-core.js','matchup-context-core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
  const a=r.input,base=sandbox.PersonalForecast.project(a.player,a.recent,a.history,a.context,a.config);
  const uncertainty=1-Math.min(84,40+base.currentSeasonGames*5)/100;
  base.floor=base.expected*(.6-.25*uncertainty);base.ceiling=base.expected*(1.35+.4*uncertainty);base.match=a.match;
  const x=a.contextData?sandbox.MatchupContext.project(base,a.player,a.contextData):base;
  outputs.push({...r,basePir:x.expected,baseMinutes:x.minutes,baseFloor:x.floor,baseCeiling:x.ceiling});
 }
 process.stdout.write(JSON.stringify(outputs));
});
