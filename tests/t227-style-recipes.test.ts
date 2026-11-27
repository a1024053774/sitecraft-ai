import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test, { mock } from 'node:test';
import { pathToFileURL } from 'node:url';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

const allStyles = ['precision', 'documentary', 'editorial', 'neighborly', 'darkroom', 'indexgrid', 'craftposter'] as const;
const readyStyles = ['precision', 'documentary', 'editorial', 'neighborly', 'darkroom', 'craftposter'] as const;
const pendingStyles = ['indexgrid'] as const;

function hexLuminance(hex: string) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  assert.ok(m, `Expected 6-digit hex color, got ${hex}`);
  const rgb = [0, 2, 4].map(i => {
    const s = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(fg: string, bg: string) {
  const l1 = hexLuminance(fg), l2 = hexLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('core SKILL.md decouples header/palette/single-CTA locks while retaining safety, fact and T-208 floors', async () => {
  const core = await readFile('skills/site-code-core/SKILL.md', 'utf8');
  assert.doesNotMatch(core, /首屏导航桌面一行，高度不超过 72px/);
  assert.doesNotMatch(core, /选择一个强调色和中性底色/);
  assert.doesNotMatch(core, /每页需要入口时只设一个主要入口/);
  for (const required of [
    /中小企业与机构/,
    /页头与首屏承接不同任务/,
    /不生成表单、提交入口或收件功能/,
    /保留单位、条件、否定、数量/,
    /正文对比度至少 4\.5:1/,
    /375、768、1440 不溢出、不重叠/,
    /border-radius:\s*0/,
    /background-clip:\s*border-box/,
    /list-style-position:\s*outside/,
    /data-image-id/,
    /data-system-icon/,
    /data-system-backdrop/,
  ]) assert.match(core, required);
});

test('LOCAL-EDIT.md centralizes narrow wrapping, full field-table rules and condition-scope rules', async () => {
  const local = await readFile('skills/site-code-core/LOCAL-EDIT.md', 'utf8');
  for (const required of [
    /时间区间[^。\n]*(?:不拆|完整)/,
    /数量与单位[^。\n]*(?:不拆|完整)/,
    /短标签[^。\n]*(?:不拆|完整)/,
    /型号[^。\n]*(?:不拆|完整)/,
    /邮箱[^。\n]*(?:不拆|完整)/,
    /white-space:\s*nowrap/,
    /窄屏[^。\n]*长参数串[^。\n]*上下排/,
    /表格[^。\n]*窄屏[^。\n]*字段行/,
    /\bcaption\b/, /\bthead\b/, /\btbody\b/, /\btfoot\b/, /\bcolgroup\b/, /\bcol\b/, /\bscope\b/, /\bfigure\b/, /\bfigcaption\b/,
    /条件[^。\n]*原文[^。\n]*限定[^。\n]*条目旁/,
    /(?:导语|分组说明)[^。\n]*不概括条目条件/,
    /不推断[^。\n]*关系[^。\n]*地点[^。\n]*适用范围/,
  ]) assert.match(local, required);
});

test('all 7 styles have contrasting recipes, sub-variants, cross-platform fonts, contrast >= 4.5:1, and no copied boilerplate', async () => {
  const headers: string[] = [];
  for (const id of allStyles) {
    const raw = await readFile(`skills/site-code-${id}/SKILL.md`, 'utf8');
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    const parts = body.split('\n\n');
    const first = parts[0];
    assert.ok(first.length >= 220, `${id}: paragraph 1 must carry a rich design recipe`);
    assert.ok(parts.at(-1)?.startsWith('来源：'), `${id}: final paragraph must record provenance`);
    assert.doesNotMatch(body, /表格改字段行须整体处理 caption、thead/, `${id}: must not duplicate table-reflow boilerplate`);
    for (const token of ['变体 A', '变体 B', '变体 C']) assert.ok(first.includes(token), `${id}: missing ${token}`);
    const hexes = first.match(/#[0-9a-f]{6}\b/gi) ?? [];
    assert.ok(hexes.length >= 6, `${id}: paragraph 1 must specify concrete hex colors`);
    assert.match(first, /严禁|禁止.*(?:通用模板|撞脸|千篇一律)/, `${id}: must include explicit anti-cliche veto`);
    assert.match(first, /页头|顶栏|刊头|招牌|导航/, `${id}: must specify header architecture`);
    assert.match(first, /无图[^。\n]*(?:首屏|通栏|跨栏|单栏)/, `${id}: must specify imageless hero`);
    assert.match(first, /(?:资料|事实|内容)[^。\n]*(?:少|薄|不足)[^。\n]*(?:短|收紧|紧凑)/, `${id}: must specify thin-material hero`);
    const pairs = [...first.matchAll(/(?:主底|次区底|深色带|深浅分区|纸色分区|墨黑底|色块|招牌|深底表头|强调)\s*(#[0-9a-f]{6})（(?:正文|主文|字|白字|深字)\s*(#[0-9a-f]{6})(?:[^）\n]*?次字\s*(#[0-9a-f]{6}))?）/gi)];
    assert.ok(pairs.length >= 9, `${id}: expected at least 9 declared foreground/background color pairs, got ${pairs.length}`);
    for (const [, bg, primaryFg, secondaryFg] of pairs) {
      assert.ok(contrastRatio(primaryFg, bg) >= 4.5, `${id}: primary ${primaryFg} on ${bg} below 4.5:1`);
      if (secondaryFg) assert.ok(contrastRatio(secondaryFg, bg) >= 4.5, `${id}: secondary ${secondaryFg} on ${bg} below 4.5:1`);
    }
    headers.push(first.match(/页头[：:]([^。\n]+)/)?.[1] ?? '');
    if ((pendingStyles as readonly string[]).includes(id)) {
      assert.ok(existsSync(`skills/site-code-${id}/SOURCE.md`), `${id}: pending style needs SOURCE.md`);
    }
  }
  assert.ok(headers.every(Boolean), 'every style paragraph 1 must explicitly specify 页头：...');
  assert.equal(new Set(headers).size, allStyles.length, 'each style must specify a distinct header archetype');
});

test('codeSliderRules preserves native style proportions on middle band 4-7 and overrides on 1-3 and 8-10', async () => {
  const { codeSliderRules } = await import('../lib/code-site-styles.ts');
  for (const style of ['precision', 'editorial', 'documentary', 'darkroom', 'indexgrid', 'craftposter'] as const) {
    const mid = codeSliderRules({ style, layout: 5, density: 6 });
    assert.doesNotMatch(mid, /主次栏约为二比一/);
    assert.doesNotMatch(mid, /48–64px/);
    assert.match(mid, /保持所选风格自身/);
    assert.match(mid, /保留单位、条件、否定、数量/);
  }
  const calm = codeSliderRules({ style: 'editorial', layout: 2, density: 2 });
  assert.match(calm, /共享对齐轴/);
  assert.match(calm, /72–96px/);
  assert.match(calm, /保留单位、条件、否定、数量/);
  const bold = codeSliderRules({ style: 'editorial', layout: 9, density: 9 });
  assert.match(bold, /不对称/);
  assert.match(bold, /24–40px/);
  assert.match(bold, /保留单位、条件、否定、数量/);
});

test('writeSiteCode & planSiteCode emit deterministic per-company sub-variant hints that differentiate companies in the same style', async () => {
  const prev = { url: process.env.DEEPSEEK_BASE_URL, key: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL };
  const bodies: any[] = [];
  process.env.DEEPSEEK_BASE_URL = 'https://t227.invalid';
  process.env.DEEPSEEK_API_KEY = 't227-fixture';
  process.env.DEEPSEEK_MODEL = 'fixture';
  mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    bodies.push(body);
    const data = body.tools ? { summary: '介绍公司与产品。', style: 'precision', styleReason: '按资料选用。', skeletonId: 'custom', skeletonReason: '紧凑目录。',
      pages: [{ id: 'home', title: '首页', outline: ['公司与业务'] }] }
      : { header: '<header>头</header>', footer: '<footer>尾</footer>', css: 'body{color:#111;background:#fff}', pages: [{ id: 'home', title: '首页', html: '<main><h1>公司</h1></main>' }] };
    const message = body.tools ? { content: null, tool_calls: [{ type: 'function', id: 'f1', function: { name: 'submit_page_plan', arguments: JSON.stringify(data) } }] }
      : { content: JSON.stringify(data) };
    return Response.json({ choices: [{ finish_reason: body.tools ? 'tool_calls' : 'stop', message }] });
  });
  try {
    const { planSiteCode, writeSiteCode } = await import('../lib/code-site-model.ts');
    const prefs = { style: 'precision' as const, layout: 5, density: 6 };
    const companies = ['甲测试精密机械有限公司', '乙测试食品贸易有限公司', '丙测试文化出版机构', '丁测试光电元件制造厂', '戊测试环保材料研究所', '己测试陶瓷工艺工坊'];
    const variants: string[] = [];
    for (const name of companies) {
      const mat = `公司名：${name}\n业务：提供指定产品与服务。`;
      const { plan } = await planSiteCode(mat, prefs, '只做首页');
      const planSys = bodies.at(-1).messages[0].content as string;
      const mPlan = planSys.match(/优先选用所选风格的「变体 ([ABC])」/);
      assert.ok(mPlan, `${name} plan must carry sub-variant hint`);
      await writeSiteCode({ materials: mat, preferences: prefs, plan, images: [], request: '生成首页' });
      const writeSys = bodies.at(-1).messages[0].content as string;
      const mWrite = writeSys.match(/优先选用所选风格的「变体 ([ABC])」/);
      assert.ok(mWrite, `${name} write must carry sub-variant hint`);
      assert.equal(mWrite[1], mPlan[1], `${name} plan and write must select the same deterministic sub-variant`);
      variants.push(mWrite[1]);
    }
    assert.ok(new Set(variants).size >= 2, `Distinct company names should scatter across sub-variants, got ${variants.join(',')}`);
  } finally {
    mock.restoreAll();
    if (prev.url === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = prev.url;
    if (prev.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = prev.key;
    if (prev.model === undefined) delete process.env.DEEPSEEK_MODEL; else process.env.DEEPSEEK_MODEL = prev.model;
  }
});

test('new pending styles remain hidden from ordinary processes and admitted only via SITECRAFT_EVAL_STYLES', () => {
  const probe = (evalStyles?: string) => {
    const env = { ...process.env };
    if (evalStyles === undefined) delete env.SITECRAFT_EVAL_STYLES; else env.SITECRAFT_EVAL_STYLES = evalStyles;
    const script = `import { readyCodeStyleIds, codeStyleOptions } from './lib/code-site-styles.ts'; import { serverCodeStyleOptions, requireModelTaskAdmission } from './lib/code-site-eval-styles.ts'; console.log(JSON.stringify({ readyCodeStyleIds, client: codeStyleOptions.map(o => o.id), server: serverCodeStyleOptions.map(o => o.id), canIndexgrid: (() => { try { requireModelTaskAdmission('indexgrid'); return true; } catch { return false; } })() }));`;
    const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { env, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    return JSON.parse(res.stdout.trim());
  };
  const ordinary = probe(undefined);
  assert.deepEqual(ordinary.readyCodeStyleIds, [...readyStyles]);
  assert.deepEqual(ordinary.client, ['auto', ...readyStyles]);
  assert.deepEqual(ordinary.server, ['auto', ...readyStyles]);
  assert.equal(ordinary.canIndexgrid, false);
  const evalEnv = probe('indexgrid');
  assert.deepEqual(evalEnv.readyCodeStyleIds, [...readyStyles]);
  assert.deepEqual(evalEnv.client, ['auto', ...readyStyles]);
  assert.deepEqual(evalEnv.server, ['auto', ...readyStyles, ...pendingStyles]);
  assert.equal(evalEnv.canIndexgrid, true);
});

test('T-235 & T-240 promoted craftposter and darkroom WebP previews decode at 576x400 with SOURCE.md provenance while indexgrid stays pending', async () => {
  const { default: sharp } = await import('sharp');
  const { codeStyles } = await import('../lib/code-site-styles.ts');
  const preview = codeStyles.craftposter.preview;
  assert.equal(preview.status, 'ready');
  if (preview.status !== 'ready') throw new Error('craftposter must be promoted to ready');
  assert.equal(preview.siteId, '8c3225b7-be4b-4840-8510-35bd956177bd');
  assert.equal(preview.versionId, '3c0a3f25-ae61-40eb-9e17-5e98327ad46d');
  assert.equal(preview.revision, 1);
  assert.equal(preview.src, '/style-previews/craftposter.webp');
  assert.equal(preview.source, 't235/eval-3sites-r3/eval/private/case-2/home-fold-1440.png');
  const license = await readFile(`public${preview.license}`, 'utf8');
  assert.match(license, /craftposter\.webp/);
  assert.match(license, /拾色绘画教室/);
  assert.match(license, /8c3225b7-be4b-4840-8510-35bd956177bd/);
  assert.match(license, /3c0a3f25-ae61-40eb-9e17-5e98327ad46d/);
  const meta = await sharp(`public${preview.src}`).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 576);
  assert.equal(meta.height, 400);

  const darkroomPreview = codeStyles.darkroom.preview;
  assert.equal(darkroomPreview.status, 'ready');
  if (darkroomPreview.status !== 'ready') throw new Error('darkroom must be promoted to ready');
  assert.equal(darkroomPreview.siteId, 'd48fdf27-7913-4331-8f98-6854929007ae');
  assert.equal(darkroomPreview.versionId, 'f61cd84a-66d4-42c8-b05f-1b7e7a6b579f');
  assert.equal(darkroomPreview.revision, 1);
  assert.equal(darkroomPreview.src, '/style-previews/darkroom.webp');
  assert.equal(darkroomPreview.source, 't240/eval-4sites-r2/eval/private/case-3/home-fold-1440.png');
  assert.match(license, /darkroom\.webp/);
  assert.match(license, /松风提琴修复工坊/);
  assert.match(license, /d48fdf27-7913-4331-8f98-6854929007ae/);
  assert.match(license, /f61cd84a-66d4-42c8-b05f-1b7e7a6b579f/);
  const darkroomMeta = await sharp(`public${darkroomPreview.src}`).metadata();
  assert.equal(darkroomMeta.format, 'webp');
  assert.equal(darkroomMeta.width, 576);
  assert.equal(darkroomMeta.height, 400);

  assert.deepEqual(codeStyles.indexgrid.preview, { status: 'pending' });
  const agents = await readFile('AGENTS.md', 'utf8');
  assert.match(agents, /darkroom[^\n]*T-240[^\n]*ready/);
  assert.match(agents, /indexgrid[^\n]*T-238[^\n]*::marker/);
});

test('T-234 recipes require neighborly homepage prices + summary table, core heading balance, and darkroom real-photo opening', async () => {
  const { readFile } = await import('node:fs/promises');
  const coreSkill = await readFile(new URL('../skills/site-code-core/SKILL.md', import.meta.url), 'utf8');
  assert.match(coreSkill, /text-wrap:\s*balance/);
  assert.match(coreSkill, /孤立成行|单字换行|尾行/);

  const neighborlySkill = await readFile(new URL('../skills/site-code-neighborly/SKILL.md', import.meta.url), 'utf8');
  assert.match(neighborlySkill, /首页[^\n]*价格[^\n]*(?:时段|条件)/);
  assert.match(neighborlySkill, /不得(?:延后|推后|只放)到二级页/);
  assert.match(neighborlySkill, /汇总表/);

  const darkroomSkill = await readFile(new URL('../skills/site-code-darkroom/SKILL.md', import.meta.url), 'utf8');
  assert.match(darkroomSkill, /没有企业自有实拍图时[^\n]*也能独立成立/);
  assert.match(darkroomSkill, /无图首屏/);

  const mainline = await readFile(new URL('../docs/project/mainline.md', import.meta.url), 'utf8');
  assert.match(mainline, /T-234/);
  assert.match(mainline, /text-wrap:\s*balance/);
});

test('T-237 recipes: darkroom stands without company real photos, indexgrid varies hero/steps/history by content without fixed order, and docker README records DeepSeek probe prerequisite', async () => {
  const darkroom = await readFile(new URL('../skills/site-code-darkroom/SKILL.md', import.meta.url), 'utf8');
  assert.match(darkroom, /没有企业自有实拍图时[^\n]*也能独立成立/);
  assert.match(darkroom, /行业[\/／]?题材配图|授权配图/);
  assert.match(darkroom, /不冒充[^\n]*实拍/);
  assert.doesNotMatch(darkroom, /只留给无图站点/);

  const indexgrid = await readFile(new URL('../skills/site-code-indexgrid/SKILL.md', import.meta.url), 'utf8');
  assert.match(indexgrid, /粗黑/);
  assert.match(indexgrid, /格线/);
  assert.match(indexgrid, /索引/);
  assert.doesNotMatch(indexgrid, /一格放跨格大号黑体标题，邻格放目录索引摘要/);
  assert.match(indexgrid, /首屏[^\n]*按资料/);
  assert.match(indexgrid, /步骤[\/／]?流程[^\n]*按/);
  assert.match(indexgrid, /沿革[^\n]*按/);
  assert.match(indexgrid, /不规定固定(?:的)?(?:区块)?顺序(?:和位置|与位置)/);

  const dockerReadme = await readFile(new URL('../deploy/docker/README.md', import.meta.url), 'utf8');
  assert.match(dockerReadme, /下次更新 Windows [^\n]*服务之前[^\n]*DeepSeek[^\n]*submit_fact_review[^\n]*最小探针/);
});
