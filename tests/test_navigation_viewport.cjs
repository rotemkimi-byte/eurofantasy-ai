'use strict';
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>error?res.writeHead(404).end():res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data));
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
 try{
  const page=await browser.newPage(devices['iPhone 15']);
  await page.addInitScript(()=>{
   const real=window.visualViewport;
   const simulated=new EventTarget();
   for(const key of ['height','offsetTop','scale']){
    Object.defineProperty(simulated,key,{get:()=>window.navTestViewport?.[key]??real[key]});
   }
   Object.defineProperty(window,'visualViewport',{value:simulated});
  });
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  const nav=page.locator('#efNavigation');
  await nav.locator('[data-ef-group="players"]').click();
  await page.locator('#efHome [data-ef-tool="playerDna"]').waitFor();
  async function align(height,offsetTop,event){
   await page.evaluate(({height,offsetTop,event})=>{
    window.navTestViewport={height,offsetTop};
    visualViewport.dispatchEvent(new Event(event));
   },{height,offsetTop,event});
   await page.waitForFunction(()=>{
    const {height,offsetTop}=visualViewport;
    const bounds=document.getElementById('efNavigation').getBoundingClientRect();
    return Math.abs(bounds.bottom-(height+offsetTop))<=1;
   });
  }
  const height=await page.evaluate(()=>innerHeight);
  await align(height-180,0,'resize');
  await page.locator('#efHome [data-ef-tool="playerDna"]').click();
  await page.locator('#playerDna .dna-radar-card').waitFor();
  await page.evaluate(()=>window.scrollTo(0,600));
  assert.ok(await page.evaluate(()=>scrollY>0));
  await align(height-180,55,'scroll');
  await page.locator('#playerDna [data-player-view="player"]').evaluate(el=>el.click());
  await page.locator('#playerDna [data-compare-player]').selectOption({index:1});
  await page.locator('.dna-comparison-scores').waitFor();
  await align(height,0,'resize');
  await nav.locator('[data-ef-group="players"]').click();
  assert.equal(await nav.locator('[data-ef-group="players"]').getAttribute('aria-current'),'page');
  assert.equal(await nav.count(),1);
  console.log('Navigation stayed at the visible bottom through viewport changes, scroll and DNA navigation.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
