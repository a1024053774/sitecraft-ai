import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Isolated readiness contract: visitor-owned keys must not make a usable server
// unhealthy; a failed database must remain unhealthy; browser storage has no DB.
// The actual PostgreSQL/Chrome boundary is separately exercised on Windows.
let databaseReady = true, calls = 0;
(globalThis as any).__t208Database = async () => { calls++; if (!databaseReady) throw new Error('database unavailable'); };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/lib/postgres') return { shortCircuit: true, url: 'data:text/javascript,export const checkDatabaseConnection=()=>globalThis.__t208Database()' };
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const { GET } = await import('../app/api/health/route.ts');

for (const ready of [true, false]) test(`production readiness with a visitor key and database ready=${ready}`, async () => {
  const previous = process.env.NODE_ENV; (process.env as Record<string, string>).NODE_ENV = 'production';
  process.env.SITE_STORE = 'postgres'; databaseReady = ready; calls = 0;
  try {
    const response = await GET(), payload = await response.json();
    assert.equal(response.status, ready ? 200 : 503);
    assert.equal(payload.deepseek.configured, false);
    assert.equal(payload.persistence.database, ready ? 'ready' : 'unavailable');
    assert.equal(calls, 1);
  } finally { (process.env as Record<string, string | undefined>).NODE_ENV = previous; }
});

test('browser storage readiness neither needs nor probes PostgreSQL', async () => {
  const previous = process.env.NODE_ENV; (process.env as Record<string, string>).NODE_ENV = 'production';
  process.env.SITE_STORE = 'browser'; databaseReady = false; calls = 0;
  try { const response = await GET(); assert.equal(response.status, 200); assert.equal(calls, 0); }
  finally { (process.env as Record<string, string | undefined>).NODE_ENV = previous; }
});
