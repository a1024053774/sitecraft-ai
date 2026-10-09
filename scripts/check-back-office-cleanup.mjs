import assert from 'node:assert/strict';
const base=process.env.SITECRAFT_BASE||'http://127.0.0.1:3034';
for(const path of ['/','/sites','/settings']){const response=await fetch(base+path);assert.equal(response.status,200,path);assert.doesNotMatch(await response.text(),/Forge Industrial|lydia@sitecraft|Keller Automation/)}
console.log('Current dashboard, site list and settings contain no seeded company content.');
