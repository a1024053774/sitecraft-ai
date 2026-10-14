import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localEndpoint } from '../../scripts/local-endpoint.ts';

const requestBase = localEndpoint('SITECRAFT_BASE').origin;
const folder = process.env.T159_ENTRY_OUT!;
assert.ok(folder);
const callbacks = new AsyncLocalStorage<Array<() => Promise<void>>>();
(globalThis as any).__t159After = (fn: () => Promise<void>) => callbacks.getStore()!.push(fn);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t159After(fn)}' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
process.env.SITE_STORE = 'fs';
process.env.SITECRAFT_DATA_ROOT = process.env.T159_ENTRY_DATA_ROOT || path.join(folder, 'data');
const modelRequests: any[] = [], routes: any[] = [], tasks: Promise<void>[] = [];
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); modelRequests.push(body);
  res.setHeader('content-type', 'application/json');
  if (!body.tools) { res.writeHead(503); res.end('{"error":{"message":"selection contract stops before writing"}}'); return; }
  const plan = { summary: '呈现菜单及到店信息。', style: 'neighborly', styleReason: '已有菜目与营业时段便于并置。', skeletonId: 'custom', skeletonReason: '先呈现菜目，不采用图片开场；资料没有授权照片。',
    pages: [{ id: 'home', title: '首页', outline: ['菜目与到店信息'] }, { id: 'menu', title: '菜单', outline: ['菜目价格与供应时段'] }] };
  res.end(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ type: 'function', id: 'fixture', function: { name: 'submit_page_plan', arguments: JSON.stringify(plan) } }] } }] }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(provider.address() as any).port}`;
process.env.DEEPSEEK_API_KEY = 'local-fixture'; process.env.DEEPSEEK_MODEL = 'local-fixture';
const { POST: create } = await import('../../app/api/sites/route.ts');
const { POST: chat } = await import('../../app/api/sites/[siteId]/chat/route.ts');
const { GET: draft } = await import('../../app/api/sites/[siteId]/draft/route.ts');
const bridge = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const match = req.url?.match(/^\/api\/sites\/([^/]+)\/(chat|draft)$/);
  const request = new Request(requestBase + req.url, { method: req.method, ...(raw ? { headers: { 'content-type': 'application/json' }, body: raw } : {}) });
  const pending: Array<() => Promise<void>> = [];
  const response = req.url === '/api/health' ? Response.json({ testIdentity: { cwd: process.cwd() }, persistence: { driver: 'development-file' }, deepseek: { configured: true } })
    : await callbacks.run(pending, () => req.url === '/api/sites' ? create(request) : match![2] === 'chat'
      ? chat(request, { params: Promise.resolve({ siteId: match![1] }) }) : draft(request, { params: Promise.resolve({ siteId: match![1] }) }));
  const payload = await response.json();
  routes.push({ url: req.url, body: raw ? JSON.parse(raw) : null, status: response.status, payload });
  res.writeHead(response.status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload));
  for (const fn of pending) tasks.push(fn());
});
await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(bridge.address() as any).port}`;
await mkdir(folder, { recursive: true });
const args = ['--experimental-strip-types', '--import', './tests/fixtures/t159-browser-guard.ts', 'scripts/eval-new-route.ts', '--quick', '--only', 'restaurant/neighborly', '--out', path.join(folder, 'eval')];
const cli = spawn(process.execPath, args, { env: { ...process.env, SITECRAFT_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '';
cli.stdout.on('data', data => { stdout += data; }); cli.stderr.on('data', data => { stderr += data; });
process.once('SIGTERM', () => { cli.kill('SIGTERM'); process.exit(143); });
const exit = await new Promise(resolve => cli.once('close', resolve));
let savedStyleSite: string | undefined, reopened: any;
const post = async (url: string, body: unknown) => {
  const response = await fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, payload: await response.json() };
};
if (process.env.SITECRAFT_EVAL_STYLES) {
  savedStyleSite = (await post('/api/sites', { name: '绘画机构准入留存' })).payload.id;
  await post(`/api/sites/${savedStyleSite}/chat`, { message: '成人素描课，地址待补充。', baseRevision: 0 });
}
if (process.env.T159_ENTRY_EXISTING_SITE) {
  const id = process.env.T159_ENTRY_EXISTING_SITE;
  const state = (await post(`/api/sites/${id}/chat`, { action: 'state' })).payload;
  const response = await post(`/api/sites/${id}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision,
    optionId: 'neighborly', preferences: { style: 'neighborly', layout: 5, density: 6 }, SITECRAFT_EVAL_STYLES: 'neighborly' });
  reopened = { visibleOptions: state.alignment.options.map((o: any) => o.id), selectStatus: response.status };
}
await Promise.all(tasks);
await Promise.all([new Promise<void>(resolve => bridge.close(() => resolve())), new Promise<void>(resolve => provider.close(() => resolve()))]);
const round = JSON.parse(await readFile(path.join(folder, 'eval/private/round.json'), 'utf8'));
await writeFile(path.join(folder, 'entry.json'), JSON.stringify({ args, exit, stdout, stderr, routes, modelRequests, round, savedStyleSite, reopened,
  limitation: 'HTTP 使用生产 handler，after 与模型由替身控制；不证明实际 Next after 集成或真实模型质量。' }, null, 2), 'utf8');
