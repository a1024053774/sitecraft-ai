import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// Real production entry and CDP processes; only one worker's read is faulted.
// Risks: partial acceptance, late worker ignored, context leak, sibling process
// leak, or successful checks bypassing context disposal.
const browserUrl = pathToFileURL(path.resolve('lib/code-site-browser.ts')).href;
let scenario: 'normal' | 'failure' | 'timeout' = 'normal';
let injected = false;
const owners: any[] = [];
(globalThis as any).__t178FailureBrowser = (root: any) => {
  const record = { pid: root.pid, created: [] as string[], disposed: [] as string[], closed: false };
  owners.push(record);
  return { ...root, async createContext() {
    const page = await root.createContext(); record.created.push(page.browserContextId);
    return { ...page, async evaluate(expression: string) {
      if (scenario !== 'normal' && !injected && expression.includes('readStarted')) {
        injected = true;
        if (scenario === 'failure') throw new Error('故意让一路完整读取失败');
        // A deliberate late CDP read crosses the unchanged production deadline.
        await page.evaluate('new Promise(resolve=>setTimeout(resolve,5100))');
      }
      return page.evaluate(expression);
    }, async close() {
      await page.close();
      const contexts = await root.sendBrowser('Target.getBrowserContexts');
      const targets = await root.sendBrowser('Target.getTargets');
      assert.ok(!contexts.browserContextIds.includes(page.browserContextId));
      assert.ok(!targets.targetInfos.some((target: any) => target.targetId === page.targetId));
      record.disposed.push(page.browserContextId);
    } };
  }, async close() { await root.close(); record.closed = true; } };
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.resolve(specifier.slice(2) + '.ts')).href;
  const resolved = next(specifier, context);
  if (resolved.url !== browserUrl) return resolved;
  return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
    'import {codeCheckBrowser as real} from ' + JSON.stringify(browserUrl + '?failure-test') + ';' +
    'export async function codeCheckBrowser(){return globalThis.__t178FailureBrowser(await real())}'
  ) };
} });
const { checkSiteCode } = await import('../lib/code-site-check.ts');

test('提交检查任一路失败或迟到均拒收，正常、失败、超时均清理全部上下文与浏览器', async () => {
  const output = `artifacts/t178/parallel-failure-${Date.now()}-${process.pid}`;
  await mkdir(output, { recursive: true });
  const fixture = JSON.parse(await readFile('tests/fixtures/t178-restaurant.json', 'utf8'));
  // Small authored page isolates the failure contract from restaurant timing.
  const source = { ...fixture.version.code, header: '', footer: '', css: 'a:hover{color:red}',
    pages: [{ id: 'home', title: '说明', html: '<main><section><h1>说明</h1><p>原文</p><a href="#tail">入口</a></section><section id="tail"><h2>其他</h2><p>保留</p></section></main>' }] };
  const candidate = { ...source, pages: [{ ...source.pages[0], html: source.pages[0].html.replace('原文', '新文') }] };
  const args = { siteId: fixture.timingSiteId, code: candidate, materials: '说明 新文 其他 保留 入口', images: [], legacyImport: true as const,
    localEdit: { source, target: { kind: 'dom' as const, versionId: fixture.version.id, pageId: 'home', path: [0], label: '说明', text: '说明 原文 入口' } } };
  const observations: any[] = [];
  try {
    for (const value of ['normal', 'failure', 'timeout'] as const) {
      scenario = value; injected = false; owners.length = 0;
      if (value === 'normal') {
        const result = await checkSiteCode(args);
        assert.deepEqual(result.checks.issues, []);
        assert.equal(result.checks.passed, true);
      } else {
        await assert.rejects(checkSiteCode(args), value === 'failure' ? /故意让一路完整读取失败/ : /超时/);
        assert.equal(injected, true, '必须实际走到独立一路的读取故障，不能由其他错误提前结束');
      }
      assert.equal(owners.length, 2);
      for (const owner of owners) {
        assert.ok(owner.created.length > 0);
        assert.deepEqual(owner.disposed, owner.created);
        assert.equal(owner.closed, true);
        assert.throws(() => process.kill(owner.pid, 0), { code: 'ESRCH' });
      }
      observations.push({ scenario: value, rejected: value !== 'normal', owners: structuredClone(owners) });
    }
  } finally { await writeFile(`${output}/result.json`, JSON.stringify(observations, null, 2) + '\n', 'utf8'); }
});
