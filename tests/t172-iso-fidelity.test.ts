import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { SiteCode } from '../lib/code-site.ts';
import { commitSiteCode } from '../lib/code-site-store.ts';

type Case = {
  name: string;
  before: string;
  after: string;
  expected: 'pass' | 'reject';
  companyName?: string;
  englishName?: string;
};

const baseCss = 'body{margin:0;color:#111;background:#fff;font:16px/1.5 sans-serif}main{padding:24px}';
const sourceTitle = '规格';
const englishTitle = 'Specifications';

function code(text: string, header = '', title = sourceTitle): SiteCode {
  return { header: header ? `<header><p>${header}</p></header>` : '', footer: '', css: baseCss,
    pages: [{ id: 'home', title, html: `<main><h1>${title}</h1><p>${text}</p></main>` }] };
}

const cases: Case[] = [
  { name: 'ISO 9001 certified 通过', before: '取得 ISO 9001 认证。', after: 'ISO 9001 certified.', expected: 'pass' },
  { name: '中文紧贴 GB/T 前缀仍通过', before: '符合GB/T 50016。', after: 'Complies with GB/T 50016.', expected: 'pass' },
  { name: '中文紧贴 ISO 型号仍通过', before: '取得ISO 9001认证。', after: 'ISO 9001 certified.', expected: 'pass' },
  { name: '型号前后紧贴中文标点仍通过', before: '型号GB/T 50016，符合ISO 9001。', after: 'Model GB/T 50016, compliant with ISO 9001.', expected: 'pass' },
  { name: 'ISO 9002 改号拒收', before: '取得 ISO 9001 认证。', after: 'ISO 9002 certified.', expected: 'reject' },
  { name: '9001 改为 9010 拒收', before: '取得 ISO 9001 认证。', after: 'ISO 9010 certified.', expected: 'reject' },
  { name: 'GB/T 改为 GB/R 拒收', before: '符合 GB/T 50016。', after: 'Complies with GB/R 50016.', expected: 'reject' },
  { name: 'GB/T 数值改为 50017 拒收', before: '符合 GB/T 50016。', after: 'Complies with GB/T 50017.', expected: 'reject' },
  { name: '新增一个完整型号拒收', before: '取得 ISO 9001 认证。', after: 'ISO 9001 and GB/T 50016 certified.', expected: 'reject' },
  { name: '删除一个完整型号拒收', before: '取得 ISO 9001 与 GB/T 50016 认证。', after: 'ISO 9001 certified.', expected: 'reject' },
  { name: 'ISO 改为 IOS 拒收', before: '取得 ISO 9001 认证。', after: 'IOS 9001 certified.', expected: 'reject' },
  { name: 'iso 9001 大小写改变拒收', before: '取得 ISO 9001 认证。', after: 'iso 9001 certified.', expected: 'reject' },
  { name: 'ISO9001 去掉分隔空格拒收', before: '取得 ISO 9001 认证。', after: 'ISO9001 certified.', expected: 'reject' },
  { name: 'IP-65 与 IP65 分隔改变拒收', before: '防护等级 IP-65。', after: 'Ingress protection IP65.', expected: 'reject' },
  { name: 'GB/T 去掉斜线拒收', before: '符合 GB/T 50016。', after: 'Complies with GBT 50016.', expected: 'reject' },
  { name: 'IP65 不得改成 65 mm', before: '防护等级 IP65。', after: 'Ingress protection 65 mm.', expected: 'reject' },
  { name: 'GB/Z 完整前缀通过', before: '符合 GB/Z 50016。', after: 'Complies with GB/Z 50016.', expected: 'pass' },
  { name: 'JIS-B 完整前缀通过', before: '符合 JIS-B 1234。', after: 'Complies with JIS-B 1234.', expected: 'pass' },
  { name: 'ISO/IEC 完整前缀通过', before: '符合 ISO/IEC 17025。', after: 'Complies with ISO/IEC 17025.', expected: 'pass' },
  { name: 'ISO/IEC 改为 ISO-IEC 拒收', before: '符合 ISO/IEC 17025。', after: 'Complies with ISO-IEC 17025.', expected: 'reject' },
  { name: '句中多个型号原样通过', before: '型号 ISO 9001 与 GB/T 50016。', after: 'Models ISO 9001 and GB/T 50016.', expected: 'pass' },
  { name: '句中多个型号改一个拒收', before: '型号 ISO 9001 与 GB/T 50016。', after: 'Models ISO 9001 and GB/T 50017.', expected: 'reject' },
  { name: '公司英文名与型号重叠仍通过', before: '取得 ISO 9001 认证。', after: 'Certified under ISO 9001.', expected: 'pass', companyName: '恒达', englishName: 'ISO 9001 Works' },
  { name: '公司英文名重叠但型号改号拒收', before: '取得 ISO 9001 认证。', after: 'Certified under ISO 9002.', expected: 'reject', companyName: '恒达', englishName: 'ISO 9001 Works' },
  { name: '公司英文名重叠不能吞掉型号', before: '取得 ISO 9001 认证。', after: 'Certified.', expected: 'reject', companyName: '恒达', englishName: 'ISO 9001 Works' },
];

async function submitCase(row: Case) {
  const siteId = `t172-${randomUUID()}`;
  const companyName = row.companyName ?? '测试企业';
  const materials = `${row.before}${row.englishName ? `\n英文公司名：${row.englishName}` : ''}`;
  const source = code(row.before, row.companyName ?? '');
  const seeded = await commitSiteCode({ siteId, legacyImport: {
    kind: 'convert', name: companyName, source: { revision: 1, updatedAt: new Date().toISOString() }, materials, code: source, exportIssues: [],
  } });
  assert.equal(seeded.status, 'applied', `${row.name} 的本地中文夹具未能经提交入口保存`);
  const candidate = code(row.after, row.englishName ?? '', englishTitle);
  return commitSiteCode({ siteId, baseRevision: 1, englishCode: candidate, author: 'assistant', summary: '英文版', request: '生成英文版' });
}

for (const row of cases) test(`英文型号保真：${row.name}`, async () => {
  const result = await submitCase(row);
  if (row.expected === 'pass') {
    assert.equal(result.status, 'applied', `${row.name}: ${result.status === 'rejected' ? result.checks.issues.join('；') : result.status}`);
  } else {
    assert.equal(result.status, 'rejected', `${row.name} 不应保存英文版本`);
    if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /保真|公司名/);
  }
});
