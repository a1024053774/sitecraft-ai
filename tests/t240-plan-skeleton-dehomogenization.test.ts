import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test, { mock } from 'node:test';

test('T-240 shared layer removes negative layout bans and simulated-pack leaks while keeping style-first order, relaxed skeletons, and 栏目线索 clarification', async () => {
  const [skeletons, coreSkill, lessAi, modelSource] = await Promise.all([
    readFile('skills/site-code-core/SKELETONS.md', 'utf8'),
    readFile('skills/site-code-core/SKILL.md', 'utf8'),
    readFile('skills/frontend-less-ai-tone/SKILL.md', 'utf8'),
    readFile('lib/code-site-model.ts', 'utf8'),
  ]);

  // Negative bans must be absent across all shared skills & model prompts:
  assert.doesNotMatch(coreSkill, /禁止[^\n]*(?:左文右图形|左栏仅放大标题|四等列横排|固定公式)/);
  assert.doesNotMatch(skeletons, /严禁把不同公司首页一律排成|不另放右侧装饰图形框|不做左文右大标|下面不紧接三等分横线分类条|不连排等大双栏块/);
  assert.doesNotMatch(skeletons, /茶园参观|白样签样/, 'SKELETONS.md must stay domain-neutral without simulated-pack specifics');
  assert.doesNotMatch(lessAi, /不要套固定的「首屏 → 三栏能力/);
  assert.doesNotMatch(modelSource, /禁止在首屏右侧画放大版装饰标识|禁止跨区块重复使用同比例|禁止把所有纪年一律写成/);

  // Approved positive relaxations retained:
  assert.doesNotMatch(skeletons, /尺寸、颜色和字阶由用户风格与滑杆决定/);
  assert.doesNotMatch(skeletons, /只有两个系列，或资料重点是定制承接、业务路径、服务流程时，这张不适用/);
  assert.doesNotMatch(lessAi, /Hero、能力、流程、CTA 各承担不同证据/);
  assert.match(modelSource, /栏目线索[^\n]*不是首页的固定区块顺序/);
});

test('T-240 tracer bullet defines 3 style compositions on darkroom and neighborly only, leaving other ready styles without composition sections', async () => {
  const mod = await import('../lib/code-site-model.ts') as Record<string, any>;
  assert.equal(typeof mod.readStyleCompositionIds, 'function', 'readStyleCompositionIds must be exported');

  const darkroomIds = await mod.readStyleCompositionIds('darkroom');
  const neighborlyIds = await mod.readStyleCompositionIds('neighborly');
  assert.equal(darkroomIds.length, 3);
  assert.equal(neighborlyIds.length, 3);
  assert.ok(darkroomIds.every((id: string) => id.startsWith('darkroom-')));
  assert.ok(neighborlyIds.every((id: string) => id.startsWith('neighborly-')));

  for (const untouched of ['precision', 'documentary', 'editorial', 'craftposter'] as const) {
    const ids = await mod.readStyleCompositionIds(untouched);
    assert.deepEqual(ids, [], `${untouched} must remain untouched in tracer bullet`);
    const raw = await readFile(`skills/site-code-${untouched}/SKILL.md`, 'utf8');
    assert.doesNotMatch(raw, /^## 整页构图/m, `${untouched} SKILL.md must not contain ## 整页构图 in tracer bullet`);
  }
});

test('T-240 planSiteCode strictly validates compositionId across explicit and auto styles, saves CodePlan.composition, and diagnoseSiteStructures validates siteIds', async () => {
  const prev = { url: process.env.DEEPSEEK_BASE_URL, key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL };
  process.env.DEEPSEEK_BASE_URL = 'https://t240.invalid';
  process.env.DEEPSEEK_API_KEY = 't240-fixture';
  process.env.DEEPSEEK_MODEL = 'fixture';

  const mod = await import('../lib/code-site-model.ts') as Record<string, any>;
  const darkroomIds: string[] = await mod.readStyleCompositionIds('darkroom');

  let nextCompositionId = darkroomIds[1] ?? 'darkroom-rail-showcase';
  let nextStyle = 'darkroom';
  let nextSkeletonId = 'workshop-story';
  const capturedBodies: any[] = [];
  let includeComposition = true;

  mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    capturedBodies.push(body);
    const args = {
      summary: '围绕提琴裂纹修补、装配调音与寄修包装要求组织两页暗面工坊档案。',
      style: nextStyle,
      styleReason: '暗房高对比陈列契合手工修琴台面气质。',
      skeletonId: nextSkeletonId,
      skeletonReason: '口述资料聚焦修琴工位判断与收费边界，适合现场叙事；次选 compact-profile 放不下寄修细则故不选。',
      ...(includeComposition
        ? {
            compositionId: nextCompositionId,
            compositionReason: '采用左侧固定暗轨配右侧主次展柜，首屏直陈接琴核验方式与工时收费，寄修装箱归入次页。',
          }
        : {}),
      pages: [
        { id: 'home', title: '首页', outline: ['左侧暗轨导航配首屏工坊接琴核验说明', '小提琴中提琴大提琴常规修削与换毛收费展柜', '周四至周日接待时段与闭门木工安排'] },
        { id: 'repair', title: '修复与送修', outline: ['低音梁与贯通裂纹开板评估边界', '外地寄修照片初核与硬盒缓冲包装要求'] },
      ],
    };
    return Response.json({
      choices: [{
        finish_reason: 'tool_calls',
        message: { content: null, tool_calls: [{ type: 'function', id: 'c1', function: { name: 'submit_page_plan', arguments: JSON.stringify(args) } }] },
      }],
    });
  });

  try {
    const { plan } = await mod.planSiteCode(
      '资料性质：模拟。\n公司名：松风提琴修复工坊\n专接提琴裂纹修补与换毛。',
      { style: 'darkroom', layout: 5, density: 6 },
      '生成首页与修复页',
    );
    assert.deepEqual(plan.composition, {
      id: nextCompositionId,
      reason: '采用左侧固定暗轨配右侧主次展柜，首屏直陈接琴核验方式与工时收费，寄修装箱归入次页。',
    });

    // Verify style skill appears before SKELETONS.md in system prompt:
    const sys = capturedBodies.at(-1).messages[0].content as string;
    assert.ok(sys.indexOf('深炭夜色全域画布') < sys.indexOf('# 页面骨架版式卡'), 'style recipe must precede SKELETONS.md');

    // Invalid compositionId for darkroom must be rejected with composition message:
    nextCompositionId = 'neighborly-menu-board';
    await assert.rejects(
      () => mod.planSiteCode('公司名：松风提琴修复工坊\n业务说明。', { style: 'darkroom', layout: 5, density: 6 }, '生成首页'),
      /风格整页构图编号无效/,
    );

    // In auto mode, picking an unmodified style (precision) with a darkroom compositionId must ALSO be rejected (never silently dropped):
    nextStyle = 'precision';
    nextCompositionId = 'darkroom-ledger-matrix';
    await assert.rejects(
      () => mod.planSiteCode('公司名：宁海模具\n注塑模具加工。', { style: 'auto', layout: 5, density: 6 }, '生成首页'),
      /风格整页构图编号无效/,
    );

    // In auto mode, picking precision with style-native succeeds cleanly and keeps composition undefined:
    nextCompositionId = 'style-native';
    const autoPrecision = await mod.planSiteCode('公司名：宁海模具\n注塑模具加工。', { style: 'auto', layout: 5, density: 6 }, '生成首页');
    assert.equal(autoPrecision.plan.style, 'precision');
    assert.equal(autoPrecision.plan.composition, undefined);

    // Unmodified ready style (editorial) continues to work cleanly without composition fields:
    nextStyle = 'editorial';
    includeComposition = false;
    const editorialRes = await mod.planSiteCode(
      '公司名：忻州重载\n做重载减速机。',
      { style: 'editorial', layout: 5, density: 6 },
      '生成首页',
    );
    assert.equal(editorialRes.plan.composition, undefined);

    // Verify diagnoseSiteStructures extracts compositionId and rejects unknown siteIds:
    const { diagnoseSiteStructures } = await import('../scripts/diagnose-site-structure.ts');
    const tmpDir = path.join(process.env.SITECRAFT_DATA_ROOT!, 't240-diag-' + crypto.randomUUID());
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, 's1.json'), JSON.stringify({
      route: 'code',
      siteId: 's1',
      name: '松风提琴修复工坊',
      materials: '公司名：松风提琴修复工坊',
      preferences: { style: 'darkroom', layout: 5, density: 6 },
      plan,
      versions: [{ id: 'v1', revision: 1, author: 'assistant', createdAt: '2026-11-26T16:00:00Z', code: { header: '', footer: '', css: '', pages: [{ id: 'home', title: '首页', html: '<main><section><h1>松风提琴修复工坊</h1></section><section><h2>收费</h2></section></main>' }] }, checks: { passed: true, issues: [], cleaned: [], checkedAt: '2026-11-26T16:00:00Z', viewports: [] } }],
      runs: [{ id: 'r1', kind: 'generate', status: 'complete', modelCalls: [{ purpose: 'write', model: 'gpt-6.2-sol' }] }],
    }), 'utf8');

    const diag = await diagnoseSiteStructures({ dataDir: tmpDir, siteIds: ['s1'] }) as Record<string, any>;
    assert.equal(diag.compositionCountsAll[plan.composition.id], 1);
    assert.equal(diag.subsetSummary?.siteCount, 1);

    await assert.rejects(
      () => diagnoseSiteStructures({ dataDir: tmpDir, siteIds: ['s1', 'nonexistent-site-id'] }),
      /未找到指定站点 ID/,
    );
  } finally {
    mock.restoreAll();
    if (prev.url === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = prev.url;
    if (prev.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = prev.key;
    if (prev.model === undefined) delete process.env.DEEPSEEK_MODEL; else process.env.DEEPSEEK_MODEL = prev.model;
  }
});
