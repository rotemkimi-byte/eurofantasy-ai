// Browser regression: league-first navigation, chart values, ranges, selection and missing PIR.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),C=require('../team-metrics-core.js');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/official-offense.json'))),report=C.build(data);
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end('{}');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.querySelector('.tabs [data-tab=teamMetrics]').click());
 await page.locator('#tmStandings .tm-identities tbody tr').first().waitFor();
 assert.equal(await page.locator('#tmStandings .tm-identities tbody tr').count(),report.teams.length);assert(await page.locator('#tmLeagueView').isVisible());assert(!(await page.locator('#tmDetail').isVisible()));

 // Horizontal scrolling must move only metrics; names/ranks stay outside the scroller.
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:844});
  const geometry=()=>page.evaluate(()=>({identity:[...document.querySelectorAll('.tm-identities tbody tr')].map(tr=>({cells:[...tr.cells].map(c=>({x:c.getBoundingClientRect().x,width:c.getBoundingClientRect().width})),y:tr.getBoundingClientRect().y,height:tr.getBoundingClientRect().height})),values:[...document.querySelectorAll('.tm-league-values tbody tr')].map(tr=>({y:tr.getBoundingClientRect().y,height:tr.getBoundingClientRect().height})),scroll:document.querySelector('.tm-metrics-scroll').scrollLeft}));
  const before=await geometry();await page.locator('.tm-metrics-scroll').evaluate(el=>el.scrollLeft=-300);const after=await geometry();
  assert.deepEqual(after.identity,before.identity,'identity shifted at '+width);
  before.identity.forEach((r,i)=>{assert(Math.abs(r.y-before.values[i].y)<1,'row offset');assert.equal(r.height,before.values[i].height);});
  if(width<600)assert.notEqual(after.scroll,before.scroll,'metrics did not scroll');
  await page.locator('.tm-metrics-scroll').evaluate(el=>el.scrollLeft=0);
 }
 await page.setViewportSize({width:390,height:844});
 const team=report.teams[2];await page.locator('#tmStandings .tm-identities tbody tr').nth(2).locator('button').click();
 assert(await page.locator('#tmDetail').isVisible());assert(!(await page.locator('#tmLeagueView').isVisible()));assert.equal(await page.locator('#tmTeamTitle').textContent(),team.team);
 assert.equal(await page.locator('#tmChart g[role=button]').count(),team.games.length);
 const latest=team.games[0];assert((await page.locator('#tmGameInsight').textContent()).includes(String(latest.points)));
 assert.deepEqual(await page.locator('#tmChart .tm-dot-own').evaluateAll(nodes=>nodes.map(n=>Number(n.nextElementSibling.textContent))),[...team.games].reverse().map(g=>g.points));
 await page.locator('[data-tm-metric=difference]').click();assert.deepEqual(await page.locator('#tmChart .tm-value').allTextContents(),[...team.games].reverse().map(g=>(g.points>g.against?'+':'')+(g.points-g.against)));
 await page.selectOption('#tmRange','5');assert.equal(await page.locator('#tmChart g[role=button]').count(),Math.min(5,team.games.length));
 await page.selectOption('#tmRange','home');assert.equal(await page.locator('#tmChart g[role=button]').count(),team.games.filter(g=>g.home).length);
 await page.locator('#tmChart g[role=button]').first().click();const firstHome=[...team.games].reverse().find(g=>g.home);assert.equal(await page.locator('#tmGame').inputValue(),String(firstHome.code));assert((await page.locator('#tmGameInsight').textContent()).includes(firstHome.opponent));
 await page.selectOption('#tmRange','all');await page.locator('#tmChart g[role=button]').first().focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#tmGame').inputValue(),String(team.games.at(-1).code));
 await page.locator('[data-tm-metric=pir]').click();assert.equal(await page.locator('#tmChart .tm-dot-own').count(),team.games.filter(g=>g.pir!==null).length);
 await page.selectOption('#tmTeam',report.teams[4].team);assert.equal(await page.locator('#tmTeamTitle').textContent(),report.teams[4].team);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),'page overflow at '+width);}
 await page.setViewportSize({width:390,height:844});if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'team-metrics-chart.png'),fullPage:true});
 await page.locator('#tmBack').click();assert(await page.locator('#tmLeagueView').isVisible());if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'team-metrics-table.png'),fullPage:true});
 await page.locator('#themeToggle').click();await page.locator('#tmStandings button').first().click();assert(await page.locator('#tmChart svg').isVisible());if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'team-metrics-dark.png'),fullPage:true});
 // A refresh with absent reports preserves score history without inventing zero PIR.
 await page.route('**/data/official-offense.json*',r=>r.fulfill({json:{...data,teamGames:{}}}));await page.locator('#tmReload').click();await page.getByText('אין נתוני PIR זמינים למשחקים בטווח הזה. אפשר לעבור לגרף הנקודות.').waitFor();assert.equal(await page.locator('#tmChart .tm-dot-own').count(),0);
 await page.locator('[data-tm-metric=points]').click();assert.equal(await page.locator('#tmChart .tm-dot-own').count(),report.teams[0].games.length);
 await page.route('**/data/official-offense.json*',r=>r.fulfill({status:503,body:'{}'}));await page.locator('#tmReload').click();await page.getByText('הרענון נכשל; מוצגים הנתונים הקודמים.').waitFor();assert(await page.locator('#tmChart svg').isVisible());assert.deepEqual(errors,[]);
 console.log('PASS: league first, team drilldown, exact point/difference charts, PIR, filters, pointer/keyboard game selection, team switching, 320/390/1280px, themes, missing PIR and refresh failure.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
