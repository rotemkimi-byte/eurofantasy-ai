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
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
   await page.waitForSelector('#efNavigation');
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
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
   await page.locator('#playerShots [data-search]').fill('no-such-player-zzzz');
   assert.equal(await page.locator('#playerShots [data-player]').inputValue(),'');
   assert(await page.locator('#playerShots .ap-empty').count());
  }
  console.log('Advanced tools browser checks passed at 390 and 1280 px in both themes');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
