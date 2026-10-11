import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Failure modes: restoration pays for unchanged checked facts again; changed or
// unknown materials reuse an old conclusion; unreviewed imports count as audited;
// deterministic checks disappear; ordinary writes stop auditing; provenance is lost.
registerHooks({ resolve(specifier,context,next) {
  if (!specifier.startsWith('@/')) return next(specifier,context);
  const file=path.join(process.cwd(),specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`)?`${file}.ts`:file).href,context);
} });
let calls=0, reject=false, invalidOrigin=false;
const server=createServer(async(req,res)=>{
  if(req.method==='GET'){res.setHeader('content-type',invalidOrigin?'application/json':'text/html');res.end(invalidOrigin?'{}':'<html><body>isolated test origin</body></html>');return;}
  for await (const _chunk of req) { /* consume the local provider input */ }
  calls++; res.setHeader('content-type','application/json');
  res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({issues:reject?['资料已改变，重新核对拒绝']:[]})}}],usage:{prompt_tokens:100,completion_tokens:5,total_tokens:105}}));
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();assert.ok(address&&typeof address==='object');
process.env.SITE_STORE='fs';process.env.SITECRAFT_DATA_ROOT=path.resolve('artifacts/t152/restore-reuse/data');
// This ephemeral origin is only a deterministic checker fixture, never a workspace.
process.env.SITECRAFT_BASE=`http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_BASE_URL=process.env.SITECRAFT_BASE;process.env.DEEPSEEK_API_KEY='restore-fixture';process.env.DEEPSEEK_MODEL='restore-fixture';
const {createCodeSite,updateCodeSite,commitSiteCode,getCodeSite}=await import('../lib/code-site-store.ts');
const {getOrCreateConversation}=await import('../lib/conversation-store.ts');
const {codeCheckLabel,reviewedMaterialSnapshot}=await import('../lib/code-site.ts');
const {POST:history}=await import('../app/api/sites/[siteId]/history/[action]/route.ts');
test.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
const materials='同源纸品做纸盒，不承接裸装食品。';
const code={header:'',footer:'',css:'body{margin:0;background:#fff;color:#111;font:16px/1.6 sans-serif}main{padding:24px}',pages:[{id:'home',title:'首页',html:'<main><h1>同源纸品</h1><p>纸盒，不承接裸装食品。</p></main>'}]};
async function setup(){
  const id=`t152-restore-${crypto.randomUUID()}`,conversation=await getOrCreateConversation(id);
  await createCodeSite(id,'同源纸品',conversation.conversationId);await updateCodeSite(id,()=>({materials}));
  const start=calls;
  const first=await commitSiteCode({siteId:id,baseRevision:0,code,author:'user',summary:'初稿',request:''});
  assert.equal(first.status,'applied');if(first.status!=='applied')throw new Error('initial fixture failed');
  const second=await commitSiteCode({siteId:id,baseRevision:1,code:{...code,css:code.css+'h1{letter-spacing:.04em}'},author:'user',summary:'加字距',request:'只改字距'});
  assert.equal(second.status,'applied');assert.equal(calls-start,2,'generation and ordinary edits still audit facts');
  return {id,first:first.version};
}
const restore=(id:string,revision:number,versionId?:string)=>history(new Request('http://fixture.test',{method:'POST',body:JSON.stringify({baseRevision:revision,...(versionId?{versionId}:{})})}),{params:Promise.resolve({siteId:id,action:versionId?'restore':'undo'})});
test('unchanged-material undo uses zero model calls, stores provenance, and rechecks all viewports',async()=>{
  const {id,first}=await setup(),before=calls;
  const response=await restore(id,2);assert.equal(response.status,200);
  const site=(await response.json()).codeSite,version=site.versions.at(-1);
  await mkdir('artifacts/t152/restore-reuse',{recursive:true});
  await writeFile(`artifacts/t152/restore-reuse/undo-${Date.now()}.json`,JSON.stringify({callsBefore:before,callsAfter:calls,site},null,2));
  assert.equal(calls,before,'restoring checked code with unchanged materials must not call the model');
  assert.equal(version.revision,3);assert.equal(version.restoredFrom,first.id);
  assert.deepEqual(version.code,first.code);assert.equal(version.checks.passed,true);
  assert.deepEqual(version.checks.viewports.map((v:any)=>v.width),[375,768,1440]);
  assert.match(codeCheckLabel(version.checks),/沿用 v1 的事实核对/);
  assert.equal(version.checks.factReviewFrom.versionId,first.id);
  assert.equal(version.checks.factReviewFrom.checkedAt,first.checks.checkedAt);
});
test('changed materials are audited conservatively and a rejection creates no version',async()=>{
  const {id,first}=await setup();await updateCodeSite(id,()=>({materials:materials+'业务资料已更新。'}));
  const before=calls;reject=true;
  try {const response=await restore(id,2,first.id);assert.equal(response.status,422);assert.equal(calls,before+1);assert.equal((await getCodeSite(id))!.versions.length,2);}
  finally {reject=false;}
});
test('unreviewed legacy imports never supply a reusable fact conclusion',async()=>{
  const id=`t152-unreviewed-${crypto.randomUUID()}`;
  const first=await commitSiteCode({siteId:id,legacyImport:{kind:'convert',name:'同源纸品',materials,code,source:{revision:1,updatedAt:new Date().toISOString()},exportIssues:[]}});
  assert.equal(first.status,'applied');if(first.status!=='applied')throw new Error('import fixture failed');
  const before=calls;
  const result=await commitSiteCode({siteId:id,baseRevision:1,restoreVersionId:first.version.id,author:'user',summary:'恢复',request:'恢复'});
  assert.equal(result.status,'applied');assert.equal(calls,before+1);
});

test('cached facts cannot hide a deterministic checker failure',async()=>{
  const {id}=await setup(),before=calls;invalidOrigin=true;
  try {const response=await restore(id,2);assert.equal(response.status,422);assert.equal(calls,before);assert.equal((await getCodeSite(id))!.versions.length,2);}
  finally {invalidOrigin=false;}
});
test('historical source proof requires the complete initial generation link; missing evidence is unknown',async()=>{
  const {id,first}=await setup(),site=(await getCodeSite(id))!;
  const old={...first,author:'assistant' as const};delete old.materialSnapshot;
  assert.equal(reviewedMaterialSnapshot(site,old),undefined);
  const now=new Date().toISOString();
  const generate={id:'historical-generation',kind:'generate' as const,status:'complete' as const,baseRevision:0,versionId:old.id,request:materials,step:'完成',startedAt:now,updatedAt:now,repairRound:0,issues:[],attempts:[],
    modelCalls:[{purpose:'facts' as const,model:'recorded-model',startedAt:now,latencyMs:1,httpStatus:200,usage:null,response:{finishReason:'stop',answerChars:13,reasoningTokens:null}}]};
  const original={...old,request:materials};
  const historical={...site,runs:[generate]};
  assert.equal(reviewedMaterialSnapshot(historical,original),materials);
  for(const run of [{...generate,status:'error' as const},{...generate,versionId:'other-version'},{...generate,baseRevision:1},{...generate,request:'其他资料'},{...generate,modelCalls:[]}])
    assert.equal(reviewedMaterialSnapshot({...site,runs:[run]},original),undefined);
  assert.equal(reviewedMaterialSnapshot(historical,{...original,checks:{...original.checks,passed:false}}),undefined);
  assert.equal(reviewedMaterialSnapshot(historical,{...original,checks:{...original.checks,factReview:'legacy-unreviewed'}}),undefined);
});
test('restoring a previously reused version keeps the original audit timestamp',async()=>{
  const {id,first}=await setup();const initial=(await(await restore(id,2)).json()).codeSite.versions.at(-1);
  const before=calls,response=await restore(id,3,initial.id);assert.equal(response.status,200);assert.equal(calls,before);
  const result=(await response.json()).codeSite.versions.at(-1);
  assert.equal(result.checks.factReviewFrom.revision,3);
  assert.equal(result.checks.factReviewFrom.checkedAt,first.checks.checkedAt);
  assert.match(codeCheckLabel(result.checks),/沿用 v3 的事实核对/);
});
