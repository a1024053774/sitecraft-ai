import { localEndpoint } from './local-endpoint.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

const base = localEndpoint('SITECRAFT_BASE').origin;
const id = 'fefa658d-7ce3-499a-8026-431f33313731';
const folder = `artifacts/t152/chat-boundaries-${Date.now()}`;
await mkdir(folder, {recursive:true});
const records: unknown[] = [];
const post = async (body: unknown) => { const response = await fetch(`${base}/api/sites/${id}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}; };
const initial = (await post({action:'state'})).body.codeSite;
const source = initial.versions.find((v:any)=>v.id===initial.currentVersionId);
const browser = await codeCheckBrowser();
const target = await browser.evaluate(`(()=>{const el=new DOMParser().parseFromString(${JSON.stringify(source.code.pages[0].html)},'text/html').querySelector('main').children[0];return {kind:'dom',pageId:'home',versionId:${JSON.stringify(source.id)},path:[0],text:el.textContent.replace(/\\s+/g,' ').trim().slice(0,1000),label:'首屏'}})()`);
await browser.close();
async function done(previous: string) {
  for(let i=0;i<90;i++) { const site=(await post({action:'state'})).body.codeSite;
    if(site.run.id!==previous && site.run.status!=='running')return site;
    await new Promise(resolve=>setTimeout(resolve,500));
  } throw new Error('fixture workflow timed out');
}
try {
  assert.equal((await post({message:'过期意见',baseRevision:source.revision,selectedTarget:{...(target as object),versionId:'stale'}})).status,409);
  for(const message of ['[fixture-whole-page]','[fixture-shared-css]']) {
    const previous=(await post({action:'state'})).body.codeSite.run.id;
    const input={message,baseRevision:source.revision,selectedTarget:target};
    const answers=await Promise.all([post(input),post(input)]);
    assert.deepEqual(answers.map(r=>r.status).sort(),[202,409]);
    const site=await done(previous);records.push(site.run);
    assert.equal(site.run.status,'error');assert.equal(site.currentVersionId,source.id);
    assert.equal(site.versions.length,initial.versions.length);
    assert.equal(site.run.repairRound,2);
    assert.deepEqual(site.run.modelCalls.map((call:any)=>call.purpose),['local-edit','local-edit','local-edit']);
    assert.equal(site.run.localResponses.length,3);
    assert.match(site.run.issues.join('\n'),message.includes('whole-page')?/不能返回整页/:/局部修改越界/);
  }
  const failedPrevious=(await post({action:'state'})).body.codeSite.run.id;
  assert.equal((await post({message:'[fixture-fact-truncation]',baseRevision:source.revision,selectedTarget:target})).status,202);
  const failed=await done(failedPrevious);records.push(failed.run);
  assert.equal(failed.run.status,'error');assert.equal(failed.currentVersionId,source.id);
  assert.match(failed.run.step,/回答被截断/);
  assert.ok(Array.isArray(failed.run.localResponses),'a candidate must survive a fact provider failure');
  assert.equal(failed.run.localResponses.length,1);
  assert.equal(typeof failed.run.localResponses[0].response.html,'string');
  const previous=(await post({action:'state'})).body.codeSite.run.id;
  const answer=await post({message:'更克制',pageId:'products',baseRevision:source.revision});assert.equal(answer.status,202);
  const site=await done(previous); records.push(site.run);
  assert.equal(site.run.status,'complete'); assert.equal(site.run.selectedTarget,undefined);assert.equal(site.run.pageId,'products');
  assert.deepEqual(site.run.modelCalls.map((call:any)=>call.purpose),['select','write','facts']);
  console.log('PASS: stale anchor, duplicate claim, whole-page/shared-CSS correction limits, no-selection route');
} finally { await writeFile(`${folder}/report.json`,JSON.stringify(records,null,2));console.log(folder); }
