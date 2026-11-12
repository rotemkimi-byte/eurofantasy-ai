/* Replay only archived files selected by their publication and fixture cutoffs. */
const fs=require('node:fs');
const U=require('../unified-forecast-core.js');
const W=require('../weighted-forecast-core.js');
const P=require('../personal-model-core.js');
const M=require('../matchup-context-core.js');
const groups=JSON.parse(fs.readFileSync(0,'utf8'));
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
for(const group of groups){
 const cutoff=Date.parse(group.cutoff);
 const official=read(group.official),advanced=group.advanced?read(group.advanced):null;
 const roster=group.roster?read(group.roster).filter(p=>!p.data_updated||Date.parse(p.data_updated)<=cutoff):[];
 const defense=group.defense?read(group.defense).defense:{};
 const data=W.build(official,advanced,{...P,asOf:cutoff});
 for(const row of group.rows){
  const a=row.frozen;
  const x=P.project(a.player,a.recent,a.history,a.context,a.config);
  x.match=a.match;
  const y=M.project(x,a.player,a.contextData,cutoff);
  y.injuryUsagePct=a.context.injuryUsagePct;
  y.positionMatchPct=a.context.positionPct;
  y.positionMatchup=defense?.[P.team(a.match.opponent)]?.[a.player.pos];
  const input=U.capture(a.player,y,data,roster,W);
  delete row.frozen;
  process.stdout.write(JSON.stringify({...row,input})+'\n');
 }
}
