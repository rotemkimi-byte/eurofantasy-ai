'use strict';
const {chromium,webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const rel=new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html');
 const file=path.join(root,rel);
 fs.readFile(file,(error,body)=>error?res.writeHead(404).end():res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(body));
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=process.env.EF_TEST_URL||'http://127.0.0.1:'+server.address().port;
 const proxy=process.env.EF_TEST_PROXY?{server:process.env.EF_TEST_PROXY,bypass:'localhost,127.0.0.1'}:undefined;
 const browser=process.env.TEST_WEBKIT==='1'?await webkit.launch({proxy}):await chromium.launch({proxy,executablePath:process.env.CHROMIUM_PATH});
 try{
  const page=await browser.newPage({...devices['iPhone 15'],ignoreHTTPSErrors:!!proxy});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(address,{waitUntil:'domcontentloaded'});
  const open=tab=>page.locator('.tabs [data-tab="'+tab+'"]').evaluate(el=>el.click());
  await open('playerMatchups');
  assert.equal(await page.locator('#pmView option[value=list]').textContent(),'רשימה');
  await page.locator('#pmView').selectOption('list');
  await page.locator('#pmCourts .pmListPrices').first().waitFor();

  const past=page.locator('[data-pm-mode=history]');
  const upcoming=page.locator('[data-pm-mode=upcoming]');
  await past.click();
  const game=page.locator('#pmHistoryGame'),history=page.locator('#pmHistoryResult');
  const lineups=history.locator('.pmHistoryLineup');
  await lineups.nth(1).waitFor();
  const code=await game.inputValue();
  const box=await page.evaluate(code=>fetch('./data/backtest/cache/E2026-'+code+'-stats.json').then(r=>r.json()),code);
  const played=[...box.local.players,...box.road.players].filter(row=>row.stats.timePlayed>0);
  assert.equal(await lineups.first().locator('.pmHistoryPlayer').count(),played.filter(row=>row.stats.startFive===true).length);
  assert.equal(await lineups.nth(1).locator('.pmHistoryPlayer').count(),played.filter(row=>row.stats.startFive!==true).length);
  assert.equal(await history.locator('.pmHistoryTeam.is-winner').count(),1);
  assert.equal(await history.locator('.pmHistoryTeam img').count(),2);
  assert(await lineups.first().locator('.pmHistoryPhoto img').count()>0);
  const pair=lineups.first().locator('.pmHistoryPair').filter({has:page.locator('.pmHistoryPerformance')}).first();
  await pair.locator('summary').click();
  assert(await pair.locator('table').isVisible());
  const compared=await pair.locator('.pmHistoryPlayer').evaluateAll(nodes=>nodes.map(el=>({
   tone:el.dataset.pirTone,pir:Number(el.querySelector('.pmHistoryNumbers bdi').textContent)
  })));
  assert.equal(compared.length,2);
  for(const [i,player] of compared.entries()){
   const other=compared[1-i];
   assert.equal(player.tone,player.pir===other.pir?'neutral':player.pir>other.pir?'leading':'trailing');
  }
  await page.setViewportSize({width:320,height:740});
  for(const theme of ['light','dark']){
   await page.locator('html').evaluate((el,value)=>el.dataset.theme=value,theme);
   assert(await pair.evaluate(el=>el.scrollWidth<=el.clientWidth+2));
   assert(await pair.locator('.pmHistoryName').evaluateAll(names=>names.every(el=>el.scrollWidth<=el.clientWidth+1)));
  }
  await page.setViewportSize({width:393,height:852});
  const previousScore=await history.locator('.pmHistoryScore').textContent();
  await game.selectOption({index:1});
  await lineups.first().waitFor();
  assert.notEqual(await history.locator('.pmHistoryScore').textContent(),previousScore);
  await upcoming.click();
  assert(await page.locator('#pmUpcoming').isVisible());
  assert.equal(await page.locator('#pmView').inputValue(),'list');
  assert(!(await page.locator('#pmHistory').isVisible()));

  await open('market');
  await page.waitForFunction(()=>window.SquadRoster?.current());
  const current=await page.evaluate(()=>myTeam.filter(name=>players.some(p=>p.name===name)));
  assert(current.length>0);
  const cards=page.locator('#marketReferenceCards .marketRefItem');
  for(const name of current){
   const card=cards.filter({has:page.locator('[data-market-player="'+name+'"]')});
   if(await card.count())assert.equal(await card.locator('[data-market-toggle]').count(),0);
  }
  const add=cards.locator('[data-market-toggle]').first();
  const added=await add.getAttribute('data-market-toggle');
  await add.click();
  assert(await page.evaluate(name=>isSelected({name}),added));
  assert.equal(await cards.locator('[data-market-toggle="'+added+'"]').count(),0);
  await open('team');
  const manage=page.locator('#teamCards .squadRosterTools');
  await manage.locator(':scope > summary').click();
  const remove=manage.locator('[data-remove="'+added+'"]');
  await remove.locator('..').locator('summary').click();
  await remove.click();
  assert(!(await page.evaluate(name=>isSelected({name}),added)));
  assert.deepEqual(await page.evaluate(()=>myTeam.filter(name=>players.some(p=>p.name===name))),current);
  const response=page.waitForResponse(r=>r.url().includes('/data/roster.json?'));
  await page.locator('#refreshSquad').click();
  assert((await response).ok());
  assert.deepEqual(await page.evaluate(()=>myTeam.filter(name=>players.some(p=>p.name===name))),current);
  assert.deepEqual(errors,[]);
  console.log('PASS: matchup navigation and official lineups, PIR comparison, 320px in both themes, market add, squad removal and live roster refresh.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
