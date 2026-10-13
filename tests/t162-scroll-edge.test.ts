import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { session, output, state } from './helpers/t162-browser.ts';

const opinion = '滚动后继续写首屏意见';
const continuation = '，并保留现有介绍。';
async function observe(s: Awaited<ReturnType<typeof session>>) {
  return s.browser.evaluate<any>(`(()=>{
    const frame=document.querySelector('[data-testid="code-preview"]');
    const controls=[document.querySelector('[data-testid="annotation-composer"]'),
      document.querySelector('#annotation-message'),...document.querySelectorAll('.code-annotation-actions button')];
    return {viewport:{width:innerWidth,height:innerHeight},scroll:frame.contentWindow.scrollY,
      targetBottom:frame.contentDocument.querySelector('main > section').getBoundingClientRect().bottom,
      text:document.querySelector('#annotation-message')?.value,
      controls:controls.map(el=>{const r=el.getBoundingClientRect();return {name:el.tagName,top:r.top,bottom:r.bottom,left:r.left,right:r.right,
        x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,hit:el.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2))}})};
  })()`);
}
function assertOperable(observed: any) {
  assert.equal(observed.controls.length, 4, '须检查面板、输入框和两个操作按钮');
  for (const control of observed.controls) {
    assert.ok(control.top >= 0, `${control.name} 顶部不得离开视口：${control.top}`);
    assert.ok(control.bottom <= observed.viewport.height, `${control.name} 底部不得离开视口`);
    assert.ok(control.left >= 0 && control.right <= observed.viewport.width, `${control.name} 不得横向截断`);
    assert.equal(control.hit, true, `${control.name} 必须能被真实指针命中`);
  }
}

for (const width of [1440, 768, 375]) test(`T-162 ${width}：目标滚出视野后意见面板仍完整可操作`, { timeout: 60000 }, async () => {
  const s = await session(width);
  try {
    await s.pick('main h1', '青禾纸品');
    await s.browser.send('Input.insertText', { text: opinion });
    const before=await observe(s);assert.equal(before.text,opinion);
    await s.shot('edge-before');
    const point=await s.browser.evaluate<{x:number;y:number}>(`(()=>{
      const f=document.querySelector('[data-testid="code-preview"]').getBoundingClientRect(),stage=document.querySelector('.code-preview-stage').getBoundingClientRect();
      return {x:Math.min(f.right,stage.right)-20,y:Math.max(f.top,stage.top)+24};
    })()`);
    assert.equal(await s.browser.evaluate(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('[data-testid="code-preview"]')`),true,'滚轮须实际作用于 iframe');
    await s.browser.send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:700});
    await s.wait(`document.querySelector('[data-testid="code-preview"]').contentDocument.querySelector('main > section').getBoundingClientRect().bottom < 0`);
    await s.browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const after=await observe(s);
    await writeFile(`${output}/edge-${width}.json`,JSON.stringify({width,before,after},null,2));
    await s.shot('edge-after');
    assert.ok(after.scroll > before.scroll, '须发生真实 iframe 滚动');
    assert.ok(after.targetBottom < 0, '目标须完全滚出视野');
    assert.equal(after.text,opinion,'滚动不得丢失原意见');assertOperable(after);
    // Do not scroll the input into view: operate where the panel actually is.
    const {x,y}=after.controls[1];
    await s.browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});
    await s.browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});
    await s.key('End',4);await s.browser.send('Input.insertText',{text:continuation});
    assert.equal((await observe(s)).text,opinion+continuation,'离屏目标仍可继续写意见');
    await s.shot('edge-continued');
    await s.click('[data-testid="annotation-add"]');await s.wait(`document.querySelector('[data-testid="annotation-draft"]')`);
    assert.ok(await s.browser.evaluate<boolean>(`document.querySelector('[data-testid="annotation-draft"]').textContent.includes(${JSON.stringify(opinion+continuation)})`));
    assert.equal((await state(s.id)).codeSite.versions.length,1,'添加只保存草稿，不调用模型或存新版本');
  } finally { await s.browser.close(); }
});
