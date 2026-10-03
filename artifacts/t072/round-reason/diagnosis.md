# T-072 user-facing recommendation reasons

The behavior test was run before the change on `1f29c8f`: it failed because the card reason began with `结构化资料有` and exposed `非空参数` / `产品类别`. The same route test passes after code commit `d936bc20a541a0e3bb05181102f81d896ca7223c`.

The deterministic feature counts and look rules are unchanged. Only the reason formatter changed: it now says `资料中有…` and uses user-facing phrases such as `完整参数`, `应用行业`, `加工能力`, and `认证状态`. It never reads prose or product names.

The workspace card was captured from the existing deterministic fixture with `SITE_STORE=fs` on the dev server at port 3036 using `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`. Screenshots and the visible card text are in `reason-card-1440.png`, `reason-card-768.png`, `reason-card-375.png`, and `workspace-screenshots.json`; all three report `hasCard: true`. No additional DeepSeek request was made because planner output and the schema contract were unchanged.
