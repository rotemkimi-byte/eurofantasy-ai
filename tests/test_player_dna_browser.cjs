'use strict';
const {chromium,webkit}=require('playwright');
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
 const engine=process.env.DNA_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const widths=[375,390,430,1280];
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   if(process.env.DNA_OLD_CSS){
    await page.route('**/dna-tools.css?*',route=>route.fulfill({path:process.env.DNA_OLD_CSS,contentType:'text/css'}));
   }
   await page.goto(production||'http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('nav.tabs [data-tab="playerDna"]').evaluate(el=>el.click());
   const panel=page.locator('#playerDna');
   await panel.locator('.dna-radar-card').waitFor({timeout:60000});
   await page.locator('html').evaluate(el=>el.dataset.theme='light');
   assert.equal(await panel.evaluate(el=>getComputedStyle(el).direction),'rtl');
   assert.equal(await panel.locator('.dna-player-visuals:has(> .dna-shot-split + .dna-radar-profile) + .dna-player-metrics').count(),1);
   assert.equal(await panel.locator('.dna-bars, .dna-radar-scores, .dna-summary').count(),0);
   const radar = panel.locator('.dna-radar-profile');
   assert.ok(await radar.locator('svg').evaluate(svg=>svg.getBoundingClientRect().bottom>svg.getBoundingClientRect().top));
   assert.ok(await radar.evaluate(el=>el.getBoundingClientRect().top>=el.previousElementSibling.getBoundingClientRect().bottom));
   const cardsFit=await panel.locator('.dna-player-style-profile').evaluate((style,mobile)=>{
    const container=style.getBoundingClientRect();
    const shot=style.querySelector('.dna-shot-split').getBoundingClientRect();
    const radar=style.querySelector('.dna-radar-profile').getBoundingClientRect();
    const metrics=style.querySelector('.dna-player-metrics').getBoundingClientRect();
    const court=style.querySelector('.dna-court').getBoundingClientRect();
    const table=style.querySelector('.dna-player-table').getBoundingClientRect();
    const cards=[shot,radar,metrics];
    return cards.every(box=>box.width>=container.width*(mobile?.98:.32)&&box.left>=container.left-1&&box.right<=container.right+1)&&
     court.width>=shot.width-26&&table.width>=metrics.width-24&&(!mobile||metrics.top>=radar.bottom);
   },width<=740);
   assert.equal(cardsFit,true,'DNA cards collapsed or overflowed at '+width+'px');
   const scores=await radar.locator('.dna-radar-inline-score').allTextContents();
   assert.equal(scores.length,10);
   assert.deepEqual(await radar.locator('svg text[direction=rtl]').allTextContents(),
    ['קליעה','שלשות','צבע','יצירת משחק','מתפרצות','ריבאונד','הגנה','סחיטת עבירות','יציבות','יעילות']);
   assert.equal(await radar.locator('svg text.dna-radar-inline-score[direction=ltr]').count(),10);
   assert.equal(await radar.locator('svg text > tspan').count(),0);
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
   const boards=panel.locator('[data-dna-group="boards"]');
   await boards.locator(':scope > summary').click();
   const card=boards.locator('.dna-category-grid > .dna-expanded-row').first();
   const bounds=await card.locator(':scope > summary').evaluate(summary=>{
    const box=summary.getBoundingClientRect();
    const name=summary.querySelector('.dna-expanded-name').getBoundingClientRect();
    const values=summary.querySelector('.dna-expanded-cells').getBoundingClientRect();
    return {height:box.height,sideBySide:values.right<=name.left};
   });
   assert.ok(bounds.sideBySide&&bounds.height<=112,JSON.stringify(bounds));
   await card.getByText('מה זה אומר?').click();
   assert.ok(await card.locator(':scope > .dna-expanded-help').isVisible());
   if(process.env.DNA_SCREENSHOT_DIR&&width===390){
    await boards.screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'compact-boards.png')});
   }
   const shooting=panel.locator('[data-dna-group="shooting"]');
   await shooting.locator(':scope > summary').click();
   await shooting.locator('[data-metric=ts] > summary').click();
   assert.match(await shooting.locator('[data-metric=ts] .dna-expanded-value').textContent(),/%/);
   if(process.env.DNA_SCREENSHOT_DIR&&width===390){
    await panel.locator('.dna-radar-card').screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'radar.png')});
    await shooting.screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'category.png')});
   }
   for(const range of ['5','3','1']){
    const b=panel.locator('[data-season-range="'+range+'"]');
    await b.click();
    assert.equal(await b.getAttribute('aria-pressed'),'true');
    const appearances=await panel.locator('.dna-headline-stats div').last().locator('dd').textContent();
    assert.ok(Number(appearances)<=Number(range));
   }
   assert.equal(await panel.locator('.dna-bars, .dna-radar-scores, .dna-summary').count(),0);
   assert.ok((await radar.locator('.dna-radar-inline-score').allTextContents()).every(score=>score==='—'));
   await panel.locator('[data-venue=away]').click();
   assert.equal(await panel.locator('[data-venue=away]').getAttribute('aria-pressed'),'true');
   await panel.locator('[data-season-range="0"]').click();
   await panel.locator('[data-venue=all]').click();
   await panel.locator('[data-player-view=player]').click();
   await panel.locator('[data-compare-player]').selectOption({index:1});
   assert.equal(await panel.locator('.dna-radar-other').count(),1);
   assert.equal(await panel.locator('.dna-compact-metrics').count(),0);
   assert.equal(await panel.locator('.dna-radar-comparison + .dna-style-compare').count(),1);
   assert.equal(await panel.locator('.dna-bars, .dna-summary, .dna-radar-scores').count(),0);
   const compareRadar=panel.locator('.dna-radar-comparison');
   assert.deepEqual(await compareRadar.locator('.dna-radar-score-own').allTextContents(),scores);
   assert.equal(await compareRadar.locator('.dna-radar-score-other').count(),10);
   assert.ok(await compareRadar.locator('.dna-radar-diamond').count());
   const fits=await compareRadar.locator('svg').evaluate(svg=>{
    const {x,y,width,height}=svg.viewBox.baseVal;
    const boxes=[...svg.querySelectorAll('text')].map(el=>el.getBBox());
    return boxes.every((a,i)=>a.x>=x&&a.y>=y&&a.x+a.width<=x+width&&a.y+a.height<=y+height&&
     boxes.slice(i+1).every(b=>a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y));
   });
   assert.ok(fits);
   const styleRows=panel.locator('.dna-style-compare');
   assert.ok(await styleRows.locator('.dna-ahead').count());
   assert.equal(await styleRows.locator('.dna-ahead').count(),await styleRows.locator('.dna-behind').count());
   assert.equal(await styleRows.locator('.dna-value.dna-other:not(.dna-ahead,.dna-behind,.dna-even)').count(),0);
   assert.equal(await panel.locator('[data-metric=ts] .dna-expanded-value').count(),2);
   assert.match(await panel.locator('[data-metric=ts] .dna-metric-gap').textContent(),/פער|שוויון/);
   if(process.env.DNA_SCREENSHOT_DIR&&width===390){
    await compareRadar.screenshot({path:path.join(process.env.DNA_SCREENSHOT_DIR,'comparison.png')});
   }
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
