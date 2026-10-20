import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { renderSiteCode } from '../lib/code-site.ts';

// 需求：表题以正常宽度成行，不得单字竖排；保持表头/表尾、列定义和行头关联。
// 失效方式：只转tbody漏caption；thead/tfoot留下匿名表格盒；col宽继续挤压；
// figure本身收缩；隐藏表题/表头或以CSS生成标签丢语义。原样现场是负对照，
// 规范CSS只是提示内可执行写法的证据，不代表真实模型一定遵从它。
const fixture = JSON.parse(await readFile(new URL('./fixtures/t186-molding-products.json', import.meta.url), 'utf8'));
const output = `artifacts/t186/reflow/browser-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const records: unknown[] = [];
test.after(() => writeFile(`${output}/measurements.json`, JSON.stringify({ source: fixture.source,
  versionId: fixture.versionId, records }, null, 2), 'utf8'));

const measure = `(() => {
  const captions = [...document.querySelectorAll('caption, .table-figure > figcaption')].map(el => {
    const lines = new Map(); const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const node=walker.currentNode;
      for(let i=0;i<node.textContent.length;i++) {
        if(!node.textContent[i].trim())continue;
        const range=document.createRange(); range.setStart(node,i); range.setEnd(node,i+1);
        const rect=range.getBoundingClientRect(); if(!rect.width||!rect.height)continue;
        const y=Math.round(rect.top); lines.set(y,(lines.get(y)||0)+1);
      }
    }
    return { text:el.textContent, display:getComputedStyle(el).display,
      width:el.getBoundingClientRect().width, lineCharacters:[...lines.values()] };
  });
  return { captions, overflow:document.documentElement.scrollWidth > innerWidth,
    rowHeaders:[...document.querySelectorAll('tbody th')].map(el=>({scope:el.getAttribute('scope'),
      label:el.textContent, value:el.nextElementSibling?.textContent})),
    headings:[...document.querySelectorAll('thead th, tfoot th, tfoot td')].map(el=>({text:el.textContent,
      display:getComputedStyle(el).display, width:el.getBoundingClientRect().width})),
    columns:[...document.querySelectorAll('colgroup,col')].map(el=>getComputedStyle(el).display) };
})()`;

for (const variant of ['现场', '表头表尾与图注'] as const) test(`${variant}：原样375复现竖排，规范完整重排后三档正常成行`, async () => {
  const browser = await codeCheckBrowser();
  try {
    // 未提供示例的HEAD在同一可见性断言变红；不在测试中另藏一份修复CSS。
    const core = await readFile('skills/site-code-core/SKILL.md', 'utf8');
    const recipe = core.match(/### 字段行 CSS 示例\n[\s\S]*?```css\n([\s\S]*?)\n```/)?.[1] ?? '';
    const html = renderSiteCode('t186-reflow', { header: '', footer: '', css: fixture.css,
      pages: [fixture.page] }, 'products');
    const frame = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', { frameId: frame.frameTree.frame.id, html });
    await browser.evaluate('document.fonts.ready');
    await browser.evaluate(`(() => {
      for(const table of document.querySelectorAll('table')) {
        table.classList.add('field-table');
        if(${JSON.stringify(variant)}==='表头表尾与图注') {
          const columns=document.createElement('colgroup'); columns.innerHTML='<col style="width:40%"><col style="width:60%">';
          table.insertBefore(columns,table.tBodies[0]);
          table.createTHead().innerHTML='<tr><th scope="col">参数</th><th scope="col">数值</th></tr>';
          table.createTFoot().innerHTML='<tr><th scope="row">说明</th><td>按对应项目核对</td></tr>';
          const figure=document.createElement('figure');figure.className='table-figure';figure.style.margin='0';
          table.replaceWith(figure);figure.append(table);
          const caption=document.createElement('figcaption');caption.textContent='规格表阅读说明';figure.append(caption);
        }
      }
    })()`);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false });
    const before = await browser.evaluate<any>(measure); records.push({ variant, stage: '原样', width: 375, ...before });
    if (variant === '现场') assert.equal(before.captions.filter((c: any) => Math.max(...c.lineCharacters) === 1).length, 2,
      '真实现场两个caption均须被独立的每行字数判据识别，不能把空白/隐藏当红证据');
    const rowHeaders = before.rowHeaders;
    await browser.evaluate(`(() => { const style=document.createElement('style');style.textContent=${JSON.stringify(recipe)};document.head.append(style); })()`);
    for (const width of [375, 768, 1440]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      const after = await browser.evaluate<any>(measure); records.push({ variant, stage: '规范示例', width, ...after });
      await writeFile(`${output}/${variant}-${width}.html`, await browser.evaluate<string>('document.documentElement.outerHTML'), 'utf8');
      for (const caption of after.captions) {
        assert.ok(caption.lineCharacters.length > 0, '表题和图注仍可见');
        assert.ok(caption.lineCharacters.reduce((a: number, b: number) => a + b, 0) / caption.lineCharacters.length >= 2,
          `${width} ${caption.text}须正常成行，不能一字一行：${JSON.stringify(caption.lineCharacters)}`);
      }
      assert.equal(after.overflow, false, `${width}不得新增横向溢出`);
      assert.deepEqual(after.rowHeaders, rowHeaders, '行头scope、标签和对应值保持');
      assert.ok(after.rowHeaders.every((h: any) => h.scope === 'row' && h.label && h.value));
      assert.ok(after.headings.every((h: any) => h.display !== 'none' && h.width > 0), '表头表尾内容不可隐藏');
      if(width===375 && variant==='表头表尾与图注') assert.ok(after.columns.every((d: string) => d==='none'), '字段行不保留列宽盒');
    }
  } finally { await browser.close(); }
});
