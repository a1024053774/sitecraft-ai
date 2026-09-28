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

- [ ] 从首页点「新建站点」并选模板，得到一个新站点：站名、公司名是中性缺口文字，模板和设计意图与所选一致，URL 带新站点 id；`demo` 和其他站点的 revision 不变
- [ ] 刷新这个 URL 不会再新建第二个站点
- [ ] 打开时不先显示别的站点或旧样子
- [ ] 相关测试、`npm run typecheck`、`npm test`、`npm run build` 通过；新测试在改动前的代码上先失败
- [ ] 1440 浏览器截图
- [ ] 另一个 harness 的审核 agent 验收通过，结论记在 Resolution

## Resolution
