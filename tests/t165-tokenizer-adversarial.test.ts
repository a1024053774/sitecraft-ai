import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { reserveRequest } from '../scripts/t153-real-budget.ts';
import { localEndpoint } from '../scripts/local-endpoint.ts';

localEndpoint('SITECRAFT_BASE');
const oracle = JSON.parse(await readFile(new URL('./fixtures/t165/tokenizer-adversarial.json', import.meta.url), 'utf8'));

// Failure modes: escaped or high-entropy ASCII is treated like prose; rare Han
// inherits the common-character price; mixed text or tool schema is omitted.
// The expected prompt counts include official V4.1 conversation framing and
// come from the pinned offline tokenizer, never from reserveRequest.
for (const sample of oracle.cases) test(`official tokenizer input is covered: ${sample.name}`, () => {
  const reservation = reserveRequest(sample.body, 0, 300000);
  assert.ok(reservation.inputUpper >= sample.promptTokens,
    `${sample.name}: reserved ${reservation.inputUpper}, official prompt ${sample.promptTokens}`);
});

test('128 independently generated mixed sentinels remain covered', () => {
  assert.equal(oracle.sentinels.length, 128);
  for (const sample of oracle.sentinels) {
    assert.ok(reserveRequest(sample.body, 0, 300000).inputUpper >= sample.promptTokens, sample.name);
  }
});
