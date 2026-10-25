import { codeCheckBrowser } from '../../lib/code-site-browser.ts';

const browser = await codeCheckBrowser();
try {
  const text = await browser.evaluate(`(() => { document.body.textContent = 'SiteCraft Chrome ready'; return document.body.textContent; })()`);
  if (text !== 'SiteCraft Chrome ready') throw new Error('Chrome 启动自检失败');
  console.log('Chrome CDP 启动自检通过');
} finally { await browser.close(); }
