import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { EvalCase } from '../scripts/eval-set-report.ts';

// Failure modes: a long sourced paragraph prevents storage or invokes repair;
// advisory counts disappear from saved checks or aggregate evaluation statistics.
// The source text is a verbatim first-round rejection excerpt. Only the provider
// is a fixture; submission, persistence and the three Chrome viewports are real.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const excerpt = JSON.parse(await readFile('tests/fixtures/t133/first-round-excerpts.json', 'utf8'));
let auditReadable = '';
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<html><body>fixture origin</body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  auditReadable = JSON.parse(raw).messages[1].content.split('网页可见文字与辅助文案：\n')[1];
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-test-only'; process.env.DEEPSEEK_MODEL = 'local-test-only';
const { createCodeSite, updateCodeSite, commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const { summarize } = await import('../scripts/eval-set-report.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
test('T133 first-round long paragraph is saved with quality feedback and counted without refusal', async () => {
  const id = `t133-${crypto.randomUUID()}`;
  await createCodeSite(id, '青禾纸包装', crypto.randomUUID());
  await updateCodeSite(id, () => ({ materials: excerpt.materials }));
  const code = { header: '', footer: '', css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}',
    pages: [{ id: 'home', title: '青禾纸包装', html: `<main><h1>青禾纸包装</h1><p>${excerpt.lineText}</p></main>` }] };
  const result = await commitSiteCode({ siteId: id, baseRevision: 0, code, author: 'user', summary: '首轮行长复现', request: '' });
  const folder = path.join('artifacts/t133', `line-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'report.json'), JSON.stringify(result, null, 2), 'utf8');
  assert.equal(result.status, 'applied', 'sourced line length is advisory, so it must not prevent a version');
  const saved = (await getCodeSite(id))!.versions[0];
  assert.equal(saved.checks.passed, true);
  assert.equal(saved.checks.issues.length, 0);
  assert.ok(saved.checks.viewports.some(v => v.longLines > 0), 'quality feedback must survive in the version');
  const evaluation: EvalCase = { key: 'packaging/documentary', pack: 'packaging', style: 'documentary', materials: excerpt.materials,
    outcome: 'generated', elapsedMs: 0, attempts: [{ round: 0, checks: saved.checks }], modelCalls: [], pages: [] };
  const summary = summarize([evaluation]);
  assert.equal(summary.rejectedAttempts, 0);
  // At 375 this Chinese paragraph wraps below 40 characters; at 768/1440 it
  // exceeds that quality guideline. The expected count comes from this fixture.
  assert.deepEqual(summary.qualityFeedback['body-line-length'], { attempts: 1, sites: 1, occurrences: 2 });
});
test('T133 actual handwritten steps refuse, then native ol and decimal counters repair them', async () => {
  const fixture = JSON.parse(await readFile('tests/fixtures/t133/numbered-steps.json', 'utf8'));
  const code = { header: '', footer: '', css: fixture.css,
    pages: [{ id: 'home', title: fixture.company, html: `<main><h1>${fixture.company}</h1>${fixture.html}</main>` }] };
  const result = await checkSiteCode({ siteId: 't133-real-steps', code, materials: fixture.materials, images: [] });
  assert.equal(result.checks.passed, false);
  for (const marker of ['01', '02', '03', '04', '05']) assert.ok(result.checks.issues.includes(`资料没有的数字：${marker}`));
  const nativeSteps = fixture.html.replace(/<span class="step-no">\d+<\/span>/g, '');
  const nativeCss = fixture.css + '.steps{list-style:decimal;padding-left:2em}.steps li{display:list-item}.steps h3{display:inline}';
  const native = await checkSiteCode({ siteId: 't133-real-steps', code: { ...code, css: nativeCss, pages: [{ ...code.pages[0], html: `<main><h1>${fixture.company}</h1>${nativeSteps}</main>` }] }, materials: fixture.materials, images: [] });
  assert.equal(native.checks.passed, true, JSON.stringify(native.checks));
  assert.doesNotMatch(auditReadable, /01/);
  assert.match(auditReadable, /每 2 小时/);
  const counterCss = fixture.css + '.steps{counter-reset:step}.steps li{counter-increment:step;display:block}.steps li::before{content:counter(step,decimal);display:block}';
  const counter = await checkSiteCode({ siteId: 't133-real-steps', code: { ...code, css: counterCss, pages: [{ ...code.pages[0], html: `<main><h1>${fixture.company}</h1>${nativeSteps}</main>` }] }, materials: fixture.materials, images: [] });
  assert.equal(counter.checks.passed, true, JSON.stringify(counter.checks));
  const paragraphSteps = nativeSteps.replaceAll('<h3', '<p').replaceAll('</h3', '</p');
  const plain = await checkSiteCode({ siteId: 't133-real-steps', code: { ...code, css: counterCss, pages: [{ ...code.pages[0], html: `<main><h1>${fixture.company}</h1>${paragraphSteps}</main>` }] }, materials: fixture.materials, images: [] });
  assert.equal(plain.checks.passed, true, 'the same ordered steps must not depend on a heading tag');
  for (const html of [
    native.code.pages[0].html.replace('每 2 小时', '每 987654 小时'),
    code.pages[0].html.replace('>01<', '>987654<'),
    code.pages[0].html.replace('>01<', ' title="产能 987654 台">01<'),
    code.pages[0].html.replace('</main>', '<p>产能 987654 台，待补充。</p></main>'),
  ]) {
    const bad = await checkSiteCode({ siteId: 't133-real-steps', code: { ...code, pages: [{ ...code.pages[0], html }] }, materials: fixture.materials, images: [] });
    assert.equal(bad.checks.passed, false);
    assert.match(bad.checks.issues.join('\n'), /987654/);
  }
});
// Arbitrary quantities cannot acquire a source by looking like a sequence.
for (const unit of ['名工程师', '条自动产线', 'kW 装机功率', 'L/min 额定流量']) {
  test(`T133 handwritten quantity never becomes a list exemption: ${unit}`, async () => {
    const code = { header: '', footer: '', css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}',
      pages: [{ id: 'home', title: '边界机械', html: `<main><h1>边界机械</h1><ol><li><span>1</span><p>${unit}</p></li><li><span>2</span><p>${unit}</p></li></ol></main>` }] };
    const result = await checkSiteCode({ siteId: 't133-unit-quantity', code, materials: '边界机械从事精密零件加工。', images: [] });
    assert.equal(result.checks.passed, false, 'handwritten numbers use the same numeric source check for every unit');
    assert.ok(result.checks.issues.includes('资料没有的数字：1'));
    assert.ok(result.checks.issues.includes('资料没有的数字：2'));
  });
}
// Astra found two numeric-source bypasses: inline quantities looked like list
// markers, and clearing a marker removed descendant auxiliary-copy attributes.
// The provider returns no issues here so these assertions exercise the numeric
// boundary, independently of the semantic model's probabilistic judgment.
test('T133 inline equipment quantities are not independent ordered-list markers', async () => {
  const code = { header: '', footer: '', css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}',
    pages: [{ id: 'home', title: '边界机械', html: '<main><h1>边界机械</h1><ol><li>配有<span>1</span>台数控车床</li></ol></main>' }] };
  for (const html of [code.pages[0].html,
    '<main><h1>边界机械</h1><ol><li>配有<span>1</span><p>台数控车床</p></li><li>配有<span>2</span><p>台磨床</p></li></ol></main>',
    '<main><h1>边界机械</h1><ol><li><span>1</span><p>台数控车床</p></li><li><span>2</span><p>台磨床</p></li></ol></main>',
  ]) {
    const result = await checkSiteCode({ siteId: 't133-inline-quantity', code: { ...code, pages: [{ ...code.pages[0], html }] }, materials: '边界机械从事精密零件加工。', images: [] });
    assert.equal(result.checks.passed, false, 'a sourced list structure cannot authorize an unsourced equipment quantity');
    assert.ok(result.checks.issues.includes('资料没有的数字：1'));
  }
});
test('T133 numbered-marker descendant attributes remain numeric facts', async () => {
  const code = { header: '', footer: '', css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}',
    pages: [{ id: 'home', title: '边界机械', html: '<main><h1>边界机械</h1><ol><li><span><b title="产能 987654 台">01</b></span><h3>来料检验</h3></li><li><span>02</span><p>来料检验</p></li></ol></main>' }] };
  const result = await checkSiteCode({ siteId: 't133-marker-attribute', code, materials: '边界机械进行来料检验。', images: [] });
  assert.equal(result.checks.passed, false, 'numbering does not authorize a capacity claim in a descendant attribute');
  assert.ok(result.checks.issues.includes('资料没有的数字：987654'));
  assert.ok(result.checks.issues.includes('资料没有的数字：01'));
  assert.ok(result.checks.issues.includes('资料没有的数字：02'));
  const withoutHandwrittenMarkers = { ...code, pages: [{ ...code.pages[0], html: code.pages[0].html.replace('>01<', '>来料检验<').replace('<span>02</span>', '') }] };
  const sourced = await checkSiteCode({ siteId: 't133-marker-attribute', code: withoutHandwrittenMarkers, materials: '边界机械进行来料检验，产能 987654 台。', images: [] });
  assert.equal(sourced.checks.passed, true);
  assert.match(auditReadable, /产能 987654 台/);
});
