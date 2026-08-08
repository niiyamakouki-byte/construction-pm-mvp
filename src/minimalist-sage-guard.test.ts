import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

describe("minimalist sage UI guard", () => {
  it("keeps the default brand token scale aligned to the current default accent (クラシック紺×金, 2026-08-09)", () => {
    const css = readFileSync(resolve(repoRoot, "src/index.css"), "utf8");

    expect(css).toContain("--color-brand-100: #f5edde;");
    expect(css).toContain("--color-brand-700: #9e804d;");
    expect(css).toContain("--color-accent-600: #9e804d;");
    expect(css).toContain("outline: 2px solid #9e804d;");
  });

  it("documents the minimalist sage rules for future UI work", () => {
    const guide = readFileSync(resolve(repoRoot, "docs/minimalist-sage-ui.md"), "utf8");

    expect(guide).toContain("アクセント色はセージ1系統のみ使う。");
    expect(guide).toContain("グラデーションは禁止。");
    expect(guide).toContain("glassmorphism、重いぼかし、濃い影は禁止。");
    expect(guide).toContain("#EDF3EC");
    expect(guide).toContain("#346538");
  });
});
