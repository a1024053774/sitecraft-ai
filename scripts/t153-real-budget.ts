import { localEndpoint } from './local-endpoint.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { providerConfig } from '../lib/ai-provider.ts';
import { readProviderHttpError } from '../lib/provider-http-error.ts';
import { singleTokenHanCharacters } from './t165-single-token-han.ts';

const singleTokenHan = new Set(singleTokenHanCharacters);
// Count the complete request, including escapes and tool schemas. ASCII needs
// one token per character: base64, literal escapes and short strings are not
// prose. Only offline-verified single-token Han receives the 1.5 allowance;
// rare Han and other code points use 4. Official full-prompt oracles include
// framing (31 tokens for the two-message text cases); reserve another 128.
// This remains an estimate; reported overruns stop the gateway. Output includes reasoning.
export function reserveRequest(body: Record<string, any>, spent: number, approvedTokenLimit: number) {
  assert.ok(Number.isSafeInteger(approvedTokenLimit) && approvedTokenLimit > 0, 'An explicit positive token authorization limit is required');
  assert.ok(Number.isSafeInteger(spent) && spent >= 0 && spent <= approvedTokenLimit);
  assert.ok(Number.isSafeInteger(body.max_tokens) && body.max_tokens > 0);
  let inputEstimate = 0;
  for (const character of JSON.stringify(body)) {
    inputEstimate += character.codePointAt(0)! <= 0x7f ? 1 : singleTokenHan.has(character) ? 1.5 : 4;
  }
  const inputUpper = Math.ceil(inputEstimate) + 128;
  const local = Array.isArray(body.tools) && body.tools.some(tool => tool?.type === 'function' && tool.function?.name === 'submit_local_edit');
  if (local) {
    assert.ok(approvedTokenLimit - spent - inputUpper >= body.max_tokens,
      `submit_local_edit 剩余授权无法完整预留请求输出 ${body.max_tokens} token，拒绝降额。`);
  }
  const outputLimit = Math.min(body.max_tokens, approvedTokenLimit - spent - inputUpper);
  assert.ok(local || outputLimit >= 4096, 'Remaining authorization cannot reserve this request and a usable output allowance');
  return { inputUpper, outputLimit, reserved: inputUpper + outputLimit };
}

async function serve() {
  localEndpoint('SITECRAFT_BASE');
  const budget = localEndpoint('SITECRAFT_BUDGET_BASE');
  const approvedTokenLimit = Number(process.env.SITECRAFT_TOKEN_LIMIT);
  assert.ok(Number.isSafeInteger(approvedTokenLimit) && approvedTokenLimit > 0, 'SITECRAFT_TOKEN_LIMIT must be the explicit approved token authorization');
  const folder = process.env.T153_BUDGET_DIR;
  assert.ok(folder && ['t153', 't158', 't159', 't160', 't162', 't164', 't169', 't174'].some(ticket => path.resolve(folder).startsWith(path.join(process.cwd(), 'artifacts', ticket) + path.sep)));
  const provider = providerConfig();
  assert.ok(provider.apiKey); assert.equal(provider.model, 'deepseek-flash');
  const apiKey = provider.apiKey;
  assert.equal(new URL(provider.baseURL).origin, 'https://api.deepseek.com');
  await mkdir(folder, { recursive: true });
  const file = path.join(folder, 'usage.json');
  // An explicit resume retains every billed call. Unknown in-flight usage and
  // any stopped gateway remain terminal; a new process cannot reset allowance.
  if (!process.argv.includes('--resume')) await writeFile(file, JSON.stringify({ limit: approvedTokenLimit, spent: 0, stopped: false, rounds: [], calls: [] }, null, 2), { flag: 'wx' });
  const ledger = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(ledger.limit, approvedTokenLimit);
  assert.equal(ledger.stopped, false);
  assert.ok(ledger.calls.every((call: any) => call.state === 'complete' && call.httpStatus === 200 && Number.isSafeInteger(call.usage?.total_tokens)));
  assert.equal(ledger.spent, ledger.calls.reduce((sum: number, call: any) => sum + call.usage.total_tokens, 0));
  let running = false;
  const save = () => writeFile(file, JSON.stringify(ledger, null, 2));
  const server = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url === '/status') { res.end(JSON.stringify(ledger)); return; }
    if (req.method !== 'POST' || running || ledger.stopped) { res.writeHead(409); res.end('{"error":{"message":"Budget gateway stopped or busy"}}'); return; }
    // Claim before reading the async request body so two uploads cannot both
    // reserve the same remaining allowance.
    running = true;
    let call: Record<string, any> | undefined;
    try {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (req.url === '/round') {
        assert.ok(['default', 'low', 'high'].includes(body.label));
        assert.ok(!ledger.rounds.some((round: any) => round.label === body.label), 'Each approved generation is started once');
        assert.ok(Number.isSafeInteger(body.estimate) && body.estimate > 0);
        assert.ok(ledger.spent + body.estimate <= approvedTokenLimit, 'The next generation estimate exceeds the cumulative approved budget');
        ledger.rounds.push({ label: body.label, estimate: body.estimate, spentBefore: ledger.spent, at: new Date().toISOString() });
        await save(); res.end(JSON.stringify(ledger)); return;
      }
      assert.ok(req.url === '/chat/completions' || req.url === '/beta/chat/completions');
      assert.ok(ledger.rounds.length, 'Start an estimated generation before any upstream call');
      body.model = provider.model;
      const reservation = reserveRequest(body, ledger.spent, approvedTokenLimit);
      body.max_tokens = reservation.outputLimit;
      const factInput = body.messages[0].content.includes('事实校对员') && body.messages[1].content.startsWith('{') ? JSON.parse(body.messages[1].content.split('\n')[0]) : null;
      call = { inputSegmentCount: Array.isArray(factInput?.segments) ? factInput.segments.length : null, index: ledger.calls.length + 1, round: ledger.rounds.at(-1).label, startedAt: new Date().toISOString(), state: 'in-flight', spentBefore: ledger.spent,
        ...reservation, thinking: body.thinking?.type, purpose: body.tools?.[0]?.function?.name || (body.messages[0].content.includes('事实校对员') ? 'facts' : 'write-or-repair') };
      ledger.calls.push(call); await save();
      console.log(JSON.stringify({ beforeCall: call.index, round: call.round, spent: ledger.spent, ...reservation }));
      const response = await fetch(`${provider.baseURL}${req.url}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
      call.httpStatus = response.status;
      if (!response.ok) {
        const diagnostic = await readProviderHttpError(response, apiKey);
        call.httpError = diagnostic; call.state = 'complete'; call.spentAfter = ledger.spent;
        ledger.stopped = true; await save();
        res.setHeader('content-type', response.headers.get('content-type') || 'text/plain; charset=utf-8');
        if (diagnostic.requestIdHeader) res.setHeader(diagnostic.requestIdHeader, diagnostic.requestId!);
        res.writeHead(response.status); res.end(diagnostic.body); return;
      }
      const payload = await response.json();
      const usage = payload.usage;
      assert.ok(usage && ['prompt_tokens', 'completion_tokens', 'total_tokens'].every(key => Number.isSafeInteger(usage[key]) && usage[key] >= 0), 'Upstream usage is unknown; stop all further calls');
      ledger.spent += usage.total_tokens; call.usage = usage;
      assert.ok(usage.prompt_tokens <= reservation.inputUpper, 'Input exceeded the conservative reservation; stop');
      assert.ok(ledger.spent <= approvedTokenLimit, 'Reported usage exceeded authorization; stop');
      call.state = 'complete'; call.spentAfter = ledger.spent; call.finishReason = payload.choices?.[0]?.finish_reason;
      // HTTP 错误已在上方停止；成功响应截断同样终止，不重试。
      if (call.finishReason === 'length') ledger.stopped = true;
      await save(); res.writeHead(response.status); res.end(JSON.stringify(payload));
    } catch (error) {
      ledger.stopped = true;
      const message = error instanceof Error ? error.message : 'Budget gateway stopped';
      if (call) { call.state = 'failed'; call.error = message; }
      else ledger.stopReason = message;
      await save(); res.writeHead(502); res.end(JSON.stringify({ error: { message } }));
    } finally { running = false; }
  });
  server.listen(budget.port, budget.hostname, () => console.log(`T-153 approved cumulative budget ${approvedTokenLimit}; ${file}`));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await serve();
