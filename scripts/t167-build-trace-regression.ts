import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The caller supplies the actual project containing the artifact tree. Do not
// copy source/dependencies or remove inputs to make this build pass.
assert.equal(process.argv[2], '--project', '显式提供 --project <待构建项目根目录>');
assert.ok(process.argv[3] && process.argv.length === 4);
const project = path.resolve(process.argv[3]);
assert.ok((await stat(path.join(project, 'artifacts'))).isDirectory());
const output = path.resolve('artifacts/t167', 'build-trace-' + crypto.randomUUID());
await mkdir(output, { recursive: true });
const env: NodeJS.ProcessEnv = { ...process.env, SITE_STORE: 'fs' };
delete env.NODE_TEST_CONTEXT; delete env.SITECRAFT_TEST_DIST_DIR;
const child = spawn('npm', ['run', 'build'], { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
const completed = once(child, 'exit'); let logs = '';
child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
const [code, signal] = await completed;
await writeFile(path.join(output, 'build.log'), logs, 'utf8');
await writeFile(path.join(output, 'report.json'), JSON.stringify({ at: new Date().toISOString(),
  command: ['node', '--experimental-strip-types', 'scripts/t167-build-trace-regression.ts', '--project', project],
  project, code, signal }, null, 2) + '\n', 'utf8');
console.log('构建追踪证据：' + output);
assert.equal(code, 0, `构建失败，原始日志：${path.join(output, 'build.log')}`);
