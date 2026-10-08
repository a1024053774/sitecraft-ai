import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// --real-reference uses the running, genuinely configured server once. --controlled
// owns a dev server on 3141 and controls only fact-audit HTTP, never the writer.
const real = process.argv.includes('--real-reference');
const saved = process.argv.includes('--assert-saved');
assert.ok(real || saved || process.argv.includes('--controlled'), 'Choose --real-reference, --assert-saved or --controlled explicitly');
const argument = (flag, fallback) => { const at = process.argv.indexOf(flag); return at < 0 ? fallback : process.argv[at + 1]; };
const requestedPage = argument('--page', null);
// These selectors describe the supplied manual fixture, not generated-site rules.
const productSelectors = { home: 'main > section:has(a[href*="page=products"])', products: '#products' };
const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3141';
const root = process.env.T129_ARTIFACT_DIR || 'artifacts/t129';
const fixture = JSON.parse(await readFile(path.join(root, 'fixture.json'), 'utf8'));
const siteId = process.env.T129_SITE_ID || fixture.siteId;
const output = path.join(root, process.env.T129_RUN_NAME || (real ? 'real-reference' : 'ui'));
await mkdir(output, { recursive: true });
let browser, child, audit, log;
const report = { startedAt: new Date().toISOString(), base, siteId, mode: saved ? 'saved versions, read-only; no model request' : real ? 'real DeepSeek, one request' : 'controlled fact-audit HTTP; manual fixture; actual Next/commit/Chrome', requestedPage, screenshots: [], checks: [] };
async function state() {
  const response = await fetch(`${base}/api/sites/${siteId}/draft`);
  assert.equal(response.status, 200);
  return (await response.json()).codeSite;
}
async function wait(expression, label, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await browser.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
async function click(selector) {
  assert.equal(await browser.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled||!el.getClientRects().length) return false;el.scrollIntoView({block:'nearest'});el.click();return true})()`), true, selector);
}
async function value(selector, value) {
  await browser.evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(${JSON.stringify(selector.includes('select') ? 'change' : 'input')},{bubbles:true}))})()`);
}
async function capture(name) {
  await wait(`!document.querySelector('[data-testid=version-preview-loading]')`, 'loaded version preview');
  const frame = await browser.send('Page.getFrameTree');
  report.checks.push({ name, previewFrames: frame.frameTree.childFrames?.map(item => item.frame.url) });
  assert.ok(frame.frameTree.childFrames?.some(item => item.frame.url.includes('/code-preview')), 'a real preview document must be loaded');
  const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(output, `${name}.png`); await writeFile(file, Buffer.from(shot.data, 'base64'));
  report.screenshots.push(file);
}
async function inspectPage(versionId, page, width, name) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 900, deviceScaleFactor: 1, mobile: false });
  const url = `${base}/api/sites/${siteId}/code-preview?version=${versionId}&page=${page}`;
  await browser.send('Page.navigate', { url });
  await wait(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && Boolean(document.querySelector('main h1'))`, `${name} page`);
  // The preview's CSP sandbox disables scripts; observe readiness synchronously
  // through CDP instead of waiting on a page callback that the sandbox cannot run.
  await wait(`document.fonts.status === 'loaded'`, `${name} fonts`);
  const observed = await browser.evaluate(`(() => {
    const text = node => node?.textContent.replace(/\\s+/g, '') ?? '';
    const style = node => {if(!node)return null;const s=getComputedStyle(node);const result=Object.fromEntries(['color','fontSize','fontWeight','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft'].map(key=>[key,s[key]]));let ancestor=node;while(ancestor){const background=getComputedStyle(ancestor).backgroundColor;if(background!=='rgba(0, 0, 0, 0)'&&background!=='transparent'){result.backgroundColor=background;break}ancestor=ancestor.parentElement}return result;};
    const snapshot = node => node ? {text:text(node),style:style(node),headings:[...node.querySelectorAll('h1,h2,h3')].map(text),tables:node.querySelectorAll('table').length,lists:node.querySelectorAll('ul,ol').length} : null;
    const selector=${JSON.stringify(productSelectors[page] ?? null)}, main=document.querySelector('main'), clone=main.cloneNode(true);
    const products=selector?[...document.querySelectorAll(selector)]:[];if(products.length>1)throw new Error('The supplied fixture must identify one product region per page');
    const product=products[0]??null;if(selector)clone.querySelector(selector)?.remove();
    const normalizeHTML = node => {
      const copy=node.cloneNode(true);
      for(const element of [copy,...copy.querySelectorAll('*')]) {
        const attributes=[...element.attributes].map(attribute=>[attribute.name,attribute.value]).sort(([a],[b])=>a.localeCompare(b));
        for(const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
        for(let [name,value] of attributes) {
          if(name==='href') {
            const url=new URL(value,${JSON.stringify(base)});
            if(url.origin===${JSON.stringify(new URL(base).origin)}&&url.pathname===${JSON.stringify(`/api/sites/${siteId}/code-preview`)}) {
              url.searchParams.delete('version');value=url.pathname+url.search+url.hash;
            }
          }
          element.setAttribute(name,value);
        }
      }
      const walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT), whitespace=[];
      while(walker.nextNode()) if(!walker.currentNode.textContent.trim()) whitespace.push(walker.currentNode);
      for(const node of whitespace) node.remove();
      return copy.outerHTML;
    };
    const editableProduct=${JSON.stringify(!requestedPage || requestedPage === page)};
    const outsideBody=document.body.cloneNode(true);if(selector&&editableProduct)outsideBody.querySelector(selector)?.remove();
    const scrollPosition={left:scrollX,top:scrollY,behavior:'instant'};
    const interactions=[...document.querySelectorAll('a,button,input,textarea,select,[role="button"],[data-system-inquiry],.sc-inquiry')]
      .filter(node=>!editableProduct||(node!==product&&!product?.contains(node)))
      .map(node=>{
        // Probe each control in view, including controls below the fold. These
        // browser results include ancestor hiding and interception by overlays.
        node.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
        const rect=node.getBoundingClientRect();
        const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
        return {html:normalizeHTML(node),visible:node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),nonzeroLayout:rect.width>0&&rect.height>0,centerHit:hit===node||node.contains(hit)};
      });
    window.scrollTo(scrollPosition);
    return {product:snapshot(product),outside:{outerHTML:normalizeHTML(outsideBody),interactions,header:snapshot(document.querySelector('header')),footer:snapshot(document.querySelector('footer')),mainText:text(clone),mainStyle:style(main),bodyStyle:style(document.body),sections:[...main.querySelectorAll('section')].filter(node=>node!==product&&!product?.contains(node)).map(snapshot)}};
  })()`);
  if (name) {
    const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(output, `${name}.png`); await writeFile(file, Buffer.from(shot.data, 'base64')); report.screenshots.push(file);
  }
  return observed;
}
try {
  if (!real && !saved) {
    // Refuse to replace a server belonging to any other process.
    const occupied = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);
    assert.equal(occupied, false, `${base} must be free; stop only your own server first`);
    audit = createServer(async (request, response) => {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const payload = JSON.parse(raw);
      if (!payload.messages[0].content.includes('事实校对员')) { response.writeHead(503); response.end('{}'); return; }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }] }));
    });
    await new Promise(resolve => audit.listen(0, '127.0.0.1', resolve));
    log = await open(path.join(output, 'dev.log'), 'w');
    child = spawn('npm', ['run', 'dev', '--', '--port', '3141'], { detached: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, SITE_STORE: 'fs', SITECRAFT_BASE: base, DEEPSEEK_BASE_URL: `http://127.0.0.1:${audit.address().port}`, DEEPSEEK_API_KEY: 'controlled-fact-audit', DEEPSEEK_MODEL: 'controlled-fact-audit' } });
    const end = Date.now() + 60000;
    while (true) {
      if (child.exitCode !== null) throw new Error('Owned dev server exited before readiness');
      const health = await fetch(`${base}/api/health`).then(response => response.json(), () => null);
      if (health) { assert.equal(health.testIdentity.cwd, process.cwd()); break; }
      assert.ok(Date.now() < end, 'owned server readiness'); await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  browser = await codeCheckBrowser();
  if (real || saved) {
    const before = await state();
    const beforeVersion = saved ? before.versions.find(version => version.revision === Number(argument('--before-revision'))) : before.versions.at(-1);
    assert.ok(beforeVersion, 'The before version must exist');
    report.beforeRevision = beforeVersion.revision;
    const referenceFlag = process.argv.indexOf('--reference-revision');
    const revision = referenceFlag >= 0 ? Number(process.argv[referenceFlag + 1]) : 3;
    const reference = before.versions.find(version => version.revision === revision);
    assert.ok(reference, 'The requested old version must exist');
    assert.notDeepEqual(beforeVersion.code, reference.code, 'Choose an old version with different code to exercise a real change');
    report.referenceRevision = revision;
    assert.ok(!requestedPage || beforeVersion.code.pages.some(page => page.id === requestedPage), 'The named page must exist');
    const currentPages = {};
    for (const page of beforeVersion.code.pages) currentPages[page.id] = await inspectPage(beforeVersion.id, page.id, 1440, page.id === 'products' ? 'before-products-1440' : null);
    const referencePages = {};
    for (const page of reference.code.pages) referencePages[page.id] = await inspectPage(reference.id, page.id, 1440, page.id === 'products' ? 'reference-products-1440' : null);
    const targetPages = beforeVersion.code.pages.filter(page => (!requestedPage || page.id === requestedPage) && currentPages[page.id].product);
    assert.ok(targetPages.length, 'The requested scope must contain a declared product region');
    for (const page of targetPages) assert.ok(referencePages[page.id]?.product, `${page.id}: the reference product region must exist`);
    assert.ok(targetPages.some(page => JSON.stringify(currentPages[page.id].product) !== JSON.stringify(referencePages[page.id].product)), 'The product area itself must differ before the request');
    report.beforeObservations = currentPages; report.referenceObservations = referencePages;
    let after, afterVersion;
    if (saved) {
      after = before;
      afterVersion = before.versions.find(version => version.revision === Number(argument('--after-revision')));
      assert.ok(afterVersion, 'The saved after version must exist');
    } else {
      await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
      await wait(`Boolean(document.querySelector('[data-testid=code-message]'))`, 'workspace');
      const pageTitle = beforeVersion.code.pages.find(page => page.id === requestedPage)?.title;
      await value('[data-testid=code-message]', requestedPage ? `把${pageTitle}页的产品区改回第 ${revision} 版那样，保留其他页面和产品区外的内容与样式` : `把产品区改回第 ${revision} 版那样，保留其他内容`);
      await click('.code-chat-form button[type=submit]');
      const end = Date.now() + 360000;
      while (Date.now() < end) {
        after = await state();
        if (after.run && after.run.id !== before.run?.id && after.run.status !== 'running') break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      assert.ok(after?.run && after.run.id !== before.run?.id && after.run.status !== 'running', 'one real request must reach a terminal run');
      afterVersion = after.versions.at(-1);
    }
    const run = saved ? before.runs.find(run => run.versionId === afterVersion.id) : after.run;
    assert.ok(run, 'The selected version must have its saved run');
    report.run = { status: run.status, step: run.step, referenceVersionIds: run.referenceVersionIds, versionId: run.versionId };
    report.afterRevision = afterVersion.revision;
    if (!saved) {
      for (const width of [1440, 768, 375]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 900, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
        await wait(`Boolean(document.querySelector('[data-testid=code-revision]'))`, 'terminal workspace');
        await wait(`Boolean(document.querySelector('[data-testid=code-preview]')) && !document.querySelector('.code-preview-loading')`, 'loaded current preview');
        await browser.evaluate(`document.querySelector('.chat-messages')?.scrollTo(0, document.querySelector('.chat-messages').scrollHeight)`);
        const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(output, `outcome-${width}.png`); await writeFile(file, Buffer.from(shot.data, 'base64')); report.screenshots.push(file);
      }
    }
    if (run.status !== 'complete') { report.status = 'BLOCKED'; process.exitCode = 2; }
    else {
      assert.equal(report.afterRevision, report.beforeRevision + 1);
      assert.notDeepEqual(afterVersion.code, beforeVersion.code, 'A new revision containing unchanged code does not prove the requested edit');
      assert.deepEqual(run.referenceVersionIds, [reference.id], 'the real model must select the requested historical version');
      const observations = {};
      for (const page of afterVersion.code.pages) observations[page.id] = await inspectPage(afterVersion.id, page.id, 1440, null);
      report.afterObservations = observations;
      if (!saved) for (const width of [1440, 768, 375]) await inspectPage(afterVersion.id, 'products', width, `products-${width}`);
      for (const page of beforeVersion.code.pages) {
        const allowed = targetPages.some(target => target.id === page.id);
        assert.deepEqual(observations[page.id].product, allowed ? referencePages[page.id].product : currentPages[page.id].product, `${page.id}: only product regions in the requested page scope may change`);
        assert.deepEqual(observations[page.id].outside, currentPages[page.id].outside, `${page.id}: preserve headers, footers and everything outside product regions`);
      }
      report.regionChecksPassed = true;
      report.status = saved ? 'PASS' : 'INCOMPLETE'; report.note = saved ? '已保存版本按声明的页面范围重新核验；没有模型请求或存储写入。' : '真实模型已存版；仍须打开结果截图，核对指定区域采用旧版且其余区域保留。'; process.exitCode = saved ? 0 : 1;
    }
  } else {
    const before = await state(); assert.ok(before.versions.length > 10); report.initialVersionCount = before.versions.length;
    const old = before.versions.find(version => version.revision === 3);
    for (const width of [1440, 768, 375]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 900, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.navigate', { url: `${base}/workspace?site=${siteId}` });
      await wait(`Boolean(document.querySelector('[data-testid=open-version-history]'))`, 'workspace');
      await click('[data-testid=open-version-history]');
      await wait(`document.querySelector('[data-testid=version-history]')?.open`, 'dialog');
      assert.ok(await browser.evaluate(`document.querySelectorAll('[data-version-id]').length > 10`));
      assert.equal(await browser.evaluate(`document.querySelector('[data-testid=version-preview]').getAttribute('sandbox')`), 'allow-forms');
      for (const grouping of ['minute', 'ten-minutes', 'hour', 'day']) {
        await value('select[aria-label="版本分组"]', grouping);
        assert.equal(await browser.evaluate(`document.querySelector('select[aria-label="版本分组"]').value`), grouping);
        await capture(`group-${grouping}-${width}`);
      }
      await click(`[data-revision="3"]`);
      await value('select[aria-label="版本页面"]', 'products');
      await click(`[aria-label="版本预览宽度"] button:nth-child(${[1440, 768, 375].indexOf(width) + 1})`);
      await wait(`document.querySelector('[data-testid=version-preview]')?.src.includes('version=${old.id}&page=products')`, 'selected old product page');
      await capture(`preview-v3-${width}`);
      const label = `产品目录确认版 ${width}`;
      await value('#version-name', label);
      await click('[data-testid=version-history] form button');
      await wait(`document.querySelector('[data-revision="3"]').textContent.includes(${JSON.stringify(label)})`, 'saved version label');
      await capture(`named-v3-${width}`);
      const renamed = await state();
      assert.deepEqual(renamed.versions.find(version => version.id === old.id).code, old.code);
      const count = renamed.versions.length;
      await click('[data-testid=restore-version]');
      await wait(`document.querySelector('[data-testid=version-history]').textContent.includes('保存为第 ${count + 1} 版')`, 'restored new version');
      const restored = await state();
      assert.equal(restored.versions.length, count + 1);
      assert.deepEqual(restored.versions.at(-1).code, old.code);
      assert.equal(restored.versions.at(-1).restoredFrom, old.id);
      assert.equal(restored.versions.at(-1).checks.passed, true);
      assert.ok(renamed.versions.every(version => restored.versions.some(item => item.id === version.id)));
      report.checks.push({ width, name: label, beforeCount: count, afterCount: restored.versions.length, restoredFrom: old.id, check: restored.versions.at(-1).checks });
      await capture(`restored-v3-${width}`);
      const dimensions = await browser.evaluate(`(() => {const d=document.querySelector('[data-testid=version-history]');return {scroll:d.scrollWidth,client:d.clientWidth,right:d.getBoundingClientRect().right,viewport:innerWidth}})()`);
      assert.ok(dimensions.scroll <= dimensions.client && dimensions.right <= dimensions.viewport + 1, JSON.stringify(dimensions));
      await click('[aria-label="关闭版本历史"]');
      await browser.send('Page.reload');
      await wait(`document.querySelector('[data-testid=code-revision]')?.textContent.includes('v${count + 1}')`, 'refresh current version');
      await click('[data-testid=open-version-history]');
      await wait(`document.querySelector('[data-revision="3"]')?.textContent.includes(${JSON.stringify(label)})`, 'refresh named old version');
      await capture(`refreshed-${width}`);
    }
    report.status = 'PASS';
  }
} catch (error) { report.status = 'INCOMPLETE'; report.error = error.stack; process.exitCode = 1; }
finally {
  report.completedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  if (child?.pid && child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); }
  await log?.close();
  if (audit) await new Promise(resolve => audit.close(resolve));
}
console.log(JSON.stringify({ status: report.status, report: path.join(output, 'report.json'), error: report.error, run: report.run }));
