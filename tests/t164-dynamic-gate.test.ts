import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createServer } from 'node:http';
import { factAuditReply } from './fixtures/fact-audit-reply.ts';

// Failure modes: absence is inferred from raw CSS or active media only; a
// nested/escaped pseudo is missed; candidate-only rules are missed; skipping
// states also skips the static outside comparison; evidence invents a zero
// interactive count. Count real CDP calls, not implementation counters alone.
const counts = { force: 0, discovery: 0, browsers: 0 };
(globalThis as any).__t164GateCounts = counts;
const browserUrl = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const file = path.resolve(specifier.slice(2));
    specifier = pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href;
  }
  const resolved = next(specifier, context);
  if (resolved.url !== browserUrl) return resolved;
  return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    import {codeCheckBrowser as real} from ${JSON.stringify(browserUrl + '?gate-counter')};
    export async function codeCheckBrowser(){
      const browser=await real(),c=globalThis.__t164GateCounts;c.browsers++;
      return {...browser,send(method,params){if(method==='CSS.forcePseudoState')c.force++;return browser.send(method,params)},
        async evaluate(expression){
          if(!expression.includes('const interactive='))return browser.evaluate(expression);
          const value=await browser.evaluate('(()=>{const original=HTMLElement.prototype.focus;let calls=0;HTMLElement.prototype.focus=function(...args){calls++;return original.apply(this,args)};try{return{result:('+expression+'),calls}}finally{HTMLElement.prototype.focus=original}})()');
          c.discovery+=value.calls;return value.result;
        }};
    }
  `) };
} });
const { commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { codeCheckBrowser } = await import('../lib/code-site-browser.ts');
const { outsideCssApplications, localScopeClass } = await import('../lib/code-site-local-edit.ts');
const { renderSiteCode } = await import('../lib/code-site.ts');
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, { issues: [] })) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
const observations: unknown[] = [];
const output = `artifacts/t164/dynamic-gate-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
test.after(() => writeFile(`${output}/evidence.json`, JSON.stringify(observations, null, 2), 'utf8'));

async function fixture(css: string, link = true) {
  const id = `t164-gate-${crypto.randomUUID()}`;
  const code = { header: '', footer: '', css: 'body{margin:0;color:#111;background:white;font:16px/1.6 sans-serif}main{height:400px}section{height:120px}' + css,
    pages: [{ id: 'home', title: '首页', html: `<main><section><h1>目标</h1><p>介绍</p>${link ? '<a href="/home">入口</a>' : ''}</section><p class="outside">外部</p></main>` }] };
  const first = await commitSiteCode({ siteId: id, legacyImport: { kind: 'convert', name: 'CSSOM 动态门禁',
    source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '目标。介绍。入口。外部。', code, exportIssues: [] } });
  assert.equal(first.status, 'applied');
  if (first.status !== 'applied') throw new Error('源版本未保存');
  return { id, code: first.version.code, target: { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [0], text: link ? '目标介绍入口' : '目标介绍', label: '目标' } };
}
async function submit(f: Awaited<ReturnType<typeof fixture>>, candidate = f.code) {
  Object.assign(counts, { force: 0, discovery: 0, browsers: 0 });
  const result = await commitSiteCode({ siteId: f.id, baseRevision: 1, code: candidate, selectedTarget: f.target,
    author: 'user', summary: '动态门禁', request: '保留内容' });
  const measured = { ...counts };
  observations.push({ id: f.id, measured, result });
  return { result, measured };
}

test('两份 CSSOM 均无动态规则：不枚举、不强制，与完整探测得到相同允许结果', async () => {
  const f = await fixture('[data-note=":hover"]{color:#111}');
  const { result, measured } = await submit(f);
  assert.equal(result.status, 'applied');
  assert.equal(measured.force, 0, '无作者动态规则不应启动强制状态');
  assert.equal(measured.discovery, 0, '无动态规则不应逐元素试聚焦');
  assert.equal(measured.browsers, 1, '静态比较应复用提交检查浏览器');
  if (result.status !== 'applied') return;
  for (const viewport of result.version.checks.viewports) {
    const evidence = viewport.dynamicState!;
    assert.equal(evidence.mode, 'static');
    assert.equal(evidence.source.interactiveElements, null, '没有枚举，不能伪记为零');
    assert.equal(evidence.candidate.forceCalls, 0);
  }
  const browser = await codeCheckBrowser();
  try {
    const { frameTree } = await browser.send<any>('Page.getFrameTree');
    for (const width of [375, 768, 1440]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const source = await outsideCssApplications(browser, frameTree.frame.id, renderSiteCode(f.id, f.code, 'home'), { paths: [[0]] });
      const candidate = await outsideCssApplications(browser, frameTree.frame.id, renderSiteCode(f.id, f.code, 'home'), { paths: [[0]] });
      const reachable = new Set(source.states.flatMap(state => state.entries.map(entry => JSON.stringify(entry))));
      assert.ok(candidate.states.every(state => state.entries.every(entry => reachable.has(JSON.stringify(entry)))));
      assert.equal(source.statesChecked, 4, '对照必须实际运行完整探测');
    }
  } finally { await browser.close(); }
});

for (const selector of ['section:hover', 'section:focus', 'section:focus-visible', 'section:focus-within', 'section:active',
  'main:has(:focus)', 'section:is(:hover,:active)']) {
  test(`CSSOM 含 ${selector} 时三档照常完整探测`, async () => {
    const f = await fixture(`${selector}{color:inherit}`);
    const { result, measured } = await submit(f);
    assert.equal(result.status, 'applied');
    assert.ok(measured.force > 0);
    if (result.status !== 'applied') return;
    for (const viewport of result.version.checks.viewports) {
      assert.equal(viewport.dynamicState?.mode, 'states');
      assert.equal(viewport.dynamicState?.candidate.statesChecked, 4);
      assert.equal(viewport.dynamicState?.candidate.interactiveElements, 1);
    }
  });
}

test('仅未激活 @media 内的 :has(:focus) 也不能跳过', async () => {
  const f = await fixture('@media(min-width:9000px){main:has(:focus) .outside{color:#111}}');
  const { result, measured } = await submit(f);
  assert.equal(result.status, 'applied'); assert.ok(measured.force > 0);
  if (result.status === 'applied') assert.ok(result.version.checks.viewports.every(v => v.dynamicState?.mode === 'states' && v.dynamicState.candidate.statesChecked === 4));
});

test('只有候选新增动态规则也必须完整探测', async () => {
  const f = await fixture('');
  const candidate = structuredClone(f.code);
  candidate.css += `.${localScopeClass(f.target)}:hover{color:#111}`;
  const { result, measured } = await submit(f, candidate);
  assert.equal(result.status, 'applied'); assert.ok(measured.force > 0);
  if (result.status === 'applied') assert.ok(result.version.checks.viewports.every(v => v.dynamicState?.mode === 'states'));
});

test('无动态规则仍比较静态基线，DOM 新增链接触发 :has(a) 外溢必须拒绝', async () => {
  const f = await fixture('main:has(a) .outside{color:rgb(220,20,20)}', false);
  const candidate = structuredClone(f.code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">入口</a></section>');
  const { result, measured } = await submit(f, candidate);
  assert.equal(result.status, 'rejected');
  assert.equal(measured.force, 0);
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /baseline.*完整计算样式/);
  assert.equal((await getCodeSite(f.id))!.versions.length, 1);
});
