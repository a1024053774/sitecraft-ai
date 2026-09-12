/**
 * 注入脚本内部**禁用反引号**（流程债防线）。
 *
 * ## 为什么需要它（而不是靠注释提醒）
 *
 * 2026-09-12 这一轮里，同一个坑**踩了五次**：在"会被注入进模板页面的字符串"里
 * 写了反引号，导致外层模板字面量提前终止。
 *
 * 最典型的一次是我自己造成的——给 `app/api/templates/[templateId]/preview/route.ts`
 * 的表单注入代码写注释时用了 Markdown 风格的反引号：
 *
 *     /** ⚠️ 必须用 `templateUiCopy[locale]`，**不能**用 `copy`。 *\/
 *
 * 这行注释身处**注入脚本的模板字面量内部**，反引号把字符串从中间切断：
 * 后半段注释变成了 JS 代码，`tsc` 报一串 `TS1005: ';' expected`。
 *
 * 更早的几次更隐蔽——字符串被**偶数个**反引号切成"看起来合法"的样子，
 * 编译通过，但发到浏览器的脚本是坏的。那种才真正危险。
 *
 * 光靠"记住别写反引号"无效：五次里五次都记得，五次都还是写了。
 * 按用户裁决（2026-09-12）落成**会失败的断言**。
 *
 * ## 为什么按"区域"扫，而不是整文件扫
 *
 * 首版写成整文件逐字符扫，结果**误报一片**：这些文件里有 100–200 个反引号，
 * 绝大多数在 JSDoc 注释、普通字符串、以及**合法**的模板字面量开合处
 * （`preview/route.ts:93` 的 `` return `<script ...` `` 就是合法的开始）。
 *
 * 真正危险的只有一处：**注入脚本内部那段模板字面量里**。所以本测试先定位
 * 那段区域，只在区内找反引号——区内不需要任何嵌套模板字面量（`${}` 插值足够），
 * 所以区内出现的每一个反引号都是事故。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * 需要检查的注入区域。
 *
 * `startLine`/`endLine` 是**定界符所在行**（`return \`<script…` 与 `</script>\`;`）——
 * 那两行上的反引号是**合法的**开合符号，必须排除在扫描范围外。
 * 真正要扫的是**两者之间**的内容：`[startLine + 1, endLine - 1]`。
 *
 * 用行号锚点而非正则：这段结构稳定，且行号一旦漂移测试会立刻失败
 * （那时应当更新锚点，而不是让检查悄悄失效）。
 */
const INJECTION_REGIONS = [
  {
    file: "app/api/templates/[templateId]/preview/route.ts",
    startLine: 93,
    endLine: 1424,
    what: "bridgeScript：注入到模板页面的桥接脚本",
  },
] as const;

/** 区内出现反引号即事故——记下位置与内容，便于直接改。 */
function scanRegion(lines: readonly string[], startLine: number, endLine: number) {
  const findings: Array<{ line: number; text: string }> = [];
  // 排除两端的定界符行：它们的反引号就是模板字面量的开合符号
  for (let i = startLine; i < Math.min(endLine - 1, lines.length); i += 1) {
    const text = lines[i] ?? "";
    if (text.includes("`")) findings.push({ line: i + 1, text: text.trim().slice(0, 150) });
  }
  return findings;
}

test("注入脚本区域内不存在反引号", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const problems: string[] = [];

  for (const region of INJECTION_REGIONS) {
    const absolute = path.join(root, region.file);
    assert.ok(fs.existsSync(absolute), `找不到 ${region.file}——锚点已失效，请更新本测试`);
    const lines = fs.readFileSync(absolute, "utf8").split("\n");

    // 锚点自检：定界符行必须真的是那段注入脚本的开合，否则下面的扫描是空转
    assert.match(
      lines[region.startLine - 1] ?? "",
      /return `<script/,
      `${region.file}:${region.startLine} 不再是注入脚本起点（锚点漂移了），请更新本测试`,
    );
    assert.match(
      lines[region.endLine - 1] ?? "",
      /^<\/script>`;/,
      `${region.file}:${region.endLine} 不再是注入脚本终点（锚点漂移了），请更新本测试`,
    );

    for (const finding of scanRegion(lines, region.startLine, region.endLine)) {
      problems.push(`  ${region.file}:${finding.line}\n    > ${finding.text}`);
    }
  }

  assert.deepEqual(
    problems,
    [],
    `注入脚本（${INJECTION_REGIONS.map((r) => r.what).join("、")}）内出现反引号——` +
      `它会提前终止整段脚本，且**可能编译通过但运行时是坏的**：\n${problems.join("\n")}\n\n` +
      "改法：注释里写标识符时不要用 Markdown 反引号，改用「」或裸写。",
  );
});

test("检查器本身有效：能从区内抓到反引号、不误报区外", () => {
  /**
   * 保护检查器自己。
   *
   * 首版状态机写成"遇到反引号就当作合法结束"，于是**永远抓不到任何东西**——
   * 是这条自检当场揭穿的。本项目已经吃过三次"假门禁"的亏
   * （`coverage-scan` 零断言、`probe-lead-form` 不设退出码、`add_card` 容量键不匹配），
   * 不能再来一次。
   */
  const lines = [
    "</script>`;",              // 1  区外
    "  const ok = `合法模板`;",  // 2  区外
    "  return `<script>",        // 3  起点定界符（不扫）
    "    /** 用 `copy` 会炸 */", // 4  区内 ← 应被抓到
    "    const a = 1;",          // 5  区内
    "    const b = `嵌套`;",     // 6  区内 ← 应被抓到
    "  </script>`;",             // 7  终点定界符（不扫）
  ];
  const findings = scanRegion(lines, 3, 7);
  assert.deepEqual(
    findings.map((f) => f.line),
    [4, 6],
    "必须精确命中区内两条，且不碰两端定界符行与区外行",
  );
});
