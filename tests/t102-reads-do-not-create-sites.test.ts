import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
registerHooks({resolve(specifier,context,next){if(!specifier.startsWith('@/'))return next(specifier,context);const file=path.join(process.cwd(),specifier.slice(2));return next(pathToFileURL(existsSync(file+'.ts')?file+'.ts':file).href,context)}});
const draft=await import('../app/api/sites/[siteId]/draft/route.ts');
const chat=await import('../app/api/sites/[siteId]/chat/route.ts');
const published=await import('../app/published/[siteKey]/route.ts');
const {commitSiteCode}=await import('../lib/code-site-store.ts');
const sites=await import('../app/api/sites/route.ts');
test('missing reads, edits, chat and publication do not create a site or an obsolete shadow',async()=>{
  const id=`t102-${crypto.randomUUID()}`,context={params:Promise.resolve({siteId:id})};
  assert.equal((await draft.GET(new Request('http://localhost'),context)).status,404);
  assert.equal((await draft.PUT(new Request('http://localhost',{method:'PUT',body:'{}'}),context)).status,404);
  assert.equal((await chat.POST(new Request('http://localhost',{method:'POST',body:'{}'}),context)).status,404);
  assert.equal((await published.GET(new Request('http://localhost'),{params:Promise.resolve({siteKey:id})})).status,404);
  await assert.rejects(()=>commitSiteCode({siteId:id,baseRevision:0,author:'user',summary:'恢复',request:'恢复',restoreVersionId:'absent'}),/找不到这个站点/);
  for(const folder of ['sites','code-sites'])assert.equal(existsSync(path.join('.sitecraft-data',folder,id+'.json')),false);
});
test('only explicit POST creates a code site and its state can be reread',async()=>{
  const created=await sites.POST(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'读取不新建'})}));
  assert.equal(created.status,201);const {id}=await created.json();
  assert.equal((await draft.GET(new Request('http://localhost'),{params:Promise.resolve({siteId:id})})).status,200);
  assert.equal(existsSync(path.join('.sitecraft-data/sites',id+'.json')),false);
});
