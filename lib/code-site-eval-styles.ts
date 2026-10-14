import { codeStyleOptions, codeStyles, codeStyleSchema } from './code-site-styles.ts';

// Server-only import graph: Next configuration and the chat workflow.
// Keep the client catalog and auto planning restricted to verified directions.
const value = process.env.SITECRAFT_EVAL_STYLES?.trim();
const ids = value ? value.split(',').map(id => id.trim()) : [];
const candidates = [...new Set(ids)].map(id => {
  const parsed = codeStyleSchema.safeParse(id);
  if (!parsed.success || codeStyles[parsed.data].preview.status !== 'pending')
    throw new Error('SITECRAFT_EVAL_STYLES 只能包含已登记且为 pending 的风格编号。');
  const style = codeStyles[parsed.data];
  return { id: parsed.data, label: style.label, description: style.description };
});
export const serverCodeStyleOptions = [...codeStyleOptions, ...candidates];
