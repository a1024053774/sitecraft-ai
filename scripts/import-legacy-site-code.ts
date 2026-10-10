import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { codeSiteSchema } from '../lib/code-site.ts';
import { commitSiteCode } from '../lib/code-site-store.ts';

// T-145: offline entry only. It imports exported data through the same checked
// commit as generation and editing, and never reads or rewrites legacy JSON.
const source = z.object({ revision: z.number().int().nonnegative(), updatedAt: z.string() });
const identity = { siteId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i), name: z.string().min(1).max(100), source };
const identitySchema = z.object(identity);
const input = z.discriminatedUnion('kind', [
  z.object({ ...identity, kind: z.literal('convert'), materials: z.string(), code: codeSiteSchema, exportIssues: z.array(z.string()) }),
  z.object({ ...identity, kind: z.literal('protected') }),
  z.object({ ...identity, kind: z.literal('failed'), reason: z.string().min(1) }),
]);
const args = process.argv.slice(2);
const inputPath = args[args.indexOf('--input') + 1], outputPath = args[args.indexOf('--out') + 1];
if (!args.includes('--input') || !args.includes('--out') || !inputPath || !outputPath) throw new Error('Use --input <exported JSON> --out <new report JSON>.');
// Reserve the report before mutating storage; failure evidence is never replaced.
const reportFile = await import('node:fs/promises').then(fs => fs.open(outputPath, 'wx'));
const results: unknown[] = [];
let failed = false;
try {
  const raw = JSON.parse(await readFile(inputPath, 'utf8'));
  const candidates = (Array.isArray(raw) ? raw : [raw]).map(value => {
    const identified = identitySchema.parse(value);
    const parsed = input.safeParse({ kind: 'convert', ...value });
    return parsed.success ? parsed.data : { ...identified, kind: 'failed' as const,
      reason: `旧代码结构校验未通过：${parsed.error.issues.map(issue => `${issue.path.join('.')}：${issue.message}`).join('；')}` };
  });
  if (new Set(candidates.map(candidate => candidate.siteId)).size !== candidates.length) throw new Error('Duplicate site IDs in import input.');
  for (const candidate of candidates) {
    const { siteId, ...legacyImport } = candidate;
    const result = await commitSiteCode({ siteId, legacyImport });
    results.push({ siteId, status: result.status,
      ...(result.status === 'applied' ? { versionId: result.version.id, revision: result.version.revision, checks: result.version.checks } : { record: result.record }) });
    if (result.status !== 'applied' && result.record.route === 'unavailable' && result.record.status === '旧站转换失败') failed = true;
    console.log(JSON.stringify({ siteId, status: result.status }));
  }
} catch (error) {
  failed = true;
  results.push({ executionError: error instanceof Error ? error.message : String(error) });
  throw error;
} finally {
  await reportFile.writeFile(JSON.stringify({ at: new Date().toISOString(), input: inputPath, cwd: process.cwd(), results }, null, 2) + '\n', 'utf8');
  await reportFile.close();
}
if (failed) process.exitCode = 1;
