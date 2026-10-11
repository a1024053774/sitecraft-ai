import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { localEndpoint } from '../scripts/local-endpoint.ts';

// Failure modes: a script pins a worktree port, silently defaults to another
// workspace, accepts a public/wildcard host, loses the configured fixture port,
// or binds an HTTP fixture to a URL it cannot actually serve.
test('t15 scripts have no fixed local ports and t15 tests have no default application origin', async () => {
  const failures: string[] = [];
  for (const filename of await readdir('scripts')) {
    if (!/^t15\d.*\.(ts|mjs)$/.test(filename)) continue;
    const code = await readFile(`scripts/${filename}`, 'utf8');
    if (/http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):\d+|\.listen\(\s*[1-9]\d*/.test(code)) failures.push(filename);
    if (/process\.env\.SITECRAFT_BASE\s*(?:\|\||\?\?)/.test(code)) failures.push(`${filename}: implicit application origin`);
  }
  for (const filename of await readdir('tests')) {
    if (!/^t15\d.*\.test\.ts$/.test(filename)) continue;
    if (/process\.env\.SITECRAFT_BASE\s*(?:\|\||\?\?)/.test(await readFile(`tests/${filename}`, 'utf8'))) failures.push(`${filename}: implicit application origin`);
  }
  assert.deepEqual(failures, [], 'All t15 entry points must honor explicit local configuration');
});

test('explicit endpoints preserve the selected port and reject remote or ambiguous origins', () => {
  for (const name of ['SITECRAFT_BASE', 'SITECRAFT_FIXTURE_BASE', 'SITECRAFT_BUDGET_BASE'] as const) {
    const original = process.env[name];
    try {
      for (const [value, origin, hostname, port] of [
        ['http://127.0.0.1:3170/', 'http://127.0.0.1:3170', '127.0.0.1', 3170],
        ['http://127.0.0.1:3173', 'http://127.0.0.1:3173', '127.0.0.1', 3173],
        ['http://localhost:41827', 'http://localhost:41827', 'localhost', 41827],
        ['http://[::1]:41991/', 'http://[::1]:41991', '::1', 41991],
      ] as const) {
        process.env[name] = value;
        assert.deepEqual(localEndpoint(name), { origin, hostname, port });
      }
      for (const value of [undefined, '', 'not-a-url', 'https://api.deepseek.com', 'http://example.com:3173',
        'http://0.0.0.0:3173', 'https://localhost:3173', 'http://localhost:0', 'http://user:secret@localhost:3173',
        'http://localhost:3173/api', 'http://localhost:3173?other=1', 'http://localhost:3173#other']) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
        assert.throws(() => localEndpoint(name), new RegExp(name));
      }
    } finally { if (original === undefined) delete process.env[name]; else process.env[name] = original; }
  }
});

test('both model fixture CLIs serve the configured origin, without a real provider', async () => {
  assert.ok(process.env.SITECRAFT_BASE, 'The caller must set SITECRAFT_BASE');
  for (const script of ['scripts/t152-model-fixture.ts', 'scripts/t153-model-fixture.ts']) {
    const probe = createServer();
    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
    const address = probe.address(); assert.ok(address && typeof address === 'object');
    const fixture = `http://127.0.0.1:${address.port}`;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    const child = spawn(process.execPath, ['--experimental-strip-types', script], {
      env: { ...process.env, SITECRAFT_FIXTURE_BASE: fixture }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exit = once(child, 'exit'); let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Fixture did not start: ${output}`)), 10000);
        child.stdout.on('data', () => { if (output.includes('Local-only provider')) { clearTimeout(timer); resolve(); } });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('exit', () => { clearTimeout(timer); reject(new Error(`Fixture exited: ${output}`)); });
      });
      const result = await new Promise<{ status?: number; body: any }>((resolve, reject) => {
        const req = request(`${fixture}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' } }, res => {
          let raw = ''; res.on('data', chunk => { raw += chunk; });
          res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch (error) { reject(error); } });
        });
        req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Fixture response timed out')));
        req.end(JSON.stringify({ messages: [{ role: 'system', content: '事实校对员' }, { role: 'user', content: '测试资料' }] }));
      });
      assert.equal(result.status, 200);
      assert.deepEqual(JSON.parse(result.body.choices[0].message.content), { issues: [] });
    } finally { if (child.exitCode === null) child.kill('SIGTERM'); await exit; }
  }
});
