/* Pure, bounded context extension shared by browser and snapshots. */
(function(root){
'use strict';
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).sort().join(' ');
function cdf(x){const z=Math.abs(x)/Math.sqrt(2),t=1/(1+.3275911*z);const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z);return .5*(1+(x<0?-erf:erf));}
function tails(margin,winProb=null){const normalWin=1-cdf(-margin/11.5),p=num(winProb);return {win:(1-cdf((15-margin)/11.5))*(p==null?1:p/normalWin),loss:cdf((-15-margin)/11.5)*(p==null?1:(1-p)/(1-normalWin))};}
function valid(data,now=Date.now()){
 const time=Date.parse(data?.updated_at);return data?.schema==='matchup-context-v1'&&data.season==='E2026'&&Number.isFinite(time)&&time<=now+300000&&now-time<36*3600000;
}
function project(x,p,data){
 const y={...x};if(!valid(data)||p.status==='out'||!['G','F','C'].includes(p.pos))return y;
 const profile=data.players?.[key(p.name)],opp=x.match?.opponent||p.opponent,defense=data.defense?.[opp];
 const margin=num(x.match?.margin)||0;const tail=tails(margin,x.match?.winProb);let baseMin=num(x.minutes)||0;
 if(baseMin<=0)return y;
 // The base model already reduces expensive-player minutes at margin >= 10.
 // Replace that single scenario adjustment rather than count it twice.
 let neutral=baseMin;if(margin>=10)neutral/=(Number(p.price)>=12?.97:Number(p.price)<=7?1.05:1);
 const logs=profile?.logs||[],groups=[logs.filter(r=>Math.abs(r.margin)<=10),logs.filter(r=>r.margin>=15),logs.filter(r=>r.margin<=-15)];
 const mean=rs=>rs.length?rs.reduce((s,r)=>s+r.minutes,0)/rs.length:null;
 const seasonMean=num(profile?.avgMinutes);const observed=groups.map(mean);
 const fallbacks=[1.035,.90,.93];
 let values=groups.map((g,i)=>{const w=g.length/(g.length+5);return clip(neutral*(observed[i]!=null&&seasonMean>0?1+w*clip(observed[i]/seasonMean-1,-.3,.3):fallbacks[i]),0,36);});
 const weights=[Math.max(0,1-tail.win-tail.loss),tail.win,tail.loss];
 let minutes=values.reduce((s,v,i)=>s+v*weights[i],0);
 // Until eight games, scenarios explain risk without forcing a guessed mean correction.
 if((profile?.games||0)<8){const shift=baseMin-minutes;values=values.map(v=>clip(v+shift,0,36));minutes=baseMin;}
 else minutes=clip(minutes,baseMin*.92,Math.min(36,baseMin*1.08));
 let involvementFactor=1;
 if(profile?.previousGames>=3&&profile.recentGames>=2&&profile.previousEventsPerMinute>0&&num(profile.recentEventsPerMinute)!=null){
  const reliability=profile.games/(profile.games+8);
  involvementFactor=1+clip((profile.recentEventsPerMinute/profile.previousEventsPerMinute-1)*.20*reliability,-.06,.06);
 }
 let defenseFactor=1,defensePointsDelta=null;
 const avg=profile?.averages;const league=data.league;
 if(profile?.games>=3&&defense?.games>=3&&avg&&num(avg.fieldGoalsAttempted2)!=null&&num(avg.fieldGoalsAttempted3)!=null&&num(league?.rate2)!=null&&num(league?.rate3)!=null){
  const r2=(defense.made2+50*league.rate2)/(defense.attempts2+50),r3=(defense.made3+50*league.rate3)/(defense.attempts3+50);
  defensePointsDelta=2*avg.fieldGoalsAttempted2*(r2-league.rate2)+3*avg.fieldGoalsAttempted3*(r3-league.rate3);
  // This residual is shooting style only; the existing position-PIR factor remains separate.
  defenseFactor=1+clip(defensePointsDelta/Math.max(10,Math.abs(num(x.expected)||0))*.35,-.03,.03);
 }
 const rate=(num(x.expected)||0)/baseMin;const expected=Math.max(0,rate*minutes*involvementFactor*defenseFactor);
 const rival=Object.values(data.players||{}).filter(r=>r.team===opp&&r.pos===p.pos&&!(data.teams?.[opp]?.availability?.missing||[]).some(m=>m.name===r.name&&m.status==='out')).sort((a,b)=>b.avgMinutes-a.avgMinutes)[0]||null;
 y.expected=expected;y.minutes=minutes;y.value=expected/Math.max(.1,Number(p.price)||0);
 y.floor=Math.min(num(x.floor)??expected,Math.max(0,rate*Math.min(...values)*.65));
 y.ceiling=Math.max(num(x.ceiling)??expected,rate*Math.max(...values)*1.3);
 y.context={profile:profile||null,involvementFactor,defenseFactor,defensePointsDelta,rival,opponent:opp,defenseSample:defense?.games||0,baseExpected:x.expected,pirChange:expected-(num(x.expected)||0),minutesChange:minutes-baseMin,
  scenarios:[{id:'close',minutes:values[0],weight:weights[0],observedGames:groups[0].length},{id:'big-win',minutes:values[1],weight:weights[1],observedGames:groups[1].length},{id:'big-loss',minutes:values[2],weight:weights[2],observedGames:groups[2].length}],minutesCorrectionActive:(profile?.games||0)>=8};
 y.source=(x.source||'model')+' + attack / defense / minute scenarios';return y;
}
function applyTeams(matches,data){
 if(!valid(data))return false;
 for(const [t,info] of Object.entries(data.teams||{})){
  const m=matches[t];if(!m||m.opponent!==info.opponent||!!m.home!==info.home||num(info.margin)==null)continue;
  m.margin=info.margin;m.winProb=info.winProb;m.teamPoints=(m.total+m.margin)/2;
  const cdfAt=v=>cdf((v-m.margin)/11.5);
  m.p20=1-cdfAt(20);m.p11_20=cdfAt(20)-cdfAt(10);m.p1_10=cdfAt(10)-cdfAt(0);
  m.l1_10=cdfAt(0)-cdfAt(-10);m.l11_20=cdfAt(-10)-cdfAt(-20);m.l20=cdfAt(-20);
  const normalWin=1-cdfAt(0);
  for(const field of ['p20','p11_20','p1_10'])m[field]*=m.winProb/normalWin;
  for(const field of ['l20','l11_20','l1_10'])m[field]*=(1-m.winProb)/(1-normalWin);
  m.context=info;m.source='EuroLeague model + available roster + opponent strength';
 }
 return true;
}
const api={project,applyTeams,valid,key,tails};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MatchupContext=api;
})(typeof window!=='undefined'?window:globalThis);
