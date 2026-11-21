const {chromium,webkit}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('{}');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=process.env.TEST_WEBKIT==='1'?await webkit.launch():await chromium.launch({args:['--no-sandbox'],executablePath:process.env.CHROMIUM_PATH});try{
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
assert.equal(await page.locator('#market > .filters select').count(),4);
assert.equal(await page.locator('#maxPrice').count(),0);
const reportRequests=[];
page.on('request',req=>{const url=new URL(req.url());if(url.pathname.endsWith('/performance-history.json')||url.pathname.includes('/backtest/cache/'))reportRequests.push(url.pathname);});
await page.locator('[data-ef-group=players]').click();await page.locator('#efHome [data-ef-tool=pirGraph]').click();assert.equal(await page.locator('[data-pir-mode=pir]').getAttribute('aria-pressed'),'true');
await page.locator('#pirChart svg').waitFor({timeout:90000});
assert.deepEqual(reportRequests,['/data/performance-history.json']);
assert.equal(await page.locator('#pirSingle .pir-help').count(),1);
assert.equal(await page.locator('#pirSingle .ef-help > summary').count(),2);
const games=await page.evaluate(()=>window.PIRHistoryUI.getData().games);
assert.ok(games>=110);
const person=page.locator('#pirPerson'),player=await person.inputValue();
const rangeButton=range=>page.locator(`[data-pir-range="${range}"]`);
const rows=page.locator('#pirGames tr[data-pir-index]');
assert.equal(await rangeButton('0').getAttribute('aria-pressed'),'true');
assert(await rows.count()>3);
for(const mode of ['pir','minutes','credit','mixed']){
 if(mode!=='pir')await page.locator(`[data-pir-mode=${mode}]`).click();
 const scroll=page.locator(mode==='mixed'?'.pirMixedPlot':'#pirChart');
 await page.waitForFunction(selector=>document.querySelector(selector)?.scrollWidth>document.querySelector(selector)?.clientWidth,mode==='mixed'?'.pirMixedPlot':'#pirChart');
 assert(await scroll.evaluate(el=>{
  const last=[...el.querySelectorAll('.pirPoint')].at(-1).getBoundingClientRect(),box=el.getBoundingClientRect();
  return el.scrollLeft===0&&last.left>=box.left&&last.right<=box.right;
 }),mode+' starts with its newest point visible');
 assert(await scroll.evaluate(el=>{el.scrollLeft=-el.scrollWidth;return el.scrollLeft<0;}));
}
await page.locator('[data-pir-mode=pir]').click();
assert.equal(await page.locator('#pirGraph select[id=pirRange],#pirCompare [data-range]').count(),0);
const firstPoint=page.locator('#pirChart .pirPoint').first();
await firstPoint.evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
assert.match(await page.locator('#pirDetail').textContent(),/PIR/);
await rangeButton('1').click();
assert.equal(await rows.count(),1);
assert.equal(await page.locator('#pirDetail .pirGameVenue').count(),1);
await rangeButton('3').click();
assert.equal(await rows.count(),3);
for(const [mode,label] of [['minutes','דקות למשחק'],['credit','קרדיט לפי מחזור'],['mixed','PIR ודקות למשחק']]){
 await page.locator(`[data-pir-mode=${mode}]`).click();
 await page.locator(`#pirChart svg[aria-label="${label}"]`).waitFor();
 assert.equal(await person.inputValue(),player);
 assert.equal(await rangeButton('3').getAttribute('aria-pressed'),'true');
 assert.equal(await rows.count(),3);
 if(mode==='credit'){
  const rounds=await page.evaluate(player=>window.PIRHistoryUI.getData().players.get(player).games.slice(-3).map(g=>`מחזור ${g.round}`),player);
  assert.deepEqual(await rows.locator('td:first-child').allTextContents(),rounds);
 }
}
assert(await page.locator('#pirLegend').isVisible());
assert(await page.locator('#pirChart .pirPointValue.pirValue').count());
assert(await page.locator('#pirChart .pirPointValue.minutesValue').count());
const [axisLabel,...minuteTicks]=await page.locator('.pirFixedAxis.minutesValue text').allTextContents();
assert.equal(axisLabel,'דקות');
assert.equal(minuteTicks[0],'0');
assert(minuteTicks.every((tick,i)=>i===0||Number(tick)>Number(minuteTicks[i-1])));
assert.equal(await page.locator('.pirRoundAxis').textContent(),'מחזור יורוליג');
await person.selectOption({index:1});
assert.notEqual(await person.inputValue(),player);
assert.equal(await rangeButton('3').getAttribute('aria-pressed'),'true');
await page.locator('[data-pir-scope=team]').click();
assert(await page.locator('#pirTeam').isVisible());
await page.locator('[data-pir-scope=all]').click();
assert(!(await page.locator('#pirTeam').isVisible()));
if(process.env.PIR_SCREENSHOT)await page.locator('#pirModes').screenshot({path:process.env.PIR_SCREENSHOT});
await page.locator('[data-pir-mode=compare]').click();
assert.equal(await rangeButton('3').getAttribute('aria-pressed'),'true');
await page.locator('#pirCompare [data-add]').first().waitFor({timeout:90000});
await page.locator('#pirCompare [data-add]').nth(0).click();await page.locator('#pirCompare [data-add]').nth(1).click();
assert.equal(await page.locator('.pc-card').count(),2);
for(const range of ['1','3','0']){await rangeButton(range).click();const actual=await page.locator('.pc-value').allTextContents();const expected=await page.evaluate(range=>[...document.querySelectorAll('#pirCompare [data-remove]')].map(b=>{const games=window.PIRHistoryUI.getData().players.get(b.dataset.remove).games;const rows=range==='0'?games:games.slice(-Number(range));const v=rows.filter(g=>!g.dnp&&g.value!==null).map(g=>g.value);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):'—';}),range);assert.deepEqual(actual,expected);}
for(const width of [320,375,390,430,660,1280]){
 await page.setViewportSize({width,height:844});
 assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2)),'page overflow '+width);
 const overflowing=await page.locator('#pirModes button').evaluateAll(buttons=>buttons.filter(b=>b.scrollWidth>b.clientWidth+1||b.offsetHeight<44).map(b=>b.textContent));
 assert.deepEqual(overflowing,[],'toolbar '+width);
}
for(const theme of ['light','dark']){
 await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);
 for(const [selector,color] of [
  ['[data-pir-range][aria-pressed=true]','rgb(33, 75, 135)'],
  ['[data-pir-scope][aria-pressed=true]','rgb(89, 52, 141)'],
  ['[data-pir-mode=compare]','rgb(30, 41, 59)']
 ]){
  const button=page.locator(selector);
  assert.equal(await button.evaluate(el=>getComputedStyle(el).backgroundColor),color);
  assert.equal(await button.locator('small').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
 }
 const inactive=page.locator('[data-pir-range="3"]');
 assert.equal(await inactive.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(233, 237, 243)');
 assert.equal(await inactive.locator('small').evaluate(el=>getComputedStyle(el).color),'rgb(36, 50, 71)');
}
await page.locator('#pirCompare [data-remove]').first().click();assert.equal(await page.locator('.pc-card').count(),1);
assert.equal(await page.locator('#pirCompare input[type=search]').count(),0);
await page.locator('[data-pir-scope=team]').click();assert.equal(await page.locator('#pirCompare [data-add]').count(),0);
const team=page.locator('#pirCompare [data-team]');
await team.selectOption({index:1});
assert(await page.locator('#pirCompare [data-add]').count()>0);
await page.selectOption('#pirCompare [data-metric]','minutes');
await rangeButton('1').click();
await page.selectOption('#pirCompare [data-metric]','coach');
assert.equal(await rangeButton('1').getAttribute('aria-pressed'),'true');
await page.locator('[data-pir-mode=pir]').click();
assert.equal(await rangeButton('1').getAttribute('aria-pressed'),'true');
assert.equal(await rows.count(),1);
await page.locator('nav.tabs [data-tab=playerDna]').evaluate(el=>el.click());
await page.locator('#playerDna .dna-radar-card').waitFor();
await page.locator('#playerDna [data-dna-group=shooting] > summary').evaluate(el=>el.click());
for(const [theme,color] of [['light','rgb(39, 95, 174)'],['dark','rgb(138, 184, 255)']]){
 await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);
 const style=page.locator('#playerDna [data-metric=threePoints] .dna-rank-neutral i');
 assert.equal(await style.evaluate(el=>getComputedStyle(el).backgroundColor),color);
 const strength=page.locator('#playerDna [data-metric=ts] .dna-rank-strong i');
 assert.notEqual(await strength.evaluate(el=>getComputedStyle(el).backgroundColor),color);
}
assert.deepEqual(errors,[]);console.log('PIR comparison navigation, selection, all ranges, removal, team filter, mobile and desktop passed');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
