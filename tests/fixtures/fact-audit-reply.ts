// The HTTP fixtures control semantic outcomes; this only encodes those outcomes
// in the numbered protocol. T-154's adversarial fixture does not use this helper.
export function factAuditReply(body: { messages: Array<{ content: string }> }, reply: unknown): unknown {
  if (!reply || typeof reply !== 'object' || !('issues' in reply) || !Array.isArray(reply.issues)) return reply;
  const user = body.messages[1].content;
  if (!user.startsWith('{')) return reply; // The unchanged selected-block contract.
  const input = JSON.parse(user.split('\n')[0]);
  if (!Array.isArray(input.segments)) return reply;
  const results = input.segments.map((segment: { id: string; text: string }) => ({ id: segment.id, issues: [] as string[] }));
  for (const issue of reply.issues) {
    const quote = String(issue).replace(/^页面原句[：:]\s*/, '').split(/[；;]/)[0];
    const index = input.segments.findIndex((segment: { text: string }) => segment.text.includes(quote));
    results[index < 0 ? 0 : index].issues.push(String(issue));
  }
  return { results };
}
