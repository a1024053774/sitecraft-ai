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
import { factAuditReply } from './fact-audit-reply.ts';

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
const testDataRoot = process.env.SITECRAFT_DATA_ROOT!;
process.env.SITECRAFT_DATA_ROOT = process.env.T159_ENTRY_DATA_ROOT || path.join(testDataRoot, path.basename(folder));
const storage = { testDataRoot, dataRoot: process.env.SITECRAFT_DATA_ROOT, identityFile: process.env.SITECRAFT_TEST_IDENTITY_FILE };
if (process.env.T159_PENDING_CATALOG === '1') await import('./t159-pending-catalog.ts');
if (process.env.T159_RESTYLE_MODE) await import('./t159-commit-protocol.ts');
const modelRequests: any[] = [], routes: any[] = [], tasks: Promise<void>[] = [];
let queuedAfter = 0;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); modelRequests.push(body);
  res.setHeader('content-type', 'application/json');
  if (!body.tools && process.env.T159_RESTYLE_MODE) {
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, { issues: [] })) } }] })); return;
  }
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
const { GET: draft, PUT: manual } = await import('../../app/api/sites/[siteId]/draft/route.ts');
const { POST: history } = await import('../../app/api/sites/[siteId]/history/[action]/route.ts');
const { POST: upload } = await import('../../app/api/sites/[siteId]/images/route.ts');
const bridge = createServer(async (req, res) => {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks), contentType = req.headers['content-type'];
  const body = raw.length && contentType?.split(';')[0].trim().toLowerCase() === 'application/json' ? JSON.parse(raw.toString('utf8')) : null;
  // Preserve the real saved plan; this fixture ends before its first confirm.
  if (process.env.T159_ENTRY_PLAN_ONLY === '1' && body?.action === 'confirm') {
    routes.push({ url: req.url, body, status: 503, fixturePlanBoundary: true });
    res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"userMessage":"本地替身在确认前保留已保存大纲"}'); return;
  }
  const match = req.url?.match(/^\/api\/sites\/([^/]+)\/(chat|draft|images|history\/(?:restore|undo))$/);
  const request = new Request(requestBase + req.url, { method: req.method, headers: contentType ? { 'content-type': contentType } : {}, ...(raw.length ? { body: raw } : {}) });
  const pending: Array<() => Promise<void>> = [];
  const response = req.url === '/api/health' ? Response.json({ testIdentity: { cwd: process.cwd() }, persistence: { driver: 'development-file' }, deepseek: { configured: true } })
    : await callbacks.run(pending, () => req.url === '/api/sites' ? create(request) : match![2] === 'chat'
      ? chat(request, { params: Promise.resolve({ siteId: match![1] }) }) : match![2] === 'images'
        ? upload(request, { params: Promise.resolve({ siteId: match![1] }) }) : match![2].startsWith('history/')
        ? history(request, { params: Promise.resolve({ siteId: match![1], action: match![2].split('/')[1] }) })
        : req.method === 'PUT' ? manual(request, { params: Promise.resolve({ siteId: match![1] }) })
          : draft(request, { params: Promise.resolve({ siteId: match![1] }) }));
  const payload = await response.json();
  if (process.env.T159_DROP_READ === '1' && req.url?.endsWith('/draft')) {
    delete process.env.T159_DROP_READ;
    routes.push({ url: req.url, injectedDisconnect: true, status: null }); req.socket.destroy(); return;
  }
  routes.push({ url: req.url, body, contentType, byteLength: raw.length, status: response.status, payload });
  res.writeHead(response.status, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload));
  queuedAfter += pending.length;
  if (!process.env.T159_ENTRY_CONFIRM_SITE && process.env.T159_RESTYLE_MODE !== 'act') for (const fn of pending) tasks.push(fn());
});
await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(bridge.address() as any).port}`;
await mkdir(folder, { recursive: true });
if (process.env.T159_RESTYLE_MODE) {
  const post = async (url: string, body: unknown, method = 'POST') => {
    const response = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, payload: await response.json() };
  };
  const get = async (id: string) => (await (await fetch(`${base}/api/sites/${id}/draft`)).json());
  let evidence: unknown;
  if (process.env.T159_RESTYLE_MODE === 'prepare') {
    const { updateCodeSite, commitSiteCode } = await import('../../lib/code-site-store.ts');
    const code = { header: '', footer: '', css: 'body{color:#111;background:#fff}', pages: [{ id: 'home', title: '首页', html: '<main><h1>风格任务准入样本</h1><p>已有业务与边界。</p></main>' }] };
    const unknown = process.env.T159_RESTYLE_ACTION === 'undo-unknown';
    const id = unknown ? crypto.randomUUID() : (await post('/api/sites', { name: '风格任务准入样本' })).payload.id;
    if (unknown) {
      const imported = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: '风格任务准入样本',
        materials: '风格任务准入样本提供既有业务，地址待补充。', code, source: { revision: 1, updatedAt: new Date().toISOString() }, exportIssues: [] } });
      if (imported.status !== 'applied') throw new Error('未核事实的历史版本夹具导入失败');
    }
    await updateCodeSite(id, () => ({ materials: '风格任务准入样本提供既有业务，地址待补充。', factSources: [{ type: 'message', messageIndex: 1, text: '风格任务准入样本提供既有业务，地址待补充。' }], preferences: { style: 'precision', layout: 5, density: 6 },
      plan: { style: 'precision', summary: '既有精密工程版本', styleReason: '已有版本', pages: [{ id: 'home', title: '首页', outline: '既有业务与边界' }] } }));
    for (let revision = unknown ? 1 : 0; revision < 2; revision++) {
      const saved = await commitSiteCode({ siteId: id, baseRevision: revision, code, author: 'user', summary: '已有版本协议夹具', request: '手改提交' });
      if (saved.status !== 'applied') throw new Error('已有版本协议夹具提交失败');
    }
    const initial = await get(id), start = await post(`/api/sites/${id}/chat`, { action: 'start', baseRevision: 2 });
    const a = start.payload.alignment;
    const selected = await post(`/api/sites/${id}/chat`, { action: 'select', questionId: a.questionId, questionRevision: a.questionRevision, optionId: 'neighborly',
      preferences: { style: 'neighborly', layout: 5, density: 6 }, baseRevision: 2 });
    await Promise.all(tasks);
    evidence = { siteId: id, initial, selected, saved: await get(id), localPlanRequests: modelRequests.filter(body => body.tools).length,
      bootstrapFactRequests: modelRequests.filter(body => !body.tools).length };
  } else {
    const action = process.env.T159_RESTYLE_ACTION!;
    const { updateCodeSite } = await import('../../lib/code-site-store.ts');
    if (action.endsWith('-source') || action.endsWith('-changed') && !action.startsWith('manual'))
      await updateCodeSite(process.env.T159_RESTYLE_SITE!, site => ({ materials: site.materials + '资料已更新。' }));
    const id = process.env.T159_RESTYLE_SITE!, before = await get(id), revision = before.codeSite.versions.at(-1).revision;
    const a = before.alignment;
    const confirm = process.env.SITECRAFT_EVAL_STYLES ? null : await post(`/api/sites/${id}/chat`, { action: 'confirm', questionId: a.questionId, questionRevision: a.questionRevision, baseRevision: revision });
    const queuedBefore = queuedAfter, checksBefore = (globalThis as any).__t159CheckCalls;
    let result;
    if (action.startsWith('restore') || action.startsWith('undo')) result = await post(`/api/sites/${id}/history/${action.split('-')[0]}`, { baseRevision: revision, ...(action.startsWith('restore') ? { versionId: before.codeSite.versions[0].id } : {}) });
    else if (action.startsWith('manual')) {
      const code = structuredClone(before.codeSite.versions.at(-1).code); code.css += 'main{padding:24px}';
      if (action === 'manual-changed') code.pages[0].html = code.pages[0].html.replace('已有业务与边界。', '已有业务与新增说明。');
      result = await post(`/api/sites/${id}/draft`, { baseRevision: revision, code, summary: '手改提交' }, 'PUT');
    }
    else if (action === 'replan') {
      await post(`/api/sites/${id}/chat`, { action: 'cancel', baseRevision: revision });
      const next = (await post(`/api/sites/${id}/chat`, { action: 'start', baseRevision: revision })).payload.alignment;
      result = await post(`/api/sites/${id}/chat`, { action: 'select', questionId: next.questionId, questionRevision: next.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 5, density: 6 }, baseRevision: revision });
    } else result = await post(`/api/sites/${id}/chat`, { baseRevision: revision, ...(action === 'translate' ? { action: 'translate' } :
      { message: action === 'dialog' ? '把已有业务说明改得更清楚，保留事实。' : '换个版式：保留全部事实与当前风格。', ...(action === 'page' ? { pageId: 'home' } : {}) }) });
    evidence = { before, confirm, result, after: await get(id), queuedBefore, queuedAfter, modelRequests: modelRequests.length,
      checksBefore, checksAfter: (globalThis as any).__t159CheckCalls, closedChecks: (globalThis as any).__t159ClosedChecks };
  }
  await writeFile(path.join(folder, 'restyle.json'), JSON.stringify({ storage, evidence, limitation: '真实提交/检查器/事实复用与本地 HTTP 核对协议，CDP 观察由替身提供；after 不执行，不证明真实 Chrome、模型事实能力或页面质量。' }, null, 2), 'utf8');
  await Promise.all([new Promise<void>(resolve => bridge.close(() => resolve())), new Promise<void>(resolve => provider.close(() => resolve()))]);
  process.exit(0);
}
if (process.env.T159_ENTRY_CONFIRM_SITE) {
  const id = process.env.T159_ENTRY_CONFIRM_SITE;
  const get = async () => (await (await fetch(`${base}/api/sites/${id}/draft`)).json());
  const before = await get();
  const response = await fetch(`${base}/api/sites/${id}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', questionId: before.alignment.questionId, questionRevision: before.alignment.questionRevision, baseRevision: 0 }) });
  const payload = await response.json(), after = await get();
  await writeFile(path.join(folder, 'confirm.json'), JSON.stringify({ storage, status: response.status, payload, before, after, queuedAfter,
    evalFlag: process.env.SITECRAFT_EVAL_STYLES ?? null, modelRequests: modelRequests.length,
    limitation: '使用生产 HTTP handler 与存储；只运行准备阶段的本地替身规划。确认后的 after 队列不执行，不调用模型或 Chrome。' }, null, 2), 'utf8');
  await Promise.all([new Promise<void>(resolve => bridge.close(() => resolve())), new Promise<void>(resolve => provider.close(() => resolve()))]);
  process.exit(0);
}
const args = ['--experimental-strip-types', '--import', './tests/fixtures/t159-browser-guard.ts',
  ...(process.env.T159_PENDING_CATALOG === '1' ? ['--import', './tests/fixtures/t159-pending-catalog.ts'] : []),
  'scripts/eval-new-route.ts', '--quick', '--only', 'restaurant/neighborly', '--out', path.join(folder, 'eval')];
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
await writeFile(path.join(folder, 'entry.json'), JSON.stringify({ storage, args, exit, stdout, stderr, routes, modelRequests, round, savedStyleSite, reopened,
  limitation: 'HTTP 使用生产 handler，after 与模型由替身控制；不证明实际 Next after 集成或真实模型质量。' }, null, 2), 'utf8');
