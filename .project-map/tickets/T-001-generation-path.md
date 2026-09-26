---
id: T-001
title: 生成路径怎么组页
type: decide
status: closed
blocked_by: []
claimed_by:
supersedes:
---

## Question

开源模板、区块、样式在成品里是什么角色？由谁、用什么渲染？

## Resolution

样子 → 同族模块素材 → 这家公司的完整页面。模板是素材，不是整页挖空填词，也不跨视觉族拼接；只用一个预览引擎（`preview-bridge` + 已准入的同族 overlay/kit），不另写渲染器；运行时模型不输出 HTML/CSS；草稿只走 `commitOperations`；adapter 是可审查数据。拒绝：模型写 CSS、本阶段原生 React 拼装。

依据：Q26=B、Q27=A（D26、D27），[.grilling/sitecraft-ai-generation-20260915.md](../../.grilling/sitecraft-ai-generation-20260915.md)。2026-09-17/18，负责人。
