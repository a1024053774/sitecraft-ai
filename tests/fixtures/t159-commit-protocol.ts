import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Only bootstrap stored versions for admission tests. It uses the production
// submission boundary but makes no browser/fact/model quality claim.
(globalThis as any).__t159CheckCalls = 0;
const checker = pathToFileURL(path.resolve('lib/code-site-check.ts')).href;
registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  if (resolved.url !== checker) return resolved;
  return { shortCircuit: true, url: 'data:text/javascript,export async function checkSiteCode(args){globalThis.__t159CheckCalls++;return {code:args.code,checks:{passed:true,issues:[],cleaned:[],checkedAt:new Date().toISOString(),viewports:[]}}}' };
} });
