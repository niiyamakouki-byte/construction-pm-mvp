/**
 * plan-generator — OwnerProfile と予算から3案の SuggestionPlan を生成する。
 *
 * Sprint 18-A: 施主提案AI
 */

import type {
  OwnerProfile,
  SuggestionPlan,
  SuggestionPlanKind,
  MaterialHighlight,
  MaintenanceForecast,
} from "./types.js";
import { analyzeProfile } from "./profile-analyzer.js";

// ── Material grade definitions ─────────────────────────────────────────────

type GradeSpec = {
  wallpaper: string;
  floor: string;
  kitchen: string;
};

const GRADE_SPECS: Record<"budget" | "mid" | "premium", GradeSpec> = {
  budget: {
    wallpaper: "量産品クロス（1000番クロス以下）",
    floor: "シート系フロア（CF・長尺シート）",
    kitchen: "普及グレードシステムキッチン",
  },
  mid: {
    wallpaper: "1000番クロス（中グレード・量産上位）",
    floor: "突板フロア（複合フローリング）",
    kitchen: "システムキッチン中位（食洗機標準）",
  },
  premium: {
    wallpaper: "織物クロス（高機能防汚・調湿）",
    floor: "無垢フロア（ウォールナット or オーク）",
    kitchen: "高機能システムキッチン（セラミックカウンター）",
  },
};

// ── Plan kind selection logic ──────────────────────────────────────────────

function selectPlanKind(
  base: "budget_focused" | "balanced" | "premium",
  profile: OwnerProfile,
): SuggestionPlanKind {
  if (base === "balanced") {
    if (profile.priorityRanking === "designFirst") return "design_focused";
    if (profile.familySize >= 3 && profile.lifestyle.includes("pet_owner")) return "family_friendly";
    if (profile.lifestyle.includes("elderly_care") && profile.ageRange === "60s+") return "family_friendly";
  }
  if (base === "budget_focused" && profile.priorityRanking === "priceFirst") return "budget_focused";
  if (base === "premium" && profile.priorityRanking === "qualityFirst") return "premium";
  return base;
}

// ── Plan builders ──────────────────────────────────────────────────────────

function buildMaterialHighlights(
  grade: GradeSpec,
  profile: OwnerProfile,
): MaterialHighlight[] {
  const highlights: MaterialHighlight[] = [
    {
      location: "LDK壁紙",
      materialName: grade.wallpaper,
      featureJa: "施工性・コスパのバランス",
    },
    {
      location: "床材",
      materialName: grade.floor,
      featureJa: "耐久性と清掃性を重視",
    },
    {
      location: "キッチン",
      materialName: grade.kitchen,
      featureJa: "調理性能と収納量を確保",
    },
  ];

  if (profile.lifestyle.includes("pet_owner")) {
    highlights.push({
      location: "居室床（ペット対応）",
      materialName: "UV塗装複合フロア（傷防止加工）",
      featureJa: "引っ掻き傷・滑りに強い",
    });
  }
  if (profile.lifestyle.includes("elderly_care") || profile.ageRange === "60s+") {
    highlights.push({
      location: "廊下・浴室床",
      materialName: "ノンスリップ仕上げシート",
      featureJa: "転倒リスク低減・バリアフリー対応",
    });
  }

  return highlights;
}

function buildMaintenanceForecast(): MaintenanceForecast[] {
  return [
    { intervalMonths: 6, descriptionJa: "半年点検：設備動作確認・排水清掃" },
    { intervalMonths: 12, descriptionJa: "1年点検：壁紙・シーリング状態確認" },
    { intervalMonths: 60, descriptionJa: "5年点検：外装・防水・設備フルチェック" },
  ];
}

function buildRationale(
  profile: OwnerProfile,
  planKind: SuggestionPlanKind,
  analysis: ReturnType<typeof analyzeProfile>,
): string {
  const priorities = analysis.recommendedPrioritiesJa.slice(0, 3).join("、");
  const kindLabel =
    planKind === "budget_focused"
      ? "コスト重視"
      : planKind === "premium"
        ? "上質素材"
        : planKind === "design_focused"
          ? "デザイン性"
          : planKind === "family_friendly"
            ? "家族全員が快適"
            : "品質とコストのバランス";

  return `${profile.ownerName}様のライフスタイル（${profile.lifestyle.join("・")}）を踏まえ、${kindLabel}を主軸に設計しました。特に「${priorities || "快適な住環境"}」を優先しています。`;
}

// ── Public API ─────────────────────────────────────────────────────────────

let _planCounter = 0;

function newPlanId(): string {
  return `sp-${Date.now()}-${++_planCounter}`;
}

/**
 * OwnerProfile と予算目標から3案の SuggestionPlan を生成する。
 */
export function generateThreePlans(
  profile: OwnerProfile,
  budgetTarget: number,
): [SuggestionPlan, SuggestionPlan, SuggestionPlan] {
  const analysis = analyzeProfile(profile);

  const budgetKind = selectPlanKind("budget_focused", profile);
  const balancedKind = selectPlanKind("balanced", profile);
  const premiumKind = selectPlanKind("premium", profile);

  const budgetCost = Math.round(budgetTarget * 0.85);
  const balancedCost = budgetTarget;
  const premiumCost = Math.round(budgetTarget * 1.2);

  const budgetDays = 45;
  const balancedDays = 55;
  const premiumDays = 70;

  const plan1: SuggestionPlan = {
    id: newPlanId(),
    kind: budgetKind,
    status: "draft",
    titleJa: "コストプラン",
    conceptJa: "必要十分な仕様で、予算内に収める実用的なプランです。普及グレード材料を中心に、機能性を確保しつつコストを抑えます。",
    estimatedCost: budgetCost,
    estimatedDays: budgetDays,
    rationaleJa: buildRationale(profile, budgetKind, analysis),
    materialHighlights: buildMaterialHighlights(GRADE_SPECS.budget, profile),
    maintenanceForecast: buildMaintenanceForecast(),
    riskNotes: [
      "普及グレード材料のため将来的な張替えサイクルがやや早い",
      "設備グレードが低めのため修繕費用が早期に発生する場合あり",
    ],
  };

  const plan2: SuggestionPlan = {
    id: newPlanId(),
    kind: balancedKind,
    status: "draft",
    titleJa: "バランスプラン",
    conceptJa: "品質とコストのバランスを取った最も選ばれるプランです。中グレード材料で長期的な満足度を確保します。",
    estimatedCost: balancedCost,
    estimatedDays: balancedDays,
    rationaleJa: buildRationale(profile, balancedKind, analysis),
    materialHighlights: buildMaterialHighlights(GRADE_SPECS.mid, profile),
    maintenanceForecast: buildMaintenanceForecast(),
    riskNotes: [
      "予算の±10%変動が施工内容に影響する場合があります",
    ],
  };

  const plan3: SuggestionPlan = {
    id: newPlanId(),
    kind: premiumKind,
    status: "draft",
    titleJa: "プレミアムプラン",
    conceptJa: "上質な素材と設備で、長期にわたって満足できる空間を実現するプランです。メンテナンスコストを抑えた資産価値の高い仕上がりです。",
    estimatedCost: premiumCost,
    estimatedDays: premiumDays,
    rationaleJa: buildRationale(profile, premiumKind, analysis),
    materialHighlights: buildMaterialHighlights(GRADE_SPECS.premium, profile),
    maintenanceForecast: buildMaintenanceForecast(),
    riskNotes: [
      "予算を20%超過するため資金計画の確認が必要です",
      "無垢材は季節による伸縮があります。定期的なメンテナンスを推奨します",
    ],
  };

  return [plan1, plan2, plan3];
}
