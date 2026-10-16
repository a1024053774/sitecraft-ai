import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { base, workflowBase, output, fixture, session, state } from './helpers/t162-browser.ts';

function batchTarget(versionId: string, path: number[], text: string, label: string) {
  return { kind: 'dom' as const, pageId: 'home', versionId, path, text, label };
}

test('真实 chat 路由逐组发送并从同一父版本存成一个版本', { timeout: 120000 }, async () => {
  const id = await fixture();
  const before = (await state(id)).codeSite;
  const version = before.versions.find((item: any) => item.id === before.currentVersionId)!;
  const items = [
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [0], '青禾纸品纸箱与纸袋，按用途说明规格。', '首屏'), revision: version.revision, body: '第一组意见：只调整首屏标题。' },
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [1], '相同标题相同说明', '纸袋区块'), revision: version.revision, body: '第二组意见：只调整纸袋区块。' },
  ];
  const browser = await session(1440, { siteId: id });
  try {
    const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch: items, saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) });
    assert.equal(response.status, 202);
    const done = await browser.settle();
    assert.equal(done.codeSite.run.status, 'complete');
    assert.equal(done.codeSite.versions.length, 2, '两组只产生一个新版本');
    const requests = JSON.parse(await readFile(`${output}/requests.json`, 'utf8')).filter((request: any) => request.purpose === 'local-edit');
    assert.equal(requests.length, 2, '真实 chat 路由必须逐组调用局部模型');
    const inputs = requests.map((request: any) => JSON.parse(request.input.split('\n')[0]));
    assert.match(inputs[0].request, new RegExp(items[0].body));
    assert.match(inputs[1].request, new RegExp(items[1].body));
    assert.doesNotMatch(JSON.stringify(inputs[0]), /第二组意见/);
    assert.doesNotMatch(JSON.stringify(inputs[1]), /第一组意见/);
    assert.doesNotMatch(JSON.stringify(inputs), /批量局部修改/);
    assert.doesNotMatch(JSON.stringify(inputs), /另一页|整站重写/);
    assert.equal(done.codeSite.versions[1].code.pages[1].html, version.code.pages[1].html, '局部候选不应改动未选页面区块');
    const savedThreads = JSON.parse(await readFile(`${process.env.SITECRAFT_DATA_ROOT}/annotations/${id}.json`, 'utf8')).annotations;
    for (const record of done.codeSite.run.annotationIds ?? []) {
      const thread = savedThreads.find(annotation => annotation.id === record.annotationId);
      assert.ok(thread, `线程 ${record.annotationId} 应存在`);
      assert.ok(thread.comments.some(comment => comment.author.id === 'assistant' && /已合并修改/.test(comment.body)), `线程 ${record.draftId} 应收到自己的成功回复`);
    }
  } finally { await browser.browser.close(); }
});

test('任一组模型失败不存版本，并分别保留批次结果', { timeout: 120000 }, async () => {
  const id = await fixture();
  const before = (await state(id)).codeSite;
  const version = before.versions.find((item: any) => item.id === before.currentVersionId)!;
  const items = [
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [0], '青禾纸品纸箱与纸袋，按用途说明规格。', '首屏'), revision: version.revision, body: '服务失败：第一组' },
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [1], '相同标题相同说明', '纸袋区块'), revision: version.revision, body: '第二组也要保留' },
  ];
  const browser = await session(1440, { siteId: id });
  try {
    const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch: items, saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) });
    assert.equal(response.status, 202);
    const done = await browser.settle();
    assert.equal(done.codeSite.run.status, 'error');
    assert.equal(done.codeSite.versions.length, 1, '失败组不能留下部分版本');
    assert.deepEqual(done.codeSite.run.annotationResults?.map((item: any) => item.draftIds), items.map((item: { draftId: string }) => [item.draftId]));
    assert.match(done.codeSite.run.annotationResults?.map((item: any) => item.message).join('\n') ?? '', /未保存版本|本地替身明确失败/);
  } finally { await browser.browser.close(); }
});

test('cannotEdit 立即停止该组重试，并按 draftId 分开显示拒因', { timeout: 120000 }, async () => {
  const id = await fixture();
  const before = (await state(id)).codeSite;
  const version = before.versions.find((item: any) => item.id === before.currentVersionId)!;
  const items = [
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [0], '青禾纸品纸箱与纸袋，按用途说明规格。', '首屏'), revision: version.revision, body: '不能修改：第一组' },
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [1], '相同标题相同说明', '纸袋区块'), revision: version.revision, body: '第二组合法' },
  ];
  const browser = await session(1440, { siteId: id });
  try {
    const beforeRequests = JSON.parse(await readFile(`${output}/requests.json`, 'utf8')).filter((request: any) => request.purpose === 'local-edit').length;
    const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch: items, saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) });
    assert.equal(response.status, 202);
    const done = await browser.settle();
    assert.equal(done.codeSite.run.status, 'error');
    assert.equal(done.codeSite.versions.length, 1);
    assert.deepEqual(done.codeSite.run.annotationResults?.map((item: any) => item.draftIds), items.map(item => [item.draftId]));
    assert.equal(done.codeSite.run.annotationResults?.[0]?.message, '第一组明确拒绝');
    assert.equal(done.codeSite.run.annotationResults?.[1]?.message, '因其他组失败未保存。');
    const requests = JSON.parse(await readFile(`${output}/requests.json`, 'utf8')).filter((request: any) => request.purpose === 'local-edit');
    assert.equal(requests.length - beforeRequests, 2, 'cannotEdit 组不能进入三轮重试');
  } finally { await browser.browser.close(); }
});

test('一组 CSS 范围拒因不复制给另一组，批次结果按组保留', { timeout: 120000 }, async () => {
  const id = await fixture();
  const before = (await state(id)).codeSite;
  const version = before.versions.find((item: any) => item.id === before.currentVersionId)!;
  const items = [
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [0], '青禾纸品纸箱与纸袋，按用途说明规格。', '首屏'), revision: version.revision, body: '合法空 CSS' },
    { draftId: crypto.randomUUID(), target: batchTarget(version.id, [1], '相同标题相同说明', '纸袋区块'), revision: version.revision, body: '范围外规则' },
  ];
  const browser = await session(1440, { siteId: id });
  try {
    const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch: items, saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) });
    assert.equal(response.status, 202);
    const done = await browser.settle();
    assert.equal(done.codeSite.run.status, 'error');
    assert.equal(done.codeSite.versions.length, 1);
    assert.equal(done.codeSite.run.annotationResults?.[0]?.message, '因其他组失败未保存。');
    assert.match(done.codeSite.run.annotationResults?.[1]?.message ?? '', /CSS|局部修改越界/);
  } finally { await browser.browser.close(); }
});

test('无当前版本时批次请求在资料分支前拒绝，不写资料或创建任务', async () => {
  const created = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '无版本批注测试' }) });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: '批量局部修改', baseRevision: 0, annotationBatch: [{ draftId: crypto.randomUUID(), target: batchTarget('old-version', [0], '旧目标', '旧目标'), revision: 1, body: '不应写入资料' }], saveAnnotation: true, annotationSubmissionId: crypto.randomUUID() }) });
  assert.equal(response.status, 422);
  const current = (await state(id)).codeSite;
  assert.equal(current.materials, '');
  assert.equal(current.run, null);
  assert.equal(current.runs.length, 0);
});
