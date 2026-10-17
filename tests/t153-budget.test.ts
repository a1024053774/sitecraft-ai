import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { reserveRequest } from '../scripts/t153-real-budget.ts';
// Failure modes: a full output cap ignores prior spend; insufficient funds or
// invalid counters still authorize a call. T-165 covers real input counts.
test('cumulative authorization reserves input and bounds output before a call', () => {
  const body = { messages: [{ role: 'user', content: '资料：齿轮 G8。' }], max_tokens: 65536 };
  const reservation = reserveRequest(body, 270000, 300000);
  assert.ok(Number.isSafeInteger(reservation.inputUpper) && reservation.inputUpper > 0);
  assert.ok(reservation.outputLimit < 30000);
  assert.ok(270000 + reservation.reserved <= 300000);
  assert.equal(reservation.reserved, reservation.inputUpper + reservation.outputLimit);
  assert.throws(() => reserveRequest(body, 299999, 300000), /Remaining authorization/);
  assert.throws(() => reserveRequest(body, -1, 300000));
});

// T-154/T-155 authorization is lower than the historic T-153 budget. A caller
// must never get the old allowance when it explicitly supplies the new cap.
test('the explicit 120000 authorization cannot borrow the historical 300000 budget', () => {
  const body = { messages: [{ role: 'user', content: '资料：接头交期必须按样品确认起算。' }], max_tokens: 65536 };
  const reserve = (spent: number, limit?: number) => Reflect.apply(reserveRequest, undefined, [body, spent, limit]);
  const request = reserve(90000, 120000);
  assert.ok(90000 + request.reserved <= 120000, 'reservation must fit the authorization actually supplied');
  assert.throws(() => reserve(119999, 120000), /Remaining authorization/);
  assert.throws(() => reserve(0), /authorization|limit/i);
});

for (const [ticket, limit] of [['t158', 300000], ['t159', 70000], ['t160', 150000], ['t162', 35000], ['t174', 30000]] as const) test(`the real gateway starts in ${ticket} and stops an over-budget round before any upstream call`, async () => {
  assert.ok(process.env.SITECRAFT_BASE);
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(probe.address() as { port: number }).port}`;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const folder = path.resolve('artifacts', ticket, `budget-contract-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/t153-real-budget.ts'], {
    env: { ...process.env, SITECRAFT_BUDGET_BASE: endpoint, SITECRAFT_TOKEN_LIMIT: String(limit), T153_BUDGET_DIR: folder,
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com', DEEPSEEK_MODEL: 'deepseek-flash', DEEPSEEK_API_KEY: 'not-a-real-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise<void>(resolve => child.once('close', () => resolve()));
  let output = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(output)), 10000);
      child.stdout.on('data', data => { output += data; if (output.includes('approved cumulative budget')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', data => { output += data; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
    });
    const initial = await (await fetch(`${endpoint}/status`)).json();
    assert.equal(initial.limit, limit); assert.equal(initial.spent, 0);
    // This request cannot reach the provider. Its estimate exceeds the approval.
    const denied = await fetch(`${endpoint}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'default', estimate: limit + 1 }) });
    assert.equal(denied.status, 502);
    const ledger = JSON.parse(await readFile(path.join(folder, 'usage.json'), 'utf8'));
    assert.equal(ledger.stopped, true); assert.equal(ledger.spent, 0);
    assert.deepEqual(ledger.calls, []); assert.deepEqual(ledger.rounds, []);
    assert.match(ledger.stopReason, /exceeds the cumulative approved budget/);
    const stopped = await fetch(`${endpoint}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'default', estimate: 1 }) });
    assert.equal(stopped.status, 409);
  } finally { if (child.exitCode === null) child.kill('SIGTERM'); await exited; }
});
