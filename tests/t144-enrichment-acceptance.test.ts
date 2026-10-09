import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import type { SiteCode } from '../lib/code-site.ts';
import { assertEnrichmentStep, observeEnrichmentCode } from '../scripts/enrichment-acceptance.ts';
import { enrichmentFixtureCode } from './fixtures/incremental-enrichment.ts';

// Failure modes from Astra and the input contract: lost old facts, values
// attached to the wrong product, unauthorized actions in any page or shared
// fragment, and hiding the action in an accessible label. No model is called.
const astra = JSON.parse(await readFile(new URL('./fixtures/t144-astra-counterexample.json', import.meta.url), 'utf8')) as { source: string; code: SiteCode };
const browser = await codeCheckBrowser();
const evidence: Array<Record<string, unknown>> = [];
test.after(async () => {
  await browser.close();
  const directory = `artifacts/t144/acceptance-${crypto.randomUUID()}`; await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/report.json`, JSON.stringify({ at: new Date().toISOString(), source: astra.source, modelCalls: 0, evidence }, null, 2), 'utf8');
});
async function rejects(code: SiteCode, step: number, expected: RegExp, label: string) {
  const pages = await observeEnrichmentCode(browser, code);
  let rejection = '';
  assert.throws(() => { try { assertEnrichmentStep(step, pages); } catch (error) { rejection = String(error); throw error; } }, expected, label);
  evidence.push({ label, rejection });
}

test('Astra 原反例分别证明用途遗漏与第三步产品页索取报价被拒绝', async () => {
  const missingUses = structuredClone(astra.code);
  for (const page of missingUses.pages) page.html = page.html.replace('<p><a href="/contact">索取报价</a></p>', '');
  await rejects(missingUses, 3, /缺少事实：用于输送设备/, '原反例丢失 R 系列用途');
  const missingKUse = structuredClone(missingUses);
  const products = missingKUse.pages.find(p => p.id === 'products')!;
  products.html = products.html.replace('0.12–4 kW。</p>', '0.12–4 kW。用于输送设备。</p>');
  await rejects(missingKUse, 3, /缺少事实：用于包装设备/, '恢复 R 用途后仍须发现 K 用途遗漏');
  const quote = structuredClone(astra.code);
  for (const page of quote.pages) {
    page.html = page.html.replace('0.12–4 kW。</p>', '0.12–4 kW。用于输送设备。</p>')
      .replace('0.12–5.5 kW。</p>', '0.12–5.5 kW。用于包装设备。</p>');
  }
  await rejects(quote, 3, /products 出现未要求的功能/, '原反例产品页索取报价');
});

test('按用户输入逐项删去全部应保留事实时，每一项都会失败', async () => {
  // Literal deletion inputs are independently enumerated from the user material.
  for (const [introducedAt, facts] of [
    [1, ['澄川传动', '生产工业齿轮减速机', 'R 系列斜齿轮减速机', 'K 系列锥齿轮减速机']],
    [2, ['R47', '244 N·m', '3.83–54.00', '0.12–4 kW', '用于输送设备', 'K57', '400 N·m', '10.43–59.82', '0.12–5.5 kW', '用于包装设备']],
    [3, ['2016', '开始生产工业齿轮减速机', '2021', '增加 K 系列锥齿轮减速机', '2024', '华岭输送设备', '提供 R47 减速机', '用于输送线驱动', '数量与运行效果待补充', 'chengchuan-sales@luckye.online']],
  ] as const) for (const step of [1, 2, 3].filter(step => step >= introducedAt)) for (const fact of facts) {
    const code = enrichmentFixtureCode(step);
    code.header = code.header.replaceAll(fact, ''); code.footer = code.footer.replaceAll(fact, '');
    for (const page of code.pages) page.html = page.html.replaceAll(fact, '');
    await rejects(code, step, /缺少事实/, `第 ${step} 步删除 ${fact}`);
  }
  const swapped = enrichmentFixtureCode(3);
  for (const page of swapped.pages) page.html = page.html.replace('用于输送设备', '用于包装设备').replace(/(K 系列[^]*?)用于包装设备/, '$1用于输送设备');
  await rejects(swapped, 3, /R 系列.*缺少事实：用于输送设备/, '用途词仍在整站中但被分给错误产品');
});

test('每一步的所有页面与公共页头页脚都禁止报价、询价、样品入口', async () => {
  for (const step of [1, 2, 3]) for (const action of ['索取报价', '询价', '索取样品']) {
    const base = enrichmentFixtureCode(step);
    for (const location of ['header', 'footer', ...base.pages.map(p => p.id)]) {
      const code = structuredClone(base), entry = `<a href="/contact">${action}</a>`;
      if (location === 'header' || location === 'footer') code[location] += entry;
      else code.pages.find(p => p.id === location)!.html += entry;
      await rejects(code, step, /出现未要求的功能/, `第 ${step} 步 ${location} 添加 ${action}`);
    }
  }
  const hidden = enrichmentFixtureCode(3); hidden.footer += '<a href="/products" aria-label="索取报价">产品</a>';
  await rejects(hidden, 3, /出现未要求的功能/, '公共页脚辅助标签的报价入口');
});

test('三步正常夹具在 1440/375 下通过同一事实与功能断言', async () => {
  for (const width of [1440, 375]) for (const step of [1, 2, 3]) {
    assertEnrichmentStep(step, await observeEnrichmentCode(browser, enrichmentFixtureCode(step), width));
    evidence.push({ step, width, status: 'PASS' });
  }
});

test('型号必须是完整词元，K570、字母及小数点后缀不能当作 K57', async () => {
  for (const to of ['K570', 'K57A', 'K57.0', 'AK57', '.K57']) for (const step of [2, 3]) {
    const code = enrichmentFixtureCode(step);
    for (const page of code.pages) page.html = page.html.replaceAll('K57', to);
    await rejects(code, step, /缺少事实：型号 K57/, `第 ${step} 步 K57 不能匹配 ${to}`);
  }
});

test('范围必须整体匹配，54.001、字母后缀与错误起点不能当作 3.83–54.00', async () => {
  for (const to of ['3.83–54.001', '3.83–54.00A', '13.83–54.00', '.3.83–54.00']) for (const step of [2, 3]) {
    const code = enrichmentFixtureCode(step);
    for (const page of code.pages) page.html = page.html.replaceAll('3.83–54.00', to);
    await rejects(code, step, /缺少事实：减速比 3.83/, `第 ${step} 步 3.83–54.00 不能匹配 ${to}`);
  }
});

test('正常字符宽度、连字符与单位空格可变化', async () => {
  const variant = enrichmentFixtureCode(3);
  for (const page of variant.pages) page.html = page.html.replaceAll('K57', 'Ｋ５７').replaceAll('R47', 'Ｒ４７')
    .replaceAll('–', '－').replaceAll('0.12－4', '0.12-4')
    .replaceAll('244 N·m', '２４４N·m').replaceAll('400 N·m', '４００ N·m').replaceAll(' kW', 'kW');
  for (const width of [1440, 375]) assertEnrichmentStep(3, await observeEnrichmentCode(browser, variant, width));
  evidence.push({ label: '全角型号/数字/连字符、单位前无空格', status: 'PASS' });
});
