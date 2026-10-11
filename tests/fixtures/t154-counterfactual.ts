import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load known-bad code in this test process only. The working tree and concurrent
// checks remain untouched, and every mutant must fail the unchanged contract.
const mode = process.env.T154_MUTANT;
if (!['parent', 'headers', 'materials', 'ids'].includes(mode ?? '')) throw new Error('Set T154_MUTANT to a named counterfactual');
registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  if (!url.startsWith('file:')) return loaded;
  const file = path.relative(process.cwd(), fileURLToPath(url));
  if (mode === 'parent' && ['lib/code-site-check.ts', 'lib/code-site-model.ts', 'lib/code-site-store.ts', 'lib/code-site.ts'].includes(file))
    return { ...loaded, source: execFileSync('git', ['show', `2bccc24:${file}`], { encoding: 'utf8' }) };
  if (file !== 'lib/code-site-fact-segments.ts' && file !== 'lib/code-site-model.ts') return loaded;
  let source = loaded.source!.toString();
  if (mode === 'headers') source = source.replace('[conditions, own(structure), labels, read(row).trim()]', '[conditions, own(structure), read(row).trim()]');
  if (mode === 'materials') source = source.replace(' && review.materials === materials && review.sourceMaterials === sourceMaterials', '');
  if (mode === 'ids') source = source.replace('!parsed.success || ids.length !== input.segments.length || new Set(ids).size !== ids.length || input.segments.some(segment => !ids.includes(segment.id))', '!parsed.success');
  return { ...loaded, source };
} });
