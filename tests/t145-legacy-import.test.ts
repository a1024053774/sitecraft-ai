import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Failure modes: adjoining cells invent a number; import skips layout checks;
// a refused candidate becomes a version; imports overwrite or duplicate records;
// public requests forge the offline import authority. Materials are independently
// written below. All Chrome checks are real; the only model endpoint is local.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(file+'.ts') ? file+'.ts' : file).href, context);
} });
let modelCalls = 0;
const server = createServer((req,res) => {
  if (req.url === '/') { res.setHeader('content-type','text/html'); res.end('<!doctype html><html><body></body></html>'); return; }
  modelCalls++; res.setHeader('content-type','application/json');
  res.end(JSON.stringify({ choices: [{ finish_reason:'stop', message: { content: JSON.stringify({ issues:['资料没有终身保修承诺。'] }) } }] }));
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address(); assert.ok(address && typeof address==='object');
const base=`http://127.0.0.1:${address.port}`;
process.env.SITE_STORE='fs'; process.env.SITECRAFT_BASE=base;
process.env.DEEPSEEK_BASE_URL=base; process.env.DEEPSEEK_API_KEY='local-test-only'; process.env.DEEPSEEK_MODEL='local-test-only';
const {checkSiteCode}=await import('../lib/code-site-check.ts');
const {commitSiteCode,getCodeSite,listCodeSites,CodeSiteUnavailableError,updateCodeSite}=await import('../lib/code-site-store.ts');
test.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
const code={header:'',footer:'',css:'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}td,th{padding:8px}p{max-width:32em}',
  pages:[{id:'home',title:'窄口精密加工',html:'<main><h1>窄口精密加工</h1><table><tr><td>NAK80</td><td>1</td></tr></table><p>材料与型腔数来自旧站。</p></main>'}]};
test('T-145: distinct source cells do not invent NAK801 during deterministic checking',async()=>{
  const checked=await checkSiteCode({siteId:'t145-cell-boundary',code,materials:'窄口精密加工。材料 NAK80；型腔数 1。材料与型腔数来自旧站。',images:[],legacyImport:true});
  assert.equal(checked.checks.passed,true,checked.checks.issues.join('\n'));
  assert.deepEqual(checked.checks.viewports.map(v=>v.width),[375,768,1440]);
  assert.equal(modelCalls,0,'offline import must not call the model');
});

const materials='窄口精密加工。材料 NAK80；型腔数 1。材料与型腔数来自旧站。';
const source={revision:3,updatedAt:'2026-10-03T14:31:52.252Z'};
test('T-145: trusted import stores one checked first version and repeat leaves it intact',async()=>{
  const siteId=`t145-import-${crypto.randomUUID()}`;
  const args={siteId,legacyImport:{kind:'convert' as const,name:'窄口精密加工',source,materials,code,exportIssues:[]}};
  const result=await commitSiteCode(args);assert.equal(result.status,'applied');
  if(result.status!=='applied')throw new Error('Expected import version');
  assert.equal(result.version.revision,1);assert.equal(result.version.author,'legacy-import');assert.equal(result.version.checks.factReview,'legacy-unreviewed');
  assert.deepEqual(result.version.checks.viewports.map(v=>v.width),[375,768,1440]);
  const repeated=await commitSiteCode({...args,legacyImport:{...args.legacyImport,name:'覆盖名称'}});
  assert.equal(repeated.status,'existing');assert.equal((await getCodeSite(siteId))!.versions.length,1);
  assert.equal((await getCodeSite(siteId))!.name,'窄口精密加工');
  assert.equal(existsSync(`.sitecraft-data/sites/${siteId}.json`),false);
  assert.equal(modelCalls,0);
});
test('T-145: a failed deterministic import has visible failure metadata and no version',async()=>{
  const siteId=`t145-failed-${crypto.randomUUID()}`;
  const result=await commitSiteCode({siteId,legacyImport:{kind:'convert',name:'拒收加工站',source,materials,exportIssues:[],
    code:{...code,css:code.css+'main{width:5000px}'}}});
  assert.equal(result.status,'unavailable');
  if(result.status!=='unavailable')throw new Error('Expected failure metadata');
  assert.match(result.record.readError,/旧站转换失败：.*横向溢出/);
  assert.deepEqual(result.record.checks!.viewports.map(v=>v.width),[375,768,1440]);
  assert.equal('versions' in result.record,false);
  const persisted=JSON.parse(await readFile(`.sitecraft-data/code-sites/${siteId}.json`,'utf8'));
  assert.equal('currentVersionId' in persisted,false);
  await assert.rejects(()=>getCodeSite(siteId),error=>error instanceof CodeSiteUnavailableError && error.message===result.record.readError);
  assert.equal((await listCodeSites()).find(row=>row.siteId===siteId)!.readError,result.record.readError);
  assert.equal((await commitSiteCode({siteId,legacyImport:{kind:'convert',name:'重跑',source,materials,code,exportIssues:[]}})).status,'existing');
  assert.equal(modelCalls,0);
});
test('T-145: protected uploads remain unavailable without a fabricated version',async()=>{
  const siteId=`t145-protected-${crypto.randomUUID()}`;
  await commitSiteCode({siteId,legacyImport:{kind:'protected',name:'保留上传',source}});
  const row=(await listCodeSites()).find(row=>row.siteId===siteId)!;
  assert.equal(row.status,'旧站点未转换，含用户上传，已保留');
  await assert.rejects(()=>getCodeSite(siteId),error=>error instanceof CodeSiteUnavailableError && error.message===row.readError);
});
test('T-145: public PUT cannot forge the offline import author or bypass model fact checking',async()=>{
  const {POST}=await import('../app/api/sites/route.ts');
  const {PUT}=await import('../app/api/sites/[siteId]/draft/route.ts');
  const created=await POST(new Request(base+'/api/sites',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'窄口精密加工'})}));
  assert.equal(created.status,201);const {id}=await created.json();
  await updateCodeSite(id,()=>({materials}));
  const warranty={...code,pages:[{...code.pages[0],html:code.pages[0].html.replace('</main>','<p>终身保修</p></main>')}]};
  const before=modelCalls;
  const response=await PUT(new Request(base+`/api/sites/${id}/draft`,{method:'PUT',headers:{'content-type':'application/json'},
    body:JSON.stringify({baseRevision:0,summary:'修改页面',code:warranty,author:'legacy-import',legacyImport:{kind:'convert',source,materials,code:warranty,name:'绕过'}})}),{params:Promise.resolve({siteId:id})});
  assert.equal(response.status,400);assert.equal(modelCalls,before,'offline import fields are rejected by the public schema');
  const ordinary=await PUT(new Request(base+`/api/sites/${id}/draft`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({baseRevision:0,summary:'修改页面',code:warranty})}),{params:Promise.resolve({siteId:id})});
  assert.equal(ordinary.status,422);assert.equal(modelCalls,before+1,'ordinary manual submissions still audit facts');
  assert.equal((await getCodeSite(id))!.versions.length,0);
});
