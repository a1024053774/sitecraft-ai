---
id: T-119
title: 发布检查只控制自有浏览器并明确拒绝终止连接
type: build
status: open
blocked_by: []
claimed_by: t113-cdp-triage
supersedes:
---

## What to build

T118新代码全量中，T113 collector首视图成功后8次Target.createTarget超时，真实因果仍UNKNOWN。独立自有sentinel对照已证明check-published会复用非本次启动的Chrome；有限PID取模端口不保证隔离。证据 `artifacts/t113/full-cdp-failure-4b95521/REPORT.md`。本票只修确定的浏览器归属和连接终止处理，不把它说成已解释原超时。

**Tracer bullet**：先以真实CLI和自有sentinel建立归属业务红，再让正常自有启动、占用拒绝、连接终止及清理走同一入口。**Deep modules**：责任留在现有collector启动/CDP/cleanup层，不引入工作台副作用或并行浏览器框架。**Ubiquitous language**：自有浏览器指本次启动且有可核对句柄、profile与endpoint的进程。

默认使用独立profile与OS分配端口；保留显式端口用法但占用或竞争须明确拒绝，不附着陌生端点。只清理自有句柄，连接关闭/error后拒绝pending及后续send，停止无效矩阵命令；原生截图、采集一次、paint/geometry及事实门不放宽。T113测试先报告真实CLI失败/缺测，再访问credits。不得自动重启、截图重试、加sleep或延长超时。

## Acceptance

- [ ] 原全量失败与未知因果保留；自有sentinel对照在旧代码上证明非自有target操作
- [ ] 默认及显式可用端口正常；占用/竞争不附着或清理外部Chrome；清理仅本次进程
- [ ] 终止连接明确拒绝，剩余视图不伪称已测；原T113失败原因不被TypeError掩盖
- [ ] 自动回归检出已知坏实现；相关测试、typecheck、必要完整检查及不同Astra审核有本候选证据
- [ ] AGENTS等living docs同步，原站和旧证据不变；T118仍独立完成真实恢复

## Resolution

INCOMPLETE：候选已冻结，待新独立Astra及主控完整检查。仅改scripts/check-published.mjs、T113 collector测试并新增T119真实CLI回归；默认动态端口、自有child/profile/endpoint绑定，显式端口占用与竞争拒绝，清理仅自有句柄；连接关闭/error拒绝pending与后续send，余下视图not_run。T113先核真实CLI失败及缺测，再访问credits，原采集断言不减。

报告 `artifacts/t119/browser-ownership/REPORT.md`、FREEZE.json、candidate.patch保存候选。未修collector的10:43:30–10:43:31Z原生sentinel记录有外部3个target业务红；不是fixture报错或exit1代替归属反例。修后10:53:22–10:53:50Z `node --test --experimental-strip-types tests/t119-published-browser-ownership.test.ts` 6/6；真实动态/显式端口均有中英三档原生图，占用/竞争不附着sentinel，pending/非OPEN socket和自有Chrome退出及时停止，外部target保留。green-1的SKU/contrast预期错误及原件保留，后改为独立输入公司名断言，不改paint/glyph/fact门。

10:55:20–10:55:24Z typecheck单次exit0；10:55:20–10:56:26Z原隔离T117文件单次13/13。主控把3文件与candidate/green-2-source逐字节核对，绑定 `artifacts/integration/20261007-t119-browser-ownership/binding.json`，AGENTS已同步实际归属规则和自动回归入口。14张T119原生PNG作者自查不作独立审美PASS。

原497秒/8次createTarget超时因果仍UNKNOWN，原红不改写。T113原三站复验、新独立审核、必要full/build与本票关闭尚未完成，未推送；原站恢复仍由T118在后续工程门通过后单独安排。
