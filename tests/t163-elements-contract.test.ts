import assert from 'node:assert/strict';
import test from 'node:test';
import { annotationTargetSchema } from '../lib/annotations.ts';

// Expected paths come from the acceptance fixture's h3/p siblings, not production output.
test('单区块圈选可保存多个元素提示，屏幕坐标不能进入目标合同', () => {
  const target = { kind: 'dom', pageId: 'home', versionId: 'v1', path: [2, 0, 1],
    text: '深层纸袋区块相同说明底部产品链接', label: '深层纸袋区块',
    elements: [{ path: [0], tag: 'h3', text: '深层纸袋区块' }, { path: [1], tag: 'p', text: '相同说明' }] };
  assert.equal(annotationTargetSchema.safeParse(target).success, true);
  assert.equal(annotationTargetSchema.safeParse({ ...target, rect: { x: 1, y: 2, width: 3, height: 4 } }).success, false);
  assert.equal(annotationTargetSchema.safeParse({ ...target, elements: [] }).success, false);
});
