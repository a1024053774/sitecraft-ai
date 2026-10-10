import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
registerHooks({resolve(specifier,context,next){if(!specifier.startsWith('@/'))return next(specifier,context);const file=path.join(process.cwd(),specifier.slice(2));return next(pathToFileURL(existsSync(file+'.ts')?file+'.ts':file).href,context)}});
const {GET}=await import('../app/published/[siteKey]/route.ts');
const {commitSiteCode}=await import('../lib/code-site-store.ts');
test('the published handler reports an unavailable site as an error page without editor chrome',async()=>{
  const id=`hygiene-${crypto.randomUUID()}`;
  await commitSiteCode({siteId:id,legacyImport:{kind:'protected',name:'保留上传',source:{revision:1,updatedAt:'2026-10-03T00:00:00Z'}}});
  const response=await GET(new Request('http://localhost/published/'+id),{params:Promise.resolve({siteKey:id})});
  assert.equal(response.status,422);const html=await response.text();assert.match(html,/旧站点未转换，含用户上传，已保留/);assert.doesNotMatch(html,/iframe|builder-shell|site-page-unsupported|site-page-source/);
});
