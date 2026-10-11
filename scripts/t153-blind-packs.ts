import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

assert.equal(process.env.SITECRAFT_BASE, 'http://127.0.0.1:3170');
const folder = process.argv[2], styleOnly = process.argv[3] === '--available-style-pair';
assert.ok(folder && path.resolve(folder).startsWith(path.join(process.cwd(), 'artifacts/t153/')));
const record = JSON.parse(await readFile(path.join(folder, 'private/generation.json'), 'utf8'));
const budget = JSON.parse(await readFile(path.join(folder, 'private/budget/usage.json'), 'utf8'));
assert.ok(budget.spent <= 300000 && !budget.stopped && budget.calls.every((call: any) => call.state === 'complete' && call.httpStatus === 200 && call.usage));
for (const phase of (styleOnly ? ['default'] : ['default', 'low', 'high'])) {
  assert.equal(record.phases[phase]?.status, 'PASS', `Do not package an unfinished ${phase} as a completed comparison`);
  const site = JSON.parse(await readFile(path.join(folder, 'private', phase, 'code-site.json'), 'utf8'));
  const version = site.versions.find((v: any) => v.id === record.phases[phase].versionId);
  assert.ok(version?.checks.passed && version.model === 'deepseek-flash');
}
const specs = [
  { purpose: 'style', entries: [{ role: 'baseline', source: record.baseline.source, siteId: record.baseline.siteId, versionId: record.baseline.versionId },
    { role: 'default', source: path.join(folder, 'private/default'), siteId: record.siteId, versionId: record.phases.default.versionId }],
    questions: '两版是否属于不同的设计方向？\n各自最明显的特点是什么？请结合首页和产品页的具体位置说明。\n哪版更像这家公司自己的网站？可以回答持平或各有优劣，请给出观察依据。' },
  { purpose: 'layout-density', entries: ['low', 'high'].map(role => ({ role, source: path.join(folder, 'private', role), siteId: record.siteId, versionId: record.phases[role]?.versionId })),
    questions: '哪版的版式更大胆？请结合首页和产品页的具体位置说明。\n哪版的信息排列更紧凑？请结合首页和产品页的具体位置说明。\n若无法分辨或不同页面的判断不一致，请直接说明。' },
];
const mappings = [];
for (const spec of specs.filter(spec => !styleOnly || spec.purpose === 'style')) {
  const token = randomUUID().slice(0, 8), destination = path.join(folder, 'review', token);
  await mkdir(destination, { recursive: true });
  if (randomInt(2)) spec.entries.reverse();
  const entries = [];
  for (const [index, entry] of spec.entries.entries()) {
    const label = `${index === 0 ? 'A' : 'B'}-${randomUUID().slice(0, 8)}`;
    await mkdir(path.join(destination, label));
    for (const [page, name] of [['home', '首页'], ['products', '产品页']]) for (const [width, size] of [[1440, '宽屏'], [375, '窄屏']]) {
      await copyFile(path.join(entry.source, `${page}-${width}.png`), path.join(destination, label, `${name}-${size}.png`));
    }
    entries.push({ label, ...entry });
  }
  const prompt = `请只查看本目录中的图片，不查找其他资料或相邻目录。图片是同一家公司网站的两种方案；每版都包含首页和产品页的宽屏、窄屏截图。\n\n请按以下顺序查看：${entries.map(entry => entry.label).join('、')}。\n\n${spec.questions}\n`;
  assert.doesNotMatch(prompt, /滑杆|画册|铭牌|现场实拍|精密工程|editorial|documentary|precision|2\/2|5\/6|9\/9/);
  await writeFile(path.join(destination, 'README.md'), prompt, 'utf8');
  mappings.push({ package: `review/${token}`, purpose: spec.purpose, entries });
}
await writeFile(path.join(folder, 'private/blind-mapping.json'), JSON.stringify({ createdAt: new Date().toISOString(), spent: budget.spent, status: styleOnly ? 'INCOMPLETE' : 'PASS', ...(styleOnly ? { missingPackage: 'layout-density', reason: record.budgetDecision } : {}), mappings }, null, 2), { flag: 'wx' });
console.log(JSON.stringify(mappings.map(({ purpose, package: directory }) => ({ purpose, path: path.join(folder, directory) })), null, 2));
