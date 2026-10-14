import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Process-local mutations preserve this worktree and other agents' code.
const mode = process.env.T169_MUTANT;
if (!['normalize', 'quote', 'claim', 'reuse', 'bind', 'record', 'local', 'source', 'old'].includes(mode ?? '')) throw new Error('Set T169_MUTANT to a named counterfactual');
registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  if (!url.startsWith('file:')) return loaded;
  const file = path.relative(process.cwd(), fileURLToPath(url));
  if (!['lib/code-site-model.ts', 'lib/code-site-fact-segments.ts', 'lib/code-site-check.ts'].includes(file)) return loaded;
  let source = loaded.source!.toString(), before = source;
  if (file === 'lib/code-site-fact-segments.ts') {
    if (mode === 'normalize') source = source.replace("text.normalize('NFKC').replace(/\\s+/g, ' ').trim()", 'text');
    if (mode === 'source') source = source.replace(' && review.materials === materials && review.sourceMaterials === sourceMaterials', '');
    if (mode === 'reuse') source = source.replace("citations: accepted.get(segment.group)!.segments.find(previous => previous.group === segment.group && previous.text === segment.text)!.citations!", 'citations: []');
    if (mode === 'bind') source = source.replace('return { ...citation, targets };', 'return citation;');
  }
  if (file === 'lib/code-site-model.ts') {
    if (mode === 'quote') source = source.replace('if (!quote || !source.includes(quote))', 'if (false)');
    if (mode === 'claim') source = source.replace('if (!claim || !normalizeFactClaimText(segment.text).includes(claim))', 'if (false)');
  }
  if (file === 'lib/code-site-check.ts') {
    if (mode === 'old') source = source.replace("if (args.legacyImport) checks.factReview = 'legacy-unreviewed';", "if (args.legacyImport) { checks.factReview = 'legacy-unreviewed'; checks.factCitations = { complete: true, entries: [] }; }");
    if (mode === 'record') source = source.replace('entries: [...citations.values()]', 'entries: []');
    if (mode === 'local') source = source.replace('for (const citation of [...outside, ...receipts.flatMap(review => review.citations)])', 'for (const citation of receipts.flatMap(review => review.citations))');
  }
  if (before !== source) process.stderr.write(`T-169 counterfactual applied: ${mode} ${file}\n`);
  return { ...loaded, source };
} });
