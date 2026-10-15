import assert from 'node:assert/strict';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { englishFidelity } from '../lib/code-site-english.ts';
import type { SiteCode } from '../lib/code-site.ts';

function page(copy: string): SiteCode {
  return { header: '', footer: '', css: '', pages: [{ id: 'home', title: 'Home', html: `<main><p>${copy}</p></main>` }] };
}

let browser: Awaited<ReturnType<typeof codeCheckBrowser>>;
test.before(async () => { browser = await codeCheckBrowser(); });
test.after(async () => { await browser.close(); });

async function pair(before: string, after: string) {
  return browser.evaluate<string[]>(`(${englishFidelity.toString()})(${JSON.stringify(page(before))},${JSON.stringify(page(after))},'', '')`);
}

test('纯字母缩写与数字型号在中英改写后保持完整记号', async () => {
  for (const [before, after] of [
    ['取得 ISO 9001 认证。', 'ISO 9001 certified.'],
    ['符合 GB 50016。', 'Complies with GB 50016.'],
    ['防护等级 IP65。', 'Ingress protection IP65.'],
  ]) assert.deepEqual(await pair(before, after), [], `${before} → ${after}`);
});

test('纯字母缩写的数字型号改变时仍拒收', async () => {
  assert.match((await pair('取得 ISO 9001 认证。', 'ISO 9002 certified.')).join('\n'), /保真/);
});
