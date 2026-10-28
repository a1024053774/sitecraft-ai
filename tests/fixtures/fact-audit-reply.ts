// The HTTP fixtures control semantic outcomes; this only encodes those outcomes
// in the numbered protocol. T-154's adversarial fixture does not use this helper.
export function factAuditReply(body: { messages: Array<{ content: string }> }, reply: unknown): unknown {
  if (!reply || typeof reply !== 'object' || !('issues' in reply) || !Array.isArray(reply.issues)) return reply;
  const user = body.messages[1].content;
  if (!user.startsWith('{')) return reply;
  const input = JSON.parse(user.split('\n')[0]);
  if (!Array.isArray(input.segments)) return reply;
  const results = input.segments.map((segment: { id: string; text: string }) => ({ id: segment.id, issues: [] as string[], noFacts: true, factCategories: [] as string[], citations: [] }));
  for (const issue of reply.issues) {
    const quote = String(issue).replace(/^页面原句[：:]\s*/, '').split(/[；;]/)[0];
    const index = input.segments.findIndex((segment: { text: string }) => segment.text.includes(quote));
    results[index < 0 ? 0 : index].issues.push(String(issue));
  }
  return { results };
}

// Semantic fixtures keep their independently supplied expected claims. This
// encoder selects wire references from the request without importing runtime
// code. Protocol-adversarial T-210 cases construct their own raw replies.
export function factAuditPayload(body: any, payload: any): any {
  if (body.tools?.[0]?.function.name !== 'submit_fact_review') return payload;
  const choice = payload.choices?.[0];
  if (!choice) return payload;
  const input = JSON.parse(body.messages[1].content.split('\n')[0]);
  let answer;
  const raw = choice.message?.content ?? choice.message?.tool_calls?.[0]?.function.arguments;
  try { answer = JSON.parse(raw); }
  catch { return { ...payload, choices: [{ ...choice, finish_reason: choice.finish_reason === 'stop' ? 'tool_calls' : choice.finish_reason,
    message: { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_fact_review', arguments: raw } }] } }] }; }
  const numbered = answer && Array.isArray(answer.results);
  if (numbered) {
    const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const duplicate = new Set(answer.results.map((row: any) => row.id)).size !== answer.results.length;
    const extras = Object.fromEntries(Object.entries(answer).filter(([key]) => key !== 'results'));
    answer = { ...extras, ...Object.fromEntries(answer.results.map(({ id, ...row }: any) => {
      const segment = input.segments.find((s: any) => s.id === id);
      if (Array.isArray(row.citations)) row.citations = row.citations.map((citation: any) => {
        const claim = segment?.claims?.filter((c: any) => normalize(citation.claim) && normalize(c.text).includes(normalize(citation.claim)))
          .sort((a: any, b: any) => a.text.length - b.text.length)[0];
        const quote = input.sourceQuotes?.filter((q: any) => normalize(citation.quote) && normalize(q.text).includes(normalize(citation.quote)))
          .sort((a: any, b: any) => a.text.length - b.text.length)[0];
        return { category: citation.category, claimRef: claim?.id ?? 'invalid-claim', quoteRef: quote?.id ?? 'invalid-quote' };
      });
      return [id, row];
    })), ...(duplicate ? { duplicateResults: true } : {}) };
  }
  return { ...payload, choices: [{ ...choice, finish_reason: choice.finish_reason === 'stop' ? 'tool_calls' : choice.finish_reason,
    message: { content: null, tool_calls: [{ type: 'function', function: { name: 'submit_fact_review', arguments: numbered ? JSON.stringify(answer) : raw } }] } }] };
}
