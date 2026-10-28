import { factAuditPayload } from './fixtures/fact-audit-reply.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { commitSiteCode } from '../lib/code-site-store.ts';
import { codeRepairFragments, applyCodeRepair } from '../lib/code-site-repair.ts';
import type { SiteCode } from '../lib/code-site.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/t198-t186-caption.json', import.meta.url), 'utf8'));
const output = `artifacts/t198/contract-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
process.env.SITE_STORE = 'fs';
const make = (html: string, css = ''): SiteCode => ({ header: '', footer: '',
  css: `body{margin:0;background:#fff;color:#111;font:16px/2 monospace}main{padding:20px}p{margin:0 0 24px}${css}`,
  pages: [{ id: 'home', title: '课程说明', html: `<main><h1>课程说明</h1>${html}</main>` }] });
const audit = async (code: SiteCode, name: string) => {
  const result = await checkSiteCode({ siteId: 't198-check', code, materials: fixture.materials, images: [], legacyImport: true });
  await writeFile(`${output}/${name}.json`, JSON.stringify(result, null, 2));
  return result;
};
const floor = (checks: Awaited<ReturnType<typeof audit>>['checks']) => checks.layoutRepairs?.filter(r => r.issue.includes('极端窄列')) ?? [];

test('T-186 原 caption 在 375 竖排：生产提交入口拒收且不存版本，修正只开放实际节点和相关声明', async () => {
  const siteId = `t198-${crypto.randomUUID()}`;
  const result = await commitSiteCode({ siteId, legacyImport: { kind: 'convert', name: 'T-186 caption 原现场',
    source: { revision: 1, updatedAt: '2026-10-20T00:00:00Z' }, materials: fixture.materials, code: fixture.code, exportIssues: [] } });
  await writeFile(`${output}/caption-commit.json`, JSON.stringify(result, null, 2));
  assert.equal(result.status, 'unavailable', '一字一行的 caption 必须拒收；基线会存版');
  if (result.status !== 'unavailable') throw new Error('必须经过实际拒收');
  assert.equal('versions' in result.record, false);
  const { code, checks } = await audit(fixture.code, 'caption-check');
  assert.equal(floor(checks).length, 1);
  assert.match(floor(checks)[0].issue, /^products\/375 /);
  assert.deepEqual(checks.issues, floor(checks).map(r => r.issue));
  assert.ok(floor(checks)[0].elements.some(e => e.before === '<caption>多腔热流道模具规格参数</caption>'));
  const fragments = await codeRepairFragments(code, checks.issues, checks.cleaned, [], checks.layoutRepairs);
  await writeFile(`${output}/caption-fragments.json`, JSON.stringify(fragments, null, 2));
  assert.ok(fragments.some(f => f.kind === 'element' && f.before === '<caption>多腔热流道模具规格参数</caption>'));
  assert.ok(fragments.every(f => f.kind === 'css' || f.kind === 'element' && f.before.startsWith('<caption>')), '不能开放表格容器或无关正文');
  await assert.rejects(codeRepairFragments(code, checks.issues, [], [], []), /定位依据/);
  // Explicitly fix the caption layout, rather than deleting its business text.
  const repaired = await applyCodeRepair(code, fragments, { replacements: fragments.filter(f => f.kind === 'element').map(f => ({ fragmentId: f.id,
    after: '<caption style="display:block;width:100%">多腔热流道模具规格参数</caption>' })) });
  const saved = await commitSiteCode({ siteId: `t198-fixed-${crypto.randomUUID()}`, legacyImport: { kind: 'convert', name: 'caption 修正',
    source: { revision: 1, updatedAt: '2026-10-20T00:00:00Z' }, materials: fixture.materials, code: repaired, exportIssues: [] } });
  await writeFile(`${output}/caption-fixed.json`, JSON.stringify(saved, null, 2));
  assert.equal(saved.status, 'applied');
});

test('严格小于 2 才拒收；恰好 2 字和 2 词、两行、短标签、独立价格及单元格不拒收', async () => {
  const { checks } = await audit(make(`
    <p id="zh-low">课程<br>纸笔<br>需要<br>自备<br>好</p>
    <p id="zh-equal">课程<br>纸笔<br>需要<br>自备</p>
    <p id="en-low">Course<br>fees<br>include<br>guided<br>practice<br>and<br>group<br>discussion</p>
    <p id="en-equal">Course fees<br>include guided<br>practice and<br>group discussion</p>
    <p id="two-lines">课程纸笔<br>需要自备</p>
    <p id="short">课<br>程<br>说明</p>
    <p id="price" style="width:1em">人民币一千二百八十元整</p>
    <table><tr><td>人<br>民<br>币<br>一<br>千<br>二<br>百<br>八<br>十<br>元<br>整</td></tr></table>
    <nav>课程<br>纸笔<br>需要<br>自备<br>好</nav><button>课程<br>纸笔<br>需要<br>自备<br>好</button>`), 'boundaries');
  assert.equal(checks.passed, false);
  for (const width of [375, 768, 1440]) {
    const rows = floor(checks).filter(r => r.issue.startsWith(`home/${width} `));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.flatMap(r => r.elements.map(e => /id="([^"]+)"/.exec(e.before)?.[1])).sort(), ['en-low', 'zh-low']);
    assert.equal(checks.viewports.find(v => v.width === width)!.qualityFeedback!.narrowColumns, 4, '正好 2 字或词仍是普通窄列反馈；短标签豁免');
  }
  assert.equal(checks.issues.length, 6);
});

test('沿用 T-160 可见性、最近容器和 contents；多栏分片仅反馈，确定命中仍拒收', async () => {
  const text = '课程纸笔需要自己准备';
  const { checks } = await audit(make(`
    <div id="contents" class="thin"><span style="display:contents">${text}</span></div>
    <div style="display:flex"><p id="flex" class="thin">${text}</p><p>正常宽度</p></div>
    <p id="columns">${text.repeat(2)}</p>
    <p id="ordinary">${text}</p>
    <p class="thin" style="display:none">${text}</p><div style="opacity:0"><p class="thin">${text}</p></div>
    <details><summary>说明</summary><p class="thin">${text}</p></details>`,
    '@media(max-width:400px){.thin{width:1em}#columns{width:3em;column-count:2;column-gap:1em}#ordinary{width:4em}}'), 'visibility');
  const rows = floor(checks);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.issue.startsWith('home/375 ')));
  assert.deepEqual(rows.flatMap(r => r.elements.map(e => /id="([^"]+)"/.exec(e.before)?.[1])).sort(), ['contents', 'flex']);
  assert.equal(checks.viewports.find(v => v.width === 375)!.qualityFeedback!.narrowColumns, 4);
  assert.ok(checks.viewports.find(v => v.width === 375)!.qualityFeedback!.details.some(d => d.target === '#columns' && d.detail.includes('可见行无法确定')));
});

test.after(() => console.log(`T-198 本轮证据：${output}`));

// Only after scheduling and HTTP model replies are controlled. The workflow,
// fragment selection, candidate checks and version storage remain production code.
test('真实生成流程共用两轮额度：修好可存版，仍碎排则如实结束且不存版', async () => {
  const callbacks: Array<() => Promise<void>> = [];
  (globalThis as typeof globalThis & { __t198After?: typeof callbacks }).__t198After = callbacks;
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'next/server.js') return { shortCircuit: true, url: 'data:text/javascript,export function after(fn){globalThis.__t198After.push(fn)}' };
    if (specifier.startsWith('@/')) return next(pathToFileURL(path.join(process.cwd(), specifier.slice(2)) + '.ts').href, context);
    return next(specifier, context);
  } });
  const { handleCodeChat } = await import('../lib/code-site-workflow.ts');
  const { createCodeSite, updateCodeSite, getCodeSite } = await import('../lib/code-site-store.ts');
  const { getOrCreateConversation, updateConversationAlignment } = await import('../lib/conversation-store.ts');
  const code = make('<p id="bad">课程纸笔需要自己准备</p>', '#bad{width:1em}');
  let repairCount = 0, fix = false;
  const requests: unknown[] = [];
  const provider = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push(body);
    const user = body.messages[1].content;
    let answer: unknown;
    if (user.startsWith('{')) {
      const input = JSON.parse(user.split('\n')[0]);
      if (input.fragments) {
        repairCount++;
        assert.ok(input.issues.every((issue: string) => issue.includes('极端窄列')));
        assert.ok(input.fragments.every((f: {kind: string; before: string}) => f.kind === 'css' || f.kind === 'element' && f.before.includes('id="bad"')));
        answer = { replacements: input.fragments.filter((f: {kind: string; selector: string; property: string}) => f.kind === 'css' && f.selector === '#bad' && f.property === 'width')
          .map((f: {id: number}) => ({ fragmentId: f.id, after: fix ? 'auto' : '1.1em' })) };
      } else {
        assert.ok(input.segments, '只允许本地事实核对与修正协议');
        answer = { results: input.segments.map((segment: {id: number}) => ({ id: segment.id, issues: [], noFacts: true, factCategories: [], citations: [] })) };
      }
    } else answer = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(factAuditPayload(body, { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })));
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address(); assert.ok(address && typeof address === 'object');
  const savedEnv = { base: process.env.DEEPSEEK_BASE_URL, key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL };
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.DEEPSEEK_API_KEY = 't198-local-only'; process.env.DEEPSEEK_MODEL = 't198-local-only';
  try {
    for (fix of [false, true]) {
      repairCount = 0;
      const siteId = `t198-workflow-${crypto.randomUUID()}`;
      const conversation = await getOrCreateConversation(siteId, `conversation-${siteId}`);
      await createCodeSite(siteId, '课程说明', conversation.conversationId);
      await updateCodeSite(siteId, () => ({ materials: '课程说明。课程纸笔需要自己准备', preferences: { style: 'precision', layout: 5, density: 6 },
        plan: { style: 'precision', summary: '课程说明', styleReason: '课程说明', pages: [{ id: 'home', title: '课程说明', outline: '课程说明' }] } }));
      const questionId = `t198-confirm-${siteId}`;
      await updateConversationAlignment(siteId, conversation.conversationId, record => ({ ...record, alignment: { ...record.alignment,
        state: 'awaiting_confirmation', epoch: 1, inflightRunId: null, confirmClaimed: false,
        currentQuestion: { questionId, questionRevision: 1, kind: 'confirm_ops', prompt: '课程说明', options: [{ id: 'approve', label: '确认并生成', description: '课程说明' }], allowOther: false },
        proposedChange: { questionId, questionRevision: 1, summary: '课程说明', rejected: [], baseRevision: 0, model: 't198-local-only', latencyMs: 0 } } }));
      const response = await handleCodeChat(siteId, { action: 'confirm', questionId, questionRevision: 1 });
      assert.equal(response.status, 202, await response.clone().text());
      assert.equal(callbacks.length, 1);
      await callbacks.shift()!();
      const site = (await getCodeSite(siteId))!;
      await writeFile(`${output}/workflow-${fix ? 'fixed' : 'refused'}.json`, JSON.stringify({ site, repairCount, requests }, null, 2));
      assert.equal(site.run!.status, fix ? 'complete' : 'error');
      assert.equal(site.versions.length, fix ? 1 : 0);
      assert.equal(repairCount, fix ? 1 : 2);
      assert.equal(site.run!.attempts.length, fix ? 2 : 3);
      if (!fix) {
        assert.match(site.run!.step, /两轮修正后仍未通过.*未保存版本/);
        assert.ok(site.run!.attempts.every(attempt => !attempt.checks.passed && floor(attempt.checks).length === 3));
      }
    }
  } finally {
    for (const [key, value] of Object.entries({ DEEPSEEK_BASE_URL: savedEnv.base, DEEPSEEK_API_KEY: savedEnv.key, DEEPSEEK_MODEL: savedEnv.model })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    hooks.deregister();
    await new Promise<void>(resolve => provider.close(() => resolve()));
  }
});
