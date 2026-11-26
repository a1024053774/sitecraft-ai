import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodeRun } from '../lib/code-site.ts';
import { classifyGenerateRun, deduplicateRuns, isRealModelRun } from '../scripts/audit-rejection-rates.ts';

function makeRun(overrides: Partial<CodeRun>): CodeRun {
  return {
    id: 'run-1',
    kind: 'generate',
    status: 'error',
    step: '',
    request: '生成整站',
    baseRevision: 0,
    startedAt: '2026-11-26T00:00:00Z',
    updatedAt: '2026-11-26T00:01:00Z',
    repairRound: 0,
    issues: [],
    attempts: [],
    modelCalls: [
      { purpose: 'write', model: 'gpt-6.2-sol', startedAt: '2026-11-26T00:00:00Z', latencyMs: 1000, httpStatus: 200, usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 } },
    ],
    ...overrides,
  };
}

test('T-243 isRealModelRun filters out fixture/mock stand-ins and keeps real DeepSeek/GPT runs', () => {
  assert.equal(isRealModelRun(makeRun({ modelCalls: [{ purpose: 'write', model: 'fixture', startedAt: '2026-11-26T00:00:00Z', latencyMs: 1, httpStatus: 200, usage: null }] })), false);
  assert.equal(isRealModelRun(makeRun({ modelCalls: [{ purpose: 'write', model: 'deepseek-flash', startedAt: '2026-11-26T00:00:00Z', latencyMs: 100, httpStatus: 200, usage: null }] })), true);
  assert.equal(isRealModelRun(makeRun({ modelCalls: [{ purpose: 'write', model: 'gpt-6.2-sol', startedAt: '2026-11-26T00:00:00Z', latencyMs: 100, httpStatus: 200, usage: null }] })), true);
});

test('T-243 classifyGenerateRun separates pseudo-element, visual-effect contrast, fact-protocol, identity/page, repair-scope, exhausted repairs, and provider failures', () => {
  const pseudo = classifyGenerateRun(makeRun({
    repairRound: 2,
    stage: 'repair',
    step: '局部修正版面拒因无法定位：CSS 生成文字在 [{"pageId":"home","width":768,"path":[1,1],"pseudo":"::marker"}]；当前无法核实伪元素声明修正的完整影响范围，本次拒收，不扩大到宿主或整页修改，本次未保存版本。',
    attempts: [
      { code: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>A</h1></main>' }] }, checks: { passed: false, issues: ['已去掉属性 style-placeholder'], cleaned: ['已去掉属性 style-placeholder'], checkedAt: '2026-11-26T00:00:10Z', viewports: [] } },
      { code: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>A</h1></main>' }] }, checks: { passed: false, issues: ['home/768 对比度不足或无法测量：2.（未知，需 4.5）；伪元素叠层无法核对实际底图'], cleaned: [], checkedAt: '2026-11-26T00:00:20Z', viewports: [] } },
    ],
  }));
  assert.equal(pseudo.outcome, 'deterministic-no-repair');
  assert.equal(pseudo.category, 'pseudo-element');

  const effect = classifyGenerateRun(makeRun({
    repairRound: 1,
    stage: 'repair',
    step: '局部修正版面拒因无法定位：视觉效果 filter 位于 main，当前无法核实效果声明修正的完整影响范围，本次拒收，本次未保存版本。',
  }));
  assert.equal(effect.outcome, 'deterministic-no-repair');
  assert.equal(effect.category, 'contrast-or-visual-effect');

  const factProto = classifyGenerateRun(makeRun({
    repairRound: 0,
    stage: 'check',
    step: '核对段回复格式或编号无效：s3 声明 noFacts=true 但返回了出处，本次未保存版本。',
  }));
  assert.equal(factProto.outcome, 'deterministic-no-repair');
  assert.equal(factProto.category, 'fact-protocol');

  const identity = classifyGenerateRun(makeRun({
    repairRound: 0,
    stage: 'check',
    step: '访客可见页面未出现公司全名「青禾纸包装」，本次未保存版本。',
  }));
  assert.equal(identity.outcome, 'deterministic-no-repair');
  assert.equal(identity.category, 'identity-or-page-contract');

  const scope = classifyGenerateRun(makeRun({
    repairRound: 1,
    stage: 'repair',
    step: '局部修正需要 92 个片段，超过回复上限 80，本次未发送模型请求、未保存版本。',
  }));
  assert.equal(scope.outcome, 'deterministic-no-repair');
  assert.equal(scope.category, 'repair-scope-unverifiable');

  const exhausted = classifyGenerateRun(makeRun({
    repairRound: 2,
    step: '两轮修正后仍未通过底线检查，未保存版本。请查看完整问题，补充资料或调整要求后重试。',
    attempts: [
      { code: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>A</h1></main>' }] }, checks: { passed: false, issues: ['a'], cleaned: [], checkedAt: '2026-11-26T00:00:10Z', viewports: [] } },
      { code: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>A</h1></main>' }] }, checks: { passed: false, issues: ['b'], cleaned: [], checkedAt: '2026-11-26T00:00:20Z', viewports: [] } },
      { code: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>A</h1></main>' }] }, checks: { passed: false, issues: ['c'], cleaned: [], checkedAt: '2026-11-26T00:00:30Z', viewports: [] } },
    ],
  }));
  assert.equal(exhausted.outcome, 'exhausted-repair-rounds');
  assert.equal(exhausted.category, null);

  const repairInvalid = classifyGenerateRun(makeRun({
    repairRound: 1,
    stage: 'repair',
    step: '模型未返回有效的局部修正，本次未保存版本。',
    repairFailure: { reason: '模型未返回有效的局部修正，本次未保存版本。', response: { replacements: [] } },
  }));
  assert.equal(repairInvalid.outcome, 'repair-reply-rejected');
  assert.equal(repairInvalid.category, null);

  const network = classifyGenerateRun(makeRun({
    step: '模型接口 请求失败（HTTP 502），本次未保存版本。',
    modelCalls: [{ purpose: 'write', model: 'gpt-6.2-sol', startedAt: '2026-11-26T00:00:00Z', latencyMs: 5000, httpStatus: 502, usage: null }],
  }));
  assert.equal(network.outcome, 'external-or-interrupted');
  assert.equal(network.category, null);
});

test('T-243 deduplicateRuns keeps terminal snapshot over earlier running snapshot for same run.id', () => {
  const runningSnap = {
    sourceFile: 'artifacts/a/code-site.json',
    run: makeRun({ id: 'same-run', status: 'running', step: '按方案写站点代码', updatedAt: '2026-11-26T00:00:05Z' }),
  };
  const finalSnap = {
    sourceFile: '.sitecraft-data/code-sites/s1.json',
    run: makeRun({ id: 'same-run', status: 'complete', step: '版本 1 已保存，底线检查通过。', updatedAt: '2026-11-26T00:02:00Z' }),
  };
  const deduped = deduplicateRuns([runningSnap, finalSnap]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].run.status, 'complete');
});
