const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const extension=require('../matchup-context-core.js');
const index=fs.readFileSync('index.html','utf8');
const canonicalTeam=new Function('team','const normName=s=>String(s).toLowerCase();'+index.match(/function canonicalTeam\(team\)\{([\s\S]*?)\n\}/)[1]);
(async()=>{
 const data=JSON.parse(fs.readFileSync('data/matchup-context.json'));
 const players=JSON.parse(fs.readFileSync('data/players.json'));
 const matches=JSON.parse(fs.readFileSync('data/matchups.json')).matchups;
 const games=Object.entries(matches).filter(([,m])=>m.home).map(([home,m])=>({home,away:m.opponent,total:m.total,homeMargin:m.margin}));
 const sections=[],cards=games.map(()=>({appendChild:x=>sections.push(x)}));let modal=[];
 const help={textContent:''};let ready=false;
 const sandbox={console,canonicalTeam,MatchupContext:extension,players,MATCHUPS:matches,GAMES:games,
 window:{MatchupContext:extension,__stabilityModelPatched:true,__learningReady:false,showPlayer:()=>{modal=[];}},
 fetch:async()=>({ok:true,json:async()=>data}),
 document:{getElementById:id=>id==='modalBody'?{appendChild:x=>modal.push(x)}:null,createElement:()=>({innerHTML:'',className:''}),querySelectorAll:()=>cards,querySelector:()=>help},
 renderGames:()=>{},renderAll:()=>sandbox.renderGames(),setTimeout,
 model:p=>({expected:20,minutes:24,floor:9,ceiling:30,source:'test',match:matches[p.team]||{opponent:p.opponent,margin:0,winProb:.5}})};
 vm.createContext(sandbox);await vm.runInContext(fs.readFileSync('matchup-context.js','utf8'),sandbox);
 assert.ok(sandbox.window.__matchupContextReady);assert.ok(help.textContent.includes('אינם יחסי סוכנויות'));
 sandbox.window.showPlayer('Sasha Vezenkov');assert.equal(modal.length,1);
 assert.ok(modal[0].innerHTML.includes('מעורבות בהתקפה'));
 assert.ok(modal[0].innerHTML.includes('תרחישי דקות'));
 assert.ok(!modal[0].innerHTML.includes('NaN'));assert.ok(!modal[0].innerHTML.includes('undefined'));
 assert.ok(sections.some(s=>s.innerHTML.includes('ממתין למדגם מאומת')));
 // Context arriving first must survive the independent, later matchup fetch.
 const rawMatches=JSON.parse(fs.readFileSync('data/matchups.json')).matchups;
 sandbox.fetch=async()=>({ok:true,json:async()=>({matchups:JSON.parse(JSON.stringify(rawMatches)),games})});
 await vm.runInContext(fs.readFileSync('matchup-live.js','utf8'),sandbox);
 assert.equal(matches.Olympiacos.winProb,data.teams.Olympiacos.winProb);
 assert.ok(matches.Olympiacos.context);
 // The regular live refresh also replaces the whole map; adjustment must follow it.
 sandbox.LS={players:'players',team:'team'};sandbox.myTeam=[];
 sandbox.localStorage={setItem(){}};sandbox.setInterval=()=>{};sandbox.Event=Event;
 sandbox.window.addEventListener=()=>{};sandbox.document.addEventListener=()=>{};sandbox.document.dispatchEvent=()=>{};
 sandbox.fetch=async url=>({ok:true,json:async()=>url.includes('players.json')?players:url.includes('matchup-context.json')?data:url.includes('meta.json')?{}:{matchups:JSON.parse(JSON.stringify(rawMatches)),games}});
 vm.runInContext(fs.readFileSync('live.js','utf8'),sandbox);
 await sandbox.window.refreshFantasyLive();
 assert.equal(matches.Olympiacos.winProb,data.teams.Olympiacos.winProb);
 assert.ok(matches.Olympiacos.context);
 console.log('Browser integration VM: both load orders, periodic live refresh and team details passed');
})();
