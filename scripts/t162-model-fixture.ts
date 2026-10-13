import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { localEndpoint } from './local-endpoint.ts';
import { factAuditReply } from '../tests/fixtures/fact-audit-reply.ts';
localEndpoint('SITECRAFT_BASE');
const endpoint = localEndpoint('SITECRAFT_FIXTURE_BASE');
const directory = `artifacts/t162/provider-${Date.now()}`;
await mkdir(directory, { recursive: true });
const requests: unknown[] = [];
const server = createServer(async (req, res) => {
  if (req.method === 'GET') { res.end('本地替身'); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw), prompt = body.messages[1].content;
  const local = body.messages[0].content.includes('本次局部修改');
  if (!local && !body.messages[0].content.includes('事实校对员')) { res.writeHead(422); res.end('替身不接受整站写作'); return; }
  const input = local ? JSON.parse(prompt.split('\n')[0]) : null;
  requests.push({ purpose: local ? 'local-edit' : 'facts', input: prompt });
  await writeFile(`${directory}/requests.json`, JSON.stringify(requests, null, 2));
  if (input?.request.includes('服务失败')) { res.writeHead(503); res.end(JSON.stringify({ error: { message: '本地替身明确失败' } })); return; }
  const answer = local ? { html: input.html, css: input.request.includes('越界') ? '.spacer{padding:60px}' : `.${input.scope} h3{letter-spacing:.06em}` } : { issues: [] };
  if (local) await new Promise(resolve => setTimeout(resolve, 1200));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, answer)) } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
});
server.listen(endpoint.port, endpoint.hostname, () => console.log(`本地替身 ${endpoint.origin}；${directory}`));
