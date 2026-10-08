import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';

test('T-129 saved-version CLI detects disabled navigation and inquiry through real Chrome', async t => {
  assert.ok(process.env.CHROME_PATH, 'set the approved testing CHROME_PATH');
  const root = path.resolve(process.env.T129_CHECK_TEST_OUT || `artifacts/t129/check-regression-${Date.now()}-${process.pid}`);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'fixture.json'), JSON.stringify({ siteId: 'interaction-fixture' }));
  const versions = [11, 26, 27].map(revision => ({
    id: `v${revision}`, revision, code: { pages: [{ id: 'home', title: '首页', html: revision === 26 ? '当前产品目录' : '旧版产品表格' }] },
  }));
  const cases = [
    { name: 'unchanged', css: '', pass: true },
    { name: 'inquiry-ancestor-hidden', css: 'main > div{display:none}', pass: false },
    { name: 'navigation-ancestor-hidden', css: 'header{display:none}', pass: false },
    { name: 'inquiry-pointer-events', css: '.sc-inquiry{pointer-events:none}', pass: false },
    { name: 'contact-link-destination', css: '', pass: false },
  ];
  let scenario = cases[0];
  // Immutable HTTP inputs test the acceptance CLI, not the model or version store.
  // Only the after preview changes; CSS negative cases leave the body HTML equal.
  const server = createServer((request, response) => {
    assert.equal(request.method, 'GET', 'the saved replay must be read-only');
    const url = new URL(request.url!, 'http://fixture');
    if (url.pathname.endsWith('/draft')) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ codeSite: { versions, runs: [{ versionId: 'v27', status: 'complete', referenceVersionIds: ['v11'] }] } }));
      return;
    }
    const after = url.searchParams.get('version') === 'v27';
    const product = url.searchParams.get('version') === 'v26' ? '<ul><li>轴套与接头</li></ul>' : '<table><tr><td>轴套</td><td>接头</td></tr></table>';
    const contact = after && scenario.name === 'contact-link-destination' ? 'home' : 'contact';
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html><head><style>body{margin:0;padding:24px}header,main,footer{padding:20px}main>div{padding-top:1100px}.sc-inquiry{padding:20px}button,input{padding:12px}${after ? scenario.css : ''}</style></head><body><header><a href="?page=home">首页</a><a href="?page=${contact}">联系</a></header><main><h1>加工能力</h1><section><h2>产品与加工</h2>${product}<a href="?page=products">查看产品</a></section><div><form class="sc-inquiry"><label>姓名<input name="name"></label><button type="submit">发送询盘</button></form></div></main><footer>联系邮箱待补充</footer></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const item of cases) await t.test(item.name, async () => {
      scenario = item;
      const args = ['--experimental-strip-types', 'scripts/check-version-history.mjs', '--assert-saved', '--before-revision', '26', '--after-revision', '27', '--reference-revision', '11'];
      const startedAt = new Date().toISOString();
      const child = spawn(process.execPath, args, { env: { ...process.env, SITECRAFT_BASE: base, T129_ARTIFACT_DIR: root, T129_RUN_NAME: item.name, T129_SITE_ID: 'interaction-fixture' }, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
      const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      await writeFile(path.join(root, `${item.name}.json`), JSON.stringify({ args, base, startedAt, completedAt: new Date().toISOString(), code, output }, null, 2));
      const report = JSON.parse(await readFile(path.join(root, item.name, 'report.json'), 'utf8'));
      assert.equal(code, item.pass ? 0 : 1, `${item.name}: wrong CLI verdict\n${output}`);
      if (item.pass) assert.equal(report.status, 'PASS');
      else assert.match(report.error, /home: preserve headers, footers and everything outside product regions/);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
