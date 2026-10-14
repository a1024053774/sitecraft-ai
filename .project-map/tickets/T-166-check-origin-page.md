---
id: T-166
title: 提交检查不再打开站点列表首页
type: build
status: open
blocked_by: []
claimed_by:
supersedes:
---

## Why

`lib/code-site-check.ts` 每次提交检查先让 Chrome 打开 `${SITECRAFT_BASE}/` 来取得 HTML 源。首页会列出全部站点；主目录已有 4,223 个 code-sites（多数是全量测试建的），空闲时首页就要 6–8 秒。全量测试多个 Chrome 并发时，`Page.navigate` 超过 30 秒：2026-10-14 主线 `5d69145` 三次全量都是 356–379/434，失败几乎全是该超时，单独跑同一文件全过（日志 `artifacts/merge-5d69145/`）。真实使用中站点一多，每次提交检查也会变慢。

## What to build

1. 检查器改为打开一个不读站点数据、不带应用脚本的最小 HTML 源（例如 `public/` 下的静态空白页），保持现有 origin 校验和后续 `setDocumentContent`/资源拦截不变。
2. 不删除、不清理主目录 `.sitecraft-data`（用户数据，T-003）。测试写入主数据目录的问题只记录，不在本票改。

## Acceptance

- [ ] 测试证明检查器不再请求站点列表首页（例如用本地 HTTP 源记录请求路径），并且首页很慢时检查仍在时限内完成；先在父版本上失败
- [ ] 主线标准全量 `npm test`、typecheck、build 通过
- [ ] 独立 sol 实例代码审查通过
