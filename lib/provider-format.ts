// T-221: the request and reply dialects the model client speaks. Only the wire
// format differs; validation, checks and versions after the reply are shared.
export const providerFormats = ['deepseek', 'openai', 'openai-responses', 'anthropic'] as const;
export type ProviderFormat = typeof providerFormats[number];
export const providerFormatNames: Record<ProviderFormat, string> = { deepseek: 'DeepSeek', openai: 'OpenAI 兼容', 'openai-responses': 'OpenAI Responses', anthropic: 'Anthropic 兼容' };
export function providerFormat(value: string | null | undefined): ProviderFormat | null {
  return providerFormats.find(format => format === value) ?? null;
}
// Names the upstream in messages shown to the user.
export function providerErrorName(format: ProviderFormat) { return format === 'deepseek' ? 'DeepSeek' : '模型接口'; }

// The output caps were set for DeepSeek (up to 65536). Current OpenAI and
// Anthropic models commonly reject values above their own limit, so the other
// formats send at most this many; a truncated answer is still reported, never saved.
export const otherFormatOutputCap = 32000;

// Whether the Responses format asks the provider to enforce the function schema. The reply is validated by the program either way.
export const responsesStrict = true;

export type ProviderCall = { model: string; system: string; user: string; maxTokens: number; temperature: number; thinking?: 'enabled' | 'disabled';
  tool?: { name: string; description: string; parameters: Record<string, unknown>; forced: boolean } };

export function providerRequest(format: ProviderFormat, baseURL: string, apiKey: string, call: ProviderCall): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const base = baseURL.replace(/\/$/, ''), { tool } = call;
  if (format === 'anthropic') return {
    url: `${base}${/\/v1$/.test(base) ? '' : '/v1'}/messages`,
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    // No thinking switch and no sampling parameters: a forced tool call needs thinking off, and newer models refuse a set temperature.
    body: { model: call.model, max_tokens: Math.min(call.maxTokens, otherFormatOutputCap), system: call.system, messages: [{ role: 'user', content: call.user }],
      ...(tool ? { tools: [{ name: tool.name, description: tool.description, input_schema: tool.parameters }], tool_choice: { type: 'tool', name: tool.name } } : {}) },
  };
  // OpenAI's Responses API: models that refuse function tools with reasoning on chat completions accept them here.
  if (format === 'openai-responses') return {
    url: `${base}${new URL(base).pathname === '/' ? '/v1' : ''}/responses`, headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    // No reasoning setting and no temperature: the model's defaults apply. store:false keeps the request out of the provider's response log.
    body: { model: call.model, instructions: call.system, input: [{ role: 'user', content: call.user }], max_output_tokens: Math.min(call.maxTokens, otherFormatOutputCap), store: false,
      ...(tool ? { tools: [{ type: 'function', name: tool.name, description: tool.description, strict: responsesStrict, parameters: tool.parameters }], tool_choice: { type: 'function', name: tool.name } }
        : { text: { format: { type: 'json_object' } } }) },
  };
  const messages = [{ role: 'system', content: call.system }, { role: 'user', content: call.user }];
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
  if (format === 'openai') return {
    // An address without a path is the provider root; the API lives under /v1.
    url: `${base}${new URL(base).pathname === '/' ? '/v1' : ''}/chat/completions`, headers,
    body: { model: call.model, max_completion_tokens: Math.min(call.maxTokens, otherFormatOutputCap),
      ...(tool ? { tools: [{ type: 'function', function: { name: tool.name, description: tool.description, strict: true, parameters: tool.parameters } }],
        tool_choice: { type: 'function', function: { name: tool.name } } } : { response_format: { type: 'json_object' } }),
      messages },
  };
  return {
    url: `${baseURL}${tool ? '/beta' : ''}/chat/completions`, headers,
    body: { model: call.model, temperature: call.temperature, max_tokens: call.maxTokens,
      ...(tool ? { thinking: { type: call.thinking },
        tools: [{ type: 'function', function: { name: tool.name, description: tool.description, strict: true, parameters: tool.parameters } }],
        tool_choice: tool.forced ? { type: 'function', function: { name: tool.name } } : 'auto' }
        : { ...(call.thinking ? { thinking: { type: call.thinking } } : {}), response_format: { type: 'json_object' } }),
      messages },
  };
}

export type ProviderReply = {
  // What the checks act on: one matching function call, a cut-off answer, a plain answer, or anything else.
  finish: 'tool_calls' | 'length' | 'stop' | 'other'; finishReason: string | null;
  // tool: exactly one call of the expected function. Its arguments are checked by the caller.
  content: string | null; tool: boolean; toolArguments?: unknown; rawMessage: { content: unknown; tool_calls: unknown };
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; reasoningTokens?: number } | null; reasoningTokens: number | null };

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function providerReply(format: ProviderFormat, payload: any, toolName?: string): ProviderReply {
  if (format === 'anthropic') {
    const blocks: Array<{ type?: string; text?: unknown; name?: unknown; input?: unknown }> = Array.isArray(payload?.content) ? payload.content : [];
    const tools = blocks.filter(block => block?.type === 'tool_use'), text = blocks.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('');
    const valid = tools.length === 1 && tools[0].name === toolName && !!tools[0].input && typeof tools[0].input === 'object' && !Array.isArray(tools[0].input);
    const stop = typeof payload?.stop_reason === 'string' ? payload.stop_reason : null, usage = payload?.usage;
    const input = [usage?.input_tokens, usage?.cache_creation_input_tokens ?? 0, usage?.cache_read_input_tokens ?? 0];
    return { finish: stop === 'tool_use' ? 'tool_calls' : stop === 'max_tokens' || stop === 'model_context_window_exceeded' ? 'length' : stop === 'end_turn' || stop === 'stop_sequence' ? 'stop' : 'other', finishReason: stop,
      content: text || null, tool: valid, ...(valid ? { toolArguments: JSON.stringify(tools[0].input) } : {}), rawMessage: { content: payload?.content ?? null, tool_calls: tools.length ? tools : null },
      usage: input.every(count) && count(usage?.output_tokens) ? { promptTokens: input[0] + input[1] + input[2], completionTokens: usage.output_tokens, totalTokens: input[0] + input[1] + input[2] + usage.output_tokens } : null,
      reasoningTokens: null };
  }
  if (format === 'openai-responses') {
    const items: Array<{ type?: string; status?: unknown; name?: unknown; arguments?: unknown; content?: unknown; phase?: unknown }> = Array.isArray(payload?.output) ? payload.output : [];
    const itemCompleted = (item: { status?: unknown }) => item.status === undefined || item.status === 'completed';
    const calls = items.filter(item => item?.type === 'function_call');
    const messages = items.filter(item => item?.type === 'message');
    const final = messages.filter(message => message.phase === 'final_answer');
    const answer = final.length ? final : messages.filter(message => message.phase == null);
    const answerCompleted = answer.every(itemCompleted);
    const text = answerCompleted
      ? answer.flatMap(item => Array.isArray(item.content) ? item.content : [])
          .filter((part: { type?: string; text?: unknown }) => part?.type === 'output_text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('')
      : '';
    const valid = calls.length === 1 && calls[0].name === toolName && itemCompleted(calls[0]);
    const callsFinished = calls.every(itemCompleted);
    const status = typeof payload?.status === 'string' ? payload.status : null, why = payload?.incomplete_details?.reason, usage = payload?.usage, reasoning = usage?.output_tokens_details?.reasoning_tokens;
    const finish = status === 'incomplete' && why === 'max_output_tokens' ? 'length'
      : status !== 'completed' || !callsFinished || !answerCompleted ? 'other'
      : calls.length ? 'tool_calls' : 'stop';
    return { finish,
      finishReason: status === 'incomplete' && typeof why === 'string' ? `incomplete:${why}` : status,
      content: text || null, tool: valid, ...(valid ? { toolArguments: calls[0].arguments } : {}), rawMessage: { content: text || null, tool_calls: calls.length ? calls : null },
      usage: [usage?.input_tokens, usage?.output_tokens, usage?.total_tokens].every(count) ? { promptTokens: usage.input_tokens, completionTokens: usage.output_tokens, totalTokens: usage.total_tokens,
        ...(count(reasoning) && reasoning <= usage.output_tokens ? { reasoningTokens: reasoning } : {}) } : null,
      reasoningTokens: count(reasoning) ? reasoning : null };
  }
  const choice = payload?.choices?.[0], message = choice?.message, tools = message?.tool_calls, usage = payload?.usage;
  const valid = Array.isArray(tools) && tools.length === 1 && tools[0]?.type === 'function' && tools[0]?.function?.name === toolName;
  const reason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : null, reasoning = usage?.completion_tokens_details?.reasoning_tokens;
  return {
    // OpenAI reports "stop" when the request forced the function; the call itself is the evidence there.
    finish: reason === 'tool_calls' || (format === 'openai' && reason === 'stop' && valid) ? 'tool_calls' : reason === 'length' ? 'length' : reason === 'stop' ? 'stop' : 'other', finishReason: reason,
    content: typeof message?.content === 'string' ? message.content : null, tool: valid, ...(valid ? { toolArguments: tools[0].function.arguments } : {}),
    rawMessage: { content: message?.content ?? null, tool_calls: message?.tool_calls ?? null },
    usage: usage && [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].every(count) ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens,
      ...(count(reasoning) && reasoning <= usage.completion_tokens ? { reasoningTokens: reasoning } : {}) } : null,
    reasoningTokens: count(reasoning) ? reasoning : null };
}
