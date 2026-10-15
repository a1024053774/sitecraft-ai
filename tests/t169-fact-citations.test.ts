import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pendingCodeFactSegments, bindCodeFactCitations } from '../lib/code-site-fact-segments.ts';
import { codeFactMaterials, codeFactSourceMaterials } from '../lib/code-site.ts';

// Contract oracle: these sentences are supplied independently of the auditor.
const materials = '客户：已服务３０家客户。\n认证：取得 ISO　9001 认证。\n收费：纸盒每件 12 元。';
const segment = { text: '页面 home\n已服务30家客户。', group: '客户组', context: { pageId: 'home', outline: [], headings: [] } };
let citations: any[] = [];
let omitCitations = false;
let emptyCitations = false;
let noFactModelIssues: string[] = [];
const calls: any[] = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); calls.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ results: input.segments.map((s: any) => ({ id: s.id, issues: noFactModelIssues.filter(issue => s.text.includes('长期合作客户')), ...(process.env.P1_PARENT ? {} : { noFacts: emptyCitations ? false : citations.length === 0, factCategories: emptyCitations ? ['客户与合作方'] : citations.map(c => c.category) }), ...(omitCitations ? {} : { citations: emptyCitations ? [] : citations }) })) }) } }], usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } }));
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
  const result: any = await (auditCodeFacts as any)(materials, [segment], false, undefined, materials);
  assert.deepEqual(result[0].issues, []);
  assert.deepEqual(result[0].citations, citations);
  const local: any = await (auditCodeFacts as any)(materials, [segment], true, undefined, materials);
  assert.deepEqual(local[0].citations, citations);
  assert.equal(calls.length, before + 2);
  assert.deepEqual(calls.slice(-2).map(body => body.thinking.type), ['enabled', 'disabled']);
  citations = [{ category: '资质认证', claim: '取得 ISO 9001 认证。', quote: '取得  ISO\n9001 认证。' }];
  const cert: any = await (auditCodeFacts as any)(materials, [{ ...segment, text: '取得 ISO 9001 认证。' }], false, undefined, materials);
  assert.deepEqual(cert[0].issues, []);
});

test('编造、跨字段拼接、网页字段和近似引文返回拒因，不作为已验真出处', async () => {
  for (const quote of ['已服务过30家客户。', '已服务30家客户。取得 ISO 9001 认证。', '页面 home', '已服务31家客户。', '   ']) {
    citations = [{ category: '客户与合作方', claim: '已服务30家客户。', quote }];
    const result: any = await (auditCodeFacts as any)(materials, [segment], false, undefined, materials);
    assert.match(result[0].issues.join('\n'), /资料出处/);
    assert.deepEqual(result[0].citations, []);
  }
});

test('声明必须来自本段，类别必须是高风险类别，遗漏数组不能冒充已记录', async () => {
  citations = [{ category: '客户与合作方', claim: '纸袋', quote: '已服务30家客户。' }];
  const result: any = await (auditCodeFacts as any)(materials, [segment], false, undefined, materials);
  assert.match(result[0].issues.join('\n'), /声明/);
  citations = [{ category: '普通介绍', claim: '已服务30家客户。', quote: '已服务30家客户。' }];
  await assert.rejects((auditCodeFacts as any)(materials, [segment], false, undefined, materials), /核对段/);
  omitCitations = true;
  try { await assert.rejects((auditCodeFacts as any)(materials, [segment], false, undefined, materials), /核对段/); }
  finally { omitCitations = false; }
});

test('高风险事实返回空 citations 必须产生明确拒因，不能作为 complete 保存', async () => {
  citations = [{ category: '客户与合作方', claim: '已服务30家客户。', quote: '已服务30家客户。' }];
  emptyCitations = true;
  try {
    const result: any = await (auditCodeFacts as any)(materials, [{ ...segment, text: '页面 home\n已服务30家客户。' }], false, undefined, materials);
    assert.match(result[0].issues.join('\n'), /缺少有效资料出处/);
    assert.deepEqual(result[0].citations, []);
  } finally { emptyCitations = false; }
});

test('长期合作客户断言返回空 citations 也必须拒绝，不能靠数字关键词绕过', async () => {
  emptyCitations = true;
  try {
    const result: any = await (auditCodeFacts as any)(materials, [{ ...segment, text: '页面 home\n长期合作客户：甲方公司。' }], false, undefined, materials);
    assert.match(result[0].issues.join('\n'), /高风险事实缺少有效资料出处/);
  } finally { emptyCitations = false; }
});

test('资料出处验真排除页面要求，但事实核对输入仍保留完整上下文', async () => {
  const sourceMaterials = '客户：已服务30家客户。';
  const contextualMaterials = `${sourceMaterials}。收费：纸盒每件 CNY 12。页面要求：只做一页首页，不加询盘。`;
  citations = [{ category: '客户与合作方', claim: '只做一页首页', quote: '只做一页首页' }];
  const result: any = await (auditCodeFacts as any)(contextualMaterials, [{ ...segment, text: '页面 home\n只做一页首页' }], false, undefined, sourceMaterials);
  assert.match(result[0].issues.join('\n'), /资料出处无依据/);
  assert.deepEqual(result[0].citations, []);
  assert.match(String(calls.at(-1).messages[1].content), /页面要求：只做一页首页/);
});

test('模型把无资料的长期合作客户句标为无企业事实时，issues 仍拒绝', async () => {
  noFactModelIssues = ['页面原句：长期合作客户：甲方公司。；资料未提供该客户关系。'];
  try {
    const result: any = await (auditCodeFacts as any)(materials, [{ ...segment, text: '页面 home\n长期合作客户：甲方公司。' }], false, undefined, materials);
    assert.match(result[0].issues.join('\n'), /资料未提供该客户关系/);
  } finally { noFactModelIssues = []; }
});

test('原始资料边界过滤页面要求，同时保留完整上下文给模型', () => {
  const site: any = { materials: '企业事实：已服务30家客户。\n页面要求：客户满意度99%仅作设计示例。', factMaterials: '企业事实：已服务30家客户。', versions: [], currentVersionId: null };
  const context = codeFactMaterials(site, '设计要求：只做首页。');
  const source = codeFactSourceMaterials(site, '设计要求：只做首页。');
  assert.match(context, /页面要求：客户满意度99%仅作设计示例/);
  assert.match(context, /设计要求：只做首页/);
  assert.match(source ?? '', /已服务30家客户/);
  assert.doesNotMatch(source ?? '', /客户满意度99%|设计要求/);
});

test('同一行的页面要求不进入独立 factMaterials 源', () => {
  const site: any = { materials: '青禾纸品提供普通纸盒。收费：纸盒每件 CNY 12。页面要求：只做一页首页，不加询盘。', factMaterials: '青禾纸品提供普通纸盒。收费：纸盒每件 CNY 12。', versions: [], currentVersionId: null };
  const source = codeFactSourceMaterials(site);
  assert.equal(source, site.factMaterials);
  assert.doesNotMatch(source ?? '', /只做一页首页/);
});

test('复用同次完整核对的出处；旧记录与变更资料或整组内容必须重核', () => {
  const citation = { category: '客户与合作方', claim: '已服务30家客户。', quote: '已服务30家客户。' };
  const review: any = { format: 3, materials, sourceMaterials: materials, audited: 1, reused: 0, segments: [{ ...segment, issues: [], noFacts: false, factCategories: ['客户与合作方'], citations: [citation] }] };
  const reused: any = pendingCodeFactSegments([segment], materials, [review], materials);
  assert.deepEqual(reused.reused[0].citations, [citation]);
  assert.equal(pendingCodeFactSegments([segment], materials.replace('３０', '３１'), [review], materials.replace('３０', '３１')).reused.length, 0);
  assert.equal(pendingCodeFactSegments([{ ...segment, group: '变更整组' }], materials, [review], materials).reused.length, 0);
  const old = { ...review, format: 2, segments: [{ ...segment, issues: [], citations: [citation] }] };
  assert.equal(pendingCodeFactSegments([segment], materials, [old]).reused.length, 0);
});

test('复用出处重新绑定当前路径与文字快照，不沿用旧位置或父级重复标记', () => {
  const citation: any = { category: '客户与合作方', claim: '已服务30家客户。', quote: '已服务30家客户。', targets: [{ pageId: 'home', root: 'body' as const, path: [0, 0], text: '旧位置' }] };
  const current = { ...segment, targets: [{ pageId: 'home', root: 'body' as const, path: [1], text: '客户已服务30家客户。' }, { pageId: 'home', root: 'body' as const, path: [1, 1, 0], text: '已服务30家客户。' }] };
  assert.deepEqual(bindCodeFactCitations(current, [citation])[0].targets, [{ pageId: 'home', root: 'body' as const, path: [1, 1, 0], text: '已服务30家客户。' }]);
});

test('真实小跑的表格单行声明跨单元格仍属于本段，绑定最小行并保留行界与引文验真', async () => {
  // 2026-10-14 真实候选的菜单行；期待值来自已提供的菜单资料。
  const row = '<TR>\n<TD>家常饭</TD>\n<TD>每份</TD>\n<TD>18 元</TD>\n</TR>';
  const table = `<TABLE>\n<THEAD><TR><TH>品名</TH><TH>规格</TH><TH>价格</TH></TR></THEAD>\n<TBODY>${row}</TBODY>\n</TABLE>`;
  citations = [{ category: '价格与收费', claim: '家常饭 每份 18 元', quote: '家常饭每份18元。' }];
  const tableTarget = { pageId: 'menu', root: 'main' as const, path: [1, 0], text: '品名 规格 价格 家常饭 每份 18 元', readable: table };
  const rowTarget = { pageId: 'menu', root: 'main' as const, path: [1, 0, 2, 0], text: '家常饭 每份 18 元', readable: row };
  const menu = { text: table, group: table, context: { pageId: 'menu', outline: [], headings: [] }, targets: [tableTarget, rowTarget] };
  for (const local of [false, true]) {
    const result = await auditCodeFacts('家常饭每份18元。', [menu], local, undefined, '家常饭每份18元。');
    assert.deepEqual(result[0].issues, []);
    assert.deepEqual(result[0].citations, citations);
    assert.deepEqual(bindCodeFactCitations(menu, result[0].citations!)[0].targets, [{ pageId: 'menu', root: 'main', path: [1, 0, 2, 0], text: '家常饭 每份 18 元' }]);
  }
  const text = '<TABLE><TR><TD>已服务</TD></TR><TR><TD>30家客户</TD></TR></TABLE>';
  citations = [{ category: '客户与合作方', claim: '已服务 30家客户', quote: '已服务30家客户。' }];
  const result = await auditCodeFacts('已服务30家客户。', [{ ...segment, text }], false, undefined, '已服务30家客户。');
  assert.match(result[0].issues.join('\n'), /声明不在本核对段/);
  assert.deepEqual(result[0].citations, []);
  citations = [{ category: '客户与合作方', claim: '已服务30家客户。', quote: '<TD>已服务30家客户。</TD>' }];
  const invalidQuote = await auditCodeFacts('已服务30家客户。', [segment], false, undefined, '已服务30家客户。');
  assert.match(invalidQuote[0].issues.join('\n'), /资料出处无依据/);
  assert.deepEqual(invalidQuote[0].citations, []);
});
