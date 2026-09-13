# 生产鉴权面盘点：strict 态下**哪些路由、哪些前端调用**会 401

> 2026-09-13。**只读盘点，不含任何代码改动。**
> 起因：0.5（队列 B2）给两个模板 POST 写端到端测试时，发现"不带访问头 + strict → 401"。
> 用户裁决（2026-09-13）：先穷举缺陷面——是"这两个路由"，还是"前端所有写操作"。

## 一、判定规则（单一来源）

`lib/request-context.ts:77-81` 的 `configuredMode()`：

```text
显式 SITECRAFT_ACCESS_MODE → 用它
否则 NODE_ENV === "development" → relaxed
否则 → strict
```

`lib/request-context.ts:97`：strict 下 **workspace / actor / role 三头缺任一 → 401**
（`access_context_required`）。

`authorizeRequest(request, "public")`（`:118-127`）**提前返回**，不读这三个头——
所以公开路由与完全不调 `authorizeRequest` 的路由**不受 strict 影响**。

**前端发不发这三个头**（决定成败）：

```bash
grep -rln "sitecraft-workspace-id" app components   # → 0 处
grep -rln "sitecraft-actor-id" --include=*.ts --include=*.tsx app components lib \
  # → 只有 from-url / from-screenshot 两个 route（转发用），前端 0 处
ls middleware.ts                                    # → 不存在（无网关注入）
ls lib/api-client* components/api*                  # → 不存在（无中央 fetch 封装）
```

→ **前端一个头都不发，也没有任何中间层替它发。**

## 二、全部 23 个路由 × 权限（逐方法，派生自源码）

| 路由 | 方法 → 权限 | strict 下前端调用 |
|---|---|---|
| `ai/status` | GET（**无鉴权**） | ✅ 可用 |
| `health` | GET（**无鉴权**） | ✅ 可用 |
| `product-images` | POST（**无鉴权**） | ✅ 可用 |
| `product-images/[file]` | GET（**无鉴权**） | ✅ 可用 |
| `public/[siteKey]` | GET（**无鉴权**） | ✅ 可用 |
| `public/[siteKey]/leads` | POST（**无鉴权**） | ✅ 可用 |
| `templates/[templateId]/assets/[...]` | GET（**无鉴权**） | ✅ 可用 |
| `templates/[templateId]/preview` | GET（**无鉴权**） | ✅ 可用 |
| `templates/runtime` | GET → read | ❌ **401** |
| `sites` | GET → read | ❌ **401** |
| `sites` | POST → edit | ❌ **401** |
| `sites/[siteId]/draft` | GET → read | ❌ **401** |
| `sites/[siteId]/draft` | PUT / PATCH → edit | ❌ **401** |
| `sites/[siteId]/generate` | POST → generate | ❌ **401** |
| `sites/[siteId]/chat` | POST → chat | ❌ **401** |
| `sites/[siteId]/history/[action]` | POST → edit | ❌ **401** |
| `sites/[siteId]/publish` | GET → read | ❌ **401** |
| `sites/[siteId]/publish` | POST → publish | ❌ **401** |
| `sites/[siteId]/releases` | GET → read | ❌ **401** |
| `sites/[siteId]/releases/[releaseId]/rollback` | POST → rollback | ❌ **401** |
| `generation-records` | GET → read | ❌ **401** |
| `leads` | GET → leads:read | ❌ **401** |
| `leads/[leadId]` | PATCH → leads:write | ❌ **401** |
| `templates/from-url` | POST → edit | ❌ **401** |
| `templates/from-screenshot` | POST → edit | ❌ **401** |
| `templates/runtime` | POST / DELETE → edit | ❌ **401** |

**合计 8 个读端点 + 14 个写端点 = 22 个「端点 × 方法」在生产 strict 下必然 401。**

## 三、前端调用点 → 判定（逐调用点，非抽样）

| 前端文件 | 调用 | 生产 strict |
|---|---|---|
| `app/page.tsx:83` | GET `/api/sites` | ❌ 401 |
| `app/templates/page.tsx:68,133` | GET `/api/templates/runtime`、POST `/api/sites` | ❌ 401 |
| `app/generate/page.tsx:301,377,560,585,591,749` | 6 处（draft / generate / sites） | ❌ 401 |
| `app/workspace/page.tsx:272,281,316,325,396,542,578,621,742,917,942,958,966,994,1009,1033,1135` | 17 处（draft / publish / generate / chat / history / releases / runtime） | ❌ 401 |
| `app/leads/page.tsx:55,70` | GET `/api/leads`、PATCH `/api/leads/:id` | ❌ 401 |
| `app/content/page.tsx:19`、`app/export/[siteId]/page.tsx:24` | GET draft | ❌ 401 |
| `components/client-preview-frame.tsx:28` | GET draft | ❌ 401 |
| `components/generation-health-panel.tsx:19` | GET `/api/generation-records` | ❌ 401 |
| `components/app-sidebar.tsx:64` | GET `/api/leads` | ❌ 401 |
| `components/start-site-button.tsx:51` | POST `/api/sites` | ❌ 401 |
| `components/create-template-dialog.tsx:73,91,103,192,126` | pending-jobs / **from-\*** / product-images | ❌ 401（除 `product-images` ✅） |
| `app/workspace/page.tsx:360` | GET `/api/ai/status` | ✅ 可用（无鉴权） |
| `app/workspace/page.tsx:444,476`、`create-template-dialog.tsx:126` | POST `/api/product-images` | ✅ 可用（无鉴权） |
| `app/published/[siteKey]/client.tsx:23,42` | 公开站点 / 留资 | ✅ 可用（无鉴权） |

## 四、实测证据（**真实运行的服务**，非推断）

```bash
# ① server 显式 strict、请求一个头都不带
$ curl -s -X POST http://127.0.0.1:3000/api/templates/from-url \
    -H "Content-Type: application/json" -d '{"url":"https://example.com","suffix":"strict2"}'
{"ok":false,"error":"access_context_required","message":"需要内部访问上下文才能访问该资源。"}
HTTP 401

# ② 同一请求带齐三头
$ curl -s -X POST ... -H "x-sitecraft-workspace-id: demo" \
    -H "x-sitecraft-actor-id: x" -H "x-sitecraft-role: editor" -d '{...}'
HTTP 201   slots:["hero.title"]      ← 链路本身完全正常

# ③ 公开路由不受影响（同一次 strict 运行里，全部**无头**）
$ for p in /api/sites /api/templates/runtime /api/generation-records /api/leads \
           /api/ai/status /api/health /api/product-images /api/templates/foxi/preview; do
      curl -s -o /dev/null -w "$p -> %{http_code}\n" http://127.0.0.1:3000$p; done
/api/sites                  -> 401     ← 需鉴权，如实拒
/api/templates/runtime      -> 401     ← 需鉴权，如实拒
/api/generation-records     -> 401     ← 需鉴权，如实拒
/api/leads                  -> 401     ← 需鉴权，如实拒
/api/ai/status              -> 200     ← 无鉴权
/api/health                 -> 200     ← 无鉴权
/api/product-images         -> 405     ← POST-only，GET 不被允许（非鉴权问题）
/api/templates/foxi/preview -> 200     ← 无鉴权
```

与第二节的表**逐格吻合**：四个需鉴权的类全部 401，三个无鉴权类全部可用。

⚠️ **一次测量错误，如实记录**：本盘初稿曾把 `/api/templates/runtime` 的 200 写成
"strict 下的异常"。复核发现那次测量**根本没进 strict**——`SITECRAFT_ACCESS_MODE`
若放在**shell 环境变量**里，会被 `next.config.ts` 的 `loadEnvConfig` 覆盖；
只有写进 **`.env.local`** 才生效（实测）。用**默认 dev（relaxed）**复测时
`/api/sites` 与 `/api/generation-records` **同样**返 200，即当时测的是 relaxed，
不是"鉴权被绕过"。改用 `.env.local` 后两个类分离得干干净净。

> 教训：**"设了环境变量"不等于"服务真的读到了"**。判严格态前，先用一个
> **已知需鉴权**的端点（如 `/api/sites`）自证 401——否则整盘结论都建在假设上。

## 五、结论

**缺陷面不是"这两个路由"，而是"前端全部非公开的读写"。**

生产部署（`next start`，无 `SITECRAFT_ACCESS_MODE`）下，站点列表、工作台、生成页、
线索页、导出页、模板库的建站与生成——**凡走 `/api/sites*`、`/api/templates/{from-*,runtime}`、
`/api/leads*`、`/api/generation-records` 的，全部 401**。可用者仅：静态资源、预览、
公开站点页、图片上传、健康检查、AI 状态。

`docker-compose.yml` / `Dockerfile` / `.env*` 均**未**设 `SITECRAFT_ACCESS_MODE`，
即"生产默认 strict"是**未经配置覆盖的真实默认**。

## 六、未决 / 待查（登记，不在此修）

| # | 事项 | 状态 |
|---|---|---|
| 1 | 前端生产鉴权接入的**正确形态** | → T-13，独立批次，先出方案 |

> 自助 SaaS 的用户手里**不该**有三个内部头。这大概率不是"给前端补三行头"，
> 而是**登录态 / 凭据签发**的设计问题。备选方向之一（维持现状 + 网关注头）
> 需与"本地开发零配置""生产默认安全"两条既有目标一起权衡，随 T-13 出方案。

## 七、复现方式

```bash
# 起一个 strict 态的服务（注：SITECRAFT_ACCESS_MODE 走 .env.local，
# 走环境变量会被 next.config.ts 的 loadEnvConfig 覆盖——实测）
printf '\nSITECRAFT_ACCESS_MODE=strict\n' >> .env.local
SITE_STORE=file npm run dev
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/sites        # 401
```
