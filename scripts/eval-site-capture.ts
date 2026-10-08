import assert from 'node:assert/strict';
import type { codeCheckBrowser } from '../lib/code-site-browser.ts';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function captureEvalPage(browser: Awaited<ReturnType<typeof codeCheckBrowser>>, url: string, width: number, company?: string, full = true) {
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  const navigation = await browser.send<{ errorText?: string; loaderId?: string }>('Page.navigate', { url });
  if (navigation.errorText) throw new Error(`页面导航失败：${navigation.errorText}`);
  const deadline = Date.now() + 25000;
  let ready = false;
  while (Date.now() < deadline) {
    const frame = await browser.send<{ frameTree: { frame: { loaderId: string } } }>('Page.getFrameTree');
    ready = (!navigation.loaderId || frame.frameTree.frame.loaderId === navigation.loaderId) && await browser.evaluate<boolean>(`location.href !== 'about:blank' && document.readyState === 'complete' && document.body.innerText.trim().length > 30`);
    if (ready) break; await pause(200);
  }
  assert.ok(ready, `页面未载入或为空：${url}`);
  await browser.evaluate('document.fonts.ready');
  if (full) {
    // Preview CSP forbids page timer callbacks. Keep waiting in the capture
    // process, while preserving the original 30-second scroll budget.
    const scrollDeadline = Date.now() + 30000;
    for (let y = 0; y < await browser.evaluate<number>('document.documentElement.scrollHeight'); y += 800) {
      assert.ok(Date.now() < scrollDeadline, '整页滚动检查超时');
      await browser.evaluate(`scrollTo(0,${y})`);
      await pause(80);
    }
    await browser.evaluate('scrollTo(0,0)');
  }
  const observed: { text: string; images: number; failedImages: number } = await browser.evaluate(`({text:document.body.innerText,images:document.images.length,failedImages:[...document.images].filter(i=>i.currentSrc&&(!i.complete||!i.naturalWidth)).length})`);
  if (company) assert.ok(observed.text.includes(company), '截图必须显示对应公司');
  assert.equal(observed.failedImages, 0, `截图含未加载图片：${url}`);
  assert.doesNotMatch(observed.text, /This site can.t be reached|ERR_[A-Z_]+|Access Denied|Just a moment|Checking your browser/i, '不能把错误或验证页当官网');
  await pause(800);
  // A control site's intro can start after document load. Check immediately
  // before the snapshot, within the same original load deadline.
  const moving = () => browser.evaluate<boolean>(`document.getAnimations().some(animation => {
    const effect=animation.effect, target=effect?.target, rect=target?.getBoundingClientRect?.();
    return (animation.playState==='running'||animation.playState==='pending') && Number.isFinite(effect?.getComputedTiming().endTime)
      && rect && rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth;
  })`);
  while (await moving()) {
    assert.ok(Date.now() < deadline, '页面入场或转场未结束，本次未保存截图');
    await pause(200);
  }
  const metrics = await browser.send<{ cssContentSize: { width: number; height: number } }>('Page.getLayoutMetrics');
  assert.ok(metrics.cssContentSize.height > 100, '不能截空页面');
  // Beyond-viewport capture can restart media-query animations. Fold captures
  // must use the existing viewport; full-page captures need the extended area.
  const image = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full,
    clip: { x: 0, y: 0, width, height: full ? metrics.cssContentSize.height : 1000, scale: 1 } });
  return image.data;
}
