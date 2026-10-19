---
id: T-187
title: 版面类修正发出的片段数超过回复上限，修正必然失败
type: build
status: open
blocked_by: []
claimed_by: codex-t187
supersedes:
---

## Why

T-183 第 1 轮 industrial/precision（2026-10-18，原文分析见 T-183 Resolution）：行业列表分隔符 `<span class=sep>/</span>` 用线条色 #b6c0c7，对比度 1.85，三档都不达标。

- **第 1 轮修正**：模型没有改这个颜色。
- **第 2 轮修正**：版面类拒因把整页叶子元素、页头页脚和 CSS 共 98 个片段一起发给模型。模型原样回填 98 条，但回复 schema 最多只收 80 条（`lib/code-site-repair.ts:14-16`），校验必然失败，报「模型未返回有效的局部修正」。

结果是一个只需改一处颜色的对比度问题，因为修正入口的片段数和上限对不上，最后没存下版本。这属于主流程问题（优先级 2）。

## What to build

1. **先查根因**：
   - 版面类拒因（对比度、溢出、重叠等）发给模型的片段是怎么选的；
   - 为什么对比度不足要发整页叶子元素；
   - 80 的上限从哪来；
   - 两者是否该由同一处决定。
   查清后写进 Resolution。
2. **在根因层修**：
   - 片段选择应以拒因实际涉及的元素和 CSS 声明为准；
   - 发出的片段数不能超过回复允许的条数，否则在发送前就明确拒收并说明原因，不能先发出去再必然失败。
   - 不放宽严格校验，不重试掩盖。
3. **装饰性元素**：修正提示要让模型能处理装饰性分隔符这类元素的对比度。如果分隔符这类非正文装饰本就不该按正文对比度判，按 T-089 的现行规则核实，写明结论，不擅自改检查标准。
4. **成对测试**：用这站保存的原文与站点代码做夹具，先在旧实现上复现必然失败，再验证修复后通过。
5. **真实探针**：在 industrial/precision 上跑一次，预算网关显式 `SITECRAFT_TOKEN_LIMIT=300000`，用新账本。

## Acceptance

- [x] 根因写进 Resolution，附原文定位
- [ ] 成对测试先红后绿；真实探针结果如实记录
- [ ] typecheck、test、build 通过；独立 fast 审查通过

## Resolution

第一步已完成；整票仍为 **INCOMPLETE**，等待负责人安排第二步与独立 fast 审查。执行者 codex-t187；时间均为纽约时间。对应代码为包含本节的 T-187 本地提交，父提交 `618cb587246ffadf31d1de8a8d76f3ed93f425f9`；最终 SHA 见 `git log -1 --format=%H`，提交后的证据索引保存在 `artifacts/t187/step1-result.json`。

根因与原文定位：

- 原现场为主工作区 `artifacts/t183/round1-full/private/case-1/code-site.json` 的 `run.attempts[0..1]`、`run.repairFailure.response` 与 `run.modelCalls`；归因见主线 T-183 的「失败站原文归因」。两次尝试都有首页三档各三条 `/（1.85，需 4.5）`，第二次修正原文有 98 条 replacements，CSS 仍保留 `.sep{color:var(--line-2)}`。
- 父版本 `lib/code-site-repair.ts` 的 `layoutIssues` 只按页面判断；`layout && !node.childElementCount` 开放该页全部叶子元素，公共 header/footer 也满足页面条件，并额外开放完整 style。原注释是避免重复发送祖先子树，但没有把拒因定位到实际失败元素，所以一个分隔符颜色问题扩大到 98 个片段。
- `git show b8174f0:lib/code-site-repair.ts` 表明 80 条限制在引入局部修正时已写进回复 schema；项目中未见更详细的数量依据。发送端没有对应限制，与回复端脱节；这不是提高模型输出额度能解决的问题。现由同一个 `repairFragmentLimit` 同时约束片段发送与严格回复，超过 80 条在调用模型前说明实际数量并拒收，不放宽协议、不重试。
- T-089 的正文标准仍是普通文字 4.5:1、大字 3:1；现行 `visitor-layout-scan.js` 将没有其他语义角色的可见 span 归为 body，提交入口对非标题统一要求 4.5；也不通过 aria-hidden 隐藏候选文字。没有分隔符豁免。本票保留标准，在提示中允许调整装饰字符颜色或只移除装饰字符，业务内容与顺序保留。

实现：扫描与拒因同时记录实际失败元素的字段、路径、快照和相关作者 CSS 声明；修正只开放这些叶子元素及声明，容器保持只读，缺少定位或快照变化即拒收。CSS 以当前源码声明为单位，包含 background 简写，不发送浏览器展开的空值长属性；写回范围核验也使用同一声明单位。原文与两份站点代码夹具在 `tests/fixtures/t187-industrial-repair.json`；原图复用已有 industrial 图片夹具，生产 `saveSiteImage` 在本轮临时数据根登记原图及许可，`readSiteImage` 实际供图，仅在内存中重绑生产分配的图片编号。未改主工作区数据，未调用真实模型。

验证（2026-10-18 EDT）：

- 21:08，父实现执行 `CHROME_PATH=<AGENTS.md 中的路径> npm test -- tests/t187-repair-fragments.test.ts`：1/6 通过、5 项按预期失败；保存现场重现 98 个可写片段，81 条场景先发模型再被接收端拒收。日志 `artifacts/t187/red.log`。
- 21:10，第一次修复定向运行 50/51，通过原 T-138 与 T-173 修正范围用例；剩余失败为变量 background 简写被 CSSOM 展开成空值长属性。21:12 的专项断言重现该问题，日志 `green-attempt-1.log`、`red-shorthand.log`。仅回退写回核验的声明枚举时，合法 background 修改被误判越界；反事实在 `red-shorthand-writeback.log`，原实现已在 finally 恢复。同轮也暴露图片尚未登记的夹具准备缺漏，随后按负责人确认补齐生产登记，没有放宽检查。
- 21:14:57 开始，执行 `CHROME_PATH=<AGENTS.md 中的路径> npm test -- tests/t187-repair-fragments.test.ts tests/t138-repair-fragments.test.ts tests/t138-token-repair.test.ts tests/t173-repair-scope.test.ts`：**53/53 通过**。日志 `artifacts/t187/green-attempt-2.log`；入口证据目录 `artifacts/t167/test-run-1792372498310-25343/`。本轮保存现场只开放 5 个片段：三个失败分隔符、`.sep` 的 color 和 body 的 background。修正后经同一个提交入口存版，两页 × 三档的溢出、重叠及对比度均为 0；确定性导入明确标记 `legacy-unreviewed`，不冒充模型事实核对。80 条可发送并接收，81 条零模型请求；同文高对比度分隔符不获可写权限，溢出、重叠、快照失效及实际 background 简写写回均有对照。

第二步未运行：runner 回归、全量 npm test、typecheck、build，以及 industrial/precision 的唯一真实探针（新账本 `artifacts/t174/t187-repair-probe`、显式 `SITECRAFT_TOKEN_LIMIT=300000`）均等待负责人通知；失败站不重跑。未开启审查或盲评实例，不推送。
