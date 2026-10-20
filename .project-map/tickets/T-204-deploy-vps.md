---
id: T-204
title: 部署到 1 核 1GB VPS（luckye.online 子域名）
type: build
status: open
blocked_by: [T-201, T-202]
claimed_by:
supersedes:
---

2026-10-20 已确认的部署事实：

- **VPS**：`root@107.173.155.71`，用本机密钥登录。走 Tailscale（sanjose）会在握手时被断开，所以直接连公网 IP。
  - 系统 Ubuntu 24.04，1 核，961MB 内存，已有 1GB 交换内存。
- **已有服务，部署时不得改动**：
  - 443 端口被负责人的代理 xray（x-ui）占用；
  - nginx 只监听 80 端口，已托管 `enchanted.luckye.online`（配置在 conf.d/enchanted.conf）。
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
