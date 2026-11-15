---
id: T-215
title: 运行说明与部署配置对齐当前代码
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## What to build

2026-11-14 静态扫描发现，下面这些说明和配置停留在旧方案，和代码对不上：

- `skills/sitecraft-frontend-less-ai-tone/SOURCE.md` 的「运行时」一节写着注入 `lib/frontend-tone.ts`，测试是 `tests/frontend-tone.test.ts`，这两个文件都不存在。实际是 `lib/code-site-model.ts` 加载 `skills/frontend-less-ai-tone/SKILL.md`，这个叠加层自身不会被运行时加载（它的 SKILL.md 写明已并入核心规范）。
- `.env.example`
  - 列出的 `REDIS_URL`、`S3_*`、`DEEPSEEK_MAX_TOKENS`、`NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` 代码里都没有用到。
  - 代码实际读取的 `SITECRAFT_SESSION_IDLE_MS`、`SITECRAFT_SESSION_CAP_BYTES`、`SITECRAFT_QUEUE_WAITING`、`SITECRAFT_BUNDLE_LIMIT_BYTES`、`SITECRAFT_PROVIDER_RESPONSE_LIMIT_BYTES`、`DATABASE_SSL_REJECT_UNAUTHORIZED` 等没有写进去。
  - 默认值是 `SITE_STORE=postgres`，和「开发机用 fs」的规定不一致。另外代码从不识别 `fs` 这个值：生产模式下，只要不是 `browser`，对话和批注就一律走 PostgreSQL。
- `deploy/kubernetes/sitecraft.yaml` 从 2026-09-17 起就没更新过，还在传生产模式按设计不读取的 `DEEPSEEK_API_KEY`。T-206／T-208 已经定为 compose 部署，README 第 123 行也注明它只是早期的多实例示例、不用于当前部署。
- `lib/code-site-styles.ts` 里「邻里日常」缩略图的 `source` 指向 `artifacts/t159/...`，主工作区里已经没有这个目录，来源证据查不到。`public/style-previews/SOURCE.md` 记录的站点和版本编号仍在。
- 用自定义构建目录跑 Next 时，它会自动往 `tsconfig.json` 的 include 里追加条目，如 `.next-t204`、`.next-t207`、`.next/dev/dev/types`，反复弄脏工作区。现在的未提交改动属于负责人的工作区，动之前先问。
- 根目录残留三个 9 月的临时 `*.tsbuildinfo`，都已被 gitignore 忽略。

本票让说明与配置如实反映当前代码，不改运行行为。

不做：不改存储选择逻辑，不改部署方式，不重建 Windows 服务。

## Acceptance

- [ ] SOURCE.md 的运行时一节如实写出现行加载路径，不再引用不存在的文件
- [ ] `.env.example` 只列代码实际读取的变量，并写明 `SITE_STORE` 各取值在开发和生产下的实际效果；变量清单用 `git grep process.env` 复核
- [ ] Kubernetes 清单删除或按现行部署方式重写（推荐删除），README 同步修改，`project_map.py status` 不报过时
- [ ] 「邻里日常」缩略图的来源证据找回（例如在 Windows 或已保留的产物里），或在票里如实写明已丢失及影响；不补造证据
- [ ] 查清 Next 追加 include 的触发条件，给出不再弄脏 `tsconfig.json` 的做法；动负责人现有的未提交改动之前先征得同意
- [ ] 清理根目录残留的临时 `*.tsbuildinfo`

## Resolution

