import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Observation only: run existing independent acceptance cases unchanged on
// parent and candidate. Record conclusions/reasons, never style fingerprints.
const checkUrl = pathToFileURL(path.resolve('lib/code-site-check.ts')).href;
const output = path.resolve('artifacts/t178', `equivalence-${Date.now()}-${process.pid}`);
mkdirSync(output, { recursive: true });
let sequence = 0;
(globalThis as any).__t178Record = (args: any, result: any, error?: unknown) => {
  const normalize = (value: string) => {
    for (const target of args.localEdit?.targets ?? (args.localEdit?.target ? [args.localEdit.target] : []))
      value = value.replaceAll(target.versionId, '<version>');
    return value.replaceAll(args.siteId, '<site>');
  };
  writeFileSync(path.join(output, `${sequence++}.json`), JSON.stringify({
    test: process.argv.find(value => value.endsWith('.test.ts')),
    pages: args.code.pages.map((page: any) => ({ id: page.id, title: page.title })),
    local: !!args.localEdit, passed: result?.checks.passed,
    issues: result?.checks.issues.map(normalize), error: error instanceof Error ? normalize(error.message) : error,
  }, null, 2) + '\n');
};
registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  if (resolved.url !== checkUrl) return resolved;
  return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    import { checkSiteCode as real } from ${JSON.stringify(checkUrl + '?t178-observe')};
    export async function checkSiteCode(args) {
      try { const result = await real(args); globalThis.__t178Record(args, result); return result; }
      catch (error) { globalThis.__t178Record(args, undefined, error); throw error; }
    }
  `) };
} });
