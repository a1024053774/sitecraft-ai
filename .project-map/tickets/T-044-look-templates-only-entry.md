---
id: T-044
title: 只有四个样子背后的模板能进入新建站点
type: build
status: closed
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

T-036 之后，模板页里选 ASTROGENT、ATLAS、GENAI 这类不属于四个样子的模板再点「进入编辑预览（非发布）」，工作台报「提交内容不完整，尚未保存」：创建接口只接受四个样子背后的模板（forge、screwfast、landwind、tailwind-landing）。T-036 之前，这些模板会被直接写到共用的 demo 站上，变成原样的开源模板页，也不符合「不得把整页快照挖空填词当成品」。

模板页和模板整页预览只给四个样子背后的模板显示进入按钮；其他模板照常能看缩略图和官方演示，写明只作参考、不能直接生成。工作台地址里带了不能生成的模板时，说明原因，不去打开别的站点。

## Acceptance

- [x] 模板页和整页预览里，只有 forge、screwfast、landwind、tailwind-landing 有进入按钮；其他模板写明「只作参考」，没有进入按钮
- [x] 直接打开 `/workspace?template=<不能生成的模板>` 时，工作台说明这个模板不能直接生成，不新建站点，也不改 demo 或其他站点
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 1440 浏览器截图
- [x] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：`lib/template-readiness.ts` 的 `canEnterEditPreview` 改为「有本地快照且是某个样子背后的模板」。模板页选中其他模板时，底部写「这个模板只作参考，不能直接生成网站。请从明亮产品、工程工业、蓝白目录、灰底短路径背后的模板开始。」，浮条写「只作参考 · 不可生成」，没有进入按钮；整页预览同样不显示按钮。`resolveWorkspaceEntry` 对已知但不是样子背后的模板返回 `refuse`，工作台说明「「ASTROGENT」只作参考，不能直接生成网站…」，不调用创建接口。提示里的模板名只取「 / 」前面的部分，因为 `userFacingError` 会拦下带斜杠的文字。spec §3.3 同步。

红态（2026-09-28 15:54，改动前）：`node --test --experimental-strip-types tests/template-readiness.test.ts tests/workspace-new-site-entry.test.ts` 中「只有样子背后的模板能进入」「非样子模板被拒绝」两项失败。

绿态（16:01）：同一命令全部通过；`npm test` 305/305、`npm run typecheck`、`npm run build` 通过。

浏览器（Kiro 的 Chrome，1440）：模板页选 ASTROGENT，底部是只作参考的说明，没有进入按钮；选 SCREWFAST 时按钮是 `/workspace?template=screwfast`（`artifacts/t044/gallery-reference-only-1440.png`）。`/templates/astrogent/preview` 没有进入按钮，`/templates/screwfast/preview` 有。直接打开 `/workspace?template=astrogent` 显示上面的说明，站点总数 629 → 629、demo 仍是 v15（`artifacts/t044/workspace-refused-1440.png`）。

独立审核：grok-b，2026-09-28 17:26，PASS。模板页选中 ASTROGENT / Agency 和 ATLAS（页面上是 ASTROPLATE / Business）时，底部是「这个模板只作参考，不能直接生成网站。请从明亮产品、工程工业、蓝白目录、灰底短路径背后的模板开始。」，浮条是「只作参考 · 不可生成」，没有进入按钮；选 SCREWFAST 时按钮链到 `/workspace?template=screwfast`。`/templates/astrogent/preview` 没有进入按钮，`/templates/screwfast/preview` 有。直接打开 `/workspace?template=astrogent` 仍停在这个地址，对话里是「「ASTROGENT」只作参考，不能直接生成网站。请回到模板页，从四个样子背后的模板开始。」，这次没有 POST `/api/sites`。紧接着再打开同一地址，`GET /api/sites` 仍是 726、demo 仍是 v15（`updatedAt` 2026-09-28T13:44:18.678Z）。命令：`node --test --experimental-strip-types tests/template-readiness.test.ts tests/workspace-new-site-entry.test.ts` 13/13；`npm test` 314/314；`npm run typecheck` 通过；`npm run build` 通过。证据：`artifacts/t044-review-grokb/`。实现提交：`61f5032`

