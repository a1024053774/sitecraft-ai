import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// Risks: wrong side counts, a plan published after a read, budget growth during
// reading, forgetting the shared cap, or accepting a failed focus/force/read.
// Counts and expected milliseconds below come from the owner's formula and
// authored DOM, not from the implementation's result.
const browserUrl = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
const diagnosticUrl = pathToFileURL(path.resolve('lib/code-check-diagnostics.ts')).href;
const nativeNow = Date.now;
// Independently worked examples of the owner's 2026-10-18 formula:
// max(5000, 1000 + 300 * reads). Do not import the production calculator.
const expectedBudgets = new Map([[2, 5000], [10, 5000], [14, 5200], [18, 6400],
  [26, 8800], [30, 10000], [82, 25600], [402, 121600]]);
let state: any;
(globalThis as any).__t178BudgetDiagnostic = (record: any) => {
  if (record.kind === 'dynamic-plan') {
    const index = state.plans.length;
    const remaining = 60000 - state.spent;
    const fullReads = 2 + 4 * (state.sourceElements + state.candidateElements);
    const calculatedMs = expectedBudgets.get(fullReads);
    assert.notEqual(calculatedMs, undefined, '每个输入都须有事先按需求算好的期望');
    const budget = { sourceReads: 1 + state.sourceElements * 4, candidateReads: 1 + state.candidateElements * 4,
      fullReads, calculatedMs,
      allowedMs: Math.min(calculatedMs!, remaining), pageRemainingMs: remaining };
    assert.deepEqual(record.budget, budget, '读取前的预算须按两侧真实元素和三档剩余额度计算');
    state.liveBudgets.push(record.budget);
    state.plans.push({ ...structuredClone(record), index });
    state.events.push({ kind: 'plan', index, budget });
  }
};
(globalThis as any).__t178BudgetBrowser = (root: any) => {
  const side = state.browsers++;
  const wrap = (page: any): any => ({ ...page, async send(method: string, params: any) {
    if (state.fault === 'focus' && method === 'DOM.focus') throw new Error('故意拒绝聚焦');
    if (state.fault === 'force' && method === 'CSS.forcePseudoState') throw new Error('故意拒绝强制状态');
    return page.send(method, params);
  }, async evaluate(expression: string) {
    if (expression.includes('const readStarted=performance.now()')) {
      const plan = state.plans.at(-1);
      assert.ok(plan, '任何完整读取之前必须先记录两侧读取次数及预算');
      assert.deepEqual(state.liveBudgets[plan.index], plan.budget, '每次读取之前，已公布的计划都不能增加或改变');
      state.events.push({ kind: 'read', side, plan: plan.index, budget: structuredClone(plan.budget) });
      if (!state.advanced.has(plan.index)) {
        state.advanced.add(plan.index);
        const delta = state.advance === 'boundary' ? plan.budget.allowedMs
          : state.advance === 'over' ? plan.budget.allowedMs + 1
          : state.advance === 'cap-tight' || state.advance === 'cap-tight-over'
            ? [30000, 29000, state.advance === 'cap-tight-over' ? 1001 : 1000][plan.index]
          : state.advance === 'restaurant-cap' || state.advance === 'restaurant-cap-over'
            ? [25600, 25600, state.advance === 'restaurant-cap-over' ? 8801 : 8800][plan.index]
          : state.advance === 'cap-over' && plan.index === 2 ? 20001
          : state.advance === 'cap' || state.advance === 'cap-over' ? 20000 : 0;
        state.clock += delta; state.spent += delta;
      }
    }
    return page.evaluate(expression);
  }, ...(page.createContext ? { async createContext() { return wrap(await page.createContext()); } } : {}) });
  return wrap(root);
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const file = path.resolve(specifier.slice(2));
    specifier = pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href;
  }
  const resolved = next(specifier, context);
  if (resolved.url === browserUrl) return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
    'import {codeCheckBrowser as real} from ' + JSON.stringify(browserUrl + '?budget-test') + ';' +
    'export async function codeCheckBrowser(){return globalThis.__t178BudgetBrowser(await real())}'
  ) };
  if (resolved.url === diagnosticUrl) return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
    'import {recordCheckDiagnostic as real} from ' + JSON.stringify(diagnosticUrl + '?budget-test') + ';' +
    'export function recordCheckDiagnostic(record){globalThis.__t178BudgetDiagnostic(record);real(record)}'
  ) };
  return resolved;
} });
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const output = `artifacts/t178/read-budget-${nativeNow()}-${process.pid}`;
await mkdir(output, { recursive: true });
const observations: any[] = [];
test.after(() => writeFile(`${output}/observations.json`, JSON.stringify(observations, null, 2) + '\n', 'utf8'));

async function run(sourceElements: number, candidateElements: number, advance = '', fault = '') {
  state = { sourceElements, candidateElements, advance, fault, clock: nativeNow(), spent: 0, browsers: 0,
    plans: [], liveBudgets: [], events: [], advanced: new Set() };
  Date.now = () => state.clock;
  const code = (count: number) => ({ header: '', footer: '',
    css: 'body{margin:0;color:#111;background:white;font:16px/1.6 Arial}a{display:inline-block;padding:2px}section:hover{color:inherit}',
    pages: [{ id: 'home', title: '说明', html: `<main><section><h1>说明</h1><p>介绍</p>${'<a href="#outside">入口</a>'.repeat(count)}</section><p id="outside">外部</p></main>` }] });
  try {
    const result = await checkSiteCode({ siteId: 't178-budget', code: code(candidateElements), materials: '说明 介绍 入口 外部',
      images: [], legacyImport: true, localEdit: { source: code(sourceElements), target: {
        kind: 'dom', versionId: 't178-parent', pageId: 'home', path: [0], label: '说明', text: '说明介绍' + '入口'.repeat(sourceElements) } } });
    assert.deepEqual(result.checks.issues, []);
    assert.equal(result.checks.passed, true);
    assert.equal(state.plans.length, 3);
    for (const plan of state.plans) {
      const reads = state.events.filter((event: any) => event.kind === 'read' && event.plan === plan.index);
      assert.equal(reads.length, plan.budget.fullReads, '执行次数须与读取前固定计划相同');
      assert.ok(reads.every((event: any) => JSON.stringify(event.budget) === JSON.stringify(plan.budget)), '读取途中计划不得增长');
      for (const [side, expected] of [[0, plan.budget.sourceReads], [1, plan.budget.candidateReads]])
        assert.equal(reads.filter((event: any) => event.side === side).length, expected);
      assert.deepEqual((result.checks.viewports.find(viewport => viewport.width === plan.width)?.dynamicState as any)?.budget, plan.budget);
    }
  } finally {
    observations.push({ sourceElements, candidateElements, advance, fault, plans: state.plans, events: state.events });
    Date.now = nativeNow;
  }
}

for (const [source, candidate] of [[0, 0], [1, 2], [3, 1], [3, 3], [3, 4], [10, 10]])
  test(`五秒下限或按次数预算，读取前固定次数：源 ${source}、候选 ${candidate}`, () => run(source, candidate));
test('每档刚好在计算预算边界内仍通过，超过一毫秒即拒收', async () => {
  await run(10, 10, 'boundary');
  await assert.rejects(run(10, 10, 'over'), /动态状态检查超时/);
});
test('82 次读取每档 25.6 秒，第三档只剩 8.8 秒时总封顶先到必须拒收越限', async () => {
  await run(10, 10, 'restaurant-cap');
  assert.deepEqual(state.plans.map((plan: any) => plan.budget.allowedMs), [25600, 25600, 8800]);
  await assert.rejects(run(10, 10, 'restaurant-cap-over'), /动态状态检查超时/);
  assert.equal(state.plans[2].budget.calculatedMs, 25600);
  assert.equal(state.plans[2].budget.allowedMs, 8800);
});
test('三档恰好六十秒仍通过，总计超过一毫秒即拒收，单档也不超过剩余总额', async () => {
  await run(50, 50, 'cap');
  await assert.rejects(run(50, 50, 'cap-over'), /动态状态检查超时/);
});
test('总额只剩一秒时优先遵守六十秒封顶，不能用五秒下限突破总额', async () => {
  await run(50, 50, 'cap-tight');
  await assert.rejects(run(50, 50, 'cap-tight-over'), /动态状态检查超时/);
});
for (const fault of ['focus', 'force']) test(`计数后${fault === 'focus' ? '聚焦' : '强制状态'}失败仍拒收，正常对照通过`, async () => {
  await run(1, 1);
  await assert.rejects(run(1, 1, '', fault), fault === 'focus' ? /无法聚焦/ : /无法强制/);
});
