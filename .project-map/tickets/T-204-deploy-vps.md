---
id: T-204
title: 部署到 1 核 1GB VPS（luckye.online 子域名）
type: build
status: open
blocked_by: [T-201, T-202]
claimed_by:
supersedes:
---

## What to build

1. **地址**：产品页与建站网站各用一个子域名，例如 `sitecraft.luckye.online` 和 `app.sitecraft.luckye.online`，最终名字由负责人确认。nginx 托管静态产品页并反向代理应用，HTTPS 用 Let's Encrypt。
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
