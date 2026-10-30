---
id: T-211
title: 配置 Windows Tailscale 私有入口并推送 GitHub
type: build
status: closed
blocked_by: []
claimed_by: Codex → Claude
supersedes:
---

## What to build

2026-10-28 负责人要求出门通过 Tailscale 使用已部署的 Windows 服务，并推送 GitHub。本票只配置现有 Tailscale Serve 的后台 HTTPS 反向代理、提供桌面入口和更新运行说明；保留 Windows 回环端口与 Mac 原 13100 映射。不重建应用、不调用模型、不修改网络代理或其他服务，不启用公网 Funnel。

**REALITY GATE: PASS（方向）**。observed：Windows Tailscale 1.102.2 为 Running，已有 HTTPS 域名，Serve 配置为空；SiteCraft 在回环 3100 健康，SSH 会话有配置权限。verified：官方 Serve CLI 文档及安装版本 help 均支持 `--bg --https=443` 代理到回环 HTTP；后台配置在会话结束后继续运行。unknown：Mac 到新入口的真实 TLS、资源和应用读取是否通过，必须以实际访问验收，不能拿 Windows 回环成功代替。

**Tracer bullet**：配置一条 HTTPS → 已有 3100 的真实链路后，从 Mac 验证远端域名，再在 Windows Chrome 验证工作台。**Deep modules**：沿用 Tailscale 自带代理与应用原 API，不新增代理进程或应用入口。**Ubiquitous language**：称为「Tailscale 私有入口」；模型设置仍按浏览器来源分别保存。

## Acceptance

- [x] Windows Serve 后台 HTTPS 仅在 tailnet 提供服务，原 3100、13100 与数据保留
- [x] Mac 经 Tailscale 访问健康／工作台（2026-10-29 改走 Tailscale IP 的 SSH 映射，见 Resolution）；Windows 实际 Chrome 打开页面与已有站点
- [x] 桌面提供新入口，说明 Windows／Docker／Tailscale 运行条件与新来源的模型设置
- [x] 只推送 origin 当前已验收分支，不 force、不推 upstream，不混入用户脏文件，并核对远端 SHA
- [x] 更新运行说明、保留验收结果，清理本轮临时文件

## Resolution

2026-10-28 03:35 EDT，基于 aad8e295，状态 **INCOMPLETE**（Mac 链路受本机代理阻断，其余完成；负责人调整代理并复验 Mac 后关闭）。证据在 gitignore 的 `artifacts/t211/`（Mac）与 Windows `D:\sitecraft-ai\artifacts\t211\`。

- Windows：`tailscale serve --bg --https=443 --yes http://127.0.0.1:3100`；`serve status` 为 `https://luckye-1.tail5e6162.ts.net (tailnet only)`，前后配置存为 serve-before/after.json。Windows 经该域名 HTTPS 访问 `/api/health` 200 ready、工作台 200；回环 3100 与 Mac `localhost:13100` 仍 ready；服务未重建。
- Windows Chrome（headless，独立临时配置，用后删除）1440 打开 `/workspace?site=fcfe331e…`：博思站 v3、四个页面与 34 条资料出处正常显示，截图 `workspace-1440.png` 已查看。
- Mac：Tailscale 运行且 `tailscale ping` 通（12–35ms），但 TCP 443 超时。根因在本机代理：`*.ts.net` 被解析为 fake-ip `198.18.3.82`，且路由表有 `100.64/10 → 192.168.3.1 (en0)` 非限定路由压过 Tailscale 的 utun5。按 AGENTS.md 不改本机网络／代理，交负责人在代理中让 `*.ts.net` 与 `100.64.0.0/10` 走 Tailscale 后用桌面入口复验。
- 桌面新增 `打开 SiteCraft（Tailscale）.command`（健康检查后打开，失败给出排查提示）；`deploy/docker/README.md` 增「Tailscale 私有入口」节。

2026-10-29 复验，**PASS**。负责人从 Shadowrocket 的 `tun-excluded-routes` 删去 `100.64.0.0/10` 后，Mac 路由表的 `100.64/10` 只剩 Tailscale utun5；但 Shadowrocket DNS 对 `*.ts.net` 返回 NXDOMAIN（`dig @100.100.100.100` 正常），HTTPS 域名在 Mac 上仍不可用。不再改代理，桌面入口改为局域网优先、失败后经 Tailscale IP `100.108.230.79` 建同一 SSH 映射（`HostKeyAlias` 沿用 win-lan 主机密钥），两路都开 `localhost:13100`，模型设置共用。`artifacts/t211/launcher-paths.log`：局域网直连 0s 成功；局域网不可达时 5s 转 Tailscale 成功、health 200；两路都不通 15s 报错退出。经 Tailscale 映射打开博思站工作台，v3、四页与 34 条出处正常（`mac-tailscale-workspace.jpg` 已查看）。测试后映射已恢复为局域网。HTTPS Serve 入口保留供其他设备使用。
