import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { englishDom, englishFidelity } from '../lib/code-site-english.ts';
import type { SiteCode } from '../lib/code-site.ts';

// Failure modes: currency aliases or serving denominators change; calendar years
// are confused with durations; clock values lose a component; everyday prose
// creates a quantity; classifiers disappear; normalization alters company names.
// Expected equivalence comes from the saved real bilingual response, not tokens.
const fixture = JSON.parse(await readFile(new URL('./fixtures/t209-restaurant-real-response.json', import.meta.url), 'utf8')) as {
  pairs: Array<{ path: string; zh: string; en: string; round: number }>;
};
let browser: Awaited<ReturnType<typeof codeCheckBrowser>>;
test.before(async () => { browser = await codeCheckBrowser(); });
test.after(async () => { await browser.close(); });
const page = (copy: string): SiteCode => ({ header: '', footer: '', css: '', pages: [{ id: 'home', title: 'Home', html: `<main><p>${copy}</p></main>` }] });
async function pair(before: string, after: string) {
  return browser.evaluate<string[]>(`(${englishFidelity.toString()})(${JSON.stringify(page(before))},${JSON.stringify(page(after))},'禾巷小馆')`);
}

for (const row of fixture.pairs) test(`real response ${row.path}, round ${row.round}`, async () => {
  if (row.en.includes('Hexiang Xiaoguan')) {
    assert.match((await pair(row.zh, row.en)).join('\n'), /公司名/);
  } else if (row.en.includes('to be provided')) {
    const result = await browser.evaluate<ReturnType<typeof englishDom>>(`(() => {
      const source = ${JSON.stringify(page(row.zh))};
      const slots = (${englishDom.toString()})(source).slots;
      return (${englishDom.toString()})(source, slots.map(slot => ({id: slot.id, text: ${JSON.stringify(row.en)}})));
    })()`);
    assert.ok(result.code.pages[0].html.includes('To be provided'));
    assert.deepEqual(await browser.evaluate(`(${englishFidelity.toString()})(${JSON.stringify(page(row.zh))},${JSON.stringify(result.code)},'禾巷小馆')`), []);
  } else assert.deepEqual(await pair(row.zh, row.en), []);
});

for (const [before, after] of [
  ['32 元/份', 'CNY 33 per portion'], ['32 元/份', 'USD 32 per portion'],
  ['32 元/份', 'CNY 32 per bowl'], ['32 元/份', 'CNY 32'],
  ['≥32 元', '32 yuan'], ['-32 元', '32 yuan'],
  ['2018 年', '2019'], ['保修 42 年', 'Warranty 42'], ['持续 2018 年', 'Duration 2018'],
  ['11:00–14:00', '11:00–14:30'], ['11:00–14:00', '11:00'],
  ['每年 180 套', '180 sets daily'], ['每天 180 套', '180 sets'],
  ['24 个座位', '25 dine-in seats'], ['型号 X900', 'Model X901'],
  ['20 mm', '2 cm'], ['邮箱 hello@a.test', 'Email hello@b.test'],
  ['网址 https://a.test/x', 'Website https://a.test/y'],
]) test(`reject changed fact: ${before} → ${after}`, async () => {
  assert.match((await pair(before, after)).join('\n'), /保真/);
});

test('ordinary frequency prose has no numeric claim; a numeric rate remains bound', async () => {
  assert.deepEqual(await pair('每日菜单', 'Daily Menu'), []);
  assert.deepEqual(await pair('每天不同', 'Different every day'), []);
  assert.deepEqual(await pair('一家菜馆', 'A restaurant'), []);
  assert.deepEqual(await pair('一个人吃', 'For one person'), []);
  assert.deepEqual(await pair('24 个座位', '24 dine-in seats'), []);
  assert.deepEqual(await pair('成立于 2018 年', 'Founded in 2018'), []);
});
