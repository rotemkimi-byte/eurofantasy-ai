// Run with NODE_PATH pointing to Playwright and optional CHROMIUM_PATH.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]);const p=path.join(root,rel==='/'?'index.html':rel);try{res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end('{}');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
// Load downloaded official images in isolated test environments; otherwise exercise real URLs.
if(process.env.MEDIA_FIXTURE){const m=JSON.parse(fs.readFileSync(path.join(root,'data/player-media.json'))).players;for(const [key,prefix] of [['bryant elijah','bryant'],['sasha vezenkov','sasha']])for(const field of ['photo','crest']){const file=`${process.env.MEDIA_FIXTURE}/ef-${prefix}-${field}.png`;if(m[key]?.[field]&&fs.existsSync(file))await page.route(m[key][field],r=>r.fulfill({path:file,contentType:'image/png'}));}}
await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle'});
async function open(name){await page.evaluate(n=>window.showPlayer(n),name);await page.locator('.ef-overview-data .ef-game-card').first().waitFor();}
await open('Elijah Bryant');assert.equal(await page.locator('[role=tab][data-player-tab]').count(),4);
const source=JSON.parse(fs.readFileSync(path.join(root,'data/official-offense.json'))),U=require('../usage-core.js');const stats=U.summarize(U.selectGames(source.players['bryant elijah'],'5'));
assert.equal(await page.locator('.ef-usage-preview strong').first().textContent(),stats.regular.value.toFixed(1)+'%');
for(const id of ['usage','defense','games','overview']){await page.locator(`[data-player-tab=${id}]`).click();assert.equal(await page.locator('.ef-player-pane:visible').count(),1);assert(await page.locator('#efPane-'+id).isVisible());}
for(const range of ['1','3','0']){await page.locator(`[data-range="${range}"]`).click();const expected=U.selectGames(source.players['bryant elijah'],range).filter(g=>g.minutes>0&&g.stats.valuation!==null).length;assert.equal(await page.locator('.ef-player-history .pirPoint').count(),expected);}
await page.locator('[data-range="3"]').click();await page.locator('.pirPoint').first().click();assert((await page.locator('.ef-chart-detail').textContent()).includes('PIR'));
assert(!(await page.evaluate(()=>document.getElementById('playerModal').scrollWidth>document.getElementById('playerModal').clientWidth+2)));
// Mobile player view fills the viewport, keeps four metrics in one row, and closes accessibly.
for(const width of [320,390,650]){
 await page.setViewportSize({width,height:844});
 const layout=await page.evaluate(()=>{const modal=document.getElementById('playerModal'),r=modal.getBoundingClientRect(),stats=[...document.querySelectorAll('.ef-player-stats>div')].map(el=>el.getBoundingClientRect());return {x:r.x,y:r.y,width:r.width,height:r.height,overflow:modal.scrollWidth>modal.clientWidth+2,rows:stats.map(r=>r.y)};});
 assert.equal(layout.x,0);assert.equal(layout.y,0);assert.equal(layout.width,width);assert.equal(layout.height,844);assert.equal(layout.overflow,false);assert(layout.rows.every(y=>y===layout.rows[0]));
}
await page.setViewportSize({width:390,height:844});
assert.equal(await page.locator('#playerModal .close').getAttribute('aria-label'),'סגור כרטיס שחקן');

if(process.env.MEDIA_FIXTURE)await page.locator('.ef-player-avatar img').waitFor();
if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'player-dashboard-mobile.png')});
await page.locator('#playerModal .close').click();await page.locator('#themeToggle').click();await open('Sasha Vezenkov');await page.locator('[data-player-tab=defense]').click();if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'player-defense-dark.png')});
// Rapid player switching cannot paint an earlier player's identity into the next card.
await page.evaluate(()=>{showPlayer('Elijah Bryant');showPlayer('Sasha Vezenkov');});await page.locator('.ef-overview-data .ef-game-card').first().waitFor();assert((await page.locator('.ef-player-identity h2').textContent()).includes('Vezenkov'));
await page.setViewportSize({width:1280,height:900});if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'player-dashboard-desktop.png')});assert.deepEqual(errors,[]);
// Broken photos retain initials; failed data gets an explicit message.
const fresh=await browser.newPage();await fresh.route('**/data/official-offense.json*',r=>r.fulfill({status:503,body:'{}'}));await fresh.route('https://media-cdn.**/*',r=>r.abort());await fresh.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle'});await fresh.evaluate(()=>showPlayer('Elijah Bryant'));await fresh.getByText('לא ניתן לטעון את הנתונים כרגע. סגור ופתח את השחקן כדי לנסות שוב.').waitFor();assert.equal(await fresh.locator('.ef-player-avatar').textContent(),'EB');
console.log('PASS: 4 tabs, shared ranges, exact Usage, PIR history, mobile/desktop, dark theme, image fallback, fetch failure and rapid switching.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
