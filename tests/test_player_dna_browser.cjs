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
  const widths=[375,390,430,1280];
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(production||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('nav.tabs [data-tab="playerDna"]').evaluate(el=>el.click());
   const panel=page.locator('#playerDna');
   await panel.locator('.dna-radar-card').waitFor({timeout:60000});
   await page.locator('html').evaluate(el=>el.dataset.theme='light');
   assert.equal(await panel.evaluate(el=>getComputedStyle(el).direction),'rtl');
   assert.equal(await panel.locator('.dna-shot-split + .dna-radar-profile + .dna-player-metrics').count(),1);
   assert.equal(await panel.locator('.dna-bars, .dna-radar-scores').count(),0);
   const radar = panel.locator('.dna-radar-profile');
   assert.ok(await radar.locator('svg').evaluate(svg=>svg.getBoundingClientRect().bottom>svg.getBoundingClientRect().top));
   assert.ok(await radar.evaluate(el=>el.getBoundingClientRect().top>=el.previousElementSibling.getBoundingClientRect().bottom));
   const scores=await radar.locator('.dna-radar-inline-score').allTextContents();
   assert.equal(scores.length,10);
   assert.ok(scores.some(score=>/^\d+(\.\d+)?$/.test(score)));
   const radarBounds=await radar.locator('svg').evaluate(svg=>{
    const {x,y,width,height}=svg.viewBox.baseVal;
    const labels=[...svg.querySelectorAll('text')].map(label=>label.getBBox());
    return labels.every((box,i)=>box.x>=x&&box.y>=y&&box.x+box.width<=x+width&&box.y+box.height<=y+height&&
     labels.slice(i+1).every(b=>box.x+box.width<=b.x||b.x+b.width<=box.x||box.y+box.height<=b.y||b.y+b.height<=box.y));
   });
   assert.equal(radarBounds,true);
   assert.ok(await panel.locator('.dna-player-photo').count());
   assert.ok(await panel.locator('.dna-player-club').count());
   const defaultPrice=await panel.locator('[data-player] option:checked').textContent();
   const prices=(await panel.locator('[data-player] option').allTextContents()).map(t=>Number(t.match(/([0-9.]+) CR/)?.[1]||0));
   assert.equal(Number(defaultPrice.match(/([0-9.]+) CR/)?.[1]),Math.max(...prices));
   assert.equal(await panel.locator('[data-dna-group="summary"] [data-metric]').count(),7);
   await page.waitForFunction(()=>window.__weightedForecastReady===true,null,{timeout:80000});
   const projection=await panel.locator('[data-metric=projection] .dna-expanded-value .dna-raw').textContent();
   assert.match(projection,/PIR/);
   for(const group of ['shooting','creation','transition','boards']){
    const category=panel.locator(`[data-dna-group="${group}"]`);
    const toggle=category.locator(':scope > summary');
    assert.equal(await toggle.getByText('הצג מדדים').isVisible(),true);
    await toggle.getByText('הצג מדדים').click();
    assert.equal(await toggle.getByText('סגור מדדים').isVisible(),true);
    await toggle.locator('.dna-category-title').click();
    assert.equal(await category.getAttribute('open'),null);
   }
   const shooting=panel.locator('[data-dna-group="shooting"]');
   await shooting.locator(':scope > summary').click();
   await shooting.locator('[data-metric=ts] > summary').click();
   assert.match(await shooting.locator('[data-metric=ts] .dna-expanded-value').textContent(),/%/);
   if(process.env.DNA_SCREENSHOT_DIR&&width===390){
    await panel.locator('.dna-radar-card').screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'radar.png')});
    await shooting.screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'category.png')});
   }
   const seasonSummary=await panel.locator('.dna-summary').textContent();
   for(const range of ['5','3','1']){
    const b=panel.locator('[data-season-range="'+range+'"]');
    await b.click();
    assert.equal(await b.getAttribute('aria-pressed'),'true');
    const appearances=await panel.locator('.dna-headline-stats div').last().locator('dd').textContent();
    assert.ok(Number(appearances)<=Number(range));
   }
   assert.notEqual(await panel.locator('.dna-summary').textContent(),seasonSummary);
   assert.equal(await panel.locator('.dna-bars, .dna-radar-scores').count(),0);
   assert.ok((await radar.locator('.dna-radar-inline-score').allTextContents()).every(score=>score==='—'));
   await panel.locator('[data-venue=away]').click();
   assert.equal(await panel.locator('[data-venue=away]').getAttribute('aria-pressed'),'true');
   await panel.locator('[data-season-range="0"]').click();
   await panel.locator('[data-venue=all]').click();
   await panel.locator('[data-player-view=player]').click();
   await panel.locator('[data-compare-player]').selectOption({index:1});
   assert.equal(await panel.locator('.dna-radar-other').count(),1);
   assert.equal(await panel.locator('.dna-radar-inline-score').count(),0);
   const marker=panel.locator('.dna-radar-own .dna-radar-hit').first();
   await marker.click();
   assert.match(await panel.locator('.dna-radar-selection').textContent(),/מתוך 100/);
   const axis=panel.locator('[data-radar-score]').last();
   await axis.focus();
   await axis.press('Enter');
   assert.equal(await axis.getAttribute('aria-pressed'),'true');
   assert.deepEqual(await panel.locator('.dna-radar-scores button strong bdi:first-child').allTextContents(),scores);
   await panel.locator('.dna-more-bars > summary').click();
   const turnovers=panel.locator('[data-dna-bar=turnovers]');
   const rank=Number((await turnovers.locator('.dna-rank-line bdi').first().textContent()).split('/')[0]);
   const tone=rank<=25?'strong':rank>=75?'weak':'middle';
   assert.equal(await turnovers.locator('.dna-expanded-value').first().locator('.dna-rank-'+tone).count(),1);
   assert.equal(await panel.locator('[data-dna-bar=usage] .dna-rank-neutral').count(),2);
   if(process.env.DNA_SCREENSHOT_DIR&&width===390){
    await panel.locator('[data-dna-bar=drawn]').screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'bar.png')});
   }
   assert.equal(await panel.locator('[data-metric=ts] .dna-expanded-value').count(),2);
   assert.equal(await panel.locator('[data-dna-bar=turnovers] .dna-expanded-value').count(),2);
   assert.match(await panel.locator('[data-dna-bar=turnovers] .dna-metric-gap').textContent(),/פער|שוויון/);
   assert.equal(await panel.locator('.dna-radar-scores [data-radar-score]').last().locator('strong bdi').count(),2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await panel.locator('[data-player-view=team]').click();
   await panel.locator('[data-compare-club]').selectOption({index:1});
   assert.equal(await panel.locator('.dna-style-compare').count(),1);
   assert.equal(await panel.locator('.dna-style-compare + .dna-radar-card').count(),1);
   assert.equal(await panel.locator('.dna-bars').count(),1);
   assert.equal(await panel.locator('.dna-radar-scores').count(),1);
   await panel.locator('[data-dna-group=opponent] > summary').click();
   assert.match(await panel.locator('[data-metric=allowedThree] .dna-expanded-value').textContent(),/%/);
   await panel.locator('[data-season-range=history]').click();
   await panel.locator('[data-season-game]').first().click();
   assert.equal(await panel.locator('.dna-history-table').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('Player DNA passed at '+widths.join(', ')+'px'+(production?' on GitHub Pages.':' locally.'));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
