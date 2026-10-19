---
id: T-194
title: 机械数字检查把相邻文字节点拼在一起，修正器找不到片段整站拒存
type: build
status: open
blocked_by: []
claimed_by: codex-t194
supersedes:
---

## Why

T-190 新基线第一轮的 restaurant/documentary 没存下版本，排查见 `artifacts/t190/r2-round1-failure-diagnosis.md` 第 3 节。

- **检查器怎么读的**：机械数字检查读 `clean.text`，相邻文字节点直接拼接。`<strong>11:00–14:00</strong><span>13:30 停止点菜</span>` 被读成「14:0013:30」，抽出资料里没有的 0013、3020，触发拒因。页面上的事实本身是对的。
- **修正器怎么找的**：修正器（`lib/code-site-repair.ts:167-183`）只在单个文字节点里找这个数字，找不到片段，整站拒存。
- **来源**：拼接逻辑来自 89feb29（10-09），数字定位来自 68d0b22（10-16），都早于 T-188 至 T-193。T-191 只修了事实核对段的分隔，没有动这条读取路径。T-180 同组合没触发，是因为当时 DOM 的排法不同。

检查器和修正器对同一个 DOM 的读法不一致，导致正确的页面被拒，属于主流程缺陷（优先级 2）。

## What to build

1. **复现**：用 C10 保存的候选走 `commitSiteCode`，不调用模型，复现同一拒因和拒存。
2. **在根因层修**：机械数字抽取按渲染边界分隔相邻节点，与 T-191 的规则保持一致：
   - 块级、grid/flex 子项、单元格之间要分隔；
   - 三档取并集；
   - 判定不了的明确拒收。
   修正器定位数字片段的读法也要与检查器一致。如果确有跨节点的数字（例如被 span 拆开的一个数），要明确拒收并说明原因，不靠全文子串反推范围。
3. **不能放宽的地方**：不放宽数字保真规则。T-151 英文版的数字检查若走同一路径，一并核对，写明它是否受影响。
4. **成对测试**：用 C10 的真实结构做夹具，旧实现拒存，新实现存版；再补一组「跨节点确实新增了数字」的反例，仍然要拒。

## Acceptance

- [x] 复现命令与根因写进 Resolution
- [x] 成对测试先红后绿，反例仍拒
- [ ] 合并后主线验证通过；独立 fast 审查通过

## Resolution

**INCOMPLETE（2026-10-19）：本地实现及授权门控 PASS；待主控合并后的主线验证与独立 fast 审查。**


本轮只执行 What to build 1–4 的本地实现与定向门控；合并后主线验证及独立 fast 审查由主控另行安排。票保持 open，claimed_by 为 codex-t194。

### 复现与根因

父版本为 `db87731`。只读 C10 保存记录的 `run.attempts[0].code`、资料和图片元数据，提取到 `tests/fixtures/t194-c10-number-boundary.json` 与 `tests/fixtures/t194-images/`；图片复用仓库已登记的 `fixtures/simulated-packs/restaurant/` 食材资源。原候选三页 HTML、CSS、图片编号及营业时间结构未改。测试经生产 `commitSiteCode`、真实 Chrome 和本工作树标准入口分配的临时数据根提交；只有事实 HTTP 是本地确定性替身，不连接真实模型。

最初先保持全部生产代码为父版本，运行本票测试：11 项中 2 项通过、9 项按预期失败，exit 1。`artifacts/t194/parent-red.log` 和 `numbers-1792415628507-84115/c10-commit.json` 保留原结果：拒因只有 `资料没有的数字：0013`、`资料没有的数字：3020`，版本数为 0，随后生产修正器报「局部修正无法定位底线拒因对应的代码节点，本次未保存版本。」同轮 flex/grid 与三个响应式分隔反例也失败；块级和单元格对照通过。

根因是旧 `cleanCandidate.readableFragment` 按固定标签拼接文本，未读取 `.hours-table dd` 的 flex 子项分隔；`11:00–14:00` 与 `13:30 停止点菜`、`17:00–20:30` 与 `20:00 停止点菜` 因而拼成不存在的数字。修正器又在单个文本节点内重新找数字，无法找到这些跨节点记号。T-191 的事实段、成员与来源快照不在本案失败链上；本案在事实替身调用前已被机械数字检查拒收。

### 实现与边界

- 删除清理阶段的旧静态文字读取。`readCodeReadable` 在三档完整候选分别新装载、稳定资源并采集完 T-191 的 separatorPaths 并集后读取；块级、flex/grid 子项、单元格共用同一并集，不选某一档。路径、标签或源码对应关系不可靠即明确拒收。分隔只存在于检查读取结果，不改生成站 DOM。
- 读取数字同时保存源码字段、childNodes 路径、原文快照与句子字符区间，随 `checks.numberRepairs` 传入原修正入口；沿用既有位置快照、范围外内容核验和纯文字写回，不再按数字扫描全文、单节点子数字或整份 CSS。正文、辅助属性及页面标题仍按原 NFKC 和数字表达式核对资料，不加数字、列表或行业豁免。CSS 生成数字仍按实际渲染结果检查；不能独立定位时明确拒收，不放开整份样式表。
- 行内真正连成一个数字时，保留连续抽取；数字跨多个文字节点则明确拒收并说明具体数值，即使资料有完整数值也不猜修正范围。同字段顶层行内节点不能凭空分隔，独立标点节点仍保留。单节点修正用原始字符区间写回，全角数字不会移动快照偏移。
- T-151 **不走这条数字来源路径**：`englishFidelity` 逐对应中文／英文文字节点、辅助属性与标题比较含数字记号、数量和单位多重集合，CSS 文案按渲染位置成对比较；`translationSource` 仍跳过资料全文数字字面量检查。此次没有修改英文保真函数、单位归一或英文修正定位。新的作者文字读取仍服务通用核验记号检查。
- T-159 的 CDP 替身只增加新读取观察的返回，原准入场景不含数字；排版分隔和数字位置的证据来自本票真实浏览器测试，不以该替身证明视觉或数字行为。

Tracer bullet：C10 原候选 → 生产提交 → 三档并集 → 数字与源码位置 → 存版／明确拒收；另有单节点数字拒收 → 按位置修正 → 原提交入口存版。Deep modules：同一读取器同时提供数字与位置，删除修正器的重复数字解析，不增加模型提交 API。Ubiquitous language：分隔判定描述文字边界，数字位置描述本次源码快照，两者均不替代资料原句或事实语义核对。


### 最终证据与命令

下述证据对应本次 T-194 功能提交的最终代码与测试；代码、测试、文档和本 Resolution 同一次本地提交，最终 SHA 由交付回报给出，也可运行 `git log -1 --format=%H -- .project-map/tickets/T-194-readable-number-concat.md` 定位。父基为 `db87731`，没有推送。

| 检查 | 2026-10-19 EDT 与结果 | 本工作树证据 |
| --- | --- | --- |
| 首次父版本复现（实现前） | 09:13，11 项中 9 项预期失败、2 项对照通过，exit 1 | `artifacts/t194/parent-red.log`；`numbers-1792415628507-84115/c10-commit.json` |
| 最终测试在父版本复验 | 09:26:37–09:26:44，13 项中 10 项预期失败、3 项对照通过，exit 1；仍为 0013/3020，非环境或夹具失败 | `artifacts/t194/parent-red-final.log`、`parent-final-execution.json` |
| 修复后相关定向门控 | 27 文件 **267/267 通过**，全部 exit 0；最终补改之前已执行的前 11 个文件在 09:26:54–09:27:54 复验，并再次包含 T-194 13/13 | `artifacts/t194/accepted-results.json`；各文件 `related/` 或 `related-final/` 下的 `test.log`、`report.json` 和原生 summary |
| 最终 C10 生产存版 | 09:27，三页存为首个完整版本，9 份视口的 overflow/overlaps/contrastIssues 全为 0 | `artifacts/t194/numbers-1792416467568-13109/c10-commit.json` |
| 跨节点反例与单节点修正 | 无来源 1234 保留数字拒因并明确说明跨文字节点，有来源的拆分数字也拒存；单节点修正保留首尾句与 CSS，经原入口存版 | 同目录 `cross-node.json`、`sourced-cross-node.json`、`single-node.json`、`single-node-saved.json` |
| 最终 typecheck | 09:28，exit 0 | `artifacts/t194/typecheck-final.log` |

```sh
export CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell
npm test -- tests/t194-number-node-boundary.test.ts
# 每个文件各用一次标准 npm test，不并发运行文件；每次先核对负载。
python3 artifacts/t194/run-related.py
# 最终父版本复验独占本工作树，恢复四个已改生产文件后串行运行相同测试，finally 恢复修复。
python3 artifacts/t194/run-parent-final.py
# 补改前执行的前 11 文件和本票在恢复修复后重新验证。
python3 artifacts/t194/run-related-final.py
npm run typecheck
```

相关文件由 `rg -l '资料没有的数字|englishFidelity|code-site-english|readCodeFactSeparators|readCodeFactSegments|codeRepairFragments|repairSiteCode' tests --glob '*.test.ts'`、所有 t151/t160/t173/t191 文件及直接受影响的 t159 准入夹具合并选出；列表在 `artifacts/t194/related-selection.txt`，检索原结果也保留。结果按文件选择补改后最新的一次组成 accepted-results，没有重复计数。每次启动前实际运行 `memory_pressure | tail -1` 和 `pgrep -f chrome-headless-shell | wc -l`，低于 25% 空闲或超过 12 个 Chrome 就等待；本轮起跑记录均满足约束，一次只有一个定向测试文件。等待只服务于负载条件；新测试与读取器不靠固定等待判断完成。

**停点与限制。** 未调用真实模型，事实 HTTP 替身只隔离确定性边界，不能据此声称真实事实语义核对或审美已通过。按本次指令未开任何审查实例，未跑全量、独立 runner 回归或 build；第三项验收不勾选、票不关闭。未读 `.env.local`，未启动或改动主工作区及 t190b 服务，未写主工作区 `.sitecraft-data` 或 artifacts，未额外计算哈希或做字节／像素证据比对；图片沿用生产提交入口已有的完整性检查。测试入口的服务和数据根均属本工作树，identity 已在各报告核实；本工作树也未创建默认 `.sitecraft-data`。`tsconfig.json` 的 Next 自动变更保留在工作树，不进入提交。AGENTS、CONTEXT、mainline 与 spec 已同步，project-map 无过时 living doc。
