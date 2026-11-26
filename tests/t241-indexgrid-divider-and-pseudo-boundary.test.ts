import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { codeRepairFragments } from '../lib/code-site-repair.ts';
import type { SiteCode } from '../lib/code-site.ts';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

const server = createServer((req, res) => {
  if (req.url !== '/code-check.html') {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(codeCheckDocument);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.SITECRAFT_BASE = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
await mkdir('artifacts/t241', { recursive: true });

test.after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function buildStepBarSite(stepCss: string): SiteCode {
  return {
    header: '<header class="hd"><a href="#top">忻州重载</a></header>',
    footer: '<footer class="ft"><p>忻州重载</p></footer>',
    pages: [
      {
        id: 'home',
        title: '忻州重载',
        html: [
          '<main id="top">',
          '  <section class="hero"><h1>忻州重载</h1><p>按接口图组织箱体加工、齿轮加工与装配。</p></section>',
          '  <section class="proc"><h2>加工流程</h2>',
          '    <ol class="steps">',
          '      <li>确认接口图</li>',
          '      <li>箱体加工</li>',
          '      <li>齿轮精加工</li>',
          '      <li>配对装配</li>',
          '      <li>跑合包装</li>',
          '    </ol>',
          '  </section>',
          '</main>',
        ].join('\n'),
      },
    ],
    css: [
      'body { margin: 0; background: #ffffff; color: #141414; font: 16px/1.6 sans-serif; }',
      '.hd, .ft, main { max-width: 1120px; margin: 0 auto; padding: 16px 24px; }',
      'a { color: #141414; }',
      '.steps { margin: 0; padding: 0 0 0 28px; list-style: decimal outside; border-radius: 0; background-clip: border-box; z-index: auto; }',
      '.steps li { border-radius: 0; background-clip: border-box; z-index: auto; color: #141414; }',
      '.steps li::marker { color: #141414; }',
      stepCss,
    ].join('\n'),
  };
}

test('T-241 indexgrid 配方首段明确横向步骤条分隔线改用单元格 border 或 gap，禁用 li::before', async () => {
  const raw = await readFile(new URL('../skills/site-code-indexgrid/SKILL.md', import.meta.url), 'utf8');
  const body = raw.replace(/^---[\s\S]*?---\r?\n+/, '');
  const firstParagraph = body.split(/\r?\n\r?\n/)[0] ?? '';
  assert.match(firstParagraph, /横向步骤条[^\n]*分隔线[^\n]*(?:border|gap)/);
  assert.match(firstParagraph, /不要用\s*`?li(?:\+li)?::before`?|禁止[^\n]*`?li(?:\+li)?::before`?/);
});

test('T-241 industrial/indexgrid 横向 ol 的 li+li::before 已被 layoutRepairs 定位到 ::marker 并按硬约束拒收；改用单元格 border 后三档通过', async () => {
  const materials = '公司名：忻州重载\n按接口图组织箱体加工、齿轮加工与装配。确认接口图、箱体加工、齿轮精加工、配对装配、跑合包装。';

  const pseudoDividerSite = buildStepBarSite([
    '@media (min-width: 768px) {',
    '  .steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 36px; }',
    '  .steps li { position: relative; }',
    '  .steps li + li::before { content: ""; position: absolute; top: 0; bottom: 0; left: -26px; width: 24px; border-left: 1px solid #141414; }',
    '}',
  ].join('\n'));

  const badChecked = await checkSiteCode({
    siteId: 't241-bad',
    code: pseudoDividerSite,
    materials,
    images: [],
    legacyImport: true,
  });

  assert.equal(badChecked.checks.passed, false);
  assert.ok(
    badChecked.checks.issues.some(issue => /伪元素叠层无法核对实际底图/.test(issue)),
    `Expected pseudo overlay unmeasurable issue, got: ${JSON.stringify(badChecked.checks.issues)}`,
  );

  const markerRepairs = (badChecked.checks.layoutRepairs ?? []).filter(repair =>
    Array.isArray(repair.generatedPositions) &&
    repair.generatedPositions.some(pos => pos.pseudo === '::marker' && Array.isArray(pos.path) && pos.path.length > 0),
  );
  assert.ok(markerRepairs.length > 0, 'readCodeLayoutRepairs must locate ::marker generatedPositions');
  for (const repair of markerRepairs) {
    assert.match(repair.reason ?? '', /当前无法核实伪元素声明修正的完整影响范围，本次拒收/);
  }

  await assert.rejects(
    () => codeRepairFragments(badChecked.code, badChecked.checks.issues, badChecked.checks.cleaned, [], badChecked.checks.layoutRepairs ?? []),
    /当前无法核实伪元素声明修正的完整影响范围，本次拒收/,
  );

  const cellBorderSite = buildStepBarSite([
    '@media (min-width: 768px) {',
    '  .steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 36px; padding: 14px 16px 14px 34px; background: #ffffff; border: 1px solid #141414; }',
    '  .steps li { padding: 4px 14px 4px 0; background: transparent; }',
    '  .steps li:not(:last-child) { border-right: 1px solid #141414; }',
    '}',
  ].join('\n'));

  const goodChecked = await checkSiteCode({
    siteId: 't241-good',
    code: cellBorderSite,
    materials,
    images: [],
    legacyImport: true,
  });

  assert.equal(goodChecked.checks.passed, true, `Expected cell-border horizontal step bar to pass, got: ${JSON.stringify(goodChecked.checks.issues)}`);
  assert.deepEqual(goodChecked.checks.issues, []);
});
