import { factAuditReply, factAuditPayload } from './fixtures/fact-audit-reply.ts';
import { localEditChoice } from './fixtures/local-edit-choice.ts';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeFactMaterials, currentCodeVersion, type CodeSiteRecord } from '../lib/code-site.ts';

// Failures: a local audit still consumes reasoning; local mode changes global
// auditing; whole-site instructions/CSS enter a block request; compression
// paraphrases source facts or loses restored/current user supplements.
const requests: any[] = [];
const server = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(factAuditPayload(body, {choices:[body.messages[0].content.includes('事实校对员')?{finish_reason:'stop',message:{content:JSON.stringify(factAuditReply(body,{issues:[]}))}}:localEditChoice({html:'<section><h1>测试段</h1></section>',css:''})],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}})));
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();assert.ok(address&&typeof address==='object');
process.env.DEEPSEEK_BASE_URL=`http://127.0.0.1:${address.port}`;process.env.DEEPSEEK_API_KEY='local-only';process.env.DEEPSEEK_MODEL='deepseek-flash';
const { auditCodeFacts, writeLocalEdit } = await import('../lib/code-site-model.ts');
const { codeCheckBrowser } = await import('../lib/code-site-browser.ts');
test.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));

test('local fact requests disable thinking; whole-site default and configured mode remain unchanged',async()=>{
  delete process.env.SITE_CODE_FACTS_THINKING;
  await auditCodeFacts('纸盒交期：白样确认后 12–18 天。','白样确认后 12–18 天',true);
  const local=requests.at(-1);
  await auditCodeFacts('纸盒交期：白样确认后 12–18 天。','白样确认后 12–18 天');
  const whole=requests.at(-1);
  process.env.SITE_CODE_FACTS_THINKING='enabled';
  await auditCodeFacts('纸盒','纸盒',true);
  assert.equal(requests.at(-1).thinking.type,'disabled');
  assert.equal(local.thinking.type,'disabled');
  assert.ok(local.max_tokens>=4096,'non-thinking JSON findings need an adequate output allowance');
  assert.equal(whole.thinking.type,'enabled');assert.equal(whole.max_tokens,65536);
  process.env.SITE_CODE_FACTS_THINKING='disabled';
  await auditCodeFacts('纸盒','纸盒');assert.equal(requests.at(-1).thinking.type,'disabled');
  delete process.env.SITE_CODE_FACTS_THINKING;
});

test('compact local materials retain original wording and effective order, not duplicated initial data',()=>{
  const original='公司名：原文纸品\n纸盒：250–400 g/m²，不接裸装食品。';
  const site={materials:original,currentVersionId:'v3',versions:[
    {id:'v1',request:original},{id:'v2',request:'交期更正：白样确认后 20 天。'},
    {id:'v3',restoredFrom:'v1',request:'撤销'},
  ]} as unknown as CodeSiteRecord;
  const compact=Reflect.apply(codeFactMaterials,undefined,[site,'交期补充：白样确认后 18 天。','v3',true]);
  assert.equal(compact.split(original).length-1,1);assert.match(compact,/250–400 g\/m²，不接裸装食品。/);
  assert.doesNotMatch(compact,/20 天|撤销/);assert.match(compact,/白样确认后 18 天。/);
  assert.equal(codeFactMaterials(site).split(original).length-1,2,'whole-site material construction is unchanged');
});

test('block writing sends original materials, block HTML and matching CSS without site-wide planning instructions',async()=>{
  const code={header:'<header>页头哨兵</header>',footer:'<footer>页脚哨兵</footer>',css:'body{color:#111}.target{padding:24px}.outside{outline-color:tomato}.other-page{outline-color:gold}',
    pages:[{id:'home',title:'首页',html:'<main><section class="target"><h1>选中段</h1><p>规格：250–400 g/m²</p></section><section class="outside">区块外哨兵</section></main>'},
      {id:'products',title:'产品',html:'<main class="other-page"><h1>其他页哨兵</h1></main>'}]};
  const materials='规格原文：250–400 g/m²；没有食品直接接触许可。';
  await writeLocalEdit({current:code,target:{kind:'dom',pageId:'home',versionId:'test-version',path:[0],text:'选中段规格：250–400 g/m²',label:'选中段'},materials,preferences:{style:'precision',layout:5,density:6},
    plan:{style:'precision',styleReason:'既有目录',summary:'概要',pages:[{id:'home',title:'首页',outline:'产品与边界'},{id:'products',title:'产品',outline:'其他页大纲哨兵'}]},request:'精简文字',issues:[]});
  const body=requests.at(-1),input=JSON.parse(body.messages[1].content.split('\n')[0]);
  assert.equal(input.materials,materials);assert.match(input.html,/250–400 g\/m²/);assert.match(input.css,/\.target/);
  assert.doesNotMatch(JSON.stringify(body.messages),/区块外哨兵|其他页哨兵|页头哨兵|页脚哨兵|其他页大纲哨兵|tomato|gold/);
  assert.doesNotMatch(body.messages[0].content,/首屏导航桌面一行|站点代码是 header、footer、css 和 pages/);
});

if (process.env.T152_INPUT_LABEL) test('record the same real-sample writer input estimate without contacting DeepSeek',async()=>{
  const site=JSON.parse(await readFile('artifacts/t152/real-data/code-sites/fefa658d-7ce3-499a-8026-431f33313731.json','utf8'));
  const version=currentCodeVersion(site)!;
  const browser=await codeCheckBrowser();
  let text:string;
  try { text=await browser.evaluate<string>(`new DOMParser().parseFromString(${JSON.stringify(version.code.pages[0].html)},'text/html').querySelector('main').children[0].textContent.replace(/\\s+/g,' ').trim().slice(0,1000)`); }
  finally { await browser.close(); }
  const request='首屏标题更醒目，保留全部文字与事实，只调整选中区块的标题字距和顶部细线。';
  await writeLocalEdit({current:version.code,target:{kind:'dom',pageId:'home',versionId:version.id,path:[0],text,label:'青禾纸包装'},materials:Reflect.apply(codeFactMaterials,undefined,[site,request,site.currentVersionId,true]),preferences:site.preferences,plan:site.plan,request,issues:[]});
  const body=requests.at(-1),input=JSON.stringify(body),han=(input.match(/\p{Script=Han}/gu)??[]).length;
  const folder=`artifacts/t152/usage-revision/${process.env.T152_INPUT_LABEL||'estimate'}-${Date.now()}`;
  await mkdir(folder,{recursive:true});
  await writeFile(`${folder}/input.json`,JSON.stringify({label:process.env.T152_INPUT_LABEL,inputEstimate:Math.ceil(han*1.5+(input.length-han)/3+300),characters:input.length,body},null,2));
  console.log(folder);
});
