'use strict';
const assert=require('node:assert/strict');
const {audit}=require('../scripts/audit_player_identities.cjs');
const record={key:'new player',euroleagueId:'099999',fantasyId:99999,officialName:'NEW, PLAYER',displayName:'New Player',aliases:['NEW, PLAYER','New Player'],teamHistory:[{gameCode:901,team:'Paris'}]};
const options={registry:{season:'E2026',players:[record]},market:[{name:'New Player',fantasy_id:99999,pos:'G',status:'active'}],official:{season:'E2026',players:{},teamGames:{}},recent:{season:'E2026',players:{}},media:{season:'E2026',players:{}},advanced:{season:'E2026',games:{}}};
const box=stats=>({local:{players:[{player:{person:{code:'099999',name:'NEW, PLAYER'}},stats}]},road:{players:[]}});
// New raw observations may precede the official derived refresh.
let report=audit({...options,boxes:{901:box({timePlayed:120,valuation:2})}});
assert.equal(report.ok,true);assert(report.warnings.some(w=>w.kind==='official-profile-pending'));assert.equal(report.players[0].partial,true);assert.equal(report.players[0].games,0);
// A registered DNP without numeric minutes is not a missing played profile.
const covered={...options.official,teamGames:{901:{}}};
report=audit({...options,official:covered,boxes:{901:box({timePlayed:null,valuation:null})}});assert.equal(report.ok,true);
// Once the derived source covers numeric observations, omission is corruption.
for(const timePlayed of [0,120]){
 report=audit({...options,official:covered,boxes:{901:box({timePlayed,valuation:2})}});
 assert.equal(report.ok,false);assert(report.errors.some(e=>e.kind==='linked-without-official-data'));
}
// No source evidence or a different official ID must never become a warning.
for(const boxes of [{},{901:{local:{players:[]},road:{players:[]}}}])assert.equal(audit({...options,boxes}).ok,false);
const wrongName=box({timePlayed:null});wrongName.local.players[0].player.person.name='Different Player';assert.equal(audit({...options,boxes:{901:wrongName}}).ok,false);
console.log('PASS: delayed derived profiles and DNP stay partial; missing observed profiles and unsupported IDs block publication');
