/* Paired diagnostic with identical frozen context/config and strictly archived form. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const I=require('../player-identity-core.js');
const rows=JSON.parse(fs.readFileSync(0,'utf8')),out=[];
for(const r of rows){
 const cutoff=Date.parse(r.input.asOf);class HistoricalDate extends Date{static now(){return cutoff;}}
 const sandbox={Date:HistoricalDate};vm.createContext(sandbox);
 for(const f of ['player-identities.js','player-identity-core.js','personal-model-core.js','matchup-context-core.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),sandbox,{filename:f});
 const run=a=>{const x=sandbox.PersonalForecast.project(a.player,a.recent,a.history,a.context,a.config);x.match=a.match;return sandbox.MatchupContext.project(x,a.player,a.contextData,cutoff);};
 const a=r.originalInput,b=r.input;
 b.recent=I.recentFromOfficial(b.identityRepairProfile,null,cutoff);
 if(!b.recent||b.recent.gameLog.some(g=>Date.parse(g.date)+4*3600000>=cutoff||String(g.gameCode)===String(r.gameCode)))throw Error('Future repair data');
 const original=run(a),corrected=run(b);
 out.push({name:r.name,gameCode:r.gameCode,asOf:b.asOf,archiveCommit:r.archiveCommit,archivePublishedAt:r.archivePublishedAt,priorGames:b.recent.currentSeasonGames,originalPir:original.expected,correctedPir:corrected.expected,originalMinutes:original.minutes,correctedMinutes:corrected.minutes,actualPir:r.actualPir,actualMinutes:r.actualMinutes});
}
process.stdout.write(JSON.stringify(out));
