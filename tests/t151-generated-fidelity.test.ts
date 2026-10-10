import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSiteCode } from '../lib/code-site-check.ts';
import type { SiteCode } from '../lib/code-site.ts';

// Risks: English-only pseudo content escapes the DOM comparison; CSS numbers,
// duplicate facts or unknown units are omitted; language selectors add claims.
const css = 'body{margin:0;background:#fff;color:#222;font:16px/1.7 sans-serif}main{padding:24px}p{max-width:30em}h1{font-size:32px}';
for (const [label, extra] of [
  ['new numeric fact', 'html:lang(en) p::before{content:"99999 bar"}'],
  ['changed compound unit', 'p::before{content:"30 L/min"}html:lang(en) p::before{content:"30 L/h"}'],
  ['new claim without digits', 'html:lang(en) p::after{content:"Lifetime warranty"}'],
] as const) {
  test(`Astra: rendered English CSS rejects ${label}`, async () => {
    const raw: SiteCode = { header: '', footer: '', css: css + extra, pages: [{ id: 'home', title: '设备', html: '<main><h1>设备</h1><p>按图加工</p></main>' }] };
    const checked = await checkSiteCode({ siteId: 't151-css-source', code: raw, legacyImport: true, materials: '设备按图加工。流量 30 L/min。', images: [] });
    assert.equal(checked.checks.passed, true, checked.checks.issues.join('\n'));
    const source = checked.code;
    const candidate: SiteCode = { ...source, pages: [{ id: 'home', title: 'Equipment', html: '<main><h1>Equipment</h1><p>Machined to drawing</p></main>' }] };
    const result = await checkSiteCode({ siteId: 't151-css-fidelity', code: candidate, translationSource: source, materials: '按图加工。流量 30 L/min。', images: [], companyName: '设备公司' });
    assert.equal(result.checks.passed, false, JSON.stringify(result.checks));
    assert.match(result.checks.issues.join('\n'), /CSS.*(保真|新增|遗漏)|保真.*CSS/);
  });
}

test('CSS company identification uses the same explicit name rule as DOM copy', async () => {
  const raw: SiteCode = { header: '', footer: '', css: css + 'p::before{content:"设备公司"}', pages: [{ id: 'home', title: '设备', html: '<main><h1>设备</h1><p>按图加工</p></main>' }] };
  const checked = await checkSiteCode({ siteId: 't151-css-name-source', code: raw, legacyImport: true, materials: '设备公司按图加工。', images: [] });
  assert.equal(checked.checks.passed, true, checked.checks.issues.join('\n'));
  const source = checked.code;
  const candidate = { ...source, pages: [{ id: 'home', title: 'Equipment', html: '<main><h1>Equipment</h1><p>Machined to drawing</p></main>' }] };
  const result = await checkSiteCode({ siteId: 't151-css-name', code: candidate, translationSource: source, materials: '设备公司按图加工。', images: [], companyName: '设备公司' });
  assert.equal(result.checks.passed, true, result.checks.issues.join('\n'));
});
