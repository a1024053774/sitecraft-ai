---
id: T-208
title: 负责人本机 Docker 部署：多阶段镜像加 compose 编排 PostgreSQL
type: build
status: open
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
- [ ] 真实模型跑一次：一次整站生成，加一次局部修改和撤销，补齐 T-204 未通过的部分。跑之前向构思主控报预计 token，获准后再跑
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

## Resolution

2026-10-25：**INCOMPLETE**。Windows 部署、受控全流程、重建持久化及密钥扫描均通过；唯一真实生成被现有 CSS 生成文字门禁拒收，未存首版，因此真实局部修改与撤销未运行。本票保持 open，不把替身通过当作真实模型通过，不自动重发。

### 已交付

- Windows `D:\sitecraft-ai`，正式命令 `docker compose up -d --build --force-recreate --wait --wait-timeout 120` 成功，web/PostgreSQL 均 healthy；Windows 宿主 `http://127.0.0.1:3100/api/health` 为 200。已有四个无关容器保留。正式实例未设置 `SITECRAFT_ALLOW_LOCAL_PROVIDER`，替身进程随验收容器替换退出。
- Node 22 Debian 多阶段构建；Next standalone，运行层无 TypeScript 编译器；Google Chrome 156.0.8078.47 在非 root 用户下保留沙箱并通过真实 CDP 自检。默认 Docker 命名空间探测被拒，Microsoft Playwright v1.64.0 原样 syscall profile 实测通过；来源和许可见 `deploy/docker/`。
- 模拟资料「榆溪修缮」经实际生产 chat/after、提交入口和真实 Chrome：三页 v1 → 在预览点选并发送批注将「维修范围」改为「维修范围说明」v2 → 撤销生成 v3；其他页面、页头和页脚不变，v3 代码与 v1 直接比较相等，事实核对沿用。下载 ZIP 含三页、styles.css、LICENSES.txt，无内部资料。10 张生成／修改／撤销和批注截图全部打开看过，三档不是空白或载入态。
- 重建 web 与 PostgreSQL 后，从真实 API 和 SQL 读回的版本、对话和批注，与重建前 JSON 直接比较相等。现有两种存储的职责保持不变。
- key 只从 Mac `.env.local` 在内存读取，经 SSH stdin 进入请求，不拷贝环境文件。扫描最终镜像的 25 个归档项（含 14 个压缩层的解压内容）、日志、数据库逻辑导出及两个数据卷，共读取 882,404,003 字节、1,310 项，无本轮 key；扫描器对压缩层中合成凭据的反例会失败。没有把真实 key 写入扫描器或命令参数。
- 本轮健康检查修复先红后绿：旧实现 2 项失败；新实现 3 项通过，相关健康／检查源／中断恢复共 14 项通过，typecheck 通过。Mac 重启前已完成 runner 18/18、全量 1221/1221（148 非浏览器、1073 浏览器）；随后 Mac build 被重启中断，不计通过。最终 `npm run build` 在 Windows 镜像内实际通过；未在 Mac 重跑构建或全量。
- 清理停用的 `.next`、`.next-test`、本轮专用 `.next-t205`／`.next-t209`／`.next-t209-capture`、传输归档和临时下载工具：Mac 释放 2,133,165,497 字节，Windows 释放 548,218,368 字节。正式镜像、数据卷、原始 `.sitecraft-data`、用户原有 tsconfig 修改及失败证据保留；不做全局 Docker prune。

### 真实模型未通过项

- 唯一调用使用纸包装三页资料（青禾纸包装），站点 `ebd47576-c3d4-4fbc-bb20-9bff82689d0f`；规划 13,373、写页 49,464，共 **62,837 token**，低于事先说明的 85–95k。调用没有网络错误，也没有重发。
- 候选 sampling 页三档的三个 `::marker` 无法核实实际背景覆盖；现有 `readCodeLayoutRepairs` 对 CSS 生成文字明确拒绝扩大修正范围，故修正轮在再次调用模型前终止。没有放宽对比度检查、扩大到整页重写或保存失败版本。资料、大纲、原回复和失败候选保留。
- 这是现有生成／修正合同下的一次拒收；Docker 部署修复不会解决该候选。要补齐真实成功证据，需另行确认如何处理这个生成文字修正边界及后续真实调用预算。当前不宣称事实核对、真实局部修改或撤销已通过，也不宣称生成页面审美通过。负责人要求单人执行，本轮未安排独立审核 agent。

### 本轮证据与复现入口

本地 `artifacts/t208/`：`compose-production.log`、`windows-build-success.log`、`runtime-production.log`、`persistence-before-2.json`／`persistence-after.json`／`persistence-comparison.json`、`key-scan.json`、`fixture-2/`、`real/`、`workflow-check.mjs`、`final-check.mjs`、`scan-key.mjs`；全量报告 `artifacts/t167/test-run-1792949317931-73808/report.json`。Windows 同目录保留相应 artifacts，启停／更新／双卷备份说明见 `deploy/docker/README.md`。

验收脚本实际入口为容器内 `node --experimental-strip-types /tmp/t208-workflow.mjs fixture-2` 或 `real`，接口设置仅从 stdin 传入；本次不再次执行 real。正式持久化检查为 `docker compose exec -T web node /tmp/t208-final-check.mjs --production`。最初 SSH 凭据助手、Registry 网络和缺测试夹具的构建失败，以及第一次替身误带全局 CSS 被正确拒收的记录，均保留在 artifacts，未用后一次成功覆盖。
