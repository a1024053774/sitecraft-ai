import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { renderSiteCode } from '../lib/code-site.ts';

// Capability gate only. No production fallback or reduced property set.
const [output] = process.argv.slice(2);
assert.ok(output?.startsWith('artifacts/t178/'));
await mkdir(output);
const observations: Record<string, any> = { at: new Date().toISOString(), sourceRevision: '7cfd723' };
const checkDocument = await readFile('public/code-check.html', 'utf8');
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(checkDocument); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const browser = await codeCheckBrowser();
const attempt = async (method: string, params: Record<string, unknown> = {}) => {
  try { return { ok: true, value: await browser.send(method, params) }; }
  catch (error) { return { ok: false, error: String(error) }; }
};

// The protocol accepts name/value pairs, not property names alone. Register
// every baseline value from every element and pseudo, without truncation.
const readAll = `(() => {
  const rows=[],pairs=new Map(),names=new Set();
  for(const node of document.querySelectorAll('*')) for(const pseudo of ['', '::before', '::after', '::marker', '::first-line', '::first-letter']) {
    const style=getComputedStyle(node,pseudo||null);
    const styles=[...style].map(name=>[name,style.getPropertyValue(name)]);
    for(const [name,value] of styles){names.add(name);pairs.set(JSON.stringify([name,value]),{name,value})}
    if(!pseudo)rows.push({id:node.id,styles});
  }
  return {rows,properties:[...pairs.values()],names:[...names],elements:document.querySelectorAll('*').length};
})()`;

try {
  observations.version = await browser.send('Browser.getVersion');
  await browser.loadPage('Page.navigate', { url: `http://127.0.0.1:${address.port}/code-check.html` });
  assert.equal(await browser.evaluate(`document.contentType==='text/html' && performance.getEntriesByType('navigation')[0]?.responseStatus===200 && !!document.querySelector('meta[name="sitecraft-code-check"][content="v1"]') && !document.querySelector('script')`), true);
  observations.enable = {
    cssBeforeDom: await attempt('CSS.enable'),
    trackBeforeEnable: await attempt('CSS.trackComputedStyleUpdates', { propertiesToTrack: [{ name: 'color', value: 'rgb(0, 0, 0)' }] }),
  };
  await browser.send('DOM.enable'); await browser.send('CSS.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1000, deviceScaleFactor: 1, mobile: false });
  const { frameTree } = await browser.send<any>('Page.getFrameTree');
  const frameId = frameTree.frame.id;
  const fixture = JSON.parse(await readFile('tests/fixtures/t178-restaurant.json', 'utf8'));
  await browser.send('Page.setDocumentContent', { frameId, html: renderSiteCode(fixture.timingSiteId, fixture.version.code, 'home') });
  const restaurant = await browser.evaluate<any>(readAll);
  observations.fullRestaurantList = { elements: restaurant.elements, propertyNames: restaurant.names.length,
    nameValuePairs: restaurant.properties.length, accepted: await attempt('CSS.trackComputedStyleUpdates', { propertiesToTrack: restaurant.properties }) };
  assert.equal(observations.fullRestaurantList.accepted.ok, true, '完整夹具属性列表必须可登记');
  await browser.send('CSS.trackComputedStyleUpdates', { propertiesToTrack: [] });

  async function probe(kind: 'color' | 'layout') {
    const html = `<!doctype html><html><head><style>
      *{box-sizing:border-box}body{margin:0}main{display:flex;width:400px}
      #trigger{flex:0 0 auto;width:100px;padding:0;border:0}
      #outside{flex:1;min-width:0;color:rgb(10,20,30);--complete:baseline}
      ${kind === 'color' ? '#trigger:hover + #outside{color:rgb(40,50,60)}' : '#trigger:hover{width:200px}'}
    </style></head><body><main><button id="trigger">入口</button><div id="outside">范围外</div></main></body></html>`;
    await browser.send('Page.setDocumentContent', { frameId, html });
    const { root } = await browser.send<any>('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeIds } = await browser.send<{ nodeIds: number[] }>('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '*' });
    const ids: Record<string, number> = {};
    for (const nodeId of nodeIds) {
      const { node } = await browser.send<any>('DOM.describeNode', { nodeId });
      const index = node.attributes?.indexOf('id');
      if (index >= 0) ids[node.attributes[index + 1]] = nodeId;
    }
    const baseline = await browser.evaluate<any>(readAll);
    assert.equal(nodeIds.length, baseline.elements, '所有元素必须已推送至 DOM 前端，不能用未绑定节点制造漏报');
    const before = baseline.rows.find((row: any) => row.id === 'outside');
    await browser.send('CSS.trackComputedStyleUpdates', { propertiesToTrack: baseline.properties });
    let arrivedAt: number | null = null;
    const started = performance.now();
    const update = browser.send<{ nodeIds: number[] }>('CSS.takeComputedStyleUpdates').then(value => {
      arrivedAt = performance.now() - started; return value;
    });
    await browser.send('CSS.forcePseudoState', { nodeId: ids.trigger, forcedPseudoClasses: ['hover'] });
    const immediate = await browser.evaluate<any>(readAll);
    const arrivedAfterSynchronousRead = arrivedAt;
    // Flush style/layout, then cross two real frame boundaries, not a sleep.
    await browser.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.body.offsetWidth;resolve(true)})))`);
    const after = await browser.evaluate<any>(readAll);
    const arrivedAfterFrames = arrivedAt;
    assert.notEqual(arrivedAfterFrames, null, '本实验必须先确认至少一次真实更新已返回');
    const updates = await update;
    // One reply may contain only the first changed node. Drain a second take
    // after the complete synchronous read and frame barriers before judging it.
    const remaining = browser.send<{ nodeIds: number[] }>('CSS.takeComputedStyleUpdates');
    // No-change take is long-polling. Disabling tracking explicitly releases
    // its pending reply; never reinterpret a protocol timeout as an empty set.
    await browser.send('CSS.trackComputedStyleUpdates', { propertiesToTrack: [] });
    const laterUpdates = await remaining;
    const allUpdates = [...new Set([...updates.nodeIds, ...laterUpdates.nodeIds])];
    const changed = after.rows.find((row: any) => row.id === 'outside');
    assert.deepEqual(immediate.rows, after.rows, '同步完整读取后已达到与两帧后相同的样式');
    const previous = new Map<string, string>(before.styles);
    const differences = changed.styles.filter(([name, value]: [string, string]) => previous.get(name) !== value)
      .map(([name, value]: [string, string]) => ({ name, before: previous.get(name), after: value }));
    // Independent expectations come from the authored fixed-width flex layout
    // and explicit color rules, not from the API's list of changed nodes.
    const current = new Map<string, string>(changed.styles);
    if (kind === 'color') {
      assert.equal(previous.get('color'), 'rgb(10, 20, 30)');
      assert.equal(current.get('color'), 'rgb(40, 50, 60)');
    } else {
      assert.equal(previous.get('width'), '300px');
      assert.equal(current.get('width'), '200px');
    }
    assert.ok(differences.length > 0);
    const result = { kind, elements: baseline.elements, boundElements: nodeIds.length,
      propertyNames: baseline.names.length, nameValuePairs: baseline.properties.length,
      outsideNodeId: ids.outside, updates: allUpdates, batches: [updates.nodeIds, laterUpdates.nodeIds], differences,
      arrivedAfterSynchronousRead, arrivedAfterFrames, replyMs: arrivedAt,
      reportedOutside: allUpdates.includes(ids.outside),
      gate: allUpdates.includes(ids.outside) ? 'PASS' : 'BLOCKED' };
    console.log(JSON.stringify(result));
    return result;
  }
  observations.colorControl = await probe('color');
  assert.equal(observations.colorControl.reportedOutside, true, '直接颜色变化的正常对照应能回报');
  observations.layoutCounterexample = await probe('layout');
  observations.gate = observations.layoutCounterexample.reportedOutside ? 'INCOMPLETE' : 'BLOCKED';
  observations.skipped = observations.gate === 'BLOCKED'
    ? ['五类伪元素覆盖：普通元素门禁失败即停止', '生产优化、131 对照及三档五次分布：未通过准入']
    : ['本脚本只验证普通元素；五类伪元素和其他覆盖尚未验证，不构成生产准入'];
  process.exitCode = 2;
} catch (error) {
  observations.error = String(error); observations.gate = 'INCOMPLETE'; throw error;
} finally {
  await writeFile(`${output}/result.json`, JSON.stringify(observations, null, 2) + '\n', 'utf8');
  await browser.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
