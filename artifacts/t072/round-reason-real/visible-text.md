# T-072 real-flow screenshot evidence

Command:

`SITECRAFT_ENV_FILE=/Users/luckye/Documents/Code/sitecraft-ai/.env.local SITE_STORE=fs PORT=3036 CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node artifacts/t072/round-reason-real/capture.mjs`

Captured at `2026-10-03T10:03:58Z`. Runtime code SHA: `d936bc20a541a0e3bb05181102f81d896ca7223c`; server process was started from the worktree at evidence SHA `4e848fcfbd0f1a717d51e29706034b48ef10e704` with the main-workspace env file loaded into the process.

The site was created with `commitOperations` from the simulated export draft: company `外高桥流体接头P3E`, products `快换接头` and `卡套接头`, and their structured parameters. The real chat route `start` returned HTTP 200 and a four-question card.

Visible preview text checked in the screenshots:

`外高桥流体接头P3E｜不锈钢快换接头目录｜面向OEM装配线的接头规格与交期说明｜快换接头 DN8–DN25、2.5 MPa、316L｜卡套接头 6–22 mm、16 MPa、316｜接头产品目录`

- 1440: header shows `AI 已连接`; preview shows the company, hero, parameter strip and two product cards; card options are enabled and the submit button is correctly waiting for a selection.
- 768: header shows `AI 已连接`; the preview shows the same company, hero and products beside the interactive card.
- 375: header shows `AI 已连接`; the bottom drawer shows `第 1 / 4 题`, selectable cards, and an enabled `下一题` button. The preview is behind the conversation drawer; the same preview content was verified at the two desktop widths.

The previous invalid fixture screenshots remain under `artifacts/t072/round-reason/*-invalid-fixture.png`; the first real attempt with a server that lacked model env remains under `artifacts/t072/round-reason-real/*-invalid-server.png`.
