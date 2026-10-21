---
id: T-207
title: sitecraftapp 改为预设数据的交互式工作台演示
type: build
status: closed
blocked_by: []
claimed_by: Codex（承接执行主控收尾）
supersedes:
---

## What to build

按 T-206 的决定，sitecraftapp.luckye.online 改为静态的交互式演示，产品页上的工作台按钮进入演示。

**展示范围**：用预设数据尽可能覆盖建站网站的主流程与主要功能：

- 资料或 Prompt
- 需求对齐，包括风格选择和两个滑杆
- 确认页面大纲
- 生成进度
- 三档预览（1440/768/375）
- 点选、圈选批注与局部修改
- 快捷按钮
- 版本列表、撤销与恢复
- 资料出处
- 英文版
- 下载站点包
- 模型接口设置说明

**数据与标注**：

- 预设数据取自真实生成结果，不编造站点内容。
- 页面明确标注「演示，预设数据，不会调用模型」。
- 演示末尾说明如何获取源码，并在本地用自己的模型接口运行。

**运行方式**：

- 纯静态，由 nginx 直接提供，不调用模型，不在服务器上启动 Chrome 或 Node 服务。
- 尽量复用现有工作台的界面和样式，让演示看起来就是真实工作台；不为演示另做一套平行的业务逻辑。
- 「下载站点包」直接提供一个真实站点包的静态文件。

**VPS 侧**：

- 停用 sitecraft-app，只停不删，保留安装目录、AppArmor 配置与 install.sh。
- sitecraftapp 主机名改由 nginx 提供演示静态文件。
- 不改 xray/x-ui，也不动 443。
- 同步更新 deploy/vps/README、仓库 README 中的入口说明，以及产品页文案。

## Acceptance

- [x] 产品页工作台按钮进入演示；演示主流程可逐步点完，每一步都能看到对应功能，且标注为预设数据
- [x] 1440/768/375 截图逐张看过，无横向溢出，无载入态或空白截图
- [x] VPS 上 sitecraft-app 已停用（inactive、disabled），sitecraftapp 由静态文件提供并返回 200；xray 仍在 443；演示访问期间 CPU 与内存无明显占用
- [x] 公网两个域名复查通过

## Resolution


### 交付范围与生成来源

静态演示共 19 步（18 个功能步骤及本地运行说明），沿用禾巷小馆真实生成和两轮真实批注修改的工作台画面；预设状态由 `scripts/t207-build-demo-stages.mjs` 整理，`scripts/t207-capture-demo.mjs` 从无模型 key 的本机工作台截取。运行素材为 `demo/`，真实站点包为 `demo/files/hexiang-xiaoguan-site.zip`，不在 VPS 运行模型、Node 或 Chrome。

重建画面的命令（使用本次保留的资料副本，另起输出目录，未在收尾中重跑）：

```bash
node scripts/t207-build-demo-stages.mjs artifacts/t207/demo-data artifacts/t207/rebuild-stage-data
# 以 SITE_STORE=fs、无模型 key、SITECRAFT_DATA_ROOT 指向上面的目录启动本机 dev 后：
node scripts/t207-capture-demo.mjs "$CHROME_PATH" http://127.0.0.1:3207 artifacts/t207/rebuild-stage-data artifacts/t207/rebuilt-demo
```

英文一步按负责人决定保留「英文版功能说明，示例站翻译未通过保真检查」。2026-10-21 的真实翻译上限 15,000 token，实付 11,595（prompt 7,634、completion 3,961），31 段被拒，未存版本；误报已开 [T-209](T-209-translation-fidelity-false-positives.md)，该票还须区分规则误报与公司名音译等真违规。本次收尾没有调用真实模型，也没有重发翻译。

### 部署与验证命令

2026-10-21（纽约 EDT），工作区文件通过 rsync 直传 VPS，不经 GitHub：

```bash
ssh -o BatchMode=yes root@107.173.155.71 'rm -rf /tmp/sitecraft-deploy && mkdir -p /tmp/sitecraft-deploy'
rsync -a -e 'ssh -o BatchMode=yes' landing demo deploy root@107.173.155.71:/tmp/sitecraft-deploy/
ssh -o BatchMode=yes root@107.173.155.71 'bash /tmp/sitecraft-deploy/deploy/vps/install.sh'
node artifacts/t207/landing-review.mjs "$CHROME_PATH" http://127.0.0.1:3209 artifacts/t207/landing-local-review
node artifacts/t207/landing-review.mjs "$CHROME_PATH" https://sitecraft.luckye.online artifacts/t207/landing-public
xcrun swiftc artifacts/t207/screenshot-text.swift -o artifacts/t207/screenshot-text-cpu
node artifacts/t207/check-old-screenshots.mjs
node artifacts/t207/demo-shots.mjs "$CHROME_PATH" https://sitecraftapp.luckye.online artifacts/t207/shots-public
node artifacts/t207/download-review.mjs "$CHROME_PATH" https://sitecraftapp.luckye.online artifacts/t207/download-after-public
curl -fLsS -o artifacts/t207/hexiang-public.zip https://sitecraftapp.luckye.online/files/hexiang-xiaoguan-site.zip
unzip -t artifacts/t207/hexiang-public.zip
```

`CHROME_PATH` 使用 `/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。下载交互检查的观察器阻止浏览器真正下载，ZIP 另由 curl 读取。

### 已确认结果与失败证据

- 产品页本地三档完整截图在 `artifacts/t207/landing-local-review/`，公网三档在 `artifacts/t207/landing-public/`，均已打开检查；375 实际高度 6218px，运行说明、结尾按钮和页脚完整，三档无横向溢出、图片全部加载。公网三个工作台按钮均指向 `https://sitecraftapp.luckye.online/`。
- 本轮部署日志 `artifacts/t207/logs/deploy-no-transform.log`：产品页、演示首页、步骤表及 ZIP 均为 200，原 `/api/health` 为 404，未知 Host 被直接断开（curl 000）。公网 ZIP 返回 200，4 个条目通过 `unzip -t`。
- VPS 本轮复查见 `artifacts/t207/logs/vps-no-transform-state.log`：2026-10-21 12:00:36 EDT，sitecraft-app 为 inactive/disabled，3100 无监听，443 仍由原 xray pid 828 监听；nginx master/worker 当次采样 CPU 均 0.0%，RSS 约 3.3/5.2 MiB。第二次 top 样本整机 93.5% idle，内存 961 MiB 中已用 386 MiB、可用 575 MiB，swap 已用 88 MiB；这是短时采样，不是长期负载结论。genwatch 已停，`/root/sitecraft-genwatch.log` 保留；原 app/node/chrome、AppArmor 与交换文件均保留，未改 xray/x-ui 或 tunnel。
- 首次安装曾退出 22（演示 502）。日志 `deploy-codex.log` 及 `deploy-failure-investigation.log` 证明请求仍由旧 nginx worker 转发到 3100；安装脚本现等旧 worker 退出再冒烟，15 秒未退出即失败。修正后两次部署均退出 0；不以重试掩盖失败。
- 下载按钮曾被高亮导航抢先拦截并跳到设置步骤，`download-before-local/` 与 `logs/download-before-local.log` 保留失败。调整 ZIP 链接的处理顺序后，同一检查本地及公网均通过，保持下载步骤且未被导航 preventDefault。
- 交接记录说明 `artifacts/t207/shots-local-1` 的最初检查因我方脚本竞态误报而被删除；收尾时同名目录实际存在且日志为 ALL OK，无法据此还原已删除的原轮次，不把该目录当作原失败证据。`shots-local-2` 保留了 4 个字体延迟失败，`shots-local-5` 为交接时已逐张看过的本地通过结果。本次没有删除这些目录。
- 较早的 `shots-public-verified/`、`shots-public-final/` 保留版本列表检查失败；历史预览 `sandbox=""` 不允许父页读 contentDocument，现通过 CDP 在帧自己的隔离上下文检查，不移除 sandbox、不跳过帧。早先 `shots-public-complete/` 及其他旧通过目录不再作为本票截图验收依据。
- 按交接要求未运行真实模型、全量 npm test、typecheck 或 build；静态交付运行 Node 脚本语法检查、bash -n 与 diff 空白检查。

### 本轮返工验收

**PASS，2026-10-21 12:18 EDT（纽约时间）**。按 `artifacts/t207/codex-brief-2.md` 完成两项返工，截图仅以本轮 `artifacts/t207/shots-public/` 的实际结果验收。下述证据相对路径均在 `artifacts/t207/` 下。

执行主控发现原第 9 步 1440 截图预览为白色、第 12 步 375 截图仍为 v2 和待发送批注。根因是外层导航、工作台文档与嵌套预览独立加载，旧检查未核对完整目标身份与实际绘制；截图器还可能在 about:blank 消耗滚动恢复。旧目录完整保留为 `shots-public-race-2/`。修改前列出的失败方式见 `rework-screenshot-failure-modes.md`。

截图器现核对步骤标题、编号、工作台 URL、当前版本、预览文档及帧数；等待实际文档、字体、图片后恢复快照中的滚动位置，截图前后核对 frame id／loader／URL／版本不变，再用截图本身的 OCR 核对步骤、可见版本和暴露预览的正文位置。对话面板或历史弹窗遮挡的主预览如实记为遮挡，只对实际暴露的帧要求绘制正文，不改 demo 内容。两张原坏 PNG 直接送入新校验，分别因“无已绘制预览正文”和“期望 v3、实际 v2”拒绝，见 `old-screenshot-rejections.json` 及 `logs/check-old-screenshots-brief-2-latest.log`。

本轮三档各 19 张，`shots-public/check.log` 与 `logs/shots-public-brief-2-final.log` 均以 `ALL OK 57/57` 自然结束。每张保留截图前后身份、全文 OCR 与步骤计数 OCR；主执行者逐张打开全部 57 张，清单见 `shots-public-manual-review.md`。第 9 步 1440 为 v2 且正文已绘制，第 12 步 375 明确为 v3、无待发送草稿，三档历史弹窗的第 3 版预览有内容。独立验收核对全部 57 组证据并实际抽看 4 张关键图，限定审核为 PASS；它不替代主执行者的逐张查看。第 1—4 步为预设的生成前／生成进度界面，设置与结束说明无站点预览，不把这些状态误记为已生成站点。375 风格／大纲的部分内容在滚动区下方，视口截图不冒充按钮完整可见证据；先前真实滚轮与鼠标点击的可达性补图仍保留在 `acceptance-scroll375/style-375-after.jpg`、`outline-375-after.jpg`，本轮未改 demo，未重跑该交互检查。

返工中错误的 f3 预览预期、模态遮挡判定和计数 OCR 误判各轮保留在 `shots-public-contract-f3-failure/`、`shots-public-history-background-failure/`、`shots-public-counter-ocr-failure/`。计数裁剪单设英文识别触发 Vision 原生错误的轮次保留在 `shots-public-counter-native-failure/`，对应 `logs/shots-public-brief-2-verified.log`；恢复中英识别后，同张计数实际读回成功，最终全量重新完成，未覆盖失败证据。

Cloudflare Email Obfuscation 将原邮箱改写为 `[email protected]` 并注入解码脚本，而 iframe 禁止脚本，访客无法得到原文；此前“还原后与本地一致”的比较不能证明可见结果。本轮只在两个 nginx 主机加 `add_header Cache-Control "no-transform" always;` 并重新部署，不改 demo 或 Cloudflare 后台。`no-transform-before/` 保留 f2 的改写响应；`no-transform-after/` 保存两域实际 HTML、响应头及 `results.json`，f1/f2/f3 均返回 no-transform、原邮箱各出现 1 次、`__cf_email__` 与解码脚本均为 0；产品页也为 no-transform、无两种改写标记（其原文无该示例邮箱）。独立公网 fetch 得到相同结果。

可重复的邮箱检查：

```bash
curl -fsS -D /tmp/t207-f2.headers -o /tmp/t207-f2.html https://sitecraftapp.luckye.online/frames/f2.html
# 以下两项分别应为 0 和 1；grep 计数为 0 时退出 1 是预期。
grep -c __cf_email__ /tmp/t207-f2.html
grep -c hello@hexiang-kitchen.luckye.online /tmp/t207-f2.html
curl -fsS -D /tmp/t207-landing.headers -o /tmp/t207-landing.html https://sitecraft.luckye.online/
grep -cE '__cf_email__|email-decode' /tmp/t207-landing.html
```

Node 两个截取／整理脚本的语法检查和 `bash -n deploy/vps/install.sh` 通过。首次收尾的 `git diff --cached --check` 曾提示捕获 CSSOM 的 `demo/r/ws-1.css`、`ws-2.css` 共 18 处行尾空白；保持原捕获内容，未为消除提示改写快照，其余人工文档与脚本无空白问题。本轮增量 `git diff --check`、截图器语法检查、UTF-8 严格解码及 `bash -n` 均通过。

交付提交：本票、[T-203](T-203-readme-entry.md) 与实现同属 **T-207：发布静态工作台演示并完成公网验收** 这一个提交；可用 `git log -1 --format=%H -- .project-map/tickets/T-207-interactive-demo.md` 取得包含此 Resolution 的提交 SHA。本次只本地提交，不推送；T-208／T-209 仍在 frontier，不在本次范围。
