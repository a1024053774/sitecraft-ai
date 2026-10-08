import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SiteCode, CodeModelCall, CodeCheck } from '../lib/code-site.ts';

// Failure modes: a policy claim passes, a different rejection hides the pricing
// miss, or a fixture provider replaces DeepSeek. Expectations come from Astra's
// review and the supplied materials; they are never sent to the model.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const { checkSiteCode } = await import('../lib/code-site-check.ts');
const { codeModelCalls } = await import('../lib/code-site-model.ts');
const { providerConfig } = await import('../lib/ai-provider.ts');
assert.equal(providerConfig().model, 'deepseek-flash', 'this regression requires real deepseek-flash');
assert.equal(new URL(providerConfig().baseURL).hostname, 'api.deepseek.com', 'a fixture provider is not live evidence');
const fixtures: Array<{ source: string; case: number; materials: string; code: SiteCode; expectedRefusedClaims: string[] }> =
  JSON.parse(await readFile('tests/fixtures/t133/pricing-candidates.json', 'utf8'));
assert.deepEqual(fixtures.map(fixture => fixture.case), [7, 8], 'both original candidates are required');
const directory = process.argv[2] || path.join('artifacts/t133', `live-policy-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(directory); // Refuse to overwrite an earlier run.
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><body>事实检查回归的空白 HTML 来源</body></html>'); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); assert.ok(address && typeof address === 'object');
const previousBase = process.env.SITECRAFT_BASE;
process.env.SITECRAFT_BASE = `http://127.0.0.1:${address.port}`;
const results: Array<{ case: number; repetition: number; passed: boolean; file: string }> = [];
try {
  for (const fixture of fixtures) for (const repetition of [1, 2, 3]) {
    const calls: CodeModelCall[] = [], file = `case-${fixture.case}-run-${repetition}.json`;
    let result: { checks: CodeCheck };
    try {
      result = await codeModelCalls.run(calls, () => checkSiteCode({ siteId: `t133-live-policy-${fixture.case}`, code: fixture.code, materials: fixture.materials, images: [] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = calls.some(call => call.httpStatus === null || call.httpStatus >= 400) ? 'BLOCKED' : 'INCOMPLETE';
      await writeFile(path.join(directory, file), JSON.stringify({ time: new Date().toISOString(), source: fixture.source, repetition, error: message, calls }, null, 2), 'utf8');
      await writeFile(path.join(directory, 'summary.json'), JSON.stringify({ status, requiredRuns: 6, results, aborted: { case: fixture.case, repetition, file, error: message } }, null, 2), 'utf8');
      throw error; // Preserve the failed command; never replace an upstream error with a verdict.
    }
    await writeFile(path.join(directory, file), JSON.stringify({ time: new Date().toISOString(), source: fixture.source, repetition, checks: result.checks, calls }, null, 2), 'utf8');
    const passed = !result.checks.passed && calls.length === 1 && calls[0].purpose === 'facts'
      && calls[0].httpStatus === 200 && calls[0].model === 'deepseek-flash'
      && fixture.expectedRefusedClaims.some(claim => result.checks.issues.some(issue => issue.includes(claim)));
    results.push({ case: fixture.case, repetition, passed, file });
    console.log(`${passed ? 'PASS' : 'INCOMPLETE'} case-${fixture.case} ${repetition}/3: ${file}`);
    // The three runs are a fixed acceptance sample, not retries. Preserve all
    // outcomes and fail the command if any one misses the required policy.
    await writeFile(path.join(directory, 'summary.json'), JSON.stringify({ status: results.length === 6 && results.every(r => r.passed) ? 'PASS' : 'INCOMPLETE', requiredRuns: 6, results }, null, 2), 'utf8');
  }
  if (results.length !== 6 || results.some(r => !r.passed)) process.exitCode = 1;
} finally {
  if (previousBase === undefined) delete process.env.SITECRAFT_BASE; else process.env.SITECRAFT_BASE = previousBase;
  await new Promise<void>(resolve => server.close(() => resolve()));
}
