---
id: T-202
title: 用户自带模型接口，站点数据存在用户浏览器
type: build
status: closed
blocked_by: []
claimed_by: 执行主控
supersedes:
---

## Why

见 T-200：上线后由用户自己配置 API 地址和 key。key 和建站资源都只存在用户浏览器，服务器不保存。

现状：
- `lib/ai-provider.ts` 从环境变量读 key；
- 站点、对话、批注、上传存在服务器的 FS 或 Postgres（`lib/code-site-store.ts`、`conversation-store.ts`、`annotation-store.ts`）；
- 生成是服务器上的后台任务。

## What to build

1. **先做方案**：先写清楚实施方案，交构思主控确认后再动大面积代码。方案要回答下面几个问题：
   - 浏览器端存储用 IndexedDB，需要存哪些对象：站点、版本、对话、批注、上传、来源快照、任务结果。
   - 服务器改成「无持久化处理」：每次请求带上当前站点状态和 key，服务器用内存处理，结果交回浏览器写入。后台任务、刷新恢复、需求对齐的结构化请求，在没有服务器存储时怎么实现。
   - 提交入口、版本、撤销恢复、出处、局部修改这些现有合同，哪些保持不变，哪些要改，怎么验证。
   - 预览、发布和站点包下载怎么从浏览器数据渲染。
   - key 的流转：只走请求头，不写盘、不记日志、不进任务记录。沿用 T-174 的脱敏规则作为最后一道防线。
2. **设置入口**：工作台加一个设置页，用来填 API 地址、key 和模型名，存在浏览器的 storage 里。
   - 没有配置时，明确提示用户先去配置，不回退到服务器的 key。
   - 生产模式下服务器不读 `DEEPSEEK_API_KEY`。
3. **本地开发与测试**：保留现有的 FS 模式，用于测试和评估，避免整套测试推倒重来。生产模式只用浏览器存储。
4. **验收**：在本机用生产构建走完整主流程：配置 → 资料 → 风格 → 生成 → 修改 → 撤销 → 刷新恢复 → 下载站点包。三档截图逐张看过，并确认服务器数据目录、日志里都没有 key 和站点内容。

## Acceptance

- [x] 方案经构思主控确认
- [x] 生产构建下主流程走通，服务器无持久化站点数据，日志无 key
- [x] typecheck、test、build 通过

## Resolution

**方案**：2026-10-20 构思主控确认。浏览器 IndexedDB 是唯一长期存储；服务器只放内存盘里的临时副本，闲置 30 分钟清理，总量上限 128MB。取消公开发布链接，改为下载站点包。访客地址限 https 和公网地址，防 DNS 重绑定，不跟随重定向。验收用本机替身，真实生成放到 T-204。369 个旧站不迁移。另有两条补充要求：单队列，并发为 1，hydrate 有大小上限；令牌只用于隔离。完整规格见 spec 第 6 节「浏览器存储与访客模型接口」。

**提交**（分支 `t202-byok-browser-storage`）：
- 617aca1：key 流转与设置页。
- 8f4dd51：服务器端临时副本、令牌、队列。
- 9da2511：浏览器端 IndexedDB。
- 53491a6：术语「站点存档」。
- 分支上另有构思主控的 fa2a5d1（T-204 部署事实），合并时一并带入。

**证据**（2026-10-20）：
- 定向测试：`npm test -- tests/t202-provider-flow.test.ts tests/t202-browser-storage.test.ts` 共 13/13 通过。
- 变异：10 个变异逐一回退对应修复，均被测试检出，跑完已恢复。
  - provider：生产模式读环境变量 key、任务丢凭据、lookup 不校验、跟随重定向；
  - storage：守卫放行任意令牌、存档路径不校验、旧存档覆盖新副本、清理不看任务、对齐后才预留队列、每令牌不限位置。
- 受影响的既有测试全部通过：image-analyze、vision-failures、t169、t174、t159、t151、sites-list、site-delete、site-preview、conversation-store、t085、t102、published-page-hygiene、t128、t129、t166、t171。其中 site-delete 的源码文本检查误把 `forgetSite(` 当成 `getSite(`，已把函数改名为 `dropServerCopy`。
- 构建：`SITE_STORE=browser npm run build` 通过。
  - 过程中 Turbopack 曾 panic（Invalid file type Directory）。原因是工作区模块从 `process.cwd()` 推导默认数据根，又用展开参数拼路径，追踪器因此去扫 `.sitecraft-data`。
  - 修法：浏览器模式只用显式数据根，并给每个 `path.join` 和 fs 调用加 `turbopackIgnore`。
  - 修复后，宽匹配警告的条目与基线 ca8969b 完全相同。
- 本机验收：`zsh artifacts/t202/run-acceptance.sh` 跑出 `artifacts/t202/acceptance-20261020T140305/`，两段都通过。
  - 走通的流程：配置 → 新建 → 资料 → 风格 → 确认 → 生成 v1 → 修改 v2（首页标题变了）→ 撤销 v3 → 刷新仍是 v3。
  - 服务器重启并换成空数据根之后：首页从本地列出站点，重新打开从浏览器恢复到 v3，站点包下载 200（zip）。
  - 不带 cookie 访问同一站点返回 404，发布链接返回 404。
  - 带 key 的请求只有 chat 的非 state 请求和撤销。
  - 在服务器副本和 app.log 里搜 key，0 处。
  - 三档工作台截图都看过，scrollWidth 等于视口宽度；设置页三档截图在 `artifacts/t202/settings-*.png`。
- 未做：真实模型生成（按约定放到 T-204，用负责人的 key 在 VPS 上做）。全量 test 与 build 由合并后的主线验证执行。

### 主控验收与关闭

- 主线合并为 55145a0，验证提交是 bb7073f，证据在 `artifacts/main-verify-bb7073f/`：
  - `npm run typecheck` 通过；
  - `node --test --experimental-strip-types scripts/t167-runner-regressions.ts` 18/18；
  - `CHROME_PATH=… npm test` 1016/1016；
  - `npm run build` 通过。
- 55145a0 上首次全量是 1015/1016。失败项是本票的 key 扫描：全量时 t176 在共用数据根里放了目录符号链接，扫描把链接当文件读，报 EISDIR。bb7073f 改为只读普通文件，并跳过被并发删除的文件。失败那轮的证据保留在 `artifacts/main-verify-55145a0/`。
- 本票没有另开代码审查实例：方案由构思主控确认，测试有变异证据。真实模型生成留给 T-204。
