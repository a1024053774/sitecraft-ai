import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

// T-204 review of the visitor provider client (lib/provider-context.ts): a
// visitor-supplied endpoint must not be able to exhaust memory with an endless
// response, and every IPv6 form that carries a private IPv4 must be refused.
const { guardedFetch, isPublicAddress } = await import('../lib/provider-context.ts');

let streamed = 0, aborted = false;
const endless = createServer((req, res) => {
  if (req.url === '/normal') { res.end(JSON.stringify({ ok: true, pad: 'x'.repeat(1_000_000) })); return; }
  // Keeps sending until the client goes away; never ends by itself.
  res.writeHead(200, { 'content-type': 'application/json' });
  const chunk = Buffer.alloc(1 << 20, 120);
  const pump = () => { while (!res.writableNeedDrain && !aborted && streamed < 64 * 2 ** 20) { res.write(chunk); streamed += chunk.length; } if (!aborted && streamed < 64 * 2 ** 20) res.once('drain', pump); else res.end(); };
  res.on('close', () => { aborted = true; });
  pump();
});
await new Promise<void>(resolve => endless.listen(0, '127.0.0.1', resolve));
const address = endless.address(); assert.ok(address && typeof address === 'object');
const base = `http://127.0.0.1:${address.port}`;
test.after(() => endless.close());

test('a response larger than the cap is cut off with a clear error; a normal reply is unaffected', async () => {
  process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER = '1';
  try {
    const ok = await guardedFetch(`${base}/normal`, { method: 'POST', body: '{}' });
    assert.equal((await ok.json()).ok, true);
    await assert.rejects(guardedFetch(`${base}/endless`, { method: 'POST', body: '{}' }), /超过.*上限/);
    // The request was dropped near the cap instead of reading everything the server offered.
    assert.ok(streamed < 40 * 2 ** 20, `read ${streamed} bytes before stopping`);
  } finally { delete process.env.SITECRAFT_ALLOW_LOCAL_PROVIDER; }
});

test('IPv6 site-local, 6to4 and IPv4-compatible forms are judged by what they carry', () => {
  for (const address of ['fec0::1', 'feff::1', '2002:0a00:0001::1', '2002:c0a8:0101::', '2002:7f00:1::', '::10.0.0.1', '::a00:1', '::127.0.0.1', '::7f00:1', '2001:0:4136:e378::1', '100::1'])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ['2002:0808:0808::1', '::8.8.8.8', '2606:4700::1111', '2a00:1450:4001::200e'])
    assert.equal(isPublicAddress(address), true, address);
});
