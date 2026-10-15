import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
const calls: any[] = [];
const provider = createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  calls.push(JSON.parse(raw));res.setHeader('content-type','application/json');
  res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"html":"<article><h3>纸袋</h3><p>相同说明</p></article>","css":""}'}}]}));
});
await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));
const address=provider.address();assert.ok(address&&typeof address==='object');
process.env.DEEPSEEK_BASE_URL=`http://127.0.0.1:${address.port}`;
process.env.DEEPSEEK_API_KEY='local-only';process.env.DEEPSEEK_MODEL='local-only';
const {writeLocalEdit}=await import('../lib/code-site-model.ts');
test.after(()=>new Promise<void>(r=>provider.close(()=>r())));
const elements=[{path:[0],tag:'h3',text:'纸袋'},{path:[1],tag:'p',text:'相同说明'}];
const target={kind:'dom' as const,pageId:'home',versionId:'v1',path:[0],text:'纸袋相同说明',label:'纸袋',elements};
const args={current:{header:'',footer:'',css:'body{color:#111}',pages:[{id:'home',title:'首页',html:'<main><article><h3>纸袋</h3><p>相同说明</p></article><section><h2>外部</h2><p>相同说明</p></section></main>'}]},
  target,materials:'纸袋按用途说明规格。',preferences:{style:'precision' as const,layout:5,density:6},plan:{summary:'纸袋',style:'precision' as const,styleReason:'目录',pages:[{id:'home',title:'首页',outline:'纸袋'}]},request:'调整圈中的标题和说明',issues:[]};
test('模型只收到单区块和已核对的多个元素提示，不含区域坐标或外部 HTML',async()=>{
  await writeLocalEdit(args);
  const input=JSON.parse(calls.at(-1).messages[1].content.split('\n')[0]);
  assert.deepEqual(input.pointedElements,elements);assert.doesNotMatch(input.html,/外部/);
  assert.equal(input.rect,undefined);
});
test('多元素中任何一个路径、标签或快照失效，在模型调用前拒绝',async()=>{
  const before=calls.length;
  for(const bad of [{path:[8],tag:'p',text:'相同说明'},{path:[1],tag:'h3',text:'相同说明'},{path:[1],tag:'p',text:'错误快照'}])
    await assert.rejects(writeLocalEdit({...args,target:{...target,elements:[elements[0],bad]}}),/点中元素.*重新点选/);
  assert.equal(calls.length,before);
});
