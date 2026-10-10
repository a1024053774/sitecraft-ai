import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { englishDom, englishFidelity } from '../lib/code-site-english.ts';
import type { SiteCode } from '../lib/code-site.ts';

// Risks: alphabetic words are misclassified as facts; digit-bearing models are
// reduced to bare numbers; multiplicity or units are lost; number order changes
// are rejected; substring guesses create company names; aliases come from prose.
const fixture = JSON.parse(await readFile(new URL('./fixtures/t151-fidelity-real-response.json', import.meta.url), 'utf8'));
const rejected = JSON.parse(await readFile(new URL('./fixtures/t151-rejected-paragraphs.json', import.meta.url), 'utf8'));
const trialRuns = JSON.parse(await readFile(new URL('./fixtures/t151-trial-runs-real-response.json', import.meta.url), 'utf8'));
const timeRate = JSON.parse(await readFile(new URL('./fixtures/t151-time-rate-v6.json', import.meta.url), 'utf8'));
let browser: Awaited<ReturnType<typeof codeCheckBrowser>>;
test.before(async () => { browser = await codeCheckBrowser(); });
test.after(async () => { await browser.close(); });
async function check(source: SiteCode, candidate: SiteCode, materials = '', companyName = fixture.companyName) {
  return browser.evaluate<string[]>(`(${englishFidelity.toString()})(${JSON.stringify(source)},${JSON.stringify(candidate)},${JSON.stringify(companyName)},${JSON.stringify(materials)})`);
}
function page(copy: string): SiteCode {
  return { header: '', footer: '', css: '', pages: [{ id: 'home', title: 'Home', html: `<main><p>${copy}</p></main>` }] };
}
async function pair(before: string, after: string, materials = '') { return check(page(before), page(after), materials); }

for (const [before, after] of [
  ['转速 20 rpm', 'Speed 20 revolutions per minute'],
  ['转速 20 rps', 'Speed 20 revolutions per second'],
  ['压力 20 psi', 'Pressure 20 pounds per square inch'],
]) test(`registered complete unit alias takes precedence over time rates: ${after}`, async () => {
  assert.deepEqual(await pair(before, after), []);
});

test('time rate: the unmodified v6 annual-capacity paragraph is equivalent', async () => {
  assert.equal(timeRate.revision, 6);
  assert.equal(timeRate.rawTranslation.text, timeRate.translation);
  assert.deepEqual(await pair(timeRate.source, timeRate.translation), []);
});
test('time rate: annual 180 sets cannot become 180 sets per month', async () => {
  assert.match((await pair('年产 180 套', '180 sets per month')).join('\n'), /保真/);
});

const periods = [
  { zh: ['年产', '每年'], slash: ['年'], en: ['per year', '/year', 'a year', 'annually'] },
  { zh: ['月产', '每月'], slash: ['月'], en: ['per month', '/month', 'a month', 'monthly'] },
  { zh: ['日产', '每天', '每日'], slash: ['天'], en: ['per day', '/day', 'a day', 'daily'] },
  { zh: ['每小时'], slash: ['h'], en: ['per hour', '/h', 'hourly'] },
  { zh: ['每分钟'], slash: ['min'], en: ['per minute', '/min'] },
];
for (const period of periods) test(`time rate: ${period.en[0]} aliases keep the same period`, async () => {
  for (const prefix of period.zh) for (const alias of period.en) {
    assert.deepEqual(await pair(`${prefix} 180 套`, `180 sets ${alias}`), [], `${prefix} → ${alias}`);
    if (alias.endsWith('ly')) assert.deepEqual(await pair(`${prefix} 180 套`, `${alias} output is 180 sets`), []);
  }
  for (const suffix of period.slash) assert.deepEqual(await pair(`180 套/${suffix}`, `180 sets ${period.en[0]}`), []);
});
test('time rate: each period stays associated with its own quantity and physical unit', async () => {
  assert.deepEqual(await pair('年产 180 套；月产 600 万件', '180 sets per year; 6 million pieces per month'), []);
  assert.match((await pair('年产 180 套；月产 600 万件', '180 sets per month; 6 million pieces per year')).join('\n'), /保真/);
  assert.match((await pair('每小时 30 L', '30 kg per hour')).join('\n'), /保真/);
  assert.match((await pair('每小时 180 套', '180 sets')).join('\n'), /保真/);
});
test('time rate: unbound compound units retain the numerator across separator spellings', async () => {
  assert.deepEqual(await pair('单位 custom/min', 'Unit custom per minute'), []);
  assert.match((await pair('单位 custom/min', 'Unit other per minute')).join('\n'), /保真/);
});

test('independent marker scanning keeps a compact mapped quantity distinct from a model', async () => {
  assert.deepEqual(await pair('流量 30 升/分钟', 'Flow 30L/min'), []);
});

for (const [before, after] of [
  ['42 台设备', '42 X900 machines'],
  ['42 台设备', '42 furlongs/min'],
  ['3 次试模', '3 trial runs-per-hour'],
  ['3 次试模', '3 rpm trial runs'],
  ['3 次试模', '3 years trial runs'],
  ['设备', 'Equipment furlongs/min'],
]) {
  test(`Astra tokenizer order: ${before} cannot become ${after}`, async () => {
    assert.match((await pair(before, after)).join('\n'), /保真/);
  });
}

test('English slot writeback deterministically converts fullwidth punctuation', async () => {
  const source = page('说明');
  source.pages[0].title = '标题';
  source.pages[0].html = '<main><p title="提示">说明</p></main>';
  const result = await browser.evaluate<ReturnType<typeof englishDom>>(`(() => {
    const source = ${JSON.stringify(source)};
    const slots = (${englishDom.toString()})(source).slots;
    return (${englishDom.toString()})(source, slots.map(slot => ({ id: slot.id, text: 'Inquiry：ready，yes。；（ok）！？' })));
  })()`);
  assert.equal(result.code.pages[0].title, 'Inquiry:ready,yes.;(ok)!?');
  assert.equal(result.code.pages[0].html, '<main><p title="Inquiry:ready,yes.;(ok)!?">Inquiry:ready,yes.;(ok)!?</p></main>');
  assert.equal(source.pages[0].title, '标题');
});

test('real trial-molding runs retain the nonempty occurrence unit', async () => {
  assert.ok(JSON.parse(trialRuns.rawMessage.tool_calls[0].function.arguments).translations.some((row: any) => row.text === trialRuns.translation));
  assert.deepEqual(await pair(trialRuns.source, trialRuns.translation), []);
  assert.deepEqual(await pair('检查 42 次', '42 inspection runs'), []);
  assert.match((await pair('检查 42 次', '42 inspections')).join('\n'), /保真/);
  assert.match((await pair('检查 42 次', '42')).join('\n'), /保真/);
  assert.match((await pair('检查 42 次', '43 inspection runs')).join('\n'), /保真/);
});

test('unknown Unicode unit symbols cannot disappear', async () => {
  assert.match((await pair('20 Ω', '20')).join('\n'), /保真/);
});
test('unknown dotted units retain the full original symbol', async () => {
  assert.match((await pair('20 custom.unit', '20 custom.other')).join('\n'), /保真/);
});
test('digit-bearing unknown units stay associated with their values', async () => {
  assert.match((await pair('20 custom2, 30 custom3', '30 custom2, 20 custom3')).join('\n'), /保真/);
});
test('Unicode model prefixes are protected as whole digit-bearing markers', async () => {
  assert.match((await pair('型号 Ω20', 'Model 20')).join('\n'), /保真/);
});
test('explicit company-name equivalence does not turn name characters into quantities', async () => {
  assert.deepEqual(await check(page('三台机械'), page('Triple Machines'), '英文公司名：Triple Machines', '三台机械'), []);
  assert.deepEqual(await check(page(fixture.companyName), page('Precision Molds'), '英文公司名：Precision Molds'), []);
  assert.match((await check(page(fixture.companyName), page('Precision Molds'))).join('\n'), /公司名/);
  assert.match((await check(page('三台机械：20 mm'), page('Triple Machines: 20 cm'), '英文公司名：Triple Machines', '三台机械')).join('\n'), /保真/);
});

for (const [before, after] of [['30 L/min', '30 L/h'], ['20 bar', '20 psi'], ['42 次', '42']]) {
  test(`Astra: full unit ${before} cannot become ${after}`, async () => {
    assert.match((await pair(before, after)).join('\n'), /保真/);
  });
}
test('Astra: a leading decimal is not parsed from its middle', async () => {
  assert.match((await pair('.05 mm', '5 mm')).join('\n'), /保真/);
});
test('Astra: leading decimal spelling preserves its whole value', async () => {
  assert.deepEqual(await pair('.5 mm', '0.5 mm'), []);
});
for (const [before, after, accepted] of [['三台设备', '3 machines', true], ['三台设备', 'Machines', false], ['十台设备', '10 machines', true]] as const) {
  test(`Astra: Chinese numeric count ${before} → ${after}`, async () => {
    const issues = await pair(before, after);
    if (accepted) assert.deepEqual(issues, []); else assert.match(issues.join('\n'), /保真/);
  });
}

test('real FAQ and EDM translations are words; only digit-bearing markers are protected', async () => {
  const rows = fixture.pairs.filter((row: any) => ['常见问题', '镜面电火花', '精密慢走丝线切割'].includes(row.before));
  assert.equal(rows.length, 4);
  for (const row of rows) assert.deepEqual(await pair(row.before, row.after), []);
  assert.match((await pair('型号 P3T', 'Model P4T')).join('\n'), /保真/);
  assert.match((await pair('型号 P3T', 'Model Q3T')).join('\n'), /保真/);
  assert.match((await pair('设备', 'Equipment AB12')).join('\n'), /保真/);
  assert.match((await pair('邮箱 sales@factory.test', 'Email other@factory.test')).join('\n'), /保真/);
  assert.match((await pair('网址 https://factory.test/a1', 'URL https://factory.test/a2')).join('\n'), /保真/);
});

test('real T1 and PMMA quantities compare as a multiset; deterministic scale spelling preserves values', async () => {
  const rows = fixture.pairs.filter((row: any) => /T1|PMMA|万/.test(row.before) && !row.before.includes('42 台') && !row.before.includes('3 次试模'));
  assert.equal(rows.length, 4);
  for (const row of rows) assert.deepEqual(await pair(row.before, row.after), []);
  for (const row of fixture.pairs.filter((row: any) => row.before.includes('3 次试模'))) assert.match((await pair(row.before, row.after)).join('\n'), /保真/);
  assert.deepEqual(await pair('每套模具含 3 次试模', 'Trial molding is performed 3 times for each mold'), []);
  assert.match((await pair('每套模具含 3 次试模', 'Trial molding is performed 3 times per mold')).join('\n'), /保真/);
  assert.deepEqual(await pair('600 万件', '6 million pieces'), []);
  assert.deepEqual(await pair('尺寸 20 ㎜，长度 30 毫米', 'Length 30 mm; size 20 mm'), []);
  assert.deepEqual(await pair('功率 1.25 千瓦，数量 0.5 万件', 'Quantity 5,000 pieces; power 1.25 kW'), []);
  assert.deepEqual(await pair('二次元影像测量仪', '2D Vision Measuring Instruments'), []);
  for (const [before, after] of [
    ['尺寸 20 mm，20 mm', 'Size 20 mm'], ['尺寸 20 mm', 'Size 20 mm; 20 mm'],
    ['尺寸 20 mm', 'Size 20 cm'], ['产量 600 万件', 'Capacity 6,000 pieces'],
    ['试模 T1 后 3 天', 'Within 3 days after T2'], ['型号 A12/B34', 'Model A12/B35'],
    ['透光率 ≥90%', 'Transmission <90%'], ['公差 ±0.03 mm', 'Tolerance 0.03 mm'],
  ]) assert.match((await pair(before, after)).join('\n'), /保真/);
});

test('real company substrings are ordinary copy; only record name or an explicit material name identifies the company', async () => {
  for (const row of fixture.pairs.filter((row: any) => row.issue.includes('公司名'))) assert.deepEqual(await pair(row.before, row.after), []);
  const englishName = JSON.parse(fixture.calls[0].response.rawMessage.tool_calls[0].function.arguments).translations[0].text;
  assert.match((await pair(fixture.companyName, englishName)).join('\n'), /公司名/);
  assert.deepEqual(await pair(fixture.companyName, englishName, `英文公司名：${englishName}`), []);
  assert.match((await pair(fixture.companyName, englishName, `介绍：${englishName} makes molds.`)).join('\n'), /公司名/);
  assert.match((await pair(fixture.companyName, 'Precision Molds P3T')).join('\n'), /公司名/);
});

test('saved real response accepts equivalent production periods but retains trial frequency', async () => {
  const issues = await check(fixture.sourceCode, fixture.attempts[1].code, fixture.materials);
  assert.deepEqual(issues.map(issue => issue.split(' ')[0]).sort(), ['home/1/3/9/1/3/3/1/0', 'home/1/3/13/1/3/5/0/1/0/0'].sort());
  assert.ok(issues.every(issue => issue.includes('保真')));
});

test('real 42 台 accepts the same number without a count word; physical and time units stay strict', async () => {
  const capacity = rejected.pairs.find((row: any) => row.before.includes('42'));
  assert.ok(capacity.after.includes('42 injection molding machines'));
  assert.deepEqual(await pair(capacity.before, capacity.after), []);
  assert.deepEqual(await pair('注塑机 42 台（90–800 t）', '42 injection molding machines (90–800 t)'), []);
  for (const word of ['台', '套', '个', '件', '条', '家', '名', '位', '种', '款', '项', '座', '只', '张', '批']) {
    assert.deepEqual(await pair(`数量 42 ${word}`, 'Quantity 42'), []);
  }
  for (const [before, after] of [['42 吨', '42'], ['42 mm', '42'], ['42 kW', '42'], ['42 ㎡', '42'], ['42 MPa', '42'], ['42 年', '42']]) {
    assert.match((await pair(before, after)).join('\n'), /保真/);
  }
  const inspection = rejected.pairs.find((row: any) => row.before.includes('全检'));
  assert.match((await pair(inspection.before, inspection.after)).join('\n'), /保真/);
});
