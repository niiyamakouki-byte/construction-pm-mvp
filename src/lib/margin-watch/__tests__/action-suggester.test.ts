/**
 * Tests for action-suggester.
 */

import { describe, expect, it } from "vitest";
import { suggestAction_ja } from "../action-suggester.js";

// ── safe ───────────────────────────────────────────────────────────────────

describe("suggestAction_ja - safe", () => {
  it("safe + no causes → 問題なし", () => {
    expect(suggestAction_ja("safe", [])).toBe("問題なし");
  });

  it("safe + some causes → 問題なし", () => {
    expect(suggestAction_ja("safe", ["原価増"])).toBe("問題なし");
  });
});

// ── caution ────────────────────────────────────────────────────────────────

describe("suggestAction_ja - caution", () => {
  it("caution + no causes → 監視継続", () => {
    expect(suggestAction_ja("caution", [])).toContain("監視継続");
  });

  it("caution + 受注額減 → 監視継続", () => {
    expect(suggestAction_ja("caution", ["受注額減"])).toContain("監視継続");
  });

  it("caution + 原価増 → 監視継続", () => {
    expect(suggestAction_ja("caution", ["原価増"])).toContain("監視継続");
  });
});

// ── warning ────────────────────────────────────────────────────────────────

describe("suggestAction_ja - warning", () => {
  it("warning + no causes → 週次レビュー対象", () => {
    expect(suggestAction_ja("warning", [])).toContain("週次レビュー対象");
  });

  it("warning + 受注額減 → 週次レビュー対象", () => {
    expect(suggestAction_ja("warning", ["受注額減"])).toContain("週次レビュー対象");
  });

  it("warning + 原価増 → 週次レビュー対象", () => {
    expect(suggestAction_ja("warning", ["原価増"])).toContain("週次レビュー対象");
  });

  it("warning + 予測超過 → 週次レビュー対象", () => {
    expect(suggestAction_ja("warning", ["予測超過"])).toContain("週次レビュー対象");
  });
});

// ── critical ───────────────────────────────────────────────────────────────

describe("suggestAction_ja - critical", () => {
  it("critical + 受注額減 → 追加変更工事の見積化", () => {
    const result = suggestAction_ja("critical", ["受注額減"]);
    expect(result).toContain("追加変更工事");
    expect(result).toContain("緊急");
  });

  it("critical + 原価増 → 原価精査会議", () => {
    const result = suggestAction_ja("critical", ["原価増"]);
    expect(result).toContain("原価精査会議");
    expect(result).toContain("緊急");
  });

  it("critical + no causes → 原価精査会議 (デフォルト)", () => {
    const result = suggestAction_ja("critical", []);
    expect(result).toContain("原価精査会議");
    expect(result).toContain("緊急");
  });

  it("critical + 予測超過 → 原価精査会議 (デフォルト)", () => {
    const result = suggestAction_ja("critical", ["予測超過"]);
    expect(result).toContain("原価精査会議");
  });

  it("critical + 受注額減 + 原価増 → 受注額減 が優先", () => {
    const result = suggestAction_ja("critical", ["受注額減", "原価増"]);
    expect(result).toContain("追加変更工事");
  });

  it("critical + 単価変動 → 原価精査会議", () => {
    const result = suggestAction_ja("critical", ["単価変動"]);
    expect(result).toContain("原価精査会議");
  });
});

// ── マトリクス全パターン (exhaustive) ─────────────────────────────────────

describe("suggestAction_ja - 全パターン網羅", () => {
  const levels = ["safe", "caution", "warning", "critical"] as const;
  const causesSets = [[], ["受注額減"], ["原価増"], ["予測超過"], ["単価変動"], ["受注額減", "原価増"]];

  for (const level of levels) {
    for (const causes of causesSets) {
      it(`level=${level}, causes=[${causes.join(",")}] → 文字列を返す`, () => {
        const result = suggestAction_ja(level, causes);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });
    }
  }
});
