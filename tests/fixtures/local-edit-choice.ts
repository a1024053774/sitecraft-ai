// 只编码替身已决定的业务结果，不读取生产 schema 或推断期望答案。
export function localEditChoice(answer: unknown) {
  const parameters = answer && typeof answer === 'object'
    ? 'cannotEdit' in answer ? { html: '', css: '', ...answer } : { cannotEdit: '', ...answer }
    : answer;
  return { finish_reason: 'tool_calls', message: { content: null, tool_calls: [
    { id: 'local-edit-fixture', type: 'function', function: { name: 'submit_local_edit', arguments: JSON.stringify(parameters) } },
  ] } };
}
