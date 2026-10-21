# SiteCraft 单机部署（T-204）

目标机器：负责人的 VPS `107.173.155.71`（Ubuntu 24.04，1 核，约 1GB 内存）。部署时**不得改动**已有的 xray／x-ui 代理（占用 443）。原来的 `enchanted.luckye.online` 已按负责人要求于 2026-10-20 停用（改由 GitHub Pages 托管），nginx 配置改名为 `conf.d/enchanted.conf.disabled`，`/var/www/enchanted` 保留未删。

```
访客 ──HTTPS──▶ Cloudflare ──Tunnel──▶ cloudflared（VPS） ──▶ nginx :80
                                                      ├─ sitecraft.luckye.online    → /opt/sitecraft/landing（静态产品页）
                                                      └─ sitecraftapp.luckye.online → 127.0.0.1:3100（建站网站，SITE_STORE=browser）
```

## 负责人要做的（含凭据，执行主控不经手）

1. 在 Cloudflare Zero Trust 建一个 tunnel，在 VPS 上运行它给出的 `cloudflared service install <token>`。cloudflared（2026.10.2，来自官方 apt 源 pkg.cloudflare.com）已经装好，只差这一步。
2. 给这个 tunnel 加两条 Public Hostname，服务都填 `HTTP` 和 `localhost:80`：
   - `sitecraft.luckye.online`
   - `sitecraftapp.luckye.online`
3. 删除这两个子域名原来的灰云 A 记录，由 tunnel 自动生成的 CNAME 取代。

## 安装或更新（root，在 VPS 上）

```bash
git clone https://github.com/a1024053774/sitecraft-ai.git /tmp/sitecraft-deploy   # 只取部署脚本
bash /tmp/sitecraft-deploy/deploy/vps/install.sh family-kit-assembly
```

`install.sh` 可以重复运行，按顺序做这些事：
- 交换内存补到 2GB（另加 `/swapfile-sitecraft`）。
- 安装 Chrome 依赖和中文字体（底线检查要测量中文排版）。
- 把 Node 22 LTS 装到 `/opt/sitecraft/node`，安装包按官方 SHASUMS256 校验。
- 把源码检出到 `/opt/sitecraft/app`。如果那里存在 `.env.local` 就拒绝继续，因为服务器不能持有 key。
- 安装 chrome-headless-shell。
- 用 `SITE_STORE=browser` 构建。
- 把 `landing/` 复制到 `/opt/sitecraft/landing`，并把 `BUILDER_URL` 替换成 `https://sitecraftapp.luckye.online`。
- 安装 nginx 配置：`nginx -t` 不通过就删除这份配置，不重载。
- 启用 `sitecraft-app` 服务，最后经 nginx 做冒烟检查：产品页、建站网站、发布链接（应为 404），以及未登记的主机名被直接断开（nginx 默认站点返回 444）。

## 运行约束

- **建站网站**（`sitecraft-app.service`）：
  - 运行身份是 `sitecraft` 用户，监听 `127.0.0.1:3100`。
  - 数据根为 `/dev/shm/sitecraft-server-copy`（内存盘）：每次启动清空，闲置 30 分钟清理，总量上限 128MB。
  - 生成与检查共用一个队列，并发为 1，最多 3 个等待；每次检查单独启动无头 Chrome，用完即关。
  - `MemoryHigh=700M`，`OOMScoreAdjust=500`：内存紧张时先让它让出资源，不连累负责人的其他服务。
- **nginx**（`/etc/nginx/conf.d/sitecraft.conf`）：
  - 只信任本机 tunnel 传来的 `CF-Connecting-IP`。
  - 建站网站只接受来自本机 tunnel 的连接，外部直连返回 403，避免 key 以明文 HTTP 传输。
  - 按 IP 限流：整个 API 每秒 2 次、突发 40 次，足够覆盖每 2 秒一次的进度轮询；hydrate、撤销／恢复、手改每分钟 10 次、突发 10 次。
  - `client_max_body_size 29m`，与 hydrate 的 20MB 上限（base64 后约多三分之一）一致。
  - 访问日志只记 IP、时间、方法、路径（不含查询参数）、状态、字节数和耗时，不记请求头与请求体。
- **服务器上没有**：模型 key、`.env.local`、长期站点数据。
- **SSH 防护**：fail2ban 配置在 `/etc/fail2ban/jail.d/sshd-local.conf`。
  - 规则：10 分钟内失败 5 次封 1 小时，再犯递增，最长 1 周。
  - 白名单：本机、Tailscale 网段 100.64.0.0/10，以及负责人的公网 IP。
  - Ubuntu 24.04 的 SSH 单元是 `ssh.service`，所以显式设了 `journalmatch = _SYSTEMD_UNIT=ssh.service + _COMM=sshd`。
  - SSH 密码登录仍然开着。

## 验收（T-204）

用负责人的 key，在浏览器设置里填写，不写进服务器，在 `https://sitecraftapp.luckye.online` 完成一次完整生成。同时观察 `free -m` 和 `journalctl -u sitecraft-app`，确认没有因内存不足退出。之后检查服务器：`grep -r` 搜不到 key，`/dev/shm/sitecraft-server-copy` 之外没有站点数据。
