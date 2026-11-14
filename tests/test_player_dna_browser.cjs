'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'};
 fs.readFile(file,(error,data)=>error?res.writeHead(404).end():res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data));
});
(async()=>{
 const production=process.env.DNA_SITE_URL;
 if(!production)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(production||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('nav.tabs [data-tab="playerDna"]').evaluate(el=>el.click());
   const panel=page.locator('#playerDna');
   await panel.locator('.dna-radar-card').waitFor({timeout:60000});
   assert.equal(await panel.locator('.dna-radar-card svg text').count(),10);
   assert.ok(await panel.locator('.dna-player-photo').count());
   assert.ok(await panel.locator('.dna-player-club').count());
   const defaultPrice=await panel.locator('[data-player] option:checked').textContent();
   const prices=(await panel.locator('[data-player] option').allTextContents()).map(t=>Number(t.match(/([0-9.]+) CR/)?.[1]||0));
   assert.equal(Number(defaultPrice.match(/([0-9.]+) CR/)?.[1]),Math.max(...prices));
   assert.equal(await panel.locator('[data-dna-group="summary"] [data-metric]').count(),7);
   await page.waitForFunction(()=>window.__weightedForecastReady===true,null,{timeout:80000});
   const projection=await panel.locator('[data-metric=projection] .dna-expanded-value strong').textContent();
   assert.match(projection,/PIR/);
   const shooting=panel.locator('[data-dna-group="shooting"]');
   await shooting.locator(':scope > summary').click();
   await shooting.locator('[data-metric=ts] > summary').click();
   assert.match(await shooting.locator('[data-metric=ts] .dna-expanded-value').textContent(),/%/);
   for(const range of ['5','3','1']){
    const b=panel.locator('[data-season-range="'+range+'"]');
    await b.click();
    assert.equal(await b.getAttribute('aria-pressed'),'true');
    const appearances=await panel.locator('.dna-headline-stats div').last().locator('dd').textContent();
    assert.ok(Number(appearances)<=Number(range));
   }
   await panel.locator('[data-venue=away]').click();
   assert.equal(await panel.locator('[data-venue=away]').getAttribute('aria-pressed'),'true');
   await panel.locator('[data-season-range="0"]').click();
   await panel.locator('[data-venue=all]').click();
   await panel.locator('[data-player-view=player]').click();
   await panel.locator('[data-compare-player]').selectOption({index:1});
   assert.equal(await panel.locator('.dna-radar-other').count(),1);
   assert.equal(await panel.locator('[data-metric=ts] .dna-expanded-value').count(),2);
   await panel.locator('[data-player-view=team]').click();
   await panel.locator('[data-compare-club]').selectOption({index:1});
   assert.equal(await panel.locator('.dna-style-compare').count(),1);
   await panel.locator('[data-dna-group=opponent] > summary').click();
   assert.match(await panel.locator('[data-metric=allowedThree] .dna-expanded-value').textContent(),/%/);
   await panel.locator('[data-season-range=history]').click();
   await panel.locator('[data-season-game]').first().click();
   assert.equal(await panel.locator('.dna-history-table').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('Player DNA passed at 390px and 1280px'+(production?' on GitHub Pages.':' locally.'));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
