import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, readFile } from 'node:fs/promises';
import { request } from 'node:http';
import test from 'node:test';
import { createT164OutputFixture } from './fixtures/t164-output-model.ts';

// Failure modes: empty/invalid JSON, interrupted transport, wrong HTTP route,
// and teardown while a body is still arriving. Use real HTTP, without Chrome
// or site storage, to isolate the fixture's request/teardown boundary.
async function fixture(caseName: string) {
  const directory = `artifacts/t182/transport-${crypto.randomUUID()}`;
  await mkdir(directory, { recursive: true });
  const model = createT164OutputFixture(directory, caseName, 'truncate');
  await new Promise<void>(resolve => model.provider.listen(0, '127.0.0.1', resolve));
  const address = model.provider.address(); assert.ok(address && typeof address === 'object');
  return { ...model, directory, port: address.port };
}
function client(port: number, path = '/beta/chat/completions', method = 'POST') {
  const req = request({ host: '127.0.0.1', port, path, method });
  const response = new Promise<{ status: number; text: string }>((resolve, reject) => {
    req.on('error', reject);
    req.on('response', async res => {
      try { let text = ''; for await (const chunk of res) text += chunk; resolve({ status: res.statusCode!, text }); }
      catch (error) { reject(error); }
    });
  });
  return { req, response };
}

for (const [label, raw, path, method] of [
  ['空正文', '', '/beta/chat/completions', 'POST'],
  ['无法解析的正文', '{"内容":', '/chat/completions', 'POST'],
  ['意外 GET', '', '/json/version', 'GET'],
]) test(`T-182 用例结束后收到${label}：HTTP 和关闭断言均报告所属用例及请求`, async t => {
  const model = await fixture(t.name);
  // The owner has finished. The provider must still attribute a late request.
  await t.test('所属用例已结束', () => {});
  const { req, response } = client(model.port, path, method);
  req.end(raw);
  const result = await response;
  assert.equal(result.status, 400);
  const diagnostic = JSON.parse(result.text).error;
  assert.ok(diagnostic.includes(`用例=${t.name}`));
  assert.ok(diagnostic.includes(`请求=#1 ${method} ${path}`));
  assert.ok(diagnostic.includes(`已收字节=${Buffer.byteLength(raw)} complete=true`));
  await assert.rejects(model.close(), error => error instanceof AggregateError && error.message.includes(diagnostic));
  const saved = JSON.parse(await readFile(`${model.directory}/local-output-transport-truncate.json`, 'utf8'));
  assert.equal(saved.arrivals[0].status, 'failed');
  assert.equal(saved.arrivals[0].error, diagnostic);
});

test('T-182 正文传输中断：关闭明确失败并保留实际已收字节', async t => {
  const model = await fixture(t.name), raw = '{"messages":';
  const received = new Promise<void>(resolve => model.provider.prependOnceListener('request', req => {
    req.once('data', () => resolve());
  }));
  const { req, response } = client(model.port);
  const failedClient = assert.rejects(response, /socket hang up/);
  req.setHeader('content-length', '1000'); req.write(raw);
  await received;
  req.destroy();
  await failedClient;
  await assert.rejects(model.close(), error => error instanceof AggregateError
    && error.message.includes(`用例=${t.name}`) && error.message.includes('POST /beta/chat/completions')
    && error.message.includes(`已收字节=${Buffer.byteLength(raw)} complete=false`));
  assert.equal(model.arrivals[0].status, 'failed');
});

test('T-182 关闭必须等迟到正文及响应到达终态，不能提前成功', async t => {
  const model = await fixture(t.name);
  const raw = JSON.stringify({ messages: [{ content: '本次局部修改' }, { content: '{}' }] });
  const received = new Promise<void>(resolve => model.provider.prependOnceListener('request', req => {
    req.once('data', () => resolve());
  }));
  const { req, response } = client(model.port);
  req.write(raw.slice(0, 10));
  await received;
  let closed = false;
  const closing = model.close().then(() => { closed = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(closed, false, '半截正文仍在传输，不能报告已关闭');
  assert.equal(model.arrivals[0].status, 'receiving');
  req.end(raw.slice(10));
  assert.equal((await response).status, 200);
  await closing;
  assert.equal(model.arrivals[0].status, 'responded');
  assert.equal(model.arrivals[0].bytes, Buffer.byteLength(raw));
  assert.equal(model.arrivals[0].purpose, 'local-edit');
  model.assertHealthy();
});
