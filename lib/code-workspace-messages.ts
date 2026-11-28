import type { CodeFactSource } from './code-site-fact-segments.ts';
import type { ConversationTurn } from './conversation-store.ts';

export function uncompletedUserMessages(sources: CodeFactSource[] | undefined, turns: ConversationTurn[]) {
  const remaining = turns.map(turn => `\n\n${turn.userMessage}\n\n`);
  return (sources ?? []).filter(source => {
    const text = `\n\n${source.text}\n\n`;
    const index = remaining.findIndex(message => message.includes(text));
    if (index < 0) return true;
    remaining[index] = remaining[index].replace(text, '\n\n');
    return false;
  });
}
