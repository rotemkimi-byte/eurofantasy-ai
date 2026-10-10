const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const extension=require('../matchup-context-core.js');
(async()=>{
 const data=JSON.parse(fs.readFileSync('data/matchup-context.json'));
 const players=JSON.parse(fs.readFileSync('data/players.json'));
 const matches=JSON.parse(fs.readFileSync('data/matchups.json')).matchups;
 const games=Object.entries(matches).filter(([,m])=>m.home).map(([home,m])=>({home,away:m.opponent,total:m.total,homeMargin:m.margin}));
 const sections=[],cards=games.map(()=>({appendChild:x=>sections.push(x)}));let modal=[];
 const help={textContent:''};let ready=false;
 const sandbox={console,MatchupContext:extension,players,MATCHUPS:matches,GAMES:games,
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
 console.log('Browser integration VM: load ordering, player dialog and team detail content passed');
})();
