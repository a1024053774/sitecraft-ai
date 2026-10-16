import { execFileSync } from 'node:child_process';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Load the reviewed implementation in memory. The standard npm test entry still
// owns server identity/storage; no source files or data roots are replaced.
const files = ['lib/code-site.ts', 'lib/code-site-export.ts', 'lib/code-site-serving.ts', 'lib/site-images.ts'];
const parent = new Map(files.map(file => [pathToFileURL(path.resolve(file)).href,
  stripTypeScriptTypes(execFileSync('git', ['show', `a111ff9:${file}`], { encoding: 'utf8' }))]));
registerHooks({ load(url, context, next) {
  const source = parent.get(url);
  return source === undefined ? next(url, context) : { format: 'module', source, shortCircuit: true };
} });
