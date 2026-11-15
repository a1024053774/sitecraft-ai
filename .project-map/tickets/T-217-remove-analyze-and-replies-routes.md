---
id: T-217
title: 删除看图识别与批注回复两条对外路由
type: build
status: closed
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

- [x] 两条路由文件不存在；`git grep` 查不到 `requestImageFacts`、`image-facts`、`imageDataUrl`、`MIN_ANALYZE`、`.image-facts` 样式在应用代码中的引用
- [x] 生成流程写助手回复照常：`replyAnnotation` 的存储测试和 t152 局部修改测试通过
- [x] 上传图片校验不变：`tests/site-images.test.ts` 通过
- [x] `npm run typecheck` 通过，`npm run build` 通过，`/api/health` 正常
- [x] spec、error-catalog、AGENTS 中关于看图请求的描述与代码一致，`project_map.py status` 不报过时

## Resolution

2026-11-15（纽约时间），提交 8eea251a。

- 删除了两条路由文件；同时删除 `lib/image-facts.ts`、`requestImageFacts` 及其失败日志、`imageDataUrl`、analyze 用途的尺寸和字节下限、`.image-facts` 的 3 条样式，以及 `tests/image-analyze.test.ts`、`tests/ai-provider-vision-failures.test.ts`。`site-images` 测试中的看图 schema 用例和 t085 中调用 replies 路由的两行也一并删除。`inspectSiteImage` 去掉了只剩一个取值的 purpose 参数，上传校验规则不变。
- `git grep` 核对：应用代码中已查不到 `requestImageFacts`、`image-facts`、`imageDataUrl`、`MIN_ANALYZE`。`demo/r/*.css` 是静态演示快照，按票不改。
- 文档：spec 中带模型头的请求不再列看图；error-catalog 的 `truncated` 说明不再提看图；AGENTS 模型一行去掉「与看图同一条」。
- Mac 检查：
  - `npm run typecheck` 通过；加 `--noUnusedLocals --noUnusedParameters` 的严格检查 0 条错误。
  - `npm test -- tests/site-images.test.ts tests/t085-annotation-store-undo.test.ts tests/t085-annotation-postgres.test.ts tests/t152-local-edits.test.ts`：图片 5 个用例、批注存储与 API 4 个用例通过，t152 有 6 个通过。t152 另有 6 个因 Mac 缺 `CHROME_PATH` 无法运行，属于环境问题，已改到 Windows 补跑。
  - 删路由后，`.next/dev/types`、`.next-test/dev/types` 里 dev server 留下的旧路由类型会让 typecheck 报错；这两个是 gitignore 的缓存，删除后重新生成即可。
- Windows 检查：
  - `docker build --target build` 通过（`✓ Compiled successfully`）。
  - 在基于 `sitecraft:local` 的临时检查容器中，typegen、typecheck、runner 回归都通过；`npm test` 全量 139/139 加 1104/1104，共 1243/1243，于 03:12 结束，t152 局部修改用例全部在内。
- 审查：Codex gpt-6.1-sol（high，未开 fast，只读）结论 PASS，未发现可复现缺陷。
- 未部署：正式服务仍运行 09087e9c，是否重建由负责人决定。
