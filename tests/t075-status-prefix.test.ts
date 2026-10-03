import assert from "node:assert/strict";
import test from "node:test";
import { formatWorkspaceChange } from "../lib/workspace-copy.ts";

test("workspace change messages keep one prefix for undo, redo, applied, and rejected", () => {
  assert.equal(formatWorkspaceChange("applied", "已撤销：首屏布局"), "已撤销：首屏布局");
  assert.equal(formatWorkspaceChange("applied", "已重做：首屏布局"), "已重做：首屏布局");
  assert.equal(formatWorkspaceChange("applied", "已更新：首屏布局"), "已更新：首屏布局");
  assert.equal(formatWorkspaceChange("no_change", "参数对比表需要至少 3 项共有参数"), "未修改：参数对比表需要至少 3 项共有参数");
});
