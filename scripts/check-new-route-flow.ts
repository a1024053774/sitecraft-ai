import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { simulatedPacks, type SimulatedPackId } from '../lib/simulated-packs.ts';
import type { CodeSiteRecord } from '../lib/code-site.ts';

const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3138';
const directory = process.env.T128_ARTIFACTS || `artifacts/t128/flow-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(directory, { recursive: true });
const browser = await codeCheckBrowser();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function wait(expression: string, label: string, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await browser.evaluate<boolean>(expression)) return; await pause(250); }
  throw new Error(`等待超时：${label}`);
}
async function click(text: string) {
  await browser.evaluate(`(() => {const node=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!node||node.disabled)throw new Error('按钮不可用：'+${JSON.stringify(text)});node.click();})()`);
}
async function size(width: number) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.evaluate('document.fonts.ready');
}
async function screenshot(name: string, full = false) {
  const metrics = await browser.send<{ cssContentSize: { width: number; height: number } }>('Page.getLayoutMetrics');
  const result = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full,
    ...(full ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {}) });
  await writeFile(path.join(directory, `${name}.png`), Buffer.from(result.data, 'base64'));
}
async function captureWorkspace(pack: string, phase: string) {
  for (const width of [1440, 768, 375]) {
    await size(width);
    if (width <= 768) await click('预览');
    await click(String(width));
    await pause(350);
    await screenshot(`${pack}-${phase}-${width}`);
    if (width <= 768) { await click('对话'); await pause(350); await screenshot(`${pack}-${phase}-chat-${width}`); }
  }
  await size(1440);
}
async function readSite(id: string): Promise<CodeSiteRecord> {
  const response = await fetch(`${base}/api/sites/${id}/draft`); assert.equal(response.status, 200);
  return (await response.json()).codeSite;
}
async function waitRun(id: string, label: string) {
  const end = Date.now() + 900000;
  while (Date.now() < end) {
    const site = await readSite(id);
    if (site.run?.status === 'error') throw new Error(`${label}：${site.run.step}`);
    if (site.run?.status === 'complete') return site;
    await pause(2000);
  }
  throw new Error(`${label} 15分钟内未结束`);
}
async function sendMessage(message: string) {
  await browser.evaluate(`(() => {const input=document.querySelector('#code-message');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,${JSON.stringify(message)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await pause(100);
  await browser.evaluate(`document.querySelector('.code-chat-form').requestSubmit()`);
}
async function openWorkspace(id?: string) {
  await browser.send('Page.navigate', { url: `${base}/workspace?${id ? `site=${id}` : 'new=1'}` });
  await wait(`!!document.querySelector('[data-testid="code-workspace"]')`, '新路线工作台');
  return await browser.evaluate<string>('new URL(location.href).searchParams.get("site")');
}
async function uploadCompanyImages(pack: SimulatedPackId) {
  const folder = path.resolve('tests/fixtures/company-images', pack);
  const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'));
  await click('图片');
  // Two admitted photographs exercise product/equipment placement without expanding the fixture.
  const photos = manifest.images.filter((image: { category: string }) => ['product', 'equipment'].includes(image.category)).slice(0, 2);
  for (const photo of photos) {
    for (const [label, value] of [['用途', photo.category], ['许可', photo.apiLicense || photo.license.replace(/\s+[\d.]+$/, '')], ['来源地址', photo.sourceUrl], ['许可证地址', photo.licenseUrl], ['作者', photo.author], ['署名文字', photo.attribution]]) {
      await browser.evaluate(`(() => {const label=[...document.querySelectorAll('.code-upload-panel label')].find(n=>n.firstChild.textContent===${JSON.stringify(label)});const node=label?.querySelector('input,select');if(!node)throw new Error('缺少上传字段');const proto=node.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
      await pause(50);
    }
    const document = await browser.send<{ root: { nodeId: number } }>('DOM.getDocument');
    const node = await browser.send<{ nodeId: number }>('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'input[aria-label="上传图片"]' });
    await browser.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [path.join(folder, photo.file)] });
    await wait(`document.querySelector('.code-upload-panel')?.textContent.includes(${JSON.stringify(photo.file)})`, `上传 ${photo.file}`);
  }
  await screenshot(`${pack}-uploaded-1440`);
  await click('图片');
  return `\n上传图片的内容与使用边界：${photos.map((photo: { file: string; caption: string; limitations?: string }) => `${photo.file}：${photo.caption}。${photo.limitations || '只作对应内容配图，不推导公司新事实。'}`).join('\n')}\n这些是授权行业配图，不声称是这家公司的实拍。`;
}
const reports: unknown[] = [];
try {
  for (const packId of (process.argv.slice(2).length ? process.argv.slice(2) : ['export', 'molding']) as SimulatedPackId[]) {
    const pack = simulatedPacks[packId]; assert.ok(pack);
    await size(1440); const resumeId = process.env.T128_RESUME_SITE;
    const id = await openWorkspace(resumeId);
    console.log(`${packId}: site=${id}`);
    if (!resumeId) {
    const imageMaterials = process.env.T128_WITH_IMAGES === '1' ? await uploadCompanyImages(packId) : '';
    await click('资料'); await click(pack.label);
    // Explicitly request three independent pages; the normal company body otherwise keeps its old-route note.
    await browser.evaluate(`(() => {const input=document.querySelector('#code-message');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,input.value+${JSON.stringify('\n本次页面要求替代上面的页面要求：只生成首页、产品、联系三个独立页面。认证、资料索取、生产质检和常见问题内容安排进这三页，不另建页面。只做中文。' + imageMaterials)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await pause(100); await click('发送资料');
    await wait(`!!document.querySelector('[data-testid="code-style-question"]')`, '风格选择');
    await screenshot(`${packId}-alignment-1440`);
    const style = packId === 'molding' ? 'documentary' : 'precision';
    await browser.evaluate(`document.querySelector('input[value="${style}"]').click()`);
    await click('保存选择，规划页面');
    await waitRun(id, '页面规划');
    await wait(`!!document.querySelector('[data-testid="code-plan"]')`, '页面大纲显示');
    await screenshot(`${packId}-plan-1440`);
    await click('确认并生成');
    await wait(`document.querySelector('[data-testid="code-progress"]')?.textContent.includes('写站点代码')`, '开始生成');
    const beforeRefresh = await readSite(id);
    await screenshot(`${packId}-generating-1440`);
    await openWorkspace(id);
    assert.equal((await readSite(id)).run?.id, beforeRefresh.run?.id, 'refresh must keep the same generation run');
    await screenshot(`${packId}-generating-refresh-1440`);
    }
    let site = resumeId ? await readSite(id) : await waitRun(id, '整站生成');
    assert.equal(site.run?.status, 'complete');
    assert.equal(site.versions.length, 1);
    assert.deepEqual(site.versions[0].code.pages.map(p => p.id).sort(), ['contact', 'home', 'products']);
    assert.equal(site.versions[0].checks.passed, true);
    await wait(`!!document.querySelector('[data-testid="code-preview"]')`, '版本预览');
    await pause(2000);
    await captureWorkspace(packId, 'generated');
    const first = structuredClone(site.versions[0]);
    // Take full visitor pages, through the same sandboxed preview endpoint, at all three viewports.
    for (const p of first.code.pages) {
      for (const width of [1440, 768, 375]) {
        await size(width);
        await browser.send('Page.navigate', { url: `${base}/api/sites/${id}/code-preview?page=${p.id}` });
        await wait('!!document.querySelector("main h1, main")', `${p.id} 载入`);
        assert.ok((await browser.evaluate<string>('document.body.innerText')).includes(pack.companyName), 'company name must be visible');
        await browser.evaluate('document.fonts.ready'); await pause(150);
        await screenshot(`${packId}-${p.id}-${width}`, true);
      }
    }
    await size(1440); await openWorkspace(id);
    await sendMessage('把首页首屏改成深色底（#17212b）和白色文字，保留产品、联系页、规格和其他内容。');
    await wait('document.querySelector("[data-testid=code-progress]")?.textContent.includes("写站点代码")', '对话修改开始');
    await screenshot(`${packId}-editing-1440`);
    site = await waitRun(id, '对话修改');
    assert.equal(site.versions.length, 2);
    await pause(2000); await captureWorkspace(packId, 'edited');
    const edited = site.versions[1];
    await browser.send('Page.navigate', { url: `${base}/api/sites/${id}/code-preview?page=home` });
    await wait('!!document.querySelector("h1")', '修改后的首页');
    const background = await browser.evaluate<string>(`(() => {for(let n=document.querySelector('h1');n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c!=='rgba(0, 0, 0, 0)')return c}return ''})()`);
    assert.equal(background, 'rgb(23, 33, 43)', 'requested dark hero color must appear in the rendered page');
    await openWorkspace(id); await browser.evaluate('document.querySelector("button[aria-label=撤销]").click()');
    await wait('document.querySelector("[data-testid=code-revision]")?.textContent.includes("v3")', '撤销保存', 300000);
    site = await readSite(id); assert.equal(site.versions.length, 3);
    assert.deepEqual(site.versions[2].code, first.code, 'undo must restore the complete previous content');
    assert.equal(site.versions[2].restoredFrom, first.id);
    await captureWorkspace(packId, 'undo');
    await openWorkspace(id); assert.equal((await readSite(id)).currentVersionId, site.versions[2].id);
    await pause(1500); await captureWorkspace(packId, 'refresh');
    // A forged fact enters through the actual manual commit API, never the store.
    const forged = structuredClone(first.code); forged.pages[0].html += '<p>年产量 99999999 台。</p><script src="https://invalid.example/x.js"></script>';
    const negative = await fetch(`${base}/api/sites/${id}/draft`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: 3, summary: '反例：伪造数字与脚本', code: forged }) });
    const negativeBody = await negative.json();
    assert.equal(negative.status, 422); assert.equal(negativeBody.status, 'rejected');
    assert.ok(negativeBody.checks.issues.some((issue: string) => issue.includes('99999999')));
    assert.equal((await readSite(id)).versions.length, 3);
    const report = { packId, siteId: id, status: 'PASS', background, checkedAt: new Date().toISOString(),
      versions: site.versions.map(({ code, ...receipt }) => receipt), runs: site.runs.map(({ attempts, ...run }) => ({ ...run, attempts: attempts.map(a => a.checks) })),
      negative: { status: negative.status, checks: negativeBody.checks }, restored: true,
      urls: { workspace: `${base}/workspace?site=${id}`, preview: `${base}/api/sites/${id}/code-preview?page=home` } };
    await writeFile(path.join(directory, `${packId}-report.json`), JSON.stringify(report, null, 2));
    reports.push(report); console.log(`${packId}: PASS generation/edit/undo/refresh/negative`);
    // Freeze editable output for the reviewer, alongside its original independent facts.
    await writeFile(path.join(directory, `${packId}-materials.txt`), site.materials);
  }
  await writeFile(path.join(directory, 'result.json'), JSON.stringify({ status: 'PASS', reports }, null, 2));
} catch (error) {
  await screenshot('failure').catch(() => {});
  await writeFile(path.join(directory, 'failure.txt'), String(error)); throw error;
} finally { await browser.close(); }
