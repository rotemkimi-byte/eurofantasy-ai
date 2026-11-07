'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[ext]||'application/octet-stream');res.end(b);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const data=JSON.parse(fs.readFileSync(path.join(root,'data/advanced-players.json'),'utf8'));
  const profiles=Object.values(data.games).flatMap(g=>Object.values(g.players)).filter(p=>p.minutes>0);
  assert(profiles.length>0);
  const shot=profiles.find(p=>p.shotCoverage&&p.shots.some(s=>s.x!==null)),line=profiles.find(p=>p.lineupCoverage&&p.lineups.some(l=>l.points>0));
  assert(shot,'At least one real shot map');assert(line,'At least one real reconstructed scoring lineup');
  const page=await browser.newPage();
  const boxPlayer=profiles.find(p=>p.name.includes('VEZENKOV'))||shot;
  const boxGames=Object.values(data.games).filter(g=>g.players[boxPlayer.id]?.minutes>0).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('#efNavigation');
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.evaluate(()=>document.querySelector('nav.tabs [data-tab="playerBoxScore"]').click());
    const box=page.locator('#playerBoxScore');
    await box.locator('[data-player]').selectOption(boxPlayer.id);
    for(const range of ['3','0']){
     await box.locator('[data-range]').selectOption(range);
     const games=range==='3'?boxGames.slice(0,3):boxGames;
     const points=games.map(g=>g.players[boxPlayer.id].stats.points).filter(Number.isFinite);
     const average=(points.reduce((sum,n)=>sum+n,0)/points.length).toLocaleString('he-IL',{maximumFractionDigits:1});
     const output=box.locator('.ap-box-average');
     assert.match(await output.locator(':scope > small').textContent(),new RegExp('^'+games.length+' '));
     assert.equal(await output.locator('.ap-metric').filter({has:page.getByText('נקודות',{exact:true})}).locator('strong').textContent(),average);
    }
    await box.locator('[data-range]').selectOption('1');
    assert.equal(await box.locator('.ap-box-average').count(),0);
    for(const [id,p] of [['playerNegative',shot],['playerShots',shot],['playerPlusMinus',shot],['playerLineups',line],['playerAttacks',shot]]){
     await page.evaluate(id=>document.querySelector('nav.tabs [data-tab="'+id+'"]').click(),id);
     const section=page.locator('#'+id);
     await section.locator('[data-player] option[value="'+p.id+'"]').waitFor({state:'attached'});
     await section.locator('[data-player]').selectOption(p.id);
     await section.locator('[data-range]').selectOption('0');
     await section.locator('.ap-profile').waitFor({state:'visible'});
     if(id==='playerShots')assert(await section.locator('svg.ap-court').count());
     if(id==='playerLineups')assert(await section.locator('.ap-record').count());
     assert(await section.evaluate(e=>e.scrollWidth<=e.clientWidth+2),'No tool horizontal overflow '+id+' '+width);
     const palette=await section.evaluate(e=>{const s=getComputedStyle(e.querySelector('.ap-shell'));return [s.color,s.backgroundColor]});
     assert.notEqual(...palette,'Text contrasts with card');
    }
   }
   // Navigation discovers the tools in the player category, and filter clears hidden selections.
   await page.locator('#efCategory').click();
   assert.equal(await page.locator('#efToolGroups [data-ef-tool="playerShots"]').count(),1);
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
