import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { mock } from 'node:test';
import { planSiteCode, writeSiteCode } from '../lib/code-site-model.ts';

// 提示合同证据，不评判模型产物。失效方式：核心继续优先细线；四种风格
// 缺少各自的层级手段；缺图仍留空半屏；大图压倒短列表；局部首段漏掉规则。
// 用内存 fetch 截获真实规划/写页入口，不启动服务、Chrome 或真实模型。
const directions = {
  precision: [/字阶/, /(?:深底|深色|色带)/, /(?:参数|规格)/],
  documentary: [/系统黑体/, /(?:深浅|明暗)/, /(?:图文重量|图文比例)/],
  editorial: [/系统宋体/, /(?:跨栏|栏宽)/, /(?:底色分区|纸色分区|色面)/],
  neighborly: [/招牌/, /(?:色面|色块)/, /(?:紧凑.*告示|告示.*紧凑)/],
} as const;
let chosen: keyof typeof directions = 'precision';
const requests: any[] = [];
const code = { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>已有业务</h1></main>' }] };
const keys = ['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'] as const;
const previous = keys.map(key => process.env[key]);

test.before(() => {
  process.env.DEEPSEEK_BASE_URL = 'https://t184.invalid';
  process.env.DEEPSEEK_API_KEY = 't184-fixture';
  process.env.DEEPSEEK_MODEL = 'fixture';
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.ok(url.startsWith('https://t184.invalid/'), '替身拒绝其他地址');
    const body = JSON.parse(options.body as string); requests.push(body);
    const message = body.tools ? { content: null, tool_calls: [{ type: 'function', id: 'plan', function: {
      name: 'submit_page_plan', arguments: JSON.stringify({ summary: '按已有业务规划。', style: chosen, styleReason: '按已有资料排版。',
        skeletonId: 'custom', skeletonReason: '资料少，紧凑展示已有业务；不需要现场叙事。', pages: [{ id: 'home', title: '首页', outline: ['已有业务与相关说明'] }] }),
    } }] } : { content: JSON.stringify(code) };
    return Response.json({ choices: [{ finish_reason: body.tools ? 'tool_calls' : 'stop', message }] });
  });
});

test.after(() => {
  mock.restoreAll();
  keys.forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i];
  });
});

test('核心不把细线设为所有风格的首选，技术与资料底线仍在', async () => {
  const core = await readFile('skills/site-code-core/SKILL.md', 'utf8');
  assert.doesNotMatch(core, /能用表格、细线和留白分组，就不套卡片/);
  for (const rule of [/不能加载字体资源/, /不要紫蓝渐变、发光、玻璃/, /375、768、1440 不溢出、不重叠/,
    /正文对比度至少 4\.5:1/, /不许外部 url、@import、@font-face/, /事实只来自用户资料/, /没有图不留占位框/]) assert.match(core, rule);
});

for (const style of Object.keys(directions) as Array<keyof typeof directions>) {
  test(`${style}：规划和写页收到可区分的层级、无图首屏与事实不足时收紧的规则`, async () => {
    chosen = style; requests.length = 0;
    const preferences = { style, layout: 5, density: 6 };
    const materials = '公司已有一项业务与一段具体说明，没有授权图片；不添加业务事实。';
    const { plan } = await planSiteCode(materials, preferences, '只做首页');
    await writeSiteCode({ materials, preferences, plan, images: [], request: '按现有内容排版' });
    assert.equal(requests.length, 2);
    for (const body of requests) {
      const system = body.messages[0].content;
      const skill = system.split(`name: site-code-${style}\n`)[1]?.split(/\n来源：/)[0];
      assert.ok(skill, '所选风格必须实际传到模型');
      for (const rule of directions[style]) assert.match(skill, rule);
      assert.match(skill, /无图[^。\n]*(?:首屏|通栏|跨栏|单栏)/);
      assert.match(skill, /(?:资料|事实|内容)[^。\n]*(?:少|薄|不足)[^。\n]*(?:短|收紧|紧凑)/);
      assert.doesNotMatch(system, new RegExp(`name: site-code-(?:${Object.keys(directions).filter(id => id !== style).join('|')})\\n`));
      assert.ok(body.messages[1].content.includes(materials), '资料原文不改写');
    }
    if (style === 'documentary') assert.match(requests[1].messages[0].content, /(?:短列表|短说明)[^。\n]*(?:缩小|收小|下方|上下)/);
  });
}

test('局部修改使用的风格首段保留层级与无图构图要点', async () => {
  for (const style of Object.keys(directions) as Array<keyof typeof directions>) {
    const skill = await readFile(`skills/site-code-${style}/SKILL.md`, 'utf8');
    const first = skill.replace(/^---\n[\s\S]*?\n---\n/, '').trim().split('\n\n')[0];
    for (const rule of directions[style]) assert.match(first, rule);
    assert.match(first, /无图[^。\n]*(?:首屏|通栏|跨栏|单栏)/);
  }
});
