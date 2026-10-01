import type { BlockFragment } from "./types.ts";

// Inquiry: its own tinted band, contact lines once, a short form.
export const contactFragment: BlockFragment = {
  css: `
.sitecraft-inquiry { background: var(--site-tint); }
.sitecraft-inquiry-wrap { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 56px; align-items: start; }
.sitecraft-inquiry-copy > p { margin: 14px 0 0; color: var(--site-muted); line-height: 1.6; }
.sitecraft-inquiry-lines { margin: 24px 0 0; padding: 0; list-style: none; border-top: var(--site-rule); }
.sitecraft-inquiry-lines li { display: flex; gap: 16px; padding: 12px 0; border-bottom: var(--site-rule); }
.sitecraft-inquiry-lines li > span:first-child { min-width: 3em; color: var(--site-muted); }
/* A contact value wraps where the bridge lets it (an email only at the @); a part wider than the line still breaks. */
.sitecraft-inquiry-lines li > span:last-child { overflow-wrap: anywhere; }
.sitecraft-inquiry-form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 28px; background: var(--site-surface); border: var(--site-rule); border-radius: var(--site-panel-radius); }
.sitecraft-inquiry-form label { display: grid; gap: 6px; font-size: 13px; color: var(--site-muted); }
.sitecraft-inquiry-form label[data-sitecraft-inquiry-label="email"], .sitecraft-inquiry-form label[data-sitecraft-inquiry-label="message"] { grid-column: 1 / -1; }
.sitecraft-inquiry-form input, .sitecraft-inquiry-form textarea { width: 100%; padding: 11px 12px; border: 1px solid var(--site-line); background: var(--site-bg); color: var(--site-ink); font-size: 15px; }
.sitecraft-inquiry-form input:focus, .sitecraft-inquiry-form textarea:focus { outline: 2px solid var(--site-accent); outline-offset: 1px; }
.sitecraft-inquiry-form textarea { min-height: 120px; resize: vertical; }
.sitecraft-inquiry-form button, .sitecraft-inquiry-status { grid-column: 1 / -1; }
.sitecraft-inquiry-form button { justify-self: start; }
.sitecraft-inquiry-status { margin: 0; padding: 10px 12px; border-left: 3px solid currentColor; font-size: 14px; line-height: 1.5; }
[data-sitecraft-inquiry-state="sent"] .sitecraft-inquiry-status { color: #1f6f43; background: rgba(31, 111, 67, 0.08); }
[data-sitecraft-inquiry-state="error"] .sitecraft-inquiry-status { color: #9a3412; background: rgba(154, 52, 18, 0.08); }
[data-sitecraft-inquiry-state="sending"] [type="submit"] { opacity: 0.6; cursor: progress; }
/* When every contact line is a gap, drop the empty list. */
.sitecraft-inquiry-lines:not(:has(> li:not([hidden]))) { display: none; }
/* 联系条: heading and note on one line, the contact details in a dark strip (only the ones that have
   a value), the form across the full width below. */
.sitecraft-band { display: grid; gap: 30px; }
.sitecraft-band-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 16px 56px; align-items: end; }
.sitecraft-band-head > p { margin: 0; max-width: 40em; color: var(--site-muted); line-height: 1.6; }
.sitecraft-band-lines { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1px; background: rgba(255, 255, 255, 0.16); border-top: 3px solid var(--site-accent); }
.sitecraft-band-line { min-width: 0; padding: 20px 24px 22px; background: var(--site-ink); color: #fff; }
.sitecraft-band-line dt { font-size: 12px; color: rgba(255, 255, 255, 0.66); }
.sitecraft-band-line dd { margin: 6px 0 0; font-size: 19px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
.sitecraft-band-lines:not(:has(> .sitecraft-band-line:not([hidden]))) { display: none; }
.sitecraft-band-form { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sitecraft-band-form label[data-sitecraft-inquiry-label="email"] { grid-column: auto; }
`,
  narrow: `
.sitecraft-band-head { grid-template-columns: 1fr; }
.sitecraft-band-form { grid-template-columns: 1fr 1fr; }
.sitecraft-band-form label[data-sitecraft-inquiry-label="email"] { grid-column: 1 / -1; }
`,
  phone: `
.sitecraft-inquiry-wrap { grid-template-columns: 1fr; gap: 36px; }
.sitecraft-inquiry-form { grid-template-columns: 1fr; padding: 20px; }
.sitecraft-band { gap: 24px; }
.sitecraft-band-line { padding: 16px 18px 18px; }
.sitecraft-band-line dd { font-size: 17px; }
.sitecraft-band-form { grid-template-columns: 1fr; }
`,
  variants: {
    split: `<section id="inquiry" class="sitecraft-section sitecraft-inquiry" data-sitecraft-section="contact" data-sc-block="contact" data-sc-variant="split">
          <div class="sitecraft-container sitecraft-inquiry-wrap">
            <div class="sitecraft-inquiry-copy" data-sc-part="copy">
              <h2 data-sitecraft-benchmark="contact-title" data-sc-part="title">询盘</h2>
              <p data-sitecraft-benchmark="contact-body" hidden></p>
              <ul class="sitecraft-inquiry-lines" data-sc-part="lines">
                <li data-sitecraft-line><span data-sitecraft-ui="emailPrefix">邮箱</span><span data-sitecraft-contact="email"></span></li>
                <li data-sitecraft-line><span data-sitecraft-ui="phonePrefix">电话</span><span data-sitecraft-contact="phone"></span></li>
              </ul>
            </div>
            <form class="sitecraft-inquiry-form" data-sitecraft-inquiry="true" action="#" method="post" data-sc-part="form">
              <label data-sitecraft-inquiry-label="name">姓名<input name="name" type="text" required maxlength="80" autocomplete="name"></label>
              <label data-sitecraft-inquiry-label="company">公司<input name="company" type="text" maxlength="120" autocomplete="organization"></label>
              <label data-sitecraft-inquiry-label="email">邮箱<input name="email" type="email" required maxlength="160" autocomplete="email"></label>
              <label data-sitecraft-inquiry-label="message">需求<textarea name="message" required maxlength="4000" rows="5"></textarea></label>
              <input class="honeypot" name="honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;height:0;width:0;overflow:hidden">
              <button class="sitecraft-btn sitecraft-primary" type="submit" data-sitecraft-ui="submit">发送询盘</button>
            </form>
          </div>
        </section>`,
    band: `<section id="inquiry" class="sitecraft-section sitecraft-inquiry" data-sitecraft-section="contact" data-sc-block="contact" data-sc-variant="band">
          <div class="sitecraft-container sitecraft-band">
            <div class="sitecraft-band-head" data-sc-part="copy">
              <h2 data-sitecraft-benchmark="contact-title" data-sc-part="title">询盘</h2>
              <p data-sitecraft-benchmark="contact-body" hidden></p>
            </div>
            <dl class="sitecraft-band-lines" data-sc-part="lines">
              <div class="sitecraft-band-line" data-sitecraft-line><dt data-sitecraft-ui="emailPrefix">邮箱</dt><dd data-sitecraft-contact="email"></dd></div>
              <div class="sitecraft-band-line" data-sitecraft-line><dt data-sitecraft-ui="phonePrefix">电话</dt><dd data-sitecraft-contact="phone"></dd></div>
              <div class="sitecraft-band-line" data-sitecraft-line><dt data-sitecraft-ui="addressPrefix">地址</dt><dd data-sitecraft-contact="address"></dd></div>
            </dl>
            <form class="sitecraft-inquiry-form sitecraft-band-form" data-sitecraft-inquiry="true" action="#" method="post" data-sc-part="form">
              <label data-sitecraft-inquiry-label="name">姓名<input name="name" type="text" required maxlength="80" autocomplete="name"></label>
              <label data-sitecraft-inquiry-label="company">公司<input name="company" type="text" maxlength="120" autocomplete="organization"></label>
              <label data-sitecraft-inquiry-label="email">邮箱<input name="email" type="email" required maxlength="160" autocomplete="email"></label>
              <label data-sitecraft-inquiry-label="message">需求<textarea name="message" required maxlength="4000" rows="5"></textarea></label>
              <input class="honeypot" name="honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;height:0;width:0;overflow:hidden">
              <button class="sitecraft-btn sitecraft-primary" type="submit" data-sitecraft-ui="submit">发送询盘</button>
            </form>
          </div>
        </section>`,
  },
};

export const footerFragment: BlockFragment = {
  css: `
.sitecraft-footer { padding: 56px 0 36px; background: var(--site-footer-bg); color: var(--site-footer-ink); font-size: 14px; border-top: var(--site-footer-top); }
.sitecraft-footer-inner { display: grid; grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr)); gap: 32px; }
.sitecraft-footer-label, .sitecraft-footer-brand { display: block; margin-bottom: 14px; color: var(--site-footer-head); font-size: 15px; font-weight: 650; }
.sitecraft-footer-links { display: grid; gap: 8px; }
.sitecraft-footer-links a:hover { color: #fff; }
.sitecraft-footer-contact { display: grid; gap: 8px; overflow-wrap: anywhere; }
/* When every contact line is a gap, drop the footer contact column. */
.sitecraft-footer-inner > div:has(.sitecraft-footer-contact):not(:has([data-sitecraft-line]:not([hidden]))) { display: none; }
`,
  phone: `
.sitecraft-footer-inner { grid-template-columns: 1fr 1fr; }
.sitecraft-footer-about { grid-column: 1 / -1; }
`,
  variants: {
    columns: `<footer class="sitecraft-footer" data-sitecraft-section="footer" data-sc-block="footer" data-sc-variant="columns">
        <div class="sitecraft-container sitecraft-footer-inner" data-sc-part="columns">
          <div class="sitecraft-footer-about" data-sc-part="about">
            <span class="sitecraft-footer-brand" data-sitecraft-brand="footer">企业名称</span>
          </div>
          <div>
            <span class="sitecraft-footer-label" data-sitecraft-ui="footerProducts">产品</span>
            <div class="sitecraft-footer-links" data-sitecraft-footer-products></div>
          </div>
          <div>
            <span class="sitecraft-footer-label" data-sitecraft-ui="footerNav">导航</span>
            <div class="sitecraft-footer-links">
              <a href="#industries" data-sitecraft-ui="industries">应用行业</a>
              <a href="#capabilities" data-sitecraft-ui="capabilities">加工能力</a>
              <a href="#process" data-sitecraft-ui="services">合作方式</a>
              <a href="#certifications" data-sitecraft-ui="certifications">认证</a>
              <a href="#inquiry" data-sitecraft-ui="contact">询盘</a>
            </div>
          </div>
          <div>
            <span class="sitecraft-footer-label" data-sitecraft-ui="footerContact">联系</span>
            <div class="sitecraft-footer-contact">
              <span data-sitecraft-line><span data-sitecraft-ui="emailPrefix">邮箱</span>：<span data-sitecraft-contact="footer-email"></span></span>
              <span data-sitecraft-line><span data-sitecraft-ui="phonePrefix">电话</span>：<span data-sitecraft-contact="footer-phone"></span></span>
            </div>
          </div>
        </div>
      </footer>`,
  },
};
