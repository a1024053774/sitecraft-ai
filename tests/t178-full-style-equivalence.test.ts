import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { outsideCssApplications } from '../lib/code-site-local-edit.ts';

// Independent oracle: Chrome's per-property CSSOM getter, observed while each
// real forced state is still active. Omitted duplicates must equal the baseline.
// Covers aliases, custom-name replacement, generated-box appearance and live
// pseudo declarations. A reader returning only a subset or stale values fails.
test('完整样式快照逐态等于浏览器原生逐属性读取，包含实时自定义属性与五类伪元素', async () => {
  const browser = await codeCheckBrowser();
  const output = `artifacts/t178/full-style-${Date.now()}-${process.pid}`;
  await mkdir(output, { recursive: true });
  const observations: unknown[] = [];
  const baseline = new Map<string, unknown>();
  const expectedStates: any[][] = [];
  let captures = 0;
  const measured = { ...browser, async evaluate<T>(expression: string): Promise<T> {
    const value = await browser.evaluate<T>(expression);
    if (!value || typeof value !== 'object' || !('encoded' in value)) return value;
    const expected = await browser.evaluate<any[]>(`(() => {
      const node=document.querySelector('.outside');
      return ['', '::before', '::after', '::marker', '::first-line', '::first-letter'].map(pseudo=>{
        const style=getComputedStyle(node,pseudo||null);
        const present=!pseudo||(pseudo==='::before'||pseudo==='::after'
          ?style.content!=='none'&&style.content!=='normal'&&style.display!=='none'
          :pseudo==='::marker'?getComputedStyle(node).display.includes('list-item'):true);
        return {pseudo,present,styles:present?[...style].sort((a,b)=>a.localeCompare(b)).map(name=>[name,style.getPropertyValue(name)]):[]};
      });
    })()`);
    expectedStates.push(expected);
    observations.push({ capture: captures++, expected });
    return value;
  } };
  try {
    const { frameTree } = await browser.send<any>('Page.getFrameTree');
    for (const width of [375, 768, 1440]) {
      captures = 0; baseline.clear(); expectedStates.length = 0;
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const probe = await outsideCssApplications(measured, frameTree.frame.id, `<!doctype html><html><head><style>
        body{color:#111;background:white} .outside{display:list-item;float:none;width:40%;margin:3px;--old:甲;transform:translateX(2px)}
        .outside::after{content:'后';color:green}.outside::marker{color:blue}
        main:has(:focus) .outside{--old:initial;--new:乙;float:left;transform:rotate(2deg)}
        main:hover .outside::before{content:'前';color:red}
        main:active .outside::first-letter{font-size:22px}
        @media(max-width:479px){main:focus-within .outside::first-line{letter-spacing:2px}}
      </style></head><body><main><section class="target"><a href="#">入口</a></section><p class="outside">外部完整计算样式核对</p></main></body></html>`, { paths: [[0]] });
      assert.equal(probe.interactiveElements, 1);
      assert.equal(probe.statesChecked, 4);
      assert.equal(captures, 5);
      assert.equal(probe.states.length, expectedStates.length, '每份公开快照都必须接受独立原生核对');
      for (const [index, state] of probe.states.entries()) for (const oracle of expectedStates[index]) {
        const entry = state.entries.find(item => JSON.stringify(item.path) === '[1,0,1]' && item.pseudo === oracle.pseudo);
        const actual = entry ? { pseudo: entry.pseudo, present: entry.present, styles: entry.styles } : baseline.get(oracle.pseudo);
        if (index === 0) baseline.set(oracle.pseudo, actual);
        assert.deepEqual(actual, oracle, `第 ${index} 态 ${oracle.pseudo || '元素'} 的完整属性集合或值不一致`);
      }
    }
  } finally {
    await writeFile(`${output}/observations.json`, JSON.stringify(observations, null, 2) + '\n', 'utf8');
    await browser.close();
  }
});
