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
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  const nav=page.locator('#efNavigation');
  await nav.locator('[data-ef-group="players"]').click();
  await page.locator('#efHome [data-ef-tool="playerDna"]').waitFor();
  const scroller=page.locator('#efPageScroll');
  async function assertPinned(){
   const bounds=await nav.evaluate(el=>({
    dock:el.getBoundingClientRect().bottom,
    viewport:visualViewport.height,
    pageScroll:window.scrollY,
    hit:el.contains(document.elementFromPoint(innerWidth/2,el.getBoundingClientRect().top+20))
   }));
   assert.ok(Math.abs(bounds.dock-bounds.viewport)<=1,JSON.stringify(bounds));
   assert.equal(bounds.pageScroll,0);
   assert.equal(bounds.hit,true);
  }
  await assertPinned();
  await page.locator('#efHome [data-ef-tool="playerDna"]').click();
  await page.locator('#playerDna .dna-radar-card').waitFor();
  await assertPinned();
  const input=await page.context().newCDPSession(page);
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:570}]});
  for(const y of [530,470,410,350,290,230]){
   await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y}]});
  }
  await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.getElementById('efPageScroll').scrollTop>200);
  await assertPinned();
  await page.locator('#playerDna [data-player-view="player"]').evaluate(el=>el.click());
  await page.locator('#playerDna [data-compare-player]').selectOption({index:1});
  await page.locator('.dna-comparison-scores').waitFor();
  await page.setViewportSize({width:393,height:650});
  await assertPinned();
  await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
  await assertPinned();
  assert.ok(await page.locator('#efPageScroll > footer').evaluate(el=>
   el.getBoundingClientRect().bottom<=document.getElementById('efNavigation').getBoundingClientRect().top+1
  ));
  await nav.locator('[data-ef-group="players"]').click();
  assert.equal(await nav.locator('[data-ef-group="players"]').getAttribute('aria-current'),'page');
  assert.equal(await nav.count(),1);
  assert.equal(await scroller.evaluate(el=>el.scrollTop),0);
  await assertPinned();
  console.log('Navigation stayed at the visible bottom through viewport changes, scroll and DNA navigation.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
