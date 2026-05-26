/**
 * proposal-generator — ファサード
 *
 * Sprint 16-C: 競合提案書自動生成
 * LLM 不使用。決定的テンプレート差し込みで ProposalDocument を生成。
 */

import type {
  ProposalDocument,
  ProposalGenerationInput,
  ProposalGenerationOptions,
  ProposalSectionKind,
} from "./types.js";
import { DEFAULT_GENERATION_OPTIONS } from "./types.js";
import { strengthStore } from "./strength-store.js";
import { caseStudyStore } from "./case-study-store.js";
import { differentiationStore } from "./differentiation-store.js";
import { proposalStore } from "./proposal-store.js";
import { selectRelevantStrengths } from "./strength-selector.js";
import { matchCases } from "./case-matcher.js";
import { compose } from "./proposal-composer.js";
import type { InquiryRecord } from "../inquiry-responder/types.js";
import type { Deal } from "../sales-pipeline/types.js";

// ── Seed initialisation ────────────────────────────────────────────────────

function ensureSeeds(): void {
  strengthStore.ensureSeed();
  caseStudyStore.ensureSeed();
  differentiationStore.ensureSeed();
}

// ── Core generation ────────────────────────────────────────────────────────

function generateRawInternal(
  input: ProposalGenerationInput,
  opts: ProposalGenerationOptions,
): ProposalDocument {
  ensureSeeds();

  const allStrengths = strengthStore.getAll();
  const allCases = caseStudyStore.getAll();
  const allDiff = differentiationStore.getAll();

  const strengths = selectRelevantStrengths(input, allStrengths);
  const cases = matchCases(input, allCases);
  const diffPoints = opts.includeDifferentiation ? allDiff : [];

  const doc = compose(input, opts, { strengths, cases, diffPoints });

  proposalStore.save(doc);
  return doc;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 問合せレコードから提案書を生成する。
 */
export function generateFromInquiry(
  inquiry: InquiryRecord,
  opts: Partial<ProposalGenerationOptions> = {},
): ProposalDocument {
  const mergedOpts: ProposalGenerationOptions = { ...DEFAULT_GENERATION_OPTIONS, ...opts };

  const input: ProposalGenerationInput = {
    inquiryId: inquiry.id,
    workCategory: inquiry.extractedRequirements.workCategory as ProposalGenerationInput["workCategory"],
    workScale: inquiry.extractedRequirements.workScale as ProposalGenerationInput["workScale"],
    locationCity: inquiry.extractedRequirements.locationCity ?? "東京都",
    budgetHintJpy: inquiry.extractedRequirements.budgetHintJpy ?? undefined,
    desiredStartMonth: inquiry.extractedRequirements.desiredStartMonth ?? undefined,
    customerName: inquiry.customerName ?? "お客様",
  };

  return generateRawInternal(input, mergedOpts);
}

/**
 * 商談レコードから提案書を生成する。
 */
export function generateFromDeal(
  deal: Deal,
  opts: Partial<ProposalGenerationOptions> = {},
): ProposalDocument {
  const mergedOpts: ProposalGenerationOptions = { ...DEFAULT_GENERATION_OPTIONS, ...opts };

  // Deal には workCategory 情報がないため、デフォルト値を使用
  // 実際には Deal に workCategory を付与するか、関連 InquiryRecord から取得
  const input: ProposalGenerationInput = {
    dealId: deal.id,
    inquiryId: deal.inquiryId,
    workCategory: "other",
    workScale: "medium",
    locationCity: "東京都",
    budgetHintJpy: deal.expectedAmountJpy,
    customerName: deal.customerName,
  };

  return generateRawInternal(input, mergedOpts);
}

/**
 * 入力値を直接指定して提案書を生成する。
 */
export function generateRaw(
  input: ProposalGenerationInput,
  opts: Partial<ProposalGenerationOptions> = {},
): ProposalDocument {
  const mergedOpts: ProposalGenerationOptions = { ...DEFAULT_GENERATION_OPTIONS, ...opts };
  return generateRawInternal(input, mergedOpts);
}

/**
 * 既存の提案書の特定セクションを再生成する。
 */
export function regenerateSection(
  docId: string,
  sectionKind: ProposalSectionKind,
): ProposalDocument | null {
  const doc = proposalStore.get(docId);
  if (!doc) return null;

  // 元の入力を再構築して全体を再生成（セクション単位の部分再生成）
  const input: ProposalGenerationInput = {
    dealId: doc.dealId,
    inquiryId: doc.inquiryId,
    workCategory: "other",
    workScale: "medium",
    locationCity: "東京都",
    budgetHintJpy: doc.totalPriceJpyLower,
    customerName: doc.customerName,
  };

  ensureSeeds();

  const allStrengths = strengthStore.getAll();
  const allCases = caseStudyStore.getAll();
  const allDiff = differentiationStore.getAll();

  const strengths = selectRelevantStrengths(input, allStrengths);
  const cases = matchCases(input, allCases);
  const diffPoints = allDiff;

  const newDoc = compose(input, DEFAULT_GENERATION_OPTIONS, { strengths, cases, diffPoints });

  // Preserve original doc ID and replace only the target section
  const targetSection = newDoc.sections.find((s) => s.kind === sectionKind);
  if (!targetSection) return doc;

  const updatedSections = doc.sections.map((s) =>
    s.kind === sectionKind ? { ...targetSection } : s,
  );

  const updatedDoc: ProposalDocument = {
    ...doc,
    sections: updatedSections,
    generatedAt: new Date().toISOString(),
  };

  proposalStore.save(updatedDoc);
  return updatedDoc;
}
