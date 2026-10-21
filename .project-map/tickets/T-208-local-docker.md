---
id: T-208
title: 负责人本机 Docker 部署：多阶段镜像加 compose 编排 PostgreSQL
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

按 T-206 的决定，在负责人的 Mac 上用 Docker 运行真实建站网站。

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

- [ ] `docker compose up -d --build` 在负责人本机一次成功；镜像分层合理，运行层不含构建依赖
- [ ] 容器内 Chrome 真实启动成功，web 健康检查与 PostgreSQL 健康检查都通过
- [ ] 用模型替身走通主流程：资料、对齐、确认、生成、局部修改、撤销、刷新恢复、下载站点包。1440/768/375 截图看过
- [ ] 真实模型跑一次：一次整站生成，加一次局部修改和撤销，补齐 T-204 未通过的部分。跑之前向构思主控报预计 token，获准后再跑
- [ ] 重启容器后数据仍在；扫描镜像层、容器日志和数据卷，找不到 key

## Resolution
