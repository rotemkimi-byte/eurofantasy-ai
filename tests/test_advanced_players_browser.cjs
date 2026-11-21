'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function contrastRatio(a,b){
 const luminance=color=>color.match(/\d+(?:\.\d+)?/g).slice(0,3)
  .map(channel=>Number(channel)/255)
  .map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
  .reduce((sum,value,i)=>sum+value*[0.2126,0.7152,0.0722][i],0);
 const [low,high]=[luminance(a),luminance(b)].sort((x,y)=>x-y);
 return (high+0.05)/(low+0.05);
}
const server=http.createServer((req,res)=>{
 const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[ext]||'application/octet-stream');res.end(b);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const data=JSON.parse(fs.readFileSync(path.join(root,'data/advanced-players.json'),'utf8'));
  const profiles=Object.values(data.games).flatMap(g=>Object.values(g.players)).filter(p=>p.minutes>0);
  assert(profiles.length>0);
  const shot=profiles.find(p=>p.shotCoverage&&p.shots.some(s=>s.x!==null)),line=profiles.find(p=>p.lineupCoverage&&p.lineups.some(l=>l.points>0));
  assert(shot,'At least one real shot map');assert(line,'At least one real reconstructed scoring lineup');
  const page=await browser.newPage();
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
  const boxPlayer=profiles.find(p=>p.name.includes('VEZENKOV'))||shot;
  const boxGames=Object.values(data.games).filter(g=>g.players[boxPlayer.id]?.minutes>0).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('#efNavigation');
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.evaluate(()=>document.querySelector('nav.tabs [data-tab="teamDna"]').click());
    const dna=page.locator('#teamDna');
    for(const mode of ['offense','defense']){
     const button=dna.locator(`[data-view="${mode}"]`);
     await button.click();
     assert.equal(await button.getAttribute('aria-pressed'),'true');
     const colors=await dna.locator('.dna-switch button, .season-ranges button').evaluateAll(buttons=>buttons.map(button=>{
      const style=getComputedStyle(button);
      return [button.textContent,style.color,style.backgroundColor];
     }));
     for(const [label,text,background] of colors){
      assert(contrastRatio(text,background)>=4.5,`Contrast for ${label} in ${theme} / ${mode} at ${width}px`);
     }
    }
    await page.evaluate(()=>document.querySelector('nav.tabs [data-tab="playerBoxScore"]').click());
    const box=page.locator('#playerBoxScore');
    await box.locator('[data-refresh]:enabled').waitFor();
    await box.locator('[data-player]').selectOption(boxPlayer.id);
    for(const range of ['3','0']){
     await box.locator('[data-performance-range="'+range+'"]').click();
     const games=range==='3'?boxGames.slice(0,3):boxGames;
     const points=games.map(g=>g.players[boxPlayer.id].stats.points).filter(Number.isFinite);
     const average=(points.reduce((sum,n)=>sum+n,0)/points.length).toLocaleString('he-IL',{maximumFractionDigits:1});
     const output=box.locator('.ap-box-average');
     assert.match(await output.locator(':scope > small').textContent(),new RegExp('^'+games.length+' '));
     assert.equal(await output.locator('.ap-metric').filter({has:page.getByText('נקודות',{exact:true})}).locator('strong').textContent(),average);
     const metrics=output.locator('.pa-metrics');
     assert(await metrics.evaluate(grid=>{
      const bounds=grid.getBoundingClientRect(),rows=new Map();
      for(const cell of grid.children){
       const {top,left,right}=cell.getBoundingClientRect();
       const row=rows.get(top)||{left,right,count:0};
       rows.set(top,{left:Math.min(left,row.left),right:Math.max(right,row.right),count:row.count+1});
      }
      return [...rows.values()].every(row=>row.count>=2&&row.count<=3&&
       Math.abs(bounds.left-row.left)<1&&Math.abs(bounds.right-row.right)<1);
     }),`Box score rows fill the panel at ${width}px in ${theme}`);

    }
    await box.locator('[data-performance-range="1"]').click();
    const game=box.locator('.performance-game-picker select');
    await game.selectOption({index:1});
    assert.match(await box.locator('[data-range]').inputValue(),/^game:/);
    assert.equal(await box.locator('[data-performance-range][aria-pressed=true]').count(),0);
    await box.locator('[data-performance-range="1"]').click();
    assert.equal(await box.locator('.ap-box-average').count(),0);
    assert.equal(await box.locator('[data-back]').count(),0);
    const picker=box.locator('[data-player]');
    const nextId=await picker.locator('option').evaluateAll((options,id)=>options.find(option=>option.value&&option.value!==id).value,boxPlayer.id);
    await picker.selectOption(nextId);
    assert.equal(await picker.inputValue(),nextId);
    await box.locator('[data-scope=team]').click();
    await box.locator('[data-team]').selectOption({index:1});
    await picker.selectOption({index:1});
    assert(await box.locator('[data-team]').isVisible());
    assert(await picker.isVisible());
    await box.locator('[data-scope=all]').click();
    for(const [id,p] of [['playerNegative',shot],['playerShots',shot],['playerPlusMinus',shot],['playerLineups',line]]){
     await page.evaluate(id=>document.querySelector('nav.tabs [data-tab="'+id+'"]').click(),id);
     const section=page.locator('#'+id);
     await section.locator('[data-refresh]:enabled').waitFor();
     if(await section.locator('[data-back]').isVisible())await section.locator('[data-back]').click();
     await section.locator('[data-player] option[value="'+p.id+'"]').waitFor({state:'attached'});
     await section.locator('[data-player]').selectOption(p.id);
     if(['playerNegative','playerPlusMinus'].includes(id)){
      await section.locator('[data-performance-range="0"]').click();
      assert.equal(await section.locator('[data-range]').inputValue(),'0');
      assert(await section.locator('[data-player]').isVisible());
      assert.equal(await section.locator('[data-back]').count(),0);
     }else await section.locator('[data-range]').selectOption('0');
     await section.locator('.ap-profile').waitFor({state:'visible'});
     if(id==='playerShots')assert(await section.locator('svg.ap-court').count());
     if(id==='playerLineups')assert(await section.locator('.ap-record').count());
     assert(await section.evaluate(e=>e.scrollWidth<=e.clientWidth+2),'No tool horizontal overflow '+id+' '+width);
     const palette=await section.evaluate(e=>{const s=getComputedStyle(e.querySelector('.ap-shell'));return [s.color,s.backgroundColor]});
     assert.notEqual(...palette,'Text contrasts with card');
    }
   }
   await page.evaluate(()=>document.querySelector('nav.tabs [data-tab="playerFreeThrows"]').click());
   const freeThrows=page.locator('#playerFreeThrows');
   const sort=freeThrows.locator('[data-sort]');
   const pick=freeThrows.locator('[data-ranking] button[data-pick]').first();
   await pick.waitFor();
   await sort.selectOption('ftm');
   await pick.click();
   await freeThrows.locator('.ft-player-report').waitFor();
   assert.equal(await freeThrows.locator('details[data-league], [data-disclosure=compare], [data-disclosure=games]').count(),0);
   assert(await sort.isVisible());
   assert(await pick.isVisible());
   const opponent=freeThrows.locator('[data-disclosure=opponent]');
   await opponent.locator('summary').click();
   assert(await opponent.locator('.ft-record').first().isVisible());
   // Open a ranked player by ID and return to the same controls and scroll position.
   await page.evaluate(()=>document.querySelector('nav.tabs [data-tab="playerPlusMinus"]').click());
   const plus=page.locator('#playerPlusMinus');
   await plus.locator('[data-pa-view=ranking]').click();
   await plus.locator('[data-pa-sort=price]').click();
   await plus.locator('[data-pa-cap]').selectOption('15');
   const ranking=plus.locator('[data-pa-ranking-table]');
   if(await ranking.count())await ranking.locator('summary').click();
   const ranked=plus.locator('.pa-table [data-player-profile^="fantasy:"]').nth(4);
   await ranked.scrollIntoViewIfNeeded();
   const initialScroll=await page.evaluate(()=>window.scrollY);
   const expected=await ranked.locator('.pa-person>b').innerText();
   const id=(await ranked.getAttribute('data-player-profile')).split(':')[1];
   const selection=await plus.locator('[data-player]').inputValue();
   for(const part of ['.pa-portrait','.pa-person>b']){
    await ranked.locator(part).click();
    const modal=page.locator('#playerModal');
    await modal.locator('.ef-player-tabs').waitFor();
    assert.equal((await modal.locator('h2').innerText()).toLowerCase(),expected.toLowerCase());
    const media=await page.evaluate(id=>{
     const p=PlayerAnalysis.resolve({fantasyId:id});
     const photo=playerCardProfile(p);
     return photo?{photo:PlayerIdentity.code(photo.playerCode),player:PlayerIdentity.code(PlayerIdentity.resolve(p).euroleagueId),sameClub:canonicalTeam(photo.club)===canonicalTeam(p.team)}:null;
    },id);
    if(media){assert.equal(media.photo,media.player);assert(media.sameClub);}
    await modal.locator('.close').click();
    await page.waitForFunction(y=>Math.abs(window.scrollY-y)<=2,initialScroll);
    assert.equal(await plus.locator('[data-pa-cap]').inputValue(),'15');
    assert.equal(await plus.locator('[data-player]').inputValue(),selection);
    assert.equal(await plus.locator('[data-pa-sort=price]').getAttribute('aria-pressed'),'true');
    assert(await ranked.evaluate(e=>e===document.activeElement));
   }
   assert(await plus.evaluate(e=>e.scrollWidth<=e.clientWidth+2),'No horizontal overflow in the player ranking');
   // Navigation discovers the tools in the player category, and filter clears hidden selections.
   await page.locator('#efCategory').click();
   assert.equal(await page.locator('#efToolGroups [data-ef-tool="playerShots"]').count(),1);
   assert.equal(await page.locator('#efToolGroups [data-ef-tool="playerDna"]').count(),1);
   assert.equal(await page.locator('[data-tab="playerAttacks"], #playerAttacks').count(),0);
   await page.locator('#efToolGroups [data-ef-tool="playerShots"]').click();
   assert.equal(await page.locator('#playerShots input[type=search]').count(),0);
   await page.locator('#playerShots [data-back]').click();
   await page.locator('#playerShots [data-scope=team]').click();
   assert.equal(await page.locator('#playerShots [data-player]').inputValue(),'');
   assert(await page.locator('#playerShots .ap-empty').count());
  }
  console.log('Advanced tools browser checks passed at 390 and 1280 px in both themes');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
