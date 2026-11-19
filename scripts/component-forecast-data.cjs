'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const DNA=require('../dna-player-core.js');
const TeamDNA=require('../dna-core.js');
const Teams=require('../team-metrics-core.js');
const People=require('../player-identity-core.js');
const Personal=require('../personal-model-core.js');
const {dna}=require('./component-feature-catalog.cjs');
const {finite,sum,mean,baseForecast,observed,ledger}=require('../component-forecast-core.cjs');

const season='E2026', hour=3600000;
const root=path.resolve(__dirname,'..');
const load=file=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8')):null;
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
const schedule=Object.values(load('data/learning/schedule.json')).filter(g=>finite(Date.parse(g.start))).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
const sourceFiles=['data/advanced-players.json','data/player-dna-events.json','data/team-dna-events.json'];
const archive=new Map();
const revisions=file=>git('log','--first-parent','--format=%H %cI','--',file).trim().split('\n').filter(Boolean)
 .map(line=>line.split(' ')).map(([sha,time])=>({sha,at:Date.parse(time)})).sort((a,b)=>b.at-a.at);
const histories=new Map(sourceFiles.map(file=>[file,revisions(file)]));
function eventsAt(file,cutoff){
 for(const {sha,at} of histories.get(file)){
  if(at>cutoff)continue;
  const key=sha+':'+file;
  if(!archive.has(key)){
   if(archive.size>=24)archive.delete(archive.keys().next().value);
   archive.set(key,JSON.parse(git('show',key)));
  }
  const d=archive.get(key),stamp=d.updated_at?Date.parse(d.updated_at):at;
  if(d.season===season&&stamp<=cutoff)return {...d,updated_at:new Date(Math.max(at,stamp)).toISOString()};
 }
 return null;
}

const boxFolder='data/backtest/cache/';
const boxPattern=boxFolder+season+'-*-stats.json';
const publications=new Map(),changed=new Set();
let revision;
for(const line of git('log','--first-parent','--diff-filter=AM','--format=@ %H %cI','--name-only','--',boxPattern).split('\n')){
 if(line.startsWith('@ ')){
  const [,sha,time]=line.split(' ');
  revision={sha,at:Date.parse(time)};
 }else if(line.startsWith(boxFolder)){
  if(publications.has(line))changed.add(line);
  publications.set(line,revision);
 }
}

const field=s=>['fieldGoalsAttempted2','fieldGoalsAttempted3','freeThrowsAttempted','turnovers']
 .every(k=>finite(s?.[k]))?s.fieldGoalsAttempted2+s.fieldGoalsAttempted3+.44*s.freeThrowsAttempted+s.turnovers:null;
const idOf=value=>String(value??'').replace(/^P/i,'');
const boxTeam=side=>Personal.team(side?.club?.abbreviatedName||side?.players?.[0]?.player?.club?.abbreviatedName);
function gameBox(g){
 const file=boxFolder+season+'-'+g.gameCode+'-stats.json',version=publications.get(file);
 if(!g.played||!version)return null;
 const current=load(file);
 const box=changed.has(file)?JSON.parse(git('show',version.sha+':'+file)):current;
 if(!box||boxTeam(box.local)!==g.home||boxTeam(box.road)!==g.away)return null;
 const teamGames={},players=[];
 for(const home of [true,false]){
  const side=box[home?'local':'road'],team=home?g.home:g.away,opponent=home?g.away:g.home;
  const stats=side.total;
  const gameMinutes=finite(stats?.timePlayed)?stats.timePlayed/60:null;
  teamGames[home?'local':'road']={team,stats,gameMinutes};
  for(const {player,stats:line} of side.players||[]){
   const id=idOf(player?.person?.code);
   if(player?.season?.code!==season||!id||!finite(line?.timePlayed)||line.timePlayed<0)continue;
   const minutes=line.timePlayed/60,events=field(line),teamEvents=field(stats);
   players.push({id,name:player.person.name,position:player.positionName,
    row:{gameCode:g.gameCode,date:g.start,round:g.round,team,opponent,home,minutes,positionName:player.positionName,
     stats:line,metrics:{usageEvents:events,usageExposure:gameMinutes>0&&finite(teamEvents)?minutes*teamEvents/gameMinutes:null}}});
  }
 }
 const {local,road}=teamGames;
 if(!finite(local.stats?.points)||!finite(road.stats?.points)||local.stats.points===road.stats.points)return null;
 const record={gameCode:g.gameCode,date:g.start,round:g.round,home:g.home,away:g.away,homeScore:local.stats.points,awayScore:road.stats.points};
 const result=new Map();
 for(const p of players){
  const value=observed(p.row);
  const line=ledger(value);
  if(p.row.minutes>0&&finite(p.row.stats.valuation)){
   result.set(p.row.team+'|'+p.id,{...p,actual:p.row.stats.valuation,
    target:line&&Math.abs(line.pir-p.row.stats.valuation)<1e-6?value:null});
  }
 }
 return {available:Math.max(version.at,Date.parse(g.start)+4*hour),teamGames,players,record,result};
}
const boxes=new Map(schedule.map(g=>[g.gameCode,gameBox(g)]).filter(([,b])=>b));

function historicalContext(cutoff){
 const official={season,updated_at:new Date(cutoff).toISOString(),teamResults:[],teamGames:{},players:{}};
 for(const [code,box] of boxes){
  if(box.available>cutoff)continue;
  official.teamResults.push(box.record);
  official.teamGames[code]=box.teamGames;
  for(const {id,name,row} of box.players){
   official.players[id]??={name,playerCode:id,games:[]};
   official.players[id].games.push(row);
  }
 }
 const [advanced,playerEvents,teamEvents]=sourceFiles.map(file=>eventsAt(file,cutoff));
 const currentEvents=advanced&&{...advanced,games:Object.fromEntries(Object.entries(advanced.games).filter(([code])=>official.teamGames[code]))};
 const context=DNA.seasonContext(official,currentEvents,cutoff,{pregame:true,dnaEvents:playerEvents});
 const teamModel=TeamDNA.build(official,currentEvents,Teams,cutoff,teamEvents);
 return {context,teamModel,rivals:DNA.buildRivals(context),playerReports:new Map()};
}

function verifiedRoster(rows,game){
 const result=new Map();
 for(const p of rows||[]){
  const person=People.resolve(p.fantasy_id!=null?p:p.name);
  const id=idOf(person?.euroleagueId),team=Personal.team(p.team),opponent=Personal.team(p.opponent);
  const expected=team===game.home?game.away:team===game.away?game.home:null;
  if(!id||!expected||opponent!==expected)continue;
  const key=team+'|'+id;
  if(result.has(key))continue;
  result.set(key,{...p,id,name:person.displayName||p.name,team,opponent,home:team===game.home});
 }
 return result;
}

function snapshot(game){
 const kickoff=Date.parse(game.start);
 const paths=['data/learning/snapshots/'+season+'-'+game.gameCode+'.json','data/backtest/predictions-round-'+String(game.round).padStart(2,'0')+'.json'];
 for(const file of paths){
  const saved=load(file),at=Date.parse(saved?.created_at);
  if(saved?.season!==season||!(at<kickoff)||!(saved.gameCode===game.gameCode||saved.round===game.round))continue;
  if(saved.kickoff&&Date.parse(saved.kickoff)!==kickoff)continue;
  const people=verifiedRoster(saved.predictions,game);
  if(people.size)return {at,people,version:saved.algorithmSchema?'site-'+saved.algorithmSchema:saved.gameCode?'site-legacy':'round-legacy',file};
 }
 return null;
}

const position={G:'Guard',F:'Forward',C:'Center'};
function scout(record,game,history,roster){
 const {context,teamModel,rivals,playerReports}=history;
 const p=context.players.get(record.id),team=record.team,opponent=record.opponent;
 const played=p?.games.filter(g=>g.minutes>0&&g.team===team)||[];
 // A verified same-season team sample is required. Current box participation
 // is never used to decide whom to forecast.
 if(played.length<2||sum(played.map(g=>g.minutes))<20)return {base:null,features:{},samples:played.length};
 const base=baseForecast(played);
 const playerKey=record.id+'|'+team;
 if(!playerReports.has(playerKey))playerReports.set(playerKey,DNA.summarize({...p,team,position:position[record.pos]},context));
 const original=playerReports.get(playerKey);
 const report=DNA.opponentReport({...original,stats:{...original.stats}},context,rivals,opponent,team,teamModel);
 const features={},details={};
 for(const spec of dna){
  const metric=report.stats[spec.id];
  if(!spec.excluded&&finite(metric?.value)){
   features[spec.id]=metric.value;
   details[spec.id]={games:metric.count,unit:spec.unit};
  }
 }
 const eligible=(opp,pos)=>context.positional.get(opp+'|'+pos)||[];
 const pos=report.position||position[record.pos];
 const defense=eligible(opponent,pos);
 const set=(key,value)=>{if(finite(value))features['context.'+key]=value;};
 const ratio=(rows,num,den)=>{
  const pairs=rows.map(g=>[num(g),den(g)]).filter(([a,b])=>finite(a)&&finite(b)&&b>=0);
  const n=sum(pairs.map(([,b])=>b));
  return n>0?sum(pairs.map(([a])=>a))/n:null;
 };
 const stat=key=>g=>g.stats?.[key];
 const duration=g=>g.minutes;
 const exposure=defense.length>=10;
 if(exposure){
  set('opportunity2',ratio(defense,stat('fieldGoalsAttempted2'),duration));
  set('opportunity3',ratio(defense,stat('fieldGoalsAttempted3'),duration));
  set('opponent2',ratio(defense,stat('fieldGoalsMade2'),stat('fieldGoalsAttempted2')));
  set('opponent3',ratio(defense,stat('fieldGoalsMade3'),stat('fieldGoalsAttempted3')));
  for(const [key,field] of [['drawnAllowed','foulsReceived'],['forcedTurnovers','turnovers'],['offBoardsAllowed','offensiveRebounds'],
   ['defBoardsAllowed','defensiveRebounds'],['blockedAllowed','blocksAgainst']])set(key,ratio(defense,stat(field),duration));
 }
 if(game.neutral!==true)set('home',Number(record.home));
 set('pace',features.pace);
 const rival=rivals.get(opponent),weights=report.bins.slice(0,3).map(b=>b.attempts);
 const used=weights.map((n,i)=>n>=5?i:null).filter(i=>i!==null);
 if(report.shotGames>=2&&rival?.covered.length>=2&&used.length&&used.every(i=>rival.bins[i].attempts>=12)){
  const total=sum(used.map(i=>weights[i]));
  set('zone2',sum(used.map(i=>weights[i]*rival.bins[i].made/rival.bins[i].attempts))/total);
  set('zoneVolume2',sum(used.map(i=>weights[i]*rival.bins[i].attempts/rival.covered.length))/total);
 }
 const h2h=played.filter(g=>g.opponent===opponent);
 if(h2h.length>=2)set('headToHead',ratio(h2h,g=>g.stats.fieldGoalsMade2+g.stats.fieldGoalsMade3,g=>g.stats.fieldGoalsAttempted2+g.stats.fieldGoalsAttempted3));
 const currentRival=teamModel.teams.find(t=>t.team===opponent);
 const styleStats=(t,before)=>TeamDNA.summarize(t?.games.filter(g=>Date.parse(g.date)+4*hour<=before)||[],
  TeamDNA.defense.filter(([id])=>['allowedTwo','allowedThree'].includes(id)));
 if(currentRival?.games.length>=3){
  for(const [index,key] of [[2,'similarTwo'],[3,'similarThree']]){
   const metric=index===2?'allowedTwo':'allowedThree';
   const reference=styleStats(currentRival,context.through)[metric]?.value;
   const comparable=played.filter(g=>{
    const earlier=styleStats(teamModel.teams.find(t=>t.team===g.opponent),Date.parse(g.date))[metric];
    return g.opponent!==opponent&&earlier?.count>=3&&finite(reference)&&Math.abs(earlier.value-reference)<=4;
   });
   if(comparable.length>=3)set(key,ratio(comparable,stat('fieldGoalsMade'+index),stat('fieldGoalsAttempted'+index)));
  }
 }
 if(roster?.has(team+'|'+record.id)){
  const status=record.status;
  if(['active','injured','out','questionable','doubtful'].includes(status))set('available',Number(status==='active'));
  const teammates=[...roster.values()].filter(t=>t.team===team&&t.id!==record.id&&t.status);
  const expected=teammates.map(t=>({t,games:context.players.get(t.id)?.games.filter(g=>g.team===team&&g.minutes>0).slice(0,5)||[]}))
   .filter(({games})=>games.length>=2).map(({t,games})=>({t,minutes:mean(games.map(g=>g.minutes))})).sort((a,b)=>b.minutes-a.minutes);
  const known=expected.filter(({t})=>['active','out','injured','questionable','doubtful'].includes(t.status));
  const out=t=>['out','injured'].includes(t.status);
  if(known.length>=5)set('absenceMinutes',sum(known.filter(({t})=>out(t)).map(({minutes})=>minutes)));
  if(known[0]?.minutes>=18)set('mainTeammateOut',Number(out(known[0].t)));
 }
 return {base,features,details,samples:played.length};
}

function historicalRows(){
 const rows=[],audit=[];
 for(const game of schedule.filter(g=>g.played)){
  const saved=snapshot(game),kickoff=Date.parse(game.start);
  const cutoff=saved?.at??kickoff-60000;
  const historical=historicalContext(cutoff),box=boxes.get(game.gameCode);
  const candidates=new Map(saved?.people);
  // If the lineup capture is absent, the most recent official roster is the
  // forecast universe. This keeps DNPs and late roster changes visible.
  for(const team of [game.home,game.away]){
   if([...candidates.values()].filter(p=>p.team===team).length>=5)continue;
   const previous=historical.context.opponents.get(team)?.[0];
   if(!previous)continue;
   for(const p of historical.context.players.values()){
    if(!p.games.some(g=>g.gameCode===previous.gameCode&&g.team===team))continue;
    const key=team+'|'+p.id;
    if(!candidates.has(key))candidates.set(key,{id:p.id,name:People.resolve({euroleagueId:p.id})?.displayName||p.name,
     team,opponent:team===game.home?game.away:game.home,home:team===game.home});
   }
  }
  for(const [key,p] of candidates){
   const actual=box?.result.get(key);
   const built=scout(p,game,historical,saved?.people);
   const frozen=saved?.people.get(key);
   rows.push({...built,id:p.id,name:p.name,team:p.team,opponent:p.opponent,gameCode:game.gameCode,round:game.round,cutoff,kickoff,
    available:box?.available,actual:actual?.actual,target:actual?.target,A:frozen?.expectedPir,baseline:saved?.version,
    status:p.status||null});
  }
  for(const [key,p] of box?.result||[]){
   if(candidates.has(key))continue;
   const {id,name,row,actual}=p;
   rows.push({id,name:People.resolve({euroleagueId:id})?.displayName||name,team:row.team,opponent:row.opponent,
    gameCode:game.gameCode,round:game.round,cutoff,kickoff,actual,features:{},samples:0});
  }
  audit.push({gameCode:game.gameCode,round:game.round,cutoff,kickoff,archive:saved?.file||null,
   baseline:saved?.version||null,publishedBox:box?.available||null,observed:box?.result.size||0,candidates:candidates.size});
 }
 return {rows,audit};
}

function upcoming(now){
 const roster=load('data/players.json')||[];
 const context=historicalContext(now);
 return schedule.filter(g=>!g.played&&Date.parse(g.start)>now&&Date.parse(g.start)<=now+14*24*hour).flatMap(game=>{
  const known=roster.filter(p=>Date.parse(p.data_updated)<=now);
  const people=verifiedRoster(known,game);
  return [...people.values()].map(p=>({...scout(p,game,context,people),id:p.id,fantasyId:p.fantasy_id,name:p.name,team:p.team,
   opponent:p.opponent,kickoff:Date.parse(game.start),cutoff:now,gameCode:game.gameCode,round:game.round,price:p.price,status:p.status}));
 });
}

module.exports={load,schedule,historicalRows,upcoming,root,season};
