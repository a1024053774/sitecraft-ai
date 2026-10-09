import assert from 'node:assert/strict';
const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3138';
const response = await fetch(`${base}/api/sites`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'T128 contract' }),
});
assert.equal(response.status, 201);
const site = await response.json();
assert.equal(site.codeSite?.route, 'code', 'new sites must expose the persisted code route');
assert.equal(site.codeSite.versions.length, 0, 'creation must not bypass the checked commit boundary');
console.log(JSON.stringify({ status: 'PASS', siteId: site.id, acceptance: 'new site starts on the code route without an unchecked version' }));
