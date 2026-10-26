---
id: T-208
title: 负责人本机 Docker 部署：多阶段镜像加 compose 编排 PostgreSQL
type: build
status: closed
blocked_by: []
claimed_by: Codex
supersedes:
---

## What to build

按 T-206 的决定，在负责人的 Windows（经 `ssh win-lan`）上用 Docker 运行真实建站网站。

**现状**：仓库已有的 Dockerfile 和 docker-compose.yml 都是旧版，要按当前代码核对并改到能用：

- 运行时设置的是 `SITE_STORE=postgres`，需要核对当前代码实际支持哪些存储模式，以及各项数据实际存在哪里。
- 运行镜像里没有 Chrome，提交检查无法运行。alpine 下的 Chrome 依赖也要核对。
- compose 要求在环境变量里填 DEEPSEEK_API_KEY，与 T-202 的「访客自带接口」规则不一致，需要选定一种做法。
- 镜像里还有不再使用的 redis 和 minio。

**要做**：

- 使用多阶段镜像：依赖层、构建层和运行层分开；运行层带上能真正启动的 chrome-headless-shell，并在镜像构建或容器启动时真实启动一次来验证。
- docker-compose 编排 web 和 PostgreSQL，数据放在命名卷里，并加健康检查。端口不得与负责人本机已有服务冲突，开工前先查端口占用。
- 本机模式下数据存储放哪里、模型 key 怎么提供，需要先写清方案再实施。约束如下：
  - key 只能放在 gitignore 的文件或浏览器设置里，不进镜像、日志或提交；
  - 与 T-202 的浏览器存储模式不冲突；
  - 不新增平行的存储实现。
- 写一份本地运行说明：怎么启动、停止和更新，数据存在哪里，怎么备份。
- AGENTS「本阶段不做」里的 Docker 条目，按 T-206 改为已执行一次的说明。

## Acceptance

- [x] `docker compose up -d --build` 在负责人本机一次成功；镜像分层合理，运行层不含构建依赖
- [x] 容器内 Chrome 真实启动成功，web 健康检查与 PostgreSQL 健康检查都通过
- [x] 用模型替身走通主流程：资料、对齐、确认、生成、局部修改、撤销、刷新恢复、下载站点包。1440/768/375 截图看过
- [x] 真实模型跑一次：一次整站生成，加一次局部修改和撤销，补齐 T-204 未通过的部分。跑之前向构思主控报预计 token，获准后再跑
- [x] 重启容器后数据仍在；扫描镜像层、容器日志和数据卷，找不到 key

## Plan

2026-10-25 负责人明确改为 Windows 部署；代码先在 Mac 修复，最后经 `ssh win-lan` 交付，由 Codex 单人完成。Mac 重启后负责人进一步要求禁止在 Mac 构建，后续构建与浏览器验收全部在 Windows 执行。

REALITY GATE：PASS（平台与存储）；Chrome 沙箱在目标容器实测后才能验收。

- observed：win-lan 为 Windows LUCKYE，Docker Engine 29.2.1，Linux amd64，Compose 5.0.2；16 CPU，约 16GB 容器内存。3100/5432 未监听，现有四个容器保留。
- observed：`lib/conversation-store.ts`、`lib/annotation-store.ts` 支持 postgres；`lib/code-site-store.ts` 的版本、任务、资料及 `lib/site-images.ts` 上传仍是文件。保留现有分工，不把 PostgreSQL 冒充全数据存储，不新增存储实现。
- 数据：`SITE_STORE=postgres`，数据库卷及 `/app/data` 文件卷分别持久化；数据库仅 Compose 内网，web 默认仅绑定 Windows 回环 3100。实际验收通过 SSH 在 Windows 容器内执行，截图回传 Mac 查看。
- key：沿用 T-202，生产只读请求头，不读服务端模型环境变量。负责人本轮明确授权读取 Mac `.env.local` 供真实验收，仅在请求内存中使用；不传该文件进镜像或 Windows 源码包。日常使用仍在浏览器设置填写。
- 镜像：Node 22 Debian slim 的依赖、构建及生产依赖层；运行层只带生产依赖、构建输出、public、运行时 skills 和 Chrome。不新增应用依赖。
- Chrome：Google 官方 chrome-headless-shell Linux 资源；先在目标容器核对默认沙箱可用性，保留 Chrome 沙箱；若需 syscall profile，复用微软公开 Docker profile 并记录来源，不给宿主系统或其他容器改权限。
- Compose：web + PostgreSQL 16，去掉 redis/minio；应用与数据库健康检查，运行用户非 root，init 回收子进程，独立共享内存；启动前真实运行 Chrome，失败退出。
- Chrome 实测：在 Windows 本票临时容器执行真实 CDP 检查；PASS 为能创建浏览器并检查两页，FAIL 为无法启动／超时。失败保留日志，先修配置，不关闭沙箱。
- 健康：生产自带 key 模式不以全局模型 key 作为服务就绪条件，数据库不可用仍返回 503；实际业务通过全流程单独验收。
- Tracer bullet：先让目标容器的 Chrome、健康、两页受控生成—局部修改—撤销完整跑通，再跑一次真实模型并补齐重启与下载。
- 验证：本机相关测试、typecheck；三票最终候选串行跑 runner 回归、全量和 build；Windows 实际 Compose 构建、容器健康、主流程、重启持久化、key 扫描及三档截图。
- 真实模型预算：参照 T-204 纸包装三页 76,297 token，另加局部修改与规划约 10–15k，预计总计 85–95k；只跑一次生成＋一次局部修改＋撤销，不自动重发。翻译已在 T-209 完成，实付 11,973／15,000。
- 文档：补 Windows 启停／更新／备份说明，并按本轮授权更新 AGENTS 部署位置。保留原用户数据和失败证据；最后清理已停用的构建缓存。

### 继续验收：::marker（2026-10-25 负责人已授权）

REALITY GATE：PASS（Windows 原候选成对探测）。目标是保留原生列表语义与现有检查，在 Windows 完成真实生成→局部修改→撤销；不改检查阈值、可测量门禁、修正范围或提交入口，不在 Mac 构建。

- observed：失败候选的 `.paper-block` 为有底色、`border-radius:4px` 的祖先；`backgroundFor` 对 CSS 生成文字遇到非矩形背景明确拒收，修正范围对伪元素也明确拒收。核心与局部生成规范未说明这种可测量绘制边界。
- inferred：修复应落在生成指导，让有原生 marker／计数器文字的背景采用可核实矩形排法，不按样本名加例外、不隐藏圆点、不改检查。
- probe / Codex：在 Windows 通过原生产 `checkSiteCode` 重放原始失败候选及只去掉该背景圆角的对照；原样必须三档拒收，对照必须保留列表、文字和实际 marker 并通过确定性检查。任何其他拒因先保存原结果，不调用真实模型。
- measured：`artifacts/t208-marker/probe-1792975572180/` 三组成对检查通过：原候选三档拒收；只把 `.paper-block` 圆角改为 0 后三页确定性检查通过，原 HTML 与实际圆点均保留；该对照把圆点色改成底色后仍三档拒收。检查器源码未改。此证据只证明可测量排法，不替代后续真实模型验证。
- measured：Windows 以隔离依赖卷运行 typegen、typecheck 及标准入口 T-196/T-199 回归，97/97 通过，包含 marker、分片、遮罩、首行效果和实际叠层；`artifacts/t208-marker/focused.log`。原失败候选及两种对照的 9 张截图全部打开看过。
- measured：修复提交 `2a178b8f` 的 Windows 生产镜像已构建运行；真实站点 `e0c3300e-31e8-4de2-bc41-bb447437209b` 完成三页 v1、预览批注将「三类包装」改为「三类包装说明」v2、撤销 v3、刷新及 ZIP。三版各 9 个视口检查通过，v3 代码直接相等于 v1，事实核对沿用 v1；10 张截图全部打开看过。共 5 次真实调用、138,454 token，高于事前 85–110k 估算，未重发、未调用内容修正；用量与结果见 `artifacts/t208-marker/real-marker-1/`。
- measured：最终全量在 Windows 共享盘测试环境中出现文件事件闸门超时和缺 git 的评估 CLI 失败；保留完整结果并自然跑完。已准备临时验收镜像，在 Windows Docker 原生 Linux 文件系统放源代码和临时根，并提供本候选真实 Git 浅克隆元数据；只修测试环境，不改断言、超时、应用或生产镜像，待原轮结束后复验。
- measured：共享盘首轮实际执行 1221 项、24 项失败，`full-first-report.json` 保留；原生临时根的 T-176 为 10/10，原生源码与临时根加真实 Git 的 T-130/T-171 为 30/30，含原先图片资源 404 的对照。入口回归另要求 `.next-test` 与 artifacts 同文件系统；证据目录单独绑定 Windows 盘会触发 EXDEV，故最终完整候选的源码、临时根与证据均放在同一个临时验收容器，结束后再复制报告。所有失败结果保留，不改测试或超时。
- measured：最终 Windows 原生容器环境入口回归 18/18、全量 1221/1221（148 非浏览器、1073 浏览器）通过；容器重建后真实站点、对话与批注的 API／SQL JSON 与重建前直接相等，服务健康。临时镜像、容器、依赖卷、Git 元数据和停用构建缓存已清理，报告及数据已导出。
- Tracer bullet：上述最小成对检查→核心与局部规范补齐同一约束→Windows 相关测试和构建→一次新的真实三页生成及预览批注、撤销、刷新、下载。真实调用已由本轮请求授权，预计 85–110k token；协议／网络错误仍不重试，正常内容修正仍沿既有最多两轮。最后清理本轮测试依赖卷、镜像和构建缓存，保留服务镜像、数据卷及失败证据。

## Resolution

2026-10-25：**PASS**。Windows 部署、受控与真实生成／预览批注／撤销／刷新／下载、重建持久化、全量及密钥扫描均通过。修复提交 `2a178b8f` 只补核心与局部生成规范的可测量列表绘制指导，检查器、阈值、修正边界和测试断言均未改；Mac 未构建。最初拒收与验收环境失败均保留，未冒称原轮通过。

### 已交付

- Windows `D:\sitecraft-ai`，正式命令 `docker compose up -d --build --force-recreate --wait --wait-timeout 120` 成功，web/PostgreSQL 均 healthy；Windows 宿主 `http://127.0.0.1:3100/api/health` 为 200。已有四个无关容器保留。正式实例未设置 `SITECRAFT_ALLOW_LOCAL_PROVIDER`，替身进程随验收容器替换退出。
- Node 22 Debian 多阶段构建；Next standalone，运行层无 TypeScript 编译器；Google Chrome 156.0.8078.47 在非 root 用户下保留沙箱并通过真实 CDP 自检。默认 Docker 命名空间探测被拒，Microsoft Playwright v1.64.0 原样 syscall profile 实测通过；来源和许可见 `deploy/docker/`。
- 模拟资料「榆溪修缮」经实际生产 chat/after、提交入口和真实 Chrome：三页 v1 → 在预览点选并发送批注将「维修范围」改为「维修范围说明」v2 → 撤销生成 v3；其他页面、页头和页脚不变，v3 代码与 v1 直接比较相等，事实核对沿用。下载 ZIP 含三页、styles.css、LICENSES.txt，无内部资料。10 张生成／修改／撤销和批注截图全部打开看过，三档不是空白或载入态。
- 重建 web 与 PostgreSQL 后，从真实 API 和 SQL 读回的版本、对话和批注，与重建前 JSON 直接比较相等。现有两种存储的职责保持不变。
- key 只从 Mac `.env.local` 在内存读取，经 SSH stdin 进入请求，不拷贝环境文件。扫描最终镜像的 25 个归档项（含 14 个压缩层的解压内容）、日志、数据库逻辑导出及两个数据卷，共读取 882,404,003 字节、1,310 项，无本轮 key；扫描器对压缩层中合成凭据的反例会失败。没有把真实 key 写入扫描器或命令参数。
- 本轮健康检查修复先红后绿：旧实现 2 项失败；新实现 3 项通过，相关健康／检查源／中断恢复共 14 项通过，typecheck 通过。Mac 重启前已完成 runner 18/18、全量 1221/1221（148 非浏览器、1073 浏览器）；随后 Mac build 被重启中断，不计通过。最终 `npm run build` 在 Windows 镜像内实际通过；未在 Mac 重跑构建或全量。
- 清理停用的 `.next`、`.next-test`、本轮专用 `.next-t205`／`.next-t209`／`.next-t209-capture`、传输归档和临时下载工具：Mac 释放 2,133,165,497 字节，Windows 释放 548,218,368 字节。正式镜像、数据卷、原始 `.sitecraft-data`、用户原有 tsconfig 修改及失败证据保留；不做全局 Docker prune。

### 保留的首次真实拒收证据

- 唯一调用使用纸包装三页资料（青禾纸包装），站点 `ebd47576-c3d4-4fbc-bb20-9bff82689d0f`；规划 13,373、写页 49,464，共 **62,837 token**，低于事先说明的 85–95k。调用没有网络错误，也没有重发。
- 候选 sampling 页三档的三个 `::marker` 无法核实实际背景覆盖；现有 `readCodeLayoutRepairs` 对 CSS 生成文字明确拒绝扩大修正范围，故修正轮在再次调用模型前终止。没有放宽对比度检查、扩大到整页重写或保存失败版本。资料、大纲、原回复和失败候选保留。
- 这是现有生成／修正合同下的一次拒收，保留当时的零版本记录；未通过改变检查器放行。负责人随后明确授权解决此问题并再跑真实流程，新一轮结果见下节。单人执行未安排独立审核 agent，不宣称独立审美盲评通过。

### 补齐的真实流程与最终验收

- 新站点 `e0c3300e-31e8-4de2-bc41-bb447437209b`，青禾纸包装P3B，仍使用原三页资料，不加样本例外。真实模型生成 home、products、prototyping-ordering 三页 v1；36 个事实核对段、14 条出处，实际保留原生列表标记与顺序，三页三档均通过。
- 在真实预览点选区块、填写并发送批注，将「三类包装」改成「三类包装说明」存 v2，正文、页头页脚与其他页面保持不变。局部检查三档均实际执行四态探针，两侧各 8 个可交互元素，每档完整读取 66 次、沿用 20.8 秒原预算；没有降为静态比较。撤销存 v3，代码直接相等于 v1，沿用 v1 的事实核对；刷新恢复 v3，ZIP 经独立解析包含三页、styles.css、LICENSES.txt，10 张截图全部打开看过。
- 5 次真实调用分别为 plan 13,275、write 75,255、facts 38,824、local-edit 6,463、local-facts 4,637，总计 **138,454 token**，高于事前 85–110k 估算，主要增加在写页与整站核对推理。没有重发，没有内容修正调用；不是替身或录制回放。
- Windows 镜像构建、typecheck、T-196/T-199 的 97 项回归及最终入口 18 项、全量 1221 项全部通过。最终全量为原生容器内 `test-run-1792978473010-1883`，源码、临时根和证据同文件系统，并读取本候选真实 Git 元数据；此前共享盘环境 24 项失败、单独挂载证据目录的 EXDEV，以及原生环境 10／30 项对照都保留，不改断言或超时。
- 正式 web 与 PostgreSQL 均重新创建后，版本、资料、全部 4 行会话与 3 行批注的真实 API／SQL JSON 与重建前直接相等；Windows `http://localhost:3100` 健康为 200。未启用本地替身开关，运行用户非 root，生产镜像无 TypeScript，其他四个容器保留。
- 最终镜像各层、日志、数据库逻辑导出与两个数据卷及本次真实输出扫描共 888,456,256 字节、1,330 项，无本轮 key；重建后新增日志／核对文件另扫描 504,883 字节、3 项同样无命中。key 未放入源码包、镜像或 Windows 模型环境变量。
- 清理本轮 6 个停止的测试容器、2 个临时验收镜像、1 个测试依赖卷，以及 Windows 停用构建目录、Git 元数据和审计临时包共 585,331,342 文件字节；Mac 仅清理临时 Git 元数据与类型缓存共 37,005,893 字节，未构建。正式服务镜像、两个数据卷、原始资料和所有失败证据保留，没有全局 prune。

本轮完整证据位于 `artifacts/t208-marker/`；真实流程在 `real-marker-1/`，最终全量 `report.json` 与 `native-full2.log`，冷启动直接比较在 `persistence-comparison.json`，扫描在 `key-scan*.json`，清理在 `cache-cleanup-*.json`。Windows 另外保存 `native-full-artifacts.tar` 和 `native-full-data.tar`，用于保留原生容器的完整报告与测试数据，未把源码、依赖或构建目录当作证据复制。

### 本轮证据与复现入口

本地 `artifacts/t208/`：`compose-production.log`、`windows-build-success.log`、`runtime-production.log`、`persistence-before-2.json`／`persistence-after.json`／`persistence-comparison.json`、`key-scan.json`、`fixture-2/`、`real/`、`workflow-check.mjs`、`final-check.mjs`、`scan-key.mjs`；全量报告 `artifacts/t167/test-run-1792949317931-73808/report.json`。Windows 同目录保留相应 artifacts，启停／更新／双卷备份说明见 `deploy/docker/README.md`。

原验收脚本入口为容器内 `node --experimental-strip-types /tmp/t208-workflow.mjs fixture-2` 或 `real`；本次授权的新真实入口为 `node --experimental-strip-types /tmp/t208-marker-workflow.mjs real-marker-1`，接口设置仅从 stdin 传入。脚本原文与命令说明保留在 artifacts，生产容器内的临时脚本已清理。最初 SSH 凭据助手、Registry 网络和缺测试夹具的构建失败，以及第一次替身误带全局 CSS 被正确拒收的记录，均保留，未用后一次成功覆盖。
