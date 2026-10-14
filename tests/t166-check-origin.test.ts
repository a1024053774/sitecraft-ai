import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import test from 'node:test';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { localEndpoint } from '../scripts/local-endpoint.ts';

const application = localEndpoint('SITECRAFT_BASE').origin;
const output = `artifacts/t166/origin-${Date.now()}-${process.pid}`;
const records: unknown[] = [];
const candidate = { siteId: 't166-origin', materials: '青禾纸品。纸盒加工。', images: [], legacyImport: true as const,
  code: { header: '', footer: '', css: 'body{margin:0;background:#fff;color:#111;font:16px/1.8 sans-serif}main{padding:24px}',
    pages: [{ id: 'home', title: '青禾纸品', html: '<main><h1>青禾纸品</h1><p>纸盒加工。</p></main>' }] } };
await mkdir(output, { recursive: true });
test.after(async () => {
  await writeFile(`${output}/checks.json`, JSON.stringify(records, null, 2), 'utf8');
  console.log(`T-166: ${output}/checks.json`);
});

// Failure modes: navigation still reads the site list; a stalled home page
// delays checking; the replacement source has a non-HTML MIME type or scripts;
// candidate rendering stops before all three viewport checks have run.
// Chrome and the checker are real. Non-home requests reach this worktree's
// ordinary dev server; only the home page's response is controlled here.
for (const stalledHome of [false, true]) {
  test(`提交检查不请求站点列表首页（首页${stalledHome ? '持续阻塞' : '正常响应'}）`, async () => {
    const requests: Array<{ path: string; status?: number; contentType?: string; hasScript?: boolean }> = [];
    const held: ServerResponse[] = [];
    const errors: unknown[] = [];
    const home = '<!doctype html><html><head><title>站点列表</title></head><body></body></html>';
    const server = createServer(async (req, res) => {
      const request = { path: req.url! } as typeof requests[number];
      requests.push(request);
      if (req.url === '/') {
        if (stalledHome) { held.push(res); return; }
        res.writeHead(200, { 'content-type': 'text/html' }); res.end(home); return;
      }
      try {
        const upstream = await fetch(new URL(req.url!, application), { signal: AbortSignal.timeout(20000) });
        const html = await upstream.text();
        Object.assign(request, { status: upstream.status, contentType: upstream.headers.get('content-type'), hasScript: /<script\b/i.test(html) });
        res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || '' }); res.end(html);
      } catch (error) { errors.push(String(error)); res.writeHead(502); res.end(); }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address === 'object');
    process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;
    const started = performance.now();
    const checking = checkSiteCode(candidate);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: Awaited<typeof checking> | undefined;
    let failure: string | undefined;
    try {
      result = await Promise.race([checking, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('首页未响应时，提交检查必须在 20 秒内完成')), 20000);
      })]);
      assert.equal(requests.some(request => request.path === '/'), false, '提交检查不得请求站点列表首页');
      assert.ok(requests.length > 0, '检查必须从配置的 HTTP origin 获取 HTML');
      for (const request of requests) {
        assert.equal(request.status, 200);
        assert.match(request.contentType!, /^text\/html\b/);
        assert.equal(request.hasScript, false, '初始 HTML 源不得带应用脚本');
      }
      assert.deepEqual(errors, []);
      assert.equal(result.checks.passed, true, result.checks.issues.join('\n'));
      assert.deepEqual(result.checks.viewports.map(viewport => viewport.width), [375, 768, 1440]);
    } catch (error) { failure = String(error); throw error; }
    finally {
      clearTimeout(timer);
      const durationMs = performance.now() - started;
      // Release the deliberately stalled response only after the deadline or
      // result. Await the check so its Chrome process always closes.
      for (const res of held) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(home); }
      await checking.catch(error => { errors.push(String(error)); });
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      process.env.SITECRAFT_BASE = application;
      records.push({ stalledHome, durationMs, requests, errors, checks: result?.checks, failure });
    }
  });
}

test('Docker 运行阶段复制完整 public 静态目录', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8');
  const runtime = dockerfile.split(/^FROM\s+.*\s+AS\s+runtime\s*$/mi)[1];
  assert.ok(runtime, '须检查 runtime 阶段，build 阶段有 public 不够');
  assert.match(runtime, /^COPY\s+--from=build\s+\/app\/public\/?\s+\.\/public\/?\s*$/m);
  for (const file of ['.dockerignore', '.gitignore']) {
    assert.match(await readFile(file, 'utf8'), /^\.next-test\/?\s*$/m, `${file} 必须排除测试构建缓存 .next-test`);
  }
});

// Missing files can yield a fully loaded same-origin application 404. A valid
// marker alone also cannot authorize a failed HTTP response or application scripts.
const marked = '<!doctype html><html><head><meta name="sitecraft-code-check" content="v1"></head><body></body></html>';
for (const scenario of [
  { name: '静态页缺失，返回应用 404', missing: true, status: 404, html: '' },
  { name: '同源其他 HTML', status: 200, html: '<!doctype html><html><body>其他页面</body></html>' },
  { name: '有标记但 HTTP 404', status: 404, html: marked },
  { name: '有标记但包含应用脚本', status: 200, html: marked.replace('</head>', '<script src="/_next/missing.js"></script></head>') },
  { name: '有标记但不是 HTML 文档', status: 200, html: marked, contentType: 'text/plain' },
]) test(`检查静态页无效时明确失败：${scenario.name}`, async () => {
  const requests: string[] = [];
  let html = scenario.html;
  if (scenario.missing) {
    const missing = await fetch(`${application}/t166-missing-static-page.html`);
    assert.equal(missing.status, 404, '用同目录普通 Next 服务的真实 404 复现缺失文件');
    html = await missing.text();
    assert.match(html, /<script\b/i, '须覆盖带应用脚本的 404');
  }
  const server = createServer((req, res) => {
    requests.push(req.url!);
    res.writeHead(scenario.status, { 'content-type': scenario.contentType || 'text/html' }); res.end(html);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;
  let result: Awaited<ReturnType<typeof checkSiteCode>> | undefined, rejection: string | undefined;
  try {
    await assert.rejects(checkSiteCode(candidate).then(value => { result = value; return value; }), error => {
      rejection = String(error);
      return /提交检查静态页缺失或无效/.test(rejection);
    });
    assert.deepEqual(requests, ['/code-check.html'], '拒绝后不得继续请求资源或首页');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    process.env.SITECRAFT_BASE = application;
    records.push({ scenario: scenario.name, status: scenario.status, requests, rejection, checks: result?.checks });
  }
});
