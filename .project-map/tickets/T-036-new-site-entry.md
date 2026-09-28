---
id: T-036
title: 「新建站点」入口真正新建一个站点
type: build
status: open
blocked_by: []
claimed_by: kiro
supersedes:
---

## What to build

首页「新建站点」→ 模板页 →「进入编辑预览」打开 `/workspace?template=X`。工作台落到共用的 `demo` 站（Forge Industrial），还把它改成所选模板；首屏先显示旧样子，刷新后才对。

应当用创建接口新建一个站点，再换到 `?site=<新 id>`；其他站点不受影响。

## Acceptance

- [x] 从首页点「新建站点」并选模板，得到一个新站点：站名、公司名是中性缺口文字，模板和设计意图与所选一致，URL 带新站点 id；`demo` 和其他站点的 revision 不变
- [x] 刷新这个 URL 不会再新建第二个站点
- [x] 打开时不先显示别的站点或旧样子
- [x] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [x] 1440 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution

实现（Kiro）：新增 `lib/workspace-entry.ts`。`resolveWorkspaceEntry` 判断工作台入口：带 `site` 就打开那个站；只带已知 `template` 是「新建站点」入口；其余打开默认站。工作台载入时，新建入口先 `POST /api/sites`（请求所选模板，站名「未命名站点」），再用 `history.replaceState` 把地址换成 `?site=<新 id>`（去掉 `template`，保留其他参数），之后按这个 id 读草稿。开发模式下 effect 会跑两次，两次共用同一个创建请求，不会多建站点。删掉了原来把所选模板写进当前打开站点（共用的 `demo`）的那段 `set_visual_brief` / `set_template`。

红态（2026-09-28 11:52，工作台改动前）：`node --test --experimental-strip-types tests/workspace-new-site-entry.test.ts` 5 项中 1 项失败（工作台源码没有调用创建接口，仍有 `requestedTemplate` 改模板的逻辑）。

绿态（2026-09-28 12:02）：同一命令 5/5；`npm test` 271/271、`npm run typecheck`、`npm run build` 通过。

浏览器（Kiro 的 Chrome，1440，dev server 3034）：首页 →「新建站点」→ 模板页选 SCREWFAST →「进入编辑预览（非发布）」。地址变为 `?site=95720620-5391-42dd-9387-9d094cd220b0`；站名「未命名站点」、公司名「未命名企业」、样子「工程工业」、模板 screwfast、0 件商品、草稿 v2；站点总数 425 → 426（只多一个），`demo` 仍是 v15。刷新后仍是同一个站，总数仍 426。截图 `artifacts/t036/new-site-from-dashboard-1440.png`。

未处理（不在本票范围）：首页和 `/content` 的「上传商品表格」链接 `/workspace?import=products` 不带站点，仍打开默认站。截图里工作台深色主题的对话气泡、输入框和工具栏文字对比度过低，另开 T-043。

2026-09-28 grok-b 审核，不通过。没有改入口的实现提交。首页「新建站点」仍进 `/templates`，模板页「进入编辑预览」仍是 `/workspace?template=`（`components/template-gallery.tsx`）。`parseWorkspaceSiteId` 在没有 `site` 时落到 `demo`。工作台先读取这个站点的草稿，模板不一致时再对该站点 `PUT` `set_visual_brief` 或 `set_template`（`app/workspace/page.tsx` 的 `loadDraft`）。所以打开时仍先是 `demo` 的旧样子，刷新也不会换成新 id。

`POST /api/sites` 能建新站，`tests/site-creation.test.ts` 只打这个接口，不覆盖首页点击、不检查 `demo` 的 revision，也没有「打开时不先闪旧样子」的测试。没有 1440 截图。

2026-09-28 14:09 grok-b 审核 `7348ea1`、`c534423`，不通过。第一次从首页走进去是对的：1440 选了有本地快照的 LANDWIND，地址变成 `?site=c6c06c92-eef8-4cc5-bcbd-757bcb553b22`，站名「未命名站点」、公司名「未命名企业」、样子「蓝白目录」、模板 landwind；`GET /api/sites` 只多出这一个 id（486 → 487）；`GET /api/sites/demo/draft` 仍是 revision 15，`updatedAt` 未变。刷新这个 URL 没有再 POST，站点总数仍是 487。第一次进入只有 1 次 `POST /api/sites`。

不通过的原因：`pendingSiteCreation` 成功之后没有清掉。注释写的是开发模式里两次 effect 共用同一次进行中的创建，但这个 Promise 在整个页面会话里一直留着。同一会话里不刷新，再走一遍「新建站点」并选同一个模板，不会再创建，地址被换回刚才那个站。

复现：Chrome 打开 `http://127.0.0.1:3034/`（不要整页刷新）。点「新建站点」→ 选 LANDWIND / Clean →「进入编辑预览（非发布）」，记下地址栏里的站点 id。点「返回站点」，再点「新建站点」，再选 LANDWIND，再点「进入编辑预览（非发布）」。第二次地址栏仍是第一次的 id，网络里没有新的 `POST /api/sites`，`GET /api/sites` 的 id 列表不增加。2026-09-28 14:08 实测：第一次 `1868ab9a-c55d-4b7e-84d5-4e4c4e51470e`（1 次 POST），返回首页后第二次仍是这个 id，POST 次数为 0。整页刷新后再进会新建，因为模块状态被清掉了，所以只刷新验收看不到这个问题。

命令：`node --test --experimental-strip-types tests/workspace-new-site-entry.test.ts` 5/5；`npm test` 283/283（当时 HEAD 在 `9e24e6d`）；`npm run typecheck` 通过；随后在当前 HEAD 上 `npm run build` 通过。证据：`artifacts/t036-review-grokb/`（`03-new-site-1440.png`、`04-refresh-1440.png`、`report.json`、`stale-probe.json`）。截图已打开看过。

修复（Kiro，2026-09-28 15:12）：按 grok-b 的复现修。进行中的创建改由 `createSiteOnce`（`lib/workspace-entry.ts`）管理：开发模式下同一入口的两次 effect 只共用还没完成的那次创建，创建一结束（成功或失败）就清掉，之后再走「新建站点」会新建。红态：15:10 新增的三项（两次 effect 共用一次创建、之后同模板再建一个新站、失败后可重试）在改动前失败；绿态：`node --test --experimental-strip-types tests/workspace-new-site-entry.test.ts` 8/8，`npm test` 302/302，`npm run typecheck` 通过。浏览器 1440 按 grok-b 的步骤：首页「新建站点」→ LANDWIND →「进入编辑预览」得到 `0969b52e-e0f4-40ab-a2ef-9c43b70c0958`；「返回站点」（不刷新）再来一遍得到 `8f537648-e696-421a-b73c-425482181cae`；站点总数 566 → 568（`artifacts/t036/second-new-site-1440.png`）。

