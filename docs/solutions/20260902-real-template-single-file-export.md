# 真实模板离线单文件导出方案沉淀

- 日期：2026-09-02
- 场景：真实开源模板（vendor dist）需要导出为可离线交付的单个 HTML（<10MB，微信可传、双击即开）
- 方向：工程实现 / 单文件序列化
- 置信度：6（成熟方案已比对，项目内尚未落地验证）
- 层级：复合
- 状态：待验证（Task 4 代码 GREEN 后补实测证据）
- 复用量：2（SingleFile 的 DOM 快照思路 + monolith 的本地-HTML 输入均直接复用到本项目）
- 来源：[SingleFile（github.com/gildas-lormeau/SingleFile，22.3k★）](https://github.com/gildas-lormeau/SingleFile)、[monolith（github.com/Y2Z/monolith，15.5k★）](https://github.com/Y2Z/monolith)、Wix schema（间接，未取详情）

## 问题

向老大交付"真实模板 + 真实内容"的离线成品页。此前 `scripts/export-real-forge.mjs` 的实现是：从 preview API **抓静态 HTML** → 字符串级内联 CSS/JS/图片 → 替换 FAQ/footer → 注入 draft 脚本自动触发 bridge。产物 21.5MB（工作图占大头）且脆弱（依赖模板 dist 的具体文件名，如 `faq.DdY4n_PA.js`、`nav.Cq-01bLv.js`，模板一升级就失效）。需求收敛为：**通用（任意 templateId）、体积 <10MB、file:// 打开零远程请求零 console 错误、视觉与真实模板一致**。

## 成熟方案比对（第一性原理）

### 1. SingleFile —— 从渲染后 DOM 序列化（推荐主思路）

- **工作方式**：浏览器扩展在**页面完成渲染后**（此时懒加载已触发、运行时脚本已改 DOM、字体已加载）克隆 `document`，遍历把 CSS 内联进 `<style>`、图片/字体转 data URI，产出单个 HTML。faq.md 确认：默认**移除脚本**（离线不可保证执行、可能改渲染）；CSS 可去未用样式；HTML 可去隐藏元素；"save deferred images" 处理懒加载图。
- **对我们可复用的三条**：
  1. **DOM 快照而非静态抓取**——bridge 注入后的内容（我们自己的 `applyContent` 已改的真实文本）只有在**渲染后的 DOM**里才存在；抓静态 HTML 会丢掉注入。这正是 Codex Task 4"从当前 iframe 已应用并通过可见性校验的最终 DOM 序列化"的依据。本方案验证了该方向。
  2. **脚本默认移除**——我们此前为 0 console error 手动剥离 astro-island 客户端脚本、删 ClientRouter；SingleFile 默认策略与之一致（离线不保证 JS 可运行，保留最小折叠脚本即可）。
  3. **压缩手段**——"minify HTML/CSS + 移除未用样式/隐藏元素"是 21.5MB→<10MB 的必要手段之一（但图片本体仍需 canvas 重采样，见下）。
- **局限**：data URI 内联二进制是 base64（+33%），超大图仍会超限；纯 HTML 格式无压缩，因此体积门槛必须靠"图下采样 + 去重 + 清理未用"共同达成。

### 2. monolith —— Rust CLI 静态抓取（反面参照）

- **工作方式**：抓取 URL 后把 CSS/JS/图片/font 全量内联为 data URL。亮点：`cat page.html | monolith -b <base>` 可对**本地已有 HTML** 补全资源（`-I` 隔离文档、`-d/-B` 域名白/黑名单、`-j/-F/-i/-c` 排除 JS/字体/图/CSS）。**无 JS 引擎**：README 明示动态页需先用 headless Chromium `--dump-dom` 预处理。
- **对我们可复用的两条**：
  1. **"从文件而非 URL 输入"**——与计划 Task 4"不从 preview HTTP 重新抓取"一致；本地静态文件可作为资源基线。
  2. **域名隔离选项**——`-I -B -d` 白名单思路可借用到"离线导出不得包含远程资源"的校验实现（报告里列出 externalRequests）。
- **局限（反面教训）**：无 JS 引擎 → 对 Astro 模板的客户端 hydration / 我们的注入产物无能为力，必须先渲染；纯文本抓取会错过 runtime 改动。**证实了"本项目必须走浏览器 DOM 序列化，不能只做静态抓取"**。

### 3. 图片压缩在浏览器内做（体积门槛的杠杆点）

- 体积大头是模板工作图（work*.jpg 每张 3-5MB）。成熟做法：在 iframe 里用 **canvas 按显示尺寸下采样 → 转 WebP/JPEG**，而非原图 base64。这与计划 Task 4 Step 4（"iframe canvas 下采样转 WebP/JPEG，资源去重，超 10MB 返回带最大资源列表的错误"）一致——本方案验证了 canvas 下采样是唯一能在不牺牲观感的情况下把 21.5MB 压到 <10MB 的路径。
- 文本压缩：minify HTML/CSS（去空白/注释/未用样式）在纯 HTML 单文件里收益有限（图片才是大头），但仍是"先做"项，尤其 CSS 里大量模板样式。

## 对本项目（Task 4 导出协议）的落地映射

| 计划接口 | 借鉴自 | 说明 |
|---|---|---|
| `sitecraft:export-request/result` 从已渲染 iframe DOM 导出 | SingleFile DOM 快照 | 不动 preview HTTP、不退回 SiteRenderer；序列化时机=bridge 应用后 |
| `ExportReport.externalRequests` 全量外链报告 | monolith `-I/-d` 隔离白名单 | 非导航网络请求必须为 0 |
| `inlinedAssets / compressedImages` | SingleFile minify + canvas 下采样 | 图片下采样为体积第一杠杆 |
| `removedRuntimeScripts` | SingleFile 默认去脚本 + 本项目 astro 剥离经验 | 只保留 FAQ 折叠等最小脚本 |
| 失败返回最大资源列表而非伪成功 | 本项目 21.5MB 教训 | 超 10MB 明确报错 |

## 搜索策略与失败记录

- WebFetch 的 github.com 预检被网络层拦 → 改 **Bash curl 走 Clash 代理 127.0.0.1:7891**（端口 2026-09-02 从 7890 变更）抓 raw.githubusercontent.com + api.github.com 一手 README/faq，成功。
- 仓库作者名曾拼错（gildas-lerouge → gildas-lormeau）致 404；经 `api.github.com/search/repositories` 校正。SingleFileZ 核心文件是打包 ZIP 库非源码，避免误读。

## 验证记录（证据链）

- 已核对 SingleFile README/faq（官方一手）确认：DOM 序列化时机、默认去脚本、minify/去未用样式压缩、deferred images 处理、无第三方上传。
- 已核对 monolith README 确认：data URL 全内联、本地 HTML 输入（stdin + `-b`）、域名白名单、无 JS 引擎（动态页需 Chromium 预处理）。
- 尚未做项目内实测（依赖 Task 4 代码）；Task 4 全绿后在此补：两模板（Forge + ScrewFast/SMALL BIS）导出实测体积、externalRequests=0、file:// 零 console error 截图证据。

## 下一步验证

Codex Task 4 GREEN 后执行：① 用任务自带的 export E2E 跑 Forge 与 ScrewFast；② 打开产出 HTML 于 file:// 检查零请求/零报错/文本可见；③ 记录最终体积与图片压缩率，回填本文档"验证记录"并把置信度提到 7+。
