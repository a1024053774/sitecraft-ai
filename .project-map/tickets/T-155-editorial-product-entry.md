---
id: T-155
title: 品牌画册风格把产品入口提前，采购路径一眼可见
type: build
status: open
blocked_by: []
claimed_by: Codex（t155-editorial-entry）
supersedes:
---

## Why

负责人 2026-10-11 排定。T-153 风格区分盲评：品牌画册与现场实拍判为不同方向，但「更像这家公司」选了原版。理由是原版把采购路径摆得直接（先分采购方式，再查规格、准备下单资料）；品牌画册首页要先读交易条件、加工介绍和设备清单才到产品分类，车间图配画册排法也更像通用模板。

## What to build

1. 改 `skills/site-code-editorial/SKILL.md`：保持画册气质（字体、色彩、栏宽节奏），但首页首屏或紧随其后必须让访客看到这家公司卖什么、怎么采购（产品分类或主要业务入口），交易条件、设备与流程放在其后。写成通用原则，不写某家公司的内容，不加例外名单；保持文件短。
2. 仍遵循核心规范：只排已有内容，不新增询盘、报价或联系页（T-141）。
3. 更新 `skills/site-code-editorial/SKILL.md` 末尾的验证说明，写明 T-153 盲评结论与本次调整。

## Acceptance

- [x] 本地替身生成一站，首页 1440/375 截图看过，产品或业务入口在首屏或第一个滚动内
- [ ] 与 T-154 合跑一次真实品牌画册生成（同 T-153 的外高桥流体接头资料），与 T-153 的品牌画册版做成对盲评（新实例，随机命名）：哪版更快看出公司卖什么、怎么采购，哪版更像这家公司
- [x] typecheck、test、build 通过

## Resolution

INCOMPLETE（执行交接，票保持 open）。已移除扉页式引言开场要求，保留字体、配色与栏宽节奏；新增通用的产品／业务入口顺序，采购方式只按资料表达，不增加页面、功能或事实。末尾同步 T-153 盲评结论；mainline 已同步当前规范。

对应提交：本票的单一本地提交 `fix(editorial): surface product and purchasing entry first`，SHA 随执行交接提供。验证基线为 `2bccc24` 加本票改动；以下本地结果均在 SKILL.md 调整后产生（2026-10-11 UTC）。

- 替身端：`SITECRAFT_BASE=http://127.0.0.1:3178 SITECRAFT_FIXTURE_BASE=http://127.0.0.1:41778 node --experimental-strip-types scripts/t153-model-fixture.ts`。开发服务使用本工作树、3178 端口、`SITE_STORE=fs`、本工作树的 `SITECRAFT_DATA_ROOT`；DeepSeek 地址指向该替身，key/model 均为 `local-fixture`，未载入真实密钥。
- 端到端命令：`SITECRAFT_BASE=http://127.0.0.1:3178 SITECRAFT_FIXTURE_BASE=http://127.0.0.1:41778 SITE_STORE=fs CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --experimental-strip-types artifacts/t155/local-smoke.mjs`。05:12:41–05:12:56，PASS；结果在 `artifacts/t155/2026-10-11T05-12-41.191Z/`，含 report、请求和完整版本记录。规范全文进入 plan/write 请求；生成经确认和唯一提交入口存 v1，刷新仍读同版。
- 首页 1440/768/375 的截图均逐张打开看过；产品标题、按图加工方式与产品参数入口均在首屏，入口底边分别为 266/266/244px（视口高 1000px）。提交入口两页 × 三档检查：溢出、重叠、对比度和行长均为 0；375 的点击区质量反馈为首页 3、产品页 2，属于原固定替身的反馈，不是拒收项。
- 替身固定返回已有测试站，facts 固定返回空问题；这些结果只证明规范加载、流程与渲染，不能证明真实模型遵从入口顺序、事实正确或审美改善。本票未新增源码测试；真实行为证据仍由下一项验收取得。
- 已保留两项验收运行错误：`artifacts/t155/2026-10-11T05-12-13.378Z/report.json` 是截图脚本错误地断言原始链接（预览实际改写为版本绑定地址）；`artifacts/t155/test.log` 是全局数据根目录覆盖 T-145 自有临时目录造成的 ENOENT（375/376 通过）。只修验收脚本断言与运行环境，未改业务代码、测试或跳过失败项。
- 本次技术检查全部 PASS（05:12–05:17 UTC）：`npm run typecheck`、`env -u SITECRAFT_DATA_ROOT npm test`（376/376，0 skipped）、`env -u SITECRAFT_DATA_ROOT npm run build`。各命令显式设 `SITECRAFT_BASE=http://127.0.0.1:3178`、`SITE_STORE=fs`、上述 CHROME_PATH，模型环境仅指向本地替身。日志为 `artifacts/t155/typecheck.log`、`test-correct-env.log`、`build.log`；开发服务和替身已停止。
- `project_map.py status --root .`：stale living docs 为 0；现有 T-156 的 `type: decision` 不被脚本识别，未改无关票。

与 T-154 的一次真实合跑已在负责人批准的 120,000 token 上限内完成；两档首页均在首屏展示快换接头、卡套接头及规格入口，完整用量和位置测量见 T-154 Resolution 与 `artifacts/t154/joint-real/report.json`。成对盲评包为 `artifacts/t154/joint-real/review/`，身份映射仅在 private。主控后续：交新实例完成两题成对盲评，再决定全票验收；本票保持 open，不把制包或位置检查当成审美通过。
