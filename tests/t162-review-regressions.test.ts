import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { base, workflowBase, output, state, fixture, session, commitSiteCode } from './helpers/t162-browser.ts';

// Independent acceptance: history is read-only; successive picks remain writable;
// browser storage refusal cannot crash the workspace. Each case reaches the state
// reported by Astra, rather than stopping at the name of the annotation button.
async function historicalSite() {
  const id = await fixture(), first = (await state(id)).codeSite.versions[0];
  const second = await commitSiteCode({ siteId: id, baseRevision: 1, code: { ...first.code, css: first.code.css + '\nh3{letter-spacing:.02em}' }, author: 'user', summary: '历史批注版本', request: '调整纸袋标题字距，保留文字' });
  assert.equal(second.status, 'applied'); if (second.status !== 'applied') throw new Error('历史夹具未存版');
  const response = await fetch(`${base}/api/sites/${id}/annotations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ siteId: id, pageId: 'home', pagePath: '/home',
    anchor: { pageId: 'home', pagePath: '/home', revision: 2, locale: 'zh', capturedAt: new Date().toISOString(),
      target: { kind: 'dom', pageId: 'home', versionId: second.version.id, path: [2, 0, 1], text: '深层纸袋区块相同说明底部产品链接', label: '深层纸袋区块' }, snapshot: { label: '深层纸袋区块' } },
    body: '只修改纸袋区块', author: { id: 'review-test', name: '测试者' } }) });
  assert.equal(response.status, 201);
  const restored = await fetch(`${workflowBase}/api/sites/${id}/history/undo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"baseRevision":2}' });
  assert.equal(restored.status, 200); assert.equal((await state(id)).codeSite.versions.length, 3);
  return id;
}

test('Astra P1：回看 v2 时不得提交当前 v3 修改，四个快捷按钮停用', { timeout: 120000 }, async () => {
  for (const width of [1440, 768, 375]) {
    const id = await historicalSite();
    const s = await session(width, { siteId: id, beforeNavigate: async browser => {
      await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__t162EditRequests=[];const originalFetch=window.fetch;window.fetch=function(input,init){if(String(input).endsWith('/chat')&&init?.body){const body=JSON.parse(init.body);if(body.message)window.__t162EditRequests.push(body)}return originalFetch.apply(this,arguments)}` });
    } });
    try {
      if (width < 1100) await s.click('[role="tab"]:nth-child(1)');
      await s.click('.code-annotation-threads summary'); await s.wait(`document.querySelector('[data-testid="thread-reveal"]')`);
      await s.click('[data-testid="thread-reveal"]'); await s.wait(`document.querySelector('[data-testid="annotation-composer"]') && document.querySelector('.code-preview-version')?.textContent.includes('v2')`);
      if (width < 1100) await s.click('[role="tab"]:nth-child(1)');
      await s.click('#code-message'); await s.browser.send('Input.insertText', { text: '只精简我正在回看的纸袋区块' });
      await s.click('.code-chat-form button[type="submit"]');
      const observed = await s.browser.evaluate<any>(`({requests:window.__t162EditRequests,buttons:[...document.querySelectorAll('.code-quick-edits button')].map(b=>({text:b.textContent,disabled:b.disabled})),notice:document.body.innerText})`);
      await writeFile(`${output}/history-${width}.json`, JSON.stringify(observed, null, 2));
      assert.deepEqual(observed.requests, [], '历史回看不得发送整页或当前版本的编辑请求');
      assert.equal(observed.buttons.length, 4); assert.ok(observed.buttons.every((b: any) => b.disabled), '历史回看期间四个快捷按钮均停用');
      assert.match(observed.notice, /回到当前版本.*重新点选/);
      await s.shot('review-history-blocked');
      // Returning to current clears the historical target; another native pick is required.
      if (width < 1100) await s.click('[role="tab"]:nth-child(2)');
      await s.click('.code-preview-version button'); await s.wait(`!document.querySelector('.code-preview-loading')`);
      assert.equal(await s.browser.evaluate(`!!document.querySelector('[data-testid="selected-target"]')`), false);
      await s.pick(); await s.browser.send('Input.insertText', { text: '回到当前版后重新点选的意见' });
      assert.equal(await s.browser.evaluate(`document.querySelector('#annotation-message').value`), '回到当前版后重新点选的意见');
    } catch (error) { await s.shot('review-history-failure'); throw error; } finally { await s.browser.close(); }
  }
});

test('Astra P2：意见框连续点选另一块后，真实输入进入第二个目标', { timeout: 120000 }, async () => {
  for (const width of [1440, 768, 375]) {
    const s = await session(width);
    try {
      // Use a scaled desktop preview at every width so both selected targets can
      // remain reachable beside the open composer, including the phone sheet.
      if (width !== 1440) await s.click('.device-toggle[aria-label="预览宽度"] button:first-child');
      await s.pick('section h1', '青禾纸品');
      assert.equal(await s.browser.evaluate(`document.activeElement?.id`), 'annotation-message');
      await s.browser.send('Input.insertText', { text: '首屏意见' });
      await s.pick('article p', '深层纸袋区块');
      await s.browser.send('Input.insertText', { text: '第二处纸袋意见' });
      const observed = await s.browser.evaluate<any>(`({active:document.activeElement?.tagName,activeId:document.activeElement?.id,scope:document.querySelector('[data-testid="annotation-scope"]').textContent,opinion:document.querySelector('#annotation-message').value})`);
      await writeFile(`${output}/focus-${width}.json`, JSON.stringify(observed, null, 2));
      assert.equal(observed.activeId, 'annotation-message', '目标切换必须把焦点交回意见框');
      assert.match(observed.scope, /深层纸袋区块/); assert.equal(observed.opinion, '第二处纸袋意见');
      await s.shot('review-focus-second');
    } catch (error) { await s.shot('review-focus-failure'); throw error; } finally { await s.browser.close(); }
  }
});

test('Astra P3：点选存储读写删除被拒时降级，工作台仍可操作', { timeout: 120000 }, async () => {
  const cases = ['getItem', 'setItem', 'removeItem', 'all'];
  if (process.env.T162_STORAGE_CASE) assert.ok(cases.includes(process.env.T162_STORAGE_CASE), '不支持的存储拒绝场景');
  for (const method of process.env.T162_STORAGE_CASE ? [process.env.T162_STORAGE_CASE] : cases) {
    const s = await session(1440, { beforeNavigate: async browser => {
      await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__t162ReviewErrors=[];window.__t162StorageDenied=[];window.addEventListener('error',e=>window.__t162ReviewErrors.push((e.error?.message||e.message)+'; 存储拒绝：'+window.__t162StorageDenied.at(-1)));for(const name of ${JSON.stringify(method === 'all' ? ['getItem', 'setItem', 'removeItem'] : [method])}){const original=Storage.prototype[name];Storage.prototype[name]=function(key,...args){if(${JSON.stringify(method)}==='all'||String(key).startsWith('sitecraft-selection:')){window.__t162StorageDenied.push(name);throw new DOMException('Storage denied: '+name,'SecurityError')};return original.call(this,key,...args)}}` });
    } });
    try {
      await s.pick(); await s.browser.send('Input.insertText', { text: `存储 ${method} 被拒仍能输入` });
      const observed = await s.browser.evaluate<any>(`({workspace:!!document.querySelector('[data-testid="code-workspace"]'),errors:window.__t162ReviewErrors,alerts:[...document.querySelectorAll('.code-error')].map(e=>e.textContent),opinion:document.querySelector('#annotation-message').value,addDisabled:document.querySelector('[data-testid="annotation-add"]').disabled})`);
      await writeFile(`${output}/storage-${method}.json`, JSON.stringify(observed, null, 2));
      assert.equal(observed.workspace, true); assert.deepEqual(observed.errors, []);
      assert.equal(observed.opinion, `存储 ${method} 被拒仍能输入`); assert.ok(observed.alerts.length > 0, '存储失败必须有可见说明');
      if (method !== 'all') {
        await s.click('[data-testid="annotation-add"]'); await s.wait(`document.querySelector('[data-testid="annotation-draft"]')`);
        assert.match(await s.browser.evaluate<string>(`document.querySelector('[data-testid="annotation-draft"]').textContent`), new RegExp(`存储 ${method} 被拒仍能输入`));
      } else assert.equal(observed.addDisabled, true, '全部存储不可用时不假装草稿已保存');
      await s.shot(`review-storage-${method}`);
    } catch (error) { await s.shot(`review-storage-${method}-failure`); throw error; } finally { await s.browser.close(); }
  }
});
