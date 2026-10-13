import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { localEndpoint } from './local-endpoint.ts';

// The caller owns this workspace while running the six sequential mutations.
// Original source stays in memory, not in an evidence copy. Each finally block
// restores only the mutated clause and retains unrelated changes to the file.
localEndpoint('SITECRAFT_BASE');
const file = 'components/code-workspace.tsx';
const directory = `artifacts/t162/review-counterfactual-${Date.now()}`;
await mkdir(directory);
const readClause = [
  '    try {',
  '      const saved = localStorage.getItem(`sitecraft-selection:${siteId}`);',
  '      if (saved) { const parsed = annotationTargetSchema.safeParse(JSON.parse(saved));',
  '        if (parsed.success && parsed.data.versionId === initial.codeSite.currentVersionId) { setSelectedTarget(parsed.data); setPage(parsed.data.pageId); }',
  '      }',
  "    } catch { setError('浏览器无法读取点选记录，请重新点选；当前操作仍可继续。'); }",
].join('\n');
const writeClause = [
  '    try {',
  '      if (valid && selectedTarget) localStorage.setItem(`sitecraft-selection:${siteId}`, JSON.stringify(selectedTarget));',
  '      else localStorage.removeItem(`sitecraft-selection:${siteId}`);',
  "    } catch { setError('浏览器无法保存点选记录，当前点选仍可使用；刷新后请重新点选。'); }",
].join('\n');
const mutations: Array<{ id: string; pattern: string; storageCase?: string; before: string; after: string; reason: RegExp }> = [
  { id: 'history-send', pattern: 'Astra P1', before: "    if (previewVersionId) { setError('正在回看历史版本，请回到当前版本并重新点选后再修改。'); return; }", after: '    // T-162 counterfactual: omit historical send guard.', reason: /历史回看不得发送整页或当前版本的编辑请求/ },
  { id: 'history-buttons', pattern: 'Astra P1', before: '].map(([text, prompt]) => <button key={text} type="button" disabled={busy || conversationUnavailable || !!previewVersionId}', after: '].map(([text, prompt]) => <button key={text} type="button" disabled={busy || conversationUnavailable /* T-162 counterfactual: enable historical shortcuts */}', reason: /历史回看期间四个快捷按钮均停用/ },
  { id: 'focus', pattern: 'Astra P2', before: "  useEffect(() => {\n    if (composer && !composer.thread) annotationInput.current?.focus();\n  }, [composer]);", after: '  // T-162 counterfactual: omit target-change focus.', reason: /目标切换必须把焦点交回意见框/ },
  { id: 'selection-read', pattern: 'Astra P3', storageCase: 'getItem', before: readClause, after: '    // T-162 counterfactual: unprotected selection read.\n' + readClause.split('\n').slice(1, -1).join('\n'), reason: /工作台存在未捕获错误：.*存储拒绝：getItem/ },
  ...['setItem', 'removeItem'].map(method => ({ id: `selection-${method}`, pattern: 'Astra P3', storageCase: method, before: writeClause,
    after: `    // T-162 counterfactual: unprotected selection ${method}.\n` + writeClause.split('\n').slice(1, -1).join('\n'), reason: new RegExp(`工作台存在未捕获错误：.*存储拒绝：${method}`) })),
];
const results: unknown[] = [];
for (const mutation of mutations) {
  const source = await readFile(file, 'utf8');
  assert.equal(source.split(mutation.before).length - 1, 1, `修复片段须唯一：${mutation.id}`);
  await writeFile(file, source.replace(mutation.before, mutation.after), 'utf8');
  try {
    const command = ['--test', '--experimental-strip-types', `--test-name-pattern=${mutation.pattern}`, 'tests/t162-review-regressions.test.ts'];
    const child = spawn(process.execPath, command, { env: { ...process.env, T162_LABEL: `mutant-${mutation.id}`, ...(mutation.storageCase ? { T162_STORAGE_CASE: mutation.storageCase } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    await writeFile(`${directory}/${mutation.id}.log`, log, 'utf8');
    assert.equal(code, 1, `回退 ${mutation.id} 应被回归拒绝`);
    assert.match(log, mutation.reason, `回退 ${mutation.id} 必须因对应行为失败，不能把设置或超时错误算作红态`);
    results.push({ id: mutation.id, command: [process.execPath, ...command], storageCase: mutation.storageCase, exitCode: code, status: 'RED', finishedAt: new Date().toISOString() });
    console.log(`RED ${mutation.id}；${directory}/${mutation.id}.log`);
  } finally {
    const current = await readFile(file, 'utf8');
    assert.equal(current.split(mutation.after).length - 1, 1, `变异片段须完整，避免覆盖其他编辑：${mutation.id}`);
    await writeFile(file, current.replace(mutation.after, mutation.before), 'utf8');
    await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2), 'utf8');
  }
}
console.log(`已逐项恢复修复；${directory}`);
