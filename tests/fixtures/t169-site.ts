import type { SiteCode } from '../../lib/code-site.ts';

export const citationMaterials = '青禾纸品提供普通纸盒。客户：已服务30家客户。认证：取得 ISO 9001 认证。收费：纸盒每件 CNY 12。页面要求：只做一页首页，不加询盘。';
export const citationClaims = [
  { category: '客户与合作方' as const, claim: '已服务30家客户。', quote: '已服务30家客户。' },
  { category: '资质认证' as const, claim: '取得 ISO 9001 认证。', quote: '取得 ISO 9001 认证。' },
  { category: '价格与收费' as const, claim: '纸盒每件 CNY 12。', quote: '纸盒每件 CNY 12。' },
];
export const citationSite: SiteCode = {
  header: '<header>青禾纸品</header>', footer: '<footer>青禾纸品 · 普通纸盒</footer>',
  css: '*{box-sizing:border-box}body{margin:0;color:#172c26;background:#f8f6ee;font:18px/1.65 sans-serif}header,footer,main{max-width:1040px;margin:auto;padding:24px}h1{font-size:40px;line-height:1.2}h2{font-size:24px;line-height:1.4}section{padding:20px 0;border-top:1px solid #53675e}p{max-width:36em;margin:12px 0}footer{font-size:16px}@media(max-width:600px){h1{font-size:30px}}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>普通纸盒，按资料说明</h1><p>青禾纸品提供普通纸盒。</p><section><h2>客户</h2><p>已服务30家客户。</p></section><section><h2>认证</h2><p>取得 ISO 9001 认证。</p></section><section><h2>收费</h2><p>纸盒每件 CNY 12。</p></section></main>' }],
};
