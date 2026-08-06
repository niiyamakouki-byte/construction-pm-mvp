/**
 * laporta-beads-n3mw9: internal sprint labels must not leak into customer-facing copy.
 * Author: Codex
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");

const readComponent = (name: string) =>
  readFileSync(resolve(repoRoot, "src/components", name), "utf8");

describe("customer-facing copy", () => {
  it("提案書画面から内部Sprint番号と枝番を除く", () => {
    const source = readComponent("ProposalGeneratorPage.tsx");

    expect(source).not.toContain("Sprint 16-C —");
    expect(source).not.toContain("問合せから取込 (16-A)");
    expect(source).not.toContain("商談から取込 (16-B)");
    expect(source).toContain("提案書の叩き台を生成します");
  });

  it("変更管理画面から内部Sprint番号を除く", () => {
    const source = readComponent("ChangeOrderPage.tsx");

    expect(source).not.toContain("Sprint 17-B —");
    expect(source).toContain("承認状況を管理します");
  });

  it("引渡し画面から内部Sprint番号を除く", () => {
    const source = readComponent("HandoverPackagePage.tsx");

    expect(source).not.toContain("Sprint 17-C —");
    expect(source).toContain("メンテナンス情報を一元管理します");
  });
});
