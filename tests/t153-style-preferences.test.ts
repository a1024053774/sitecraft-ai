import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Contract failure modes: style IDs drift between UI/schema/prompt; an unknown
// style is accepted or silently becomes precision; slider bands only send numbers,
// cross a boundary early, or discard facts; previews have no real source.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
let style = 'precision';
const wires: any[] = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); wires.push(body);
  const plan = { summary: '展示齿轮产品与加工边界。', style, styleReason: '依据现有产品参数。', skeletonId: 'custom', skeletonReason: '产品参数为主。', pages: [{ id: 'home', title: '首页', outline: ['产品参数'] }] };
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ type: 'function', id: 'fixture', function: { name: 'submit_page_plan', arguments: JSON.stringify(plan) } }] } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY = 'local-fixture'; process.env.DEEPSEEK_MODEL = 'local-fixture';
const { planSiteCode } = await import('../lib/code-site-model.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));

test('the planning contract offers only the three approved directions and loads the selected short skill', async () => {
  style = 'precision';
  await planSiteCode('齿轮资料', { style: 'auto', layout: 5, density: 6 }, '规划');
  assert.deepEqual(wires.at(-1).tools[0].function.parameters.properties.style.enum, ['precision', 'documentary', 'editorial']);
  for (const chosen of ['editorial', 'neighborly']) {
    style = chosen;
    const result = await planSiteCode('齿轮资料', { style: chosen as any, layout: 5, density: 6 }, '规划');
    assert.equal(result.plan.style, chosen);
    const rules = wires.at(-1).messages[0].content;
    assert.match(rules, new RegExp(`name: site-code-${chosen}`));
    assert.doesNotMatch(rules, /name: site-code-precision/);
  }
});

test('each slider band gives observable layout/density instructions and preserves every fact', async () => {
  style = 'precision';
  for (const [value, layout, density] of [
    [1, /共享对齐轴/, /每组只突出一个/], [3, /共享对齐轴/, /每组只突出一个/],
    [4, /主次栏/, /相关参数集中/], [7, /主次栏/, /相关参数集中/],
    [8, /不对称/, /紧凑表格/], [10, /不对称/, /紧凑表格/],
  ] as const) {
    await planSiteCode('型号 G8；不适用腐蚀工况；范围待补充。', { style: 'precision', layout: value, density: value }, '规划');
    const rules = wires.at(-1).messages[0].content;
    assert.match(rules, layout); assert.match(rules, density);
    assert.match(rules, /不增删.*事实/); assert.match(rules, /单位.*条件.*否定/);
  }
  for (const [layout, density, layoutRule, densityRule] of [[2, 9, /共享对齐轴/, /紧凑表格/], [9, 2, /不对称/, /每组只突出一个/]] as const) {
    await planSiteCode('型号 G8；不适用腐蚀工况。', { style: 'precision', layout, density }, '规划');
    const rules = wires.at(-1).messages[0].content;
    assert.match(rules, layoutRule); assert.match(rules, densityRule);
  }
});

test('unknown preferences are rejected before the provider and unregistered auto output is rejected', async () => {
  style = 'precision'; const before = wires.length;
  await assert.rejects(planSiteCode('齿轮资料', { style: 'unregistered' as any, layout: 5, density: 6 }, '规划'));
  assert.equal(wires.length, before);
  style = 'unregistered';
  await assert.rejects(planSiteCode('齿轮资料', { style: 'auto', layout: 5, density: 6 }, '规划'), /大纲格式/);
});

test('all offered directions have registered real WebP previews', async () => {
  assert.ok(existsSync('lib/code-site-styles.ts'), 'one style catalog must exist');
  const { codeStyles, codeStyleOptions } = await import('../lib/code-site-styles.ts');
  assert.deepEqual(Object.keys(codeStyles), ['precision', 'documentary', 'editorial', 'neighborly']);
  assert.deepEqual(codeStyleOptions.map(option => option.id), ['auto', 'precision', 'documentary', 'editorial'], '未验证候选不能出现在用户风格选项');
  for (const id of ['precision', 'documentary', 'editorial'] as const) {
    const preview = codeStyles[id].preview;
    assert.equal(preview.status, 'ready');
    if (preview.status !== 'ready') throw new Error('missing preview');
    assert.ok(preview.siteId && preview.versionId && preview.source && preview.license);
    assert.ok(preview.revision > 0);
    assert.ok((await readFile(`public${preview.src}`)).length > 0);
  }
});

test('the deferred industrial candidate has no selectable option, accepted input or runtime skill', async () => {
  const { codeStyleOptions, codePreferencesSchema } = await import('../lib/code-site-styles.ts');
  assert.equal(codeStyleOptions.some(option => option.id === 'industrial'), false);
  assert.equal(codePreferencesSchema.safeParse({ style: 'industrial', layout: 5, density: 6 }).success, false);
  assert.equal(existsSync('skills/site-code-industrial/SKILL.md'), false);
});
