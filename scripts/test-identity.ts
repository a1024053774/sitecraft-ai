import assert from 'node:assert/strict';
import path from 'node:path';
import { localEndpoint } from './local-endpoint.ts';

export async function checkTestIdentity() {
  const base = localEndpoint('SITECRAFT_BASE').origin;
  assert.ok(process.env.SITECRAFT_DATA_ROOT, '测试必须显式设置 SITECRAFT_DATA_ROOT');
  const dataRoot = path.resolve(process.env.SITECRAFT_DATA_ROOT);
  const response = await fetch(`${base}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
  assert.ok([200, 503].includes(response.status), '测试服务 health 必须返回 200 或 503');
  const body = await response.json();
  assert.equal(body.testIdentity?.cwd, process.cwd(), '工作树不一致，拒绝运行测试');
  assert.equal(body.testIdentity?.dataRoot, dataRoot, '数据根不一致，拒绝运行测试');
  return { status: response.status, ...body.testIdentity };
}
