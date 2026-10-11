import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SITECRAFT_BASE;
assert.equal(base, 'http://127.0.0.1:3170');
const folder = `artifacts/t153/materials-${Date.now()}`;
await mkdir(folder, { recursive: true });
const report: Record<string, any> = { status: 'INCOMPLETE' };
const api = async (route: string, body: any) => {
  const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); report.lastResponse = { status: response.status, data };
  assert.ok(response.ok, JSON.stringify(data)); return data;
};
try {
  const created = await api('/api/sites', { name: '恒川传动' }); report.siteId = created.id;
  const route = `/api/sites/${created.id}/chat`;
  const material = '公司名：恒川传动\n按图加工齿轮与传动轴。齿轮 G8，合金钢，直径 80 mm，不适用腐蚀工况。传动轴 S2，按图加工，长度待补充。齿轮热处理由外协完成，入厂复检后再精加工。不提供现场安装。请做首页和产品页。\n' + '已有资料边界：不提供现场安装；齿轮热处理由外协完成，入厂复检后再精加工。\n'.repeat(58);
  assert.ok(material.length > 2000 && material.length < 4000); report.materialLength = material.length;
  let state = await api(route, { message: material });
  state = await api(route, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: 'precision', preferences: { style: 'precision', layout: 3, density: 8 } });
  async function done() {
    for (let i = 0; i < 150; i++) {
      const state = await api(route, { action: 'state' });
      if (state.codeSite.run.status !== 'running') { assert.equal(state.codeSite.run.status, 'complete', JSON.stringify(state.codeSite.run)); return state; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('workflow timeout');
  }
  state = await done();
  await api(route, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision });
  state = await done();
  const current = state.codeSite.currentVersionId;
  state = await api(route, { action: 'start', baseRevision: 1 });
  assert.equal(state.alignment.waitingForUser, true);
  assert.equal(state.codeSite.currentVersionId, current);
  assert.equal(state.codeSite.materials, material.trim(), 'the request schema trims outer whitespace, but keeps all supplied content');
  report.status = 'PASS';
} catch (error) { report.error = String(error); throw error; }
finally { await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2)); console.log(folder); }
