import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Test-only metadata: use a registered pending catalog entry after the real
// neighborly direction is ready. The production gate and handlers stay intact.
const catalog = pathToFileURL(path.resolve('lib/code-site-styles.ts')).href;
registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  if (url !== catalog) return loaded;
  const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder().decode(loaded.source as AllowSharedBufferSource);
  const entry = /(neighborly: \{[\s\S]*?preview: )\{[^}]*\}/;
  assert.ok(entry.test(source), 'pending 目录夹具必须命中登记条目');
  return { ...loaded, source: source.replace(entry, '$1{ status: \'pending\' }') };
} });
