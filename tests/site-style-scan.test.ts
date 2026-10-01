import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import test from 'node:test';
import { Cdp, openBrowser } from './helpers/workspace-browser.ts';
const source = readFileSync('scripts/visitor-layout-scan.js','utf8').replace('export function','function').replace('export default scanVisitorLayout;','');
const textFitSource = readFileSync('scripts/visitor-text-fit-scan.js','utf8').trim();
test('layout scanning measures painted text: closed details excluded, 3px overlap within/across blocks detected', async () => {
  const browser = await openBrowser();
  const {targetId} = await browser.send('Target.createTarget',{url:'about:blank'}) as {targetId:string};
  const {sessionId} = await browser.send('Target.attachToTarget',{targetId,flatten:true}) as {sessionId:string};
  try {
    await browser.send('Runtime.enable',{},sessionId);
    await browser.send('Page.enable',{},sessionId);
    await browser.send('Page.setDocumentContent',{frameId:(await browser.send('Page.getFrameTree',{},sessionId) as {frameTree:{frame:{id:string}}}).frameTree.frame.id, html:`<html><body style="margin:0"><section data-sc-block="hero"><h1 style="width:65px;margin:0;font:32px/36px sans-serif;overflow-wrap:anywhere">重载减速机</h1></section><section data-sc-block="products"><article data-sitecraft-product="a"><p id="a" style="position:absolute;top:40px;left:10px;margin:0;font:20px/20px monospace">AAAAAAA</p><p id="b" style="position:absolute;top:57px;left:10px;margin:0;font:20px/20px monospace">BBBBBBB</p><details><summary>closed</summary><p id="folded">NOT PAINTED</p></details></article></section><section data-sc-block="contact"><p id="c" style="position:absolute;top:40px;left:30px;margin:0;font:20px/20px monospace">CCCCCC</p></section><section class="sitecraft-catalog-cards"><article class="sitecraft-catalog-card" style="width:180px"><h3>项目</h3><p style="width:48px;font:16px/20px sans-serif">正文列宽不足复现</p></article></section></body></html>`},sessionId);
    const scan = await browser.eval<{textOverlaps:Array<{key:string}>;heroTitleOrphan:boolean}>(`(()=>{${source};return scanVisitorLayout(document)})()`,sessionId);
    const textFit = await browser.eval<Array<{kind:string}>>(`(()=>(${textFitSource})(document.body))()`, sessionId);
    mkdirSync('artifacts/t054/scan-regression',{recursive:true});
    const {writeFileSync}=await import('node:fs'); writeFileSync('artifacts/t054/scan-regression/result.json',JSON.stringify({ layout: scan, textFit },null,2));
    assert.ok(scan.textOverlaps.some(x=>x.key.includes('AAAA')&&x.key.includes('BBBB')), '3px overlap in same product must not be exempt');
    assert.ok(scan.textOverlaps.some(x=>x.key.includes('AAAA')&&x.key.includes('CCCC')), 'cross-block overlap must not be exempt');
    assert.ok(!scan.textOverlaps.some(x=>x.key.includes('NOT PAINTED')), 'closed details are not painted');
    assert.equal(scan.heroTitleOrphan, true, 'the scanner must report the one-character hero-title line');
    assert.ok(textFit.some((item) => item.kind === 'narrow-body'), 'the scanner must report a catalog body with only a few glyphs per line');
  } finally {
    await browser.send('Target.closeTarget',{targetId}).catch(() => {});
    // Browser.close commonly closes Chrome before its CDP response reaches the socket. Send it
    // without registering a pending waiter, then close our socket so the test cannot linger on a
    // 45-second response timer when the suite runs beside other browser tests.
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: 'Browser.close', params: {} })); } catch {}
    browser.ws.close();
  }
});

test('hero title scanning reports known CJK word breaks', () => {
  assert.match(source, /heroTitleWordBreak/, 'the layout scan exposes title word-break evidence');
  assert.match(source, /模具|减速机/, 'the title scan covers the migration reproductions');
});
