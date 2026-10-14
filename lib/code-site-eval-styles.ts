import { codeStyleOptions, codeStyles, codeStyleSchema, type CodeStyle } from './code-site-styles.ts';

// Server-only import graph: Next configuration and the chat workflow.
// Keep the client catalog and auto planning restricted to verified directions.
const value = process.env.SITECRAFT_EVAL_STYLES?.trim();
const ids = value ? value.split(',').map(id => id.trim()) : [];
const candidates = [...new Set(ids)].map(id => {
  const parsed = codeStyleSchema.safeParse(id);
  const style: CodeStyle | undefined = parsed.success ? codeStyles[parsed.data] : undefined;
  if (!parsed.success || !style || style.preview.status !== 'pending')
    throw new Error('SITECRAFT_EVAL_STYLES 只能包含已登记且为 pending 的风格编号。');
  return { id: parsed.data, label: style.label, description: style.description };
});
export const serverCodeStyleOptions = [...codeStyleOptions, ...candidates];

export class CodeStyleAdmissionError extends Error {
  constructor() { super('已选风格当前不能使用，未开始任务。请在准入该风格的评估环境操作，或取消方案后重新选择。'); }
}
// One admission decision for model-task claims and checked submissions.
// No style means no selected direction, as on an initial manual submission.
export function requireModelTaskAdmission(style: string | undefined) {
  if (style && !serverCodeStyleOptions.some(option => option.id === style)) throw new CodeStyleAdmissionError();
}
