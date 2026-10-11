import assert from 'node:assert/strict';
import test from 'node:test';
import { reserveRequest } from '../scripts/t153-real-budget.ts';
// Failure modes: a full output cap ignores prior spend; Chinese request cost is
// counted as ASCII; insufficient funds or invalid counters still authorize a call.
test('cumulative authorization reserves input and bounds output before a call', () => {
  const body = { messages: [{ role: 'user', content: '资料：齿轮 G8。' }], max_tokens: 65536 };
  const reservation = reserveRequest(body, 270000);
  assert.ok(reservation.inputUpper >= Buffer.byteLength(JSON.stringify(body), 'utf8'));
  assert.ok(reservation.outputLimit < 30000);
  assert.ok(270000 + reservation.reserved <= 300000);
  assert.equal(reservation.reserved, reservation.inputUpper + reservation.outputLimit);
  assert.throws(() => reserveRequest(body, 299999), /Remaining authorization/);
  assert.throws(() => reserveRequest(body, -1));
});
