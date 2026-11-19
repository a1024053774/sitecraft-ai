// T-221: lets a stand-in that answers in the DeepSeek shape be asked in the
// OpenAI or Anthropic wire format. It only translates the envelope; what the
// stand-in answers is unchanged. Never a claim about a real provider.
export type Dialect = 'deepseek' | 'openai' | 'anthropic';
export function dialectOf(url: string | undefined): Dialect {
  return url?.endsWith('/messages') ? 'anthropic' : url?.includes('/beta/') ? 'deepseek' : 'openai';
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toDeepSeekBody(dialect: Dialect, body: any): any {
  if (dialect !== 'anthropic') return body;
  return { model: body.model, max_tokens: body.max_tokens, messages: [{ role: 'system', content: body.system }, ...body.messages],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(body.tools ? { tools: body.tools.map((tool: any) => ({ type: 'function', function: { name: tool.name, description: tool.description, strict: true, parameters: tool.input_schema } })) } : {}) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDeepSeekReply(dialect: Dialect, reply: any): any {
  const choice = reply.choices?.[0], call = choice?.message?.tool_calls?.[0];
  if (dialect === 'deepseek' || !choice) return reply;
  // OpenAI reports "stop" for a function the request forced.
  if (dialect === 'openai') return { ...reply, choices: [{ ...choice, finish_reason: call && choice.finish_reason === 'tool_calls' ? 'stop' : choice.finish_reason }] };
  return { id: 'msg_fixture', type: 'message', role: 'assistant', model: 'fixture',
    content: call ? [{ type: 'tool_use', id: 'toolu_fixture', name: call.function.name, input: JSON.parse(call.function.arguments) }] : [{ type: 'text', text: choice.message.content ?? '' }],
    stop_reason: choice.finish_reason === 'length' ? 'max_tokens' : call ? 'tool_use' : 'end_turn',
    ...(reply.usage ? { usage: { input_tokens: reply.usage.prompt_tokens, output_tokens: reply.usage.completion_tokens } } : {}) };
}
