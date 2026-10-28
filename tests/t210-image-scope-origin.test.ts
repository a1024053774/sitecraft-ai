import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import test from 'node:test';
import {codeCheckDocument} from './fixtures/code-check-document.ts';
registerHooks({resolve(s,c,next){return next(s.startsWith('@/')?pathToFileURL(path.join(process.cwd(),s.slice(2)+'.ts')).href:s,c)}});
const {createCodeSite,updateCodeSite,commitSiteCode,getCodeSite}=await import('../lib/code-site-store.ts');
const {getOrCreateConversation}=await import('../lib/conversation-store.ts');
const {saveSiteImage}=await import('../lib/site-images.ts');
const bytes=await readFile('tests/fixtures/company-images/industrial/product-gearbox-reducer.jpg');
let origins=0,invalidSecond=false,facts=0;
const requests:string[]=[];
const server=createServer(async(req,res)=>{
  if(req.method==='GET'){
    requests.push(req.url!);
    if(req.url==='/code-check.html'){origins++;res.writeHead(invalidSecond&&origins===2?404:200,{'content-type':'text/html'});res.end(codeCheckDocument);return}
    if(req.url?.includes('/images/')){res.writeHead(200,{'content-type':'image/jpeg'});res.end(bytes);return}
    res.writeHead(404);res.end();return;
  }
  let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw),input=JSON.parse(body.messages[1].content.split('\n')[0]);facts++;
  const answer=Object.fromEntries(input.segments.map((s:any)=>[s.id,{issues:[],noFacts:true,factCategories:[],citations:[]}]));
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'tool_calls',message:{content:null,tool_calls:[{type:'function',function:{name:'submit_fact_review',arguments:JSON.stringify(answer)}}]}}]}));
});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();assert.ok(addr&&typeof addr==='object');
process.env.SITECRAFT_BASE=`http://127.0.0.1:${addr.port}`;process.env.DEEPSEEK_BASE_URL=process.env.SITECRAFT_BASE;process.env.DEEPSEEK_API_KEY='t210-image-fixture';process.env.DEEPSEEK_MODEL='fixture';
test.after(()=>new Promise<void>(r=>server.close(()=>r())));
const out=`artifacts/t210/image-scope-${Date.now()}`;await mkdir(out,{recursive:true});
async function fixture(){
  invalidSecond=false;origins=0;
  const id=`t210-img-${crypto.randomUUID()}`,c=await getOrCreateConversation(id,id);await createCodeSite(id,'禾石设计社',c.conversationId);
  await updateCodeSite(id,()=>({materials:'机构名：禾石设计社\n展示项目图片。'}));
  const image=await saveSiteImage({siteId:id,bytes,originalName:'fixture.jpg',provenance:{license:'user-provided',usageScope:'current-site-only',usageCategory:'product'}});
  const code={header:'<header>禾石设计社</header>',footer:'<footer>禾石设计社</footer>',css:'body{margin:0;padding:24px;color:#111;background:white;font:18px/1.6 sans-serif}section{margin:20px 0}img{display:block;width:160px;height:auto}a:hover{text-decoration:underline}main:has(.changed) .photo img{width:30px}',pages:[{id:'home',title:'首页',html:`<main><section id="edit"><h1>项目介绍</h1><p>展示项目图片。</p><a href="#details">看项目</a></section><section class="photo" id="details"><h2>项目图片</h2><img data-image-id="${image.imageId}" alt="项目图片"></section></main>`}]};
  const first=await commitSiteCode({siteId:id,baseRevision:0,code,author:'user',request:'',summary:'源版本'});assert.equal(first.status,'applied');if(first.status!=='applied')throw Error('Source must pass');
  const target={kind:'dom' as const,pageId:'home',versionId:first.version.id,path:[0],text:'项目介绍展示项目图片。看项目',label:'项目介绍'};
  return{id,first,target};
}
for(const negative of[false,true])test(`same-origin image layout: ${negative?'a real outside width change still rejects':'a title-only local change passes all three widths'}`,async()=>{
  const f=await fixture();origins=0;requests.length=0;const before=facts;
  const code=structuredClone(f.first.version.code);code.pages[0].html=code.pages[0].html.replace('项目介绍</h1>','项目说明</h1>');if(negative)code.pages[0].html=code.pages[0].html.replace('id="edit"','id="edit" class="changed"');
  const result=await commitSiteCode({siteId:f.id,baseRevision:1,code,selectedTarget:f.target,author:'user',summary:'只改标题',request:''});await writeFile(`${out}/${negative?'outside-width':'title-only'}.json`,JSON.stringify({result,requests},null,2));
  assert.equal(result.status,negative?'rejected':'applied');
  const checks=result.status==='applied'?result.version.checks:result.checks;
  assert.deepEqual(checks.viewports.map(v=>v.width),[375,768,1440]);assert.ok(checks.viewports.every(v=>v.dynamicState?.mode==='states'&&v.dynamicState.source.statesChecked===4&&v.dynamicState.candidate.statesChecked===4));
  if(negative){assert.match(checks.issues.join(';'),/完整计算样式/);assert.equal(facts,before);assert.equal((await getCodeSite(f.id))!.versions.length,1)}else{assert.equal(checks.passed,true);assert.equal(origins,2);assert.ok(facts>before)}
});
test('the second checking browser must independently pass the static origin guard',async()=>{
  const f=await fixture();origins=0;invalidSecond=true;const before=facts;
  await assert.rejects(commitSiteCode({siteId:f.id,baseRevision:1,code:f.first.version.code,selectedTarget:f.target,author:'user',summary:'保留内容',request:''}),/提交检查静态页缺失或无效/);
  assert.equal(origins,2);assert.equal(facts,before);assert.equal((await getCodeSite(f.id))!.versions.length,1);invalidSecond=false;
});
