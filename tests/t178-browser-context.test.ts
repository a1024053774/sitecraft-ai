import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// Failure modes: shared context/renderer, cross-page focus/hover, and leaked
// targets after closing a context. Expectations follow browser isolation.
test('动态检查各路独立上下文、焦点和 hover，关闭后页面与上下文均消失', async () => {
  const browser = await codeCheckBrowser();
  const output = `artifacts/t178/context-contract-${Date.now()}-${process.pid}`;
  await mkdir(output, { recursive: true });
  const evidence: Record<string, any> = {};
  try {
    assert.equal(typeof (browser as any).createContext, 'function', '每路必须创建独立 BrowserContext');
    const lanes = await Promise.all([0, 1].map(() => (browser as any).createContext()));
    try {
      assert.notEqual(lanes[0].browserContextId, lanes[1].browserContextId);
      const html = '<!doctype html><html><head><style>button{color:rgb(10,20,30)}button:hover{color:rgb(40,50,60)}</style></head><body><button id="a">甲</button><button id="b">乙</button></body></html>';
      for (const lane of lanes) {
        await lane.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
        const { frameTree } = await lane.send('Page.getFrameTree');
        await lane.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
        await lane.send('DOM.enable'); await lane.send('CSS.enable');
      }
      const snapshot = (lane: any) => lane.evaluate(`({active:document.activeElement.id,color:getComputedStyle(document.querySelector('#a')).color})`);
      await lanes[0].evaluate(`document.querySelector('#a').focus()`);
      const { root } = await lanes[0].send('DOM.getDocument');
      const { nodeId } = await lanes[0].send('DOM.querySelector', { nodeId: root.nodeId, selector: '#a' });
      await lanes[0].send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
      await lanes[1].evaluate(`document.querySelector('#b').focus()`);
      evidence.states = await Promise.all(lanes.map(snapshot));
      assert.deepEqual(evidence.states, [
        { active: 'a', color: 'rgb(40, 50, 60)' }, { active: 'b', color: 'rgb(10, 20, 30)' },
      ]);
      evidence.contexts = await browser.sendBrowser('Target.getBrowserContexts');
      evidence.targets = await browser.sendBrowser('Target.getTargets');
      evidence.processes = await browser.sendBrowser('SystemInfo.getProcessInfo');
      assert.ok(evidence.processes.processInfo.filter((value: any) => value.type === 'renderer').length >= 2);
      for (const lane of lanes) assert.ok(evidence.targets.targetInfos.some((info: any) =>
        info.targetId === lane.targetId && info.browserContextId === lane.browserContextId));
    } finally { await Promise.all(lanes.map((lane: any) => lane.close())); }
    evidence.closedContexts = await browser.sendBrowser('Target.getBrowserContexts');
    evidence.closedTargets = await browser.sendBrowser('Target.getTargets');
    for (const lane of lanes) {
      assert.ok(!evidence.closedContexts.browserContextIds.includes(lane.browserContextId));
      assert.ok(!evidence.closedTargets.targetInfos.some((info: any) => info.targetId === lane.targetId));
    }
  } finally {
    await writeFile(`${output}/result.json`, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
    await browser.close();
  }
});
