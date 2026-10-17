import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import { commitSiteCode, updateCodeSite, output, session, state, workflowBase } from './helpers/t162-browser.ts';
import { codeFactSourceMaterials } from '../lib/code-site.ts';
import { localEditChoice } from './fixtures/local-edit-choice.ts';

// Like the real 32e0ab93 record: two pages and raw materials, without a source
// registry or a version source snapshot. No real data or external model is used.
const materials = '\n公司名：禾巷小馆\n营业安排：午市11:00–14:00。\n  收费口径：外带包装费每单2元。\n';
const original = {
  header: '<header>禾巷小馆<nav><a href="/home">首页</a> <a href="/menu">菜单</a></nav></header>', footer: '<footer>禾巷小馆</footer>',
  css: 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}header,footer,main{padding:24px}section{padding:24px 0}p{max-width:36em}',
  pages: [
    { id: 'home', title: '首页', html: '<main><h1>禾巷小馆</h1><section><h2>营业时段</h2><p>午市11:00–14:00。</p></section><section><h2>收费口径</h2><p>外带包装费每单2元。</p></section></main>' },
    { id: 'menu', title: '菜单', html: '<main><h1>菜单</h1><section><h2>家常饭菜</h2><p>按当日供应。</p></section></main>' },
  ],
};
let unsupported = false;
const calls: any[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), local = body.messages[0].content.includes('本次局部修改');
  const input = JSON.parse(body.messages[1].content.split('\n')[0]); calls.push({ local, input });
  await writeFile(`${output}/original-material-requests.json`, JSON.stringify(calls, null, 2));
  const answer = local ? { html: unsupported ? input.html.replace('每单2元', '每单3元') : input.html, css: '' }
    : { results: input.segments.map((segment: any) => {
      const claim = segment.text.includes('外带包装费') ? `外带包装费每单${unsupported ? 3 : 2}元。`
        : segment.text.includes('午市11:00') ? '午市11:00–14:00。' : null;
      const category = claim?.includes('包装费') ? '价格与收费' : '时间与交期承诺';
      return { id: segment.id, issues: [], noFacts: !claim, factCategories: claim ? [category] : [], citations: claim ? [{ category, claim, quote: claim }] : [] };
    }) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [local ? localEditChoice(answer) : { finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));

async function oldSite(rawMaterials = materials) {
  const id = `t164-original-${crypto.randomUUID()}`;
  const saved = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '禾巷小馆', source: { revision: 1, updatedAt: new Date().toISOString() }, materials, code: original, exportIssues: [] } });
  assert.equal(saved.status, 'applied');
  if (rawMaterials !== materials) await updateCodeSite(id, () => ({ materials: rawMaterials }));
  const before = (await state(id)).codeSite;
  assert.equal(before.factSources, undefined); assert.equal(before.versions[0].factSourceSnapshot, undefined);
  return { id, before };
}
function items(version: any) {
  return [
    { draftId: crypto.randomUUID(), revision: version.revision, target: { kind: 'dom', versionId: version.id, pageId: 'home', path: [1], label: '营业时段', text: '营业时段午市11:00–14:00。' }, body: '营业时段这里保留原文，排得醒目一点。' },
    { draftId: crypto.randomUUID(), revision: version.revision, target: { kind: 'dom', versionId: version.id, pageId: 'home', path: [2], label: '收费口径', text: '收费口径外带包装费每单2元。' }, body: '收费口径保留原文，把说明分清楚。' },
  ];
}
async function send(id: string, version: any) {
  const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch: items(version), saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) });
  assert.equal(response.status, 202, await response.clone().text());
}

test('旧站批次逐字核对原始资料，只给新版本保存出处，三档显示原始资料', { timeout: 120000 }, async () => {
  const { id, before } = await oldSite(), previous = structuredClone(before.versions[0]);
  const s = await session(1440, { siteId: id });
  let done: any;
  try {
    const count = calls.filter(call => !call.local).length;
    await send(id, previous); done = (await s.settle()).codeSite;
    await writeFile(`${output}/original-material-positive.json`, JSON.stringify({ before, done }, null, 2));
    assert.equal(done.run.status, 'complete', done.run.step);
    assert.ok(calls.filter(call => !call.local).length > count, '旧事实必须重新调用事实核对，不能免核');
    assert.equal(done.versions.length, 2);
    assert.deepEqual(done.versions[0], previous, '登记不回写旧版本、旧检查或旧快照');
    const registered = done.factSources.filter((source: any) => source.type === 'materials');
    assert.deepEqual(registered, [{ type: 'materials', messageIndex: 3, text: materials }], '补登记逐字保存 site.materials，并使用下一可用序号');
    const current = done.versions[1];
    assert.deepEqual(current.factSourceSnapshot.find((source: any) => source.type === 'materials'), registered[0]);
    assert.ok(current.checks.factCitations.entries.some((entry: any) => entry.claim === '外带包装费每单2元。' && entry.source.type === 'materials'), '旧事实也必须有有效原句出处');
    await send(id, current); const repeated = (await s.settle(done.run.id)).codeSite;
    assert.equal(repeated.run.status, 'complete', repeated.run.step);
    assert.equal(repeated.factSources.filter((source: any) => source.type === 'materials').length, 1, '后续修改不重复登记原文');
    assert.deepEqual(repeated.factSources.map((source: any) => source.messageIndex).sort((a: number, b: number) => a - b), [1, 2, 3, 4, 5], '批注与原始资料序号不得重复');
  } finally { await s.browser.close(); }
  for (const width of [1440, 768, 375]) {
    const view = await session(width, { siteId: id });
    try {
      await view.wait(`document.querySelector('[data-testid="fact-citation-marker"][data-claim="外带包装费每单2元。"]')`);
      await view.click('[data-testid="fact-citation-marker"][data-claim="外带包装费每单2元。"]');
      await view.wait(`document.querySelector('[data-testid="fact-citation-source"]')?.textContent.includes('原始资料')`);
      assert.match(await view.browser.evaluate<string>(`document.querySelector('[data-testid="fact-citation-source"]').innerText`), /原始资料[\s\S]*外带包装费每单2元。/);
      await view.shot('original-material-source');
    } finally { await view.browser.close(); }
  }
});

test('原始资料只有每单2元，候选每单3元仍拒收且不存版', { timeout: 120000 }, async () => {
  // The number 3 already exists for a different charge; the quote/source check
  // must still reject the unsupported packaging price.
  const { id, before } = await oldSite(materials + '单点米饭3元/碗。\n');
  const s = await session(1440, { siteId: id }); unsupported = true;
  try {
    const auditsBefore = calls.filter(call => !call.local).length;
    await send(id, before.versions[0]); const done = (await s.settle()).codeSite;
    await writeFile(`${output}/original-material-unsupported.json`, JSON.stringify(done, null, 2));
    assert.equal(done.run.status, 'error'); assert.equal(done.versions.length, 1);
    assert.ok(calls.filter(call => !call.local).length > auditsBefore, '必须进入原句核对，不只靠新增数字拒绝');
    assert.match(done.run.step + done.run.issues.join('\n'), /出处/);
    assert.match(done.run.step + done.run.issues.join('\n'), /外带包装费每单3元/);
    assert.deepEqual(done.versions[0], before.versions[0]);
  } finally { unsupported = false; await s.browser.close(); }
});

test('materials 为空的旧站不登记推测原文，批次仍拒收并显示缺来源提示', { timeout: 120000 }, async () => {
  const { id, before } = await oldSite(''); const s = await session(1440, { siteId: id });
  try {
    await send(id, before.versions[0]); const done = (await s.settle()).codeSite;
    await writeFile(`${output}/original-material-empty.json`, JSON.stringify(done, null, 2));
    assert.equal(done.run.status, 'error'); assert.equal(done.versions.length, 1);
    assert.ok(!done.factSources.some((source: any) => source.type === 'materials'));
    assert.match(done.run.step + done.run.issues.join('\n'), /出处|资料/);
    await s.wait(`document.body.innerText.includes('未提供可引用的原句')`);
    await s.shot('original-material-empty');
  } finally { await s.browser.close(); }
});

// An effective snapshot owns its sources. A registry entry outside it must not
// revive a source that the accepted version no longer uses.
test('有效快照只有后续消息时，不从站点登记补回原始资料，历史快照不变', () => {
  const originalSource = { type: 'materials' as const, messageIndex: 3, text: materials };
  const later = { type: 'message' as const, messageIndex: 1, text: '菜单按当天备料供应。' };
  const snapshot = [later];
  const current: any = { materials, factSources: [originalSource, later], currentVersionId: 'old-partial', versions: [{ id: 'old-partial', factSourceSnapshot: snapshot }] };
  assert.deepEqual(codeFactSourceMaterials(current), [later]);
  assert.deepEqual(snapshot, [later]);
});

test('旧站修改成功后可撤销及恢复 v1，已登记原始资料重核且历史不回写', { timeout: 120000 }, async () => {
  const { id, before } = await oldSite(), v1 = structuredClone(before.versions[0]);
  const upgraded = await commitSiteCode({ siteId: id, baseRevision: 1, code: { ...original, css: original.css + 'h1{letter-spacing:.02em}' }, author: 'user', summary: '旧站首次修改', request: '保留营业时间和收费原文，只调整标题字距。' });
  assert.equal(upgraded.status, 'applied', upgraded.status === 'rejected' ? upgraded.checks.issues.join('\n') : '');
  for (const [action, baseRevision] of [['undo', 2], ['restore', 3]] as const) {
    const auditsBefore = calls.filter(call => !call.local).length;
    const response = await fetch(`${workflowBase}/api/sites/${id}/history/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision, ...(action === 'restore' ? { versionId: v1.id } : {}) }) });
    const payload = await response.json();
    await writeFile(`${output}/original-material-${action}.json`, JSON.stringify({ before, upgraded, status: response.status, payload }, null, 2));
    assert.equal(response.status, 200, payload.userMessage);
    assert.equal(payload.status, 'applied');
    const saved = payload.codeSite.versions.at(-1);
    assert.equal(saved.revision, baseRevision + 1); assert.equal(saved.restoredFrom, v1.id);
    assert.deepEqual(saved.code, v1.code);
    assert.deepEqual(payload.codeSite.versions[0], v1, '恢复不回写旧版本、旧检查和旧来源快照');
    assert.ok(calls.filter(call => !call.local).length > auditsBefore, '缺来源快照的旧版本必须重新核对');
    assert.ok(saved.checks.factCitations.entries.some((entry: any) => entry.claim === '外带包装费每单2元。' && entry.source.type === 'materials'));
  }
});

test('旧站首次上传合入原始资料，上传后普通修改仍可引用旧原文', { timeout: 120000 }, async () => {
  const { id, before } = await oldSite(), v1 = structuredClone(before.versions[0]);
  const upload = { type: 'upload', sourceId: 'legacy-first-upload', name: '菜单补充.txt', text: '菜单按当天备料供应。' };
  const s = await session(1440, { siteId: id });
  try {
    const first = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: upload.text, source: upload, baseRevision: 1, selectedTarget: items(v1)[0].target }) });
    assert.equal(first.status, 202, await first.clone().text());
    const uploaded = (await s.settle()).codeSite;
    await writeFile(`${output}/original-material-first-upload.json`, JSON.stringify({ before, uploaded }, null, 2));
    assert.equal(uploaded.run.status, 'complete', uploaded.run.step);
    assert.equal(uploaded.versions.length, 2);
    assert.deepEqual(uploaded.factSources, [{ type: 'materials', messageIndex: 1, text: materials }, upload], '在本次上传加入之前判断资格，同一锁保存逐字原文与上传');
    const v2 = uploaded.versions[1];
    assert.deepEqual(v2.factSourceSnapshot, uploaded.factSources);
    const next = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '收费口径保留原文，把说明分清楚。', baseRevision: 2, selectedTarget: items(v2)[1].target }) });
    assert.equal(next.status, 202, await next.clone().text());
    const modified = (await s.settle(uploaded.run.id)).codeSite;
    await writeFile(`${output}/original-material-after-upload-edit.json`, JSON.stringify(modified, null, 2));
    assert.equal(modified.run.status, 'complete', modified.run.step);
    assert.equal(modified.versions.length, 3);
    assert.equal(modified.factSources.filter((source: any) => source.type === 'materials').length, 1);
    assert.deepEqual(modified.versions[0], v1);
    assert.ok(modified.versions[2].checks.factCitations.entries.some((entry: any) => entry.claim === '外带包装费每单2元。' && entry.source.type === 'materials'));
  } finally { await s.browser.close(); }
});
