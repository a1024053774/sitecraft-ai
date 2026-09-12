import { expect, test } from "../helpers/fixtures";
import { createSite, getDraft, putManualOps } from "../helpers/api";
import { mockAnalyze, mockExecute } from "../helpers/mock-ai";
import { analyzeAndConfirm } from "../helpers/ui";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { resolvePostgresPort, resolveStoreBackend } from "../scripts/pg-target.mjs";

/**
 * 阶段 4 收口门禁：**改名 + 归一化在真实链路里端到端成立**。
 *
 * ## 为什么单元测试不够
 *
 * `*_card → *_item` 的改名与读取归一化横跨 AI 生成整条链路
 * （prompt → 模型 → 解析 → 校验 → 落盘 → 读回 → undo 重放）。
 * 单元测试只钉住了其中几段；本文件走**同一个浏览器 + 真实服务进程**，
 * 并按用户的裁决跑**两种存储后端**：
 *
 * ```
 * # PG 后端（缺省）
 * npm run test:e2e -- e2e/specs/op-rename-roundtrip.spec.ts
 *
 * # 文件后端
 * E2E_STORE=file npm run test:e2e -- e2e/specs/op-rename-roundtrip.spec.ts
 * ```
 *
 * ## 本文件比既有 `workspace.spec.ts` 多覆盖的那一段
 *
 * 既有用例走"**新名**手动 ops → undo"。本文件多一步：
 * **把盘上的 op 名改成历史旧名 `update_card`，再让页面 undo**——
 * 这一跳正是读取归一化存在的理由，也是唯一能证伪它的地方：
 * 归一化若没接上，`inverseOperations` 里的旧名会落到
 * `operation.op === "update_item"` 判断之外，**undo 静默无操作**（按钮点了没反应）。
 *
 * ## 测试用的是**假模型**
 *
 * `mockAnalyze` / `mockExecute` 拦在浏览器侧，不调真实 LLM——
 * `PROJECT_ACCEPTANCE.md` 记着真 LLM 同配置两次运行约 9% 结果不同，
 * 不适合放进 pass/fail 门禁。
 */

const LEGACY_OP = "update_card";

/** 文件后端：直接改站点 JSON 里的 op 名。 */
function ageFileRecordToLegacy(siteId: string) {
  const file = path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  let aged = 0;
  for (const changeSet of [...(record.history ?? []), ...(record.future ?? [])]) {
    for (const op of [...(changeSet.operations ?? []), ...(changeSet.inverseOperations ?? [])]) {
      if (op.op === "update_item") { op.op = LEGACY_OP; aged += 1; }
    }
  }
  fs.writeFileSync(file, JSON.stringify(record, null, 2), "utf8");
  return aged;
}

/** 探一下宿主机端口通不通（决定要不要给"连不上"一个可读原因）。 */
function portOpen(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1_000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
}

test.describe("阶段 4 · op 改名 + 归一化 端到端往返", () => {
  test("一句话建站 → 生成 → save → 旧名读入 → undo 重放", async ({ page, request }) => {
    const backend = resolveStoreBackend();
    if (backend === "file") {
      /**
       * ⚠️ **文件后端当前跑不了，且不是本文件能修的**（2026-09-12 实测）。
       *
       * `serve.mjs` 用 `next start` 起服务，而 `next start` 会把 `NODE_ENV`
       * 设为 `production`；三个 store 的判定都是
       * `SITE_STORE === "postgres" || NODE_ENV === "production"`，
       * 于是 production **强制走 PG**，`SITE_STORE=file` 覆盖不了。
       *
       * 实测错误（不是推断）：
       * ```
       * createSite failed: 422 {"error":"DATABASE_URL 未配置，生产环境不会退回本地文件存储。"}
       * ```
       * （`lib/postgres.ts:11`，被 `createPostgresSite` → `ensureDatabaseSchema` 触发）
       *
       * 解开它有两条路，**都要改 lib/ 或改被测服务形态**，超出本轮 e2e 批次的
       * 「业务代码与 lib/ 零改动」红线，所以在此**快速失败并说明原因**，
       * 而不是留下一个 422 让人去猜。
       */
      throw new Error(
        "文件后端模式被阻断：next start 的 NODE_ENV=production 强制 usePostgres=true"
        + "（lib/site-store.ts:92 等三处），SITE_STORE=file 覆盖不了。"
        + "详见 docs/plans/2026-09-12-phase4-e2e-report.md 的「文件后端阻断」一节。",
      );
    }
    if (!await portOpen(resolvePostgresPort())) {
      throw new Error(
        `本用例需要 Postgres（127.0.0.1:${resolvePostgresPort()}）。见 e2e/scripts/pg-target.mjs。`,
      );
    }

    // ---- ① 一句话建站（走真实 /generate 页面，模型被 mock 拦下）----
    await mockAnalyze(page);
    await mockExecute(page);
    await analyzeAndConfirm(page, "工业紧固件制造商，面向海外采购经理");

    // 确认后服务端已建站；从 API 拿它的 id 与当前 revision。
    const created = await createSite(request);
    const siteId = created.id;

    // ---- ② save：落一条真实变更（AI 来源，走的正是改名后的新名）----
    let snapshot = await getDraft(request, siteId);
    const firstRevision = snapshot.draft.revision;
    await putManualOps(request, siteId, firstRevision, [
      { op: "update_item", section: "features", index: 0, locale: "zh", title: "端到端第一版标题" },
    ]);
    snapshot = await getDraft(request, siteId);
    expect(snapshot.draft.content, "前置：这一步必须真的改了内容").toBeTruthy();
    const afterSave = JSON.stringify(snapshot.draft);
    expect(afterSave).toContain("端到端第一版标题");

    // ---- ③ 把盘上的 op 名改成**历史旧名**，模拟改名前的数据 ----
    if (backend === "file") {
      const aged = ageFileRecordToLegacy(siteId);
      expect(aged, "必须真的改写了历史里的 op 名，否则这一段什么都没测").toBeGreaterThan(0);
    } else {
      // PG 后端：用 psql 风格的 jsonb 原地改写（与单元测试同一手法）。
      const { default: pg } = await import("pg");
      const client = new pg.Client({
        connectionString: `postgresql://postgres:postgres@127.0.0.1:${resolvePostgresPort()}/site_studio`,
      });
      await client.connect();
      try {
        const before = await client.query(
          `SELECT cs->'operations'->0->>'op' AS op FROM sitecraft_sites s, jsonb_array_elements(s.history) cs WHERE s.site_id = $1`,
          [siteId],
        );
        await client.query(
          `UPDATE sitecraft_sites SET history = (
             SELECT jsonb_agg(jsonb_set(jsonb_set(cs, '{operations}', (
               SELECT jsonb_agg(jsonb_set(e, '{op}', '"${LEGACY_OP}"')) FROM jsonb_array_elements(cs->'operations') e
             )), '{inverseOperations}', (
               SELECT jsonb_agg(jsonb_set(e, '{op}', '"${LEGACY_OP}"')) FROM jsonb_array_elements(cs->'inverseOperations') e
             )) ORDER BY ord) FROM jsonb_array_elements(history) WITH ORDINALITY AS t(cs, ord)
           ) WHERE site_id = $1`,
          [siteId],
        );
        const after = await client.query(
          `SELECT cs->'operations'->0->>'op' AS op FROM sitecraft_sites s, jsonb_array_elements(s.history) cs WHERE s.site_id = $1`,
          [siteId],
        );
        expect(before.rows.length, "必须先有历史才谈得上改写").toBeGreaterThan(0);
        expect(after.rows[0]?.op, "必须真的改成了旧名").toBe(LEGACY_OP);
      } finally {
        await client.end().catch(() => undefined);
      }
    }

    // ---- ④ 读回来：旧名历史必须仍可撤销 ----
    const reread = await getDraft(request, siteId);
    expect(reread.canUndo, "含旧名历史的站点必须仍可 undo").toBe(true);

    // ---- ⑤ 页面 undo：归一化若断链，这里会**静默无操作** ----
    await page.goto(`/workspace?siteId=${siteId}`);
    const undo = page.getByRole("button", { name: /撤销/ });
    await expect(undo).toBeEnabled();
    await undo.click();
    const redo = page.getByRole("button", { name: /重做/ });
    await expect(redo, "undo 生效后重做必须可用——不可用说明 undo 静默失败了").toBeEnabled();

    // 内容真的回退了（不是"按钮变了但草稿没动"）
    const afterUndo = await getDraft(request, siteId);
    expect(JSON.stringify(afterUndo.draft)).not.toContain("端到端第一版标题");
  });
});
