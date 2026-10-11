import assert from 'node:assert/strict';
import test from 'node:test';
import { reserveRequest } from '../scripts/t153-real-budget.ts';
// Failure modes: a full output cap ignores prior spend; Chinese request cost is
// counted as ASCII; insufficient funds or invalid counters still authorize a call.
test('cumulative authorization reserves input and bounds output before a call', () => {
  const body = { messages: [{ role: 'user', content: '资料：齿轮 G8。' }], max_tokens: 65536 };
  const reservation = reserveRequest(body, 270000, 300000);
  assert.ok(reservation.inputUpper >= Buffer.byteLength(JSON.stringify(body), 'utf8'));
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
