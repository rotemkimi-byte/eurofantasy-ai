'use strict';
const fs=require('node:fs');
const D=require('../position-defense-core.js'),P=require('../personal-model-core.js');
const data=D.build(require('../data/official-offense.json'),P);
const {rows,...output}=data;
if(!rows.length)throw Error('No completed E2026 observations; refusing to overwrite defense');
fs.writeFileSync('data/position-matchups.json',JSON.stringify(output,null,2)+'\n');
console.log(`E2026 position defense: ${output.gamesUsed} games, ${rows.length} appearances`);
