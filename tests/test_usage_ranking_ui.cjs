const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end('{}')}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});await page.evaluate(()=>document.querySelector('.tabs [data-tab=usage]').click());await page.locator('#usRanking tbody tr').first().waitFor();
async function order(){const values=await page.locator('#usRanking tbody tr td:nth-child(3) strong').allTextContents();let prev=Infinity,missing=false;for(const v of values){if(v==='—'){missing=true;continue}assert(!missing);const n=parseFloat(v);assert(n<=prev);prev=n;}}
await order();const total=await page.locator('#usRanking tbody tr').count();assert(total>100);
await page.selectOption('#usPosition','G');assert(await page.locator('#usRanking tbody tr').count()<total);assert((await page.locator('#usRanking tbody tr td:nth-child(2) small').allTextContents()).every(t=>t.includes(' · G')));await order();
await page.locator('[data-us-scope=team]').click();assert(await page.locator('#usTeam').isVisible());const team=await page.locator('#usTeam').inputValue();assert((await page.locator('#usRanking tbody tr td:nth-child(2) small').allTextContents()).every(t=>t.startsWith(team+' · G')));await order();
await page.selectOption('#usPosition','');await page.selectOption('#usRange','0');await page.locator('[data-us-metric=combined]').click();await order();
const row=page.locator('#usRanking tbody tr').nth(1),id=await row.getAttribute('data-us-row'),text=await row.locator('button').textContent();await row.locator('button').click();assert.equal(await page.locator('#usPlayer').inputValue(),id);assert((await page.locator('#usResult .us-score').textContent()).includes(text));assert.equal(await page.locator('#usRanking .us-selected').getAttribute('data-us-row'),id);
await page.locator('[data-us-scope=all]').click();await order();
for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'page overflow '+width);assert(await page.locator('.us-ranking-wrap').evaluate(el=>el.scrollWidth<=el.clientWidth+2),'table overflow '+width);}
await page.setViewportSize({width:390,height:844});await page.locator('#usage').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/usage-ranking.png',fullPage:false});
await page.locator('#themeToggle').click();await order();assert.deepEqual(errors,[]);console.log('PASS: actual league data, descending ranks, team and position filters, ranges, combined metric, player selection, themes, 320/390/1280px no overflow');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
