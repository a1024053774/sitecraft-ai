import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { mock } from 'node:test';
import { planSiteCode, writeSiteCode } from '../lib/code-site-model.ts';

// 需求合同：条件跟随原文限定条目；导语不概括条件；不推断关系、地点或范围。
// 失效方式：核心只要求保留条件却允许换对象；风格分组/短开场覆盖该边界；
// 规划把空间关系当业务关系或合并条件；写页把大纲当新增依据；局部首段漏传。
// 截获生产入口实际请求，只证明提示传递，真实生成效果由单次评估另行判断。
const styles = ['precision', 'documentary', 'editorial', 'neighborly'] as const;
let chosen: typeof styles[number] = 'precision';
const requests: any[] = [];
const code = { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><h1>业务项目</h1></main>' }] };
const keys = ['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'] as const;
const previous = keys.map(key => process.env[key]);

test.before(() => {
  process.env.DEEPSEEK_BASE_URL = 'https://t188.invalid';
  process.env.DEEPSEEK_API_KEY = 't188-fixture';
  process.env.DEEPSEEK_MODEL = 'fixture';
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.ok(url.startsWith('https://t188.invalid/'), '替身拒绝其他地址');
    const body = JSON.parse(options.body as string); requests.push(body);
    const message = body.tools ? { content: null, tool_calls: [{ type: 'function', id: 'plan', function: {
      name: 'submit_page_plan', arguments: JSON.stringify({ summary: '展示已有项目。', style: chosen, styleReason: '按已有资料排版。',
        skeletonId: 'custom', skeletonReason: '内容少，紧凑展示项目；不采用需要现场照片的结构。',
        pages: [{ id: 'home', title: '首页', outline: ['项目按资料分类展示，各自条件贴近项目'] }] }),
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

function conditionScope(text: string) {
  assert.match(text, /条件[^。\n]*原文[^。\n]*限定[^。\n]*条目旁/, '条件必须保留原文对象并贴近该条目');
  assert.match(text, /(?:导语|分组说明)[^。\n]*不概括条目条件/, '共用说明不能概括条件');
  assert.match(text, /不推断[^。\n]*关系[^。\n]*地点[^。\n]*适用范围/, '不补写关系、地点或范围');
}

for (const style of styles) {
  for (const stage of ['规划', '写页'] as const) {
    test(`${style} ${stage}：实际请求分别携带核心、风格与阶段的条件归属合同`, async () => {
      chosen = style; requests.length = 0;
      const preferences = { style, layout: 5, density: 6 };
      const materials = '甲项目：资料齐备后排期。乙项目：交付时间待补充。服务区域为北区；未提供办公地址。';
      const { plan } = await planSiteCode(materials, preferences, '按已有资料做首页');
      if (stage === '写页') await writeSiteCode({ materials, preferences, plan, images: [], request: '按大纲写页' });
      const body = requests.at(-1);
      assert.equal(requests.length, stage === '规划' ? 1 : 2);
      const system = body.messages[0].content as string;
      const core = system.split('name: site-code-core\n')[1]?.split('本规范改编自')[0];
      assert.ok(core); conditionScope(core);
      const skill = system.split(`name: site-code-${style}\n`)[1]?.split(/\n来源：/)[0];
      assert.ok(skill); conditionScope(skill);
      assert.ok(body.messages[1].content.includes(materials), '资料原文仍完整传递');
      if (stage === '规划') {
        const planning = system.split('规划只决定内容与排法')[1];
        assert.ok(planning); conditionScope(planning);
        const outline = body.tools[0].function.parameters.properties.pages.items.properties.outline.description;
        assert.match(outline, /排版[^。\n]*不推断业务关系/);
        assert.match(outline, /不合并条目条件/);
      } else {
        conditionScope(body.messages[1].content.split('资料（唯一企业事实来源')[0]);
        assert.match(body.messages[1].content, /大纲[^。\n]*不能作为新增事实来源/);
      }
    });
  }
}

test('四种风格供 writeLocalEdit 截取的首段也包含完整条件归属合同', async () => {
  for (const style of styles) {
    const skill = await readFile(`skills/site-code-${style}/SKILL.md`, 'utf8');
    const first = skill.replace(/^---\n[\s\S]*?\n---\n/, '').trim().split('\n\n')[0];
    conditionScope(first);
  }
});
