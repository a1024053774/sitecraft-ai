---
id: T-203
title: 更新 GitHub README 与入口
type: build
status: closed
blocked_by: [T-201]
claimed_by: Codex（承接执行主控收尾）
supersedes:
---

## What to build

更新 README，必要时一并更新仓库 About 页：

- 写清项目是什么、产品页与建站网站的链接、本地运行方式，以及如何配置自己的模型接口。
- 不写未实现的能力。
- 截图使用 T-201 的样品。

## Acceptance

- [x] README 链接有效，内容与实际能力一致

## Resolution


**PASS，2026-10-21 11:37:37 EDT（纽约时间）**。README 已区分公网静态工作台演示与本机真实建站，说明获取源码、Chrome 依赖、自带模型接口和本机存储方式；不把公网演示写成真实建站服务。四张样品图及所有相对链接目标均存在，两个公网入口与 chrome-headless-shell 文档实际 curl 为 200，源码仓库只读访问也为 200。记录见 `artifacts/t207/readme-links.json`。

初查 `http://localhost:3000` 因未启动服务返回 000，原结果保留。随后以无模型 key、独立 `.next-t207` 和本次截取资料副本启动真实 `npm run dev -- --hostname 127.0.0.1`，默认 3000 入口返回 200；补证见 `artifacts/t207/readme-local-entry.log` 与 `logs/readme-dev.log`。检查期间没有调用真实模型；该开发服务在 T-207 提交后随本机服务收尾关闭。本次未修改 GitHub About，也未向 GitHub 推送。

产品页三档截图与演示、VPS、公网证据统一见 [T-207 Resolution](T-207-interactive-demo.md#resolution)。交付与 T-207 在同一 **T-207：发布静态工作台演示并完成公网验收** 提交（`git log -1 --format=%H -- .project-map/tickets/T-203-readme-entry.md`）。
