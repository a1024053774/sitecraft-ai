import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { planSiteCode, writeSiteCode, writeLocalEdit } from '../lib/code-site-model.ts';

// 需求合同，不把提示到达当作模型排版已改善。失效方式：规划或写页漏传核心
// 约束；风格覆盖约束；局部只取首段时丢失约束；为防碎行而允许横向溢出。
// 期望来自 T-186：保护语义短串，宽度不足先改排法，不按行业套结构。
const styles = ['precision', 'documentary', 'editorial', 'neighborly'] as const;
let chosen: typeof styles[number] = 'precision';
const requests: any[] = [];
const code = { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页',
  html: '<main><section><h1>已有项目</h1><p>按资料展示。</p></section></main>' }] };
const keys = ['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'] as const;
const previous = keys.map(key => process.env[key]);
test.before(() => {
  process.env.DEEPSEEK_BASE_URL = 'https://t186.invalid';
  process.env.DEEPSEEK_API_KEY = 't186-fixture'; process.env.DEEPSEEK_MODEL = 'fixture';
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.ok(url.startsWith('https://t186.invalid/'));
    const body = JSON.parse(options.body as string); requests.push(body);
    const name = body.tools?.[0].function.name;
    const data = name === 'submit_page_plan' ? { summary: '展示已有项目。', style: chosen, styleReason: '按资料排版。',
      skeletonId: 'custom', skeletonReason: '内容较少，按项目展示；不用需要现场照片的结构。',
      pages: [{ id: 'home', title: '首页', outline: ['已有项目与各自说明'] }] }
      : name === 'submit_local_edit' ? { html: JSON.parse(body.messages[1].content.split('\n')[0]).html, css: '', cannotEdit: '' } : code;
    const message = name ? { content: null, tool_calls: [{ type: 'function', id: name, function: { name, arguments: JSON.stringify(data) } }] }
      : { content: JSON.stringify(data) };
    return Response.json({ choices: [{ finish_reason: name ? 'tool_calls' : 'stop', message }] });
  });
});
test.after(() => {
  mock.restoreAll();
  keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
});
function wrappingContract(text: string) {
  for (const category of ['时间区间', '数量与单位', '短标签', '型号', '邮箱'])
    assert.match(text, new RegExp(`${category}[^。\\n]*(?:不拆|完整)`), `${category}保持完整`);
  assert.match(text, /窄屏[^。\n]*长参数串[^。\n]*上下排列/, '长参数串应换布局');
  assert.match(text, /表格[^。\n]*窄屏[^。\n]*字段行/, '拥挤表格应换布局');
  assert.match(text, /不[^。\n]*横向溢出/, '保护短串仍不能溢出');
  for (const part of ['caption', 'thead', 'tbody', 'tfoot', 'colgroup', 'col', 'scope', 'figure', 'figcaption'])
    assert.match(text, new RegExp(`\\b${part}\\b`), `表格重排须覆盖${part}的布局或语义`);
  assert.match(text, /caption[^。\n]*(?:宽度|占满)/, '表题须有正常可用宽度');
  assert.match(text, /(?:行头|行标题)[^。\n]*(?:关联|对应)/, '不能丢失行头与数值的对应关系');
}
for (const style of styles) test(`${style}：生产规划、写页和局部首段均收到窄屏语义完整合同`, async () => {
  chosen = style; requests.length = 0;
  const preferences = { style, layout: 5, density: 6 };
  const materials = '已有项目与说明，所有内容按原文保留。';
  const { plan } = await planSiteCode(materials, preferences, '规划');
  await writeSiteCode({ materials, preferences, plan, images: [], request: '生成' });
  await writeLocalEdit({ materials, preferences, plan, current: code, request: '调整排法', issues: [],
    target: { kind: 'dom', versionId: 't186-version', pageId: 'home', path: [0], text: '已有项目按资料展示。', label: '已有项目' } });
  assert.equal(requests.length, 3);
  for (const body of requests.slice(0, 2)) {
    const system = body.messages[0].content as string;
    const core = system.split('name: site-code-core\n')[1]?.split('本规范改编自')[0];
    assert.ok(core); wrappingContract(core);
    const skill = system.split(`name: site-code-${style}\n`)[1];
    assert.ok(skill); wrappingContract(skill);
    assert.ok(body.messages[1].content.includes(materials));
  }
  const local = requests[2];
  wrappingContract(local.messages[0].content.split('风格要点：')[1].split('\n')[0]);
  assert.equal(local.tools[0].function.name, 'submit_local_edit');
  assert.equal(local.max_tokens, 12288);
  assert.equal(JSON.parse(local.messages[1].content.split('\n')[0]).materials, materials);
});
