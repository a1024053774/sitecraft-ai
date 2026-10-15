import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';

const legacyPlaceholder: SiteCode = {
  header: '',
  footer: '',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}',
  pages: [{
    id: 'home',
    title: '旧版本',
    html: '<main><h1>旧版本</h1><div data-system-inquiry="">欢迎来电询价</div></main>',
  }],
};

test('旧 data-system-inquiry 占位按普通 div 预览，不生成表单或提交地址', () => {
  const html = renderSiteCode('t170-legacy', legacyPlaceholder, 'home');
  assert.match(html, /<div data-system-inquiry="">欢迎来电询价<\/div>/);
  assert.doesNotMatch(html, /<form\b|\/api\/public\/|sc-inquiry|发送询盘|Send inquiry/);
  assert.match(html, /form-action 'none'/);
});

test('旧导入表单按禁止元素清理并记录拒因', async () => {
  const result = await checkSiteCode({
    siteId: 't170-legacy-form',
    materials: '旧版本资料。欢迎来电询价。',
    images: [],
    legacyImport: true,
    code: {
      ...legacyPlaceholder,
      pages: [{ ...legacyPlaceholder.pages[0], html: '<main><h1>旧版本</h1><form data-sitecraft-inquiry><input name="message"></form></main>' }],
    },
  });
  assert.equal(result.checks.passed, false);
  assert.match(result.checks.issues.join('\n'), /已去掉禁止元素 form/);
  assert.doesNotMatch(result.code.pages[0].html, /<form\b|data-system-inquiry/);
});
