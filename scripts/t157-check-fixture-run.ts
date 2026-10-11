import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { localEndpoint } from './local-endpoint.ts';
import type { EvalRound } from './eval-set-report.ts';
import type { CodeSiteRecord } from '../lib/code-site.ts';

const base = localEndpoint('SITECRAFT_BASE').origin;
const { values } = parseArgs({ options: { round: { type: 'string' }, provider: { type: 'string' } } });
assert.ok(values.round && values.provider, 'Set --round and --provider to this run artifacts');
const directory = path.resolve(values.round);
const round: EvalRound = JSON.parse(await readFile(path.join(directory, 'private/round.json'), 'utf8'));
assert.equal(round.base, base);
assert.deepEqual(round.cases.map(c => c.key), ['restaurant/documentary', 'education/documentary', 'design/documentary']);
const requests = JSON.parse(await readFile(path.resolve(values.provider, 'requests.json'), 'utf8')) as Array<{ purpose: string; body: { messages: Array<{ content: string }> } }>;
const expectedPages = [['home', 'menu'], ['home', 'courses'], ['home', 'work']];
const evidence: unknown[] = [];
for (const [index, item] of round.cases.entries()) {
  assert.equal(item.outcome, 'generated', `${item.key}: ${item.error || item.outcome}`);
  assert.equal(item.attempts.length, 1, 'The local fixture must pass without repair');
  assert.equal(item.attempts[0].checks.passed, true);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'private', `case-${index + 1}`, 'uploads.json'), 'utf8')), [], 'No unlicensed photos may be uploaded');
  assert.ok(item.attempts[0].checks.viewports.length >= 6, 'Both pages need three viewport checks');
  const company = item.materials.match(/^公司名：([^\n]+)/m)![1];
  for (const purpose of ['plan', 'write']) {
    const found = requests.filter(req => req.purpose === purpose && req.body.messages[1].content.includes(`公司名：${company}\n`));
    assert.equal(found.length, 1, `${item.key}: one ${purpose} request`);
    assert.ok(found[0].body.messages[1].content.includes(item.materials), `${item.key}: complete material must reach ${purpose}`);
    for (const other of round.cases.filter(c => c !== item)) {
      const otherName = other.materials.match(/^公司名：([^\n]+)/m)![1];
      assert.ok(!found[0].body.messages[1].content.includes(`公司名：${otherName}`), 'Company material must stay separate');
    }
  }
  const response = await fetch(`${base}/api/sites/${item.siteId}/draft`);
  assert.equal(response.status, 200);
  const site: CodeSiteRecord = (await response.json()).codeSite;
  assert.equal(site.versions.length, 1);
  assert.equal(site.currentVersionId, item.versionId);
  assert.ok(site.materials.includes(item.materials));
  assert.deepEqual(site.versions[0].code.pages.map(page => page.id), expectedPages[index]);
  for (const page of item.pages) for (const width of ['1440', '768', '375']) {
    assert.ok(page.screenshots[width], `${item.key}/${page.id}: missing ${width} screenshot`);
    await readFile(path.join(directory, page.screenshots[width]));
  }
  evidence.push({ key: item.key, siteId: item.siteId, versionId: item.versionId, materialCharacters: item.materials.length, requests: { plan: 1, write: 1 }, checkedViewports: item.attempts[0].checks.viewports.length, pages: item.pages.map(page => page.id) });
}
await writeFile(path.join(directory, 'private/fixture-verification.json'), JSON.stringify({ status: 'PASS', scope: 'Local transport, complete materials, real commit entry and saved versions; semantic model quality is not tested.', checkedAt: new Date().toISOString(), evidence, evalStatus: round.status, evalErrors: round.errors }, null, 2), 'utf8');
console.log(`PASS: ${round.cases.length} local-fixture sites; evaluation report status: ${round.status}`);
