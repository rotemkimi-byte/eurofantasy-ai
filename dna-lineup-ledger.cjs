'use strict';
// Compact event counters. Keep the published column names with the data.
const fields=['points','fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3',
 'freeThrowsAttempted','freeThrowsMade','turnovers','offensiveRebounds','defensiveRebounds',
 'assistances','steals','blocksFavour','blocksAgainst','foulsCommited','foulsReceived'];
const events={
 '2FGA':[1],'2FGM':[1,2],'3FGA':[3],'3FGM':[3,4],FTA:[5],FTM:[5,6],
 TO:[7],O:[8],D:[9],AS:[10],ST:[11],FV:[12],AG:[13],CM:[14],OF:[14],
 CMT1:[14],CMT2:[14],CMU_FL:[14],CMU_DI:[14],RV:[15],C:[14],B:[14]
};
const blank=()=>fields.map(()=>0);

function capture(box,pbp,teams,people){
 const sides=Object.keys(teams);
 if(sides.length!==2||sides.some((code,i)=>code!==String(pbp[i?'CodeTeamB':'CodeTeamA']||'').trim()))return null;
 const totals=sides.map(blank),individual=Object.fromEntries(Object.keys(people).map(id=>[id,blank()]));
 const groups=sides.map(()=>new Map());
 const uncertain=new Set();
 function group(side){
  const five=[...teams[sides[side]].active].sort();
  const key=five.join('|');
  if(!groups[side].has(key))groups[side].set(key,{five,own:blank(),rival:blank(),players:five.map(blank)});
  return groups[side].get(key);
 }
 return {
  track(e,code,id){
   const columns=events[e.type];
   if(!columns)return;
   const side=sides.indexOf(code),p=people[id];
   const points=({FTM:1,'2FGM':2,'3FGM':3})[e.type];
   const teamOnly=['C','B'].includes(e.type);
   if(side<0||!Number.isInteger(e.seq)||e.at===null||Object.values(teams).some(t=>t.active.size!==5||e.at<t.last)||
    (id&&!teamOnly&&(!p||p.teamCode!==code||!teams[code].active.has(id)))||
    (!id&&!['TO','O','D','C','B'].includes(e.type))){
    columns.forEach(i=>uncertain.add(i));
    if(points)uncertain.add(0);
    return;
   }
   const own=group(side),rival=group(1-side),person=id&&!teamOnly?own.players[own.five.indexOf(id)]:null;
   const add=(column,amount)=>{
    own.own[column]+=amount;rival.rival[column]+=amount;totals[side][column]+=amount;
    if(person){person[column]+=amount;individual[id][column]+=amount;}
   };
   columns.forEach(column=>add(column,1));
   if(points)add(0,points);
  },
  finish(end){
   const reconciled=fields.map((field,i)=>!uncertain.has(i)&&sides.every((code,side)=>
    box[teams[code].side].total?.[field]===totals[side][i])&&
    Object.values(people).every(p=>p.stats[field]===individual[p.id][i]));
   const output=[];
   for(const [side,code] of sides.entries()){
    const team=teams[code],duration=box[team.side].total?.timePlayed;
    if(!team.valid||!team.timing||duration!==end)return null;
    const roster=Object.values(people).filter(p=>p.teamCode===code);
    if(!roster.every(p=>Number.isFinite(p.stats.timePlayed)&&Math.abs((team.seconds[p.id]||0)-p.stats.timePlayed)<=3))return null;
    const rows=[];
    for(const key of new Set([...Object.keys(team.groups),...groups[side].keys()])){
     const line=team.groups[key],ledger=groups[side].get(key);
     if(!ledger&&!line.seconds)continue;
     const five=line?.players||ledger.five;
     rows.push([five,line?.seconds||0,ledger?.own||blank(),ledger?.rival||blank(),ledger?.players||five.map(blank)]);
    }
    // A second, independent check catches scoring allocated on the wrong side of a substitution.
    if(!reconciled[0]||!roster.every(p=>p.stats.plusMinus===rows.reduce((n,[five,,own,rival])=>n+(five.includes(p.id)?own[0]-rival[0]:0),0)))return null;
    output.push(rows);
   }
   const columns=fields.flatMap((_,i)=>reconciled[i]?[i]:[]);
   const pack=row=>columns.map(i=>row[i]);
   return {columns,sides:output.map(rows=>rows.map(([five,seconds,own,rival,players])=>
    [five,seconds,pack(own),pack(rival),players.map(pack)]))};
  }
 };
}
module.exports={fields,capture};
