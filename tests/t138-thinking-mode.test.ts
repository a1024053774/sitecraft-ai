import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { CodeModelCall, SiteCode } from '../lib/code-site.ts';

// Protocol failures: writing loses thinking; planning loses thinking or
// strict output; repair keeps consuming reasoning; invalid config falls back;
// response_format/budget changes; a provider rejection triggers a retry.
registerHooks({resolve(specifier,context,next){
  if(!specifier.startsWith('@/'))return next(specifier,context);
  const file=path.join(process.cwd(),specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`)?`${file}.ts`:file).href,context);
}});
const code: SiteCode={header:'<header>边界机械</header>',footer:'<footer>边界机械</footer>',css:'body{color:#111;background:#fff}',pages:[{id:'home',title:'首页',html:'<main><h1>边界机械</h1><p>终身保修。</p><p>不接食品接触零件。</p></main>'}]};
const requests: any[]=[];
let failed=false;
const server=createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw);requests.push({url:req.url,...body});
 if(failed){res.writeHead(402);res.end('{}');return}
 const user=body.messages[1].content,system=body.messages[0].content;
 const reply=body.tools?{summary:'加工与边界',style:'precision',styleReason:'加工资料',skeletonId:'compact-profile',skeletonReason:'资料以加工边界为主。',pages:[{id:'home',title:'首页',outline:['加工与联系']}]}
 :system.includes('事实校对员')?{issues:[]}:system.includes('修正输出合同')?{replacements:JSON.parse(user.slice(0,user.lastIndexOf('\n请以 json'))).fragments.map((f:{id:number})=>({fragmentId:f.id,after:'待补充。'}))}:code;
 const text=JSON.stringify(reply),thinking=body.thinking?.type!=='disabled';
 res.end(JSON.stringify({choices:[{finish_reason:body.tools?'tool_calls':'stop',message:body.tools?{content:null,tool_calls:[{type:'function',function:{name:'submit_page_plan',arguments:text}}]}:{content:text}}],usage:{prompt_tokens:17,completion_tokens:9,total_tokens:26,completion_tokens_details:{reasoning_tokens:thinking?7:0}}}));
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();assert.ok(address&&typeof address==='object');
process.env.DEEPSEEK_BASE_URL=`http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY='local-mode-fixture';process.env.DEEPSEEK_MODEL='local-mode-fixture';
const model=await import('../lib/code-site-model.ts');
const prefs={style:'precision' as const,layout:5,density:6};
test.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
test('defaults preserve thinking for write and facts; only repair is disabled while strict planning stays enabled',async()=>{
 const calls:CodeModelCall[]=[];
 delete process.env.SITE_CODE_CONTENT_THINKING;
 delete process.env.SITE_CODE_FACTS_THINKING;
 delete process.env.SITE_CODE_REPAIR_THINKING;
 await model.codeModelCalls.run(calls,()=>model.auditCodeFacts('精密加工','精密加工'));
 assert.equal(requests.at(-1).thinking.type,'enabled');
 await model.codeModelCalls.run(calls,async()=>{
  const planned=await model.planSiteCode('边界机械，精密加工',prefs,'规划');
  await model.writeSiteCode({materials:'边界机械，精密加工',preferences:prefs,plan:planned.plan,images:[],request:'生成'});
  await model.repairSiteCode({materials:'边界机械，精密加工',preferences:prefs,current:code,issues:['页面原句：终身保修。；资料未提供。'],cleaned:[]});
  await model.auditCodeFacts('边界机械，精密加工','不接食品接触零件。');
 });
 const [plan,...content]=requests.slice(1);
 assert.equal(plan.url,'/beta/chat/completions');assert.equal(plan.thinking.type,'enabled');
 assert.equal(plan.tools[0].function.strict,true);assert.equal(plan.tool_choice,'auto');
 assert.equal(plan.response_format,undefined);
 assert.equal(content.length,3);
 assert.deepEqual(content.map(body=>body.thinking.type),['enabled','disabled','enabled']);
 for(const body of content){assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(body.max_tokens,65536);assert.equal(body.tools,undefined)}
 assert.deepEqual(calls.map(c=>c.purpose),['facts','plan','write','repair','facts']);
 assert.deepEqual(calls.map(c=>c.usage?.reasoningTokens),[7,7,7,0,7]);
 assert.deepEqual(calls.slice(2).map(c=>(c as CodeModelCall&{thinking?:string}).thinking),['enabled','disabled','enabled']);
});
test('purpose overrides cannot turn off writing or strict planning',async()=>{
 process.env.SITE_CODE_FACTS_THINKING='disabled';process.env.SITE_CODE_REPAIR_THINKING='enabled';
 assert.equal(model.codeContentThinkingMode('write'),'enabled');
 assert.equal(model.codeContentThinkingMode('facts'),'disabled');
 assert.equal(model.codeContentThinkingMode('repair'),'enabled');
 await model.auditCodeFacts('精密加工','精密加工');
 assert.equal(requests.at(-1).thinking.type,'disabled');
 const planned=await model.planSiteCode('边界机械，精密加工',prefs,'规划');
 assert.equal(requests.at(-1).thinking.type,'enabled');
 assert.equal(requests.at(-1).tools[0].function.strict,true);
 await model.writeSiteCode({materials:'边界机械，精密加工',preferences:prefs,plan:planned.plan,images:[],request:'生成'});
 assert.equal(requests.at(-1).thinking.type,'enabled');
 await model.repairSiteCode({materials:'边界机械，精密加工',preferences:prefs,current:code,issues:['页面原句：终身保修。；资料未提供。'],cleaned:[]});
 assert.equal(requests.at(-1).thinking.type,'enabled');
 delete process.env.SITE_CODE_FACTS_THINKING;delete process.env.SITE_CODE_REPAIR_THINKING;
});
test('invalid purpose mode is rejected before calling the provider; 402 is not retried',async()=>{
 const before=requests.length;process.env.SITE_CODE_FACTS_THINKING='disable';
 await assert.rejects(model.auditCodeFacts('精密加工','精密加工'),/SITE_CODE_FACTS_THINKING/);
 assert.equal(requests.length,before);
 delete process.env.SITE_CODE_FACTS_THINKING;process.env.SITE_CODE_REPAIR_THINKING='disable';
 await assert.rejects(model.repairSiteCode({materials:'边界机械，精密加工',preferences:prefs,current:code,issues:['页面原句：终身保修。；资料未提供。'],cleaned:[]}),/SITE_CODE_REPAIR_THINKING/);
 assert.equal(requests.length,before);delete process.env.SITE_CODE_REPAIR_THINKING;
 process.env.SITE_CODE_FACTS_THINKING='disabled';failed=true;
 await assert.rejects(model.auditCodeFacts('精密加工','精密加工'),/HTTP 402/);
 assert.equal(requests.length,before+1);
 failed=false;delete process.env.SITE_CODE_FACTS_THINKING;
});
