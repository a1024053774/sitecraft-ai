---
id: T-217
title: 删除看图识别与批注回复两条对外路由
type: build
status: open
blocked_by: []
claimed_by: Claude
supersedes:
---

## What to build

按 [T-213](T-213-unwired-analyze-and-replies.md) 的决定 A，删除两条没有界面调用方的对外路由：

- `POST /api/sites/[siteId]/images/[imageId]/analyze`，以及只为它服务的代码：
  - `lib/ai-provider.ts` 里的 `requestImageFacts` 及其失败日志；
  - `lib/image-facts.ts`；
  - `lib/site-images.ts` 里 analyze 用途的尺寸与字节下限和 `imageDataUrl`；
  - `app/globals.css` 里的 `.image-facts` 样式；
  - 对应测试。
- `POST /api/sites/[siteId]/annotations/[annotationId]/replies` 路由及其路由测试。

文档里提到看图请求的地方同步修改。

不做：
- 不删 `replyAnnotation`、`replyAnnotationSchema`：生成流程用它们写助手回复。
- 不改 `getAIProviderStatus`：`/api/health` 在用。
- 不改 `demo/` 下的静态演示快照。
- 不改 `intent.md` 的已确认需求。

## Acceptance

- [ ] 两条路由文件不存在；`git grep` 查不到 `requestImageFacts`、`image-facts`、`imageDataUrl`、`MIN_ANALYZE`、`.image-facts` 样式在应用代码中的引用
- [ ] 生成流程写助手回复照常：`replyAnnotation` 的存储测试和 t152 局部修改测试通过
- [ ] 上传图片校验不变：`tests/site-images.test.ts` 通过
- [ ] `npm run typecheck` 通过，`npm run build` 通过，`/api/health` 正常
- [ ] spec、error-catalog、AGENTS 中关于看图请求的描述与代码一致，`project_map.py status` 不报过时

## Resolution
