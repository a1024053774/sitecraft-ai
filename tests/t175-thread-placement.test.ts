import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseFragment, type DefaultTreeAdapterTypes as Dom } from 'parse5';
import { base, commitSiteCode, session, state, updateCodeSite } from './helpers/t162-browser.ts';

const output = `artifacts/t175/thread-placement-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const restaurant = JSON.parse(await readFile(new URL('./fixtures/t175-restaurant.json', import.meta.url), 'utf8'));
const opinion = `${restaurant.annotation}\n补充说明：查看本条意见时，请保留收费口径的其余说明和原有操作。`;

async function historicalSite() {
  const response = await fetch(`${base}/api/sites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: restaurant.name }) });
  assert.equal(response.status, 201); const { id } = await response.json();
  await updateCodeSite(id, () => ({ materials: `${restaurant.materials}\n${restaurant.annotation}`, plan: restaurant.plan, preferences: restaurant.preferences }));
  const first = await commitSiteCode({ siteId: id, baseRevision: 0, code: restaurant.version.code, author: 'user', summary: '浮层定位初版', request: '' });
  assert.equal(first.status, 'applied', JSON.stringify(first)); if (first.status !== 'applied') throw new Error('初版未存成');
  const main = parseFragment(first.version.code.pages[0].html).childNodes.find(node => 'tagName' in node && node.tagName === 'main') as Dom.Element;
  const block = main.childNodes.filter(node => 'tagName' in node)[5];
  const text = (node: Dom.Node): string => node.nodeName === '#text' ? (node as Dom.TextNode).value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
  const target = { kind: 'dom', pageId: 'home', versionId: first.version.id, path: [5], label: '收费口径', text: text(block).replace(/\s+/g, ' ').trim().slice(0, 1000) };
  const created = await fetch(`${base}/api/sites/${id}/annotations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    pageId: 'home', pagePath: '/home', author: { id: 'placement-test', name: '你' }, body: opinion,
    anchor: { pageId: 'home', pagePath: '/home', revision: 1, locale: 'zh', capturedAt: new Date().toISOString(), target, snapshot: { label: target.label } },
  }) });
  assert.equal(created.status, 201);
  const second = await commitSiteCode({ siteId: id, baseRevision: 1, code: first.version.code, author: 'user', summary: '保留历史线程', request: '' });
  assert.equal(second.status, 'applied', JSON.stringify(second));
  return id;
}

async function geometry(view: Awaited<ReturnType<typeof session>>) {
  return view.browser.evaluate<any>(`(()=>{
    const box=el=>el?.getBoundingClientRect().toJSON();
    const panel=document.querySelector('[data-testid="annotation-composer"]'),button=document.querySelector('.code-preview-version button');
    const frame=document.querySelector('[data-testid="code-preview"]'),fr=frame.getBoundingClientRect(),stage=box(document.querySelector('.code-preview-stage'));
    const r=frame.contentDocument.querySelector('main').children[5].getBoundingClientRect(),scale=fr.width/frame.offsetWidth;
    const target={left:Math.max(fr.left+r.left*scale,fr.left,stage.left,0),right:Math.min(fr.left+r.right*scale,fr.right,stage.right,innerWidth),
      top:Math.max(fr.top+r.top*scale,fr.top,stage.top,0),bottom:Math.min(fr.top+r.bottom*scale,fr.bottom,stage.bottom,innerHeight)};
    const b=box(button),point=b?{x:b.x+b.width/2,y:b.y+b.height/2}:null,hit=point?document.elementFromPoint(point.x,point.y):null;
    return {viewport:{width:innerWidth,height:innerHeight},panel:box(panel),target,bar:box(document.querySelector('.code-preview-version')),
      button:b,point,buttonHit:!!button&&hit===button,hitTag:hit?.tagName,hitClass:hit?.className,
      loaded:!document.querySelector('.code-preview-loading')&&frame.contentDocument.readyState==='complete',text:panel?.textContent};
  })()`);
}

function assertPanel(observed: any) {
  const p = observed.panel, t = observed.target;
  assert.equal(observed.loaded, true, '须完成真实预览载入');
  assert.ok(p && p.width > 0 && p.height > 0, '浮层须有可见内容');
  assert.ok(p.left >= 0 && p.right <= observed.viewport.width && p.top >= 0 && p.bottom <= observed.viewport.height, '浮层须完整留在视口内');
  assert.ok(t.right > t.left && t.bottom > t.top, '目标须仍在预览可见区域内');
  assert.ok(p.right <= t.left || p.left >= t.right || p.bottom <= t.top || p.top >= t.bottom, '浮层不得遮挡预览中可见的目标区块');
  if (observed.bar) {
    const b = observed.bar;
    assert.ok(p.right <= b.left || p.left >= b.right || p.bottom <= b.top || p.top >= b.bottom, '浮层须避开整个历史回看栏');
  }
}

for (const width of [375, 768, 1440]) test(`历史返回按钮与浮层边界成对验证 ${width}`, { timeout: 120000 }, async () => {
  const id = await historicalSite(), view = await session(width, { siteId: id });
  try {
    if (width < 1100) await view.click('[role="tab"]:nth-child(1)');
    await view.click('.code-annotation-threads summary');
    await view.wait(`document.querySelector('[data-testid="thread-reveal"]')`);
    await view.click('[data-testid="thread-reveal"]');
    await view.wait(`document.querySelector('.code-preview-version') && document.querySelector('[data-testid="annotation-composer"]') && !document.querySelector('.code-preview-loading')`);
    await view.browser.evaluate('document.fonts.ready');
    await view.browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const observed = await geometry(view);
    await writeFile(`${output}/history-${width}.json`, JSON.stringify(observed, null, 2), 'utf8');
    await view.shot(`thread-history-${width}`);
    assert.equal(observed.buttonHit, true, `返回按钮中心须实际命中按钮本身，实际命中 ${observed.hitTag}.${observed.hitClass}`);
    assertPanel(observed);
    await view.click('.code-preview-version button');
    await view.wait(`!document.querySelector('.code-preview-version') && !document.querySelector('.code-preview-loading')`);
    await view.pick('main > section:nth-of-type(6) h2', '收费口径');
    const draft = await geometry(view);
    await writeFile(`${output}/draft-${width}.json`, JSON.stringify(draft, null, 2), 'utf8');
    assertPanel(draft);
    await view.click('#annotation-message');
    await view.browser.send('Input.insertText', { text: '避让后仍可输入原意见。' });
    assert.equal(await view.browser.evaluate(`document.querySelector('#annotation-message').value`), '避让后仍可输入原意见。');
    await view.shot(`thread-input-${width}`);
    assert.equal((await state(id)).codeSite.versions.length, 2, '定位、返回和输入均不存版本');
  } catch (error) { await view.shot(`thread-placement-failure-${width}`); throw error; }
  finally { await view.browser.close(); }
});
