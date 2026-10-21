---
id: T-204
title: 部署到 1 核 1GB VPS（luckye.online 子域名）
type: build
status: closed
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

- [x] 两个子域名经 HTTPS 可访问；VPS 上完成一次完整生成
- [x] 服务器上没有 key 和站点数据

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
- **第一次真实生成卡住（2026-10-21 04:24–04:33 UTC）**：负责人在自己的 Chrome 里填好 key，执行主控接手，用「资料 → 模拟纸包装包」走对齐和确认。
  - 写稿完成：DeepSeek 用时 138.5 秒，共 53,758 token（输出 42,288，其中思考 33,822）。
  - 之后停在「清理资源，检查事实与三档页面布局」，run 一直是 running，没有版本。期间可用内存最低 489MB，xray 一直在。
  - 根因一：VPS 设了 `kernel.apparmor_restrict_unprivileged_userns=1`，sitecraft 用户起 chrome-headless-shell 报「No usable sandbox」，以 SIGTRAP 崩溃。
  - 根因二：`lib/code-site-browser.ts` 用 `exitCode` 判断 Chrome 是否退出，被信号杀死的进程 exitCode 为 null；`close()` 又去等早已发生的 exit 事件，任务永久挂起，并占住并发为 1 的队列。
  - 处理：负责人决定重启 sitecraft-app 释放队列（服务器副本清空，浏览器存档保留）。代码改为按 exit 事件判断；沙箱选 b1，只给这一个二进制写 AppArmor 配置，放行 userns。
- **成对测试**：`tests/t204-check-browser-exit.test.ts` 用一个启动即 `kill -TRAP` 自身的假 CHROME_PATH。
  - 旧代码：`npm test -- tests/t204-check-browser-exit.test.ts` 失败，actual 为 `hung`（20 秒内未返回），证据在 `artifacts/t167/test-run-1792557765760-19680`。测试改用独立 TMPDIR 后在旧代码上复跑，仍为 `hung`，见 `test-run-1792557861226-20890`。
  - 新代码：约 1 秒报「Chrome 在检查开始前退出」，配置目录清理干净。与 t173-port-readiness、t166-check-origin 一起 18/18 通过，见 `test-run-1792557847083-20648`。
  - 其他起子进程的地方：运行时只有这一处起 Chrome。`scripts/render-shader-backdrops.mjs` 及若干开发脚本和测试有同样的 exitCode 写法，都是本机离线工具，不在线上路径，这次不改。
- **AppArmor**：写入前 `/etc/apparmor.d` 有 110 项，已加载 118 个 profile、23 个 enforce，原状记录在 `artifacts/t204/vps-apparmor-before.txt`。
  - 新增的 `/etc/apparmor.d/sitecraft-chrome` 写法同 Ubuntu 自带的 chrome profile：路径 `/opt/sitecraft/chrome-dl/**/chrome-headless-shell`，`flags=(unconfined)`，只有 `userns,`。
  - 不改内核开关，不碰其他 profile。
  - install.sh 在停服和构建之前以 sitecraft 用户开着沙箱真实启动一次 Chrome，起不来即非零退出。未写配置时在 VPS 上运行同一段探测，判为「does not start」。
- **VPS 更新到 8f8206d（04:50 前后 UTC）**：
  - Chrome 以 sitecraft 用户、开着沙箱启动成功；aa-status 显示 119 个 profile，比原来多了 sitecraft-chrome，enforce 仍为 23；内核开关仍是 1。
  - xray 在 443，冒烟检查全部通过。
- **重跑时的操作失误**：在中断后的旧站点上，执行主控照提示发了一句「按已保存的页面大纲生成网站。」，这句话覆盖了没有版本的站点的资料，那次运行作废，由构思主控重启服务中止。这个产品问题记在 T-205。
- **第二次真实生成（新站 342ed662，2026-10-21 04:57:05–05:00:05 UTC），PASS**：
  - 资料：模拟纸包装包，1921 字。风格「帮我选」→ 精密工程，大纲三页。
  - 结果：版本 1 一次通过底线检查，修正 0 轮，16 条资料出处。
  - 写稿 118.6 秒，49,614 token（输入 11,445，输出 38,169，其中思考 29,727）；事实核对 51.6 秒，26,683 token。
  - 期间可用内存最低 343MB，交换内存不超过 114MB，xray 一直在，没有 OOM。
- **刷新恢复，PASS**：重新载入后读回版本 1、三页，预览 h1 为「青禾纸包装」。
- **站点包，PASS**：在页面内请求 `/export`，返回 200 application/zip，29,164 字节。条目为 index.html、products.html、sampling.html、styles.css、LICENSES.txt，没有资料、对话或密钥文件。
- **服务器扫描，PASS**（只读，按 `sk-` 加 20 位以上字符搜）：
  - `/dev/shm` 副本、sitecraft-app journal 和 nginx 四个日志都是 0 命中；nginx 日志也没有记下 x-sitecraft-provider。
  - `/opt/sitecraft`（不含 node_modules 和 cache）唯一命中是 Chrome 自带的 `locales/nl.pak` 二进制，属于误报。
  - 站点数据只在 `/dev/shm`，`/tmp` 没有残留检查目录，应用目录只有 `.env.example`。
- **局部修改与撤销：在 1 核机器上没通过（已知问题）**：
  - 操作：批注选中首页「接单提醒」块，要求「把这一块的标题「接单提醒」改成「接单范围」，正文保持不变」。共试 3 次，模型 2.3–4.6 秒就返回合规的 submit_local_edit，随后提交入口都报「局部动态状态检查超时，本次未保存版本」，如实拒收。撤销需要两个版本，所以没法测。
  - 量化：第 3 次临时开了 `SITECRAFT_CHECK_DIAGNOSTICS_DIR`，用后已撤。诊断和每秒采样存在 `artifacts/t204/diag-local-edit-20261021/`。
    - 只跑到 375 档：可聚焦元素 8 个，每侧 33 次完整读取，合计 66 次，预算 20.8 秒。
    - 两侧并行各跑 19.8 秒，只完成约 2/3，其中 styleRead 占 18.3–18.5 秒。
    - 单核上折合约 0.42 秒/次，公式按 0.30 秒算。
    - 期间 CPU 满载，有 16 个 Chrome 进程，可用内存最低 213MB。
  - 处理：按 T-206，公网不再运行真实建站，检查时限和规则都不改；局部修改与撤销改到 T-208 本机部署上验收。
- **关票**：两项验收按上面的证据勾选，局部修改与撤销作为已知问题转给 T-208。VPS 上 sitecraft-app 的停用和演示在 T-207 做。
