import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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
