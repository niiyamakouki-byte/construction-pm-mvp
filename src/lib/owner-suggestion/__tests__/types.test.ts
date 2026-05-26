/**
 * types.test.ts — owner-suggestion types unit tests
 */

import { describe, it, expect } from "vitest";
import {
  makeOwnerSuggestionId,
  LIFESTYLE_TAG_LABELS,
  PRIORITY_RANKING_LABELS,
  PLAN_KIND_LABELS,
  PLAN_STATUS_LABELS,
} from "../types.js";

describe("makeOwnerSuggestionId", () => {
  it("ブランド型を生成する", () => {
    const id = makeOwnerSuggestionId("os-123");
    expect(id).toBe("os-123");
  });

  it("空文字でも生成できる", () => {
    const id = makeOwnerSuggestionId("");
    expect(id).toBe("");
  });
});

describe("LIFESTYLE_TAG_LABELS", () => {
  it("全ライフスタイルタグにラベルが存在する", () => {
    const tags = ["cooking", "work_from_home", "entertain_guests", "pet_owner", "elderly_care"] as const;
    for (const tag of tags) {
      expect(LIFESTYLE_TAG_LABELS[tag]).toBeTruthy();
    }
  });
});

describe("PRIORITY_RANKING_LABELS", () => {
  it("全優先ランキングにラベルが存在する", () => {
    const rankings = ["priceFirst", "qualityFirst", "designFirst", "durabilityFirst"] as const;
    for (const r of rankings) {
      expect(PRIORITY_RANKING_LABELS[r]).toBeTruthy();
    }
  });
});

describe("PLAN_KIND_LABELS", () => {
  it("全プランKindにラベルが存在する", () => {
    const kinds = ["budget_focused", "balanced", "premium", "design_focused", "family_friendly"] as const;
    for (const k of kinds) {
      expect(PLAN_KIND_LABELS[k]).toBeTruthy();
    }
  });
});

describe("PLAN_STATUS_LABELS", () => {
  it("全プランステータスにラベルが存在する", () => {
    const statuses = ["draft", "presented", "in_review", "accepted", "rejected"] as const;
    for (const s of statuses) {
      expect(PLAN_STATUS_LABELS[s]).toBeTruthy();
    }
  });
});
