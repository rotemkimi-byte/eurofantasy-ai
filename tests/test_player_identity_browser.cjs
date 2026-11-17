/* Real browser acceptance through the existing UI, with deterministic local data. */
const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),I=require('../player-identity-core.js');
const market=require('../data/players.json');
const ids=[3771,8567,4096,7197,11517,11494,11512,4758];
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.request().resourceType()==='image'?route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=','base64')}):route.abort());
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__personalModelReady&&window.__weightedForecastReady,null,{timeout:60000});
 const all=await page.evaluate(()=>players.filter(p=>['G','F','C'].includes(p.pos)).map(p=>({name:p.name,games:model(p).currentSeasonGames,partial:model(p).dataQuality?.partial,forecast:model(p).expected,minutes:model(p).minutes})));
 assert.equal(all.length,342);for(const p of all){assert(Number.isFinite(p.forecast));assert(Number.isFinite(p.minutes));if(p.partial)assert.equal(p.games,0);}
 for(const fid of ids){
  const p=market.find(p=>p.fantasy_id===fid),id=I.resolve(p).euroleagueId;
  await page.evaluate(name=>showPlayer(name),p.name);
  await page.locator('.ef-overview-data .ef-game-card').first().waitFor();
  assert(!(await page.locator('.ef-overview-data').textContent()).includes('אין עדיין הופעות'));
  assert(await page.locator('.ef-player-avatar img').getAttribute('src'),'photo URL for '+p.name);
  await page.locator('#playerModal .close').click();
  for(const tool of ['playerBoxScore','playerNegative','playerShots','playerPlusMinus','playerLineups']){
   await page.evaluate(tool=>document.querySelector('nav.tabs [data-tab="'+tool+'"]').click(),tool);
   const section=page.locator('#'+tool);await section.locator('[data-refresh]:enabled').waitFor();
   const picker=section.locator('[data-player]');
   if(!await picker.isVisible())await section.locator('[data-back]').click();
   await picker.selectOption(id);
   assert.equal(await section.locator('[data-player] option[value="'+id+'"]').count(),1,p.name+' unique option');
   assert.equal(await section.locator('[data-player] option[value^="market:"]').evaluateAll((opts,name)=>opts.filter(o=>o.textContent.includes(name)).length,p.name),0);
   const text=await section.locator('[data-output]').textContent();assert(!text.includes('אין עדיין נתוני משחק לשחקן בעונה הנוכחית'),p.name+' '+tool);
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS: 342 finite forecasts; all eight acceptance players have real profiles, photo URLs and one unified selection across all five advanced tools on mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
