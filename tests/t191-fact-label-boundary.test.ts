import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { bindCodeFactCitations, pendingCodeFactSegments, readCodeFactSegments, type CodeFactReview, type CodeFactSource } from '../lib/code-site-fact-segments.ts';
import { codeFactAuditInput } from '../lib/code-site-model.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';

// 失败方式：CSS 排列的标签和值粘连；给词内强调凭空插空格；丢失
// dt/dd、单元格或行边界；复制文本与定位分歧；旧整组回执继续复用。
// 期望来自 DOM 的排版语义，字符串常量是网页原文，不以读取器输出生成答案。
const output = `artifacts/t191/label-boundary-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
const baseCss = 'body{margin:0;color:#222;background:#fff;font:18px/1.6 sans-serif}main{padding:24px}';
// T-188 b37d5b6e 的 visit-place 区块原 DOM；保留与边界有关的原 CSS。
const visitPlace = '<section class="section" aria-labelledby="visit-place"><div class="container"><div class="section-head"><h2 id="visit-place">位置与通行</h2><p>服务社区为杭州市拱墅区；门牌地址待补充。</p></div><ul class="notice-list"><li><strong>地址</strong><span>杭州市拱墅区；门牌地址待补充。</span></li><li><strong>入口与无障碍</strong><span>门店入口台阶和无障碍通行条件待补充。</span></li><li><strong>节假日</strong><span>节假日营业安排待补充。</span></li></ul></div></section>';
const noticeCss = '.notice-list li{display:grid;grid-template-columns:minmax(8em,.5fr) minmax(0,1fr);gap:20px;padding:14px 0}.notice-list strong{font-size:15px;line-height:1.6;font-weight:600}.notice-list span{font-size:16px;line-height:1.6}@media(max-width:600px){.notice-list li{grid-template-columns:1fr;gap:4px}}';
const site = (html: string, css = ''): SiteCode => ({ header: '', footer: '', css: baseCss + css,
  pages: [{ id: 'visit', title: '到店须知', html: `<main>${html}</main>` }] });
const addressSite = site(visitPlace, noticeCss);
const widths = [375, 768, 1440];

async function read(code: SiteCode, name: string, width: number, localPath?: number[]) {
  const browser = await codeCheckBrowser();
  try {
    assert.ok(process.env.SITECRAFT_BASE);
    await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
    assert.equal(await browser.evaluate(`document.contentType==='text/html' && !!document.querySelector('meta[name="sitecraft-code-check"][content="v1"]')`), true);
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('t191-fixture', code, 'visit') });
    const segments = await browser.evaluate<ReturnType<typeof readCodeFactSegments>>(`(${readCodeFactSegments.toString()})(${JSON.stringify(code)},'visit',${JSON.stringify(localPath)})`);
    const input = codeFactAuditInput('', segments);
    await writeFile(`${output}/${name}-${width}.json`, JSON.stringify({ code, width, localPath, segments, input }, null, 2), 'utf8');
    return { segments, input };
  } finally { await browser.close(); }
}

for (const width of widths) test(`T-188 原 grid 标签和值在 ${width} 保留边界，整站与局部使用相同文字`, async () => {
  const whole = await read(addressSite, 't188-whole', width);
  const local = await read(addressSite, 't188-local', width, [0]);
  for (const { segments, input } of [whole, local]) {
    const segment = segments.find(segment => segment.text.includes('门店入口台阶'))!;
    assert.ok(segment);
    assert.match(segment.text, /地址\s+杭州市拱墅区；门牌地址待补充。/);
    assert.match(segment.text, /入口与无障碍\s+门店入口台阶和无障碍通行条件待补充。/);
    assert.match(segment.text, /节假日\s+节假日营业安排待补充。/);
    assert.ok(input.segments.some(segment => segment.claimTexts.some(text => text.includes('地址 杭州市拱墅区;门牌地址待补充。'))));
    const label = segment.members!.find(member => member.kind === 'text' && member.before === '地址');
    const value = segment.members!.find(member => member.kind === 'text' && member.before === '杭州市拱墅区；');
    assert.ok(label?.kind === 'text' && value?.kind === 'text');
    assert.equal(label.offset, 0); assert.equal(value.offset, 0);
    assert.equal(label.text, '地址'); assert.equal(value.text, '杭州市拱墅区；门牌地址待补充。');
    assert.deepEqual(label.path, [0, 0, 0, 1, 0, 0, 0]);
    assert.deepEqual(value.path, [0, 0, 0, 1, 0, 1, 0]);
  }
});

test('标签 span 的独立行内盒保留空白，词内强调与源码空白保持原意，出处可回绑', async () => {
  const code = site('<section><h2>菜单</h2><p class="price"><span class="label">单份价格</span><span>３２ 元/份</span></p><p>杭<span>州</span>市</p><p><span>供应</span> <span>午市</span></p></section>', '.label{display:inline-block;margin-right:1em}');
  const { segments, input } = await read(code, 'inline-label', 1440, [0]);
  assert.match(segments[0].text, /单份价格\s+３２ 元\/份/);
  assert.ok(input.segments[0].claimTexts.some(text => text.includes('单份价格 32 元/份')));
  assert.ok(input.segments[0].claimTexts.some(text => text.includes('杭州市') && text.includes('供应 午市')));
  const [citation] = bindCodeFactCitations(segments[0], [{ category: '价格与收费', claim: '单份价格 32 元/份', quote: '单份价格为32元/份。' }]);
  assert.deepEqual(citation.targets, [{ pageId: 'visit', root: 'main', path: [0, 1], text: '单份价格３２ 元/份' }]);
});

test('dl、相邻块、CSS 块与单元格保留分隔，claimTexts 仍不能跨表格行', async () => {
  const code = site('<section><h2>到店</h2><dl><dt>地址</dt><dd>门牌待补充</dd><dt>入口</dt><dd>条件待补充</dd></dl><p>周一休息</p><p>周二营业</p><address>服务社区</address><address>杭州市拱墅区</address><span class="block">午市</span><span class="block">晚市</span><table><tbody><tr><th>单份价格</th><td>32 元/份</td></tr><tr><th>外带包装费</th><td>待补充</td></tr></tbody></table></section>', '.block{display:block}');
  const { segments, input } = await read(code, 'semantic-boundaries', 768, [0]);
  const text = segments[0].text;
  assert.match(text, /地址\s+门牌待补充\s+入口\s+条件待补充/);
  assert.match(text, /周一休息\s+周二营业/);
  assert.match(text, /服务社区\s+杭州市拱墅区/);
  assert.match(text, /午市\s+晚市/);
  assert.match(text, /<TH>单份价格<\/TH>\s+<TD>32 元\/份<\/TD>/);
  const copy = input.segments[0].claimTexts;
  assert.ok(copy.includes('单份价格 32 元/份'));
  assert.ok(copy.includes('外带包装费 待补充'));
  assert.ok(copy.every(text => !(text.includes('32 元/份') && text.includes('外带包装费'))));
});

test('分隔变更使整组重核：未改文字的表格行也不沿用，无关组仍沿用', async () => {
  const legacy: { code: SiteCode; segments: CodeFactReview['segments'] } = JSON.parse(await readFile(new URL('./fixtures/t191-legacy-fact-review.json', import.meta.url), 'utf8'));
  // 旧回执是父版本记录的测试输入，答案来自整组重核合同。另用当前读取器
  // 比较 inline → grid，证明只改变标签边界时，无关组仍可复用。
  const before = await read({ ...legacy.code, css: baseCss }, 'receipt-before', 1440);
  const after = await read(legacy.code, 'receipt-after', 1440);
  const sources: CodeFactSource[] = [{ type: 'materials', messageIndex: 1, text: '服务社区为杭州市拱墅区。入口待补充。按当日供应。' }];
  const materials = sources[0].text;
  const reviews: CodeFactReview[] = [{ format: 4, materials, sourceMaterials: sources, audited: before.segments.length, reused: 0,
    segments: before.segments.map(segment => ({ text: segment.text, group: segment.group, issues: [], noFacts: true, factCategories: [], citations: [] })) }];
  const { pending, reused } = pendingCodeFactSegments(after.segments, materials, reviews, sources);
  assert.ok(pending.some(segment => segment.text.includes('地址') && segment.text.includes('杭州市拱墅区')));
  assert.ok(pending.some(segment => segment.text.includes('<TH>入口</TH>')), '组内未改的表格行也须重核');
  assert.ok(reused.some(segment => segment.text.includes('按当日供应。')), '无关组可继续沿用');
  assert.ok(!reused.some(segment => segment.text.includes('<TH>入口</TH>')));
  const fromLegacy = pendingCodeFactSegments(after.segments, materials, [{ ...reviews[0], segments: legacy.segments }], sources);
  assert.ok(fromLegacy.pending.some(segment => segment.text.includes('地址') && segment.text.includes('杭州市拱墅区')));
  assert.ok(fromLegacy.pending.some(segment => segment.text.includes('<TH>入口</TH>')), '同一 DOM、同一 CSS 的父版本旧回执不能沿用');
  assert.ok(!fromLegacy.reused.some(segment => segment.text.includes('杭州市拱墅区')));
  await writeFile(`${output}/reuse.json`, JSON.stringify({ reviews, pending, reused, fromLegacy }, null, 2), 'utf8');
});
