import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
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
  let captures = 0;
  const measured = { ...browser, async evaluate<T>(expression: string): Promise<T> {
    const value = await browser.evaluate<T>(expression);
    if (!value || typeof value !== 'object' || !('encoded' in value)) return value;
    const entries = JSON.parse(gunzipSync(Buffer.from(String(value.encoded), 'base64')).toString('utf8'));
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
    for (const oracle of expected) {
      const entry = entries.find((item: any) => JSON.stringify(item.path) === '[1,0,1]' && item.pseudo === oracle.pseudo);
      const actual = entry ? { pseudo: entry.pseudo, present: entry.present, styles: entry.styles } : baseline.get(oracle.pseudo);
      if (captures === 0) baseline.set(oracle.pseudo, actual);
      assert.deepEqual(actual, oracle, `第 ${captures} 态 ${oracle.pseudo || '元素'} 的完整属性集合或值不一致`);
    }
    observations.push({ capture: captures++, expected });
    return value;
  } };
  try {
    const { frameTree } = await browser.send<any>('Page.getFrameTree');
    for (const width of [375, 768, 1440]) {
      captures = 0; baseline.clear();
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
    }
  } finally {
    await writeFile(`${output}/observations.json`, JSON.stringify(observations, null, 2) + '\n', 'utf8');
    await browser.close();
  }
});
