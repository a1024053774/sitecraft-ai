import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';

// Contract failures: repairs rewrite unrelated pages; send the entire site;
// save a patch without checking it; lose a refusal or exceed two rounds.
// Only Next's scheduler and the provider are controlled. Routes, Chrome,
// commit checks, file storage and revision handling are real.
const scheduled: Array<() => Promise<void>> = [];
(globalThis as typeof globalThis & { __t138After?: typeof scheduled }).__t138After = scheduled;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t138After.push(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const code: SiteCode = {
  header: '<header>边界机械</header>', footer: '<footer><p>终身保修。</p></footer>',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main,header,footer{padding:24px}p{max-width:32em}',
  pages: [
    { id: 'home', title: '首页', html: '<main><h1>边界机械</h1><p>精密零件加工。</p><p>加工对象为精密零件，材质与检验要求按图纸标注记录。</p><p>终身保修。</p></main>' },
    { id: 'products', title: '产品', html: '<main><h1>精密零件</h1><p>精密零件加工。</p></main>' },
  ],
};
const bodies: Array<{ messages: Array<{ content: string }> }> = [];
let repairs = 0, writes = 0, id = '';
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body></body></html>'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); bodies.push(body);
  const [system, user] = body.messages.map((m: { content: string }) => m.content);
  let reply: unknown;
  if (system.includes('事实校对员')) reply = { issues: ['终身保修。', '即时免费报价。'].filter(text => user.includes(text)).map(text => `页面原句：${text}；资料未提供该承诺或政策。`) };
  else if (user.includes('先给页面大纲')) reply = { summary: '公司与产品', style: 'precision', styleReason: '加工资料', skeletonId: 'compact-profile', skeletonReason: '加工资料与产品边界先列明。', pages: [{ id: 'home', title: '首页', outline: ['公司介绍'] }, { id: 'products', title: '产品', outline: ['产品介绍'] }] };
  else if (system.includes('修正输出合同')) {
    repairs++;
    const state = (await getCodeSite(id))!;
    assert.equal(state.versions.length, 0, 'a refused candidate must not be saved before the next repair');
    assert.equal(state.run!.attempts.length, repairs);
    assert.ok(state.run!.attempts.every(a => !a.checks.passed));
    const input = JSON.parse(user.slice(0, user.lastIndexOf('\n请以 json')));
    reply = { replacements: input.fragments.filter((f: { before: string }) => /终身保修|即时免费报价/.test(f.before)).map((f: { id: number }) => ({ fragmentId: f.id, after: repairs === 1 ? '即时免费报价。' : '' })) };
  } else { writes++; reply = code; }
  res.setHeader('content-type', 'application/json');
  const planCall = !!body.tools;
  res.end(JSON.stringify({ choices: [{ finish_reason: planCall ? 'tool_calls' : 'stop', message: planCall
    ? { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_page_plan', arguments: JSON.stringify(reply) } }] }
    : { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 17, completion_tokens: 9, total_tokens: 26 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
const { POST: create } = await import('../app/api/sites/route.ts');
const { POST: chat } = await import('../app/api/sites/[siteId]/chat/route.ts');
const { getCodeSite } = await import('../lib/code-site-store.ts');
const request = (url: string, body: unknown) => new Request(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
test('two local repairs preserve products and re-enter the real checked commit boundary', async () => {
  const created = await create(request('/api/sites', { name: '边界机械' }));
  id = (await created.json()).id;
  const context = { params: Promise.resolve({ siteId: id }) };
  let response = await chat(request(`/api/sites/${id}/chat`, { message: '公司名：边界机械\n产品：精密零件。精密零件加工。加工对象为精密零件，材质与检验要求按图纸标注记录。\n页面要求：首页、产品两个独立页面。', baseRevision: 0 }), context);
  let state = await response.json();
  response = await chat(request(`/api/sites/${id}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision' }), context);
  assert.equal(response.status, 202); await scheduled.shift()!();
  state = await (await chat(request(`/api/sites/${id}/chat`, { action: 'state' }), context)).json();
  response = await chat(request(`/api/sites/${id}/chat`, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 }), context);
  assert.equal(response.status, 202); await scheduled.shift()!();
  const result = (await getCodeSite(id))!;
  const folder = path.resolve('artifacts/t138', `repair-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'result.json'), JSON.stringify({ site: result, requests: bodies }, null, 2), 'utf8');
  assert.equal(writes, 1, 'repairs must not rewrite a complete site');
  assert.equal(repairs, 2);
  assert.equal(result.versions.length, 1); assert.equal(result.run!.status, 'complete');
  assert.equal(result.run!.attempts.length, 3);
  assert.deepEqual(result.run!.attempts.map(a => a.checks.passed), [false, false, true]);
  assert.ok(result.run!.attempts[0].checks.issues.some(s => s.includes('终身保修')));
  assert.ok(result.run!.attempts[1].checks.issues.some(s => s.includes('即时免费报价')));
  const firstAudit = bodies.find(b => b.messages[0].content.includes('事实校对员'))!;
  assert.equal(firstAudit.messages[1].content.match(/终身保修/g)?.length, 2, 'audit the home promise and shared footer once each, without repeating the footer per page');
  assert.equal(result.versions[0].code.pages[1].html, code.pages[1].html);
  assert.equal(result.versions[0].checks.viewports.length, 6, 'all pages at all three widths must be checked');
  assert.deepEqual(result.plan!.skeleton, { id: 'compact-profile', reason: '加工资料与产品边界先列明。' });
  const planCall = result.runs.find(run => run.kind === 'plan')!.modelCalls![0];
  assert.deepEqual(planCall.skeletonOrder, result.plan!.skeletonOrder);
  assert.equal(planCall.skeletonOrder!.length, 8);
  assert.equal(planCall.response!.finishReason, 'tool_calls');
  assert.ok(planCall.response!.answerChars! > 0);
  assert.deepEqual(result.run!.modelCalls!.map(call => call.purpose), ['write', 'facts', 'repair', 'facts', 'repair', 'facts']);
  assert.ok(result.run!.modelCalls!.every(call => call.response!.finishReason === 'stop' && call.response!.answerChars! > 0));
  const repairBodies = bodies.filter(b => b.messages[0].content.includes('修正输出合同'));
  assert.ok(repairBodies.every(b => !b.messages[1].content.includes(code.pages[1].html) && !b.messages[1].content.includes('当前完整站点')));
});
