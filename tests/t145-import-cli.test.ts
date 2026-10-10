import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Failure modes: rerunning failed metadata exits successfully; invalid exported
// code is discarded without a visible entry. Each run uses its own data root.
test('offline CLI retains structural failures and reruns still return failure',async()=>{
  const root=path.resolve('artifacts/t145',`cli-${crypto.randomUUID()}`);await mkdir(root,{recursive:true});
  const input=path.join(root,'input.json'),record={siteId:'known-failure',name:'失败原名',source:{revision:3,updatedAt:'2026-10-03T00:00:00Z'},materials:'失败原名',exportIssues:[],code:{header:'',footer:'',css:'',pages:[]}};
  await writeFile(input,JSON.stringify(record));
  for(const run of ['first','repeat']){
    const out=path.join(root,run+'.json');
    const child=spawnSync(process.execPath,['--experimental-strip-types','scripts/import-legacy-site-code.ts','--input',input,'--out',out],{encoding:'utf8',env:{...process.env,SITE_STORE:'fs',SITECRAFT_DATA_ROOT:path.join(root,'data')}});
    await writeFile(path.join(root,run+'.txt'),child.stdout+child.stderr);
    assert.equal(child.status,1,'a stored conversion failure cannot become CLI success');
    const report=JSON.parse(await readFile(out,'utf8'));assert.equal(report.results[0].record.status,'旧站转换失败');assert.equal('versions' in report.results[0].record,false);
    if(run==='repeat')assert.equal(report.results[0].status,'existing');
  }
  const stored=JSON.parse(await readFile(path.join(root,'data/code-sites/known-failure.json'),'utf8'));
  assert.match(stored.readError,/旧代码结构校验未通过/);assert.equal('versions' in stored,false);
});

// Schema-valid HTML can still have no main, no h1, or an h1 outside main.
// Those candidate failures must be saved, and cannot abort the following site.
test('offline CLI saves missing main/h1 failures and continues the batch',{timeout:120000},async(t)=>{
  const root=path.resolve('artifacts/t145',`cli-structure-${crypto.randomUUID()}`);await mkdir(root,{recursive:true});
  t.diagnostic(`Failure evidence and CLI output: ${root}`);
  let unexpectedRequests=0;
  const server=createServer((request,response)=>{
    if(request.url!=='/')unexpectedRequests++;
    response.setHeader('content-type','text/html');response.end('<!doctype html><html><body></body></html>');
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');
  const candidate={name:'结构检查',source:{revision:1,updatedAt:'2026-10-10T00:00:00Z'},materials:'结构检查。精密加工。',exportIssues:[],
    code:{header:'',footer:'',css:'body{margin:0;color:#111;background:white;font:16px/1.6 sans-serif}main{padding:24px}p{max-width:32em}',
      pages:[{id:'home',title:'结构检查',html:'<main><h1>结构检查</h1><p>精密加工。</p></main>'}]}};
  const bad=[['missing-main','<h1>结构检查</h1><p>精密加工。</p>'],['missing-heading','<main><p>精密加工。</p></main>'],
    ['heading-outside-main','<h1>结构检查</h1><main><p>精密加工。</p></main>']];
  const records=[...bad.map(([siteId,html])=>({...candidate,siteId,code:{...candidate.code,pages:[{...candidate.code.pages[0],html}]}})),{...candidate,siteId:'valid-after-failures'}];
  const input=path.join(root,'input.json');await writeFile(input,JSON.stringify(records));
  try{
    const out=path.join(root,'report.json');
    const child=spawn(process.execPath,['--experimental-strip-types','scripts/import-legacy-site-code.ts','--input',input,'--out',out],{
      env:{...process.env,SITE_STORE:'fs',SITECRAFT_DATA_ROOT:path.join(root,'data'),SITECRAFT_BASE:`http://127.0.0.1:${address.port}`,DEEPSEEK_API_KEY:'',AI_API_KEY:''},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',chunk=>output+=String(chunk));child.stderr.on('data',chunk=>output+=String(chunk));
    const status=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
    await writeFile(path.join(root,'cli.txt'),output);
    assert.equal(status,1,'batch still reports failed conversions');
    const report=JSON.parse(await readFile(out,'utf8'));
    for(const [id] of bad){
      const result=report.results.find((row:{siteId:string})=>row.siteId===id);
      assert.ok(result?.record,`${id} must have stored failure metadata, rather than an execution exception`);
      assert.equal(result.status,'unavailable');assert.equal(result.record.status,'旧站转换失败');
      assert.match(result.record.readError,/^旧站转换失败：.*缺少 main 或 h1/);
      assert.equal('versions' in result.record,false);assert.equal(result.record.checks.passed,false);
      const stored=JSON.parse(await readFile(path.join(root,'data/code-sites',id+'.json'),'utf8'));
      assert.deepEqual(stored,result.record);
    }
    assert.equal(report.results.length,4,'deterministic structure failures do not terminate the CLI batch');
    assert.equal(report.results[3].status,'applied');assert.equal(report.results[3].revision,1);
    assert.equal(unexpectedRequests,0,'offline import never calls the model');
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
