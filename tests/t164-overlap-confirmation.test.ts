import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fixture, output, session, state, workflowBase } from './helpers/t162-browser.ts';

type Session = Awaited<ReturnType<typeof session>>;
type BatchRequest = { confirmed: boolean; status: number | null; paths: number[][] };
const drafts = (s: Session) => s.browser.evaluate<any[]>(`JSON.parse(localStorage.getItem('sitecraft-annotation-drafts:${s.id}') || '[]').filter(d => d.status !== 'archived')`);
async function localCalls() {
  try { return JSON.parse(await readFile(`${output}/requests.json`, 'utf8')).filter((entry: any) => entry.purpose === 'local-edit'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

for (const width of [1440, 768, 375]) {
  test(`重叠批注在 ${width} 普通发送两次仍待确认，明确确认后才合并保存`, { timeout: 120000 }, async () => {
    const id = await fixture(), before = (await state(id)).codeSite;
    const callsBefore = (await localCalls()).length;
    const s = await session(width, { siteId: id, beforeNavigate: async browser => {
      await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{
        const original = window.fetch; window.__t164OverlapRequests = [];
        window.fetch = async function(input, init) {
          const body = init?.body && JSON.parse(init.body);
          const entry = body?.annotationBatch ? { confirmed: body.annotationOverlapConfirmed, status: null, paths: body.annotationBatch.map(item => item.target.path) } : null;
          if (entry) window.__t164OverlapRequests.push(entry);
          const response = await original.apply(this, arguments); if (entry) entry.status = response.status; return response;
        };
      })()` });
    } });
    const requests = () => s.browser.evaluate<BatchRequest[]>('window.__t164OverlapRequests');
    try {
      // Both drafts are added by native pointer/keyboard input in the preview.
      await s.pick('main > div > section > h2', '相同标题');
      await s.browser.send('Input.insertText', { text: '保留外层原文，只调整字距。' }); await s.key('Enter', 2);
      await s.wait(`!document.querySelector('[data-testid="annotation-composer"]')`);
      await s.pick('article p', '深层纸袋区块');
      await s.browser.send('Input.insertText', { text: '保留内层原文，只调整字距。' }); await s.key('Enter', 2);
      await s.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length === 2 && !document.querySelector('[data-testid="annotation-composer"]')`);
      const pending = await drafts(s);
      assert.deepEqual(pending.map(draft => draft.target.path), [[2, 0], [2, 0, 1]], '真实点选须形成祖先／后代范围');
      if (width < 1100) await s.click('[role="tab"]:nth-child(1)');
      for (let attempt = 1; attempt <= 2; attempt++) {
        await s.click('[data-testid="annotation-send-batch"]');
        await s.wait(`window.__t164OverlapRequests.length === ${attempt} && window.__t164OverlapRequests[${attempt - 1}].status !== null`);
        const sent = await requests(), current = (await state(id)).codeSite;
        await writeFile(`${output}/overlap-${width}-ordinary-${attempt}.json`, JSON.stringify({ sent, currentVersionId: current.currentVersionId, versions: current.versions.length, runs: current.runs.length }, null, 2));
        assert.equal(sent.at(-1)?.confirmed, false, '普通发送按钮在重叠提示后仍不得代替用户确认');
        assert.equal(sent.at(-1)?.status, 422, '未明确确认的重叠批次须被真实 chat 拒绝');
        assert.equal(current.currentVersionId, before.currentVersionId);
        assert.equal(current.versions.length, before.versions.length, '重复普通发送不能保存版本');
        assert.equal(current.runs.length, before.runs.length, '未确认不得创建任务');
        assert.equal((await localCalls()).length, callsBefore, '未确认不得调用局部模型');
        await s.wait(`document.querySelector('[data-testid="annotation-confirm-overlap"]') && !document.querySelector('[data-testid="annotation-send-batch"]').disabled`);
        assert.deepEqual((await drafts(s)).map(draft => ({ id: draft.id, body: draft.body, status: draft.status })), pending.map(draft => ({ id: draft.id, body: draft.body, status: 'draft' })), '两条意见须保持待发送');
      }
      await s.wait(`!document.querySelector('.code-preview-loading')`); await s.shot('overlap-still-pending');
      await s.click('[data-testid="annotation-confirm-overlap"]');
      const done = (await s.settle()).codeSite, sent = await requests();
      await writeFile(`${output}/overlap-${width}-confirmed.json`, JSON.stringify({ sent, run: done.run, versions: done.versions.length }, null, 2));
      assert.deepEqual(sent.map(item => item.confirmed), [false, false, true]);
      assert.deepEqual(sent.map(item => item.status), [422, 422, 202]);
      assert.equal(done.run.status, 'complete');
      assert.equal(done.versions.length, before.versions.length + 1, '明确确认才保存一个合并版本');
      assert.equal(done.runs.length, before.runs.length + 1);
      assert.deepEqual(done.run.annotationResults?.map((result: any) => result.draftIds), [pending.map(draft => draft.id)], '祖先／后代两条意见合成一个结果');
      assert.equal((await localCalls()).length, callsBefore + 1, '确认后只调用一次合组写作');
      await s.wait(`document.querySelectorAll('[data-testid="annotation-draft"]').length === 0 && !document.querySelector('.code-preview-loading')`);
      if (width < 1100) await s.click('[role="tab"]:nth-child(2)');
      await s.shot('overlap-confirmed');
    } catch (error) { await s.shot('overlap-confirmation-failure'); throw error; }
    finally { await s.browser.close(); }
  });
}

test('真实 chat 不把缺省或 false 的重叠请求当作已确认', { timeout: 120000 }, async () => {
  const id = await fixture(), before = (await state(id)).codeSite;
  const version = before.versions.find((item: any) => item.id === before.currentVersionId)!;
  const annotationBatch = [
    { draftId: 'ancestor', target: { kind: 'dom', pageId: 'home', versionId: version.id, path: [2], text: '相同标题深层纸袋区块相同说明底部产品链接', label: '外层区块' }, revision: version.revision, body: '保留外层原文。' },
    { draftId: 'descendant', target: { kind: 'dom', pageId: 'home', versionId: version.id, path: [2, 0], text: '相同标题深层纸袋区块相同说明底部产品链接', label: '内层区块' }, revision: version.revision, body: '保留内层原文。' },
  ];
  const callsBefore = (await localCalls()).length, observations = [];
  for (const confirmation of [{}, { annotationOverlapConfirmed: false }, {}]) {
    const response = await fetch(`${workflowBase}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '批量局部修改', baseRevision: version.revision, annotationBatch, saveAnnotation: true, annotationSubmissionId: crypto.randomUUID(), ...confirmation }) });
    const payload = await response.json(); observations.push({ confirmation, status: response.status, payload });
    await writeFile(`${output}/overlap-server-default.json`, JSON.stringify(observations, null, 2));
    assert.equal(response.status, 422);
    assert.match(payload.userMessage, /重叠|同一个范围/);
    const current = (await state(id)).codeSite;
    assert.equal(current.currentVersionId, before.currentVersionId);
    assert.equal(current.versions.length, before.versions.length);
    assert.equal(current.runs.length, before.runs.length);
    assert.equal((await localCalls()).length, callsBefore);
  }
});
