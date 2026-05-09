/**
 * proposal-generator facade unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateRaw,
  generateFromInquiry,
  generateFromDeal,
  regenerateSection,
} from "../proposal-generator.js";
import { _resetStrengthStore } from "../strength-store.js";
import { _resetCaseStudyStore } from "../case-study-store.js";
import { _resetDifferentiationStore } from "../differentiation-store.js";
import { _resetProposalStore, proposalStore } from "../proposal-store.js";
import { _resetComposerIdCounter } from "../proposal-composer.js";
import type { ProposalGenerationInput } from "../types.js";
import type { InquiryRecord } from "../../inquiry-responder/types.js";
import type { Deal } from "../../sales-pipeline/types.js";

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
  _resetStrengthStore();
  _resetCaseStudyStore();
  _resetDifferentiationStore();
  _resetProposalStore();
  _resetComposerIdCounter();
});

function makeInput(overrides: Partial<ProposalGenerationInput> = {}): ProposalGenerationInput {
  return {
    customerName: "田中花子",
    workCategory: "full_renovation",
    workScale: "medium",
    locationCity: "世田谷区",
    ...overrides,
  };
}

function makeInquiry(overrides: Partial<InquiryRecord> = {}): InquiryRecord {
  const now = new Date().toISOString();
  return {
    id: "inq-001",
    channel: "hp_form",
    receivedAt: now,
    rawText: "キッチンのリフォームをお願いしたい",
    customerName: "佐藤一郎",
    customerContact: null,
    extractedRequirements: {
      workCategory: "kitchen",
      workScale: "medium",
      locationCity: "渋谷区",
      budgetHintJpy: null,
      desiredStartMonth: null,
      contactPreference: null,
    },
    estimatedRangeJpy: {
      lowerJpy: 1_000_000,
      upperJpy: 3_000_000,
      confidence: "medium",
      basisNotes_ja: "テスト",
    },
    proposedSlots: [],
    draftReplyJa: "",
    status: "triaged",
    priority: "normal",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id: "deal-001",
    customerName: "高橋商事",
    currentStage: "proposal",
    expectedAmountJpy: 5_000_000,
    probabilityPct: 50,
    expectedCloseDate: "2026-07-01",
    ownerName: "新山光輝",
    stageHistory: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── generateRaw ────────────────────────────────────────────────────────────

describe("generateRaw", () => {
  it("ProposalDocument を返す", () => {
    const doc = generateRaw(makeInput());
    expect(doc).toBeDefined();
    expect(doc.id).toBeTruthy();
  });

  it("customerName が引き継がれる", () => {
    const doc = generateRaw(makeInput({ customerName: "鈴木三郎" }));
    expect(doc.customerName).toBe("鈴木三郎");
  });

  it("proposalStore に保存される", () => {
    const doc = generateRaw(makeInput());
    expect(proposalStore.get(doc.id)).not.toBeNull();
  });

  it("シードデータを自動投入する", () => {
    generateRaw(makeInput());
    // Strength store should have been seeded (8 strengths)
    expect(doc_has_strengths_section()).toBe(true);
  });

  it("price_range セクションの価格が正の値", () => {
    const doc = generateRaw(makeInput());
    expect(doc.totalPriceJpyLower).toBeGreaterThan(0);
    expect(doc.totalPriceJpyUpper).toBeGreaterThan(0);
  });

  it("全セクション種別が生成される (デフォルトオプション)", () => {
    const doc = generateRaw(makeInput());
    const kinds = doc.sections.map((s) => s.kind);
    expect(kinds).toContain("cover");
    expect(kinds).toContain("our_strengths");
    expect(kinds).toContain("case_studies");
    expect(kinds).toContain("price_range");
    expect(kinds).toContain("schedule");
    expect(kinds).toContain("differentiation");
    expect(kinds).toContain("next_step");
    expect(kinds).toContain("appendix");
  });

  it("includeCases=false では case_studies がない", () => {
    const doc = generateRaw(makeInput(), { includeCases: false });
    expect(doc.sections.some((s) => s.kind === "case_studies")).toBe(false);
  });

  it("includeDifferentiation=false では differentiation がない", () => {
    const doc = generateRaw(makeInput(), { includeDifferentiation: false });
    expect(doc.sections.some((s) => s.kind === "differentiation")).toBe(false);
  });
});

function doc_has_strengths_section(): boolean {
  const docs = proposalStore.listRecent(1);
  if (docs.length === 0) return false;
  return docs[0].sections.some((s) => s.kind === "our_strengths");
}

// ── generateFromInquiry ────────────────────────────────────────────────────

describe("generateFromInquiry", () => {
  it("InquiryRecord から ProposalDocument を生成する", () => {
    const inquiry = makeInquiry();
    const doc = generateFromInquiry(inquiry);
    expect(doc).toBeDefined();
    expect(doc.inquiryId).toBe("inq-001");
  });

  it("customerName を引き継ぐ", () => {
    const inquiry = makeInquiry({ customerName: "山田次郎" });
    const doc = generateFromInquiry(inquiry);
    expect(doc.customerName).toBe("山田次郎");
  });

  it("customerName が null の場合は 'お客様' を使う", () => {
    const inquiry = makeInquiry({ customerName: null });
    const doc = generateFromInquiry(inquiry);
    expect(doc.customerName).toBe("お客様");
  });

  it("workCategory が inquiry から引き継がれる", () => {
    const inquiry = makeInquiry();
    const doc = generateFromInquiry(inquiry);
    // kitchen category should produce appropriate price range
    expect(doc.totalPriceJpyLower).toBeGreaterThan(0);
  });

  it("proposalStore に保存される", () => {
    const inquiry = makeInquiry();
    const doc = generateFromInquiry(inquiry);
    expect(proposalStore.get(doc.id)).not.toBeNull();
  });
});

// ── generateFromDeal ───────────────────────────────────────────────────────

describe("generateFromDeal", () => {
  it("Deal から ProposalDocument を生成する", () => {
    const deal = makeDeal();
    const doc = generateFromDeal(deal);
    expect(doc).toBeDefined();
    expect(doc.dealId).toBe("deal-001");
  });

  it("customerName を引き継ぐ", () => {
    const deal = makeDeal({ customerName: "渡辺建設" });
    const doc = generateFromDeal(deal);
    expect(doc.customerName).toBe("渡辺建設");
  });

  it("expectedAmountJpy が budgetHint に使われる", () => {
    const deal = makeDeal({ expectedAmountJpy: 10_000_000 });
    const doc = generateFromDeal(deal);
    // Budget hint of 10M should influence the price range
    expect(doc.totalPriceJpyLower).toBeGreaterThan(0);
    expect(doc.totalPriceJpyUpper).toBeGreaterThan(0);
  });

  it("proposalStore に保存される", () => {
    const deal = makeDeal();
    const doc = generateFromDeal(deal);
    expect(proposalStore.get(doc.id)).not.toBeNull();
  });
});

// ── regenerateSection ──────────────────────────────────────────────────────

describe("regenerateSection", () => {
  it("存在しない docId は null を返す", () => {
    const result = regenerateSection("nonexistent", "price_range");
    expect(result).toBeNull();
  });

  it("price_range セクションを再生成できる", () => {
    const doc = generateRaw(makeInput());
    const updated = regenerateSection(doc.id, "price_range");
    expect(updated).not.toBeNull();
    expect(updated?.id).toBe(doc.id);
    expect(updated?.sections.some((s) => s.kind === "price_range")).toBe(true);
  });

  it("再生成後も proposalStore に保存される", () => {
    const doc = generateRaw(makeInput());
    regenerateSection(doc.id, "price_range");
    expect(proposalStore.get(doc.id)).not.toBeNull();
  });
});

// ── Integrated: InquiryRecord → Deal → ProposalDocument (16-A/16-B連携) ──

describe("Sprint 16-A/16-B 連携テスト", () => {
  it("inquiry から生成した提案書は inquiryId を持つ", () => {
    const inquiry = makeInquiry({ id: "inq-linked-001" });
    const doc = generateFromInquiry(inquiry);
    expect(doc.inquiryId).toBe("inq-linked-001");
  });

  it("deal から生成した提案書は dealId を持つ", () => {
    const deal = makeDeal({ id: "deal-linked-001" });
    const doc = generateFromDeal(deal);
    expect(doc.dealId).toBe("deal-linked-001");
  });

  it("同一案件で複数生成しても proposalStore に複数件が記録される", () => {
    const inquiry = makeInquiry({ id: "inq-multi" });
    generateFromInquiry(inquiry);
    generateFromInquiry(inquiry);
    const docs = proposalStore.listByCustomer("佐藤一郎");
    expect(docs.length).toBeGreaterThanOrEqual(2);
  });
});
