import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { factAuditReply } from './fact-audit-reply.ts';
import { localEditChoice } from './local-edit-choice.ts';

type Phase = 'initialization' | 'run';
type Purpose = 'whole-facts' | 'local-edit' | 'local-facts';
type Arrival = { requestId: number; caseName: string; phase: Phase; method: string; path: string; bytes: number;
  startedAt: string; finishedAt?: string; complete: boolean; purpose: 'unknown' | Purpose;
  status: 'receiving' | 'responded' | 'failed'; error?: string };

// Each case owns its listener, so even an empty or late request has an owner.
export function createT164OutputFixture(directory: string, caseName: string, mode: 'truncate' | 'repair', beforeFactReply?: () => Promise<void>) {
  const requests: Record<Phase, Array<{ purpose: Purpose; local: boolean; body: any }>> = { initialization: [], run: [] };
  const arrivals: Arrival[] = [], failures: Error[] = [];
  const tasks: Promise<void>[] = [];
  const pendingRequests = new Set<IncomingMessage>();
  let phase: Phase = 'initialization', localRoundCalls = 0;
  const provider = createServer((req, res) => {
    const arrival: Arrival = { requestId: arrivals.length + 1, caseName, phase, method: req.method ?? '', path: req.url ?? '',
      bytes: 0, startedAt: new Date().toISOString(), complete: false, purpose: 'unknown', status: 'receiving' };
    arrivals.push(arrival);
    pendingRequests.add(req);
    const handle = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) { const bytes = Buffer.from(chunk); chunks.push(bytes); arrival.bytes += bytes.length; }
      arrival.complete = req.complete;
      if (!req.complete) throw new Error('请求正文传输未完成');
      if (req.method !== 'POST' || !/^\/(?:beta\/)?chat\/completions$/.test(arrival.path)) throw new Error('请求方法或路径不属于模型合同');
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const system = body.messages[0].content, local = system.includes('本次局部修改');
      const purpose: Purpose = local ? 'local-edit' : system.includes('局部事实校对员') ? 'local-facts' : 'whole-facts';
      if (!local && !system.includes('事实校对员')) throw new Error('替身只接受局部写作与事实核对');
      arrival.purpose = purpose;
      requests[arrival.phase].push({ purpose, local, body });
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
        if (arrival.phase === 'run' && purpose === 'local-facts') await beforeFactReply?.();
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
      arrival.error = `T-164 替身失败：用例=${caseName} 阶段=${arrival.phase} 请求=#${arrival.requestId} ${arrival.method} ${arrival.path} 已收字节=${arrival.bytes} complete=${arrival.complete}：${String(error)}`;
      failures.push(new Error(arrival.error));
      if (!res.destroyed) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: arrival.error })); }
    }).finally(() => { pendingRequests.delete(req); }));
  });
  return {
    provider, requests, arrivals,
    beginRun() {
      assert.equal(phase, 'initialization', '每个用例只能结束一次初始化');
      assert.ok(arrivals.every(arrival => arrival.status === 'responded'), '初始化请求必须全部到达成功终态后才能开始 run');
      phase = 'run';
    },
    assertHealthy() { assert.deepEqual(failures.map(error => error.message), [], `替身失败必须归属于 ${caseName}`); },
    async close() {
      // Stop admission first. A client can keep an incomplete body open forever;
      // the fixture deadline must abort it even when Node stops timeout checks.
      const closed = new Promise<void>((resolve, reject) => provider.close(error => error ? reject(error) : resolve()));
      const deadline = setTimeout(() => {
        for (const req of pendingRequests) req.destroy(new Error('替身关闭期限 1000ms 已到，请求未处理完成'));
        provider.closeAllConnections();
      }, 1000);
      try {
        await closed;
        await Promise.all(tasks);
      } finally { clearTimeout(deadline); }
      await writeFile(`${directory}/local-output-transport-${mode}.json`, JSON.stringify({ caseName, arrivals }, null, 2));
      if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('\n'));
    },
  };
}
