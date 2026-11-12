/* Shadow player model. Live serving and historical replay freeze the same inputs. */
(function(root){
'use strict';
const version='unified-pir-v1';
const finite=Number.isFinite;
const clip=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const fields=['fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3',
 'freeThrowsAttempted','freeThrowsMade','offensiveRebounds','defensiveRebounds','assistances',
 'steals','blocksFavour','foulsReceived','turnovers','foulsCommited','blocksAgainst'];
function components(s){
 if(!fields.every(k=>finite(s?.[k])&&s[k]>=0))return null;
 const {fieldGoalsAttempted2:a2,fieldGoalsMade2:m2,fieldGoalsAttempted3:a3,fieldGoalsMade3:m3,
  freeThrowsAttempted:ft,freeThrowsMade:mf}=s;
 if(m2>a2||m3>a3||mf>ft)return null;
 // A blocked attempt is a field-goal miss and has the separate blocks-against deduction.
 return {fieldScoring:2*m2+3*m3,fieldMisses:m2+m3-a2-a3,freeThrows:2*mf-ft,
  offensiveRebounds:s.offensiveRebounds,defensiveRebounds:s.defensiveRebounds,
  assists:s.assistances,steals:s.steals,blocks:s.blocksFavour,foulsDrawn:s.foulsReceived,
  turnovers:-s.turnovers,fouls:-s.foulsCommited,shotsBlocked:-s.blocksAgainst};
}
function statProfile(rows){
 const totals=Object.fromEntries(fields.map(k=>[k,0]));
 let minutes=0,games=0;
 for(const row of rows){
  const stats={...row.stats,blocksAgainst:row.officialBlocksAgainst??row.stats.blocksAgainst};
  if(!components(stats)||!(row.minutes>0))continue;
  for(const k of fields)totals[k]+=stats[k];
  minutes+=row.minutes;games++;
 }
 if(!minutes)return null;
 const rates=Object.fromEntries(fields.map(k=>[k,totals[k]/minutes]));
 const ledger=components(totals);
 return {games,minutes,rates,pirRate:Object.values(ledger).reduce((a,b)=>a+b,0)/minutes,
  componentRates:Object.fromEntries(Object.entries(ledger).map(([k,v])=>[k,v/minutes]))};
}
const minuteTools=['teamMarket','absence'];
function capture(p,x,data,roster,weighted){
 if(!finite(x.minutes)||!finite(x.expected))return null;
 const rows=data.profiles.get(data.key(p.name))||[];
 const club=data.team(p.team);
 const same=rows.filter(g=>g.team===club);
 const season=statProfile(same),recent=statProfile(same.slice(-3));
 const prior=x.baseMin>0&&finite(x.basePir)?x.basePir/x.baseMin:x.minutes>0?x.expected/x.minutes:0;
 const observed=season&&season.games>5&&recent?.games===3?.7*season.pirRate+.3*recent.pirRate:season?.pirRate;
 const sample=season?.games||0;
 const blend=season&&recent?.games===3&&season.games>5?.3:0;
 const componentRates=season&&Object.fromEntries(Object.entries(season.componentRates)
  .map(([id,value])=>[id,(1-blend)*value+blend*(recent?.componentRates[id]??value)]));
 const statRates=season&&Object.fromEntries(Object.entries(season.rates)
  .map(([id,value])=>[id,(1-blend)*value+blend*(recent?.rates[id]??value)]));
 // Fallback uses the upstream neutral rate when the complete box score is missing.
 const efficiency=finite(observed)?(observed*sample+prior*4)/(sample+4):x.recentRate??prior;
 const signals=weighted.signals(p,x,data,roster,{unified:true});
 const tools=Object.fromEntries(weighted.definitions.map(({id},i)=>[id,signals[i]]));
 // The upstream minutes already include injury opportunity and availability.
 // Only the separate usage estimate enters the per-minute regression.
 tools.injuries=finite(x.injuryUsagePct)?x.injuryUsagePct/6:null;
 return {version,minutes:clip(x.minutes,0,36),efficiency,tools,profile:season?{games:sample,minutes:season.minutes,statRates,componentRates}:null,
  usage:season&&finite(tools.usage)?tools.usage:null,home:x.match?.home??p.home??null,
  status:p.status,pos:p.pos,
  lowerSpread:finite(x.floor)?Math.max(0,x.expected-x.floor):null,
  upperSpread:finite(x.ceiling)?Math.max(0,x.ceiling-x.expected):null};
}
function features(input,stage,omit){
 const excluded=new Set([omit].flat());
 const available=Object.entries(input.tools).filter(([id,v])=>!excluded.has(id)&&finite(v)&&minuteTools.includes(id)===(stage==='minutes'));
 const columns=Object.fromEntries(available);
 if(input.pos)columns['position:'+input.pos]=1;
 if(stage==='rate'&&input.home!==null)columns.venue=input.home?1:-1;
 return columns;
}
const dot=(columns,coeff)=>Object.entries(columns).reduce((total,[id,v])=>total+v*(coeff[id]||0),0);
function project(input,config={},omit=null){
 if(input.status==='out'||input.minutes===0)return {expected:0,minutes:0,floor:0,ceiling:0,rate:0};
 const minutes=clip(input.minutes+dot(features(input,'minutes',omit),config.minutes||{}),0,36);
 const rate=input.efficiency+dot(features(input,'rate',omit),config.rate||{})/24;
 const expected=minutes*rate;
 const radius=finite(config.radius)?config.radius:null;
 const statLine=input.profile?Object.fromEntries(Object.entries(input.profile.statRates).map(([id,value])=>[id,value*minutes])):null;
 const lower=radius??input.lowerSpread,upper=radius??input.upperSpread;
 return {expected,minutes,rate,statLine,floor:finite(lower)?expected-lower:null,ceiling:finite(upper)?expected+upper:null,
  intervalSource:radius!==null?'held-out-errors':'upstream-spread'};
}
// Build sufficient statistics once per fold. Every ablation fits the same labels again.
function moments(rows){
 const ids=[...new Set(rows.flatMap(r=>Object.keys(r.columns)))];
 const indexes=new Map(ids.map((id,i)=>[id,i]));
 const gram=ids.map(()=>new Float64Array(ids.length)),target=new Float64Array(ids.length);
 for(const row of rows){
  const entries=Object.entries(row.columns).map(([id,value])=>[indexes.get(id),value]);
  for(const [i,x] of entries){
   target[i]+=x*row.target;
   for(const [j,y] of entries)gram[i][j]+=x*y;
  }
 }
 return {ids,gram,target};
}
function ridge({ids,gram,target},omit){
 const excluded=new Set([omit].flat());
 const columns=ids.map((id,i)=>excluded.has(id)?null:i).filter(i=>i!==null);
 const coeff=new Float64Array(ids.length);
 for(let pass=0;pass<40;pass++){
  let movement=0;
  for(const i of columns){
   let cross=target[i];
   for(const j of columns)if(i!==j)cross-=gram[i][j]*coeff[j];
   const next=cross/(gram[i][i]+35);
   movement=Math.max(movement,Math.abs(next-coeff[i]));coeff[i]=next;
  }
  if(movement<1e-7)break;
 }
 return Object.fromEntries(columns.map(i=>[ids[i],coeff[i]]));
}
function fitVariants(rows,omissions){
 const active=rows.filter(r=>r.input.status==='active'&&r.input.minutes>=5);
 const played=active.filter(r=>r.actualMinutes>=5);
 const minutes=moments(active.map(r=>({columns:features(r.input,'minutes'),target:clip(r.actualMinutes-r.input.minutes,-20,20)})));
 const rate=moments(played.map(r=>({columns:features(r.input,'rate'),target:clip(24*(r.actualPir/r.actualMinutes-r.input.efficiency),-24,24)})));
 return omissions.map(omit=>({minutes:ridge(minutes,omit),rate:ridge(rate,omit)}));
}
function metrics(rows,read){
 if(!rows.length)return {n:0,games:0,mae:null,hit3:null,hit5:null,minutesMae:null,bias:null,rateMae:null};
 const errors=rows.map(r=>read(r).expected-r.actualPir),absolute=errors.map(Math.abs);
 const rateErrors=rows.filter(r=>r.actualMinutes>0&&read(r).minutes>0)
  .map(r=>Math.abs(read(r).expected/read(r).minutes-r.actualPir/r.actualMinutes));
 return {n:rows.length,games:new Set(rows.map(r=>r.gameCode)).size,mae:mean(absolute),
  hit3:mean(absolute.map(e=>Number(e<=3))),hit5:mean(absolute.map(e=>Number(e<=5))),
  minutesMae:mean(rows.map(r=>Math.abs(read(r).minutes-r.actualMinutes))),bias:mean(errors),
  rateMae:rateErrors.length?mean(rateErrors):null};
}
const api={version,components,statProfile,capture,project,fitVariants,metrics};
if(typeof module==='object'&&module.exports)module.exports=api;else root.UnifiedForecast=api;
})(typeof globalThis!=='undefined'?globalThis:this);
