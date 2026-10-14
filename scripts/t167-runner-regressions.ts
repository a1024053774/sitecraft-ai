import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Run separately from the full suite: these cases own the real npm test entry
// and its dev server. They cannot share the full suite's live Next dev lock.
const project = fileURLToPath(new URL('../', import.meta.url));
async function run(args: string[], context: string | undefined) {
  const env: NodeJS.ProcessEnv = { ...process.env, DEEPSEEK_API_KEY: '', AI_API_KEY: '' };
  if (context === undefined) delete env.NODE_TEST_CONTEXT; else env.NODE_TEST_CONTEXT = context;
  const child = spawn('npm', ['test', '--', ...args], { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const completed = once(child, 'exit'); let output = '';
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await completed;
  const out = path.join(project, 'artifacts/t167', `runner-regression-${crypto.randomUUID()}`);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'output.log'), output, 'utf8');
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ at: new Date().toISOString(), args, context, code }, null, 2) + '\n', 'utf8');
  const match = output.match(/证据目录：([^\n]+)\n/);
  assert.ok(match, output);
  const report = JSON.parse(await readFile(path.join(match[1], 'report.json'), 'utf8'));
  return { output, code, out, report };
}

test('T-167 P2: inherited NODE_TEST_CONTEXT cannot silently skip the real test entry', async t => {
  const result = await run(['tests/conversation-store.test.ts'], 'child-v8');
  t.diagnostic(`保留证据：${result.out}`);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /creates a conversation, persists a turn, and rereads the same turns/, '真实业务用例必须执行');
  assert.doesNotMatch(result.output, /skipping running files/);
  assert.ok(result.report.executed > 0, '实际执行数必须有独立的 Node 统计');
  assert.equal(result.report.status, 'PASS');
});

test('T-167 P2: no matching test bodies must fail even when Node counts a file wrapper', async t => {
  const result = await run(['--test-name-pattern=^t167-no-matching-case$', 'tests/conversation-store.test.ts'], undefined);
  t.diagnostic(`保留证据：${result.out}`);
  assert.notEqual(result.code, 0, '没有实际执行用例的结果不得报通过');
  assert.match(result.output, /零用例/);
  assert.equal(result.report.executed, 0);
  assert.notEqual(result.report.status, 'PASS');
});
