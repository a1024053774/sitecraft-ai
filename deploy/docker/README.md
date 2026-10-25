# Windows 本机运行

本目录用于负责人的 Windows Docker Desktop（Linux 容器）。源码部署在 `D:\sitecraft-ai`，Mac 只改代码和查看结果，构建与 Chrome 验收均在 Windows 执行。默认地址为 `http://localhost:3100`，仅绑定回环；远程访问可通过 `ssh -L 3218:127.0.0.1:3100 win-lan` 转发。

## 启动与停止

在 Windows PowerShell 中进入源码目录。第一次启动前，在该目录新建 gitignore 的 `.env`，只设置数据库密码与可选端口：

```dotenv
POSTGRES_PASSWORD=填写足够长的随机字母数字密码
SITECRAFT_PORT=3100
```

数据库密码用于数据库连接 URL，使用字母、数字或 `-`、`_`，不要直接写 URL 特殊字符。模型 key 不写在这个文件里；打开工作区设置，填写自己的 API 地址、key 与模型名。

```powershell
docker compose up -d --build
docker compose ps
docker compose logs --tail 80 web
# 停止；命名卷和站点保留
docker compose stop
# 再次启动
docker compose up -d
```

Docker Desktop 须保持运行。Compose 的 `restart: unless-stopped` 会在 Docker 引擎重启后恢复此前运行的服务；主动 stop 的服务不会自行启动。不使用 `down -v`、卷清理或全局 prune。

经 SSH 构建时，当前 Windows 登录会话无法使用桌面凭据助手。本次只为该项目创建了无凭据的 `.docker-cli/config.json`，内容为 `{"auths":{"https://index.docker.io/v1/":{}}}`。在同一 PowerShell 会话先设 `$env:DOCKER_CONFIG='D:\sitecraft-ai\.docker-cli'` 和 `$env:DOCKER_HOST='npipe:////./pipe/dockerDesktopLinuxEngine'`，再执行上述命令；没有改动用户全局 Docker 配置。

## 数据与 key

- `sitecraft_sitecraft_pg`：PostgreSQL 的对话、对齐状态和批注。
- `sitecraft_sitecraft_data`：`/app/data`，保存站点代码、完整版本、资料、模型任务记录与上传。
- 浏览器：模型接口设置及尚未发送的批注草稿；生产服务只在本次请求和后台任务内存里使用 key，不读服务端模型 key 环境变量。
- `SITE_STORE=postgres` 复用现有 PostgreSQL 与文件存储分工。它不是 T-202 的浏览器站点存储模式；T-202 模式仍可按仓库 README 单独运行。
- 仅 web 的 3100 端口对 Windows 回环开放；数据库只在 Compose 网络中使用，不暴露宿主 5432。

## 更新与备份

更新源码时保留 Windows 的 `.env`，再执行 `docker compose up -d --build`。构建成功才替换运行容器；不要先删除卷。

一致备份先停止 web，阻止跨文件和数据库的新写入，再导出数据库与文件目录。将下列 `<备份目录>` 替换为新的空目录：

```powershell
docker compose stop web
docker compose exec -T postgres pg_dump -U sitecraft -d sitecraft -f /tmp/sitecraft-backup.sql
docker compose cp postgres:/tmp/sitecraft-backup.sql <备份目录>/postgres.sql
docker compose cp web:/app/data <备份目录>/data
docker compose start web
```

浏览器接口设置和未发送草稿不在服务器备份里。恢复时先保留当前卷的备份，在停止 web 的状态下将 SQL 导入空数据库，并将配套 data 目录恢复到文件卷；两部分必须来自同一次备份。

## 镜像与 Chrome

Node 22 Debian slim 多阶段构建，运行层使用 Next standalone 输出、静态文件、运行时 skills 和 Chrome，不带 TypeScript 编译器、测试或构建缓存。每次容器启动先通过真实 CDP 会话验证 Chrome，失败即退出；健康检查另外核对应用与数据库，不以访客尚未填写 key 判定服务故障。

Chrome 使用 [Google 官方 Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/) 的 `chrome-headless-shell` 156.0.8078.47。容器以 node 用户运行，保留 Chrome 沙箱和容器 syscall 过滤，不使用 `--no-sandbox`、privileged 或 SYS_ADMIN。

`chrome-seccomp.json` 原样取自 [Microsoft Playwright v1.64.0](https://github.com/microsoft/playwright/blob/v1.64.0/utils/docker/seccomp_profile.json)，按其[官方 Docker 文档](https://playwright.dev/docs/docker)放行用户命名空间所需的 clone、setns、unshare；Apache-2.0 许可保存在 `LICENSE.playwright`。它只应用于本 Compose 的 web 容器。Windows Docker 默认配置的命名空间探测被拒，使用该 profile 后实际通过；它不是关闭过滤的 unconfined 配置。
