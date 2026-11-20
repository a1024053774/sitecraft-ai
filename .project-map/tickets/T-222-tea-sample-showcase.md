---
id: T-222
title: 岚坞茶叶样品上线：产品页、README 与 VPS
type: build
status: closed
blocked_by: []
claimed_by: Devin
supersedes:
---

## What to build

2026-11-20 负责人要求：把当天用 OpenAI 模型生成的「岚坞茶叶专业合作社」站点作为案例放到 GitHub 和产品页，并更新 VPS 上的产品页。

- 样品是系统导出的站点包，原样放进 `landing/samples/tea/`。公开前把含人物侧脸的采茶照片换成无人物的图（负责人当天决定）。
- 产品页样品区加入这一份，展示首页和「茶园与合作社」页两张截图；README 的样品表同步。
- 产品页和演示结尾关于模型接口的说明改成现状。
- 按 `deploy/vps/README.md` 部署到 VPS，并在公网核对。

## Acceptance

- [x] 样品来自站点 `a2acadb0` 当前版本的真实导出；包里没有人物面部，四张图的署名与许可写在 `LICENSES.txt` 和样品页脚
- [x] 产品页和样品页在 1440、768、375 无横向溢出，图片全部载入，本地链接全部有效，截图看过
- [x] README 展示新样品，并写明截图里第三方照片的来源与许可
- [x] 推送到 origin 的 `main` 与 `family-kit-assembly`，远端 SHA 核对一致
- [x] VPS 按 `install.sh` 部署，冒烟检查通过；公网的产品页、样品页和演示核对过

## Resolution

2026-11-20，负责人 Mac，主线 c5c09cdd 之上。

**样品从哪里来**

- 站点 `a2acadb0-af22-4fee-8eec-9c8b6148ee7c`，`gpt-6.2-sol` 经 OpenAI Responses 格式，风格「帮我选」选了邻里日常，版式 5、信息 6。先在「图片」面板登记 4 张配图，再发资料、确认大纲、生成第 1 版（没有修正轮）。调用与用量见 [T-221](T-221-provider-formats.md) 的主线实跑表。
- 第 2 版：在「图片」面板登记一张无人物的茶树照片，对「茶园参观」区块发一条批注，把采茶照片换掉。首页、「茶叶与批发」页、页头页脚与第 1 版逐字相同；「茶园与合作社」页只有这一个区块变了。
- 导出：`GET /api/sites/<id>/export`，2,828,081 字节，解压为 `landing/samples/tea/` 的 9 个文件（2.7M），没有改动任何内容。`landing/` 合计 7.4M。
- 已知瑕疵随样品原样保留：「加工与批次标签」区块本应有底色，保存的 CSS 里背景值是空的（T-223 第 6 条）。

**包里的四张图**（Wikimedia Commons，CC BY-SA 4.0，完整画面缩到长边 1600、JPEG 88，未裁切）

| 用在 | 原文件 | 作者 | 页面修订号 |
| --- | --- | --- | --- |
| 茶园与合作社页首 | Songyang tea field.jpg | Lishuilynn | 705102376 |
| 加工与批次标签 | Hangzhou-Teeplantage-24-Trockengefaesss Haende-2012-gje.jpg（只有双手，没有面部） | Gerd Eichmann | 1289560780 |
| 茶叶与批发 | Hangzhou-Teeplantage-36-Teeglas-2012-gje.jpg | Gerd Eichmann | 1291761835 |
| 茶园参观 | Hangzhou-Teeplantage-04-Straeucher-2012-gje.jpg | Gerd Eichmann | 901922153 |

许可按 Commons 接口的 `extmetadata` 和文件页核对，原始回复、页面状态和原图内嵌权利字段在 `artifacts/t221/followup-2026-11-20/images/source/`。原图没有内嵌作者或版权字段，许可依据是 Commons 页面。图注都写明是配图、不是本社实拍。

**页面改动**

- `landing/index.html`：样品区标题改为「六种样子」；新增一份占整行的样品，放两张 1440×900 截图（`landing/images/tea-desktop.jpg`、`tea-garden-desktop.jpg`，由导出的静态文件在本地截得）；模型接口说明改为四种接口格式及各自的验证情况；页脚补茶园照片的署名与许可。
- `demo/index.html`：结尾「在本地运行」里的模型接口说明同步。
- `README.md`：样品表加一行，补截图里两张第三方照片的来源与许可。

**检查**（证据在 `artifacts/t222/`）

- `verify-landing.ts`：本地静态服务模拟 nginx。产品页和样品三页共 12 个页面×宽度组合，横向溢出 0，载入失败的图片 0；20 个 HTML 文件里 215 个本地 href／src 全部对得上文件；从产品页点进样品再走完导航，样式和图片正常；服务日志没有 404。
- 样品区、模型接口说明和页脚在 1440、768、375 的近景截图逐张看过；两张新截图和样品三页在 375 的整页也看过。
- 仓库里的演示在本地打开，产品页用到的 `#1`、`#2`、`#3`、`#9`、`#14`、`#16`、`#17`、`#19` 都落在对应步骤。

**推送与部署**

- 推送：origin 的 `main` 与 `family-kit-assembly` 都是 103be41f（`git ls-remote` 核对）。之后的提交只改 `.project-map/`，`landing/`、`demo/`、`deploy/` 与 103be41f 相同。
- 部署（2026-11-20 11:58Z）：`ssh root@107.173.155.71`，在 VPS 上全新浅克隆 `family-kit-assembly`（103be41f）后运行 `deploy/vps/install.sh`，退出码 0。冒烟检查：产品页 200、演示 200、演示步骤表 200、演示站点包 200、建站接口 404、未登记主机名被断开（000，curl 退出码 52）。部署前后 nginx、cloudflared、x-ui 都在运行，sitecraft-app 保持停用，监听端口列表前后相同；临时克隆已删除。日志在 `artifacts/t222/vps-install.log`、`vps-after.log`。
- 公网核对：产品页（填入演示地址后）、样品 9 个文件、两张新截图、演示首页、步骤表和英文步骤页，共 15 个地址与仓库逐字节相同。在公网上重跑同一份检查：12 个页面×宽度组合横向溢出 0、图片全部载入，从产品页点进样品并走完导航正常；演示的 `#1`、`#2`、`#3`、`#9`、`#14`、`#16`、`#17`、`#19` 落在对应步骤。样品页的邮箱原文没有被改写。
- 这次部署同时带上了 2026-10-25 以来仓库里已有、但没上线的演示更新（英文页、播放器交互）和产品页文案。
- 回滚：上一版（2026-10-21 的部署）在 VPS 的 `/opt/sitecraft/landing.old` 和 `demo.old`，把目录名换回即可；nginx 配置这次没有变化。
