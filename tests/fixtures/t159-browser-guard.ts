import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith('lib/code-site-browser.ts')) return { shortCircuit: true,
    url: 'data:text/javascript,export async function codeCheckBrowser(){throw new Error("T159 selection contract does not capture controls")}' };
  return next(specifier, context);
} });
