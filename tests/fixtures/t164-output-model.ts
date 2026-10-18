import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { factAuditReply } from './fact-audit-reply.ts';
import { localEditChoice } from './local-edit-choice.ts';

type Arrival = { requestId: number; caseName: string; method: string; path: string; bytes: number;
  startedAt: string; finishedAt?: string; complete: boolean; purpose: 'unknown' | 'local-edit' | 'local-facts';
  status: 'receiving' | 'responded' | 'failed'; error?: string };

// Each case owns its listener, so even an empty or late request has an owner.
export function createT164OutputFixture(directory: string, caseName: string, mode: 'truncate' | 'repair', beforeFactReply?: () => Promise<void>) {
  const requests: Array<{ local: boolean; body: any }> = [], arrivals: Arrival[] = [], failures: Error[] = [];
  const tasks: Promise<void>[] = [];
  let localRoundCalls = 0;
  const provider = createServer((req, res) => {
    const arrival: Arrival = { requestId: arrivals.length + 1, caseName, method: req.method ?? '', path: req.url ?? '',
      bytes: 0, startedAt: new Date().toISOString(), complete: false, purpose: 'unknown', status: 'receiving' };
    arrivals.push(arrival);
    const handle = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) { const bytes = Buffer.from(chunk); chunks.push(bytes); arrival.bytes += bytes.length; }
      arrival.complete = req.complete;
      if (!req.complete) throw new Error('请求正文传输未完成');
      if (req.method !== 'POST' || !/^\/(?:beta\/)?chat\/completions$/.test(arrival.path)) throw new Error('请求方法或路径不属于模型合同');
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const local = body.messages[0].content.includes('本次局部修改');
      arrival.purpose = local ? 'local-edit' : 'local-facts';
      requests.push({ local, body });
      await writeFile(`${directory}/local-output-requests-${mode}.json`, JSON.stringify(requests, null, 2));
      res.setHeader('content-type', 'application/json');
      if (local && mode === 'truncate') {
        res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '' } }],
          usage: { prompt_tokens: 100, completion_tokens: 6145, total_tokens: 6245, completion_tokens_details: { reasoning_tokens: 6145 } } }));
      } else {
        const input = local ? JSON.parse(body.messages[1].content.split('\n')[0]) : null;
        // First round violates the block contract. The correction returns it intact.
        const answer = local ? { html: ++localRoundCalls <= 2 ? `<main>${input.html}</main>` : input.html, css: '' }
          : factAuditReply(body, { issues: [] });
        if (!local) await beforeFactReply?.();
        res.end(JSON.stringify({ choices: [local ? localEditChoice(answer) : { finish_reason: 'stop', message: { content: JSON.stringify(answer) } }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
      }
      arrival.status = 'responded';
      arrival.finishedAt = new Date().toISOString();
    };
    tasks.push(handle().catch(error => {
      arrival.complete = req.complete;
      arrival.status = 'failed';
      arrival.finishedAt = new Date().toISOString();
      arrival.error = `T-164 替身失败：用例=${caseName} 请求=#${arrival.requestId} ${arrival.method} ${arrival.path} 已收字节=${arrival.bytes} complete=${arrival.complete}：${String(error)}`;
      failures.push(new Error(arrival.error));
      if (!res.destroyed) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: arrival.error })); }
    }));
  });
  return {
    provider, requests, arrivals,
    assertHealthy() { assert.deepEqual(failures.map(error => error.message), [], `替身失败必须归属于 ${caseName}`); },
    async close() {
      // Stop admission first. close waits for accepted HTTP requests, including
      // bodies that have not ended yet; tasks also include response preparation.
      await new Promise<void>((resolve, reject) => provider.close(error => error ? reject(error) : resolve()));
      await Promise.all(tasks);
      await writeFile(`${directory}/local-output-transport-${mode}.json`, JSON.stringify({ caseName, arrivals }, null, 2));
      if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('\n'));
    },
  };
}
