import assert from 'node:assert/strict';
import test from 'node:test';
import { uncompletedUserMessages } from '../lib/code-workspace-messages.ts';
import type { ConversationTurn } from '../lib/conversation-store.ts';

const initial = { type: 'message' as const, messageIndex: 1, text: '公司名：青禾维修\n\n业务：设备保养。' };
const followup = { type: 'message' as const, messageIndex: 2, text: '页面改为两个独立页面。' };
const turn = (userMessage: string, outcome: ConversationTurn['outcome'] = 'applied'): ConversationTurn => ({
  createdAt: '2026-01-01T00:00:00Z', userMessage, outcome, aiSummary: '处理结果', appliedOperationsSummary: '',
});

test('accepted follow-ups appear before a generation turn and remain stable on repeated reads', () => {
  const sources = [initial, followup];
  for (let index = 0; index < 3; index++) assert.deepEqual(uncompletedUserMessages(sources, []), sources);
  assert.deepEqual(sources, [initial, followup]);
});

test('completed and failed generation turns replace their accepted messages without duplicating them', () => {
  for (const outcome of ['applied', 'error'] as const) {
    assert.deepEqual(uncompletedUserMessages([initial, followup], [turn(`${initial.text}\n\n${followup.text}`, outcome)]), []);
    assert.deepEqual(uncompletedUserMessages([initial, followup], [turn(initial.text, outcome)]), [followup]);
  }
});

test('empty sources and uploads use the same read-only projection', () => {
  assert.deepEqual(uncompletedUserMessages(undefined, []), []);
  assert.deepEqual(uncompletedUserMessages([], [turn('历史消息')]), []);
  const upload = { type: 'upload' as const, sourceId: 'upload-1', name: '资料.txt', text: '上传的资料' };
  assert.deepEqual(uncompletedUserMessages([upload], []), [upload]);
  assert.deepEqual(uncompletedUserMessages([upload], [turn(upload.text)]), []);
});

test('an earlier identical message or a substring does not hide a newly accepted follow-up', () => {
  assert.deepEqual(uncompletedUserMessages([followup, { ...followup, messageIndex: 3 }], [turn(followup.text)]), [{ ...followup, messageIndex: 3 }]);
  assert.deepEqual(uncompletedUserMessages([followup], [turn(`要求：${followup.text}`)]), [followup]);
});
