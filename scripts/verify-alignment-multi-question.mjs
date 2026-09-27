import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SITECRAFT_BASE || 'http://127.0.0.1:3034';
const out = process.argv[2] || `artifacts/t019-http-${Date.now()}`;
await mkdir(out, { recursive: true });
const report = { command: `node scripts/verify-alignment-multi-question.mjs ${out}`, base, steps: [] };
async function request(step, url, body) {
  const response = await fetch(base + url, body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {});
  const text = await response.text();
  const events = text.startsWith('data:') ? text.split('\n\n').filter(x=>x.startsWith('data:')).map(x=>JSON.parse(x.slice(5))) : [];
  const result = events.length ? events.findLast(x=>x.type==='done') : JSON.parse(text);
  report.steps.push({step, url, input:body ?? null, status:response.status, events, result});
  await writeFile(`${out}/report.json`, JSON.stringify(report,null,2));
  assert.ok(response.ok, `${step}: HTTP ${response.status}`);
  assert.notEqual(result?.status,'error',`${step}: ${result?.code}`);
  return result;
}
try {
  const site = await request('create','/api/sites',{name:'T019 流体接头验收',templateId:'screwfast',locales:['zh','en']});
  const chat = `/api/sites/${site.id}/chat`;
  const start = await request('materials',chat,{action:'start',baseRevision:site.draft.revision,message:'【公司资料】公司名：临港流体接头。产品：不锈钢卡套接头，按图加工。目标：OEM采购提交批量规格询盘。联系方式和认证未提供。先做无图版，不编造事实。请先在同一张需求卡让我选择页面范围和色彩集，色彩集在石墨工坊与工程暖橙中选。'});
  const view = start.alignment;
  assert.ok(view.questions.length >= 1 && view.questions.length <= 4,'1–4 questions');
  for (const q of view.questions) {
    assert.ok(q.options.length >= 2 && q.options.length <= 4,'2–4 options');
    assert.ok(q.options.some(o=>o.recommended),'recommended marker');
    assert.equal(q.allowOther,true,'other is available');
  }
  const restored = await request('reload-before-submit',chat,{action:'state',conversationId:start.conversationId});
  assert.deepEqual(restored.alignment.questions,view.questions);
  const selections = view.questions.map(q=>({questionId:q.questionId,optionId:(q.options.find(o=>o.label.includes('石墨')) || q.options.find(o=>o.recommended)).id}));
  const selected = await request('submit-card',chat,{action:'select',conversationId:start.conversationId,questionId:view.questionId,questionRevision:view.questionRevision,selections});
  const reload = await request('reload-after-submit',chat,{action:'state',conversationId:start.conversationId});
  for(const selection of selections) assert.ok(reload.alignment.answers.some(a=>a.questionId===selection.questionId && a.optionId===selection.optionId));
  assert.deepEqual(reload.alignment.questions,view.questions,'submitted card restored');
  assert.equal(reload.alignment.awaitingConfirmation,true,'proposal ready');
  for(const a of reload.alignment.answers) assert.ok(reload.alignment.question.includes(a.note || a.label),'confirmation includes saved choice');
  const confirmed = await request('confirm',chat,{action:'confirm',conversationId:start.conversationId,questionId:reload.alignment.questionId,questionRevision:reload.alignment.questionRevision});
  assert.equal(confirmed.status,'applied');
  const draft = await request('preview-draft-readback',`/api/sites/${site.id}/draft`);
  assert.deepEqual(draft.draft,confirmed.draft);
  assert.ok(draft.draft.revision>site.draft.revision);
  const publishedHtml = await fetch(`${base}/published/${site.id}`).then(response => response.text());
  assert.ok(publishedHtml.includes(draft.draft.paletteId), 'published preview readback must expose selected palette');
  report.steps.push({step:'preview-published-readback',input:{siteId:site.id},status:200,result:{paletteId:draft.draft.paletteId,containsPaletteId:publishedHtml.includes(draft.draft.paletteId),containsCompanyName:publishedHtml.includes(draft.draft.companyName)}});
  report.result='PASS'; report.siteId=site.id;
} catch(error) { report.result='FAIL';report.error=String(error);process.exitCode=1; }
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({result:report.result,error:report.error,artifact:`${out}/report.json`}));
