import type { SiteCode } from '../../lib/code-site.ts';

// Acceptance data: repeated copy, a nested target, two long pages and a bottom link.
export const inlineSite: SiteCode = {
  header: '<header><nav><a href="/home">首页</a> <a href="/products">产品</a></nav></header>',
  footer: '<footer>青禾纸品 · 页脚保留</footer>',
  css: 'body{margin:0;background:#fff;color:#222;font:16px/1.8 sans-serif}header,footer,main{padding:24px}main{max-width:840px;margin:auto}section,article{padding:24px 0;border-top:1px solid #999}h1,h2,h3{line-height:1.4}p{max-width:38em}a{color:#673c20}.spacer{min-height:900px}',
  pages: [
    { id: 'home', title: '首页', html: '<main><section><h1>青禾纸品</h1><p>纸箱与纸袋，按用途说明规格。</p></section><section class="spacer"><h2>相同标题</h2><p>相同说明</p></section><div><section><h2>相同标题</h2><article><h3>深层纸袋区块</h3><p title="纸袋位置">相同说明</p><a href="/products">底部产品链接</a></article></section></div></main>' },
    { id: 'products', title: '产品', html: '<main><section><h1>纸品目录</h1><p>纸箱与纸袋</p></section><section class="spacer"><h2>相同标题</h2><p>相同说明</p></section><section><h2>纸袋用途</h2><p>按用途说明规格。</p><a href="/home">底部首页链接</a></section></main>' },
  ],
};
export const inlineMaterials = '公司名：青禾纸品\n生产纸箱与纸袋，按用途说明规格。';
