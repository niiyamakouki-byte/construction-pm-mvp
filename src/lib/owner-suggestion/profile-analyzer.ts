/**
 * profile-analyzer — OwnerProfile から推奨優先項目を導出する。
 *
 * Sprint 18-A: 施主提案AI
 */

import type { OwnerProfile, LifestyleTag } from "./types.js";

export type ProfileAnalysis = {
  /** 推奨優先事項リスト (日本語) */
  recommendedPrioritiesJa: string[];
  /** 材料別推奨コメント */
  materialRecommendations: { location: string; recommendationJa: string }[];
  /** 介護対応強調フラグ */
  emphasizeElderlycare: boolean;
  /** ペット対応強調フラグ */
  emphasizePetFriendly: boolean;
};

// ── Lifestyle tag → recommendations ────────────────────────────────────────

const LIFESTYLE_PRIORITIES: Record<LifestyleTag, string[]> = {
  cooking: [
    "IH コンロ + 大型レンジフード",
    "食洗機付きシステムキッチン",
    "キッチン収納の充実",
  ],
  work_from_home: [
    "防音性の高い壁材",
    "書斎・ワークスペース確保",
    "電源・LAN配線の増設",
  ],
  entertain_guests: [
    "開放的なLDKレイアウト",
    "来客用収納スペース",
    "高品質フローリング（見栄え重視）",
  ],
  pet_owner: [
    "耐傷フローリング（ペット対応）",
    "消臭・抗菌壁紙",
    "ペット用足洗いスペース",
  ],
  elderly_care: [
    "バリアフリー設計（段差解消）",
    "手すり設置対応壁補強",
    "滑りにくい床材",
    "廊下幅 90cm以上確保",
  ],
};

const LIFESTYLE_MATERIAL_RECS: Record<LifestyleTag, { location: string; recommendationJa: string }[]> = {
  cooking: [
    { location: "キッチン壁", recommendationJa: "油跳ね対応タイル or キッチンパネル" },
    { location: "キッチン床", recommendationJa: "耐水性クッションフロア or タイル" },
  ],
  work_from_home: [
    { location: "書斎壁", recommendationJa: "吸音パネル or 防音石膏ボード" },
    { location: "照明", recommendationJa: "調光・調色 LED ダウンライト" },
  ],
  entertain_guests: [
    { location: "LDK壁紙", recommendationJa: "高耐久撥水クロス（汚れ対応）" },
    { location: "LDK床", recommendationJa: "無垢風の高品質フローリング" },
  ],
  pet_owner: [
    { location: "居室床", recommendationJa: "UV塗装無垢 or ペット対応複合フロア" },
    { location: "居室壁紙", recommendationJa: "消臭・防汚機能付きクロス" },
  ],
  elderly_care: [
    { location: "廊下・浴室床", recommendationJa: "ノンスリップ仕上げ長尺シート" },
    { location: "壁（廊下・トイレ）", recommendationJa: "手すり用下地合板補強" },
  ],
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * OwnerProfile を分析して推奨優先項目を返す。
 */
export function analyzeProfile(profile: OwnerProfile): ProfileAnalysis {
  const recommendedPrioritiesJa: string[] = [];
  const materialRecommendations: { location: string; recommendationJa: string }[] = [];

  for (const tag of profile.lifestyle) {
    const priorities = LIFESTYLE_PRIORITIES[tag] ?? [];
    for (const p of priorities) {
      if (!recommendedPrioritiesJa.includes(p)) {
        recommendedPrioritiesJa.push(p);
      }
    }
    const recs = LIFESTYLE_MATERIAL_RECS[tag] ?? [];
    for (const r of recs) {
      const alreadyAdded = materialRecommendations.some((m) => m.location === r.location);
      if (!alreadyAdded) {
        materialRecommendations.push(r);
      }
    }
  }

  const emphasizeElderlycare =
    profile.lifestyle.includes("elderly_care") || profile.ageRange === "60s+";

  const emphasizePetFriendly = profile.lifestyle.includes("pet_owner");

  return {
    recommendedPrioritiesJa,
    materialRecommendations,
    emphasizeElderlycare,
    emphasizePetFriendly,
  };
}
