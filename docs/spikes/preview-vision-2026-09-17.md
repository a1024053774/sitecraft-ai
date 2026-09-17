# 预览截图审查（Block 5）

- 运行日期：2026-09-17
- 请求模型：本机 `.env.local` 的 `DEEPSEEK_MODEL=deepseek-flash`（未写入本文）
- 产品路径：`POST /api/ai/preview-review` → `requestPreviewReview`（`lib/ai-provider.ts`）→ `POST {baseURL}/chat/completions`，user 消息为 `text` + `image_url` data URL
- 范围：用一张真实首屏截图证明模型能看见页面。只做模板气质 / 图文是否矛盾的助手。审美仍由人工拍板。没有 `commitOperations`，没有 CSS/HTML 写稿。

## 截图怎么拍的

- 预览 URL：`http://127.0.0.1:3034/api/templates/landwind/preview`
- 模板：`landwind`（本地 snapshot，`X-Sitecraft-Preview-Source: local-open-source-snapshot`）
- 浏览器：本机 Chrome headless CDP（`--window-size=1440,900`），视口截图，不是整页、不是 1×1
- 注入记号：`SCV5-NW7K9188`（固定在首屏左上角，未写入 prompt 期望值）
- 文件：`artifacts/preview-vision-landwind.png`（gitignore，不入库）
- 尺寸：1440×900 PNG，219169 bytes
- 页面可见标题：`Building digital products & brands.`

## 真实请求结果

`POST /api/ai/preview-review` multipart 字段 `screenshot` + `claimedTemplateId=landwind`。

| 项 | 值 |
| --- | --- |
| HTTP | 200 |
| ok | true |
| 响应模型 | `deepseek-flash` |
| aesthetic | `human`（服务端固定，不是模型打分） |
| image | 1440×900，219169 bytes |
| latencyMs | 约 6.4s（含网络） |
| nonce | `SCV5-NW7K9188` |
| 可见标题 | `Building digital products & brands.` |

模型 `visibleText` 同时抄到了本张截图上的 nonce 和 Landwind 首屏标题。这不是 canned always-ok：记号是截图当时写进 DOM 的。

`templateFit.looksLikeClaimedTemplate` 为 true。`imageTextMismatches` 为空。响应里没有 `operations`。

## 未声称

- 不是审美验收，不是 Demo 已接受。
- 不是 12 组对照，不是 Block 6 整段工作台生成。
- 不是 T7 看产品图写双语文案。
- 没有把视觉结果写入草稿。

## 密钥

密钥只在服务器环境变量里。本文、截图路径和 API JSON 均未写入 key、Authorization 或 data URL。
