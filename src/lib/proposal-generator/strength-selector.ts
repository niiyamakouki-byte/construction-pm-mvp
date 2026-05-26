/**
 * strength-selector — workCategory 別の重み付けで強み3件を選定
 */

import type { LaportaStrength, ProposalGenerationInput, WorkCategory } from "./types.js";

// ── Category-specific weight boosts ───────────────────────────────────────
// strength id → category での追加ウェイト

const CATEGORY_BOOST: Record<WorkCategory, Record<string, number>> = {
  full_renovation: {
    "str-003": 0.5, // 自社職人多数
    "str-004": 0.4, // アフター10年保証
    "str-005": 0.3, // 設計AI
    "str-008": 0.3, // 3D完成イメージ
  },
  partial_renovation: {
    "str-005": 0.4, // 設計AI
    "str-006": 0.3, // LINE/Discord連携
    "str-001": 0.2, // 地域密着
  },
  kitchen: {
    "str-007": 0.5, // 材料コスト最適化
    "str-005": 0.3, // 設計AI
    "str-003": 0.2, // 自社職人
  },
  bath: {
    "str-003": 0.4, // 自社職人
    "str-007": 0.3, // 材料コスト最適化
    "str-004": 0.3, // アフター保証
  },
  store_fit: {
    "str-005": 0.5, // 設計AI
    "str-003": 0.4, // 自社職人
    "str-007": 0.3, // 材料コスト最適化
    "str-006": 0.2, // LINE/Discord
  },
  office_fit: {
    "str-002": 0.4, // 内装専門特化
    "str-005": 0.4, // 設計AI
    "str-006": 0.3, // コミュニケーション
  },
  exterior: {
    "str-007": 0.5, // 材料コスト最適化
    "str-003": 0.3, // 自社職人
    "str-004": 0.4, // アフター10年保証
  },
  repair: {
    "str-001": 0.4, // 地域密着
    "str-004": 0.3, // アフター保証
    "str-003": 0.3, // 自社職人
  },
  other: {
    "str-002": 0.3, // 内装専門特化
    "str-001": 0.2, // 地域密着
  },
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * workCategory 別の重み付けで強み3件を選定して返す。
 * 常に3件選定 (全件数が3件未満の場合は全件返す)。
 */
export function selectRelevantStrengths(
  input: ProposalGenerationInput,
  allStrengths: LaportaStrength[],
): LaportaStrength[] {
  if (allStrengths.length === 0) return [];

  const categoryBoost = CATEGORY_BOOST[input.workCategory] ?? {};

  type Scored = { strength: LaportaStrength; score: number };

  const scored: Scored[] = allStrengths.map((s) => {
    const boost = categoryBoost[s.id] ?? 0;
    const score = s.weight + boost;
    return { strength: s, score };
  });

  // Sort descending by score, then by id for stable ordering
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.strength.id.localeCompare(b.strength.id);
  });

  return scored.slice(0, 3).map((s) => s.strength);
}
