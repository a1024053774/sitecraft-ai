---
id: T-204
title: 部署到 1 核 1GB VPS（luckye.online 子域名）
type: build
status: open
blocked_by: [T-201, T-202]
claimed_by: 执行主控
supersedes:
---

2026-10-20 已确认的部署事实：

- **VPS**：`root@107.173.155.71`，用本机密钥登录。走 Tailscale（sanjose）会在握手时被断开，所以直接连公网 IP。
  - 系统 Ubuntu 24.04，1 核，961MB 内存，已有 1GB 交换内存。
- **已有服务，部署时不得改动**：
  - 443 端口被负责人的代理 xray（x-ui）占用；
  - nginx 只监听 80 端口，原托管 `enchanted.luckye.online`；该站已按负责人要求于 2026-10-20 停用（见 Resolution）。
- **域名与接入**：负责人选择 Cloudflare Tunnel，全程加密，不占端口。
  - 子域名用 `sitecraft.luckye.online`（产品页）和 `sitecraftapp.luckye.online`（建站网站）。负责人已加了两条灰云 A 记录，改走 tunnel 后由 tunnel 的 CNAME 取代。
  - tunnel 的安装命令里带有凭据，由负责人自己在 VPS 上运行。

## What to build

1. **地址**：产品页与建站网站各用一个子域名，即 `sitecraft.luckye.online` 和 `sitecraftapp.luckye.online`，经 Cloudflare Tunnel 接到本机 nginx 的 80 端口；nginx 按 server_name 区分，托管静态产品页并反向代理应用。
2. **小内存适配**：
   - 应用用生产构建运行，配 2GB 交换内存；
   - 生成与检查并发为 1，无头 Chrome 用完即关；
   - 在 VPS 上实测一次完整生成，确认不会因内存不足退出；
   - 测试时使用负责人自己的 key，经浏览器配置填入，不写进服务器。
3. **服务器不持久化**：服务器不保存 key 和站点数据，日志关闭请求体记录。
4. **所需信息**：VPS 的 SSH 地址、登录方式与 DNS 由负责人提供。没有拿到之前，只准备部署脚本和说明，不连服务器。

## Acceptance

- [ ] 两个子域名经 HTTPS 可访问；VPS 上完成一次完整生成
- [ ] 服务器上没有 key 和站点数据

## Resolution

2026-10-20（纽约时间晚上，VPS 时间 10-21 03:00 前后 UTC）安装进展，T-204 仍开着，两项验收都没勾：

- **安装**：执行主控用 `bash /tmp/sitecraft-deploy/deploy/vps/install.sh family-kit-assembly` 装好。
  - 前两次停在 Chrome 解压：VPS 没有 `unzip`，失败后留下空的版本目录，安装器不肯覆盖。已修：9441e78 重装前清空下载目录，cfc239c 在 apt 中加 `unzip`。
  - 第三次（cfc239c）跑通，构建 78 秒。过程中可用内存最低 548MB，交换内存最多用 64MB，无抖动，xray 始终监听 443。
  - 本机 `curl -H Host` 复查：产品页 200，建站网站 200，`/published/x` 404；x-ui、nginx、sitecraft-app 均 active；sitecraft-app 约 80MB；应用目录只有 `.env.example`。
- **停用 enchanted**：负责人要求从 VPS 撤下（改用 GitHub Pages）。
  - `conf.d/enchanted.conf` 改名为 `enchanted.conf.disabled`，`/var/www/enchanted` 保留。
  - ea3ff56 在 `sitecraft.conf` 加 `default_server` 返回 444。现在 enchanted 与其他未登记 Host 直接断开，两个 SiteCraft 主机名仍 200，xray 不变。
  - 回退：改回 `enchanted.conf`，再 `nginx -t` 并 reload。
- **构思主控按负责人要求直接在 VPS 上做的两件事**：
  - 从 Cloudflare 官方 apt 源（pkg.cloudflare.com）装了 cloudflared 2026.10.2，只装软件。tunnel 由负责人用自己的 token 运行 `cloudflared service install`，凭据我们不碰。
  - 装了 fail2ban，配置在 `/etc/fail2ban/jail.d/sshd-local.conf`：
    - maxretry 5，findtime 10m，bantime 1h，递增，最长 1w；
    - ignoreip 含 127.0.0.1/8、::1、100.64.0.0/10 与负责人当前公网 IP 112.65.124.246；
    - Ubuntu 24.04 的 SSH 单元是 `ssh.service`，默认的 `sshd.service` 读不到日志，所以显式设 `journalmatch = _SYSTEMD_UNIT=ssh.service + _COMM=sshd`。
    - 已核对生效，封了 5 个暴力破解地址；x-ui、nginx、sitecraft-app 仍 active，xray 仍在 443。
  - SSH 密码登录未关。
- **未完成**：负责人建好 tunnel 后，在浏览器填负责人的 key，于 `https://sitecraftapp.luckye.online` 完成一次真实生成，并检查服务器上没有 key 和站点数据，再勾验收、关票。
