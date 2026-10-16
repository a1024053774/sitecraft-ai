import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import { on } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

const output = `artifacts/t173/port-readiness-${Date.now()}-${process.pid}`;
await fs.mkdir(output, { recursive: true });
const cases = {
  'port-only': (port: string, _browser: string) => `${port}\n`,
  'port-empty': (_port: string, browser: string) => `\n${browser}`,
  'port-zero': (_port: string, browser: string) => `0\n${browser}`,
  'port-fraction': (_port: string, browser: string) => `1.5\n${browser}`,
  'port-too-large': (_port: string, browser: string) => `65536\n${browser}`,
  'port-invalid': (_port: string, browser: string) => `not-a-port\n${browser}`,
  'path-invalid': (port: string, _browser: string) => `${port}\n/not-a-browser/session`,
  'path-prefix-only': (port: string, _browser: string) => `${port}\n/devtools/browser/`,
};
for (const [name, incomplete] of Object.entries(cases)) test(`Chrome 端点 ${name} 未就绪时不连接，补全后真实 CDP 可用`, async t => {
  const realRead = fs.readFile.bind(fs), realWrite = fs.writeFile.bind(fs);
  let full = '', stage = 0, reads = 0;
  const evidence: unknown[] = [];
  t.mock.method(fs, 'readFile', async (file: any, encoding: any) => {
    if (!String(file).endsWith('/DevToolsActivePort')) return realRead(file, encoding);
    reads++;
    if (stage === 1) {
      await realWrite(file, full, 'utf8'); stage = 2;
      evidence.push({ state: 'complete', read: reads });
      return realRead(file, encoding);
    }
    if (stage === 2) return realRead(file, encoding);
    // Subscribe before reading. The fixture waits for Chrome's real complete
    // endpoint by file events, then exposes a controlled incomplete file.
    const watcher = watch(path.dirname(String(file)));
    const changes = on(watcher, 'change', { signal: AbortSignal.timeout(8000) });
    try {
      let value = String(await realRead(file, encoding));
      while (!/^\d+\r?\n\/devtools\/browser\/\S+/.test(value.trim())) {
        await changes.next(); value = String(await realRead(file, encoding));
      }
      full = value;
      const [port, browser] = full.trim().split(/\r?\n/);
      await realWrite(file, incomplete(port, browser), 'utf8'); stage = 1;
      evidence.push({ state: 'incomplete', read: reads, content: incomplete(port, browser) });
      return realRead(file, encoding);
    } finally { watcher.close(); await changes.return?.(); }
  });
  syncBuiltinESMExports();
  let browser: Awaited<ReturnType<typeof codeCheckBrowser>> | undefined, outcome = 'complete';
  try {
    browser = await codeCheckBrowser();
    assert.equal(await browser.evaluate('6 * 7'), 42, '实际 Chrome/CDP 必须工作，不能只解析端点');
    assert.equal(stage, 2, '连接前必须观察到补全状态');
    assert.ok(reads >= 2, '不完整状态之后必须再次读取');
  } catch (error) { outcome = String(error); throw error; }
  finally {
    await browser?.close(); t.mock.restoreAll(); syncBuiltinESMExports();
    await fs.writeFile(`${output}/${name}.json`, JSON.stringify({ evidence, reads, stage, outcome }, null, 2), 'utf8');
  }
});
