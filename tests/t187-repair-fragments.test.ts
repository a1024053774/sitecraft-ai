import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { codeCheckDocument } from './fixtures/code-check-document.ts';
import { codeRepairFragments, applyCodeRepair } from '../lib/code-site-repair.ts';
import { repairSiteCode } from '../lib/code-site-model.ts';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { commitSiteCode } from '../lib/code-site-store.ts';
import type { SiteCode, CodePreferences, CodeCheck } from '../lib/code-site.ts';
import { saveSiteImage, readSiteImage, type SiteImageRecord } from '../lib/site-images.ts';

// Failure modes: a short repeated separator selects an entire page; CSS unrelated
// to the failing element is writable; locations drift; the send/receive limits
// diverge; the provider is called before an oversized request is refused.
// Source: T-183 round1-full/private/case-1, preserved before this change. Model
// semantics are controlled; Chrome, selection, patch validation and commit are real.
const fixture = JSON.parse(await readFile(new URL('./fixtures/t187-industrial-repair.json', import.meta.url), 'utf8'));
const output = `artifacts/t187/focused-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const fixtureSiteId = `t187-${crypto.randomUUID()}`;
const images: SiteImageRecord[] = [];
const imageIds = new Map<string, string>();
for (const image of fixture.images) {
  const record = await saveSiteImage({ siteId: fixtureSiteId,
    bytes: await readFile(new URL(`./fixtures/company-images/industrial/${image.file}`, import.meta.url)),
    originalName: image.originalName, provenance: image });
  images.push(record); imageIds.set(image.imageId, record.imageId);
}
// Production registration assigns fresh IDs. Rebind only those IDs in memory;
// the saved source fixture, original code and original replies stay untouched.
for (const attempt of fixture.attempts) for (const [before, after] of imageIds) {
  const rebind = (text: string) => text.replaceAll(before, after);
  attempt.code.header = rebind(attempt.code.header); attempt.code.footer = rebind(attempt.code.footer); attempt.code.css = rebind(attempt.code.css);
  for (const page of attempt.code.pages) page.html = rebind(page.html);
}
await writeFile(`${output}/image-registration.json`, JSON.stringify({ fixtureSiteId, ids: [...imageIds], images }, null, 2), 'utf8');
const requests: any[] = [];
const server = createServer(async (req, res) => {
  if (req.method === 'GET') {
    if (req.url?.includes('/images/')) {
      const image = await readSiteImage(fixtureSiteId, req.url.split('/').at(-1)!);
      res.statusCode = image ? 200 : 404;
      res.setHeader('content-type', image?.record.mime ?? 'text/plain');
      res.end(image ? Buffer.from(image.bytes) : '图片不存在');
    } else { res.setHeader('content-type', 'text/html'); res.end(codeCheckDocument); }
    return;
  }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  const answer = { replacements: input.fragments.map((fragment: any) => ({ fragmentId: fragment.id,
    after: fragment.kind === 'css' && fragment.selector === '.sep' && fragment.property === 'color' ? '#47535e'
      : fragment.kind === 'text' && fragment.before === '对比度提升效果显著。' ? '效果待补充。' : fragment.before })) };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_BASE_URL = process.env.SITECRAFT_BASE;
process.env.DEEPSEEK_API_KEY = 'local-only'; process.env.DEEPSEEK_MODEL = 'local-only';
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const preferences: CodePreferences = { style: 'precision', layout: 5, density: 6 };
const audit = (code: SiteCode) => checkSiteCode({ siteId: fixtureSiteId, code, materials: fixture.materials, images, legacyImport: true });
const repair = (code: SiteCode, checks: Pick<CodeCheck, 'issues' | 'cleaned' | 'layoutRepairs'>) => repairSiteCode({ materials: fixture.materials, preferences, current: code,
  issues: checks.issues, cleaned: checks.cleaned, layoutRepairs: checks.layoutRepairs });

test('保存的 98 条原文在严格回复协议下拒收，不放宽接收上限', async () => {
  assert.equal(fixture.rejectedResponse.replacements.length, 98);
  await assert.rejects(applyCodeRepair(fixture.attempts[1].code, [], fixture.rejectedResponse), /模型未返回有效的局部修正/);
});

test('失败站：只开放实际分隔符和相关声明，修好颜色后经同一提交入口存版', async () => {
  const original = fixture.attempts[1];
  const checked = await audit(original.code);
  await writeFile(`${output}/before.json`, JSON.stringify(checked, null, 2), 'utf8');
  assert.deepEqual(checked.checks.issues, original.issues, '必须复现保存现场同样的九条对比度拒因');
  const fragments = await codeRepairFragments(checked.code, checked.checks.issues, checked.checks.cleaned, [], checked.checks.layoutRepairs);
  await writeFile(`${output}/fragments.json`, JSON.stringify(fragments, null, 2), 'utf8');
  assert.ok(fragments.length < 80, `一处重复分隔符不应扩大成 ${fragments.length} 个可写片段`);
  assert.ok(fragments.every(fragment => fragment.kind !== 'style'), '不开放整份样式表');
  assert.ok(fragments.filter(fragment => fragment.kind === 'element').every(fragment => /^<span class="sep">\/<\/span>$/.test(fragment.before)), '不开放无关正文、页头、页脚和产品页');
  assert.ok(fragments.some(fragment => fragment.kind === 'css' && fragment.selector === '.sep' && fragment.property === 'color'));
  assert.ok(fragments.every(fragment => fragment.before.trim()), '不能把变量简写展开出的空值长属性发给模型');
  assert.deepEqual(fragments.filter(fragment => fragment.kind === 'css' && fragment.selector === 'body').map(fragment => fragment.kind === 'css' && fragment.property), ['background'], '只开放源码中的 background 简写');
  const result = await repair(checked.code, checked.checks);
  const sent = JSON.parse(requests.at(-1).messages[1].content.split('\n')[0]);
  assert.equal(sent.materials, fixture.materials);
  assert.match(requests.at(-1).messages[0].content, /装饰性.*分隔符/);
  assert.equal(result.code.header, checked.code.header); assert.equal(result.code.footer, checked.code.footer);
  assert.deepEqual(result.code.pages, checked.code.pages, '所有业务内容和分隔符均保留');
  const saved = await commitSiteCode({ siteId: fixtureSiteId, legacyImport: { kind: 'convert', name: 'T-187 保存现场', source: { revision: 1, updatedAt: '2026-10-18T22:37:02.568Z' },
    materials: fixture.materials, code: result.code, exportIssues: [] } });
  await writeFile(`${output}/after.json`, JSON.stringify({ result, saved, requests }, null, 2), 'utf8');
  assert.equal(saved.status, 'applied', JSON.stringify(saved));
  if (saved.status !== 'applied') throw new Error('必须经过真实提交入口');
  assert.equal(saved.version.checks.passed, true);
  assert.equal(saved.version.checks.factReview, 'legacy-unreviewed', '这次只证明确定性检查，不冒充模型事实校对');
  assert.equal(saved.version.checks.viewports.length, 6);
  assert.ok(saved.version.checks.viewports.every(viewport => !viewport.overflow && !viewport.overlaps && !viewport.contrastIssues));
});

const simple = (html: string, css = ''): SiteCode => ({ header: '<header>页头保留</header>', footer: '<footer>页脚保留</footer>',
  css: 'body{margin:0;background:#fff;color:#222;font:16px/1.6 sans-serif}main{padding:24px}.keep{color:#333}' + css,
  pages: [{ id: 'home', title: '首页', html: `<main><h1>正文</h1>${html}<p class="keep">无关内容保留</p></main>` }] });
test('事实拒因含对比度时按成员只改第一处，另一处同文和范围外代码保留', async () => {
  const claim = '对比度提升效果显著。', issue = `资料不支持效果声明：${claim}`;
  const code = simple(`<p>${claim}</p><p>${claim}</p>`), count = requests.length;
  const result = await repairSiteCode({ materials: fixture.materials, preferences, current: code, issues: [issue], cleaned: [], layoutRepairs: [],
    factRepairs: [{ issues: [issue], members: [{ kind: 'text', field: 'pages/home/html', path: [0, 1, 0], offset: 0, text: claim, before: claim }] }] });
  assert.equal(requests.length, count + 1);
  const sent = JSON.parse(requests.at(-1).messages[1].content.split('\n')[0]);
  assert.deepEqual(sent.fragments, [{ id: 0, field: 'pages/home/html', kind: 'text', before: claim }]);
  assert.equal(result.code.pages[0].html, `<main><h1>正文</h1><p>效果待补充。</p><p>${claim}</p><p class="keep">无关内容保留</p></main>`);
  assert.equal(result.code.header, code.header); assert.equal(result.code.footer, code.footer); assert.equal(result.code.css, code.css);
  assert.equal((await audit(result.code)).checks.passed, true, '修正后的候选仍经三档确定性检查');
});

for (const [name, html, target] of [
  ['非叶子容器直接正文', '<main style="color:#bbb;background:#fff">直接正文<h1 class="keep">正文</h1><p class="keep">正常子元素</p></main>', '<main'],
  ['叶子目标的只读祖先', '<main style="color:#bbb;background:#fff"><h1 class="keep">正文</h1><p>直接正文</p><p class="keep">正常子元素</p></main>', '<p>直接正文</p>'],
] as const) test(`相关 inline 声明无法写回时，模型调用前明确拒收：${name}`, async () => {
  const code = simple(''); code.pages[0].html = html;
  const checked = await audit(code), count = requests.length;
  assert.ok(checked.checks.issues.some(issue => issue.includes('对比度')));
  assert.ok(checked.checks.layoutRepairs?.some(record => record.elements.some(element => element.before.startsWith(target))));
  await assert.rejects(repair(checked.code, checked.checks), /style 属性.*(?:只读|无法写回)/);
  assert.equal(requests.length, count, '不发送不可修复的片段');
});

test('同样的短分隔符只定位低对比度的那一处，已通过的同文保留', async () => {
  const checked = await audit(simple('<span class="bad">/</span><span class="good">/</span>', '.bad{color:#bbb}.good{color:#222}'));
  const fragments = await codeRepairFragments(checked.code, checked.checks.issues, checked.checks.cleaned, [], checked.checks.layoutRepairs);
  assert.deepEqual(fragments.filter(fragment => fragment.kind === 'element').map(fragment => fragment.before), ['<span class="bad">/</span>']);
  assert.ok(!fragments.some(fragment => fragment.kind === 'css' && fragment.selector === '.good'));
});
test('实际修改变量 background 简写可通过，其他声明和 DOM 保留', async () => {
  const checked = await audit(simple('<p class="bad">浅色文字</p>', '.bad{--paper:#fff;color:#eee;background:var(--paper);padding:4px 8px}'));
  const fragments = await codeRepairFragments(checked.code, checked.checks.issues, checked.checks.cleaned, [], checked.checks.layoutRepairs);
  const background = fragments.find(fragment => fragment.kind === 'css' && fragment.selector === '.bad' && fragment.property === 'background');
  assert.ok(background, '开放作者的简写，不开放浏览器的长属性展开');
  const result = await applyCodeRepair(checked.code, fragments, { replacements: [{ fragmentId: background.id, after: '#222' }] });
  assert.deepEqual(result.pages, checked.code.pages); assert.equal(result.header, checked.code.header); assert.equal(result.footer, checked.code.footer);
  assert.match(result.css, /padding: 4px 8px/); assert.match(result.css, /color: rgb\(238, 238, 238\)/);
  assert.equal((await audit(result)).checks.passed, true);
});
for (const [name, code] of [
  ['溢出', simple('<p class="bad">实际溢出</p>', '.bad{width:1600px}')],
  ['重叠', simple('<div class="panel"><p class="first">重叠甲</p><p class="second">重叠乙</p></div>', '.panel{height:100px;position:relative}.first,.second{position:absolute;top:0;left:0}')],
] as const) test(`${name}也按本次实际节点与声明定位`, async () => {
  const checked = await audit(code);
  assert.ok(checked.checks.issues.some(issue => issue.includes(name)));
  const fragments = await codeRepairFragments(checked.code, checked.checks.issues, checked.checks.cleaned, [], checked.checks.layoutRepairs);
  assert.ok(fragments.length);
  assert.ok(fragments.every(fragment => fragment.kind !== 'style' && !fragment.before.includes('无关内容保留') && fragment.field !== 'header' && fragment.field !== 'footer'));
  assert.ok(fragments.some(fragment => fragment.kind === 'css' && (name === '溢出' ? fragment.property === 'width' : fragment.property === 'position')));
});

test('没有本次定位证据、或位置快照已变，均在模型调用前拒收', async () => {
  const code = simple('<p class="bad">原文字</p>', '.bad{color:#bbb}');
  const checked = await audit(code), count = requests.length;
  await assert.rejects(repair(code, { ...checked.checks, layoutRepairs: undefined }), /版面.*定位/);
  await assert.rejects(repair({ ...checked.code, pages: [{ ...checked.code.pages[0], html: checked.code.pages[0].html.replace('原文字', '变动文字') }] }, checked.checks), /快照|已经变化/);
  assert.equal(requests.length, count);
});

test('80 条可发送且可接收；81 条在发送前明确拒收，回复上限仍严格', async () => {
  for (const count of [80, 81]) {
    const code = simple('<p>终身保修。</p>'.repeat(count));
    const start = requests.length;
    if (count === 80) {
      const result = await repair(code, { issues: ['终身保修。'], cleaned: [] });
      assert.equal(requests.length, start + 1);
      assert.deepEqual(result.code, code);
    } else {
      await assert.rejects(repair(code, { issues: ['终身保修。'], cleaned: [] }), /81.*80.*(?:未发送|发送前)/);
      assert.equal(requests.length, start, '超限不出模型请求');
      await assert.rejects(applyCodeRepair(code, [], { replacements: Array.from({ length: 81 }, (_, fragmentId) => ({ fragmentId, after: '' })) }), /有效的局部修正/);
    }
  }
});
