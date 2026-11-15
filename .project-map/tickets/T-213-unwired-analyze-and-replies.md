---
id: T-213
title: 看图识别与批注回复两条未接入界面的接口：删除还是接入
type: decide
status: closed
blocked_by: []
claimed_by: Claude
supersedes:
---

## Question

2026-11-14 静态扫描发现，下面两条路由在工作台界面和生成流程里都没有调用方，只有测试直接调用它们的 handler：

- `POST /api/sites/[siteId]/images/[imageId]/analyze`：调用视觉模型（`requestImageFacts`）识别上传图片的内容。与它配套的 `lib/image-facts.ts`，以及 `app/globals.css` 里的 `.image-facts` 样式，也没有界面使用。
- `POST /api/sites/[siteId]/annotations/[annotationId]/replies`：给批注线程追加回复。工作台现在读批注用 GET，改状态用 PATCH，发送意见走 chat，从不调用 replies。

AGENTS 规定「不为未来功能预置平行 API」。可选做法：

- **A. 删除**：删掉两条路由，以及只为它们服务的代码、样式和测试。推荐这个做法，因为两者都没接入界面，留着只是在维护没人用的入口。
- **B. 接入**：保留路由，另开 build 票把它们接进工作台，需要先说明它们让生成站更好看、更真或更好改在哪里。
- **C. 暂留**：保持现状，并在票里写明保留的原因和删除条件。

这是产品范围问题，由负责人决定。

## Resolution

2026-11-15 负责人决定：「把 t-213 的两个接口关闭」，采用 **A. 删除**。删掉 `POST .../images/[imageId]/analyze` 和 `POST .../annotations/[annotationId]/replies` 两条路由，以及只为它们服务的代码、样式和测试；实施见 [T-217](T-217-remove-analyze-and-replies-routes.md)。

`replyAnnotation` 仍由生成流程用来写助手回复（`lib/code-site-workflow.ts`），因此保留，只删对外的 replies 路由。
