import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Offline WebGPU export. --install copies only the controller-selected static assets.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, process.argv[2] || 'artifacts/t148/candidates');
const port = Number(process.env.PORT || 3158);
const chrome = process.env.CHROME_PATH;
assert.ok(chrome, 'CHROME_PATH must name the assigned headless Chrome.');
assert.ok(out.startsWith(path.join(root, 'artifacts', 't148') + path.sep), 'Output must stay under artifacts/t148/.');
await mkdir(out, { recursive: false }); // Preserve previous runs; never overwrite their evidence.
const config = JSON.parse(await readFile(path.join(root, 'resources/shader-backdrops/candidates.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'node_modules/shaders/package.json'), 'utf8'));
assert.equal(pkg.version, config.source.version);
assert.equal(pkg.license, 'MIT');
const moduleFile = fileURLToPath(import.meta.resolve('shaders/js/bundle'));
const license = await readFile(path.join(root, 'node_modules/shaders/LICENSE'), 'utf8');
await writeFile(path.join(out, 'LICENSE.txt'), license, 'utf8');

// Verify every component and property against the installed open-source definitions.
function componentsFor(effect, palette) {
  const colors = { colorA: palette.base, colorB: palette.shade, colorSpace: 'srgb' };
  const base = { id: 'base', type: 'LinearGradient', props: { ...colors, angle: 18 } };
  if (effect.type === 'Grid') return [{ id: 'effect', type: effect.type, props: { ...effect.props, color: palette.shade, cellColor: palette.base, colorSpace: 'srgb' } }];
  if (effect.type === 'DotGrid') return [base, { id: 'effect', type: effect.type, props: { ...effect.props, color: palette.shade } }];
  if (effect.type === 'Paper') return [{ id: 'effect', type: effect.type, props: effect.props, children: [base] }];
  const layer = { id: 'effect', type: effect.type, props: { ...effect.props, ...colors } };
  return effect.dither ? [{ id: 'static-dither', type: 'FilmGrain', props: { ...effect.dither, strength: effect.ditherStrengths[palette.id] }, children: [layer] }] : [layer];
}
const definitions = new Map();
async function verify(nodes) {
  for (const node of nodes) {
    if (!definitions.has(node.type)) {
      const { componentDefinition } = await import(`shaders/core/${node.type}`);
      assert.equal(componentDefinition.name, node.type);
      definitions.set(node.type, componentDefinition);
    }
    const definition = definitions.get(node.type);
    for (const key of Object.keys(node.props)) assert.ok(Object.hasOwn(definition.props, key), `${node.type}: unknown property ${key}`);
    if (definition.requiresChild) assert.ok(node.children?.length, `${node.type}: child required`);
    if (node.children) await verify(node.children);
  }
}
const jobs = [];
for (const effect of config.effects) for (const palette of config.palettes) {
  const components = componentsFor(effect, palette);
  await verify(components);
  for (const size of config.sizes) jobs.push({ effect: effect.id, type: effect.type, palette: palette.id, style: palette.style, quality: effect.quality, ...size, components });
}

const rendererHtml = `<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0}canvas{display:block}</style><canvas id="canvas"></canvas><script type="module">
import { createShader } from '/bundle.js';
const adapter = await navigator.gpu?.requestAdapter();
if (!adapter || adapter.info.isFallbackAdapter) throw new Error('Hardware WebGPU adapter unavailable');
const device = await adapter.requestDevice();
const gpuErrors = [];
device.addEventListener('uncapturederror', e => gpuErrors.push(e.error.message));
device.lost.then(info => gpuErrors.push('device-lost: ' + info.reason));
window.adapterInfo = { vendor:adapter.info.vendor, architecture:adapter.info.architecture, device:adapter.info.device, description:adapter.info.description, isFallbackAdapter:adapter.info.isFallbackAdapter };
window.renderCandidate = async job => {
  if (gpuErrors.length) throw new Error(gpuErrors.join('; '));
  canvas.width=job.width;canvas.height=job.height;canvas.style.width=job.width+'px';canvas.style.height=job.height+'px';
  let ready=false;const failures=[];
  const shader=await createShader(canvas,{components:job.components},{gpu:{adapter,device},disableTelemetry:true,observeElement:false,colorSpace:'srgb',toneMapping:'linear',onReady:()=>ready=true,onError:r=>failures.push(r)});
  try {
    const deadline=performance.now()+20000;
    while(!ready&&!failures.length&&performance.now()<deadline) await new Promise(r=>setTimeout(r,20));
    if(!ready||failures.length||gpuErrors.length||shader.getFailureReason()) throw new Error([...failures,...gpuErrors,shader.getFailureReason()||(!ready?'no-frame-ready':'')].filter(Boolean).join('; '));
    shader.pause();
    await device.queue.onSubmittedWorkDone();
    await new Promise(requestAnimationFrame);
    if(gpuErrors.length) throw new Error(gpuErrors.join('; '));
    window.activeShader=shader;
    return {ready,width:canvas.width,height:canvas.height,failures};
  } catch(e) { shader.destroy(); throw e; }
};
window.rendererReady=true;
</script></html>`;
const mime = { '.webp': 'image/webp', '.png': 'image/png', '.html': 'text/html', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(moduleFile)); return; }
    if (pathname === '/renderer') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");
      res.setHeader('Content-Type', 'text/html'); res.end(rendererHtml); return;
    }
    const target = path.resolve(out, '.' + pathname);
    assert.ok(target.startsWith(out + path.sep));
    res.setHeader('Content-Type', mime[path.extname(target)] || 'text/plain'); res.end(await readFile(target));
  } catch (e) { res.statusCode = e.code === 'ENOENT' ? 404 : 500; res.end(String(e.message)); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const profile = await mkdtemp(path.join(os.tmpdir(), 't148-offline-webgpu-'));
const flags = ['--headless=new', '--enable-gpu', '--force-color-profile=srgb', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'];
const child = spawn(chrome, flags, { stdio: ['ignore', 'ignore', 'pipe'] });
let launchError, socket, sequence = 0, stderr = '';
child.on('error', e => launchError = e);
child.stderr.on('data', data => stderr += data);
const tasks = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { tasks.delete(id); reject(new Error(`Chrome ${method} timed out`)); }, 30000);
    tasks.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: e => { clearTimeout(timer); reject(e); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const report = { status: 'INCOMPLETE', at: new Date().toISOString(), command: `CHROME_PATH=${quote(chrome)} PORT=${port} node scripts/render-shader-backdrops.mjs ${quote(path.relative(root, out))}${process.argv.includes('--install') ? ' --install' : ''}`, baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), source: config.source, parameters: config, chrome, flags: flags.filter(f => !f.startsWith('--user-data-dir')), sizes: config.sizes, results: [], panels: [] };
try {
  let debugPort;
  for (let i = 0; i < 80 && !debugPort; i++) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error('Chrome exited before WebGPU check');
    try { debugPort = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (!debugPort) await pause(100);
  }
  assert.ok(debugPort, 'Chrome launch timed out');
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = pages.find(p => p.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', e => { const m = JSON.parse(String(e.data)); const task = tasks.get(m.id); if (task) { tasks.delete(m.id); m.error ? task.reject(new Error(m.error.message)) : task.resolve(m.result); } });
  socket.addEventListener('close', () => { for (const task of tasks.values()) task.reject(new Error('Owned Chrome connection closed')); tasks.clear(); });
  report.browser = await send('Browser.getVersion');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/renderer` });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) { ready = await evaluate('!!window.rendererReady'); if (!ready) await pause(100); }
  assert.ok(ready, 'WebGPU renderer did not initialize; no alternate rendering path is allowed');
  report.gpu = await evaluate('window.adapterInfo');
  for (const job of jobs) {
    await send('Emulation.setDeviceMetricsOverride', { width: job.width, height: job.height, deviceScaleFactor: 1, mobile: false });
    const frame = await evaluate(`window.renderCandidate(${JSON.stringify(job)})`);
    assert.equal(frame.width, job.width); assert.equal(frame.height, job.height);
    const shot = await send('Page.captureScreenshot', { format: 'webp', quality: job.quality, captureBeyondViewport: false, clip: { x: 0, y: 0, width: job.width, height: job.height, scale: 1 } });
    const data = Buffer.from(shot.data, 'base64');
    const file = `${job.effect}--${job.palette}--${job.width}.webp`;
    await writeFile(path.join(out, file), data);
    report.results.push({ ...job, file, bytes: data.length, frame });
    assert.ok(data.length <= 200000, `${file} exceeds 200 KB; rejected, original evidence retained`);
    await evaluate('window.activeShader.destroy();window.activeShader=null');
    if (report.results.length % 12 === 0) console.log(`Rendered ${report.results.length}/${jobs.length}`);
  }
  await writeFile(path.join(out, 'index.html'), comparisonHtml(config, report), 'utf8');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("document.readyState==='complete' && document.images.length>0 && [...document.images].every(i=>i.complete&&i.naturalWidth>0)")) break;
    assert.ok(i < 99, 'Comparison images failed to load'); await pause(50);
  }
  await evaluate('document.fonts.ready');
  for (const effect of config.effects) {
    const rect = await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(effect.id)}).getBoundingClientRect();return {x:0,y:Math.floor(r.top+scrollY),width:1600,height:Math.ceil(r.height)}})()`);
    const panel = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 } });
    const file = `${effect.id}--review.png`;
    await writeFile(path.join(out, file), Buffer.from(panel.data, 'base64'));
    report.panels.push({ effect: effect.id, file });
  }
  await writeFile(path.join(out, 'overview.html'), comparisonHtml(config, report, true), 'utf8');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/overview.html` });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`document.readyState==='complete' && document.images.length===${config.effects.length * config.palettes.length} && [...document.images].every(i=>i.complete&&i.naturalWidth>0)`)) break;
    assert.ok(i < 99, 'Overview images failed to load'); await pause(50);
  }
  await evaluate('document.fonts.ready');
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const comparison = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1600, height: cssContentSize.height, scale: 1 } });
  await writeFile(path.join(out, 'comparison.png'), Buffer.from(comparison.data, 'base64'));
  if (process.argv.includes('--install')) {
    assert.equal(config.source.status, 'controller-selected');
    const assetDir = path.join(root, 'public/system-backdrops');
    await mkdir(assetDir, { recursive: true });
    const catalog = {};
    for (const effect of config.effects) for (const palette of config.palettes) {
      const id = `bd_${effect.id}_${palette.id}`, urls = {};
      for (const size of config.sizes) {
        const rendered = report.results.find(r => r.effect === effect.id && r.palette === palette.id && r.width === size.width);
        const file = `${id}--${size.width}.webp`;
        await copyFile(path.join(out, rendered.file), path.join(assetDir, file));
        urls[size.width] = `/system-backdrops/${file}`;
      }
      catalog[id] = { effect: effect.id, style: palette.style, label: `${effect.label} / ${palette.label}`, text: palette.text, urls };
    }
    await writeFile(path.join(root, 'lib/code-site-backdrops.ts'), `// Generated offline by scripts/render-shader-backdrops.mjs --install; shaders@${pkg.version}, MIT.\n// Static WebPs only. The shader engine is never imported by the runtime.\nexport const systemBackdrops = ${JSON.stringify(catalog, null, 2)} as const;\nexport const systemBackdropLicense = ${JSON.stringify('<!--\nAbstract backgrounds generated offline with shaders\n' + license + '-->')};\n`, 'utf8');
    report.installed = { directory: 'public/system-backdrops', count: report.results.length, registry: 'lib/code-site-backdrops.ts' };
  }
  report.status = 'PASS'; report.completedAt = new Date().toISOString();
  console.log(`PASS: ${report.results.length} WebGPU WebPs; maximum ${Math.max(...report.results.map(r => r.bytes))} bytes. Review ${path.relative(root, out)}/index.html`);
} catch (e) {
  report.status = report.gpu ? 'INCOMPLETE' : 'BLOCKED'; report.error = String(e.stack); report.chromeStderr = stderr;
  console.error(`${report.status}: ${e.message}`); process.exitCode = 1;
} finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  socket?.close();
  if (child.exitCode === null && child.pid) {
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000); await exited; clearTimeout(timer);
  }
  await rm(profile, { recursive: true, force: true });
  await new Promise(resolve => server.close(resolve));
}

function comparisonHtml(config, report, overview = false) {
  const cells = (effect, width, text = false) => config.palettes.map(palette => {
    const result = report.results.find(r => r.effect === effect.id && r.palette === palette.id && r.width === width);
    return `<figure><a href="${result.file}"><img src="${result.file}" alt="${effect.type} / ${palette.label} / ${width}" loading="eager"></a>${text ? `<div class="sample" style="color:${palette.text}">精度与工况<br><small>材质、尺寸与选型资料</small></div>` : ''}<figcaption>${palette.label} · ${width}×${result.height} · ${(result.bytes / 1000).toFixed(1)} KB</figcaption></figure>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T-148 静态底图候选</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px 40px;background:#eeeae3;color:#252b2d;font:14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}h1{font-size:32px;margin:0 0 8px}h2{font-size:21px;margin:0}p{margin:8px 0 16px;max-width:1100px}section{padding:20px 0;border-top:1px solid #b4b2ac}.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:10px 0 18px}figure{margin:0;position:relative}img{display:block;width:100%;height:auto;border:1px solid #b4b2ac}figcaption{font-size:12px;margin-top:5px}.sample{position:absolute;top:20px;left:24px;font-size:25px;line-height:1.2;font-weight:600;pointer-events:none}.sample small{font-size:13px;font-weight:400}.size{font-weight:600;color:#555d5e}a{color:inherit}details{margin-top:8px}li{margin:6px 0}@media(max-width:900px){body{padding:24px}.row{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style><h1>T-148 · 静态底图对照</h1><p>${config.effects.length} 个主控保留效果 × 每风格 2 组配色 × 1440 / 768 / 375。上行加排版样字观察背景的干扰；原始 WebP 不含文字，点击查看原尺寸。黑字／白字只是阅读示例。</p><p>shaders@${config.source.version} / MIT · Chrome ${report.browser.product} · ${report.gpu.vendor} ${report.gpu.architecture} · 硬件 WebGPU · 所有时间相关参数为 0 · quality：${config.effects.map(e=>e.id+' '+e.quality).join(' / ')} · 每张 ≤200 KB</p>
<p><a href="index.html">查看全部三档尺寸</a> · <a href="overview.html">四配色总览</a></p>
${config.effects.map(effect => `<section id="${effect.id}"><h2>${effect.id} · ${effect.type} · ${effect.label}</h2><p>${effect.reason}</p><div class="size">1440 · 排版样字</div><div class="row">${cells(effect,1440,true)}</div>${overview ? '' : `<div class="size">768 · 原图缩略</div><div class="row">${cells(effect,768)}</div><div class="size">375 · 原图缩略</div><div class="row">${cells(effect,375)}</div>`}</section>`).join('')}
<section><h2>排除与留待复核</h2><ul>${config.excluded.map(e => `<li><b>${e.types.join(' / ')}</b>：${e.reason}</li>`).join('')}</ul></section></html>`;
}
