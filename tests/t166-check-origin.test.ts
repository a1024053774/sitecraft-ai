import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import test from 'node:test';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { localEndpoint } from '../scripts/local-endpoint.ts';

const application = localEndpoint('SITECRAFT_BASE').origin;
const output = `artifacts/t166/origin-${Date.now()}-${process.pid}`;
const records: unknown[] = [];
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
    const checking = checkSiteCode({ siteId: 't166-origin', materials: '青禾纸品。纸盒加工。', images: [], legacyImport: true,
      code: { header: '', footer: '', css: 'body{margin:0;background:#fff;color:#111;font:16px/1.8 sans-serif}main{padding:24px}',
        pages: [{ id: 'home', title: '青禾纸品', html: '<main><h1>青禾纸品</h1><p>纸盒加工。</p></main>' }] } });
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
