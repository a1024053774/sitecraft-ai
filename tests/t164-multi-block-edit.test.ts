import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

// T-164 failure modes (independent expected behavior):
// - two comments on one block stay one ordered model group;
// - two independent blocks on home plus one block on products are assembled
//   from the same parent revision and saved as one complete version;
// - a new shared selector that matches outside the union is rejected;
// - an ancestor/descendant pair requires explicit same-range confirmation;
// - one rejected group rejects the whole batch, so no partial version exists;
// - each model request contains only its block context, never a whole-site rewrite.

const calls: any[] = [];
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end(codeCheckDocument); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); calls.push(body);
  res.setHeader('content-type', 'application/json');
  const fact = body.messages?.[0]?.content?.includes('事实校对员');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(fact ? { issues: [] } : { html: '<section><h1>改后</h1></section>', css: '' }) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_BASE_URL = process.env.SITECRAFT_BASE;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const { mergeAnnotationEdits, applyLocalEdits, attributeLocalIssues, localScopeClass } = await import('../lib/code-site-local-edit.ts');
const { writeLocalEditBatch } = await import('../lib/code-site-model.ts');
const { commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

const target = (path: number[], text: string, label: string, pageId = 'home', versionId = 'v1') => ({
  kind: 'dom' as const, pageId, versionId, path, text, label,
});

async function dynamicFixture(css: string, html: string, materials = '目标。入口。外部。') {
  const id = `t164-dynamic-${crypto.randomUUID()}`;
  const source = {
    header: '<header>头</header>', footer: '<footer>脚</footer>', css,
    pages: [{ id: 'home', title: '首页', html }, { id: 'products', title: '产品', html: '<main><h1>产品</h1></main>' }],
  };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '动态状态边界', source: { revision: 1, updatedAt: new Date().toISOString() }, materials, code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied', first.status === 'unavailable' ? first.record.readError : '动态状态夹具必须先存下源版本');
  if (first.status !== 'applied') throw new Error('动态状态夹具创建失败');
  return { id, source, version: first.version };
}

test('同一区块的多条批注按添加顺序合成一组，祖先后代需明确确认同一范围', () => {
  const edits = [
    { draftId: 'a', target: target([0], 'A', 'A'), revision: 1, body: '先保留事实。' },
    { draftId: 'b', target: target([0], 'A', 'A'), revision: 1, body: '再收紧标题。' },
    { draftId: 'c', target: target([1], 'B', 'B'), revision: 1, body: '调整留白。' },
  ];
  const groups = mergeAnnotationEdits(edits);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].draftIds, ['a', 'b']);
  assert.match(groups[0].request, /先保留事实。[\s\S]*再收紧标题。/);
  assert.throws(() => mergeAnnotationEdits([
    { draftId: 'a', target: target([0], 'A', 'A'), revision: 1, body: '祖先' },
    { draftId: 'b', target: target([0, 0], 'A 子项', 'A 子项'), revision: 1, body: '后代' },
  ]), /同一个范围|重叠/);
  const confirmed = mergeAnnotationEdits([
    { draftId: 'a', target: target([0], 'A', 'A'), revision: 1, body: '祖先' },
    { draftId: 'b', target: target([0, 0], 'A 子项', 'A 子项'), revision: 1, body: '后代' },
  ], { overlapConfirmed: true });
  assert.equal(confirmed.length, 1);
  assert.deepEqual(confirmed[0].target.path, [0]);
  assert.deepEqual(confirmed[0].draftIds, ['a', 'b']);
  const ordered = mergeAnnotationEdits([
    { draftId: 'descendant', target: target([0, 0], '后代', '后代'), revision: 1, body: '后代意见' },
    { draftId: 'sibling', target: target([0, 1], '兄弟', '兄弟'), revision: 1, body: '兄弟意见' },
    { draftId: 'ancestor', target: target([0], '祖先', '祖先'), revision: 1, body: '祖先意见' },
  ], { overlapConfirmed: true });
  assert.deepEqual(ordered[0].draftIds, ['descendant', 'sibling', 'ancestor']);
  assert.match(ordered[0].request, /后代意见[\s\S]*兄弟意见[\s\S]*祖先意见/);
});

test('合法的两处修改在同一父版本上组装，另一页面仍进入允许范围并只产生一个候选', async () => {
  const source = {
    header: '<header>头</header>', footer: '<footer>脚</footer>',
    css: 'body{color:#111}.card{padding:12px}',
    pages: [
      { id: 'home', title: '首页', html: '<main><section class="card"><h1>A</h1></section><section class="card"><h2>B</h2></section></main>' },
      { id: 'products', title: '产品', html: '<main><section class="card"><h1>C</h1></section></main>' },
    ],
  };
  const groups = mergeAnnotationEdits([
    { draftId: 'a', target: target([0], 'A', 'A'), revision: 1, body: '改 A' },
    { draftId: 'b', target: target([1], 'B', 'B'), revision: 1, body: '改 B' },
    { draftId: 'c', target: target([0], 'C', 'C', 'products'), revision: 1, body: '改 C', },
  ]);
  const id = `t164-valid-${crypto.randomUUID()}`;
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '批注边界', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: 'A、B、C。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied', first.status === 'unavailable' ? first.record.readError : '');
  if (first.status !== 'applied') return;
  const versionedGroups = groups.map(group => ({ ...group, target: { ...group.target, versionId: first.version.id } }));
  const candidate = await applyLocalEdits(source, versionedGroups, versionedGroups.map((group, index) => {
    const scope = localScopeClass(group.target);
    return { html: index === 0 ? `<section class="card ${scope}"><h1>A改</h1></section>`
      : index === 1 ? `<section class="card ${scope}"><h2>B改</h2></section>`
        : `<section class="card ${scope}"><h1>C改</h1></section>`, css: `.${scope}{outline:0}` };
  }));
  assert.match(candidate.pages[0].html, /A改/);
  assert.match(candidate.pages[0].html, /B改/);
  assert.match(candidate.pages[1].html, /C改/);
  const saved = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate,
    selectedTargets: versionedGroups.map(group => group.target), author: 'assistant', summary: '批量', request: '批量修改' });
  assert.equal(saved.status, 'applied', saved.status === 'rejected' ? saved.checks.issues.join('\n') : '');
});

test('共享 CSS 外溢与任一组失败都拒绝整批，当前版本不增加', async () => {
  const id = `t164-${crypto.randomUUID()}`;
  const source = {
    header: '<header>边界</header>', footer: '<footer>脚</footer>',
    css: 'body{margin:0}.card{padding:12px}',
    pages: [
      { id: 'home', title: '首页', html: '<main><section class="card"><h1>A</h1></section><section class="card"><h2>B</h2></section></main>' },
      { id: 'products', title: '产品', html: '<main><section class="card"><h1>C</h1></section></main>' },
    ],
  };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '批注边界', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: 'A、B、C。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied');
  if (first.status !== 'applied') return;
  const edits = [
    { draftId: 'a', target: target([0], 'A', 'A', 'home', first.version.id), revision: 1, body: '改 A' },
    { draftId: 'b', target: target([1], 'B', 'B', 'home', first.version.id), revision: 1, body: '改 B' },
  ];
  const groups = mergeAnnotationEdits(edits);
  const badShared = await applyLocalEdits(first.version.code, groups, groups.map((_, index) => ({
    html: index === 0 ? '<section class="card"><h1>A2</h1></section>' : '<section class="card"><h2>B2</h2></section>',
    css: '.shared { color: red; }',
  })));
  const rejected = await commitSiteCode({ siteId: id, baseRevision: 1, code: badShared, selectedTargets: edits.map(edit => edit.target), author: 'assistant', summary: '批量', request: '批量修改' });
  assert.equal(rejected.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
  const oneBroken = await applyLocalEdits(first.version.code, groups, [
    { html: '<section class="card"><h1>A2</h1></section>', css: '' },
    { html: '<section><h2>越界</h2></section>', css: '' },
  ]);
  oneBroken.pages[1].html = oneBroken.pages[1].html.replace('C', '第三组越界');
  const rejectedWhole = await commitSiteCode({ siteId: id, baseRevision: 1, code: oneBroken, selectedTargets: edits.map(edit => edit.target), author: 'assistant', summary: '批量', request: '批量修改' });
  assert.equal(rejectedWhole.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('新增可聚焦链接不能通过共享 focus-within CSS 改变区块外样式', async () => {
  const id = `t164-focus-${crypto.randomUUID()}`;
  const source = {
    header: '<header>头</header>', footer: '<footer>脚</footer>',
    css: 'body{color:#111}main:focus-within .outside{color:red}.outside{color:#111}',
    pages: [{ id: 'home', title: '首页', html: '<main><section><h1>目标</h1><p>原文</p></section><p class="outside">区块外</p></main>' },
      { id: 'products', title: '产品', html: '<main><h1>产品</h1></main>' }],
  };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '焦点边界', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '目标原文。链接。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied');
  if (first.status !== 'applied') return;
  const target = { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [0], text: '目标原文', label: '目标' };
  const candidate = structuredClone(first.version.code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">链接</a></section>');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '焦点外溢', request: '增加链接' });
  assert.equal(result.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('没有动态焦点 CSS 时，区块内新增链接可以保存', async () => {
  const id = `t164-focus-none-${crypto.randomUUID()}`;
  const source = {
    header: '<header>头</header>', footer: '<footer>脚</footer>', css: 'body{color:#111}.outside{color:#111}',
    pages: [{ id: 'home', title: '首页', html: '<main><section><h1>目标</h1></section><p class="outside">区块外</p></main>' },
      { id: 'products', title: '产品', html: '<main><h1>产品</h1></main>' }],
  };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '无焦点规则', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '目标。链接。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied');
  if (first.status !== 'applied') return;
  const target = { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [0], text: '目标', label: '目标' };
  const candidate = structuredClone(first.version.code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">链接</a></section>');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '无焦点规则', request: '增加链接' });
  assert.equal(result.status, 'applied');
});

test('候选新增链接触发范围外自定义属性也必须拒绝', async () => {
  const { id, source, version } = await dynamicFixture('body{color:#111}.outside{color:#111}@media (min-width:1px){main:focus-within .outside{--leak:123px}}', '<main><section class="target"><h1>目标</h1></section><p class="outside">外部</p></main>');
  const candidate = structuredClone(source);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const selected = target([0], '目标', '目标', 'home', version.id);
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: selected, author: 'assistant', summary: '自定义属性外溢', request: '增加入口' });
  assert.equal(result.status, 'rejected');
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('动态探针在三档视口固定检查四种状态并记录强制调用证据', async () => {
  const { id, source, version } = await dynamicFixture('body{color:#111}.outside{color:#111}', '<main><section class="target"><h1>目标</h1><a href="/home">入口</a></section><p class="outside">外部</p></main>');
  const candidate = structuredClone(source);
  candidate.pages[0].html = candidate.pages[0].html.replace('目标', '改后');
  const selected = target([0], '目标入口', '目标', 'home', version.id);
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: selected, author: 'assistant', summary: '动态状态证据', request: '改标题' });
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : '');
  if (result.status !== 'applied') return;
  const homeViewports = result.version.checks.viewports.filter(viewport => viewport.pageId === 'home');
  assert.deepEqual(homeViewports.map(viewport => viewport.width), [375, 768, 1440]);
  for (const viewport of homeViewports) {
    const dynamic = (viewport as any).dynamicState;
    assert.ok(dynamic, `缺少 ${viewport.width} 动态探针证据`);
    for (const side of ['source', 'candidate']) {
      assert.equal(dynamic[side].interactiveElements, 1, `${viewport.width}/${side} 可交互元素数`);
      assert.equal(dynamic[side].statesChecked, 4, `${viewport.width}/${side} 必须逐一检查四种状态`);
      assert.ok(dynamic[side].forceCalls >= 4, `${viewport.width}/${side} 必须实际强制四种状态`);
    }
    assert.ok(dynamic.durationMs >= 0 && dynamic.durationMs <= 2000, `${viewport.width} 动态探针耗时应在档位预算内`);
  }
});

test('只在 375 生效的 main:has(:focus) 范围外规则必须按该视口拒绝', async () => {
  const { id, source, version } = await dynamicFixture('body{color:#111}.outside{width:20px}@media(max-width:479px){main:has(:focus) .outside{width:99px}}', '<main><section class="target"><h1>目标</h1></section><p class="outside">外部</p></main>', '目标。入口。外部。99px。');
  const candidate = structuredClone(source);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const selected = target([0], '目标', '目标', 'home', version.id);
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: selected, author: 'assistant', summary: '375 动态规则', request: '增加入口' });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /home\/375|375/);
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('target:focus-within 的兄弟范围外规则与祖先 hover、active 规则都必须拒绝', async () => {
  const { id, source, version } = await dynamicFixture('body{color:#111}.outside{width:20px}.target:focus-within + .outside{width:91px}.target:hover + .outside{width:92px}.target:active + .outside{width:93px}', '<main><section class="target"><h1>目标</h1></section><p class="outside">外部</p></main>');
  const candidate = structuredClone(source);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const selected = target([0], '目标', '目标', 'home', version.id);
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: selected, author: 'assistant', summary: '祖先交互态', request: '增加入口' });
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /hover|active|focus/);
});

test('disabled button 不是可交互触发元素，不应让静态范围外规则误拒', async () => {
  const { id, source, version } = await dynamicFixture('body{color:#111}.outside{color:#111}button{color:#111;background:#fff}main:has(:focus) .outside{color:red}', '<main><section class="target"><h1>目标</h1><button disabled>禁用</button></section><p class="outside">外部</p></main>', '目标。禁用。外部。改后。');
  const candidate = structuredClone(source);
  candidate.pages[0].html = candidate.pages[0].html.replace('目标', '改后');
  const selected = target([0], '目标禁用', '目标', 'home', version.id);
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: selected, author: 'assistant', summary: '禁用控件', request: '改标题' });
  assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('\n') : '');
  if (result.status !== 'applied') return;
  assert.ok(result.version.checks.viewports.filter(viewport => viewport.pageId === 'home').every(viewport => viewport.dynamicState?.candidate.interactiveElements === 0));
});

test('summary 触发 focus-within 改变范围外宽度时拒绝', async () => {
  const id = `t164-focus-summary-${crypto.randomUUID()}`;
  const source = {
    header: '<header>头</header>', footer: '<footer>脚</footer>', css: 'body{color:#111}main:focus-within .outside{width:99px}.outside{width:20px}',
    pages: [{ id: 'home', title: '首页', html: '<main><section><h1>目标</h1></section><p class="outside">区块外</p></main>' },
      { id: 'products', title: '产品', html: '<main><h1>产品</h1></main>' }],
  };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '焦点摘要', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '目标。链接。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied');
  if (first.status !== 'applied') return;
  const target = { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [0], text: '目标', label: '目标' };
  const candidate = structuredClone(first.version.code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<details><summary>链接</summary></details></section>');
  const result = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, selectedTarget: target, author: 'assistant', summary: '摘要焦点外溢', request: '增加摘要链接' });
  assert.equal(result.status, 'rejected');
});

test('显式动态状态预算超时明确拒绝且不存版本', async () => {
  const id = `t164-focus-timeout-${crypto.randomUUID()}`;
  const source = { header: '<header>头</header>', footer: '<footer>脚</footer>', css: 'body{color:#111}',
    pages: [{ id: 'home', title: '首页', html: '<main><section><h1>目标</h1><a href="/home">按钮</a></section><p class="outside">外部</p></main>' }, { id: 'products', title: '产品', html: '<main><h1>产品</h1></main>' }] };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '超时边界', source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '目标。按钮。外部。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied', first.status === 'unavailable' ? first.record.readError : '');
  if (first.status !== 'applied') return;
  const target = { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [0], text: '目标按钮', label: '目标' };
  await assert.rejects(() => commitSiteCode({ siteId: id, baseRevision: 1, code: first.version.code, selectedTarget: target,
    author: 'assistant', summary: '超时', request: '超时', dynamicStateBudgetMs: 1 }), /动态状态检查超时/);
  assert.equal((await getCodeSite(id))!.versions.length, 1);
});

test('完整样式比较耗尽默认五秒预算时明确拒绝且不存版本', async t => {
  const { id, source, version } = await dynamicFixture('body{color:#111}', '<main><section><h1>目标</h1><a href="/home">入口</a></section><p>外部</p></main>');
  const now = Date.now.bind(Date);
  const stringify = JSON.stringify.bind(JSON);
  let compareReached = false;
  // Advance the clock at the computed-style comparison boundary, without
  // delaying Chrome or changing its complete state/style evidence.
  const clock = t.mock.method(Date, 'now', () => now() + (compareReached ? 6000 : 0));
  const serialization = t.mock.method(JSON, 'stringify', (value: unknown, ...args: unknown[]) => {
    if (value && typeof value === 'object' && 'path' in value && 'styles' in value) compareReached = true;
    return Reflect.apply(stringify, JSON, [value, ...args]);
  });
  try {
    await assert.rejects(() => commitSiteCode({ siteId: id, baseRevision: 1, code: source,
      selectedTarget: target([0], '目标入口', '目标', 'home', version.id), author: 'assistant', summary: '比较预算', request: '保留内容' }), /动态状态检查超时/);
    assert.ok(compareReached, '必须到达完整样式比较后再验证超时');
    assert.equal((await getCodeSite(id))!.versions.length, 1);
  } finally { serialization.mock.restore(); clock.mock.restore(); }
});

test('多区块模型输入按组隔离，不拼成整站请求', async () => {
  const source = {
    header: '<header>不能发给模型</header>', footer: '<footer>不能发给模型</footer>', css: '.a{padding:1px}',
    pages: [{ id: 'home', title: '首页', html: '<main><section class="a"><h1>A</h1></section><section><h2>外部哨兵</h2></section></main>' },
      { id: 'products', title: '产品', html: '<main><h1>另一页哨兵</h1></main>' }],
  };
  const groups = mergeAnnotationEdits([{ draftId: 'a', target: target([0], 'A', 'A'), revision: 1, body: '只改 A' }]);
  calls.length = 0;
  const result = await writeLocalEditBatch({ materials: 'A。', preferences: { style: 'precision', layout: 5, density: 6 }, plan: { summary: '首页', style: 'precision', styleReason: '测试', pages: [{ id: 'home', title: '首页', outline: 'A' }, { id: 'products', title: '产品', outline: '产品' }] }, current: source, groups, issues: [] });
  assert.equal(result.length, 1);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(calls[0].messages), /不能发给模型|外部哨兵|另一页哨兵/);
});

test('每组局部模型调用前先执行风格准入', async () => {
  const groups = mergeAnnotationEdits([{ draftId: 'admission', target: target([0], 'A', 'A'), revision: 1, body: '准入检查' }]);
  await assert.rejects(() => writeLocalEditBatch({ materials: 'A。', preferences: { style: 'precision', layout: 5, density: 6 },
    plan: { summary: '首页', style: '未登记风格' as any, styleReason: '测试', pages: [{ id: 'home', title: '首页', outline: 'A' }] },
    current: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><section><h1>A</h1></section></main>' }] }, groups, issues: [] }), /已选风格当前不能使用/);
});

test('提交检查拒因只喂给可归因组，无法归因时单独保留整体拒因', () => {
  const groups = mergeAnnotationEdits([
    { draftId: 'legal', target: target([0], 'A', 'A'), revision: 1, body: '合法组' },
    { draftId: 'bad', target: target([1], 'B', 'B'), revision: 1, body: '违规组' },
  ]);
  const source = { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><section><h1>A</h1></section><section><h2>B</h2></section></main>' }] };
  const badScope = localScopeClass(groups[1].target);
  const candidate = { ...source, css: `.${badScope}{color:red}` };
  const attributed = attributeLocalIssues(['修改越界：home 范围外元素的 CSS 规则或匹配改变'], groups, source, candidate);
  assert.deepEqual(attributed.groupIssues[0], []);
  assert.match(attributed.groupIssues[1].join('\n'), /范围外元素/);
  const overall = attributeLocalIssues(['home/375 横向溢出'], groups, source, source);
  assert.deepEqual(overall.groupIssues, [[], []]);
  assert.deepEqual(overall.overall, ['home/375 横向溢出']);
});
