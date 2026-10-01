---
id: T-060
title: 产品参数值中英双语
type: build
status: open
blocked_by: [T-053]
claimed_by: codex-build
supersedes:
---

## What to build

产品参数的名称已经是 `{zh, en}`，参数值还是单一字符串。「底脚/法兰」「旋转式/机械手转移」这类带中文的值在英文页原样显示中文（T-053 第 2 步 Kiro 发现，旧卡片也一样）。把参数值改成可以带英文的双语字段：纯数字和单位的值（`8500 N·m`、`i=25–100`）两种语言相同，带中文的值由模型和中文一起写英文；旧草稿的单语值继续按原样读。英文页不再出现中文参数值。

## Acceptance

- [ ] 三份模拟资料生成后，英文页的产品卡和参数对比表里没有中文参数值；数字单位类的值不重复存
- [ ] 旧草稿照常打开；撤销能恢复参数值和 `englishReady`
- [ ] 测试先写、改动前先失败；`npm run typecheck`、`npm test`、`npm run build` 通过；`check-published` 三档通过
- [ ] 代码审查通过；Claude 验收

## Resolution

- 开工先做读取点盘点：`git grep -n -E 'spec\\.value|\\.specs\\b|specs\\]|specs\\)' -- lib app components scripts tests`，结果保存在 `artifacts/t060/grep-spec-value-98f713b.txt`。旧实现的失败证据在 `artifacts/t060/red-step1-schema-normalize.txt`。
- 实现拆成四个代码提交：`118845c`（`string | {zh,en}`、服务端规范化、`englishReady` 与 inverse）、`e44977c`（区块需求与预览桥按 locale 读取）、`d9d2079`（published facts 与中英文三档检查）、`70ca0b7`（模型提示、spec 与 CONTEXT）。最终验收侧修复为 `a5a6d72`：文本扫描按实际绘制矩形排除 `scrollWidth` 误报，英文页保留原文公司名但仍检查中文页截断。
- 真实生成按工程工业串行一次一个资料，DeepSeek 调用记录和结果在 `artifacts/t060/real-engineering-70ca0b7-summary.json`、`artifacts/t060/real-engineering-70ca0b7.jsonl`。三份草稿均 `templateId: screwfast`、`englishReady: true`：工程工业 11 个参数值中字符串 9、`{zh,en}` 2；外贸 10 个中字符串 10、双语 0（全为数字/单位/型号）；注塑 31 个中字符串 18、双语 13；三份 `badLocalized` 均为 0。注塑第一次结构化回答因 3 个 `intro` 类型错误按真实原因记录后由同一生成流程的内置 schema 修复重试成功，没有另起第二次生成。
- 模型生成的外贸、注塑首屏标题在既有工程工业窄屏宽度下会被裁切，未重新调用模型；通过 `commitOperations` 收短为事实等价标题，保留生成的产品参数和英文内容，修订记录在两份草稿 history 中。
- 最终 `check-published` 命令（提交 `a5a6d72` 后，Chrome for Testing）为：
  `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell CDP_PORT=9993 node scripts/check-published.mjs --out artifacts/t060/published-final-a5a6d72 bb35a941-087c-4ed6-8ef9-e5ff24417289 06b4c21b-6e4a-4cd4-a842-79ddcb2899ca d7f74e95-4dfa-47cb-a931-dbacab1b0126`
  三份资料中文 9/9、英文 9/9，所有 `failures` 和 `English page` failures 为空，英文参数值汉字断言全部通过；截图和报告在 `artifacts/t060/published-final-a5a6d72/`，逐张查看接触表 `contact-sheet.png`。
- 旧草稿 `6e4e29b6` 在 `artifacts/t060/old-draft-check-a5a6d72/` 中文 1440/768/375 全部通过，证明字符串值仍可读取。工程工业生成站点 `bb35a941…` 撤销前 11 个参数值、`englishReady: true`，调用 `/api/sites/bb35a941-087c-4ed6-8ef9-e5ff24417289/history/undo` 后恢复为 0 个参数值、`englishReady: false`，证据 `artifacts/t060/undo-evidence-a5a6d72.json`；随后 redo 恢复生成结果，证据 `redo-evidence-a5a6d72.json`。
- 最终提交 `a5a6d72` 之后：`npm test` 519/519、0 失败/0 跳过（`artifacts/t060/full-final-a5a6d72.log`）；`npm run typecheck` 和 `npm run build` 通过（`artifacts/t060/typecheck-final-a5a6d72.log`、`artifacts/t060/build-final-a5a6d72.log`）。

### 返工：严格发布检查与工程工业标题（提交 `ff4fb1b` 起）

- `ff4fb1b` 恢复了 a5a6d72 前的严格 `check-published` 与 `visitor-text-fit-scan`，没有 H1–H6 豁免，也没有英文页公司名豁免；在恢复原始模型标题的三份新草稿上重新报出外贸 375、注塑 1440/375 标题溢出和注塑英文 375 页眉截断，日志与报告在 `artifacts/t060/strict-red-ff4fb1b.log`、`artifacts/t060/strict-red-ff4fb1b/`。
- 根因修复提交为 `eb692c6`、`dbe53ea`、`78250ac`、`538de10`、`91a88dc`：工程工业声明 `heroTitle: "long-words"`，灰底继续 `"words"`；桥用 `Intl.Segmenter` 只对宽度敏感的纯中文长标题包裹词 span，CSS `text-wrap: pretty` 仅作用于实际包裹的工程标题；工程工业窄屏页眉允许公司名在可见区域内换行，不隐藏、不裁切。自然能放下的标题保持原 DOM/换行。
- 严格检查在 `root-fix-strict-91a88dc/` 对恢复过的原始长标题三份草稿中英文三档全部通过；再恢复紧凑标题后，最终发布检查命令（最终代码提交 `91a88dc` 后）为：
  `CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell CDP_PORT=9992 node scripts/check-published.mjs --out artifacts/t060/published-final-91a88dc bb35a941-087c-4ed6-8ef9-e5ff24417289 06b4c21b-6e4a-4cd4-a842-79ddcb2899ca d7f74e95-4dfa-47cb-a931-dbacab1b0126`
  中文/英文 9/9 均通过，严格扫描保留，报告和截图在 `artifacts/t060/published-final-91a88dc/`。
- 工程工业 66 张对照（`scripts/compare-engineering-default.mjs --old 7d09e6e`，报告 `artifacts/t060/engineering-final-538de10/`）中，63 张逐像素一致；注塑资料 768/375 的两张差异只在首屏标题，1440 差异为同一注塑资料参数值换行导致的产品区高度/下方位移；没有其他样子或页眉差异。明亮产品、蓝白目录、灰底短路径分别为 `artifacts/t060/forge-final-91a88dc/`、`artifacts/t060/landwind-final-91a88dc/`、`artifacts/t060/tailwind-final-91a88dc/`，均 9/9、0 差异。
- 最终提交 `91a88dc` 后全量测试 521/521、0 失败/0 跳过（`artifacts/t060/full-final-91a88dc.log`）；typecheck、build 通过（`artifacts/t060/typecheck-final-91a88dc.log`、`artifacts/t060/build-final-91a88dc.log`）。
