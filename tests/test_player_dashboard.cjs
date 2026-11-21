// Run with NODE_PATH pointing to Playwright and optional CHROMIUM_PATH.
const {chromium,webkit,devices}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]);const p=path.join(root,rel==='/'?'index.html':rel);try{res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end('{}');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=process.env.TEST_WEBKIT==='1'?await webkit.launch():await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});try{
const page=await browser.newPage({...devices['iPhone 15'],viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
// Load downloaded official images in isolated test environments; otherwise exercise real URLs.
if(process.env.MEDIA_FIXTURE){const m=JSON.parse(fs.readFileSync(path.join(root,'data/player-media.json'))).players;for(const [key,prefix] of [['bryant elijah','bryant'],['sasha vezenkov','sasha']])for(const field of ['photo','crest']){const file=`${process.env.MEDIA_FIXTURE}/ef-${prefix}-${field}.png`;if(m[key]?.[field]&&fs.existsSync(file))await page.route(m[key][field],r=>r.fulfill({path:file,contentType:'image/png'}));}}
await page.goto(process.env.EF_TEST_URL||`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
async function open(name){await page.evaluate(n=>window.showPlayer(n),name);await page.locator('.ef-overview-data .ef-game-card').first().waitFor();}
await open('Elijah Bryant');assert.equal(await page.locator('[role=tab][data-player-tab]').count(),4);
await page.locator('.ef-credit-chart [data-credit-point]').nth(1).waitFor();
for(const [container,point] of [
 ['.ef-overview-data .ef-trend-scroll','.pirPoint'],
 ['.ef-market-credits .ef-trend-scroll','[data-credit-point]'],
 ['.ef-player-free-throws .ef-trend-scroll','.ef-ft-point'],
]){
 const scroll=page.locator(container);
 assert(await scroll.evaluate((el,selector)=>{
  const last=[...el.querySelectorAll(selector)].at(-1).getBoundingClientRect(),box=el.getBoundingClientRect();
  return el.scrollWidth>el.clientWidth&&el.scrollLeft===0&&last.left>=box.left&&last.right<=box.right;
 },point),container+' starts with its newest point visible');
 assert(await scroll.evaluate(el=>{el.scrollLeft=-el.scrollWidth;return el.scrollLeft<0;}));
}
assert.equal(await page.locator('[data-player-trend]').count(),0);
const gameDetail=page.locator('.ef-chart-detail');
assert.equal(await gameDetail.locator('dl>div').count(),2);
assert.equal(await gameDetail.locator('time').count(),1);
assert.equal(await gameDetail.locator('.pirGameVenue').count(),1);
assert.equal(await page.locator('.ef-ft-detail dl>div').count(),3);
assert.match(await page.locator('.ef-credit-detail dd').first().textContent(),/^[0-9]/);
const source=JSON.parse(fs.readFileSync(path.join(root,'data/official-offense.json'))),U=require('../usage-core.js');const season=U.selectGames(source.players['bryant elijah'],'0'),stats=U.summarize(season);
assert.equal(await page.locator('[data-range="0"]').getAttribute('aria-pressed'),'true');
assert.equal(await page.locator('[data-player-venue="all"]').getAttribute('aria-pressed'),'true');
const pirLabels=()=>page.locator('.ef-player-history .ef-pir-value').allTextContents();
const expectedLabels=games=>games.filter(g=>g.minutes>0&&U.num(g.stats?.valuation)!==null)
 .map(g=>String(U.num(g.stats.valuation))).reverse();
assert.deepEqual(await pirLabels(),expectedLabels(season));
assert.equal(await page.locator('.ef-usage-preview strong').first().textContent(),stats.regular.value.toFixed(1)+'%');
for(const [venue,home] of [['home',true],['away',false]]){
 const games=season.filter(g=>g.home===home);
 const played=games.filter(g=>g.minutes>0&&U.num(g.stats?.valuation)!==null);
 await page.locator(`[data-player-venue="${venue}"]`).click();
 assert.equal(await page.locator('.ef-player-history .pirPoint').count(),played.length);
 assert.deepEqual(await pirLabels(),expectedLabels(games));
 assert.equal(await page.locator('.ef-player-stats dd').nth(1).textContent(),(played.reduce((s,g)=>s+g.stats.valuation,0)/played.length).toFixed(1));
 await page.locator('[data-player-tab="games"]').click();
 assert.equal(await page.locator('#efPane-games .ef-game-card').count(),games.length);
 await page.locator('[data-player-tab="overview"]').click();
}
await page.locator('[data-range="3"]').click();
assert.equal(await page.locator('.ef-player-history .pirPoint').count(),season.filter(g=>g.home===false).slice(0,3).filter(g=>g.minutes>0&&U.num(g.stats?.valuation)!==null).length);
await page.locator('[data-player-venue="all"]').click();
for(const id of ['usage','defense','games','overview']){await page.locator(`[data-player-tab=${id}]`).click();assert.equal(await page.locator('.ef-player-pane:visible').count(),1);assert(await page.locator('#efPane-'+id).isVisible());}
for(const range of ['1','3','0']){await page.locator(`[data-range="${range}"]`).click();const expected=U.selectGames(source.players['bryant elijah'],range).filter(g=>g.minutes>0&&g.stats.valuation!==null).length;assert.equal(await page.locator('.ef-player-history .pirPoint').count(),expected);}
await page.locator('[data-range="3"]').click();
const latest=await gameDetail.locator('time').getAttribute('datetime');
await page.locator('.ef-overview-data [data-game-index]').first().press('Enter');
assert.notEqual(await gameDetail.locator('time').getAttribute('datetime'),latest);
assert.match(await gameDetail.textContent(),/PIR/);
assert(!(await page.evaluate(()=>document.getElementById('playerModal').scrollWidth>document.getElementById('playerModal').clientWidth+2)));
// Mobile player view fills the viewport, keeps four metrics in two balanced rows, and closes accessibly.
for(const width of [320,390,650]){
 await page.setViewportSize({width,height:844});
 const layout=await page.evaluate(()=>{const modal=document.getElementById('playerModal'),r=modal.getBoundingClientRect(),stats=[...document.querySelectorAll('.ef-player-stats .pa-metrics > div')].map(el=>el.getBoundingClientRect());return {x:r.x,y:r.y,width:r.width,height:r.height,overflow:modal.scrollWidth>modal.clientWidth+2,rows:stats.map(r=>r.y)};});
 assert.equal(layout.x,0);assert.equal(layout.y,0);assert.equal(layout.width,width);assert(Math.abs(layout.height-844)<1);assert.equal(layout.overflow,false);assert.equal(layout.rows.length,4);assert.equal(layout.rows[0],layout.rows[1]);assert.equal(layout.rows[2],layout.rows[3]);assert(layout.rows[2]>layout.rows[0]);
}
await page.setViewportSize({width:390,height:844});
assert.match(await page.locator('#playerModal .close').textContent(),/חזרה/);

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
