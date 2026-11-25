import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import { factAuditReply, factAuditPayload } from './fixtures/fact-audit-reply.ts';

assert.ok(process.env.SITECRAFT_BASE, '需要测试运行器提供的 SITECRAFT_BASE');
assert.ok(process.env.SITECRAFT_DATA_ROOT, '需要测试运行器提供的 SITECRAFT_DATA_ROOT');

const afterTasks: Array<() => Promise<void>> = [];
(globalThis as any).__t223After = afterTasks;
let onReadConversation: (() => Promise<void>) | null = null;
(globalThis as any).__t223ReadConversation = () => onReadConversation?.();

const convUrl = pathToFileURL(path.join(process.cwd(), 'lib/conversation-store.ts')).href;
const convProxyUrl = `data:text/javascript,${encodeURIComponent(`
import * as cs from ${JSON.stringify(convUrl)};
export const { applyConversationAlignmentAction, appendConversationTurn, updateConversationAlignment } = cs;
export async function getConversation(siteId, conversationId) {
  await globalThis.__t223ReadConversation?.();
  return cs.getConversation(siteId, conversationId);
}
`)}`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/server.js') {
      return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t223After.push(fn)}' };
    }
    if (context.parentURL?.endsWith('/lib/code-site-workflow.ts') && specifier === './conversation-store.ts') {
      return { shortCircuit: true, url: convProxyUrl };
    }
    if (!specifier.startsWith('@/')) return next(specifier, context);
    const file = path.join(process.cwd(), specifier.slice(2));
    return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
  },
});

let pauseFacts: (() => Promise<void>) | null = null;
let candidateCode: SiteCode = {
  header: '<header><span>岚坞合作社</span></header>',
  footer: '<footer><p>岚坞茶叶专业合作社</p></footer>',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}header,footer,section{padding:20px;background:#fff}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><h2>合作社简介</h2><p>高山绿茶合作社，散茶批发。</p></section></main>' }],
};

const envKeys = ['SITE_STORE', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'AI_PROVIDER_FORMAT'] as const;
const savedEnv = envKeys.map(key => process.env[key]);

const provider = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const system = String(body.messages?.[0]?.content ?? '');
  const user = String(body.messages?.[1]?.content ?? '');
  const fn = body.tools?.[0]?.function?.name;
  let reply: unknown;
  if (fn === 'submit_page_plan') {
    reply = {
      summary: '展示合作社与产品介绍。',
      style: 'precision',
      styleReason: '按资料直接呈现。',
      skeletonId: 'custom',
      skeletonReason: '单页介绍足够清楚；不使用多页方案，因为资料只包含一页内容。',
      pages: [{ id: 'home', title: '首页', outline: ['合作社简介。', '主营产品与散茶批发说明。'] }],
    };
  } else if (fn === 'submit_local_edit') {
    const input = JSON.parse(user.split('\n')[0]);
    const requestedImg = input.images?.[0]?.imageId;
    const html = requestedImg
      ? `<section class="${input.scope.className}"><h2>合作社简介</h2><p>高山绿茶合作社，散茶批发，本地实拍。</p><img data-image-id="${requestedImg}" alt="茶园实拍"></section>`
      : `<section class="${input.scope.className}"><h2>合作社简介</h2><p>高山绿茶合作社，散茶批发，现场实景。</p></section>`;
    reply = { html, css: '', cannotEdit: '' };
  } else if (system.includes('事实校对员')) {
    if (pauseFacts) await pauseFacts();
    reply = { issues: [] };
  } else {
    reply = candidateCode;
  }
  const wrapped = factAuditReply(body, reply);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(factAuditPayload(body, {
    choices: [{
      finish_reason: fn ? 'tool_calls' : 'stop',
      message: fn
        ? { content: null, tool_calls: [{ type: 'function', id: `${fn}-1`, function: { name: fn, arguments: JSON.stringify(wrapped) } }] }
        : { content: JSON.stringify(wrapped) },
    }],
    usage: { prompt_tokens: 120, completion_tokens: 45, total_tokens: 165 },
  })));
});
const restricted = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);
for (let i = 0; i < 64; i++) {
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const candidate = provider.address();
  if (candidate && typeof candidate === 'object' && !restricted.has(candidate.port)) break;
  await new Promise<void>(resolve => provider.close(() => resolve()));
}
const addr = provider.address();
assert.ok(addr && typeof addr === 'object' && !restricted.has(addr.port));

process.env.SITE_STORE = 'fs';
process.env.AI_PROVIDER_FORMAT = 'deepseek';
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${addr.port}`;
process.env.DEEPSEEK_API_KEY = 't223-fixture-key';
process.env.DEEPSEEK_MODEL = 't223-fixture-model';

const { checkSiteCode } = await import('../lib/code-site-check.ts');
const { codeCheckBrowser } = await import('../lib/code-site-browser.ts');
const { createCodeSite, getCodeSite, commitSiteCode } = await import('../lib/code-site-store.ts');
const { getOrCreateConversation } = await import('../lib/conversation-store.ts');
const { handleCodeChat } = await import('../lib/code-site-workflow.ts');
const { planSiteCode, writeLocalEdit } = await import('../lib/code-site-model.ts');
const { POST: historyPost } = await import('../app/api/sites/[siteId]/history/[action]/route.ts');
const { readBundleProgress } = await import('../lib/browser-sites-client.ts') as any;
const providerClient = await import('../lib/provider-settings-client.ts') as any;

test.after(async () => {
  provider.closeAllConnections?.();
  await new Promise<void>(resolve => provider.close(() => resolve()));
  envKeys.forEach((key, index) => {
    if (savedEnv[index] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[index];
  });
});

async function setupSite(materials: string) {
  const siteId = `t223-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(siteId, `conv-${siteId}`);
  await createCodeSite(siteId, '岚坞茶叶专业合作社', conversation.conversationId);
  const start = await handleCodeChat(siteId, { message: materials });
  assert.equal(start.status, 200);
  const startPayload = await start.json();
  const select = await handleCodeChat(siteId, {
    action: 'select',
    questionId: startPayload.alignment.questionId,
    questionRevision: startPayload.alignment.questionRevision,
    optionId: 'precision',
  });
  assert.equal(select.status, 202);
  for (const fn of afterTasks.splice(0)) await fn();
  return { siteId, afterPlan: await (await handleCodeChat(siteId, { action: 'state' })).json() };
}

test('第 1 条：日期等价写法（2026-05-08 ↔ 2026 年 5 月 8 日）通过数字检查，缺号与非日期零补号仍拒收', { timeout: 60000 }, async () => {
  const baseCode: SiteCode = {
    header: '<header><span>岚坞合作社</span></header>',
    footer: '<footer><p>岚坞茶叶专业合作社</p></footer>',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}section{padding:20px}',
    pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><p>2026 年 5 月 8 日发布</p></section></main>' }],
  };
  const isoToCn = await checkSiteCode({
    siteId: `t223-date-1-${crypto.randomUUID()}`,
    code: baseCode,
    materials: '公司名：岚坞茶叶专业合作社\n2026-05-08（模拟动态）',
    images: [],
    legacyImport: true,
  });
  assert.equal(isoToCn.checks.passed, true, JSON.stringify(isoToCn.checks.issues));

  const cnToIso = await checkSiteCode({
    siteId: `t223-date-2-${crypto.randomUUID()}`,
    code: { ...baseCode, pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><p>2026-05-08 发布</p></section></main>' }] },
    materials: '公司名：岚坞茶叶专业合作社\n2026 年 5 月 8 日（模拟动态）',
    images: [],
    legacyImport: true,
  });
  assert.equal(cnToIso.checks.passed, true, JSON.stringify(cnToIso.checks.issues));

  const absent = await checkSiteCode({
    siteId: `t223-date-bad-${crypto.randomUUID()}`,
    code: { ...baseCode, pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><p>2026 年 5 月 9 日发布</p></section></main>' }] },
    materials: '公司名：岚坞茶叶专业合作社\n2026-05-08（模拟动态）',
    images: [],
    legacyImport: true,
  });
  assert.equal(absent.checks.passed, false);
  assert.ok(absent.checks.issues.includes('资料没有的数字：9'), JSON.stringify(absent.checks.issues));

  const nonDateZero = await checkSiteCode({
    siteId: `t223-date-code-${crypto.randomUUID()}`,
    code: { ...baseCode, pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><p>批次编号 8</p></section></main>' }] },
    materials: '公司名：岚坞茶叶专业合作社\n批次编号 08',
    images: [],
    legacyImport: true,
  });
  assert.equal(nonDateZero.checks.passed, false);
  assert.ok(nonDateZero.checks.issues.includes('资料没有的数字：8'), JSON.stringify(nonDateZero.checks.issues));
});

test('第 2 条：任务在保存版本后结束的同时发生 state 轮询，不能把已完成任务覆盖成中断', { timeout: 60000 }, async () => {
  const { siteId, afterPlan } = await setupSite('公司名：岚坞茶叶专业合作社\n高山绿茶合作社，散茶批发。');
  const enteredFacts = Promise.withResolvers<void>();
  const releaseFacts = Promise.withResolvers<void>();
  pauseFacts = async () => {
    enteredFacts.resolve();
    await releaseFacts.promise;
  };
  try {
    const confirmed = await handleCodeChat(siteId, {
      action: 'confirm',
      questionId: afterPlan.alignment.questionId,
      questionRevision: afterPlan.alignment.questionRevision,
    });
    assert.equal(confirmed.status, 202);
    const background = Promise.all(afterTasks.splice(0).map(fn => fn()));
    await enteredFacts.promise;

    let raced = false;
    onReadConversation = async () => {
      if (raced) return;
      raced = true;
      releaseFacts.resolve();
      await background;
    };
    const polled = await handleCodeChat(siteId, { action: 'state' });
    assert.equal(polled.status, 200);
    const payload = await polled.json();
    assert.equal(payload.codeSite.versions.length, 1);
    assert.equal(payload.codeSite.run.status, 'complete', JSON.stringify(payload.codeSite.run));
    assert.equal(payload.continuation, null);
    assert.equal(payload.codeSite.runs.at(-1).status, 'complete');
  } finally {
    pauseFacts = null;
    onReadConversation = null;
  }
});

test('第 3 条：撤销和恢复在调用模型重核事实时把 facts 调用记录与用量写入站点记录', { timeout: 90000 }, async () => {
  const { siteId, afterPlan } = await setupSite('公司名：岚坞茶叶专业合作社\n高山绿茶合作社，散茶批发。');
  const v1Start = await handleCodeChat(siteId, {
    action: 'confirm',
    questionId: afterPlan.alignment.questionId,
    questionRevision: afterPlan.alignment.questionRevision,
  });
  assert.equal(v1Start.status, 202);
  for (const fn of afterTasks.splice(0)) await fn();

  const afterV1 = (await getCodeSite(siteId))!;
  assert.equal(afterV1.versions.length, 1, afterV1.run?.step);
  // Create v2 via a single-block local edit so v2 lacks whole-site factSegments,
  // matching a real site where restoring/undoing to v2 requires re-auditing facts.
  const v2Edit = await handleCodeChat(siteId, {
    message: '改为现场实景描述',
    baseRevision: 1,
    selectedTarget: { kind: 'dom', pageId: 'home', versionId: afterV1.versions[0].id, path: [1], label: '合作社简介', text: '合作社简介高山绿茶合作社，散茶批发。' },
  });
  assert.equal(v2Edit.status, 202);
  for (const fn of afterTasks.splice(0)) await fn();

  // Create v3 on top of v2 via manual edit.
  const v3Commit = await commitSiteCode({
    siteId,
    baseRevision: 2,
    code: {
      ...candidateCode,
      pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><h2>合作社简介</h2><p>高山绿茶合作社，散茶批发，按批次分级。</p></section></main>' }],
    },
    author: 'user',
    summary: '补充批次说明',
    request: '补充批次说明',
  });
  assert.equal(v3Commit.status, 'applied');

  const beforeUndo = (await getCodeSite(siteId))!;
  const beforeFactCalls = beforeUndo.runs.flatMap(run => run.modelCalls ?? []).filter(call => call.purpose === 'facts').length;
  const undoRes = await historyPost(
    new Request('http://local/api/sites/' + siteId + '/history/undo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: 3 }),
    }),
    { params: Promise.resolve({ siteId, action: 'undo' }) },
  );
  assert.equal(undoRes.status, 200);

  const afterUndo = (await getCodeSite(siteId))!;
  const undoFactCalls = afterUndo.runs.flatMap(run => run.modelCalls ?? []).filter(call => call.purpose === 'facts');
  assert.equal(undoFactCalls.length, beforeFactCalls + 1, 'undo re-audit must record a facts modelCall');
  const recordedUndoCall = undoFactCalls.at(-1)!;
  assert.equal(recordedUndoCall.httpStatus, 200);
  assert.equal(typeof recordedUndoCall.latencyMs, 'number');
  assert.equal(recordedUndoCall.usage?.totalTokens, 165);

  // Explicit restore back to v2 (missing whole-site factSegments) must also record its facts call.
  const restoreRes = await historyPost(
    new Request('http://local/api/sites/' + siteId + '/history/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: 4, versionId: beforeUndo.versions[1].id }),
    }),
    { params: Promise.resolve({ siteId, action: 'restore' }) },
  );
  assert.equal(restoreRes.status, 200);
  const afterRestore = (await getCodeSite(siteId))!;
  const restoreFactCalls = afterRestore.runs.flatMap(run => run.modelCalls ?? []).filter(call => call.purpose === 'facts');
  assert.equal(restoreFactCalls.length, beforeFactCalls + 2);

  // Restoring v1 reuses its whole-site factSegments (no model call, no extra run).
  const runsBeforeReuse = afterRestore.runs.length;
  const reuseRes = await historyPost(
    new Request('http://local/api/sites/' + siteId + '/history/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: 5, versionId: beforeUndo.versions[0].id }),
    }),
    { params: Promise.resolve({ siteId, action: 'restore' }) },
  );
  assert.equal(reuseRes.status, 200);
  const afterReuse = (await getCodeSite(siteId))!;
  assert.equal(afterReuse.runs.length, runsBeforeReuse);
});

test('第 4 条：<wbr> 允许保留而不触发清理拒收，其他禁止元素仍清理并拒收', { timeout: 60000 }, async () => {
  const baseCode: SiteCode = {
    header: '<header><span>岚坞合作社</span></header>',
    footer: '<footer><p>岚坞茶叶专业合作社</p></footer>',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}section{padding:20px}',
    pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><p>联系方式邮箱：tea<wbr>-info<wbr>@example.com</p></section></main>' }],
  };
  const withWbr = await checkSiteCode({
    siteId: `t223-wbr-${crypto.randomUUID()}`,
    code: baseCode,
    materials: '公司名：岚坞茶叶专业合作社\n联系邮箱 tea-info@example.com',
    images: [],
    legacyImport: true,
  });
  assert.equal(withWbr.checks.passed, true, JSON.stringify(withWbr.checks.issues));
  assert.equal(withWbr.checks.cleaned.length, 0);
  assert.match(withWbr.code.pages[0].html, /<wbr>/);

  const withForbidden = await checkSiteCode({
    siteId: `t223-iframe-${crypto.randomUUID()}`,
    code: { ...baseCode, pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section><p>高山绿茶。</p><iframe src="https://evil.invalid"></iframe></section></main>' }] },
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶。',
    images: [],
    legacyImport: true,
  });
  assert.equal(withForbidden.checks.passed, false);
  assert.ok(withForbidden.checks.issues.includes('已去掉禁止元素 iframe'));
});

test('第 5 条：大纲条目以句号结尾时，确认卡大纲拼接不出现「。；」', async () => {
  const { plan } = await planSiteCode('公司名：岚坞茶叶专业合作社\n高山绿茶。', { style: 'precision', layout: 5, density: 6 }, '规划');
  assert.equal(plan.pages[0].outline.includes('。；'), false, `unexpected outline: ${plan.pages[0].outline}`);
  assert.equal(plan.pages[0].outline, '合作社简介；主营产品与散茶批发说明');
});

test('第 6 条：background: var(--x) 后跟同族长属性时保留背景色并正常渲染，含危险 URL 仍拒收', { timeout: 60000 }, async () => {
  const code: SiteCode = {
    header: '<header><span>岚坞合作社</span></header>',
    footer: '<footer><p>岚坞茶叶专业合作社</p></footer>',
    css: ':root{--leaf:#234d36;color:#111}body{margin:0;background:#fff;color:#111;font:16px/1.6 sans-serif}.tone{background:var(--leaf);background-clip:border-box;border-radius:0;color:#fff;padding:24px}@media (min-width:600px){.tone{background:var(--leaf);background-clip:border-box}}',
    pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section class="tone"><p style="background:var(--leaf);background-clip:border-box;color:#fff">高山绿茶合作社</p></section></main>' }],
  };
  const ok = await checkSiteCode({
    siteId: `t223-var-bg-${crypto.randomUUID()}`,
    code,
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶合作社',
    images: [],
    legacyImport: true,
  });
  assert.equal(ok.checks.passed, true, JSON.stringify(ok.checks.issues));
  assert.match(ok.code.css, /background:\s*var\(--leaf\)/);
  assert.doesNotMatch(ok.code.css, /background-image:\s*;/);
  assert.match(ok.code.pages[0].html, /background:\s*var\(--leaf\)/);

  const browser = await codeCheckBrowser();
  try {
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: `<!doctype html><html><head><style>${ok.code.css}</style></head><body>${ok.code.pages[0].html}</body></html>`,
    });
    const bg = await browser.evaluate<string>('getComputedStyle(document.querySelector(".tone")).backgroundColor');
    assert.equal(bg, 'rgb(35, 77, 54)');
  } finally {
    await browser.close();
  }

  const badMixed = await checkSiteCode({
    siteId: `t223-var-evil-${crypto.randomUUID()}`,
    code: { ...code, css: code.css + '.bad{background:var(--leaf) url(https://evil.invalid/a.png);background-clip:border-box}' },
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶合作社',
    images: [],
    legacyImport: true,
  });
  assert.equal(badMixed.checks.passed, false);
  assert.doesNotMatch(badMixed.code.css, /evil\.invalid|url\(/);
  assert.match(badMixed.checks.issues.join('\n'), /CSS .*含资源/);

  const badVarUrl = await checkSiteCode({
    siteId: `t223-var-url-${crypto.randomUUID()}`,
    code: { ...code, css: ':root{--evil:url(https://evil.invalid/b.png)}.bad{background:var(--evil);background-clip:border-box}' },
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶合作社',
    images: [],
    legacyImport: true,
  });
  assert.equal(badVarUrl.checks.passed, false);
  assert.doesNotMatch(badVarUrl.code.css, /evil\.invalid|url\(/);
});

test('第 7 条：局部写作获得已登记图片清单与 data-image-id 语法；误写 <img src="img_..."> 给出明确用法拒因', { timeout: 60000 }, async () => {
  const localContract = readFileSync(path.join(process.cwd(), 'skills/site-code-core/LOCAL-EDIT.md'), 'utf8');
  assert.match(localContract, /<img\s+data-image-id=/);

  const siteId = `t223-img-${crypto.randomUUID()}`;
  const conversation = await getOrCreateConversation(siteId, `conv-${siteId}`);
  await createCodeSite(siteId, '岚坞茶叶专业合作社', conversation.conversationId);
  const imageId = 'img_5a48001122334455';
  const payload = await checkSiteCode({
    siteId,
    code: candidateCode,
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶合作社，散茶批发。',
    images: [],
    legacyImport: true,
  });
  assert.equal(payload.checks.passed, true);

  let capturedImages: any[] | undefined;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init: any) => {
    if (typeof init?.body === 'string' && init.body.includes('submit_local_edit')) {
      const parsed = JSON.parse(init.body);
      capturedImages = JSON.parse(parsed.messages[1].content.split('\n')[0]).images;
    }
    return origFetch(input, init);
  }) as typeof fetch;
  try {
    await writeLocalEdit({
      materials: '公司名：岚坞茶叶专业合作社\n高山绿茶合作社，散茶批发。',
      preferences: { style: 'precision', layout: 5, density: 6 },
      plan: { summary: '介绍合作社', style: 'precision', styleReason: '按资料排版', pages: [{ id: 'home', title: '首页', outline: '合作社简介' }] },
      request: `放一张茶园配图，用 ${imageId}`,
      current: candidateCode,
      target: { kind: 'dom', pageId: 'home', versionId: 'v1', path: [1], label: '合作社简介', text: '合作社简介高山绿茶合作社，散茶批发。' },
      issues: [],
      images: [
        { imageId, siteId, workspaceId: 'demo', mime: 'image/jpeg', byteLength: 1200, width: 800, height: 600, originalName: 'tea-garden.jpg', source: 'user-upload', sourceUrl: '', license: 'user-provided', licenseUrl: null, author: '', attribution: '', usageScope: 'current-site-only', usageCategory: 'facility', retrievedAt: new Date().toISOString(), sha256: '00'.repeat(32), createdAt: new Date().toISOString() },
        { imageId: 'img_9999001122334455', siteId, workspaceId: 'demo', mime: 'image/jpeg', byteLength: 1000, width: 800, height: 600, originalName: 'internal-only.jpg', source: 'user-upload', sourceUrl: '', license: 'user-provided', licenseUrl: null, author: '', attribution: '', usageScope: 'docs-only', retrievedAt: new Date().toISOString(), sha256: '11'.repeat(32), createdAt: new Date().toISOString() },
      ],
    } as any);
  } finally {
    globalThis.fetch = origFetch;
  }
  assert.deepEqual(capturedImages, [{ imageId, name: 'tea-garden.jpg', category: 'facility' }]);

  const wrongMarkup = await checkSiteCode({
    siteId: `t223-img-src-${crypto.randomUUID()}`,
    code: {
      ...candidateCode,
      pages: [{ id: 'home', title: '首页', html: `<main><h1>岚坞茶叶专业合作社</h1><section><h2>合作社简介</h2><img src="${imageId}" alt="茶园实拍"></section></main>` }],
    },
    materials: '公司名：岚坞茶叶专业合作社\n茶园实拍',
    images: [{ imageId, siteId, workspaceId: 'demo', mime: 'image/jpeg', byteLength: 1200, width: 800, height: 600, originalName: 'tea-garden.jpg', source: 'user-upload', sourceUrl: '', license: 'user-provided', licenseUrl: null, author: '', attribution: '', usageScope: 'current-site-only', usageCategory: 'facility', retrievedAt: new Date().toISOString(), sha256: '00'.repeat(32), createdAt: new Date().toISOString() }],
    legacyImport: true,
  });
  assert.equal(wrongMarkup.checks.passed, false);
  assert.doesNotMatch(wrongMarkup.code.pages[0].html, /<img\b/i);
  assert.match(wrongMarkup.checks.issues.join('\n'), /data-image-id/);
});

test('第 8 条：768 档页面增高触发竖向滚动条时不误判「修改越界」，真实改变范围外样式仍拒收', { timeout: 90000 }, async () => {
  const siteId = `t223-scroll-ok-${crypto.randomUUID()}`;
  const rawSource: SiteCode = {
    header: '<header><span>岚坞茶叶专业合作社</span></header>',
    footer: '<footer><p>岚坞茶叶专业合作社</p></footer>',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}header,footer,section{padding:24px;background:#fff}',
    pages: [{ id: 'home', title: '首页', html: '<main><h1>岚坞茶叶专业合作社</h1><section style="height:260px"><h2>产品目录</h2><p>高山绿茶。散茶批发。</p></section><section style="height:220px"><h2>合作方式</h2><p>按批次供货。</p></section></main>' }],
  };
  const sourceCheck = await checkSiteCode({
    siteId: `${siteId}-seed`,
    code: rawSource,
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶。散茶批发。按批次供货。',
    images: [],
    legacyImport: true,
  });
  assert.equal(sourceCheck.checks.passed, true);
  const source = sourceCheck.code;
  const tallerSameScope: SiteCode = {
    ...source,
    pages: [{ id: 'home', title: '首页', html: source.pages[0].html.replace('height: 260px;', 'height: 1200px;') }],
  };
  const target = { kind: 'dom' as const, pageId: 'home', versionId: 'v1', path: [1], label: '产品目录', text: '产品目录高山绿茶。散茶批发。' };
  const grew = await checkSiteCode({
    siteId,
    code: tallerSameScope,
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶。散茶批发。按批次供货。',
    images: [],
    legacyImport: true,
    localEdit: { source, target },
  });
  assert.equal(grew.checks.passed, true, JSON.stringify(grew.checks.issues));

  const realEscape: SiteCode = {
    ...source,
    css: source.css + '\nfooter{width:400px}',
  };
  const escaped = await checkSiteCode({
    siteId: `t223-scroll-bad-${crypto.randomUUID()}`,
    code: realEscape,
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶。散茶批发。按批次供货。',
    images: [],
    legacyImport: true,
    localEdit: { source, target },
  });
  assert.equal(escaped.checks.passed, false);
  assert.match(escaped.checks.issues.join('\n'), /修改越界/);

  // Also cover the two-browser `probeStates === true` branch (`dynamicBrowser`) with an author `:hover` rule.
  const dynamicSeed = await checkSiteCode({
    siteId: `${siteId}-dynamic-seed`,
    code: {
      ...rawSource,
      footer: '<footer id="footer-top"><p>岚坞茶叶专业合作社</p><a href="#footer-top">页尾导航</a></footer>',
      css: `${rawSource.css}\nfooter a{color:#1b4332;display:inline-block}footer a:hover{color:#0f291e}`,
    },
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶。散茶批发。按批次供货。',
    images: [],
    legacyImport: true,
  });
  assert.equal(dynamicSeed.checks.passed, true, JSON.stringify(dynamicSeed.checks.issues));
  const dynamicSource = dynamicSeed.code;
  const dynamicGrew = await checkSiteCode({
    siteId: `${siteId}-dynamic-ok`,
    code: {
      ...dynamicSource,
      pages: [{ id: 'home', title: '首页', html: dynamicSource.pages[0].html.replace('height: 260px;', 'height: 1200px;') }],
    },
    materials: '公司名：岚坞茶叶专业合作社\n高山绿茶。散茶批发。按批次供货。',
    images: [],
    legacyImport: true,
    localEdit: { source: dynamicSource, target },
  });
  assert.equal(dynamicGrew.checks.passed, true, JSON.stringify(dynamicGrew.checks.issues));
});

test('第 10.1/10.3 条：开发模式提示本机环境变量接口，损坏的浏览器存档明确报错而不伪装已有版本', () => {
  assert.equal(typeof providerClient.providerStatusText, 'function');
  assert.equal(providerClient.providerStatusText(null, 'gpt-6.2-sol'), '当前使用本机环境变量的模型接口（gpt-6.2-sol），这个浏览器里未单独保存。');
  assert.equal(providerClient.providerStatusText('deepseek-flash', 'gpt-6.2-sol'), '模型接口已保存在这个浏览器里（deepseek-flash）。');
  assert.equal(providerClient.providerStatusText(null, null), '这个浏览器里还没有保存模型接口。');
  const homeSource = readFileSync(path.join(process.cwd(), 'app/(workspace)/page.tsx'), 'utf8');
  assert.match(homeSource, /getAIProviderStatus/);
  assert.match(homeSource, /serverModel/);

  assert.equal(typeof readBundleProgress, 'function');
  const corrupt = readBundleProgress({
    format: 'sitecraft-site-bundle',
    version: 1,
    siteId: 's1',
    updatedAt: '2026-11-20T00:00:00.000Z',
    files: [{ path: 'code-sites/s1.json', data: Buffer.from('{bad-json', 'utf8').toString('base64') }],
  });
  assert.equal(corrupt.progress, undefined);
  assert.ok(corrupt.readError, 'corrupt bundle must surface a readable error');
  assert.equal(corrupt.status, '本地存档损坏');
});

test('第 10.2 条：375px 工作台修改单不固定悬浮或产生上方模糊灰带', { timeout: 60000 }, async () => {
  const siteIdReal = `t223-ui-375-${crypto.randomUUID()}`;
  const res = await commitSiteCode({
    siteId: siteIdReal,
    legacyImport: {
      kind: 'convert',
      name: '岚坞茶叶专业合作社',
      source: { revision: 1, updatedAt: '2026-11-20T00:00:00.000Z' },
      materials: '岚坞茶叶专业合作社\n高山绿茶合作社，散茶批发。',
      code: candidateCode,
      exportIssues: [],
    },
  });
  assert.equal(res.status, 'applied');

  const browser = await codeCheckBrowser();
  const shotDir = path.join('artifacts', 't223');
  await mkdir(shotDir, { recursive: true });
  try {
    for (const [width, height] of [[375, 812], [768, 1024], [1440, 900]] as const) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width === 375 });
      await browser.send('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/workspace?site=${encodeURIComponent(siteIdReal)}` });
      await browser.evaluate(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 20000;
        const poll = () => {
          const rev = document.querySelector('[data-testid="code-revision"]');
          const loading = document.querySelector('.code-preview-loading');
          if (rev && rev.textContent?.includes('v1') && (!loading || window.innerWidth <= 600)) return resolve(true);
          if (Date.now() > deadline) return reject(new Error('workspace load timeout'));
          setTimeout(poll, 100);
        };
        poll();
      })`);
      const metrics = await browser.evaluate<{ position: string; boxShadow: string; gap: number }>(`(() => {
        const steps = document.querySelector('.code-steps').getBoundingClientRect();
        const chat = document.querySelector('.builder-chat');
        const cs = getComputedStyle(chat);
        const rect = chat.getBoundingClientRect();
        return { position: cs.position, boxShadow: cs.boxShadow, gap: Math.round(rect.top - steps.bottom) };
      })()`);
      const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      const shotName = metrics.position === 'static' ? `workbench-${width}.png` : `red-workbench-${width}.png`;
      await writeFile(path.join(shotDir, shotName), Buffer.from(data, 'base64'));
      if (width === 375) {
        assert.equal(metrics.position, 'static', JSON.stringify(metrics));
        assert.equal(metrics.boxShadow, 'none', JSON.stringify(metrics));
        assert.ok(Math.abs(metrics.gap) <= 2, JSON.stringify(metrics));
      } else {
        assert.ok(metrics.gap >= -1, JSON.stringify(metrics));
      }
    }
  } finally {
    await browser.close();
  }
});
