import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

// An old, persisted question must not revive a removed option. Seed only
// alignment/preferences metadata, never site code or a version.
assert.equal(process.env.SITECRAFT_BASE, 'http://127.0.0.1:3170');
assert.equal(process.env.SITE_STORE, 'fs');
process.env.SITECRAFT_DATA_ROOT = path.join(process.cwd(), '.sitecraft-data');
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const { updateConversationAlignment } = await import('../lib/conversation-store.ts');
const { updateCodeSite } = await import('../lib/code-site-store.ts');
const base = process.env.SITECRAFT_BASE;
const post = async (route: string, body: unknown) => {
  const res = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.ok(res.ok); return res.json();
};
const report: Record<string, any> = { startedAt: new Date().toISOString(), status: 'INCOMPLETE' };
const folder = `artifacts/t153/approved/retired-style-${Date.now()}`; await mkdir(folder, { recursive: true });
const created = await post('/api/sites', { name: '旧风格问题检查' }); report.siteId = created.id;
const state = await post(`/api/sites/${created.id}/chat`, { message: '公司名：旧风格问题检查\n齿轮加工。' });
await updateConversationAlignment(created.id, state.conversationId, record => ({ ...record, alignment: { ...record.alignment,
  currentQuestion: { ...record.alignment.currentQuestion!, options: [...record.alignment.currentQuestion!.options, { id: 'industrial', label: '工业铭牌', description: '历史选项' }] } } }));
await updateCodeSite(created.id, () => ({ preferences: { style: 'industrial' as any, layout: 5, density: 6 } }));
const browser = await codeCheckBrowser();
try {
  await browser.send('Page.navigate', { url: `${base}/workspace?site=${created.id}` });
  for (let i = 0; i < 100; i++) {
    if (await browser.evaluate(`!!document.querySelector('[data-testid="code-style-question"]')`)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await browser.evaluate(`!!document.querySelector('input[value="industrial"]')`), false, 'Historical questions must not offer the retired style');
  assert.equal(await browser.evaluate(`document.querySelector('[data-testid="code-style-question"] .primary-button').disabled`), true, 'A retired saved preference requires a new user choice');
  assert.match(await browser.evaluate<string>(`document.querySelector('[data-testid="code-style-question"]').textContent`), /已下线.*重新选择/);
  await browser.evaluate(`document.querySelector('input[value="precision"]').click()`);
  for (let i = 0; i < 100; i++) {
    if (!await browser.evaluate(`document.querySelector('[data-testid="code-style-question"] .primary-button').disabled`)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await browser.evaluate(`document.querySelector('[data-testid="code-style-question"] .primary-button').disabled`), false);
  report.status = 'PASS';
} catch (error) { report.error = String(error); throw error; }
finally { await browser.close(); await writeFile(path.join(folder, 'report.json'), JSON.stringify(report, null, 2)); console.log(folder); }
