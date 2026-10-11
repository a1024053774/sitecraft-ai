import { localEndpoint } from './local-endpoint.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { providerConfig } from '../lib/ai-provider.ts';

// T-152's one approved real-model acceptance round. This development harness
// limits the upstream output and reserves estimated input plus that output cap
// before every request, for the approved single simplify action, without retry.
localEndpoint('SITECRAFT_BASE');
const budget = localEndpoint('SITECRAFT_BUDGET_BASE');
const provider = providerConfig();
assert.ok(provider.apiKey && provider.model);
assert.equal(new URL(provider.baseURL).hostname, 'api.deepseek.com');
const folder = `artifacts/t152/real-budget-${Date.now()}`;
await mkdir(folder, { recursive: true });
let spent = 0, stopped = false, running = false;
const limit = 10000;
const calls: Array<Record<string, unknown>> = [];
await writeFile(`${folder}/usage.json`, JSON.stringify({ limit, spent, stopped, calls }, null, 2));
const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/chat/completions' || stopped || running) { res.writeHead(409); res.end('{"error":{"message":"Acceptance round stopped or busy"}}'); return; }
  running = true;
  const call: Record<string, unknown> = { startedAt: new Date().toISOString(), spentBefore: spent };
  try {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    body.model = provider.model; body.max_tokens = Math.min(body.max_tokens, 4096);
    const text = JSON.stringify(body), han = (text.match(/\p{Script=Han}/gu) ?? []).length;
    const rawEstimate = Math.ceil(han * 1.5 + (text.length - han) / 3 + 300);
    // Previous real requests used 9330/15453 and 4763/9163 of this character
    // estimate. Keep a 0.70 multiplier plus 300 tokens of margin for this same
    // model/company, rather than treating the character upper estimate as billed
    // input. This remains an estimate; actual usage is recorded after each call.
    const inputEstimate = Math.ceil(rawEstimate * 0.70 + 300);
    // The remaining authorization also caps output. The API allowance never
    // exceeds the budget left after reserving this request's estimated input.
    body.max_tokens = Math.min(body.max_tokens, limit - spent - inputEstimate);
    const reserve = inputEstimate + body.max_tokens;
    Object.assign(call, { rawEstimate, inputEstimate, outputLimit: body.max_tokens, reserve, thinking: body.thinking?.type, purpose: body.messages[0].content.includes('局部事实校对员') ? 'local-facts' : body.messages[0].content.includes('事实校对员') ? 'facts' : 'local-edit' });
    if (body.max_tokens < 512 || spent + reserve > limit) { stopped = true; throw new Error('Estimated round usage leaves insufficient output within 10000 tokens'); }
    console.log(JSON.stringify({ beforeCall: calls.length + 1, spent, rawEstimate, inputEstimate, outputLimit: body.max_tokens, reserve }));
    const response = await fetch(`${provider.baseURL}/chat/completions`, { method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${provider.apiKey}`},body:JSON.stringify(body),signal:AbortSignal.timeout(300000) });
    call.httpStatus = response.status;
    const payload = await response.json();
    const usage = payload.usage?.total_tokens;
    if (response.ok && Number.isSafeInteger(usage) && usage >= 0) { spent += usage; Object.assign(call, { usage: payload.usage, spentAfter: spent }); }
    else stopped = true;
    if (!response.ok || payload.choices?.[0]?.finish_reason === 'length' || spent > limit) stopped = true;
    res.writeHead(response.status, { 'content-type':'application/json' }); res.end(JSON.stringify(payload));
  } catch (error) {
    stopped = true; call.error = error instanceof Error ? error.message : 'Acceptance round failed';
    res.writeHead(502, { 'content-type':'application/json' }); res.end(JSON.stringify({ error: { message: call.error } }));
  } finally { running = false; calls.push(call); await writeFile(`${folder}/usage.json`, JSON.stringify({ limit, spent, stopped, calls }, null, 2)); }
});
server.listen(budget.port, budget.hostname,()=>console.log(`Approved T-152 acceptance budget: ${folder}`));
