import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function channel(value: number) {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground: string, background: string) {
  const lum = (hex: string) => {
    const raw = hex.replace("#", "");
    const red = channel(Number.parseInt(raw.slice(0, 2), 16));
    const green = channel(Number.parseInt(raw.slice(2, 4), 16));
    const blue = channel(Number.parseInt(raw.slice(4, 6), 16));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(lum(foreground), lum(background));
  const darker = Math.min(lum(foreground), lum(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const darkTextOnLight = [
  [".workspace-theme-dark .message.assistant .message-bubble", "#17211b", "#ffffff"],
  [".workspace-theme-dark .chat-input textarea", "#17211b", "#fbfdfb"],
  [".workspace-theme-dark .preview-toolbar .project-name", "#17211b", "#ffffff"],
  [".workspace-theme-dark [data-testid=\"workspace-draft-revision\"]", "#17211b", "#f1f6f0"],
  [".workspace-theme-dark .chat-hints .hint", "#243028", "#ffffff"],
  [".workspace-theme-dark .save-status", "#243028", "#ffffff"],
] as const;

test("dark workspace text on light surfaces stays at least 4.5:1", () => {
  for (const [selector, foreground, background] of darkTextOnLight) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{[^}]*color:\\s*" + foreground));
    assert.ok(contrast(foreground, background) >= 4.5, `${selector} ${contrast(foreground, background)}`);
  }
  assert.match(css, /\.workspace-theme-dark \.builder-template-name\s*\{[^}]*color:\s*#d8f5c8/);
  assert.ok(contrast("#d8f5c8", "#202c24") >= 4.5);
  assert.match(css, /\.save-status \{ color: #3e5148; /);
  assert.ok(contrast("#3e5148", "#f8faf7") >= 4.5);
  assert.match(css, /\.workspace-theme-dark \.save-status\.loading,\s*\.workspace-theme-dark \.save-status\.warning \{ color: #243028; \}/);
});
