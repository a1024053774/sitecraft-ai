import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import * as probes from '../lib/code-site-local-edit.ts';

// Risks: duplicated/missing state reads, a lane starting from different styles,
// partial results accepted after failure, or a deadline bypass.
test('每侧三路保留完整读取次数，各路初始快照与串行基线逐项一致，失败与超时不返回部分结果', async () => {
  const browser = await codeCheckBrowser();
  const output = `artifacts/t178/parallel-contract-${Date.now()}-${process.pid}`;
  await mkdir(output, { recursive: true });
  const evidence: Record<string, any> = {};
  const pages: any[] = [];
  const originalContexts = await browser.sendBrowser<{ browserContextIds: string[] }>('Target.getBrowserContexts');
  try {
    assert.equal(typeof (probes as any).parallelOutsideCssApplications, 'function', '必须实现每侧独立路的并行探针');
    for (let index = 0; index < 3; index++) {
      const page = await browser.createContext();
      pages.push(page);
      await page.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
      const { frameTree } = await page.send<any>('Page.getFrameTree');
      pages[pages.length - 1] = { ...page, frameId: frameTree.frame.id };
    }
    const html = `<!doctype html><html><head><style>
      body{color:#111} .outside{--base:甲;display:list-item;width:40%}
      .outside::before{content:'前';color:green}.outside::after{content:'后'}
      main:has(:focus) .outside{--base:乙;color:red}
      main:hover .outside::marker{color:blue}
      main:active .outside::first-letter{font-size:25px}
    </style></head><body><main><section><a href="#">甲</a><a href="#">乙</a><a href="#">丙</a></section><p class="outside">外部文字</p></main></body></html>`;
    const scope = { paths: [[0]] };
    const serial = await probes.outsideCssApplications(pages[0], pages[0].frameId, html, scope);
    evidence.initialSnapshots = [];
    for (const page of pages) {
      const initial = await probes.outsideCssApplications(page, page.frameId, html, scope, Infinity, { states: false });
      assert.deepEqual(initial.states[0], serial.states[0], '各路同源同视口初始完整快照必须等于串行基线');
      evidence.initialSnapshots.push(initial.states[0]);
    }
    let captures = 0;
    const measured = pages.map(page => ({ ...page, browser: { ...page, async evaluate(expression: string) {
      const value = await page.evaluate(expression); if (value?.encoded) captures++; return value;
    } } }));
    const result = await (probes as any).parallelOutsideCssApplications(measured, html, scope, Date.now() + 5000);
    assert.equal(captures, 1 + 3 * 4, '基线一次，三个交互元素各四态，完整读取不增不减');
    assert.deepEqual(result.states, serial.states, '并行结果按串行次序逐项比较全部属性，不能只比较数量');
    evidence.captures = captures; evidence.states = result.states;
    const failing = measured.map((page, index) => index !== 1 ? page : { ...page, browser: { ...page.browser,
      async evaluate(expression: string) { if (expression.includes('readStarted')) throw new Error('刻意失败的一路'); return page.browser.evaluate(expression); } } });
    await assert.rejects((probes as any).parallelOutsideCssApplications(failing, html, scope, Date.now() + 5000), /刻意失败的一路/);
    await assert.rejects((probes as any).parallelOutsideCssApplications(measured, html, scope, Date.now() - 1), /超时/);
    evidence.failureRejected = true; evidence.timeoutRejected = true;
  } finally {
    try {
      await Promise.all(pages.map(page => page.close()));
      evidence.remainingContexts = await browser.sendBrowser('Target.getBrowserContexts');
      assert.deepEqual(evidence.remainingContexts.browserContextIds, originalContexts.browserContextIds);
      await writeFile(`${output}/result.json`, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
    } finally { await browser.close(); }
  }
});
