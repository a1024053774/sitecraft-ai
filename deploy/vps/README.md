# SiteCraft 单机部署（T-204、T-207）

目标机器：负责人的 VPS `107.173.155.71`（Ubuntu 24.04，1 核，约 1GB 内存）。部署时**不得改动**已有的 xray／x-ui 代理（占用 443）。原来的 `enchanted.luckye.online` 已按负责人要求于 2026-10-20 停用（改由 GitHub Pages 托管），nginx 配置改名为 `conf.d/enchanted.conf.disabled`，`/var/www/enchanted` 保留未删。

T-206 起公网只放静态页面：1 核机器上一次局部修改的检查会超时（T-208），真实建站改到本机运行。

```
访客 ──HTTPS──▶ Cloudflare ──Tunnel──▶ cloudflared（VPS） ──▶ nginx :80
                                                      ├─ sitecraft.luckye.online    → /opt/sitecraft/landing（静态产品页）
                                                      └─ sitecraftapp.luckye.online → /opt/sitecraft/demo（静态工作台演示）
```

## Cloudflare Tunnel（负责人已配置，含凭据，执行主控不经手）

- VPS 上的 cloudflared（2026.10.2，来自官方 apt 源 pkg.cloudflare.com）由负责人用 `cloudflared service install <token>` 接入 Cloudflare Zero Trust 的 tunnel。
- tunnel 有两条 Public Hostname，服务都是 `HTTP` 和 `localhost:80`：`sitecraft.luckye.online`、`sitecraftapp.luckye.online`；两个子域名由 tunnel 生成的 CNAME 指向，不再有灰云 A 记录。

## 安装或更新（root，在 VPS 上）

```bash
rm -rf /tmp/sitecraft-deploy
git clone -q -b family-kit-assembly https://github.com/a1024053774/sitecraft-ai.git /tmp/sitecraft-deploy
bash /tmp/sitecraft-deploy/deploy/vps/install.sh
```

`install.sh` 可以重复运行，只用这份检出，按顺序做这些事：
- 把 `landing/` 复制到 `/opt/sitecraft/landing`，把 `BUILDER_URL` 替换成 `https://sitecraftapp.luckye.online`；把 `demo/` 复制到 `/opt/sitecraft/demo`。都先复制到新目录再整体换入，上一版留在 `*.old`。
- 停止并禁用 `sitecraft-app`（只停不删），并更新它的单元文件。
- 安装 nginx 配置：`nginx -t` 不通过就删除这份配置，不重载；重载后等旧 worker 退出再做冒烟检查，15 秒内未退出则报错。
- 经 nginx 做冒烟检查：产品页、演示首页、演示步骤表、演示里的站点包、建站接口（应为 404），以及未登记的主机名被直接断开（nginx 默认站点返回 444，curl 状态 000、退出码 52）。接口或未知主机不符合预期时退出失败。

它不启动 Node 或 Chrome，不构建，不改交换内存。

## 已停用的建站服务

T-204 装好的建站服务保留在机器上，但不运行：
- `/opt/sitecraft/app`（源码与构建）、`/opt/sitecraft/node`、`/opt/sitecraft/chrome*`、`/etc/apparmor.d/sitecraft-chrome`、`/swapfile-sitecraft`。
- `sitecraft-app.service`：inactive、disabled。

重新启用需要先确认机器能撑住检查（见 T-208），再用 T-204 版本的安装脚本（`git show dadc130:deploy/vps/install.sh`）重新构建并启用；那一版的运行约束（内存盘数据根、单队列、`MemoryHigh=700M`、nginx 限流与只收本机 tunnel 连接）写在同一提交的这份 README 里。

## 运行约束

- **nginx**（`/etc/nginx/conf.d/sitecraft.conf`）：
  - 两个主机名都只提供静态文件，只信任本机 tunnel 传来的 `CF-Connecting-IP`。
  - 静态响应带 `Cache-Control: no-transform`，防止 Cloudflare 改写示例邮箱并注入在沙箱预览中无法执行的解码脚本。
  - 访问日志只记 IP、时间、方法、路径（不含查询参数）、状态、字节数和耗时，不记请求头与请求体。
- **服务器上没有**：模型 key、`.env.local`、站点数据。演示不调用模型，所有画面和站点包都是静态文件。
- **SSH 防护**：fail2ban 配置在 `/etc/fail2ban/jail.d/sshd-local.conf`。
  - 规则：10 分钟内失败 5 次封 1 小时，再犯递增，最长 1 周。
  - 白名单：本机、Tailscale 网段 100.64.0.0/10，以及负责人的公网 IP。
  - Ubuntu 24.04 的 SSH 单元是 `ssh.service`，所以显式设了 `journalmatch = _SYSTEMD_UNIT=ssh.service + _COMM=sshd`。
  - SSH 密码登录仍然开着。

## 演示从哪里来

`demo/` 是工作台真实界面的定格画面：`scripts/t207-build-demo-stages.mjs` 从一次真实生成的站点记录截出各阶段，`scripts/t207-capture-demo.mjs` 用无模型的本地服务打开这些阶段，逐步操作后保存为静态 HTML，并附上该站真实导出的站点包。重新截取的命令写在 T-207 的 Resolution 里。

仓库的演示素材包含 T-209 通过检查的真实英文页及中英文站点包。可在已有演示副本上给截取脚本追加 `english` 参数，只更新英文及后续步骤；证据和精确命令见 T-209 Resolution。演示播放器 `demo/index.html` 按舞台实际尺寸选择 1440／768／375 截图；舞台不足 640px 高时把画面保持 720px 高并允许竖向滚动，每步把高亮控件滚进可视区（固定定位的批注面板会上移）。顶部有步骤目录、进度条，支持左右方向键。

VPS 当前仍是 T-207 的部署，仓库里的英文页、播放器交互和产品页更新尚未上线。
