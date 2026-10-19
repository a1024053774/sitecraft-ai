import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { commitSiteCode, getCodeSite } from '../lib/code-site-store.ts';
import type { SiteCode } from '../lib/code-site.ts';
import { factAuditReply } from './fixtures/fact-audit-reply.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { outsideCssApplications } from '../lib/code-site-local-edit.ts';

// 期望来自范围合同与对比度底线：区块内新增入口不得改变外部颜色；
// 可修的单处 CSS 文案须被核实，不能漏掉共享影响；展开后的浅色文字必须拒收。
// step-end 保证过渡期间保持旧值，不用延时等待，也不把中间帧当作答案。
const output = `artifacts/t192/check-transitions-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const records: unknown[] = [];
test.after(() => writeFile(`${output}/evidence.json`, JSON.stringify(records, null, 2), 'utf8'));
let rejectFee = false;
const provider = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const answer = factAuditReply(body, { issues: [] }) as { results: Array<{ id: string }> };
  if (rejectFee) for (const segment of answer.results) {
    const input = JSON.parse(body.messages[1].content.split('\n')[0]).segments.find((item: { id: string }) => item.id === segment.id);
    if (input.text.includes('免运费。') && !input.text.includes('乙店')) Object.assign(segment, {
      issues: ['免运费需改为待补充。'], noFacts: false, factCategories: ['价格与收费'], citations: [],
    });
  }
  records.push({ request: body, answer });
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
});
await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
const address = provider.address(); assert.ok(address && typeof address === 'object');
Object.assign(process.env, { DEEPSEEK_BASE_URL: `http://127.0.0.1:${address.port}`, DEEPSEEK_API_KEY: 'local-t192', DEEPSEEK_MODEL: 'fixture' });
test.after(() => new Promise<void>(resolve => provider.close(() => resolve())));
const base = 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}main{padding:24px}section{padding:12px 0}';
function code(css: string, html: string): SiteCode {
  return { header: '', footer: '', css: base + css, pages: [{ id: 'home', title: '门店说明', html: `<main><h1>青禾小馆</h1>${html}</main>` }] };
}

for (const motion of [false, true]) test(`提交入口拒绝范围外 hover 颜色变化：${motion ? '有过渡' : '无过渡对照'}`, async () => {
  const siteId = `t192-${crypto.randomUUID()}`;
  const source = code(`.outside{color:#222;${motion ? 'transition:color 1s step-end' : ''}}main:has(a:nth-of-type(2):hover) .outside{color:#900}`,
    '<section><h2>入口</h2><a href="/home">甲入口</a></section><p class="outside">范围外说明</p>');
  const first = await commitSiteCode({ siteId, legacyImport: { kind: 'convert', name: '青禾小馆',
    source: { revision: 1, updatedAt: new Date().toISOString() }, materials: '青禾小馆。入口。甲入口。乙入口。范围外说明。', code: source, exportIssues: [] } });
  assert.equal(first.status, 'applied'); if (first.status !== 'applied') return;
  const target = { kind: 'dom' as const, pageId: 'home', versionId: first.version.id, path: [1], text: '入口甲入口', label: '入口' };
  const unchanged = await commitSiteCode({ siteId, baseRevision: 1, code: first.version.code, selectedTarget: target, author: 'user', summary: '保持', request: '保持内容' });
  records.push({ source, unchanged });
  assert.equal(unchanged.status, 'applied', '两侧同样处理过渡，原样提交不应误拒');
  if (unchanged.status !== 'applied') return;
  const candidate = structuredClone(unchanged.version.code);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">乙入口</a></section>');
  const result = await commitSiteCode({ siteId, baseRevision: 2, code: candidate, selectedTarget: { ...target, versionId: unchanged.version.id }, author: 'user', summary: '加入口', request: '加乙入口' });
  records.push({ source, candidate, result });
  assert.equal(result.status, 'rejected', '区块内新入口触发范围外 hover 颜色，必须拒收');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /hover.*完整计算样式/);
  assert.equal((await getCodeSite(siteId))!.versions.length, 2, '越界不得存版');
});

for (const motion of [false, true]) test(`实际事实修正入口核实 CSS content 影响：${motion ? '有过渡' : '无过渡对照'}`, async () => {
  const candidate = code(`.fee::before{content:"免运费。";${motion ? 'transition:content 1s step-end allow-discrete' : ''}}`,
    '<section><h2>运费</h2><p class="fee">门店说明</p></section>');
  rejectFee = true;
  try {
    const result = await checkSiteCode({ siteId: 't192-css', code: candidate, materials: '青禾小馆。运费待补充。门店说明。', images: [], factSourceMaterials: [] });
    records.push({ candidate, result });
    assert.equal(result.checks.passed, false, '事实替身拒因应保留');
    assert.ok(result.checks.factSegments?.segments.some(segment => segment.factRepair?.members.some(member => member.kind === 'css' && member.property === 'content')),
      '单处文案影响明确，须提供被拒段的 CSS 修正成员');
  } catch (error) { records.push({ candidate, error: String(error) }); throw error; }
  finally { rejectFee = false; }
});

for (const property of ['transition-duration', 'animation-duration']) test(`状态探针仍检出范围外 ${property} 声明变化`, async () => {
  const source = code(`main:has(a:nth-of-type(2):hover) .outside{${property}:2s}`,
    '<section><h2>入口</h2><a href="/home">甲入口</a></section><p class="outside">范围外说明</p>');
  const candidate = structuredClone(source);
  candidate.pages[0].html = candidate.pages[0].html.replace('</section>', '<a href="/home">乙入口</a></section>');
  const result = await checkSiteCode({ siteId: 't192-declaration', code: candidate,
    materials: '青禾小馆。入口。甲入口。乙入口。范围外说明。', images: [], legacyImport: true,
    localEdit: { source, target: { kind: 'dom', pageId: 'home', versionId: 'fixture', path: [1], text: '入口甲入口', label: '入口' } } });
  records.push({ source, candidate, result });
  assert.equal(result.checks.passed, false);
  assert.match(result.checks.issues.join('\n'), /hover.*完整计算样式/, '声明计算值仍须进入范围外比较');
});

for (const motion of [false, true]) test(`CSS 影响核实仍拒绝波及已通过段：${motion ? '有过渡' : '无过渡对照'}`, async () => {
  const candidate = code(`.fee::before{content:"免运费。";${motion ? 'transition:content 1s step-end allow-discrete' : ''}}`,
    '<section><h2>甲店</h2><p class="fee">门店说明</p></section><section><h2>乙店</h2><p class="fee">门店说明</p></section>');
  rejectFee = true;
  try {
    await assert.rejects(() => checkSiteCode({ siteId: 't192-shared', code: candidate,
      materials: '青禾小馆。甲店。乙店。门店说明。', images: [], factSourceMaterials: [] }), /CSS.*允许成员并集之外/);
  } finally { rejectFee = false; records.push({ candidate, expected: '共享影响必须拒收' }); }
});

test('真实动态探针停用元素及伪元素动画效果，保留 animation 原声明', async () => {
  // @keyframes 当前不准进入站点；此夹具直接验证真实探针接受的隔离文档，
  // 不声称它经整站清理准入，也不扩大作者 CSS 的支持范围。
  const browser = await codeCheckBrowser();
  try {
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    const probe = await outsideCssApplications(browser, frameTree.frame.id, `<!doctype html><html><head><style>
      @keyframes shade{from{color:#eee}to{color:#eee}}
      .outside{color:#222;animation:shade 1s infinite}.outside::before{content:'提示';color:#222;animation:shade 1s infinite}
    </style></head><body><main><section>选区</section><p class="outside">范围外说明</p></main></body></html>`, { paths: [[0]] });
    records.push({ animationProbe: probe });
    for (const pseudo of ['', '::before']) {
      const entry = probe.states[0].entries.find(item => JSON.stringify(item.path) === '[1,0,1]' && item.pseudo === pseudo);
      assert.ok(entry?.present);
      const styles = new Map(entry.styles);
      assert.equal(styles.get('color'), 'rgb(34, 34, 34)', '读取基础作者样式，不能读取动画颜色');
      assert.equal(styles.get('animation-name'), 'shade', '停用效果不能覆盖作者声明');
      assert.equal(styles.get('animation-duration'), '1s');
    }
  } finally { await browser.close(); }
});

test('真实探针无法确认动画已停用时明确拒收', async () => {
  const browser = await codeCheckBrowser();
  try {
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    // 故障注入只取消浏览器 API 的取消能力，动画和读取仍在真实 Chrome 中。
    const unavailable = { ...browser, async evaluate<T>(expression: string): Promise<T> {
      await browser.evaluate('Animation.prototype.cancel=function(){}');
      return browser.evaluate<T>(expression);
    } };
    await assert.rejects(() => outsideCssApplications(unavailable, frameTree.frame.id,
      '<!doctype html><html><head><style>@keyframes shade{from{opacity:.5}to{opacity:.5}}p{animation:shade 1s infinite}</style></head><body><main><section>选区</section><p>范围外</p></main></body></html>',
      { paths: [[0]] }), /无法确定停用作者过渡或动画/);
    records.push({ cancellationUnavailable: '明确拒收' });
  } finally { await browser.close(); }
});

for (const kind of ['details', 'aria'] as const) for (const motion of [false, true]) test(`扫描展开后按最终颜色拒收：${kind}／${motion ? '有过渡' : '无过渡对照'}`, async () => {
  const candidate = kind === 'details'
    ? code(`summary{color:#222;${motion ? 'transition:color 1s step-end' : ''}}details[open] summary{color:#eee}`,
      '<details><summary>到店须知</summary><p>请按门店说明到店。</p></details>')
    : code(`.reveal{color:#eee;${motion ? 'transition:color 1s step-end' : ''}}.reveal[aria-hidden="true"]{color:#222}`,
      '<p class="reveal" aria-hidden="true">到店须知</p>');
  const result = await checkSiteCode({ siteId: 't192-reveal', code: candidate, materials: '青禾小馆。到店须知。请按门店说明到店。', images: [], legacyImport: true });
  records.push({ candidate, result });
  assert.equal(result.checks.passed, false, '最终颜色 #eee 在白底上不达标');
  assert.equal(result.checks.viewports.length, 3);
  assert.ok(result.checks.viewports.every(viewport => viewport.contrastIssues > 0), '三档都必须读到展开后的浅色文字');
});
