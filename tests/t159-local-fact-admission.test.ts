import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { factAuditReply } from './fixtures/fact-audit-reply.ts';

// 准入须先于模型 HTTP；局部分段和字符串调用都不能漏传风格。
// 期待的拒绝与零请求来自主控合同，语义校对由本地替身控制。
delete process.env.SITECRAFT_EVAL_STYLES;
await import('./fixtures/t159-pending-catalog.ts');
let modelCalls = 0;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  modelCalls++;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(JSON.parse(raw), { issues: [] })) } }] }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const { auditCodeFacts } = await import('../lib/code-site-model.ts');
const { createCodeSite, updateCodeSite, commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { applyLocalEdit } = await import('../lib/code-site-local-edit.ts');
test.after(async () => { await new Promise<void>(resolve => provider.close(() => resolve())); });

test('普通进程的 pending 风格局部提交在事实模型调用前拒绝，不保存版本', async () => {
  const id = `t159-local-${crypto.randomUUID()}`;
  await createCodeSite(id, '事实准入样本', 'local-admission');
  await updateCodeSite(id, () => ({ materials: '事实准入样本提供已有业务。' }));
  const code = { header: '', footer: '', css: 'body{margin:0;padding:24px;color:#111;background:#fff;font:18px/1.6 sans-serif}',
    pages: [{ id: 'home', title: '首页', html: '<main><h1>事实准入样本</h1><section><h2>业务</h2><p>已有业务。</p></section></main>' }] };
  const first = await commitSiteCode({ siteId: id, baseRevision: 0, code, author: 'user', summary: '首版', request: '' });
  assert.equal(first.status, 'applied'); if (first.status !== 'applied') throw new Error('首版提交失败');
  await updateCodeSite(id, () => ({ plan: { style: 'neighborly', summary: '待准入风格', styleReason: '测试本次模型准入',
    pages: [{ id: 'home', title: '首页', outline: '已有业务' }] } }));
  const target = { kind: 'dom' as const, versionId: first.version.id, pageId: 'home', path: [1], text: '业务已有业务。', label: '业务' };
  const candidate = await applyLocalEdit(first.version.code, target, '<section><h2>业务说明</h2><p>已有业务。</p></section>', '');
  const before = modelCalls;
  await assert.rejects(commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '局部修改', request: '' }), /风格.*不能使用/);
  assert.equal(modelCalls, before, '拒绝发生在模型 HTTP 请求之前');
  const site = (await getCodeSite(id))!;
  assert.equal(site.versions.length, 1); assert.equal(site.currentVersionId, first.version.id);
});

test('pending 风格的字符串及分段事实核对均在模型调用前拒绝，local 可为 boolean', async () => {
  const before = modelCalls;
  await assert.rejects(auditCodeFacts('已有业务。', '已有业务。', true, 'neighborly'), /风格.*不能使用/);
  const segments = [{ text: '已有业务。', group: '业务', context: { pageId: 'home', outline: [], headings: [] } }];
  for (const local of [false, true]) await assert.rejects(auditCodeFacts('已有业务。', segments, local, 'neighborly'), /风格.*不能使用/);
  assert.equal(modelCalls, before, '三个签名使用同一准入，不发 HTTP');
});
