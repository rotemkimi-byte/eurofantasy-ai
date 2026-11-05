const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('{}');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
await page.locator('[data-ef-group=players]').click();await page.locator('#efHome [data-ef-tool=pirCompare]').click();
await page.locator('#pirCompare [data-add]').first().waitFor({timeout:90000});
await page.locator('#pirCompare [data-add]').nth(0).click();await page.locator('#pirCompare [data-add]').nth(1).click();
assert.equal(await page.locator('.pc-card').count(),2);
for(const range of ['1','3','0']){await page.selectOption('#pirCompare [data-range]',range);const actual=await page.locator('.pc-value').allTextContents();const expected=await page.evaluate(range=>[...document.querySelectorAll('#pirCompare [data-remove]')].map(b=>{const games=window.PIRHistoryUI.getData().players.get(b.dataset.remove).games;const rows=range==='0'?games:games.slice(-Number(range));const v=rows.filter(g=>!g.dnp&&g.value!==null).map(g=>g.value);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):'—';}),range);assert.deepEqual(actual,expected);}
for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),'overflow '+width);}
await page.locator('#pirCompare [data-remove]').first().click();assert.equal(await page.locator('.pc-card').count(),1);
await page.fill('#pirCompare [data-search]','zzzz-not-found');assert.equal(await page.locator('#pirCompare [data-add]').count(),0);
assert.deepEqual(errors,[]);console.log('PIR comparison navigation, selection, all ranges, removal, search, mobile and desktop passed');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
