import assert from 'node:assert/strict';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import type { codeCheckBrowser } from '../lib/code-site-browser.ts';

export type EnrichmentPage = {
  id: string; text: string; auxiliaryText: string;
  links: string[]; forms: Array<{ system: boolean; inMain: boolean; action: string }>;
  products: Record<string, string>;
};

// These obligations come from the three user inputs, not from generated HTML.
// Normalize typography only; retain labels, object ownership, values and units.
const normalized = (text: string) => text.normalize('NFKC').replace(/\s|[：:，,；;。]/g, '').replace(/[‐‑‒–—−]/g, '-');
function hasCompleteFact(text: string, fact: string) {
  const expected = normalized(fact);
  const literal = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the complete labelled value/range. A model or numeric endpoint
  // cannot be a prefix/suffix of another ASCII token or decimal. Known units
  // remain part of the literal, so 244 N·m and 244N·m are equivalent.
  const before = /^[A-Za-z0-9.]/.test(expected) ? '(?<![A-Za-z0-9.])' : '';
  const after = /[A-Za-z0-9.]$/.test(expected) ? '(?![A-Za-z0-9.])' : '';
  return new RegExp(before + literal + after).test(text);
}
const productFacts = [
  { name: 'R 系列斜齿轮减速机', added: ['型号 R47', '额定输出扭矩 244 N·m', '减速比 3.83–54.00', '输入功率 0.12–4 kW', '用于输送设备'] },
  { name: 'K 系列锥齿轮减速机', added: ['型号 K57', '额定输出扭矩 400 N·m', '减速比 10.43–59.82', '输入功率 0.12–5.5 kW', '用于包装设备'] },
];
const companyFacts = ['澄川传动', '生产工业齿轮减速机'];
const finalFacts = ['2016 年开始生产工业齿轮减速机', '2021 年增加 K 系列锥齿轮减速机',
  '2024 年为华岭输送设备提供 R47 减速机用于输送线驱动', '数量与运行效果待补充', 'chengchuan-sales@luckye.online'];

// Serialized into the same Chrome DOM used by the UI captures and offline replay.
export function readEnrichmentPage(id: string): EnrichmentPage {
  const main = document.querySelector('main');
  if (!main) throw new Error('验收未载入 main');
  const visible = (node: Element) => node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const headingNames = ['R系列斜齿轮减速机', 'K系列锥齿轮减速机'];
  const headings = [...main.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')];
  const productHeadings = headings.filter(h => headingNames.some(name => h.textContent?.replace(/\s/g, '').includes(name)));
  const products: Record<string, string> = {};
  for (const heading of productHeadings) {
    if (!visible(heading)) continue;
    const name = headingNames.find(name => heading.textContent!.replace(/\s/g, '').includes(name))!;
    let scope: HTMLElement = heading;
    for (let parent = heading.parentElement; parent && parent !== main; parent = parent.parentElement) {
      if (productHeadings.filter(h => parent.contains(h)).length !== 1) break;
      scope = parent;
    }
    if (scope !== heading) products[name] = visible(scope) ? scope.innerText : '';
    else {
      const parts = [heading.innerText];
      for (let next = heading.nextElementSibling; next && !/^H[1-6]$/.test(next.tagName); next = next.nextElementSibling) {
        if (visible(next)) parts.push((next as HTMLElement).innerText);
      }
      products[name] = parts.join('\n');
    }
  }
  return { id, text: document.body.innerText,
    // Also inspect hidden copy and accessible labels: an unauthorized action
    // must not escape the contract through CSS, alt, title or aria-label.
    auxiliaryText: (document.body.textContent ?? '') + [...document.body.querySelectorAll('[alt],[title],[aria-label]')]
      .flatMap(n => ['alt', 'title', 'aria-label'].map(a => n.getAttribute(a) ?? '')).join('\n'),
    links: [...document.body.querySelectorAll('a[href]')].map(a => a.getAttribute('href')!),
    forms: [...document.forms].map(form => ({ system: form.matches('form.sc-inquiry'), inMain: main.contains(form), action: form.getAttribute('action') ?? '' })), products };
}

export function assertEnrichmentStep(step: number, pages: EnrichmentPage[]) {
  assert.ok([1, 2, 3].includes(step), '验收只接受三步资料流程');
  assert.deepEqual(pages.map(p => p.id).sort(), step < 3 ? ['home', 'products'] : ['contact', 'home', 'products'], '页面集合不符合本步要求');
  const allText = normalized(pages.map(p => p.text).join('\n'));
  for (const fact of [...companyFacts, ...(step === 3 ? finalFacts : [])]) assert.ok(hasCompleteFact(allText, fact), `第 ${step} 步缺少事实：${fact}`);
  const productPage = pages.find(p => p.id === 'products')!;
  for (const product of productFacts) {
    const scope = normalized(productPage.products[product.name.replace(/\s/g, '')] ?? '');
    for (const fact of [product.name, ...(step > 1 ? product.added : ['待补充'])]) assert.ok(hasCompleteFact(scope, fact), `第 ${step} 步 ${product.name} 缺少事实：${fact}`);
  }
  for (const page of pages) {
    assert.doesNotMatch(page.text + page.auxiliaryText, /报价|询价|样品|响应(?:时效|时间|承诺)|(?:request|get|ask)[\s-]*(?:a[\s-]*)?(?:quote|sample)|\brfq\b/i, `第 ${step} 步 ${page.id} 出现未要求的功能或承诺（含公共页头页脚）`);
    for (const href of page.links) {
      assert.doesNotMatch(href, /(?:^|[\/?#&=_-])(?:quote|quotation|rfq|samples?)(?:$|[\/?#&=_-])/i, `第 ${step} 步 ${page.id} 出现未要求的功能链接`);
      if (/^mailto:/i.test(href)) assert.equal(step === 3 ? href : '', 'mailto:chengchuan-sales@luckye.online', `第 ${step} 步 ${page.id} 邮箱入口未授权`);
      assert.doesNotMatch(href, /^tel:/i, `第 ${step} 步 ${page.id} 电话入口未授权`);
    }
    const emails = (page.text + page.auxiliaryText).match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
    assert.ok(emails.every(email => step === 3 && email === 'chengchuan-sales@luckye.online'), `第 ${step} 步 ${page.id} 出现未提供邮箱`);
    if (step < 3) assert.doesNotMatch(page.text + page.auxiliaryText, /联系|询盘|咨询/, `第 ${step} 步 ${page.id} 提前增加联系功能`);
    if (step < 3 || page.id !== 'contact') assert.equal(page.forms.length, 0, `第 ${step} 步 ${page.id} 出现未授权表单`);
    else {
      assert.equal(page.forms.length, 1, '联系页必须有一个系统询盘表单');
      assert.equal(page.forms[0].system && page.forms[0].inMain, true, '询盘表单必须是联系页正文的系统部件');
      assert.match(page.forms[0].action, /^\/api\/public\/[^/]+\/leads$/, '系统询盘提交目标不正确');
      assert.ok(page.text.includes('chengchuan-sales@luckye.online'), '联系页缺少指定邮箱');
    }
  }
}

// Read-only replay: no server, model call, upload or version commit. Network
// stays blocked while the saved code is rendered for the identical DOM oracle.
export async function observeEnrichmentCode(browser: Awaited<ReturnType<typeof codeCheckBrowser>>, code: SiteCode, width = 1440) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Network.enable'); await browser.send('Network.setBlockedURLs', { urls: ['*'] });
  const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
  const pages: EnrichmentPage[] = [];
  for (const page of code.pages) {
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('acceptance-replay', code, page.id) });
    pages.push(await browser.evaluate<EnrichmentPage>(`(${readEnrichmentPage.toString()})(${JSON.stringify(page.id)})`));
  }
  return pages;
}
