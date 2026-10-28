import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { factAuditReply, factAuditPayload } from './fixtures/fact-audit-reply.ts';
import type { SiteCode } from '../lib/code-site.ts';

// 失败方式：flex/grid 子项、块或单元格粘出新数字；只读某一档；
// 真正的行内数字被拆开后漏查；修正器按全文或单节点子数字误选范围。
// C10 原候选与资料提供合法时间；1234 不在 12、34 的资料中，必须拒存。
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
process.env.SITE_STORE = 'fs';
const output = `artifacts/t194/numbers-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
let factCalls = 0;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  factCalls++;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(JSON.parse(raw), { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(JSON.parse(raw), { issues: [] })) } }] })));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 't194-local-fixture'; process.env.DEEPSEEK_MODEL = 't194-local-fixture';
const { createCodeSite, updateCodeSite, commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { codeRepairFragments, applyCodeRepair } = await import('../lib/code-site-repair.ts');
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
const fixture = JSON.parse(await readFile('tests/fixtures/t194-c10-number-boundary.json', 'utf8')) as { name: string; materials: string; code: SiteCode };
async function submit(code: SiteCode, materials: string, name = '数字边界') {
  const siteId = `t194-${randomUUID()}`;
  await createCodeSite(siteId, name, randomUUID());
  await updateCodeSite(siteId, () => ({ materials }));
  return { siteId, commit: () => commitSiteCode({ siteId, baseRevision: 0, code, author: 'user', summary: '数字边界复现', request: '' }) };
}

test('C10 原三页候选经生产提交入口通过并实际存版', async () => {
  const { siteId, commit } = await submit(fixture.code, fixture.materials, fixture.name);
  const uploads = path.join(process.env.SITECRAFT_DATA_ROOT!, 'uploads', 'demo', siteId);
  await mkdir(uploads, { recursive: true });
  for (const file of await readdir('tests/fixtures/t194-images')) {
    const source = path.join('tests/fixtures/t194-images', file);
    const metadata = JSON.parse(await readFile(source, 'utf8'));
    await writeFile(path.join(uploads, file), JSON.stringify({ ...metadata, siteId }), 'utf8');
    await cp(path.join('fixtures/simulated-packs/restaurant', metadata.originalName), path.join(uploads, file.replace(/\.json$/, '.jpg')));
  }
  const result = await commit();
  let repairError: string | undefined;
  if (result.status === 'rejected') {
    try { await codeRepairFragments(result.code, result.checks.issues, result.checks.cleaned); }
    catch (error) { repairError = (error as Error).message; }
  }
  await writeFile(`${output}/c10-commit.json`, JSON.stringify({ result, repairError, stored: await getCodeSite(siteId) }, null, 2), 'utf8');
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : result.status);
  const stored = (await getCodeSite(siteId))!;
  assert.equal(stored.versions.length, 1);
  assert.equal(stored.versions[0].checks.viewports.length, 9);
  assert.ok(stored.versions[0].checks.viewports.every(view => !view.overflow && !view.overlaps && !view.contrastIssues));
});

const small = (html: string, css = ''): SiteCode => ({ header: '', footer: '', css: 'body{margin:0;color:#111;background:#fff;font:18px/1.6 sans-serif}main{padding:24px}' + css,
  pages: [{ id: 'home', title: '数字边界', html: `<main><h1>数字边界</h1>${html}</main>` }] });
for (const [name, html, css] of [
  ['block', '<div>12</div><div>34</div>', ''],
  ['cells', '<table><tr><td>12</td><td>34</td></tr></table>', ''],
  ['punctuation', '<p><span>12</span>。<span>34</span></p>', ''],
  ['flex', '<p class="pair"><span>12</span><span>34</span></p>', '.pair{display:flex;gap:16px}'],
  ['grid', '<p class="pair"><span>12</span><span>34</span></p>', '.pair{display:grid;grid-template-columns:1fr 1fr}'],
  ['mobile', '<p><span class="boundary">12</span><span>34</span></p>', '@media(max-width:500px){.boundary{display:block}}'],
  ['tablet', '<p><span class="boundary">12</span><span>34</span></p>', '@media(min-width:600px) and (max-width:1000px){.boundary{display:block}}'],
  ['desktop', '<p><span class="boundary">12</span><span>34</span></p>', '@media(min-width:1200px){.boundary{display:block}}'],
] as const) test(`${name} 分隔按三档并集检查，合法数字可存版`, async () => {
  const { commit } = await submit(small(html, css), '数字边界。数值 12 和 34。');
  const result = await commit();
  await writeFile(`${output}/${name}.json`, JSON.stringify(result, null, 2), 'utf8');
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : result.status);
});

test('行内 span 真正拼出无来源的 1234，拒存且修正明确说明跨文字节点', async () => {
  const { siteId, commit } = await submit(small('<p>产能 <span>12</span><span>34</span> 台。</p>'), '数字边界。数值 12 和 34。');
  const before = factCalls, result = await commit();
  await writeFile(`${output}/cross-node.json`, JSON.stringify(result, null, 2), 'utf8');
  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  assert.ok(result.checks.issues.includes('资料没有的数字：1234'));
  assert.equal(factCalls, before, '机械拒因先于事实替身调用');
  assert.equal((await getCodeSite(siteId))!.versions.length, 0);
  const repairs = result.checks.numberRepairs;
  await assert.rejects(codeRepairFragments(result.code, result.checks.issues, result.checks.cleaned, repairs), /跨文字节点.*1234|1234.*跨文字节点/);
});

test('资料包含完整数值时，跨节点数字也须明确拒收，不能猜单节点修正范围', async () => {
  const { siteId, commit } = await submit(small('<p>产能 <span>12</span><span>34</span> 台。</p>'), '数字边界。产能 1234 台。');
  const result = await commit();
  await writeFile(`${output}/sourced-cross-node.json`, JSON.stringify(result, null, 2), 'utf8');
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /跨文字节点.*1234|1234.*跨文字节点/);
  assert.equal((await getCodeSite(siteId))!.versions.length, 0);
});

test('同字段顶层行内节点也组成一个数字，不能按源码根节点强行分隔', async () => {
  const code = small(''); code.header = '<span>12</span><span>34</span>';
  const { commit } = await submit(code, '数字边界。数值 12 和 34。');
  const result = await commit();
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /跨文字节点.*1234|1234.*跨文字节点/);
});

test('单节点无来源数字只开放同次读取的文字片段，不开放 CSS 或其他位置', async () => {
  const code = small('<p>保留句。产能 ９８７６５４ 台；保留末句。</p>', ':root{--unused:987654}');
  const { siteId, commit } = await submit(code, '数字边界。');
  const result = await commit();
  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  const repairs = result.checks.numberRepairs;
  const fragments = await codeRepairFragments(result.code, result.checks.issues, result.checks.cleaned, repairs);
  await writeFile(`${output}/single-node.json`, JSON.stringify({ result, fragments }, null, 2), 'utf8');
  assert.equal(fragments.length, 1);
  assert.equal(fragments[0].kind, 'text');
  assert.equal(fragments[0].field, 'pages/home/html');
  assert.equal(fragments[0].before, '产能 ９８７６５４ 台；');
  if (fragments[0].kind === 'text') {
    assert.deepEqual(fragments[0].path, [0, 1, 0]);
    assert.equal(fragments[0].offset, 4);
  }
  assert.equal((await getCodeSite(siteId))!.versions.length, 0);
  const repaired = await applyCodeRepair(result.code, fragments, { replacements: [{ fragmentId: fragments[0].id, after: '产能待补充；' }] });
  assert.equal(repaired.pages[0].html, '<main><h1>数字边界</h1><p>保留句。产能待补充；保留末句。</p></main>');
  assert.equal(repaired.css, result.code.css);
  const saved = await commitSiteCode({ siteId, baseRevision: 0, code: repaired, author: 'user', summary: '只修数字片段', request: '' });
  assert.equal(saved.status, 'applied');
  assert.equal((await getCodeSite(siteId))!.versions.length, 1);
  await writeFile(`${output}/single-node-saved.json`, JSON.stringify({ saved, stored: await getCodeSite(siteId) }, null, 2), 'utf8');
});
