import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Failure modes: run accounting vanishes at the commit lock; only final refusal
// survives; successful fact-audit tokens are lost. Only the provider and Next's
// deferred scheduling are fixtures. API handlers, Chrome and submission are real.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t130After?: typeof scheduled }).__t130After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t130After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
let reject = true;
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<html><body>fixture origin</body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), user = body.messages[1].content, system = body.messages[0].content;
  const content = system.includes('事实校对员') ? { issues: [] } : user.includes('先给页面大纲')
    ? { summary: '首页与联系', style: 'precision', styleReason: '机械业务', pages: [{ id: 'home', title: '首页', outline: '机械与联系' }] }
    : { header: '<header>检查机械</header>', footer: '<footer>检查机械</footer>', css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main,header,footer{padding:24px}p{max-width:100em}',
      pages: [{ id: 'home', title: '检查机械', html: `<main><h1>检查机械</h1><p>${reject ? '请在询盘里写清零件用途以及需要的规格以便确认供货范围。'.repeat(3) : '精密零件加工。'}</p><div data-system-inquiry=""></div></main>` }] };
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'run-fixture-key'; process.env.DEEPSEEK_MODEL = 'run-fixture-model';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { getCodeSite } = await import('../lib/code-site-store.ts');
const request = (url: string, body: unknown) => new Request(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
test('real submission keeps every form-line refusal and run-scoped provider usage', async () => {
  const records = [];
  for (const bad of [true, false]) {
    reject = bad;
    const created = await create(request('/api/sites', { name: '检查机械', templateId: 'forge', locales: ['zh'], generationRoute: 'code' }));
    assert.equal(created.status, 201); const { id } = await created.json(), ctx = { params: Promise.resolve({ siteId: id }) };
    const start = await chat(request(`/api/sites/${id}/chat`, { message: '公司名：检查机械\n精密零件加工。', baseRevision: 0 }), ctx);
    const state = await start.json();
    const select = await chat(request(`/api/sites/${id}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 } }), ctx);
    assert.equal(select.status, 202); await scheduled.shift()!();
    const planned = await chat(request(`/api/sites/${id}/chat`, { action: 'state' }), ctx);
    const plan = await planned.json();
    assert.equal(plan.codeSite.run.status, 'complete', 'the plan must finish before its accounting is inspected');
    assert.deepEqual((plan.codeSite.runs[0].modelCalls ?? []).map((c: import('../lib/code-site.ts').CodeModelCall) =>
      [c.purpose, c.httpStatus, c.usage?.promptTokens, c.usage?.completionTokens, c.usage?.totalTokens]),
    [['plan', 200, 17, 9, 26]], 'a completed provider call must persist its reported tokens in the run');
    const confirm = await chat(request(`/api/sites/${id}/chat`, { action: 'confirm', questionId: plan.alignment.questionId, questionRevision: plan.alignment.questionRevision }), ctx);
    assert.equal(confirm.status, 202); await scheduled.shift()!();
    const site = (await getCodeSite(id))!, run = site.run!;
    assert.equal(run.status, bad ? 'error' : 'complete');
    assert.equal(run.attempts.length, bad ? 3 : 1);
    assert.deepEqual(run.modelCalls!.map(c => c.purpose), bad ? ['write', 'write', 'write'] : ['write', 'facts']);
    assert.ok(run.modelCalls!.every(c => c.usage?.totalTokens === 26));
    assert.equal(site.versions.length, bad ? 0 : 1);
    if (bad) for (const attempt of run.attempts) {
      assert.equal(attempt.checks.passed, false); assert.match(attempt.checks.issues.join('\n'), /正文行长超标/);
    }
    records.push({ id, status: run.status, modelCalls: run.modelCalls, attempts: run.attempts.map(a => a.checks) });
  }
  const { mkdir, writeFile } = await import('node:fs/promises');
  const directory = path.join('artifacts/t130', `api-fixture-${crypto.randomUUID()}`); await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'report.json'), JSON.stringify({ kind: 'provider-fixture-only', command: 'CHROME_PATH=<specified Chrome> node --test --experimental-strip-types tests/t130-run-records.test.ts', records }, null, 2));
});
