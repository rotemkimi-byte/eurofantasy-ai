const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('{}');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
await page.locator('[data-ef-group=players]').click();await page.locator('#efHome [data-ef-tool=pirGraph]').click();assert.equal(await page.locator('[data-pir-mode=pir]').getAttribute('aria-pressed'),'true');
await page.locator('#pirChart svg').waitFor({timeout:90000});
const player=await page.locator('#pirPerson').inputValue();
for(const [mode,label] of [['minutes','דקות למשחק'],['credit','קרדיט לפי מחזור'],['mixed','PIR ודקות למשחק']]){
 await page.locator(`[data-pir-mode=${mode}]`).click();
 await page.locator(`#pirChart svg[aria-label="${label}"]`).waitFor();
 assert.equal(await page.locator('#pirPerson').inputValue(),player);
}
assert(await page.locator('#pirLegend').isVisible());
assert(await page.locator('#pirChart .pirPointValue.pirValue').count());
assert(await page.locator('#pirChart .pirPointValue.minutesValue').count());
const [axisLabel,...minuteTicks]=await page.locator('.pirFixedAxis.minutesValue text').allTextContents();
assert.equal(axisLabel,'דקות');
assert.equal(minuteTicks[0],'0');
assert(minuteTicks.every((tick,i)=>i===0||Number(tick)>Number(minuteTicks[i-1])));
assert.equal(await page.locator('.pirRoundAxis').textContent(),'מחזור יורוליג');
await page.locator('[data-pir-mode=compare]').click();
await page.locator('#pirCompare [data-add]').first().waitFor({timeout:90000});
await page.locator('#pirCompare [data-add]').nth(0).click();await page.locator('#pirCompare [data-add]').nth(1).click();
assert.equal(await page.locator('.pc-card').count(),2);
for(const range of ['1','3','0']){await page.selectOption('#pirCompare [data-range]',range);const actual=await page.locator('.pc-value').allTextContents();const expected=await page.evaluate(range=>[...document.querySelectorAll('#pirCompare [data-remove]')].map(b=>{const games=window.PIRHistoryUI.getData().players.get(b.dataset.remove).games;const rows=range==='0'?games:games.slice(-Number(range));const v=rows.filter(g=>!g.dnp&&g.value!==null).map(g=>g.value);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):'—';}),range);assert.deepEqual(actual,expected);}
for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),'overflow '+width);}
await page.locator('#pirCompare [data-remove]').first().click();assert.equal(await page.locator('.pc-card').count(),1);
assert.equal(await page.locator('#pirCompare input[type=search]').count(),0);
await page.locator('#pirCompare [data-scope=team]').click();assert.equal(await page.locator('#pirCompare [data-add]').count(),0);
assert.deepEqual(errors,[]);console.log('PIR comparison navigation, selection, all ranges, removal, team filter, mobile and desktop passed');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
