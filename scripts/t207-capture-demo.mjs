// T-207: freeze the real workspace into a static click-through demo.
// It drives the running app (SITE_STORE=fs, data root from scripts/t207-build-demo-stages.mjs, no model key)
// in headless Chrome, step by step, at 1440/768/375, and saves each rendered state as plain HTML
// without scripts. demo/index.html then plays the steps. Nothing here calls a model.
// Usage: node scripts/t207-capture-demo.mjs <chrome> <appBase> <stageDataRoot> <outDir> [fromStep]
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const [chrome, APP, stageRoot, out, fromStep] = process.argv.slice(2);
const { ids, v2Drafts } = JSON.parse(readFileSync(join(stageRoot, 'stages.json'), 'utf8'));
const progressRecord = JSON.parse(readFileSync(join(stageRoot, 'code-sites', `${ids.progress}.json`), 'utf8'));
for (const dir of ['steps', 'frames', 'r']) { if (!fromStep) rmSync(join(out, dir), { recursive: true, force: true }); mkdirSync(join(out, dir), { recursive: true }); }

// The opinions typed in the annotation steps are the owner's real requests from this site's conversation.
const conversation = JSON.parse(readFileSync(join(stageRoot, 'conversations', ids.site, `${progressRecord.conversationId}.json`), 'utf8'));
const opinion = v2Drafts[0].body;
const materials = conversation.turns[0].userMessage;

const profile = mkdtempSync(join(tmpdir(), 'sitecraft-t207-capture-'));
const browser = spawn(chrome, ['--headless', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let launchError = null, exited = false;
browser.on('error', error => { launchError = error; });
const exit = new Promise(resolve => browser.once('exit', () => { exited = true; resolve(); }));
const portFile = join(profile, 'DevToolsActivePort');
let port = 0;
try {
  for (let i = 0; i < 300; i++) {
    if (launchError) throw launchError;
    if (exited) throw new Error('Chrome exited before readiness');
    if (existsSync(portFile)) {
      const lines = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      const value = Number(lines[0]);
      if (lines.length === 2 && /^\d+$/.test(lines[0]) && Number.isInteger(value) && value > 0 && value <= 65535 && /^\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lines[1])) { port = value; break; }
    }
    await Promise.race([new Promise(resolve => setTimeout(resolve, 100)), exit]);
  }
  if (!port) throw new Error('Chrome readiness timeout');
} catch (error) {
  if (!exited && browser.pid) { browser.kill(); await exit; }
  rmSync(profile, { recursive: true, force: true });
  throw error;
}
const ws = new WebSocket((await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let seq = 0; const pending = new Map(), events = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, m => m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result)); ws.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = expression => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).then(r => { if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed'); return r.result.value; });
const waitFor = async (expr, what, ms = 30000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(expr).catch(() => false)) return; await sleep(150); } throw new Error(`timeout: ${what}`); };

// The in-progress stage cannot be served live: the server marks a run without a process as interrupted.
// Its two reads are answered from the stage record, as the server would have answered during generation.
let progressPayload = null;
ws.onmessage = async e => {
  const m = JSON.parse(e.data);
  if (m.id) return pending.get(m.id)?.(m);
  if (m.method === 'Fetch.requestPaused') {
    const body = Buffer.from(JSON.stringify(progressPayload)).toString('base64');
    await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body });
    return;
  }
  events.push(m);
};
await send('Page.enable');
const navigate = async url => {
  events.length = 0; await send('Page.navigate', { url });
  const end = Date.now() + 90000;
  while (!events.some(e => e.method === 'Page.loadEventFired')) { if (Date.now() > end) throw new Error('load timeout ' + url); await sleep(50); }
};
const mouse = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const move = async (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
// Centre of a preview block, in page coordinates (the preview iframe is scaled).
const blockPoint = label => ev(`(() => { const f = document.querySelector('[data-testid=code-preview]'), d = f.contentDocument, main = d.querySelector('main');
  const block = [...main.querySelectorAll('section,article,div')].find(el => (el.querySelector('h2,h3')?.textContent || '').trim() === ${JSON.stringify(label)});
  block.scrollIntoView({ block: 'center' }); const r = block.getBoundingClientRect(), fr = f.getBoundingClientRect(), s = fr.width / f.offsetWidth;
  return { x: fr.left + (r.left + r.width / 2) * s, y: fr.top + (r.top + Math.min(r.height / 2, 120)) * s }; })()`);
const setValue = (selector, text) => ev(`(() => { const t = document.querySelector(${JSON.stringify(selector)}); const proto = t instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(t, ${JSON.stringify(text)}); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const click = selector => ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('missing ' + ${JSON.stringify(selector)}); el.click(); return true; })()`);
const workspace = id => `${APP}/workspace?site=${id}`;
const previewReady = `!!document.querySelector('[data-testid=code-preview]') && !document.querySelector('.code-preview-loading')`;
const pane = name => ev(`(() => { const tab = [...document.querySelectorAll('.builder-mobile-tabs button')].find(b => b.textContent === ${JSON.stringify(name === 'chat' ? '对话' : '预览')}); tab?.click(); return true; })()`);
const chatBottom = `(() => { const c = document.querySelector('.chat-messages'); c.scrollTop = c.scrollHeight; return true; })()`;

const steps = [
  { id: 'materials', title: '发来公司资料', stage: 'materials', pane: 'chat', hotspot: '.code-chat-form button[type=submit]',
    text: '把已有的公司资料粘贴进来，或在「资料」里选一份模拟公司。资料可以之后继续补充。这里载入的是禾巷小馆的原始资料。',
    run: async () => { await waitFor(`!!document.querySelector('#code-message')`, 'chat input'); await setValue('#code-message', materials);
      await click('.code-material-tools button'); await waitFor(`!!document.querySelector('.code-pack-list')`, 'packs'); } },
  { id: 'style', title: '需求对齐：选风格与两个滑杆', stage: 'style', pane: 'chat', hotspot: '[data-testid=code-style-question] .primary-button',
    text: '系统先问风格：主风格单选，或交给「帮我选」；版式和信息密度两个滑杆只改排法，不增删资料内容。缩略图来自真实生成的站点。',
    run: async () => { await waitFor(`!!document.querySelector('[data-testid=code-style-question]')`, 'style question'); await ev(`(document.querySelector('[data-testid=code-style-question] .primary-button').scrollIntoView({ block: 'end' }), true)`); } },
  { id: 'outline', title: '确认页面大纲', stage: 'outline', pane: 'chat', hotspot: '[data-testid=code-plan] .primary-button',
    text: '模型按资料能撑起的内容规划页面。资料只够两页，就只做首页和菜单两页，不为凑结构硬加联系页或报价页。确认后才开始写网站。',
    run: async () => { await waitFor(`!!document.querySelector('[data-testid=code-plan]')`, 'plan'); await ev(`(document.querySelector('[data-testid=code-plan]').scrollIntoView({ block: 'start' }), true)`); } },
  { id: 'progress', title: '生成进度', stage: 'progress', pane: 'chat', hotspot: '[data-testid=code-progress]',
    text: '模型逐页写站点代码；写完后，提交入口清理脚本和外部资源，核对事实出处，并在 375/768/1440 三档检查溢出、重叠和对比度。不过关就交回模型修，最多两轮。',
    run: async () => { await waitFor(`!!document.querySelector('[data-testid=code-progress]')`, 'progress'); } },
  { id: 'preview-1440', title: '三档预览：1440', stage: 'site', pane: 'preview', hotspot: '.device-toggle[aria-label=预览宽度] button:nth-child(2)',
    text: '生成完成，这是第 3 版的首页，宽屏 1440。版式、结构、文案都由模型按资料和所选风格写成。',
    run: async () => { await waitFor(previewReady, 'preview'); } },
  { id: 'preview-768', title: '三档预览：768', stage: 'site', pane: 'preview', width: 768, hotspot: '.device-toggle[aria-label=预览宽度] button:nth-child(3)',
    text: '切到 768 看平板宽度。三档都由提交入口检查过，不横向溢出、不重叠。', run: async () => { await waitFor(previewReady, 'preview'); } },
  { id: 'preview-375', title: '三档预览：375', stage: 'site', pane: 'preview', width: 375, hotspot: '[data-testid=fact-citation-marker]',
    text: '手机宽度 375。预览右侧的数字是资料出处编号，下一步看它。', run: async () => { await waitFor(previewReady, 'preview'); } },
  { id: 'citations', title: '资料出处', stage: 'site', pane: 'preview', hotspot: '[data-testid=fact-citation-source]',
    text: '价格、时间、承诺这类声明必须有资料原句支持。点编号能看到这句话依据的是哪段原始资料；这些编号只在工作台显示，不写进站点。',
    run: async () => { await waitFor(previewReady, 'preview'); await waitFor(`!!document.querySelector('[data-testid=fact-citation-marker]')`, 'markers');
      // Bring the opening-hours marker near the top of the preview, so its source panel opens fully in view.
      await ev(`(() => { const f = document.querySelector('[data-testid=code-preview]'), stage = document.querySelector('.code-preview-stage');
        const mark = [...document.querySelectorAll('[data-testid=fact-citation-marker]')].at(-1), s = f.getBoundingClientRect().width / f.offsetWidth;
        f.contentWindow.scrollBy(0, (mark.getBoundingClientRect().top - stage.getBoundingClientRect().top - 60) / s); return true; })()`);
      await sleep(500);
      await ev(`(() => { const top = document.querySelector('.code-preview-stage').getBoundingClientRect().top;
        const mark = [...document.querySelectorAll('[data-testid=fact-citation-marker]')].find(m => m.getBoundingClientRect().top > top); mark.click(); return true; })()`);
      await waitFor(`!!document.querySelector('[data-testid=fact-citation-source]')`, 'citation panel'); } },
  { id: 'annotate', title: '点选批注', stage: 'v2', pane: 'preview', hotspot: '[data-testid=annotation-add]',
    text: '在第 2 版上点「批注」，再点一个区块写修改意见。修改只发选中的区块，范围外的内容由提交入口核对，不会被顺手改掉。意见是当时真实发出的原话。',
    run: async () => { await waitFor(previewReady, 'preview'); await click('[data-testid=pick-block]'); await sleep(300);
      const p = await blockPoint('两类常来的用餐'); await sleep(300); const q = await blockPoint('两类常来的用餐');
      await move(q.x, q.y); await mouse('mousePressed', q.x, q.y); await mouse('mouseReleased', q.x, q.y);
      await waitFor(`!!document.querySelector('[data-testid=annotation-composer]')`, 'composer'); await setValue('#annotation-message', opinion); void p; } },
  { id: 'area', title: '圈选批注', stage: 'v2', pane: 'preview', hotspot: '[data-testid=annotation-area-candidates] button',
    text: '也可以拖框圈选。圈中多个区块时，系统先请你收窄到一个区块：每条意见只改一个区块。',
    run: async () => { await waitFor(previewReady, 'preview'); await click('[data-testid=pick-block]'); await sleep(300);
      // Drag across the border between 「两类常来的用餐」 and the block above it, so the box covers two blocks.
      const b = await ev(`(() => { const f = document.querySelector('[data-testid=code-preview]'), d = f.contentDocument;
        const block = [...d.querySelectorAll('main section, main article, main div')].find(el => (el.querySelector('h2,h3')?.textContent || '').trim() === '两类常来的用餐');
        block.scrollIntoView({ block: 'start' }); f.contentWindow.scrollBy(0, -200);
        const r = block.getBoundingClientRect(), fr = f.getBoundingClientRect(), s = fr.width / f.offsetWidth;
        return { left: fr.left, width: fr.width, y: fr.top + r.top * s, s }; })()`);
      await sleep(300);
      const x0 = b.left + b.width * 0.2, x1 = b.left + b.width * 0.8, y0 = b.y - 80 * b.s, y1 = b.y + 120 * b.s;
      await move(x0, y0); await mouse('mousePressed', x0, y0);
      for (let i = 1; i <= 10; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / 10, y: y0 + (y1 - y0) * i / 10, button: 'left', buttons: 1 });
      await mouse('mouseReleased', x1, y1);
      await waitFor(`!!document.querySelector('[data-testid=annotation-area-candidates]')`, 'area candidates'); } },
  { id: 'drafts', title: '多条批注一起发送', stage: 'v2', pane: 'chat', drafts: true, hotspot: '[data-testid=annotation-send-batch]',
    text: '批注先存在浏览器里，可以回看、编辑或移除。两条批注一起发送时，所有修改从同一个父版本出发，合成一个新版本；任一条失败就不存半成品。',
    run: async () => { await waitFor(`document.querySelectorAll('[data-testid=annotation-draft]').length === 2`, 'drafts'); await ev(`(document.querySelector('[aria-label=待发送批注列表]').scrollIntoView({ block: 'end' }), true)`); } },
  { id: 'result', title: '修改结果：第 3 版', stage: 'site', pane: 'chat', hotspot: '.code-quick-edits button',
    text: '两条批注合并保存为第 3 版，底线检查通过。对话里保留每次修改的原话和结果，包括中途失败的那两次。',
    run: async () => { await waitFor(`!!document.querySelector('[data-testid=code-check-receipt]')`, 'receipt'); await ev(chatBottom); } },
  { id: 'quick', title: '快捷按钮', stage: 'site', pane: 'chat', hotspot: '.code-quick-edits button:nth-child(3)',
    text: '不想自己写意见时，可以用快捷按钮：更大胆、更克制、精简文字、换个版式。没有选区块时作用于当前页，选了区块就只改那一块。',
    run: async () => { await waitFor(`!!document.querySelector('.code-quick-edits')`, 'quick'); await ev(`(document.querySelector('.code-quick-edits').scrollIntoView({ block: 'center' }), true)`); } },
  { id: 'history', title: '版本列表、撤销与恢复', stage: 'site', pane: 'preview', hotspot: '[data-testid=version-history] button[class*=version]',
    text: '每次修改都是一个完整版本。撤销就是恢复到上一个版本，恢复本身也存成新版本；刷新页面从当前版本恢复。',
    run: async () => { await waitFor(previewReady, 'preview'); await click('[data-testid=open-version-history]'); await waitFor(`!!document.querySelector('[data-testid=version-history]') && !document.querySelector('[data-testid=version-preview-loading]')`, 'history'); await sleep(800); } },
  { id: 'threads', title: '批注线程', stage: 'site', pane: 'chat', hotspot: '[data-testid=thread-reveal]',
    text: '发出的批注保存为线程，记录原话和每次结果，可以定位回对应区块、标为已处理。',
    run: async () => { await ev(`(() => { const d = document.querySelector('.code-annotation-threads'); d.open = true; d.dispatchEvent(new Event('toggle')); return true; })()`);
      await waitFor(`!!document.querySelector('[data-testid=thread-reveal]')`, 'threads'); await ev(`(document.querySelector('[data-testid=thread-reveal]').scrollIntoView({ block: 'end' }), true)`); } },
  { id: 'english', title: '英文版', stage: 'site', pane: 'preview', hotspot: '[data-testid=preview-en]',
    text: '中文站满意后才生成英文版，沿用同一结构，只翻译文字。这里展示禾巷小馆基于中文第 3 版真实翻译并通过检查的英文页，数字、单位、邮箱和网址逐项核对；资料没有英文公司名，因此保留中文店名。',
    run: async () => { await waitFor(`!!document.querySelector('[data-testid=preview-en]')`, 'english switch'); await click('[data-testid=preview-en]');
      await waitFor(`${previewReady} && document.querySelector('[data-testid=code-preview]').src.includes('language=en') && document.querySelector('[data-testid=code-preview]').contentDocument?.body.innerText.includes('Lunch')`, 'English preview painted'); } },
  { id: 'download', title: '下载站点包', stage: 'site', pane: 'preview', hotspot: '[data-testid=download-site]',
    text: '站点包是当前版本的静态网站：每页一份 HTML，加公共 CSS、实际引用的素材和 LICENSES.txt，不含资料、对话或密钥。点高亮的下载按钮，可以拿到这个示例站真实导出的 zip。',
    run: async () => { await waitFor(previewReady, 'preview'); } },
  { id: 'settings', title: '模型接口设置', path: '/settings', hotspot: '#provider .primary-button',
    text: '真实使用时，在这里填你自己的模型接口：API 地址、key 和模型名只存在你的浏览器里，只随那一次请求发给服务器，不写进记录或日志。演示里不能保存。',
    run: async () => { await waitFor(`!!document.querySelector('#provider') && document.querySelectorAll('.delete-site-actions').length > 0`, 'provider');
      // The capture server holds one copy of the site per stage; the demo workspace shows the finished site only.
      await ev(`(() => { for (const row of document.querySelectorAll('.delete-site-actions')) if (!row.parentElement.textContent.includes('${ids.site}')) row.parentElement.remove();
        document.querySelector('#provider').scrollIntoView({ block: 'start' }); return true; })()`); } },
];

// Serialise the live DOM: no scripts, form state as attributes, scroll positions as data attributes,
// every stylesheet as text, and each same-origin iframe document as a separate file.
const freeze = `(() => {
  const frames = [];
  for (const el of document.querySelectorAll('textarea')) el.textContent = el.value;
  for (const el of document.querySelectorAll('input')) { if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked); else el.setAttribute('value', el.value); }
  for (const el of document.querySelectorAll('select')) for (const o of el.options) o.toggleAttribute('selected', o.selected);
  for (const el of document.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) el.setAttribute('data-demo-scroll', el.scrollTop + ',' + el.scrollLeft);
  document.documentElement.setAttribute('data-demo-window-scroll', scrollY);
  document.querySelectorAll('iframe').forEach((f, i) => { const d = f.contentDocument; if (!d) return;
    f.setAttribute('data-demo-frame', i); f.setAttribute('data-demo-frame-scroll', f.contentWindow.scrollY);
    frames.push({ index: i, html: '<!doctype html>' + d.documentElement.outerHTML }); });
  const imports = [], rules = [];
  for (const sheet of document.styleSheets) { try { for (const rule of sheet.cssRules) (rule instanceof CSSImportRule ? imports : rules).push(rule.cssText); } catch {} }
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll('script,noscript,style,link,next-route-announcer,nextjs-portal').forEach(el => el.remove());
  return { html: '<!doctype html>' + clone.outerHTML, frames, css: [...new Set(imports)].join('\\n') + '\\n' + rules.join('\\n') };
})()`;

const cssFiles = new Map(), frameFiles = new Map(), manifest = fromStep ? JSON.parse(readFileSync(join(out, 'steps.json'), 'utf8')) : [];
const firstStep = fromStep ? steps.findIndex(step => step.id === fromStep) : 0;
if (firstStep < 0) throw new Error('Unknown starting step: ' + fromStep);
const assetPrefix = fromStep ? `${fromStep}-update-` : '';
const keep = (map, content, make) => { if (!map.has(content)) map.set(content, make(map.size)); return map.get(content); };
const publicAsset = url => { const file = url.replace(/^\//, ''); const target = join(out, 'r', file); mkdirSync(join(target, '..'), { recursive: true }); copyFileSync(join('public', file), target); return `../r/${file}`; };
// Heights are the demo frame below the shell's step bar on 1440x900, 768x1024 and 375x812 screens.
const widths = [[1440, 796, false], [768, 920, true], [375, 660, true]];
for (const step of steps.slice(firstStep)) {
  for (const [width, height, mobile] of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    const siteId = step.stage && ids[step.stage];
    await navigate(`${APP}/settings`);
    await ev(`(localStorage.clear(), ${step.drafts ? `localStorage.setItem('sitecraft-annotation-drafts:${siteId}', ${JSON.stringify(JSON.stringify(v2Drafts))}), ` : ''}true)`);
    if (step.stage === 'progress') {
      const live = await (await fetch(`${APP}/api/sites/${ids.site}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'state' }) })).json();
      progressPayload = { codeSite: progressRecord, turns: [], alignment: { ...live.alignment, lastResult: null, summary: progressRecord.plan.summary } };
      await send('Fetch.enable', { patterns: [{ urlPattern: `*/api/sites/${siteId}/*` }] });
    }
    await navigate(step.path ? APP + step.path : workspace(siteId));
    if (step.stage) { await waitFor(`!!document.querySelector('[data-testid=code-workspace]')`, 'workspace'); if (mobile && step.pane) await pane(step.pane); }
    if (step.width) await ev(`([...document.querySelectorAll('.device-toggle[aria-label=预览宽度] button')].find(b => b.textContent === '${step.width}').click(), true)`);
    await ev(`document.fonts.ready.then(() => true)`);
    await step.run(); await sleep(700);
    const frozen = await ev(freeze);
    if (step.stage === 'progress') await send('Fetch.disable');
    const css = keep(cssFiles, frozen.css, n => `${assetPrefix}ws-${n + 1}.css`);
    let html = frozen.html.replace('</head>', `<link rel="stylesheet" href="../r/${css}"></head>`);
    for (const frame of frozen.frames) {
      const name = keep(frameFiles, frame.html, n => `${assetPrefix}f${n + 1}.html`);
      html = html.replace(new RegExp(`(<iframe[^>]*data-demo-frame="${frame.index}"[^>]*?)src="[^"]*"`), `$1src="../frames/${name}"`)
        .replace(new RegExp(`(<iframe[^>]*?)src="[^"]*"([^>]*data-demo-frame="${frame.index}")`), `$1src="../frames/${name}"$2`);
    }
    // A preview with an empty sandbox cannot be read from the page; fetch the same address from the app.
    for (const [, src] of html.matchAll(/<iframe[^>]*?src="(\/api\/[^"]+)"/g)) {
      const body = await (await fetch(APP + src.replaceAll('&amp;', '&'))).text();
      html = html.replace(`src="${src}"`, `src="../frames/${keep(frameFiles, body, n => `${assetPrefix}f${n + 1}.html`)}"`);
    }
    html = html.replace(/src="(\/style-previews\/[^"]+)"/g, (_, url) => `src="${publicAsset(url)}"`);
    const file = `${step.id}-${width}.html`;
    writeFileSync(join(out, 'steps', file), html);
    console.log(`ok ${file} ${Math.round(html.length / 1024)}KB frames=${frozen.frames.length}`);
  }
  const record = { id: step.id, title: step.title, text: step.text, hotspot: step.hotspot };
  const existing = manifest.findIndex(item => item.id === step.id);
  if (existing >= 0) manifest[existing] = record; else manifest.push(record);
}
// The workspace fonts are served by Next itself; copy them next to the stylesheets.
mkdirSync(join(out, 'r', 'fonts'), { recursive: true });
for (const [content, name] of cssFiles) {
  let css = content;
  for (const font of new Set([...content.matchAll(/url\("?\/__nextjs_font\/([\w.-]+)"?\)/g)].map(m => m[1]))) {
    writeFileSync(join(out, 'r', 'fonts', font), Buffer.from(await (await fetch(`${APP}/__nextjs_font/${font}`)).arrayBuffer()));
    css = css.replaceAll(`/__nextjs_font/${font}`, `fonts/${font}`);
  }
  writeFileSync(join(out, 'r', name), css);
}
for (const [content, name] of frameFiles) writeFileSync(join(out, 'frames', name), content);
writeFileSync(join(out, 'steps.json'), JSON.stringify(manifest, null, 2));
// Chrome still writes into the profile until it has exited.
if (!exited) { browser.kill(); await exit; } rmSync(profile, { recursive: true, force: true });
console.log(`steps=${manifest.length} css=${cssFiles.size} frames=${frameFiles.size}`);
process.exit(0);
