import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pendingCodeFactSegments, bindCodeFactCitations } from '../lib/code-site-fact-segments.ts';

// Contract oracle: these sentences are supplied independently of the auditor.
const materials = '客户：已服务３０家客户。\n认证：取得 ISO　9001 认证。\n收费：纸盒每件 12 元。';
const segment = { text: '页面 home\n已服务30家客户。', group: '客户组', context: { pageId: 'home', outline: [], headings: [] } };
let citations: any[] = [];
let omitCitations = false;
const calls: any[] = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); calls.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ results: input.segments.map((s: any) => ({ id: s.id, issues: [], ...(omitCitations ? {} : { citations }) })) }) } }], usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const { auditCodeFacts } = await import('../lib/code-site-model.ts');
test.after(async () => {
  await mkdir('artifacts/t169', { recursive: true });
  await writeFile(`artifacts/t169/protocol-${Date.now()}.json`, JSON.stringify(calls, null, 2));
  await new Promise<void>(resolve => server.close(() => resolve()));
});

test('真实原句经 NFKC 和空白压缩验真，局部与整站使用同一返回合同且不新增调用', async () => {
  citations = [{ category: '客户与合作方', claim: '已服务30家客户。', quote: '已服务30家客户。' }];
  const before = calls.length;
  const result: any = await auditCodeFacts(materials, [segment]);
  assert.deepEqual(result[0].issues, []);
  assert.deepEqual(result[0].citations, citations);
  const local: any = await (auditCodeFacts as any)(materials, [segment], true);
  assert.deepEqual(local[0].citations, citations);
  assert.equal(calls.length, before + 2);
  assert.deepEqual(calls.slice(-2).map(body => body.thinking.type), ['enabled', 'disabled']);
  citations = [{ category: '资质认证', claim: '取得 ISO 9001 认证。', quote: '取得  ISO\n9001 认证。' }];
  const cert: any = await auditCodeFacts(materials, [{ ...segment, text: '取得 ISO 9001 认证。' }]);
  assert.deepEqual(cert[0].issues, []);
});

test('编造、跨字段拼接、网页字段和近似引文返回拒因，不作为已验真出处', async () => {
  for (const quote of ['已服务过30家客户。', '已服务30家客户。取得 ISO 9001 认证。', '页面 home', '已服务31家客户。', '   ']) {
    citations = [{ category: '客户与合作方', claim: '已服务30家客户。', quote }];
    const result: any = await auditCodeFacts(materials, [segment]);
    assert.match(result[0].issues.join('\n'), /资料出处/);
    assert.deepEqual(result[0].citations, []);
  }
});

test('声明必须来自本段，类别必须是高风险类别，遗漏数组不能冒充已记录', async () => {
  citations = [{ category: '客户与合作方', claim: '纸袋', quote: '已服务30家客户。' }];
  const result: any = await auditCodeFacts(materials, [segment]);
  assert.match(result[0].issues.join('\n'), /声明/);
  citations = [{ category: '普通介绍', claim: '已服务30家客户。', quote: '已服务30家客户。' }];
  await assert.rejects(auditCodeFacts(materials, [segment]), /核对段/);
  omitCitations = true;
  try { await assert.rejects(auditCodeFacts(materials, [segment]), /核对段/); }
  finally { omitCitations = false; }
});

test('复用同次完整核对的出处；旧记录与变更资料或整组内容必须重核', () => {
  const citation = { category: '客户与合作方', claim: '已服务30家客户。', quote: '已服务30家客户。' };
  const review: any = { format: 2, materials, sourceMaterials: materials, audited: 1, reused: 0, segments: [{ ...segment, issues: [], citations: [citation] }] };
  const reused: any = pendingCodeFactSegments([segment], materials, [review]);
  assert.deepEqual(reused.reused[0].citations, [citation]);
  assert.equal(pendingCodeFactSegments([segment], materials.replace('３０', '３１'), [review]).reused.length, 0);
  assert.equal(pendingCodeFactSegments([{ ...segment, group: '变更整组' }], materials, [review]).reused.length, 0);
  const old = { ...review, segments: [{ ...segment, issues: [] }] };
  assert.equal(pendingCodeFactSegments([segment], materials, [old]).reused.length, 0);
});

test('复用出处重新绑定当前路径与文字快照，不沿用旧位置或父级重复标记', () => {
  const citation: any = { category: '客户与合作方', claim: '已服务30家客户。', quote: '已服务30家客户。', targets: [{ pageId: 'home', root: 'body' as const, path: [0, 0], text: '旧位置' }] };
  const current = { ...segment, targets: [{ pageId: 'home', root: 'body' as const, path: [1], text: '客户已服务30家客户。' }, { pageId: 'home', root: 'body' as const, path: [1, 1, 0], text: '已服务30家客户。' }] };
  assert.deepEqual(bindCodeFactCitations(current, [citation])[0].targets, [{ pageId: 'home', root: 'body' as const, path: [1, 1, 0], text: '已服务30家客户。' }]);
});
