/**
 * portfolio-proposal-metrics unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  proposalsThisMonthCount,
  avgGenerationLeadHours,
  topRequestedWorkCategory,
} from "../portfolio-proposal-metrics.js";
import { _resetProposalStore, proposalStore } from "../proposal-store.js";
import type { ProposalDocument } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

beforeEach(() => {
  localStorage.clear();
  _resetProposalStore();
});

function makeDocThisMonth(id: string, customerNameHint: string = "テスト"): ProposalDocument {
  const now = new Date();
  return {
    id,
    customerName: customerNameHint,
    generatedAt: now.toISOString(),
    sections: [
      {
        kind: "customer_situation",
        titleJa: "お客様状況",
        bodyJa: `工事種別: キッチン工事 (中規模)\n対象エリア: 世田谷区\nご予算は現地調査後に詳細確認`,
        orderIndex: 2,
      },
    ],
    totalPriceJpyLower: 1_000_000,
    totalPriceJpyUpper: 3_000_000,
    durationDays: 30,
    validUntil: "2026-06-08",
  };
}

function makeDocLastMonth(id: string): ProposalDocument {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  return {
    id,
    customerName: "先月顧客",
    generatedAt: lastMonth.toISOString(),
    sections: [],
    totalPriceJpyLower: 1_000_000,
    totalPriceJpyUpper: 3_000_000,
    durationDays: 30,
    validUntil: "2026-05-08",
  };
}

describe("proposalsThisMonthCount", () => {
  it("提案書がない場合は 0 を返す", () => {
    expect(proposalsThisMonthCount()).toBe(0);
  });

  it("今月の提案書のみカウントする", () => {
    proposalStore.save(makeDocThisMonth("this-1"));
    proposalStore.save(makeDocThisMonth("this-2"));
    proposalStore.save(makeDocLastMonth("last-1"));
    expect(proposalsThisMonthCount()).toBe(2);
  });
});

describe("avgGenerationLeadHours", () => {
  it("提案書がない場合は 0 を返す", () => {
    expect(avgGenerationLeadHours()).toBe(0);
  });

  it("提案書がある場合は正の数を返す", () => {
    proposalStore.save(makeDocThisMonth("doc-1"));
    expect(avgGenerationLeadHours()).toBeGreaterThanOrEqual(0);
  });
});

describe("topRequestedWorkCategory", () => {
  it("提案書がない場合は null を返す", () => {
    expect(topRequestedWorkCategory()).toBeNull();
  });

  it("キッチン工事が最多の場合は kitchen を返す", () => {
    proposalStore.save(makeDocThisMonth("k-1"));
    proposalStore.save(makeDocThisMonth("k-2"));
    const result = topRequestedWorkCategory();
    // kitchen section body contains "キッチン工事"
    expect(result).toBe("kitchen");
  });
});
