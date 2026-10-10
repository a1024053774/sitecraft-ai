import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, symlink } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

// Contract failure modes: creating a site still requires a retired template;
// a new site has a hidden legacy shadow; listing omits code-only records.
// Expected behavior is the approved T-145 code-only route, not a renderer result.
const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(project, 'artifacts/t145', `entry-${crypto.randomUUID()}`);
await mkdir(root, { recursive: true });
// The pre-removal store reads its scan at module load. Use the real read-only
// source in this isolated cwd without copying implementation files as evidence.
await symlink(path.join(project, 'scripts'), path.join(root, 'scripts'), 'dir');
process.chdir(root);
process.env.SITE_STORE = 'fs';
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(project, specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const { POST, GET } = await import('../app/api/sites/route.ts');

test('T-145: the real creation/list handlers use code sites without a template or legacy shadow', async () => {
  const response = await POST(new Request('http://localhost/api/sites', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '窄口精密加工' }),
  }));
  assert.equal(response.status, 201, 'a name creates the sole new-route site; retired templates are unnecessary');
  const created = await response.json();
  assert.equal(created.codeSite.name, '窄口精密加工');
  assert.equal(existsSync(path.join(root, '.sitecraft-data/sites', `${created.id}.json`)), false, 'creation must not write an obsolete draft');
  const stored = JSON.parse(await readFile(path.join(root, '.sitecraft-data/code-sites', `${created.id}.json`), 'utf8'));
  assert.equal(stored.versions.length, 0);
  const listed = await (await GET()).json();
  assert.equal(listed.sites.find((item: { siteId: string }) => item.siteId === created.id)?.siteName, '窄口精密加工');
});
