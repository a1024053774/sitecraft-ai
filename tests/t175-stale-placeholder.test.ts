import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import { parseFragment, type DefaultTreeAdapterTypes as Dom } from 'parse5';
import { base, workflowBase, commitSiteCode, updateCodeSite, session, state } from './helpers/t162-browser.ts';
import { localEditChoice } from './fixtures/local-edit-choice.ts';
import type { CodeSiteRecord, SiteCode } from '../lib/code-site.ts';
import { annotationDraftSchema, annotationTargetSchema } from '../lib/annotations.ts';

// 期望来自 T-175：逐字同项、范围外、一次持久化提示、按钮只加草稿。
// 失效方式先列于票中；此文件先在 d7e0aa2 运行，再实现产品行为。
const output = `artifacts/t175/run-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const restaurant = JSON.parse(await readFile(new URL('./fixtures/t175-restaurant.json', import.meta.url), 'utf8'));
const quote = '外带包装费现在确定为每单2元。';
let auditQuote = quote;
let auditQuotes: string[] | undefined;
let cite = false, calls = 0;
const providerErrors: string[] = [];
const provider = createServer(async (request, response) => {
  try {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw), input = JSON.parse(body.messages[1].content.split('\n')[0]);
    calls++;
    const local = body.tools?.[0]?.function.name === 'submit_local_edit';
    if (!local && !Array.isArray(input.segments)) throw new Error('替身只接受局部写作和事实核对');
    const results = !local ? input.segments.map((segment: { id: string; text: string }) => {
      const adopted = cite && segment.text.includes('每单 2 元。');
      return { id: segment.id, issues: [], noFacts: !adopted,
        factCategories: adopted ? ['价格与收费'] : [],
        citations: adopted ? (auditQuotes ?? [auditQuote]).map(quote => ({ category: '价格与收费', claim: '每单 2 元。', quote })) : [] };
    }) : null;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [local ? localEditChoice({ html: input.html, css: '' })
      : { finish_reason: 'stop', message: { content: JSON.stringify({ results }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
  } catch (error) { providerErrors.push(String(error)); response.writeHead(500); response.end('本地替身协议错误'); }
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
test.after(async () => { await new Promise<void>(resolve => provider.close(() => resolve())); assert.deepEqual(providerErrors, []); });

async function create() {
  const response = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '禾巷小馆' }) });
  assert.equal(response.status, 201); return (await response.json()).id as string;
}
const code: SiteCode = {
  header: '', footer: '', css: 'body{margin:0;color:#222;background:white;font:16px/1.8 sans-serif}main{padding:24px;max-width:700px}p{max-width:36em}',
  pages: [
    { id: 'home', title: '首页', html: '<main><section><h1>收费口径</h1><p>每单 2 元。</p><p>外带包装费待补充。</p></section><section><h2>外带</h2><p>外带包装费待补充。</p></section></main>' },
    { id: 'menu', title: '菜单页', html: '<main><section><h1>米饭与收费</h1><p>外带包装费待补充。</p><p>外带包装费待补充。</p><p>打包费待补充。</p><p>外带包装费用待补充。</p><p>费用，外带包装费待补充。</p><p>费用\n外带包装费待补充。</p><p><span>外带包装</span>费待补充。</p><p>待补充。</p><p>费待补充。</p><p>外带包装费，待补充。</p><p>其他外带包装费待补充。</p></section></main>' },
  ],
};
async function initial(candidate = code) {
  cite = false; auditQuote = quote; auditQuotes = undefined;
  const id = await create();
  await updateCodeSite(id, () => ({ materials: quote, factSources: [{ type: 'materials', messageIndex: 1, text: quote }], plan: { summary: '收费说明', style: 'precision', styleReason: '测试', pages: code.pages.map(p => ({ ...p, outline: '收费' })) } }));
  const saved = await commitSiteCode({ siteId: id, baseRevision: 0, code: candidate, author: 'user', summary: '初版', request: '' });
  assert.equal(saved.status, 'applied', JSON.stringify(saved));
  if (saved.status !== 'applied') throw new Error('初版未存成');
  return { id, version: saved.version, target: { kind: 'dom' as const, pageId: 'home', versionId: saved.version.id, path: [0], label: '收费口径', text: '收费口径每单 2 元。外带包装费待补充。' } };
}

test('逐字同项仅提示范围外：跨页、标点换行和元素边界，不猜近义词或空短事项名', { timeout: 120000 }, async () => {
  const { id, version, target } = await initial(); cite = true;
  const saved = await commitSiteCode({ siteId: id, baseRevision: version.revision, code, selectedTarget: target, author: 'assistant', summary: '补充收费', request: quote, source: { type: 'message', messageIndex: 2, text: quote } });
  assert.equal(saved.status, 'applied', JSON.stringify(saved)); if (saved.status !== 'applied') return;
  const hits = (saved.version as any).stalePlaceholders ?? [];
  // 两个相同段落是两个位置，多条核对出处不能把它们重复登记。
  assert.deepEqual(hits.map((hit: any) => [hit.pageTitle, hit.snippet]), [
    ['首页', '外带包装费待补充。'], ['菜单页', '外带包装费待补充。'], ['菜单页', '外带包装费待补充。'],
    ['菜单页', '费用，外带包装费待补充。'], ['菜单页', '外带包装费待补充。'],
  ]);
  assert.ok(hits.every((hit: any) => hit.target.versionId === saved.version.id));
  assert.ok(hits.filter((hit: any) => hit.target.pageId === 'home').every((hit: any) => hit.target.path[0] === 1), '范围内不提示');
  const loaded = (await state(id)).codeSite.versions.at(-1);
  assert.deepEqual(loaded.stalePlaceholders, hits, '读回版本不追加或重建提示');
  const batch = await commitSiteCode({ siteId: id, baseRevision: saved.version.revision, code,
    selectedTargets: [{ ...target, versionId: saved.version.id }, blockTarget(code.pages[1].html, saved.version.id, 0, 'menu')],
    author: 'assistant', summary: '并集范围', request: quote, source: { type: 'message', messageIndex: 3, text: quote } });
  assert.equal(batch.status, 'applied'); if (batch.status !== 'applied') return;
  assert.deepEqual((batch.version as any).stalePlaceholders?.map((hit: any) => [hit.target.pageId, hit.target.path]), [['home', [1]]], '两个修改区块的并集全部排除');
  const page = await commitSiteCode({ siteId: id, baseRevision: batch.version.revision, code, pageId: 'home',
    author: 'assistant', summary: '整页范围', request: quote, source: { type: 'message', messageIndex: 4, text: quote } });
  assert.equal(page.status, 'applied'); if (page.status !== 'applied') return;
  assert.equal((page.version as any).stalePlaceholders?.length, 4);
  assert.ok((page.version as any).stalePlaceholders?.every((hit: any) => hit.target.pageId === 'menu'), '整页修改排除本页全部位置');
});

test('更换事项名和页面标题仍按本次出处匹配，不能写死包装费样本', { timeout: 120000 }, async () => {
  const candidate = structuredClone(code);
  candidate.pages[0].html = candidate.pages[0].html.replaceAll('外带包装费', '夜间保温盒费');
  candidate.pages[1].title = '夜间外带说明';
  candidate.pages[1].html = '<main><section><h1>夜间外带</h1><p>夜间保温盒费待补充。</p><p>外带包装费待补充。</p></section></main>';
  const { id, version, target } = await initial(candidate);
  auditQuote = '夜间保温盒费现在确定为每单2元。'; cite = true;
  const saved = await commitSiteCode({ siteId: id, baseRevision: version.revision, code: candidate,
    selectedTarget: { ...target, text: '收费口径每单 2 元。夜间保温盒费待补充。' },
    author: 'assistant', summary: '新事项', request: auditQuote, source: { type: 'message', messageIndex: 2, text: auditQuote } });
  assert.equal(saved.status, 'applied'); if (saved.status !== 'applied') return;
  assert.deepEqual((saved.version as any).stalePlaceholders?.map((hit: any) => [hit.pageTitle, hit.snippet]), [
    ['首页', '夜间保温盒费待补充。'], ['夜间外带说明', '夜间保温盒费待补充。'],
  ]);
});

test('没有本次新增消息出处原句时不提示；相同消息出处不能当作新来源', { timeout: 120000 }, async () => {
  const { id, version, target } = await initial(); cite = true;
  const adopted = await commitSiteCode({ siteId: id, baseRevision: version.revision, code, selectedTarget: target, author: 'assistant', summary: '消息来源', request: quote, source: { type: 'message', messageIndex: 2, text: quote } });
  assert.equal(adopted.status, 'applied'); if (adopted.status !== 'applied') return;
  assert.ok((adopted.version as any).stalePlaceholders?.length, '同样资料有本次消息出处时应提示，作为成对对照');
  for (const source of [undefined, { type: 'message' as const, messageIndex: 2, text: quote }, { type: 'upload' as const, sourceId: 'same-quote', name: '资料.txt', text: quote }]) {
    const current = (await state(id)).codeSite.versions.at(-1);
    const saved = await commitSiteCode({ siteId: id, baseRevision: current.revision, code, selectedTarget: { ...target, versionId: current.id }, author: 'assistant', summary: '无新消息出处', request: quote, source });
    assert.equal(saved.status, 'applied', JSON.stringify(saved)); if (saved.status !== 'applied') return;
    assert.equal((saved.version as any).stalePlaceholders?.length ?? 0, 0);
  }
  cite = false;
  const current = (await state(id)).codeSite.versions.at(-1);
  const noCitation = await commitSiteCode({ siteId: id, baseRevision: current.revision, code, selectedTarget: { ...target, versionId: current.id }, author: 'assistant', summary: '新消息未成为出处', request: quote, source: { type: 'message', messageIndex: 9, text: quote } });
  assert.equal(noCitation.status, 'applied'); if (noCitation.status === 'applied') assert.equal((noCitation.version as any).stalePlaceholders?.length ?? 0, 0);
});

// P1 反例：事实验真允许等价文字，提示匹配仍必须使用用户原文。
// 四个方向分别防止误报与漏报；同消息的未采用句子不得扩大匹配范围。
for (const sample of [
  { name: '全角原文、半角引文', raw: '型号ＡＢ认证', cited: '型号AB认证' },
  { name: '半角原文、全角引文', raw: '型号AB认证', cited: '型号ＡＢ认证' },
  { name: '双空格原文、单空格引文', raw: '外带  包装费', cited: '外带 包装费' },
  { name: '单空格原文、换行引文', raw: '外带 包装费', cited: '外带\n包装费', other: '外带  包装费' },
]) test(`已通过出处回到实际消息逐字匹配：${sample.name}`, { timeout: 120000 }, async () => {
  const candidate = structuredClone(code);
  candidate.pages[1].html = `<main><section><h1>收费说明</h1><p>${sample.raw}待补充。</p><p>${sample.other ?? sample.cited}待补充。</p><p>夜间服务费待补充。</p></section></main>`;
  const { id, version, target } = await initial(candidate);
  const original = `${sample.raw}现在确定为每单2元。`;
  auditQuote = `${sample.cited}现在确定为每单2元。`; cite = true;
  const saved = await commitSiteCode({ siteId: id, baseRevision: version.revision, code: candidate, selectedTarget: target,
    author: 'assistant', summary: '采用新出处', request: `${original}夜间服务费已有。`,
    source: { type: 'message', messageIndex: 2, text: `${original}夜间服务费已有。` } });
  assert.equal(saved.status, 'applied', JSON.stringify(saved)); if (saved.status !== 'applied') return;
  assert.deepEqual(saved.version.stalePlaceholders?.map(hit => [hit.snippet, hit.quote]), [[`${sample.raw}待补充。`, original]],
    '只命中原文逐字出现的事项，保存用户原句，不采用模型的等价改写或未采用句子');
});

test('同一文本节点的多个占位各自登记，不吞掉后一个事项', { timeout: 120000 }, async () => {
  const candidate = structuredClone(code);
  candidate.pages[1].html = '<main><section><h1>收费说明</h1><p>外带包装费待补充；夜间服务费待补充。</p></section></main>';
  const { id, version, target } = await initial(candidate);
  auditQuotes = ['外带包装费现在确定为每单2元。', '夜间服务费现在确定为每单2元。'];
  auditQuote = auditQuotes.join(''); cite = true;
  const saved = await commitSiteCode({ siteId: id, baseRevision: version.revision, code: candidate, selectedTarget: target,
    author: 'assistant', summary: '同节点多事项', request: auditQuote, source: { type: 'message', messageIndex: 2, text: auditQuote } });
  assert.equal(saved.status, 'applied', JSON.stringify(saved)); if (saved.status !== 'applied') return;
  assert.deepEqual(saved.version.stalePlaceholders?.filter(hit => hit.target?.pageId === 'menu').map(hit => [hit.snippet, hit.quote]),
    [['外带包装费待补充；夜间服务费待补充。', '外带包装费现在确定为每单2元。'],
      ['外带包装费待补充；夜间服务费待补充。', '夜间服务费现在确定为每单2元。']], '同节点两个事项各自绑定对应原句，不能重复登记第一个事项');
  const oldDraft = { id: 'old-draft', target, revision: 1, body: '原有历史意见', status: 'draft' };
  const sendingDraft = { id: 'sending-draft', target: { ...target, versionId: saved.version.id }, revision: 2,
    body: '发送中的意见', status: 'sending', submissionId: crypto.randomUUID() };
  const view = await session(1440, { siteId: id });
  try {
    await view.browser.evaluate(`localStorage.setItem('sitecraft-annotation-drafts:${id}',${JSON.stringify(JSON.stringify([oldDraft, sendingDraft]))})`);
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===2`);
    const beforeCalls = calls;
    await view.click('[data-testid="stale-placeholder-add"]');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===5`);
    const drafts = await view.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${id}'))`);
    assert.deepEqual(drafts.slice(0, 2), [oldDraft, sendingDraft], '一起更新保留原有草稿及发送中草稿的全部字段');
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===5`);
    assert.deepEqual((await view.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${id}'))`)).slice(0, 2), [oldDraft, sendingDraft]);
    await view.click('[data-draft-id="old-draft"] [data-testid="annotation-reveal"]');
    await view.wait(`document.querySelector('.code-preview-version')?.textContent.includes('v1')`);
    assert.equal(await view.browser.evaluate(`document.querySelectorAll('[data-testid="stale-placeholder-prompt"]').length`), 0, '历史回看不显示当前版本同项提示');
    assert.equal(calls, beforeCalls, '添加、刷新及历史回看不调用模型');
  } finally { await view.browser.close(); }
});

for (const width of [1440, 768, 375]) test(`空白标题采用区块正文，新增和原有草稿刷新后均读回 ${width}`, { timeout: 120000 }, async () => {
  const candidate = structuredClone(code);
  candidate.pages[1].html = '<main><section><h1> \n\t </h1><p>外带包装费待补充。</p></section></main>';
  const { id, version, target } = await initial(candidate); cite = true;
  const saved = await commitSiteCode({ siteId: id, baseRevision: version.revision, code: candidate, selectedTarget: target,
    author: 'assistant', summary: '空白标题', request: quote, source: { type: 'message', messageIndex: 2, text: quote } });
  assert.equal(saved.status, 'applied', JSON.stringify(saved)); if (saved.status !== 'applied') return;
  const view = await session(width, { siteId: id });
  try {
    const existing = { id: 'previous-draft', target: { ...target, versionId: saved.version.id }, revision: 2, body: '原有意见', status: 'draft' };
    await view.browser.evaluate(`localStorage.setItem('sitecraft-annotation-drafts:${id}',${JSON.stringify(JSON.stringify([existing]))})`);
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===1`);
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    await view.click('[data-testid="stale-placeholder-add"]');
    const drafts = await view.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${id}'))`);
    // 先保留实际写入，再断言 schema；父版本不能把损坏记录覆盖成成功。
    await writeFile(`${output}/blank-heading-drafts-${width}.json`, JSON.stringify(drafts, null, 2), 'utf8');
    const validTargets = saved.version.stalePlaceholders!.every(hit => annotationTargetSchema.safeParse(hit.target).success);
    const validDrafts = annotationDraftSchema.array().safeParse(drafts).success;
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===3 || document.body?.textContent?.includes('批注草稿无法读取')`);
    assert.equal(await view.browser.evaluate(`document.querySelectorAll('[data-testid="annotation-draft"]').length`), 3, '刷新须读回原有草稿及首页、菜单页两条新草稿');
    assert.equal(validTargets, true, '生成锚点符合现有 schema');
    assert.equal(validDrafts, true, '整个草稿集合符合现有 schema');
    assert.deepEqual(drafts[0], existing);
    assert.equal(drafts[2].target.label, '外带包装费待补充。', '菜单页的空标题回退到区块正文');
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    await view.browser.evaluate(`document.querySelectorAll('[data-testid="annotation-draft"]')[2].scrollIntoView({block:'center'})`);
    await view.shot(`blank-heading-${width}`);
  } finally { await view.browser.close(); }
});

test('原句过长无法形成合法草稿时说明缺口，不保存非法草稿', { timeout: 120000 }, async () => {
  const candidate = structuredClone(code);
  candidate.pages[1].html = '<main><section><h1>收费说明</h1><p>外带包装费待补充。</p></section></main>';
  const { id, version, target } = await initial(candidate);
  const original = `外带包装费${' '.repeat(3950)}现在确定为每单2元。`;
  assert.ok(original.length < 4000, '消息仍在现有输入上限以内');
  auditQuote = '外带包装费 现在确定为每单2元。'; cite = true;
  const saved = await commitSiteCode({ siteId: id, baseRevision: version.revision, code: candidate, selectedTarget: target,
    author: 'assistant', summary: '保留长原句', request: original, source: { type: 'message', messageIndex: 2, text: original } });
  assert.equal(saved.status, 'applied', JSON.stringify(saved)); if (saved.status !== 'applied') return;
  const view = await session(1440, { siteId: id });
  try {
    await view.wait(`document.querySelector('[data-testid="stale-placeholder-prompt"]')`);
    assert.match(await view.browser.evaluate<string>(`document.querySelector('[data-testid="stale-placeholder-prompt"]').textContent`), /无法加入批注草稿/);
    assert.equal(await view.browser.evaluate(`document.querySelector('[data-testid="stale-placeholder-add"]').disabled`), true);
    assert.equal(await view.browser.evaluate(`localStorage.getItem('sitecraft-annotation-drafts:${id}')`), null, '不保存不符合 schema 的草稿');
    await view.shot('unavailable-draft');
  } finally { await view.browser.close(); }
});

function blockTarget(html: string, versionId: string, blockIndex = 5, pageId = 'home') {
  const root = parseFragment(html), main = root.childNodes.find(node => 'tagName' in node && node.tagName === 'main') as Dom.Element;
  const block = main.childNodes.filter(node => 'tagName' in node)[blockIndex] as Dom.Element;
  const text = (node: Dom.Node): string => node.nodeName === '#text' ? (node as Dom.TextNode).value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
  return { kind: 'dom' as const, pageId, versionId, path: [blockIndex], label: '收费口径', text: text(block).replace(/\s+/g, ' ').trim().slice(0, 1000) };
}

for (const width of [1440, 768, 375]) test(`禾巷小馆 v2 经生产 chat 重放：提示与一起更新草稿刷新恢复 ${width}`, { timeout: 120000 }, async () => {
  const id = await create(), empty = (await state(id)).codeSite;
  // 用户指定的只读 v2 副本；仅写本轮 npm test 已核对的数据根。
  const seed: CodeSiteRecord = { ...empty, name: restaurant.name, materials: restaurant.materials, preferences: restaurant.preferences,
    plan: restaurant.plan, versions: [restaurant.version], currentVersionId: restaurant.version.id,
    factSources: restaurant.version.factSourceSnapshot, run: null, runs: [] };
  await writeFile(`${process.env.SITECRAFT_DATA_ROOT}/code-sites/${id}.json`, JSON.stringify(seed), 'utf8');
  cite = true; auditQuote = quote;
  const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    message: restaurant.annotation, baseRevision: 2, selectedTarget: blockTarget(restaurant.version.code.pages[0].html, restaurant.version.id), saveAnnotation: true, annotationSubmissionId: crypto.randomUUID(),
  }) });
  assert.equal(response.status, 202);
  const view = await session(width, { siteId: id });
  try {
    const done = await view.settle();
    assert.equal(done.codeSite.run.status, 'complete', JSON.stringify(done.codeSite.run));
    const current = done.codeSite.versions.at(-1);
    assert.equal(current.code.pages[1].html, restaurant.version.code.pages[1].html, '提示不自动修改菜单页');
    assert.deepEqual(done.codeSite.versions[0], restaurant.version, '只读副本旧版本原样保留');
    await writeFile(`${output}/state-${width}.json`, JSON.stringify(done, null, 2), 'utf8');
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelector('[data-testid="code-revision"]')?.textContent.includes('v3')`);
    // 先断言真实界面，父版本应因没有提示失败，而不是因缺少新模块失败。
    assert.equal(await view.browser.evaluate(`document.querySelectorAll('[data-testid="stale-placeholder-prompt"]').length`), 1, '当前版本应恢复一条同项待补充提示');
    assert.match(await view.browser.evaluate<string>(`document.querySelector('[data-testid="stale-placeholder-prompt"]').textContent`), /菜单 · 禾巷小馆[\s\S]*外带包装费待补充/);
    if (width < 1100) {
      await view.click('[role="tab"]:nth-child(2)');
      await view.click(`.device-toggle[aria-label="预览宽度"] button:nth-child(${width === 768 ? 2 : 3})`);
      await view.wait(`document.querySelector('[data-testid="code-preview"]').offsetWidth===${width} && !document.querySelector('.code-preview-loading')`);
      await view.click('[role="tab"]:nth-child(1)');
    }
    await view.waitForTask();
    await view.browser.evaluate(`document.querySelector('[data-testid="stale-placeholder-prompt"]').scrollIntoView({block:'center'})`);
    await view.browser.evaluate('document.fonts.ready');
    const shot = await view.browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/prompt-${width}.png`, Buffer.from(shot.data, 'base64'));
    await view.click('.code-annotation-threads summary');
    await view.wait(`document.querySelector('[data-testid="thread-reveal"]')`);
    await view.click('[data-testid="thread-reveal"]');
    await view.wait(`document.querySelector('.code-preview-version')?.textContent.includes('v2')`);
    assert.equal(await view.browser.evaluate(`document.querySelectorAll('[data-testid="stale-placeholder-prompt"]').length`), 0, '历史回看不显示当前版本的同项提示');
    await view.click('.code-preview-version button');
    await view.wait(`!document.querySelector('.code-preview-loading') && document.querySelector('[data-testid="stale-placeholder-add"]')`);
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    const beforeCalls = calls, before = await state(id);
    // 保留已有及发送中草稿的全部字段；添加不改变冻结条目。
    const existingTarget = { ...blockTarget(current.code.pages[0].html, current.id), path: [5] };
    const sendingDraft = { id: 'sending-draft', target: existingTarget, revision: 3, body: '发送中意见保留', status: 'sending', submissionId: crypto.randomUUID() };
    await view.browser.evaluate(`localStorage.setItem('sitecraft-annotation-drafts:${id}',${JSON.stringify(JSON.stringify([
      { id: 'existing-draft', target: existingTarget, revision: 3, body: '已有意见保留', status: 'draft' }, sendingDraft,
    ]))})`);
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===2`);
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    await view.click('[data-testid="stale-placeholder-add"]');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===3`);
    const drafts = await view.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${id}'))`);
    assert.equal(drafts[0].body, '已有意见保留');
    assert.deepEqual(drafts[1], sendingDraft, '添加同项草稿不改发送中条目');
    assert.equal(drafts[2].status, 'draft'); assert.equal(drafts[2].target.pageId, 'menu');
    assert.equal(drafts[2].target.versionId, current.id); assert.match(drafts[2].body, /外带包装费现在确定为每单2元。/);
    assert.equal(annotationDraftSchema.array().safeParse(drafts).success, true);
    assert.equal(await view.browser.evaluate(`document.querySelector('[data-testid="stale-placeholder-add"]').disabled`), true);
    const after = await state(id);
    assert.equal(after.codeSite.versions.length, before.codeSite.versions.length, '按钮不新建版本');
    assert.equal(after.codeSite.currentVersionId, before.codeSite.currentVersionId);
    assert.deepEqual(after.codeSite.versions.at(-1).code, before.codeSite.versions.at(-1).code, '按钮不改现有版本代码');
    assert.equal(calls, beforeCalls, '按钮不调用模型');
    await view.browser.send('Page.reload');
    await view.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length===3`);
    const refreshedDrafts = await view.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${id}'))`);
    assert.deepEqual(refreshedDrafts[1], sendingDraft, '刷新保留发送中意见、范围与发送标识');
    assert.equal(await view.browser.evaluate(`document.querySelectorAll('[data-testid="stale-placeholder-prompt"]').length`), 1, '刷新不重复提示');
    assert.equal(await view.browser.evaluate(`document.querySelector('[data-testid="stale-placeholder-add"]').disabled`), true, '刷新不重复加草稿');
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    await view.click('[data-testid="annotation-draft"]:last-child [data-testid="annotation-reveal"]');
    await view.wait(`document.querySelector('[data-testid="annotation-scope"]')?.textContent.includes('菜单 · 禾巷小馆') && !document.querySelector('.code-preview-loading')`);
    if (width < 1100) {
      await view.click(`.device-toggle[aria-label="预览宽度"] button:nth-child(${width === 768 ? 2 : 3})`);
      await view.wait(`document.querySelector('[data-testid="code-preview"]').offsetWidth===${width}`);
    }
    assert.match(await view.browser.evaluate<string>(`document.querySelector('#annotation-message').value`), /外带包装费现在确定为每单2元。/);
    await view.waitForTask();
    const draftShot = await view.browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${output}/draft-${width}.png`, Buffer.from(draftShot.data, 'base64'));
    assert.equal(calls, beforeCalls, '回看草稿也不调用模型');
  } finally { await view.browser.close(); }
});
