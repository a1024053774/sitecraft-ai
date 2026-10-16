import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import type { AnnotationBatchItem, AnnotationTarget } from '../lib/annotations.ts';

// Failure modes: ancestor paint escapes; generated boxes escape; batch user
// facts lose provenance; merged comments lose their own pointer; :has(:focus)
// prevents a legal batch from reaching its model; old citations survive later
// selections; infrastructure failures become extra model calls. Assertions
// cross POST or commitSiteCode. Models/after use local substitutes; the browser
// wrapper injects one missing CHROME_PATH read into the real factory.
const callbacks: Array<() => Promise<void>> = [];
(globalThis as any).__t164SevenAfter = callbacks;
const browserUrl = pathToFileURL(path.join(process.cwd(), 'lib/code-site-browser.ts')).href;
const faultBrowserUrl = 'data:text/javascript,' + encodeURIComponent(`
  import { codeCheckBrowser as realBrowser } from ${JSON.stringify(browserUrl + '?t164-infrastructure-boundary')};
  export function codeCheckBrowser() {
    if (!globalThis.__t164TransientChromeFault) return realBrowser();
    globalThis.__t164TransientChromeFault = false;
    const saved = process.env.CHROME_PATH;
    delete process.env.CHROME_PATH;
    try { return realBrowser(); }
    finally { if (saved === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = saved; }
  }
`);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t164SevenAfter.push(fn)}' };
  if (specifier.startsWith('@/')) {
    const file = path.join(process.cwd(), specifier.slice(2));
    specifier = pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href;
  }
  const resolved = next(specifier, context);
  return resolved.url === browserUrl ? { shortCircuit: true, url: faultBrowserUrl } : resolved;
} });
const { createCodeSite, getCodeSite, updateCodeSite, commitSiteCode } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { POST } = await import('../app/api/sites/[siteId]/chat/route.ts');
const requests: Array<{ local: boolean; input: any }> = [];
const observations: unknown[] = [];
let transformLocal: ((input: any) => string) | undefined;
let faultAfterLocalReplies = 0;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  const local = body.messages[0].content.includes('本次局部修改');
  requests.push({ local, input });
  let answer: unknown;
  if (local) {
    const time = input.request.match(/营业时间为(\d+)点/);
    answer = { html: transformLocal ? transformLocal(input) : time ? input.html.replace('</section>', `<p>营业时间为${time[1]}点。</p></section>`) : input.html, css: '' };
    if (faultAfterLocalReplies > 0 && --faultAfterLocalReplies === 0) (globalThis as any).__t164TransientChromeFault = true;
  } else {
    assert.ok(Array.isArray(input.segments), '替身只接受实际分段事实核对');
    answer = { results: input.segments.map((segment: { id: string; text: string }) => {
      const time = segment.text.match(/营业时间为(\d+)点。/);
      const quote = time?.[0];
      const supported = !!quote && input.sourceMaterials?.some((source: { text: string }) => source.text.includes(quote));
      return { id: segment.id, issues: time && !supported ? [`页面原句：${quote}；资料没有的数字：${time[1]}`] : [],
        noFacts: !supported, factCategories: supported ? ['时间与交期承诺'] : [],
        citations: supported ? [{ category: '时间与交期承诺', claim: quote, quote }] : [] };
    }) };
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const output = `artifacts/t164/review-seven-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
test.after(async () => {
  await writeFile(`${output}/evidence.json`, JSON.stringify({ requests, observations }, null, 2), 'utf8');
  await new Promise<void>(resolve => provider.close(() => resolve()));
});
async function chat(id: string, input: unknown) {
  return POST(new Request(`${process.env.SITECRAFT_BASE}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }), { params: Promise.resolve({ siteId: id }) });
}
async function settle(id: string) {
  for (const fn of callbacks.splice(0)) await fn();
  const site = (await getCodeSite(id))!;
  observations.push({ id, run: site.run, sources: site.factSources, versions: site.versions.map(version => ({ revision: version.revision, checks: version.checks })) });
  return site;
}
async function fixture(css = '', html = '<main><section><h1>清禾小馆</h1><p>小馆介绍</p></section><section><h2>门店</h2><p>门店介绍</p></section><p class="outside">外部</p></main>', materials = '公司名：清禾小馆。小馆介绍。门店介绍。外部。入口。') {
  const id = `t164-seven-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(id, `conversation-${id}`);
  await createCodeSite(id, '清禾小馆', conversation.conversationId);
  const material = await chat(id, { message: materials, baseRevision: 0 });
  assert.equal(material.status, 200, await material.text());
  await updateCodeSite(id, () => ({ plan: { style: 'precision', summary: '小馆', styleReason: '测试', pages: [{ id: 'home', title: '首页', outline: '小馆与门店' }] } }));
  const code: SiteCode = { header: '', footer: '', css: 'body{margin:0;color:#111;background:white;font:16px/1.6 sans-serif}main{height:400px}section{height:120px}' + css, pages: [{ id: 'home', title: '首页', html }] };
  const initial = await commitSiteCode({ siteId: id, baseRevision: 0, code, author: 'user', summary: '审查夹具', request: '' });
  assert.equal(initial.status, 'applied', initial.status === 'rejected' ? initial.checks.issues.join('\n') : initial.status);
  if (initial.status !== 'applied') throw new Error('夹具未通过提交入口');
  const target: AnnotationTarget = { kind: 'dom', pageId: 'home', versionId: initial.version.id, path: [0], text: '清禾小馆小馆介绍', label: '小馆' };
  return { id, code: initial.version.code, target };
}
function batchItem(target: AnnotationTarget, body: string): AnnotationBatchItem {
  return { draftId: crypto.randomUUID(), target, revision: 1, body };
}

test('祖先 main 自身的 focus-within 背景改变必须拒绝，不存版本', async () => {
  const { id, code, target } = await fixture('main{background:white}main:focus-within{background:black}');
  const candidate = structuredClone(code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '祖先背景', request: '增加入口' });
  observations.push({ case: 'ancestor', result });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.ok(result.checks.issues.some(issue => /路径 \[1,0\] 的完整计算样式/.test(issue)), '必须捕获 main 自身，不能仅因其他节点拒绝');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('祖先规则在焦点态改变明确高度仍须拒绝', async () => {
  const { id, code, target } = await fixture('main:focus-within{height:320px}');
  const candidate = structuredClone(code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '祖先高度', request: '增加入口' });
  observations.push({ case: 'ancestor-height', result });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.ok(result.checks.issues.some(issue => /路径 \[1,0\] 的完整计算样式/.test(issue)), '必须比较 main 自身的明确高度');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

for (const pseudo of ['::before', '::after', '::marker', '::first-line', '::first-letter']) {
  test(`区块外 ${pseudo} 的完整计算样式改变必须拒绝`, async () => {
    const { id, code, target } = await fixture(`.outside${pseudo}{content:"外部";color:rgb(17,17,17);background:white}main:focus-within .outside${pseudo}{color:rgb(220,20,20);background:black}`,
      '<main><section><h1>清禾小馆</h1><p>小馆介绍</p></section><ul><li class="outside">外部</li></ul></main>');
    const candidate = structuredClone(code);
    candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
    const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '伪元素外溢', request: '增加入口' });
    observations.push({ case: pseudo, result });
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.ok(result.checks.issues.some(issue => issue.includes(pseudo)), '拒因须定位相应伪元素');
    assert.equal((await getCodeSite(id))!.versions.length, 1);
  });
}

test('范围外已存在的自定义属性只改变值时仍须拒绝', async () => {
  const { id, code, target } = await fixture('.outside{--leak:0px}main:focus-within .outside{--leak:123px}');
  const candidate = structuredClone(code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '自定义属性值', request: '增加入口' });
  observations.push({ case: 'custom-property-value', result });
  assert.equal(result.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('批注事实原文按消息登记、进入本组写作与核对并能引用，成功后仍可沿用', async () => {
  const { id, target } = await fixture();
  const items = [batchItem(target, '补充事实：营业时间为18点。请放到这里。'), batchItem({ ...target, path: [1], text: '门店门店介绍', label: '门店' }, '保留门店介绍，合法空 CSS。')];
  const begin = requests.length;
  const response = await chat(id, { message: '批量局部修改', baseRevision: 1, annotationBatch: items, saveAnnotation: true });
  assert.equal(response.status, 202, await response.text());
  const site = await settle(id);
  assert.equal(site.run!.status, 'complete', JSON.stringify(site.run!.issues));
  assert.equal(site.versions.length, 2);
  const messages = site.factSources!.filter(source => source.type === 'message');
  assert.deepEqual(messages.map(source => source.text), ['公司名：清禾小馆。小馆介绍。门店介绍。外部。入口。', ...items.map(item => item.body)]);
  assert.deepEqual(messages.map(source => source.messageIndex), [1, 2, 3]);
  const localInputs = requests.slice(begin).filter(request => request.local).map(request => request.input);
  assert.ok(localInputs[0].materials.includes(items[0].body), '本组事实原文进入写作');
  assert.ok(!localInputs[1].materials.includes(items[0].body), '另一组意见不泄漏到写作上下文');
  const current = site.versions.at(-1)!;
  const citation = current.checks.factCitations!.entries.find(citation => citation.claim === '营业时间为18点。');
  assert.deepEqual(citation?.source, { type: 'message', messageIndex: 2 });
  assert.ok(current.factSourceSnapshot?.some(source => source.text === items[0].body));
  // A later local change must retain the adopted batch fact and its provenance.
  const again = await chat(id, { message: '保留内容，合法空 CSS。', baseRevision: 2, selectedTarget: { ...target, versionId: current.id, text: '清禾小馆小馆介绍营业时间为18点。' } });
  assert.equal(again.status, 202, await again.text());
  const later = await settle(id);
  assert.equal(later.run!.status, 'complete', JSON.stringify(later.run!.issues));
  assert.ok(later.versions.at(-1)!.checks.factCitations?.entries.some(citation => citation.claim === '营业时间为18点。' && citation.source?.type === 'message' && citation.source.messageIndex === 2));
});

test('同区块合组的每条意见保留自己的 h1 或 p 元素提示', async () => {
  const { id, target } = await fixture();
  const items = [batchItem({ ...target, element: { path: [0], tag: 'h1', text: '清禾小馆' } }, '把这里加粗'), batchItem({ ...target, element: { path: [1], tag: 'p', text: '小馆介绍' } }, '把这里改成灰色')];
  const begin = requests.length;
  const response = await chat(id, { message: '批量局部修改', baseRevision: 1, annotationBatch: items });
  assert.equal(response.status, 202, await response.text());
  const site = await settle(id);
  assert.equal(site.run!.status, 'complete', JSON.stringify(site.run!.issues));
  const locals = requests.slice(begin).filter(request => request.local);
  assert.equal(locals.length, 1, '同区块只调用一次局部写作');
  assert.deepEqual(locals[0].input.edits, items.map(item => ({ draftId: item.draftId, request: item.body, pointedElement: item.target.element })));
});

test('真实 chat 批次遇到 main:has(:focus) 仍允许合法无外溢修改进入模型并保存', async () => {
  const { id, target } = await fixture('main:has(:focus) .outside{background:black}');
  const begin = requests.length;
  const response = await chat(id, { message: '批量局部修改', baseRevision: 1, annotationBatch: [batchItem(target, '保留内容，合法空 CSS。')] });
  assert.equal(response.status, 202, await response.text());
  const site = await settle(id);
  assert.equal(site.run!.status, 'complete', JSON.stringify(site.run!.issues));
  assert.equal(site.versions.length, 2);
  const locals = requests.slice(begin).filter(request => request.local);
  assert.equal(locals.length, 1);
  assert.ok(locals[0].input.css.includes('main:has(:focus)'), '相关规则原样交给局部写作');
});

for (const removeSecond of [false, true]) {
  test(removeSecond ? '多选区删除第二处事实后清除旧出处与失效定位' : '多选区保留两处事实时全部重绑出处，不报重复', async () => {
    const { id, target } = await fixture('',
      '<main><section><h1>清禾小馆</h1><p>营业时间为18点。</p></section><section><h2>门店</h2><p>营业时间为19点。</p></section></main>',
      '公司名：清禾小馆\n小馆介绍。门店介绍。小馆营业时间为18点。门店营业时间为19点。');
    const initial = (await getCodeSite(id))!.versions[0].checks.factCitations!;
    assert.equal(initial.complete, true);
    assert.deepEqual(initial.entries.map(entry => entry.claim).sort(), ['营业时间为18点。', '营业时间为19点。']);
    const items = [batchItem({ ...target, text: '清禾小馆营业时间为18点。' }, '保留小馆原文，仅调整段落包装。'),
      batchItem({ ...target, path: [1], text: '门店营业时间为19点。', label: '门店' }, removeSecond ? '删除本区块营业时间。' : '保留门店原文。')];
    transformLocal = input => input.request.includes('删除本区块营业时间') ? input.html.replace('<p>营业时间为19点。</p>', '')
      : input.request.includes('调整段落包装') ? input.html.replace('<p>营业时间为18点。</p>', '<div><p>营业时间为18点。</p></div>') : input.html;
    try {
      const response = await chat(id, { message: '批量局部修改', baseRevision: 1, annotationBatch: items, saveAnnotation: true });
      assert.equal(response.status, 202, await response.text());
      const site = await settle(id);
      assert.equal(site.run!.status, 'complete', site.run!.step);
      assert.equal(site.versions.length, 2);
      const version = site.versions.at(-1)!;
      const citations = version.checks.factCitations!;
      assert.equal(citations.complete, true);
      const expectedClaims = removeSecond ? ['营业时间为18点。'] : ['营业时间为18点。', '营业时间为19点。'];
      assert.deepEqual(citations.entries.map(entry => entry.claim).sort(), expectedClaims, '只保留当前内容的出处，不保留第二选区旧记录');
      assert.deepEqual(citations.entries.find(entry => entry.claim === '营业时间为18点。')?.targets?.map(location => location.path), [[0, 1, 0]], '首处出处须跟随新包装重新定位');
      if (removeSecond) {
        assert.doesNotMatch(version.code.pages[0].html, /19点/);
        assert.ok(!citations.entries.some(entry => entry.targets?.some(location => JSON.stringify(location.path) === '[1,1]')), '删除节点的旧定位必须消失');
      } else {
        assert.deepEqual(citations.entries.find(entry => entry.claim === '营业时间为19点。')?.targets?.map(location => location.path), [[1, 1]]);
      }
    } finally { transformLocal = undefined; }
  });
}

test('两组写作后一次瞬时 CHROME_PATH 故障直接终止，不追加模型调用或存版', async () => {
  const { id, target } = await fixture();
  const items = [batchItem(target, '保留小馆内容。'), batchItem({ ...target, path: [1], text: '门店门店介绍', label: '门店' }, '保留门店内容。')];
  const begin = requests.length;
  faultAfterLocalReplies = 2;
  try {
    const response = await chat(id, { message: '批量局部修改', baseRevision: 1, annotationBatch: items, saveAnnotation: true });
    assert.equal(response.status, 202, await response.text());
    const site = await settle(id);
    assert.equal((globalThis as any).__t164TransientChromeFault, false, '必须实际消耗一次故障');
    assert.equal(site.run!.status, 'error', '基础设施错误不能伪装成模型修正后完成');
    assert.match(site.run!.step, /CHROME_PATH/);
    assert.equal(site.versions.length, 1);
    assert.equal(requests.slice(begin).filter(request => request.local).length, 2, '每组仅第一次写作，不得因基础设施故障追加调用');
    assert.equal(site.run!.repairRound, 0);
    assert.equal(site.run!.attempts.length, 0);
  } finally {
    faultAfterLocalReplies = 0;
    (globalThis as any).__t164TransientChromeFault = false;
  }
});
