#!/usr/bin/env node
/**
 * 阶段 4-1 只读调研（Postgres 侧）：统计 sitecraft_sites 的 history/future 里
 * operations / inverseOperations 的 op 名频次与形态。
 *
 * 只读：SELECT 而已，不建表、不迁移、不写。
 * 连不上（库没起/端口未监听）时**明确报告"无法取证"并退出 2**，
 * 不用 0 冒充"没有旧数据"——本项目吃过假门禁的亏（glossary 附则 3）。
 *
 * 用法：node scripts/survey-persisted-operations-pg.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const LEGACY_OPS = new Set(["update_card", "add_card", "remove_card"]);

let databaseUrl = process.env.DATABASE_URL ?? null;
if (!databaseUrl) {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await readFile(path.join(process.cwd(), file), "utf8");
      const match = text.split(/\r?\n/).find((line) => line.startsWith("DATABASE_URL="));
      if (match) {
        databaseUrl = match.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
        break;
      }
    } catch { /* 文件不存在就继续 */ }
  }
}

if (!databaseUrl) {
  console.error("无法取证：.env/.env.local 与进程环境里都没有 DATABASE_URL。");
  process.exit(2);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}
function shapeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array<${value.length ? shapeOf(value[0]) : "empty"}>`;
  if (typeof value === "object") return `{${Object.keys(value).sort().join(",")}}`;
  return typeof value;
}

try {
  await client.connect();
} catch (error) {
  console.error(`无法取证：连不上 ${new URL(databaseUrl).host} —— ${error.message}`);
  console.error("（本机 5432 无监听，Postgres 后端未在运行；这不是「没有旧数据」。）");
  process.exit(2);
}

try {
  const exists = await client.query(
    "SELECT to_regclass('public.sitecraft_sites') IS NOT NULL AS present",
  );
  if (!exists.rows[0]?.present) {
    console.log("连上了，但 public.sitecraft_sites 不存在 —— 该库从未建表，存量数据为空。");
    process.exit(0);
  }

  const { rows } = await client.query(
    "SELECT site_id, history, future FROM sitecraft_sites",
  );

  const opCounts = new Map();
  const legacyShapes = new Map();
  const sectionCounts = new Map();
  const sourceCounts = new Map();
  const cardPrefixed = new Map();
  let changeSets = 0;
  let forwardOps = 0;
  let inverseOps = 0;
  let legacyForward = 0;
  let legacyInverse = 0;
  const sitesWithLegacy = new Set();

  const scan = (operation, where, siteId) => {
    if (!operation || typeof operation !== "object") return;
    bump(opCounts, `${where}:${String(operation.op)}`);
    if (LEGACY_OPS.has(operation.op)) {
      if (where === "forward") legacyForward += 1; else legacyInverse += 1;
      bump(legacyShapes, `${operation.op} ${shapeOf(operation)}`);
      if (typeof operation.section === "string") bump(sectionCounts, `${operation.op} section=${operation.section}`);
      if (typeof operation.itemId === "string") bump(sectionCounts, `${operation.op} 带 itemId`);
      sitesWithLegacy.add(siteId);
    }
  };
  const scanStrings = (value, trace, depth = 0) => {
    if (depth > 6 || value === null || value === undefined) return;
    if (typeof value === "string") {
      if (value.startsWith("card:")) bump(cardPrefixed, `${trace} = card:<...>`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => scanStrings(entry, `${trace}[${index}]`, depth + 1));
      return;
    }
    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (key === "op" || key === "operations" || key === "inverseOperations") continue;
        scanStrings(entry, trace ? `${trace}.${key}` : key, depth + 1);
      }
    }
  };

  for (const row of rows) {
    const history = Array.isArray(row.history) ? row.history : [];
    const future = Array.isArray(row.future) ? row.future : [];
    for (const changeSet of [...history, ...future]) {
      changeSets += 1;
      if (typeof changeSet?.source === "string") bump(sourceCounts, changeSet.source);
      for (const operation of changeSet?.operations ?? []) {
        forwardOps += 1;
        scan(operation, "forward", row.site_id);
        scanStrings(operation, "");
      }
      for (const operation of changeSet?.inverseOperations ?? []) {
        inverseOps += 1;
        scan(operation, "inverse", row.site_id);
        scanStrings(operation, "");
      }
    }
  }

  const dump = (title, map, limit = 40) => {
    console.log(`\n## ${title}`);
    if (!map.size) { console.log("  （无）"); return; }
    for (const [key, count] of [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)) {
      console.log(`  ${String(count).padStart(8)}  ${key}`);
    }
  };

  console.log("# 存量落盘 operations 调研（Postgres，只读）");
  console.log(`\n站点行数：${rows.length}`);
  console.log(`ChangeSet 总数：${changeSets}`);
  console.log(`forward operations：${forwardOps} / inverseOperations：${inverseOps}`);
  console.log(`\n**旧名出现次数：forward ${legacyForward} / inverse ${legacyInverse} / 合计 ${legacyForward + legacyInverse}**`);
  console.log(`**含旧名的站点数：${sitesWithLegacy.size}**`);
  dump("op 名频次", opCounts);
  dump("旧 op 字段形态", legacyShapes);
  dump("旧 op 的 section / itemId", sectionCounts);
  dump("ChangeSource 分布", sourceCounts);
  dump("非 op 位置的 card: 前缀串", cardPrefixed);
} finally {
  await client.end().catch(() => undefined);
}
