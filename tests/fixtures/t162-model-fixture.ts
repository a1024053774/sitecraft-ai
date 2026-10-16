import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { factAuditReply } from './fact-audit-reply.ts';

// The browser tests and the explicit Next-server integration CLI use the same
// provider contract. It accepts local edits/facts and never writes site data.
export function createT162ModelFixture(directory: string, beforeLocalReply?: () => Promise<void>) {
  const requests: unknown[] = [];
  return createServer(async (req, res) => {
    if (req.method === 'GET') { res.end('本地替身'); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw), prompt = body.messages[1].content;
    const local = body.messages[0].content.includes('本次局部修改');
    if (!local && !body.messages[0].content.includes('事实校对员')) { res.writeHead(422); res.end('替身不接受整站写作'); return; }
    const input = local ? JSON.parse(prompt.split('\n')[0]) : null;
    requests.push({ purpose: local ? 'local-edit' : 'facts', input: prompt });
    await writeFile(`${directory}/requests.json`, JSON.stringify(requests, null, 2));
    if (input?.request.includes('服务失败')) { res.writeHead(503); res.end(JSON.stringify({ error: { message: '本地替身明确失败' } })); return; }
    const answer = local ? { html: input.html, css: input.request.includes('范围外规则') ? `.${input.scope}:has(a){color:red}` : input.request.includes('合法空 CSS') ? '' : input.request.includes('越界') ? '.spacer{padding:60px}' : `.${input.scope} h3{letter-spacing:.06em}` } : { issues: [] };
    if (local && input.request.includes('不能修改')) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ cannotEdit: '第一组明确拒绝' }) } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
      return;
    }
    if (local) await beforeLocalReply?.();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, answer)) } }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
  });
}
