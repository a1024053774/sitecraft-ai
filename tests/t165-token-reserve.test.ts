import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { reserveRequest } from '../scripts/t153-real-budget.ts';
import { localEndpoint } from '../scripts/local-endpoint.ts';

type Sample = { body: Record<string, any>; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
const names = ['t153-approved', 't153-joint', 't158', 't160', 't160-edu', 't162'];
const sets: Sample[][] = await Promise.all(names.map(async name => JSON.parse(await readFile(new URL(`./fixtures/t165/${name}.json`, import.meta.url), 'utf8'))));
const paper = sets.at(-1)!;
const blocked = JSON.parse(await readFile(new URL('./fixtures/t165/t160-blocked.json', import.meta.url), 'utf8'));

// Failure modes: byte reservation rejects an affordable repair/local edit;
// estimates miss actual input or tools/Unicode; prior spend is ignored; a paid
// overrun disappears or authorizes another call. Oracles are recorded provider
// usage and the original 150000/15000 authorizations, not estimator outputs.
test('T-160 rejected education repair fits its original remaining authorization', () => {
  const result = reserveRequest(blocked.body, 98490, 150000);
  assert.ok(result.outputLimit >= 4096);
  assert.ok(98490 + result.reserved <= 150000);
});

test('both T-162 paper requests fit 15000 even when the first consumes its full reservation', () => {
  const first = reserveRequest(paper[0].body, 0, 15000);
  assert.equal(first.outputLimit, 6144, 'keep the requested local-edit output');
  const second = reserveRequest(paper[1].body, first.reserved, 15000);
  assert.equal(second.outputLimit, 4096, 'keep the requested local-fact output');
  assert.ok(first.reserved + second.reserved <= 15000);
});

test('all 34 recorded provider prompt counts remain covered', () => {
  assert.equal(sets.flat().length, 34);
  for (const [setIndex, samples] of sets.entries()) for (const [index, sample] of samples.entries()) {
    const result = reserveRequest(sample.body, 0, 300000);
    assert.ok(result.inputUpper >= sample.usage.prompt_tokens, `${names[setIndex]}/${index + 1}: input must cover reported prompt_tokens, including cached input`);
    assert.ok(result.outputLimit <= sample.body.max_tokens);
    assert.ok(result.reserved <= 300000);
  }
});

test('an unaffordable request is still refused; mixed scripts and tool schemas count toward input', () => {
  assert.throws(() => reserveRequest(paper[0].body, 14999, 15000), /Remaining authorization/);
  const body = { max_tokens: 4096, messages: [{ role: 'user', content: 'A'.repeat(2000) }] };
  const ascii = reserveRequest(body, 0, 300000).inputUpper;
  for (const text of ['汉'.repeat(2000), 'カ'.repeat(2000), '한'.repeat(2000), '😀'.repeat(2000)]) {
    assert.ok(reserveRequest({ ...body, messages: [{ role: 'user', content: text }] }, 0, 300000).inputUpper > ascii);
  }
  const tools = [{ type: 'function', function: { name: 'submit', parameters: { description: '复杂资料条件'.repeat(1000) } } }];
  assert.ok(reserveRequest({ ...body, tools }, 0, 300000).inputUpper > ascii);
});

async function gateway(limit: number, usage: Sample['usage'][]) {
  localEndpoint('SITECRAFT_BASE');
  const requests: Record<string, any>[] = [];
  const upstream = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    requests.push(JSON.parse(raw));
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }], usage: usage[requests.length - 1] }));
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const fixture = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(probe.address() as { port: number }).port}`;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  // The directory whitelist stays unchanged; this is a T-160 budget replay.
  const folder = path.resolve('artifacts/t160', `t165-budget-${crypto.randomUUID()}`);
  const child = spawn(process.execPath, ['--experimental-strip-types', '--import', './tests/fixtures/t165-upstream.mjs', 'scripts/t153-real-budget.ts'], {
    env: { ...process.env, SITECRAFT_FIXTURE_BASE: fixture, SITECRAFT_BUDGET_BASE: base, SITECRAFT_TOKEN_LIMIT: String(limit), T153_BUDGET_DIR: folder,
      DEEPSEEK_API_KEY: 'local-intercept-only', DEEPSEEK_MODEL: 'deepseek-flash', DEEPSEEK_BASE_URL: 'https://api.deepseek.com' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'close');
  let output = '';
  const close = async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(output || 'gateway startup timed out')), 10000);
      child.stdout.on('data', data => { output += data; if (output.includes('approved cumulative budget')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', data => { output += data; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
    });
    const post = (url: string, body: unknown) => fetch(`${base}${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/round', { label: 'default', estimate: limit })).status, 200);
    return { post, requests, close, ledger: async () => JSON.parse(await readFile(path.join(folder, 'usage.json'), 'utf8')) };
  } catch (error) { await close(); throw error; }
}

test('the real gateway completes both recorded paper calls and refuses the next unaffordable input before HTTP', async () => {
  const running = await gateway(15000, paper.map(sample => sample.usage));
  try {
    for (const sample of paper) assert.equal((await running.post('/chat/completions', sample.body)).status, 200);
    const paid = await running.ledger();
    assert.equal(paid.spent, 3253);
    assert.equal(paid.stopped, false);
    assert.equal(running.requests.length, 2);
    assert.deepEqual(running.requests.map(body => body.max_tokens), [6144, 4096]);
    assert.deepEqual(paid.calls.map((call: any) => call.usage), paper.map(sample => sample.usage));
    assert.equal((await running.post('/chat/completions', { ...paper[0].body, messages: [{ role: 'system', content: '汉'.repeat(20000) }] })).status, 502);
    const stopped = await running.ledger();
    assert.equal(stopped.spent, 3253);
    assert.equal(stopped.stopped, true);
    assert.equal(stopped.calls.length, 2);
    assert.equal(running.requests.length, 2, 'refusal must occur before provider HTTP');
  } finally { await running.close(); }
});

for (const [name, usage, reason] of [
  ['input estimate', { prompt_tokens: 100000, completion_tokens: 1, total_tokens: 100001 }, /Input exceeded/],
  ['authorization', { prompt_tokens: 1132, completion_tokens: 119000, total_tokens: 120132 }, /Reported usage exceeded/],
] as const) test(`the real gateway retains billed ${name} overrun and stops all further calls`, async () => {
  const running = await gateway(120000, [usage]);
  try {
    assert.equal((await running.post('/chat/completions', paper[0].body)).status, 502);
    const ledger = await running.ledger();
    assert.equal(ledger.spent, usage.total_tokens);
    assert.deepEqual(ledger.calls[0].usage, usage);
    assert.equal(ledger.calls[0].state, 'failed');
    assert.match(ledger.calls[0].error, reason);
    assert.equal(ledger.stopped, true);
    assert.equal((await running.post('/chat/completions', paper[1].body)).status, 409);
    assert.equal(running.requests.length, 1);
  } finally { await running.close(); }
});
