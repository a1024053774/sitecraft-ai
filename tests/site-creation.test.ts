import assert from 'node:assert/strict';
import test from 'node:test';
import { base } from './helpers/workspace-browser.ts';

test('creating a site applies each requested visual template and neutral names', async () => {
  for (const templateId of ['forge', 'screwfast', 'landwind', 'tailwind-landing']) {
    const response = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `T028 ${templateId}`, templateId, locales: ['zh', 'en'] }) });
    assert.equal(response.ok, true);
    const payload = await response.json() as { draft: { templateId: string; visualBrief: { templateId: string }; siteName: string; companyName: string } };
    assert.equal(payload.draft.templateId, templateId);
    assert.equal(payload.draft.visualBrief.templateId, templateId);
    assert.equal(payload.draft.siteName, '未命名站点');
    assert.equal(payload.draft.companyName, '未命名企业');
  }
});
