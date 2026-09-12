# 实测状态（2026-09-10）

> ✅ **验证已完成，结论已并回设计文档 §4.1.2 / §4.1.3 与任务清单 T15/T15b/T16。**
> 本文保留为现场记录。

## 已确定的事实（实测）

### 生成侧（`test-results/selfcheck/gen.mjs`）

| 项 | 实测值 |
|---|---|
| 一次生成耗时 | **62 秒** |
| completion_tokens | **16000（打满上限，被截断）** |
| ├ reasoning_tokens | **14465（90%）** |
| └ 实际代码 | **4286 字符**（刚写到 `@media` 就断了） |
| 槽位属性遵守 | **0 个** —— `data-sitecraft-slot` / `-scope` / `-static` 全部缺失 |
| prompt_tokens | 1362 |

**结论**：`deepseek-v4-flash` 是**推理模型**，长推理 + 长输出把预算吃光，
导致①页面写不完 ②完全顾不上格式契约。

### 输入侧（更早的实测）

| 项 | 实测值 |
|---|---|
| 读图（1440×900 截图） | **847 tokens**，能准确读出导航项与主标题 |

### 成本（用户提供的 DeepSeek 空闲时段价）

输入缓存未命中 1 元/M · 输入缓存命中 0.02 元/M · 输出 4 元/M

## ✅ 验证结果（三条全过）

| # | 假设 | 结果 |
|---|---|---|
| V1 | 加大 max_tokens 就够 | ❌ **不够**——32000 仍被推理吃光 |
| V2 | **关推理能腾出预算** | ✅ **是解药**——`reasoning_effort:"none"`，推理 14465→0 |
| V3 | 拆多轮更好 | ⏭ 未做——**V2 已解决，无需拆** |

**V2 前后的对比（同一模型/图/提示词）**：

| | 开推理 | 关推理 |
|---|---|---|
| 耗时 | 62s | **9.2s** |
| completion | 16000（截断） | **2942** |
| 代码 | 4286 字符（断） | **8530 字符（完整）** |
| 槽位 | **0** | **23** |
| scope/static | 0 / 0 | **7 / 8** |
| `</html>` | ✗ | ✓ |

**额外验证：自检循环**
```
喂「设计稿 + 渲染图」→ 3.2 秒 / 315 tokens → 8 条差异 + 严重度
人工核对：准确（high 级「产品中心重复」渲染图上确实有）
```

**成本重算**：生成 ~4300 + 自检 ~2000 = **≈6300 tokens ≈ 2 分钱**（原估 5 分~2 毛作废）

## 关键文件

| 文件 | 内容 |
|---|---|
| `test-results/selfcheck/gen.mjs` | 生成测试脚本（含 abi 风格提示词 + 我们的槽位契约） |
| `test-results/selfcheck/gen-raw.txt` | 上一次产出（被截断的 HTML） |
| `.sitecraft-data/shots/kindred-final.png` | 实测用的输入截图 |

## 抄来的参考（abi/screenshot-to-code）

| 文件 | 可抄什么 |
|---|---|
| `backend/prompts/system_prompt.py` | **自检循环指令**（生成后渲染看一眼再改）——**最重要** |
| `backend/prompts/create/image.py` | 图片转码提示词（多截图处理策略） |
| `backend/prompts/design_system.py` | 设计系统注入（**只是 14 行提示词块**，不是复杂机制） |
| `backend/prompts/policies.py` | 能力开关的提示词分支模式 |

**它比我们强的**：① 有自检循环 ② 有 `extract_assets` 能从截图抠图 ③ agent 式多轮
**我们比它强的**：有槽位契约（它不做可编辑模板）

## 计划文档（已落盘，待本轮实测后更新）

- `docs/plans/2026-09-10-screenshot-to-template-design.md`
- `docs/plans/2026-09-10-execution-checklist.md`（19 项任务 T1-T19）
