(()=>{
  'use strict';
  const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
  const probability=x=>{const n=number(x);return n===null?null:Math.max(0,Math.min(1,n));};
  const canonical=t=>typeof canonicalTeam==='function'?canonicalTeam(t):t;
  let histories=null;
  function history(team){
    const key=canonical(team);
    if(histories)return {games:histories[key]||[],complete:true};
    const context=window.__matchupContextData?.teams?.[key];
    return {games:(context?.recentHistory||[]).filter(g=>g.won===true||g.won===false).slice().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)),complete:false};
  }
  function buildHistories(raw,now=Date.now()){
    const list=Array.isArray(raw)?raw:(raw?.data||raw?.games||[]),out={},seen=new Set();
    if(!Array.isArray(list))throw Error('Invalid schedule');
    for(const g of list){
      const when=Date.parse(g.utcDate),hs=number(g.local?.score),as=number(g.road?.score);
      if(!g.played||!Number.isFinite(when)||when>=now||hs===null||as===null||hs===as)continue;
      const home=canonical(g.local?.club?.name),away=canonical(g.road?.club?.name);
      if(!home||!away)continue;
      const id=g.gameCode??`${when}:${home}:${away}`;if(seen.has(id))continue;seen.add(id);
      for(const [team,opponent,isHome,score,against] of [[home,away,true,hs,as],[away,home,false,as,hs]]){
        (out[team]??=[]).push({opponent,date:g.utcDate,home:isHome,won:score>against,margin:score-against,score,against});
      }
    }
    for(const games of Object.values(out))games.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    return out;
  }
  function streak(games,complete){
    if(!games.length)return 'אין תוצאות זמינות';
    const won=games[games.length-1].won;let count=0;
    for(let i=games.length-1;i>=0&&games[i].won===won;i--)count++;
    return `${count}${!complete&&count===games.length?'+':''} ${won?'ניצחונות':'הפסדים'} ברצף`;
  }
  function venue(home){return home===true?'בית':home===false?'חוץ':'מיקום לא זמין';}
  function resultHTML(g){
    const date=new Date(g.date),dateLabel=Number.isFinite(date.getTime())?date.toLocaleDateString('he-IL',{day:'numeric',month:'numeric',timeZone:'Asia/Jerusalem'}):'';
    const score=number(g.score)!==null&&number(g.against)!==null?`<span dir="ltr">${g.score}–${g.against}</span>`:number(g.margin)!==null?`הפרש <span dir="ltr">${g.margin>0?'+':''}${g.margin}</span>`:'תוצאה לא זמינה';
    return `<div class="coach-result ${g.won?'won':'lost'}"><b>${g.won?'ניצחון':'הפסד'}</b><strong>${score}</strong><span>${e(g.opponent)}</span><small>${venue(g.home)}${dateLabel?' · '+dateLabel:''}</small></div>`;
  }
  function metric(label,value,kind){
    const p=probability(value),display=p===null?'—':Math.round(p*100)+'%';
    return `<div class="coach-prob ${kind}"><div><span>${label}</span><b dir="ltr">${display}</b></div><div class="coach-track" role="img" aria-label="${label}: ${display}"><i style="width:${p===null?0:p*100}%"></i></div></div>`;
  }
  function rosterHTML(m,team){
    const audit=window.MatchupContext?.teamExplanation?.(m,window.__matchupContextData);
    const pct=p=>(p*100).toFixed(1)+'%',signed=n=>Math.abs(n)<.05?'0.0':(n>0?'+':'')+n.toFixed(1);
    const liveMissing=t=>typeof players==='undefined'?null:players.filter(p=>canonical(p.team)===t&&['G','F','C'].includes(p.pos)&&['out','questionable'].includes(p.status));
    const group=(name,missing)=>{
      const known=Array.isArray(missing),list=missing||[];
      return `<div class="coach-absence-team"><div class="coach-absence-heading"><b>${e(name)}</b><span>${known?(list.length===1?'חיסור אחד':list.length+' חיסורים'):'בהמתנה'}</span></div><div class="coach-absence-players">${list.map(p=>{
        const out=p.status==='out',initials=String(p.name).split(/\s+/).map(n=>n[0]).slice(0,2).join(''),minutes=number(p.avgMinutes);
        return `<div class="coach-absence-player ${out?'is-out':'is-doubtful'}"><span class="coach-absence-avatar" aria-hidden="true">${e(initials)}</span><span class="coach-absence-person"><b dir="auto">${e(p.name)}</b><small>${out?'בחוץ':'בספק'}${minutes!==null?' · '+Math.round(minutes)+' דק׳'+(p.sampleGames?' בממוצע':' משוערות'):''}</small></span><i class="coach-absence-dot" aria-hidden="true"></i></div>`;
      }).join('')||`<span class="coach-absence-empty">${known?'אין חיסורים מסומנים':'נתוני הזמינות טרם נטענו'}</span>`}</div></div>`;
    };
    const own=audit?.own?.missing||liveMissing(team),rival=audit?.opponent?.missing||liveMissing(m?.opponent);
    const updated=audit?new Date(audit.updated_at).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jerusalem'}):'';
    return `<section class="coach-availability ${audit?'is-verified':'is-pending'}" aria-label="חיסורים והשפעתם על התחזית"><div class="coach-availability-title"><b>חיסורים וזמינות</b><span class="coach-auto-status"><i aria-hidden="true"></i>${audit?'משוקלל אוטומטית':'ממתין לשקלול עדכני'}</span></div>
    ${audit?`<div class="coach-impact"><div class="coach-impact-title"><span>השפעה על סיכויי הניצחון</span><b class="${audit.change<0?'negative':audit.change>0?'positive':'neutral'}"><bdi>${signed(audit.change*100)}</bdi> נק׳ אחוז</b></div><div class="coach-impact-row before"><span>לפני חיסורים</span><div class="coach-impact-track"><i style="width:${Math.max(0,Math.min(100,audit.before*100))}%"></i></div><b dir="ltr">${pct(audit.before)}</b></div><div class="coach-impact-row after"><span>אחרי שקלול</span><div class="coach-impact-track"><i style="width:${Math.max(0,Math.min(100,audit.after*100))}%"></i></div><b dir="ltr">${pct(audit.after)}</b></div></div>`:'<p class="coach-roster-note">תחזית בסיס · שקלול החיסורים למשחק הזה אינו מאומת.</p>'}
    ${group(team,own)}${m?.opponent?group(m.opponent,rival):''}<p class="coach-availability-foot">${audit?'מחושב לפי זמינות, דקות ומחיר בשתי הקבוצות · '+e(updated):'השקלול יתעדכן אוטומטית כשיתקבלו נתונים תואמים למשחק.'}</p></section>`;
  }
  function render(){
    const target=document.getElementById('coachList');if(!target)return;
    const input=document.getElementById('coachBudget'),raw=number(input?.value),budget=raw===null?10:Math.max(0,raw);
    const order=document.getElementById('coachPriceOrder')?.value||'asc';
    const coaches=COACHES.filter(c=>number(c.price)!==null&&Number(c.price)<=budget).slice().sort((a,b)=>(order==='desc'?-1:1)*(a.price-b.price)||a.name.localeCompare(b.name));
    target.className='coach-grid';
    target.innerHTML=coaches.map(c=>{
      const team=canonical(c.team),m=MATCHUPS[team],h=history(team),recent=h.games.slice(-3).reverse();
      const opponent=m?.opponent,win=probability(m?.winProb),p20=probability(m?.p20),mid=probability(m?.p11_20),p11=mid!==null&&p20!==null?mid+p20:null;
      const expected=m?number(coachExpected(team)):null;
      return `<article class="coach-card" dir="rtl"><header><div><span class="coach-team">${e(team)}</span><h4>${e(c.name)}</h4></div><span class="coach-price"><b>${Number(c.price).toFixed(1)}</b> קרדיט</span></header>
      <div class="coach-fixture"><div><small>המשחק הבא</small><b>${opponent?'מול '+e(opponent):'יריבה לא זמינה'}</b></div><span class="coach-venue">${opponent?venue(m.home):'מועד לא זמין'}</span></div>
      <div class="coach-probabilities">${metric('סיכוי לניצחון',win,'main')}${metric('ניצחון בהפרש 11+',p11,'margin')}${metric('ניצחון בהפרש 20+',p20,'margin large')}</div>
      ${rosterHTML(m,team)}
      <div class="coach-form-head"><b>שלושת המשחקים האחרונים</b><span>${streak(h.games,h.complete)}</span></div><div class="coach-results">${recent.map(resultHTML).join('')||'<p class="muted">אין תוצאות משחקים זמינות.</p>'}</div>
      ${recent.length&&recent.length<3?`<small class="coach-sample">זמינים ${recent.length} משחקים בעונה הנוכחית.</small>`:''}${!h.complete&&recent.length?'<small class="coach-sample">הרצף מבוסס על מדגם התוצאות הזמין.</small>':''}
      <footer><span>נקודות פנטזי צפויות</span><b dir="ltr">${expected===null?'—':expected.toFixed(1)}</b><small>ממוצע משוקלל של ניצחונות והפסדים, כולל ניקוד שלילי בהפסד.</small></footer></article>`;
    }).join('')||'<p class="muted">אין מאמנים במחיר שמתאים לתקציב.</p>';
  }
  window.CoachesUI={buildHistories,streak,render,rosterHTML};
  // Share the same live availability view with the team matchup screen.
  if(typeof renderGames==='function'&&typeof GAMES!=='undefined'){
    const previousGames=renderGames;
    renderGames=function(){
      previousGames();
      const cards=document.querySelectorAll('#gameCards .gameCard');
      GAMES.forEach((game,i)=>{
        const card=cards[i];if(!card)return;
        const html=rosterHTML(MATCHUPS[game.home],game.home);
        const details=card.querySelector('.secondaryDetails');
        if(details)details.insertAdjacentHTML('beforebegin',html);
        else card.insertAdjacentHTML('beforeend',html);
      });
    };
    renderGames();
  }
  const section=document.getElementById('coach'),head=section?.querySelector('.sectionHead');
  if(head){
    const title=head.querySelector('h3'),description=head.querySelector('p');
    if(title)title.textContent='מאמנים · מחיר, יריבה וכושר אחרון';
    if(description)description.textContent='סיכויי הניצחון הם תחזית למשחק הבא. ניצחון ב־20+ נכלל גם ב־11+; האחוזים אינם מתחברים.';
    const controls=document.createElement('div');controls.className='coach-controls';
    const budget=document.getElementById('coachBudget')?.closest('label');if(budget)controls.append(budget);
    controls.insertAdjacentHTML('beforeend','<label>מיון לפי מחיר<select id="coachPriceOrder"><option value="asc">מהזול ליקר</option><option value="desc">מהיקר לזול</option></select></label>');head.append(controls);
    const input=document.getElementById('coachBudget');if(input){input.removeEventListener('input',renderCoaches);input.addEventListener('input',render);}
    document.getElementById('coachPriceOrder').addEventListener('change',render);
  }
  renderCoaches=render;
  render();
  (async()=>{try{
    const response=await fetch('./data/context/E2026-schedule.json?t='+Date.now(),{cache:'no-store',...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(10000)}:{})});
    if(!response.ok)throw Error('Schedule unavailable');
    const raw=await response.json();histories=buildHistories(raw);render();
  }catch(error){console.warn('Coach results use available context history',error);render();}})();
})();
