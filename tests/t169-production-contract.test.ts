import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// These tests use the real workflow and commit entry points. The model is a
// local HTTP substitute; no external request is permitted.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t169After = callbacks;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t169After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(`${file}.ts`).href, context);
} });

const { createCodeSite, getCodeSite, updateCodeSite, commitSiteCode } = await import('../lib/code-site-store.ts');
const { handleCodeChat } = await import('../lib/code-site-workflow.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const { listSiteImages } = await import('../lib/site-images.ts');
const { codeFactMaterials } = await import('../lib/code-site.ts');

const requests: any[] = [];
let replyMode: 'valid' | 'missingNoFacts' | 'emptyCategories' | 'noFacts' | 'duplicate' = 'valid';
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  const validCitation = { category: '客户与合作方', claim: '长期合作客户：甲方公司。', quote: '长期合作客户：甲方公司。' };
  const results = (input.segments ?? []).map((segment: any) => {
    const hasClaim = segment.text.includes('长期合作客户');
    const noFacts = replyMode === 'noFacts' || (!hasClaim && replyMode !== 'emptyCategories' && replyMode !== 'missingNoFacts');
    const citations = noFacts || replyMode === 'emptyCategories' || !hasClaim ? [] : replyMode === 'duplicate' ? [validCitation, validCitation] : [validCitation];
    const row: any = { id: segment.id, issues: replyMode === 'noFacts' && hasClaim ? ['页面原句：长期合作客户：甲方公司。；资料未提供该客户关系。'] : [], factCategories: noFacts || replyMode === 'emptyCategories' || !hasClaim ? [] : ['客户与合作方'], citations };
    if (replyMode !== 'missingNoFacts' && !process.env.P1_PARENT) row.noFacts = noFacts;
    if (replyMode === 'duplicate') row.factCategories = ['客户与合作方', '客户与合作方'];
    return row;
  });
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ results }) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
process.env.SITE_STORE = 'fs';
assert.ok(process.env.SITECRAFT_DATA_ROOT, '需要显式独立测试数据根');

const code: SiteCode = { header: '', footer: '', css: 'body{margin:0;padding:24px;color:#111;background:#fff;font:18px/1.6 sans-serif}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>企业事实</h1><section><h2>客户</h2><p>长期合作客户：甲方公司。</p></section></main>' }] };

async function settle() { for (const callback of callbacks.splice(0)) await callback(); }
async function productionSite(message: string, candidate: SiteCode = code, source?: any) {
  const id = `t169-production-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(id, `conversation-${id}`);
  await createCodeSite(id, '企业事实', conversation.conversationId);
  const initial = await handleCodeChat(id, { message, baseRevision: 0, ...(source ? { source } : {}) });
  assert.equal(initial.status, 200, await initial.clone().text());
  await updateCodeSite(id, () => ({ plan: { style: 'precision', summary: '测试', styleReason: '测试', pages: [{ id: 'home', title: '首页', outline: '客户' }] } }));
  const result = await commitSiteCode({ siteId: id, baseRevision: 0, code: candidate, author: 'user', summary: '生产入口核对', request: '' });
  await settle();
  return { id, result, site: (await getCodeSite(id))! };
}

test.after(async () => {
  await mkdir('artifacts/t169', { recursive: true });
  await writeFile(`artifacts/t169/production-contract-${Date.now()}.json`, JSON.stringify(requests, null, 2));
  await new Promise<void>(resolve => provider.close(() => resolve()));
});

test('合同 D 消息按发送顺序保存，要求里的事实指向第 N 条消息原文', async () => {
  const id = `t169-message-sources-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(id, `conversation-${id}`);
  await createCodeSite(id, '消息来源', conversation.conversationId);
  const first = await handleCodeChat(id, { message: '企业资料：普通纸盒。', baseRevision: 0 });
  assert.equal(first.status, 200);
  const cancelled = await handleCodeChat(id, { action: 'cancel', baseRevision: 0 });
  assert.equal(cancelled.status, 200);
  const second = await handleCodeChat(id, { message: '页面要求：长期合作客户：甲方公司。', baseRevision: 0 });
  assert.equal(second.status, 200);
  const site = (await getCodeSite(id))!;
  assert.deepEqual(site.factSources, [
    { type: 'message', messageIndex: 1, text: '企业资料：普通纸盒。' },
    { type: 'message', messageIndex: 2, text: '页面要求：长期合作客户：甲方公司。' },
  ]);
});

test('P1-1 生产入口遇到旧记录缺 factSources 必须重新核对且不能回退完整上下文', async () => {
  const id = `t169-old-source-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(id, `conversation-${id}`);
  await createCodeSite(id, '企业事实', conversation.conversationId);
  await updateCodeSite(id, () => ({ materials: '企业事实：长期合作客户：甲方公司。', factSources: undefined, plan: { style: 'precision', summary: '测试', styleReason: '测试', pages: [{ id: 'home', title: '首页', outline: '客户' }] } }));
  await updateCodeSite(id, () => ({ factSources: undefined } as any));
  const result = await commitSiteCode({ siteId: id, baseRevision: 0, code, author: 'user', summary: '旧记录重核', request: '' });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /出处|资料/);
});

test('P1-3 生产入口拒绝缺 noFacts 的价格与客户段，不能用空类别通过', async () => {
  const candidate = { ...code, pages: [{ ...code.pages[0], html: '<main><h1>企业事实</h1><p>长期合作客户：甲方公司。</p><p>价格：每件12元。</p></main>' }] };
  replyMode = 'emptyCategories';
  try {
    const { result } = await productionSite('企业事实：长期合作客户：甲方公司。价格：每件12元。', candidate);
    assert.equal(result.status, 'rejected');
  } finally { replyMode = 'valid'; }
});

test('P1-4 生产入口不复用 format 2 的结构化出处', async () => {
  const id = `t169-old-format-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(id, `conversation-${id}`);
  await createCodeSite(id, '企业事实', conversation.conversationId);
  await updateCodeSite(id, () => ({ materials: '企业事实：长期合作客户：甲方公司。', factSources: [{ type: 'message', messageIndex: 1, text: '企业事实：长期合作客户：甲方公司。' }], plan: { style: 'precision', summary: '测试', styleReason: '测试', pages: [{ id: 'home', title: '首页', outline: '客户' }] } }));
  const siteForCheck = (await getCodeSite(id))!;
  const checkedMaterials = codeFactMaterials(siteForCheck, undefined, siteForCheck.currentVersionId, true);
  const checked = await checkSiteCode({ siteId: id, code, materials: checkedMaterials, images: await listSiteImages(id), companyName: '企业事实', factSourceMaterials: siteForCheck.factSources, style: 'precision' });
  assert.equal(checked.checks.passed, true, checked.checks.issues.join('\n'));
  await updateCodeSite(id, () => ({ run: { id: 'old-format', kind: 'generate', status: 'running', request: '', baseRevision: 0, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), step: '检查', repairRound: 0, issues: [], attempts: [{ code, checks: { ...checked.checks, factSegments: { ...checked.checks.factSegments!, format: 2 } as any } }] } }));
  const before = requests.length;
  const result = await commitSiteCode({ siteId: id, baseRevision: 0, code, author: 'user', summary: '旧格式', request: '' });
  assert.equal(result.status, 'applied');
  assert.ok(requests.length > before, '旧 format:2 必须重新发起事实核对');
});

test('P1-5 生产入口资料源变化时局部修改不信任范围外旧出处', async () => {
  const twoBlockCode = { ...code, pages: [{ ...code.pages[0], html: '<main><h1>企业事实</h1><section><h2>客户</h2><p>长期合作客户：甲方公司。</p></section><section><h2>介绍</h2><p>普通介绍。</p></section></main>' }] };
  const source = { type: 'upload' as const, sourceId: 'source-update', name: '资料.txt', text: '企业事实：长期合作客户：甲方公司。' };
  const { id } = await productionSite(source.text, twoBlockCode, source);
  const site = (await getCodeSite(id))!;
  const current = site.versions[0];
  if (!current) throw new Error('缺首版');
  const changedSource = { ...source, text: '企业事实：长期合作客户：乙方公司。' };
  await updateCodeSite(id, () => ({ factSources: [changedSource] }));
  const target = { kind: 'dom' as const, versionId: current.id, pageId: 'home', path: [2], text: '介绍普通介绍。', label: '介绍' };
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: twoBlockCode, selectedTarget: target, author: 'assistant', summary: '局部', request: '', source: changedSource });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /范围外资料出处|资料出处/);
});

test('P1-6 生产入口按提示示例构造的 noFacts 合法回复可通过解析', async () => {
  replyMode = 'noFacts';
  try {
    const candidate = { ...code, pages: [{ ...code.pages[0], html: '<main><h1>企业事实</h1><p>普通介绍。</p></main>' }] };
    const { result } = await productionSite('企业事实：长期合作客户：甲方公司。', candidate);
    assert.notEqual(result.status, 'rejected');
    assert.match(String(requests.at(-1).messages[0].content), /noFacts/);
  } finally { replyMode = 'valid'; }
});

test('P2 模型显式 noFacts:true 时仍保留原有事实核对拒因', async () => {
  replyMode = 'noFacts';
  try {
    const { result } = await productionSite('企业事实：长期合作客户：甲方公司。', code);
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /资料未提供该客户关系/);
  } finally { replyMode = 'valid'; }
});

test('P2 重复类别或 citation 由生产提交入口明确拒绝', async () => {
  replyMode = 'duplicate';
  try {
    const { result } = await productionSite('企业事实：长期合作客户：甲方公司。');
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /资料出处重复/);
  } finally { replyMode = 'valid'; }
});
