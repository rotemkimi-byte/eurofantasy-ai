(()=>{
  const button=document.getElementById('optBtn'),output=document.getElementById('optResult');if(!button||!output)return;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let running=false;
  optimize=async function(){
    if(running)return;
    const budget=Number(document.getElementById('budget').value),threshold=Number(document.getElementById('optConf').value),exclude=document.getElementById('excludeQ').value==='yes';
    if(!Number.isFinite(budget)||budget<=0||!Number.isFinite(threshold)||threshold<0||threshold>100){output.innerHTML='<p class="bad">הזן תקציב חיובי וסף איכות בין 0 ל־100.</p>';return;}
    running=true;button.disabled=true;button.textContent='מחשב סגל…';output.innerHTML='<p class="notice" role="status">מכין תחזיות ובודק תקציב…</p>';
    let worker,url;
    const finish=()=>{worker?.terminate();if(url)URL.revokeObjectURL(url);running=false;button.disabled=false;button.textContent='בנה סגל';};
    try{
      await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
      const pool=[];
      for(let i=0;i<players.length;i++){
        const p=players[i],position=['G','F','C'].indexOf(p.pos),cost=Math.round(Number(p.price)*10);
        if(position<0||!Number.isFinite(cost)||cost<=0||p.status==='out'||(exclude&&p.status==='questionable'))continue;
        const x=model(p),score=Number(x.expected),confidence=Number(x.confidence);
        if(!Number.isFinite(score)||!Number.isFinite(confidence)||confidence<threshold)continue;
        pool.push({id:i,position,cost,score});
      }
      if(!pool.length){output.innerHTML='<p class="bad">אין שחקנים שעוברים את המסננים. נסה להוריד את סף איכות הנתונים.</p>';finish();return;}
      const response=await fetch('./optimizer-worker.js?v=1',{cache:'no-store'});if(!response.ok)throw Error('worker load failed');
      url=URL.createObjectURL(new Blob([await response.text()],{type:'text/javascript'}));worker=new Worker(url);
      worker.onerror=()=>{output.innerHTML='<p class="bad">החישוב נכשל. רענן את האתר ונסה שוב.</p>';finish();};
      worker.onmessage=e=>{
        const message=e.data;
        if(message.type==='progress'){output.innerHTML=`<p class="notice" role="status">מחפש סגל מתוך ${pool.length} שחקנים… ${message.value}%</p>`;return;}
        if(message.type==='error'){output.innerHTML='<p class="bad">החישוב נכשל. נסה שוב עם תקציב אחר.</p>';finish();return;}
        const r=message.result;
        if(r.error){
          const text=r.error==='budget'?`הסגל הזול ביותר שעובר את המסננים עולה ${r.minimum.toFixed(1)} קרדיט. הגדל את התקציב או הורד את סף האיכות.`:r.error==='positions'?`אין מספיק שחקנים במסננים: ${r.counts[0]} גארדים, ${r.counts[1]} פורוורדים, ${r.counts[2]} סנטרים. נדרשים 4, 4 ו־2. נסה להוריד את הסף.`:'לא נמצא סגל במסגרת הזאת. נסה לשנות תקציב או סף איכות.';
          output.innerHTML=`<p class="bad">${text}</p>`;finish();return;
        }
        const selected=r.selected.map(id=>({p:players[id],score:pool.find(p=>p.id===id).score})).sort((a,b)=>a.p.pos.localeCompare(b.p.pos)||b.score-a.score);
        output.innerHTML=`<div class="notice" role="status"><b>עלות ${r.cost.toFixed(1)} קרדיט · PIR צפוי ${r.score.toFixed(1)}</b><br>נשארו ${(budget-r.cost).toFixed(1)} קרדיט מתקציב השחקנים שהזנת.</div><div class="grid2" style="margin-top:10px">${selected.map(({p,score})=>`<div class="miniCard"><b>${escape(p.name)}</b><br><small>${escape(p.pos)} · ${escape(p.team)} · ${Number(p.price).toFixed(1)} קרדיט · PIR צפוי ${score.toFixed(1)}</small></div>`).join('')}</div><p class="muted" style="margin-top:12px">הסגל ממקסם את סכום ה־PIR הצפוי תחת התקציב והעמדות. מאמן, מכפיל קפטן, חילופים ומגבלות נוספות אינם כלולים בחישוב.</p>`;
        finish();
      };
      worker.postMessage({pool,budget:Math.floor(budget*10+1e-6)});
    }catch(e){console.error('Optimizer failed',e);output.innerHTML='<p class="bad">לא ניתן להפעיל את החישוב. רענן את האתר ונסה שוב.</p>';finish();}
  };
  button.onclick=optimize;button.textContent='בנה סגל';
})();
