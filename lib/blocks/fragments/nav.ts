import type { BlockFragment } from "./types.ts";

export const navFragment: BlockFragment = {
  css: `
.sitecraft-rule { height: 4px; background: var(--site-accent); }
.sitecraft-nav { position: relative; z-index: 5; background: var(--site-surface); border-bottom: var(--site-rule); }
.sitecraft-nav-inner { display: flex; align-items: center; justify-content: space-between; gap: 28px; min-height: 72px; container-type: inline-size; }
.sitecraft-brand { display: flex; align-items: center; gap: 12px; min-width: 0; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
.sitecraft-brand-mark { width: 30px; height: 30px; flex: none; background: var(--site-ink); position: relative; }
.sitecraft-brand-mark::after { content: ""; position: absolute; inset: 0; background: var(--site-accent); clip-path: polygon(100% 0, 100% 100%, 0 100%); }
.sitecraft-brand-name { min-width: 0; line-height: 1.15; white-space: normal; word-break: keep-all; overflow-wrap: normal; text-wrap: balance; }
.sitecraft-nav-inner:has(.sitecraft-brand-name[style*="--sitecraft-brand-chars"]) .sitecraft-brand { flex: 1 1 auto; min-width: 0; container-type: inline-size; }
.sitecraft-brand-name[style*="--sitecraft-brand-chars"] { font-size: max(10px, min(clamp(11px, 3.2vw, 17px), calc(100cqw / var(--sitecraft-brand-chars)))); white-space: normal; word-break: normal; overflow-wrap: anywhere; }
.sitecraft-nav-links { display: flex; align-items: center; gap: 26px; font-size: 14px; color: var(--site-muted); }
.sitecraft-nav-links a:hover { color: var(--site-ink); }
.sitecraft-nav-tools { display: flex; align-items: center; gap: 12px; flex: none; }
.sitecraft-locale-switch { display: inline-flex; border: 1px solid var(--site-line); }
.sitecraft-locale-switch button { border: 0; background: transparent; padding: 7px 10px; font-size: 12px; font-weight: 700; color: var(--site-muted); cursor: pointer; }
.sitecraft-locale-switch button.active { background: var(--site-ink); color: #fff; }
.sitecraft-nav .sitecraft-btn { min-height: 40px; padding: 0 16px; font-size: 14px; }
.sitecraft-menu { display: none; position: relative; }
.sitecraft-menu summary { list-style: none; cursor: pointer; padding: 9px 14px; border: 1px solid var(--site-line); font-size: 14px; font-weight: 600; }
.sitecraft-menu summary::-webkit-details-marker { display: none; }
.sitecraft-menu-panel { position: absolute; right: 0; top: calc(100% + 8px); min-width: 210px; display: grid; background: var(--site-surface); border: 1px solid var(--site-line); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08); }
.sitecraft-menu-panel a { padding: 13px 16px; border-bottom: var(--site-rule); font-size: 15px; }
.sitecraft-menu-panel a:last-child { border-bottom: 0; }
.sitecraft-nav-short .sitecraft-brand-mark { background: transparent; border: 1px solid var(--site-accent); border-radius: var(--site-control-radius); }
.sitecraft-nav-short .sitecraft-brand-mark::after { background: var(--site-accent); opacity: .22; }
.sitecraft-nav-short .sitecraft-nav-links { gap: 22px; }
`,
  narrow: `
.sitecraft-nav-links, .sitecraft-nav .sitecraft-nav-cta { display: none; }
.sitecraft-menu { display: block; }
.sitecraft-brand-name { font-size: clamp(11px, 3.2vw, 17px); }
`,
  variants: {
    bar: `<div data-sc-block="nav" data-sc-variant="bar">
      <div class="sitecraft-rule" aria-hidden="true" data-sc-part="rule"></div>
      <header class="sitecraft-nav" data-sitecraft-section="nav" data-sc-part="bar">
        <div class="sitecraft-container sitecraft-nav-inner">
          <a class="sitecraft-brand" href="#top" aria-label="企业首页" data-sc-part="brand">
            <span class="sitecraft-brand-mark" aria-hidden="true"></span>
            <span class="sitecraft-brand-name" data-sitecraft-brand="nav">企业名称</span>
          </a>
          <nav class="sitecraft-nav-links" aria-label="主导航" data-sc-part="links">
            <a href="#products" data-sitecraft-nav="products">产品</a>
            <a href="#industries" data-sitecraft-ui="industries">应用行业</a>
            <a href="#capabilities" data-sitecraft-ui="capabilities">加工能力</a>
            <a href="#process" data-sitecraft-nav="services">合作方式</a>
            <a href="#certifications" data-sitecraft-ui="certifications">认证</a>
            <a href="#faq" data-sitecraft-ui="faq">常见问题</a>
          </nav>
          <div class="sitecraft-nav-tools" data-sc-part="tools">
            <div class="sitecraft-locale-switch" data-sitecraft-locale-switch hidden>
              <button type="button" data-sitecraft-locale="zh" data-sitecraft-ui="localeZh" aria-pressed="true">中</button>
              <button type="button" data-sitecraft-locale="en" data-sitecraft-ui="localeEn" aria-pressed="false">EN</button>
            </div>
            <a class="sitecraft-btn sitecraft-primary sitecraft-nav-cta" href="#inquiry" data-sitecraft-nav="contact">提交询盘</a>
            <details class="sitecraft-menu">
              <summary data-sitecraft-ui="menu">菜单</summary>
              <nav class="sitecraft-menu-panel" aria-label="菜单">
                <a href="#products" data-sitecraft-ui="products">产品</a>
                <a href="#industries" data-sitecraft-ui="industries">应用行业</a>
                <a href="#capabilities" data-sitecraft-ui="capabilities">加工能力</a>
                <a href="#process" data-sitecraft-ui="services">合作方式</a>
                <a href="#certifications" data-sitecraft-ui="certifications">认证</a>
                <a href="#faq" data-sitecraft-ui="faq">常见问题</a>
                <a href="#inquiry" data-sitecraft-ui="contact">询盘</a>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </div>`,
    short: `<div data-sc-block="nav" data-sc-variant="short">
      <div class="sitecraft-rule" aria-hidden="true" data-sc-part="rule"></div>
      <header class="sitecraft-nav sitecraft-nav-short" data-sitecraft-section="nav" data-sc-part="bar">
        <div class="sitecraft-container sitecraft-nav-inner">
          <a class="sitecraft-brand" href="#top" aria-label="企业首页" data-sc-part="brand">
            <span class="sitecraft-brand-mark" aria-hidden="true"></span>
            <span class="sitecraft-brand-name" data-sitecraft-brand="nav">企业名称</span>
          </a>
          <nav class="sitecraft-nav-links" aria-label="主导航" data-sc-part="links">
            <a href="#products" data-sitecraft-nav="products">产品</a>
          </nav>
          <div class="sitecraft-nav-tools" data-sc-part="tools">
            <div class="sitecraft-locale-switch" data-sitecraft-locale-switch hidden>
              <button type="button" data-sitecraft-locale="zh" data-sitecraft-ui="localeZh" aria-pressed="true">中</button>
              <button type="button" data-sitecraft-locale="en" data-sitecraft-ui="localeEn" aria-pressed="false">EN</button>
            </div>
            <a class="sitecraft-btn sitecraft-primary sitecraft-nav-cta" href="#inquiry" data-sitecraft-nav="contact">提交询盘</a>
            <details class="sitecraft-menu">
              <summary data-sitecraft-ui="menu">菜单</summary>
              <nav class="sitecraft-menu-panel" aria-label="菜单">
                <a href="#products" data-sitecraft-ui="products">产品</a>
                <a href="#industries" data-sitecraft-ui="industries">应用行业</a>
                <a href="#capabilities" data-sitecraft-ui="capabilities">加工能力</a>
                <a href="#process" data-sitecraft-ui="services">合作方式</a>
                <a href="#inquiry" data-sitecraft-ui="contact">询盘</a>
                <a href="#certifications" data-sitecraft-ui="certifications">认证</a>
                <a href="#faq" data-sitecraft-ui="faq">常见问题</a>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </div>`,
  },
};
