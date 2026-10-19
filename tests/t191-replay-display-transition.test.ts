import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { CodeSiteRecord, SiteCode } from '../lib/code-site.ts';

// 直接运行 CLI，防止重放仍复用预采集文档而漏掉桌面 display 过渡边界；
// 无过渡是对照，三个候选改变地址，答案来自本夹具而非读取器输出。
for (const transition of [false, true]) test(`重放 CLI 保留桌面标签边界：${transition ? 'display 过渡' : '无过渡对照'}`, async () => {
  const output = path.resolve(`artifacts/t191/replay-display-transition-${Date.now()}-${process.pid}-${transition}`);
  await mkdir(output, { recursive: true });
  const now = new Date().toISOString(), addresses = ['青禾路七号', '青禾路八号', '青禾路九号'];
  const code = (address: string): SiteCode => ({ header: '', footer: '',
    css: 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}main{padding:24px}'
      + `.label{display:inline;${transition ? 'transition:display 1s allow-discrete' : ''}}`
      + '@media(min-width:1100px){.label{display:block}}',
    pages: [{ id: 'home', title: '到店须知', html: `<main><h1>青禾小馆</h1><section><h2>到店</h2><p><span class="label">门牌地址</span><span>${address}</span></p></section></main>` }],
  });
  const site: CodeSiteRecord = { route: 'code', siteId: 't191-replay-transition', name: '青禾小馆', conversationId: 'local-replay',
    materials: '青禾小馆。门牌地址先为青禾路七号，后改为青禾路八号，再改为青禾路九号。',
    preferences: { style: 'auto', layout: 5, density: 5 }, plan: null, versions: [], currentVersionId: null, run: null, updatedAt: now,
    runs: [{ id: 'recorded-generation', kind: 'generate', status: 'complete', request: '', baseRevision: 0,
      startedAt: now, updatedAt: now, step: '完成', repairRound: 2, issues: [],
      attempts: addresses.map(address => ({ code: code(address), checks: { passed: true, issues: [], cleaned: [], checkedAt: now, viewports: [] } })),
      modelCalls: addresses.map(() => ({ purpose: 'facts', model: 'recorded-fixture', startedAt: now, latencyMs: 1, httpStatus: 200,
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } })),
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
  assert.equal(exitCode, 0, `重放 CLI 必须读取三个候选：${stderr}`);
  assert.equal(await readFile(source, 'utf8'), original, '重放不得改写输入记录');
  const { folder } = JSON.parse(stdout);
  const report = JSON.parse(await readFile(path.join(folder, 'replay.json'), 'utf8'));
  await writeFile(path.join(output, 'replay.json'), JSON.stringify(report, null, 2), 'utf8');
  assert.equal(report.realModelCalled, false);
  assert.equal(report.rounds.length, 3);
  for (const [round, address] of addresses.entries()) {
    const matching: Array<{ text: string; claimTexts: string[] }> = report.rounds[round].pending.filter((segment: { text: string }) => segment.text.includes(address));
    assert.equal(matching.length, 1, '三档共用当前候选的一个地址核对段');
    assert.match(matching[0].text, new RegExp(`门牌地址\\s+${address}`), '桌面独立标签必须进入重放的三档分隔并集');
    assert.ok(matching[0].claimTexts.some(text => text.includes(`门牌地址 ${address}`)));
  }
});
