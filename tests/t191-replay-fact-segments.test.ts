import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { CodeSiteRecord, SiteCode } from '../lib/code-site.ts';

// 失败方式：toString 序列化调用遗漏必填参数；只取一档或每档独立分隔；
// 第一页的路径泄漏到其他页；不再逐档读取 CSS 文字；词内强调被插入空白。
// 期望来自下列本地 DOM 和媒体查询，直接运行重放 CLI，不复制其调用表达式。
test('重放 CLI 在每页采集三档分隔并集后读取三个候选，不调用模型', async () => {
  const output = path.resolve(`artifacts/t191/replay-regression-${Date.now()}-${process.pid}`);
  await mkdir(output, { recursive: true });
  const now = new Date().toISOString();
  const code = (price: string): SiteCode => ({
    header: '', footer: '',
    css: 'body{color:#222;background:#fff}span{display:inline}'
      + '@media(max-width:500px){.mobile{display:block}}'
      + '@media(min-width:600px) and (max-width:1000px){.tablet{display:block}}'
      + '@media(min-width:1100px){.desktop{display:block}}'
      + '.viewport::after{content:"手机说明"}'
      + '@media(min-width:600px){.viewport::after{content:"平板说明"}}'
      + '@media(min-width:1100px){.viewport::after{content:"桌面说明"}}',
    pages: [
      { id: 'home', title: '菜单', html: `<main><h1>青禾小馆</h1><section><h2>单份菜单</h2><p><span class="mobile">单份价格</span><span>${price}</span></p></section><section><h2>说明</h2><p>杭<span>州</span>市</p><p class="viewport">窗口说明</p></section></main>` },
      { id: 'visit', title: '到店', html: '<main><h1>到店须知</h1><section><h2>位置</h2><div><p><span class="tablet">门牌地址</span><span>青禾路七号</span></p></div></section></main>' },
      { id: 'menu', title: '供应', html: '<main><h1>供应安排</h1><section><p><span class="desktop">供应时段</span><span>午市</span></p></section></main>' },
    ],
  });
  const materials = '青禾小馆。单份价格先为32元/份，后改为38元/份，再改为41元/份。门牌地址青禾路七号，供应午市。';
  const site: CodeSiteRecord = {
    route: 'code', siteId: 't191-replay-fixture', name: '青禾小馆', conversationId: 'local-replay', materials,
    factSources: [{ type: 'materials', messageIndex: 1, text: materials }],
    preferences: { style: 'auto', layout: 5, density: 5 }, plan: null,
    versions: [], currentVersionId: null, run: null, updatedAt: now,
    runs: [{ id: 'recorded-generation', kind: 'generate', status: 'complete', request: '', baseRevision: 0,
      startedAt: now, updatedAt: now, step: '完成', repairRound: 2, issues: [],
      attempts: ['32 元/份', '38 元/份', '41 元/份'].map(price => ({ code: code(price),
        checks: { passed: true, issues: [], cleaned: [], checkedAt: now, viewports: [] } })),
      // 历史用量仅供 CLI 估算；测试不配置或启动模型服务。
      modelCalls: [0, 1, 2].map(() => ({ purpose: 'facts', model: 'recorded-fixture', startedAt: now,
        latencyMs: 1, httpStatus: 200, usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } })),
    }],
  };
  const source = path.join(output, 'code-site.json'), original = JSON.stringify(site, null, 2);
  await writeFile(source, original, 'utf8');
  const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/t154-replay-fact-segments.ts', source], {
    cwd: process.cwd(), env: { ...process.env, DEEPSEEK_API_KEY: '', AI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [exitCode, signal] = await once(child, 'close');
  await writeFile(path.join(output, 'cli.json'), JSON.stringify({ exitCode, signal, stdout, stderr }, null, 2), 'utf8');
  assert.equal(exitCode, 0, `重放 CLI 必须完成三候选读取：${stderr}`);
  assert.equal(await readFile(source, 'utf8'), original, '重放不得改写输入记录');
  const { folder } = JSON.parse(stdout);
  const report = JSON.parse(await readFile(path.join(folder, 'replay.json'), 'utf8'));
  await writeFile(path.join(output, 'replay.json'), JSON.stringify(report, null, 2), 'utf8');
  assert.equal(report.realModelCalled, false);
  assert.equal(report.rounds.length, 3);
  for (const [round, price] of ['32 元/份', '38 元/份', '41 元/份'].entries()) {
    const pending: Array<{ pageId: string; text: string; claimTexts: string[] }> = report.rounds[round].pending;
    const priced = pending.filter(segment => segment.pageId === 'home' && segment.text.includes(price));
    assert.equal(priced.length, 1, '仅手机成块的标签必须在三档共用一个核对段');
    assert.match(priced[0].text, /单份价格\s+\d+ 元\/份/);
    assert.ok(priced[0].claimTexts.some(text => text.includes(`单份价格 ${price}`)));
  }
  const first: Array<{ pageId: string; text: string }> = report.rounds[0].pending;
  for (const [pageId, label, value] of [['visit', '门牌地址', '青禾路七号'], ['menu', '供应时段', '午市']]) {
    const matching = first.filter(segment => segment.pageId === pageId && segment.text.includes(value));
    assert.equal(matching.length, 1, '平板或桌面独有的分隔也必须进入本页并集');
    assert.match(matching[0].text, new RegExp(`${label}\\s+${value}`));
  }
  assert.ok(first.some(segment => segment.text.includes('杭州市')), '词内行内强调不加分隔');
  for (const text of ['手机说明', '平板说明', '桌面说明']) {
    assert.ok(first.some(segment => segment.pageId === 'home' && segment.text.includes(`CSS=${text}`)), `保留正式三档 CSS 文字读取：${text}`);
  }
});
