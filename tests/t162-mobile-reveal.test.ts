import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { session, output, state } from './helpers/t162-browser.ts';

const opinion = '请把纸袋区块标题的字距稍微拉开，保留现有说明。';
// This is the trial's actual journey: save a local edit, change page, then locate
// its original-version thread. The generated document is never padded or patched
// by the test to make an obscured target appear visible.
async function locateThread(width: number) {
  const s = await session(width);
  try {
    await s.pick(); await s.browser.send('Input.insertText', { text: opinion }); await s.key('Enter', 4);
    await s.wait(`document.querySelector('[data-testid="annotation-draft"]')`);
    if (width < 1100) await s.click('[role="tab"]:nth-child(1)');
    await s.click('[data-testid="annotation-send"]');
    const done = await s.settle(); assert.equal(done.codeSite.run.status, 'complete');
    assert.equal(done.codeSite.versions.length, 2);
    await s.wait(`!document.querySelector('[data-testid="annotation-draft"]')`);
    if (width < 1100) await s.click('[role="tab"]:nth-child(2)');
    await s.click('[data-page-id="products"]');
    await s.wait(`document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('h1')?.textContent==='纸品目录'`);
    if (width < 1100) await s.click('[role="tab"]:nth-child(1)');
    await s.click('.code-annotation-threads summary'); await s.wait(`document.querySelector('[data-testid="thread-reveal"]')`);
    await s.click('[data-testid="thread-reveal"]');
    await s.wait(`document.querySelector('[data-testid="annotation-composer"]') && document.querySelector('[data-testid="code-preview"]')?.contentDocument?.querySelector('article p')`);
    await s.browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.match(await s.browser.evaluate<string>(`document.querySelector('.code-preview-version').textContent`), /回看 v1/);
    return s;
  } catch (error) { try { await s.shot('mobile-journey-failure'); } finally { await s.browser.close(); } throw error; }
}

// Observe clipping and actual host hit-testing, not just inner-iframe rectangles.
async function observe(s: Awaited<ReturnType<typeof session>>) {
  return s.browser.evaluate<any>(`(()=>{
    const f=document.querySelector('[data-testid="code-preview"]'),fr=f.getBoundingClientRect(),scale=fr.width/f.offsetWidth;
    const stage=document.querySelector('.code-preview-stage').getBoundingClientRect();
    const panel=document.querySelector('[data-testid="annotation-composer"]'),pr=panel?.getBoundingClientRect();
    const outline=document.querySelector('.code-selection-outline');
    const leaves=[...f.contentDocument.querySelector('article').querySelectorAll('h3,p,a')].map(el=>{
      const r=el.getBoundingClientRect(),mapped={left:fr.left+r.left*scale,top:fr.top+r.top*scale,right:fr.left+r.right*scale,bottom:fr.top+r.bottom*scale};
      const center={x:(mapped.left+mapped.right)/2,y:(mapped.top+mapped.bottom)/2};
      const hit=document.elementFromPoint(center.x,center.y);
      return {tag:el.tagName,text:el.textContent,rect:mapped,hostHit:hit===f,
        clipped:mapped.top<Math.max(fr.top,stage.top,0)-1||mapped.bottom>Math.min(fr.bottom,stage.bottom,innerHeight)+1,
        covered:!!pr&&mapped.left<pr.right&&mapped.right>pr.left&&mapped.top<pr.bottom&&mapped.bottom>pr.top};
    });
    return {leaves,outline:!!outline,panelText:panel?.textContent,frameWidth:f.offsetWidth,
      panel:pr?{top:pr.top,bottom:pr.bottom}:null,stage:{top:stage.top,bottom:stage.bottom},scroll:{inner:f.contentWindow.scrollY,outer:document.querySelector('.code-preview-stage').scrollTop}};
  })()`);
}
function assertVisible(observed: any) {
  assert.equal(observed.leaves.length, 3, '须测标题、正文和底部链接');
  for (const leaf of observed.leaves) {
    assert.equal(leaf.covered, false, `${leaf.tag} 不得被意见面板遮挡`);
    assert.equal(leaf.clipped, false, `${leaf.tag} 必须在预览实际可见区域内`);
    assert.equal(leaf.hostHit, true, `${leaf.tag} 的真实指针位置须命中 iframe`);
  }
}

test('T-162 375：跨页线程定位后正文和链接位于意见面板之上', { timeout: 90000 }, async () => {
  const s = await locateThread(375);
  try {
    await s.shot('mobile-located');
    const located = await observe(s); await writeFile(`${output}/mobile-located.json`, JSON.stringify(located,null,2));
    assert.equal(located.frameWidth, 375); assertVisible(located);
    const paragraph=located.leaves.find((leaf:any)=>leaf.tag==='P').rect;
    await s.browser.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:(paragraph.left+paragraph.right)/2,y:(paragraph.top+paragraph.bottom)/2,deltaX:0,deltaY:400});
    await s.browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const scrolled=await observe(s);await writeFile(`${output}/mobile-scrolled.json`,JSON.stringify(scrolled,null,2));
    assertVisible(scrolled); await s.shot('mobile-located-scroll');
  } catch(error) { await s.shot('mobile-visible-failure'); throw error; } finally { await s.browser.close(); }
});

test('T-162 375：收起线程面板保留意见摘要和高亮，展开保持同一目标', { timeout: 90000 }, async () => {
  const s = await locateThread(375);
  try {
    // On the bad revision this is 关闭, which discards the historical highlight.
    await s.click('[data-testid="annotation-composer"] .code-annotation-actions button:first-child');
    const collapsed=await observe(s);await writeFile(`${output}/mobile-collapsed.json`,JSON.stringify(collapsed,null,2));
    assert.equal(collapsed.outline, true, '收起后必须保留目标高亮');
    assert.ok(collapsed.panelText?.includes(opinion), '收起后必须保留原意见摘要');
    assertVisible(collapsed); await s.shot('mobile-collapsed');
    await s.click('[data-testid="annotation-expand"]'); await s.wait(`document.querySelector('.code-thread-comments')`);
    assert.match(await s.browser.evaluate<string>(`document.querySelector('[data-testid="annotation-scope"]').textContent`), /深层纸袋区块/);
    assert.ok((await observe(s)).panelText.includes(opinion));assertVisible(await observe(s));
    assert.equal((await state(s.id)).codeSite.versions.length,2,'面板收起/展开不得调用模型或存版本');
    await s.shot('mobile-expanded');
  } catch(error) { await s.shot('mobile-collapse-failure'); throw error; } finally { await s.browser.close(); }
});

test('T-162 1440/768：线程回看仍显示原版本、目标及意见', { timeout: 120000 }, async () => {
  for(const width of [1440,768]) {
    const s=await locateThread(width);
    try {
      const observed=await observe(s);assert.equal(observed.outline,true);assert.ok(observed.panelText.includes(opinion));
      assert.match(await s.browser.evaluate<string>(`document.querySelector('[data-testid="annotation-scope"]').textContent`),/修改范围：首页 · 深层纸袋区块/);
      if(width===1440) assertVisible(observed);
      await s.shot('mobile-control');
      await writeFile(`${output}/control-${width}.json`,JSON.stringify(observed,null,2));
    } catch(error) { await s.shot('mobile-control-failure');throw error; } finally {await s.browser.close();}
  }
});
