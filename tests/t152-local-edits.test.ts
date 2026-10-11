import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Contract failure modes (T-152): shared CSS escapes the target; a whole-page
// reply replaces a block; repeated IDs select the wrong block; stale versions
// attach to new DOM; facts outside the block are charged again; opaque old
// anchors are discarded; CSS pseudo content introduces unsourced quantities.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
let audit = '', replayTruncation = false;
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<html><body>local origin</body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const request = JSON.parse(raw); audit = request.messages[1].content;
  // Observed 2026-10-11: 4095 reasoning tokens, zero answer characters, length.
  if (replayTruncation && request.max_tokens <= 4096) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '' } }], usage: { prompt_tokens: 4763, completion_tokens: 4095, total_tokens: 8858, completion_tokens_details: { reasoning_tokens: 4095 } } })); return; }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITE_STORE = 'fs';
process.env.SITECRAFT_DATA_ROOT = path.resolve('artifacts/t152/contract-data');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
// This isolated server is only the deterministic checker origin, never a workspace.
process.env.SITECRAFT_BASE = process.env.DEEPSEEK_BASE_URL;
const { commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { auditCodeFacts } = await import('../lib/code-site-model.ts');
const { annotationTargetSchema, createAnnotationSchema } = await import('../lib/annotations.ts');
const { listAnnotations, replyAnnotation } = await import('../lib/annotation-store.ts');
const { localEditContext, applyLocalEdit } = await import('../lib/code-site-local-edit.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const source = { header: '<header>边界纸品</header>', footer: '<footer>页脚保持</footer>',
  css: 'body{margin:0;background:#fff;color:#111;font:16px/1.6 sans-serif}main{padding:24px}.hero{padding:24px}h1,h2{margin:0 0 16px}',
  pages: [{ id: 'home', title: '首页', html: '<main><section id="same" class="hero"><h1>纸品包装</h1><p>纸箱与纸袋</p></section><section id="same"><h2>选中这块</h2><p>纸袋规格按资料说明。</p></section><section><h2>保持这块</h2><p>区块外独有文字</p></section></main>' },
    { id: 'products', title: '产品', html: '<main><section class="hero"><h1>产品独有文字</h1><p>纸箱</p></section></main>' }] };
const materials = '边界纸品生产纸箱与纸袋。纸袋规格按资料说明。';
async function setup() {
  const id = `t152-${crypto.randomUUID()}`;
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '边界纸品', source: { revision: 1, updatedAt: new Date().toISOString() }, materials, code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied'); if (first.status !== 'applied') throw new Error(JSON.stringify(first));
  const target = { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [1], text: '选中这块纸袋规格按资料说明。', label: '选中这块' };
  return { id, first, target };
}
test('commit refuses changed shared CSS and leaves the current version intact', async () => {
  const { id, first, target } = await setup();
  const code = { ...first.version.code, css: first.version.code.css + '\n.hero{padding:48px}' };
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: '局部修改', request: '只改选中块' } as any);
  assert.equal(result.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});
test('new anchors replace slot/region for writes', () => {
  assert.equal(annotationTargetSchema.safeParse({ kind: 'dom', pageId: 'home', versionId: 'version-1', path: [1], text: '纸袋', label: '纸袋' }).success, true);
  assert.equal(annotationTargetSchema.safeParse({ kind: 'slot', slot: 'hero.title', section: 'hero' }).success, false);
});
test('opaque legacy anchors and comments survive reading and replying; new writes reject them', async () => {
  const id = `t152-old-${crypto.randomUUID()}`, now = new Date().toISOString();
  const anchor = { pageId: 'home', pagePath: '/', templateId: 'retired-template', revision: 1, locale: 'zh', viewport: { width: 1440, height: 900, device: 'desktop' }, scroll: { x: 0, y: 0 }, target: { kind: 'slot', slot: 'hero.title', section: 'hero' }, rect: { x: 0, y: 0, width: 1, height: 1, space: 'target-ratio' }, snapshot: { text: '旧文字' }, capturedAt: now };
  const old = { id: 'ann_old', siteId: id, pageId: 'home', pagePath: '/', anchor, current: { state: 'attached', revision: 1 }, status: 'open', comments: [{ id: 'ac_old', body: '旧意见', author: { id: 'user', name: '用户' }, createdAt: now }], createdAt: now, updatedAt: now };
  const file = path.join(process.env.SITECRAFT_DATA_ROOT!, 'annotations', `${id}.json`);
  await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify({ schemaVersion: 1, annotations: [old] }));
  assert.deepEqual((await listAnnotations(id))[0].anchor, anchor);
  await replyAnnotation(id, 'ann_old', { body: '保留记录', author: { id: 'user', name: '用户' } });
  const saved = JSON.parse(await readFile(file, 'utf8')).annotations[0];
  assert.deepEqual(saved.anchor, anchor); assert.equal(saved.comments[0].body, '旧意见');
  assert.equal(saved.comments.length, 2);
  assert.equal(createAnnotationSchema.safeParse({ siteId: id, pageId: 'home', pagePath: '/', anchor, body: '新建', author: { id: 'user', name: '用户' } }).success, false);
});
test('DOM position wins over duplicate IDs; only the new block is fact-audited', async () => {
  const { id, first, target } = await setup();
  const context = await localEditContext(first.version.code, target);
  const html = `<section id="same" class="${context.scope}"><h2>选中这块</h2><p>纸袋规格。</p></section>`;
  const code = await applyLocalEdit(first.version.code, target, html, `.${context.scope} { padding: 16px; }`);
  assert.match(code.pages[0].html, /<h1>纸品包装<\/h1><p>纸箱与纸袋<\/p>/);
  assert.match(code.pages[0].html, /<h2>选中这块<\/h2><p>纸袋规格。<\/p>/);
  assert.match(code.pages[0].html, /<h2>保持这块<\/h2><p>区块外独有文字<\/p>/);
  assert.deepEqual(code.pages[1], first.version.code.pages[1]);
  audit = '';
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: '首页 · 选中这块', request: '精简文字' });
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : '');
  const readable = audit.split('网页可见文字与辅助文案：\n')[1];
  assert.match(readable, /纸袋规格/); assert.doesNotMatch(readable, /产品独有文字|区块外独有文字|页脚保持/);
  assert.equal((await getCodeSite(id))!.versions.length, 2);
});
test('a whole page cannot replace a block; DOM outside the block cannot be rewritten at commit', async () => {
  const { id, first, target } = await setup();
  await assert.rejects(applyLocalEdit(first.version.code, target, '<main><section><h1>整页</h1></section></main>', ''), /不能返回整页/);
  const code = structuredClone(first.version.code); code.pages[0].html = code.pages[0].html.replace('区块外独有文字', '越界重写');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: '越界', request: '' });
  assert.equal(result.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});
test('sibling CSS escapes and pseudo content with new quantities never store a version', async () => {
  const { id, first, target } = await setup();
  const context = await localEditContext(first.version.code, target);
  for (const css of [`.${context.scope} + section { padding: 60px; }`, `.${context.scope}::before {content:"产能 987654 台";display:block}`]) {
    const code = await applyLocalEdit(first.version.code, target, context.html, css);
    const result = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: '越界或虚构', request: '' });
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /局部修改越界|资料没有的数字：987654/);
  }
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});
test('stale anchors refuse before storing', async () => {
  const { id, first, target } = await setup();
  await assert.rejects(commitSiteCode({ siteId: id, baseRevision: 1, code: first.version.code, selectedTarget: { ...target, versionId: 'stale-version' }, author: 'assistant', summary: '过期', request: '' }), /锚点版本/);
  await assert.rejects(localEditContext(first.version.code, { ...target, text: '别的文字' }), /锚点文字/);
});
test('inline styles cannot change counters consumed outside the selected block', async () => {
  const { id, first, target } = await setup();
  const context = await localEditContext(first.version.code, target);
  const code = await applyLocalEdit(first.version.code, target, context.html.replace('<h2>', '<h2 style="counter-reset:chapter 8">'), '');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code, selectedTarget: target, author: 'assistant', summary: '跨区块计数器', request: '' });
  assert.equal(result.status, 'rejected');
});

test('local fact review does not cap output at the observed reasoning-only truncation', async () => {
  replayTruncation = true;
  try { assert.deepEqual(await auditCodeFacts(materials, '纸箱与纸袋', true), []); }
  finally { replayTruncation = false; }
});
