import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { localEndpoint } from '../../scripts/local-endpoint.ts';
const upstream = localEndpoint('SITECRAFT_BASE').origin;
const fixture = localEndpoint('SITECRAFT_FIXTURE_BASE').origin;
const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
const endpoint = new URL(config.proxy);
assert.equal(upstream, config.base); assert.equal(fixture, config.fixture);
const events: unknown[] = [];
let dropped = false;
const server = createServer(async (req, res) => {
  const at = new Date().toISOString();
  let body = ''; for await (const chunk of req) body += chunk;
  const response = await fetch(upstream + req.url, { method: req.method, ...(body ? { headers: { 'content-type': 'application/json' }, body } : {}) });
  const data = Buffer.from(await response.arrayBuffer());
  if (!dropped && req.url?.endsWith('/draft') && response.status === 200) {
    const state = JSON.parse(data.toString('utf8'));
    const model = await (await fetch(fixture + '/status')).json();
    if (state.codeSite.run?.kind === 'generate' && state.codeSite.run.status === 'running' && model.heldFacts > 0) {
      dropped = true;
      events.push({ at, endpoint: req.url, upstreamStatus: response.status, model, runId: state.codeSite.run.id, fault: '本地代理仅断开这一条读取响应；应用和替身继续运行' });
      await writeFile(config.root + '/injected-disconnect.json', JSON.stringify(events, null, 2), 'utf8');
      req.socket.destroy(); return;
    }
  }
  res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/json' }); res.end(data);
});
server.listen(Number(endpoint.port), endpoint.hostname, () => console.log(`本地读取故障代理：${endpoint.origin} → ${upstream}`));
