/**
 * PML (Probable Maximum Loss) 計算
 * Sprint 60-C: 工事保険AI査定 + ドローン現場検証
 *
 * PML = baseRate × structureFactor × ageMultiplier × (1 - retrofitDiscount)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type StructureType =
  | "wood" // 木造
  | "light_steel" // 軽量鉄骨造
  | "steel" // 鉄骨造
  | "src" // 鉄骨鉄筋コンクリート造
  | "rc"; // 鉄筋コンクリート造

export type SeismicGrade =
  | "pre_1981" // 旧耐震 (1981年以前)
  | "standard_1981" // 新耐震 (1981〜2000年)
  | "enhanced_2000"; // 2000年基準以降

export type PmlInput = {
  /** 構造種別 */
  structureType: StructureType;
  /** 耐震診断グレード */
  seismicGrade: SeismicGrade;
  /** 建物築年数 */
  buildingAgeYears: number;
  /** 過去10年の損害件数 */
  damageHistoryCount: number;
  /** 耐震補強済みフラグ */
  retrofitCompleted: boolean;
  /** 耐震補強年数前 (retrofitCompletedがtrueの場合) */
  retrofitYearsAgo?: number;
};

export type PmlResult = {
  /** PML% (0〜100) */
  pmlPercent: number;
  /** 各係数の内訳 */
  breakdown: {
    baseRate: number;
    structureFactor: number;
    ageMultiplier: number;
    retrofitDiscount: number;
  };
  /** リスク評価ラベル */
  riskLevel: "very_low" | "low" | "medium" | "high" | "very_high";
  /** 備考 */
  notes: string[];
};

// ── Coefficient tables ─────────────────────────────────────────────────────

/** 基準PML率 by 耐震グレード */
const BASE_RATE: Record<SeismicGrade, number> = {
  pre_1981: 0.35,
  standard_1981: 0.2,
  enhanced_2000: 0.1,
};

/** 構造種別係数 */
const STRUCTURE_FACTOR: Record<StructureType, number> = {
  wood: 1.4,
  light_steel: 1.2,
  steel: 1.0,
  src: 0.75,
  rc: 0.8,
};

const STRUCTURE_LABELS: Record<StructureType, string> = {
  wood: "木造",
  light_steel: "軽量鉄骨造",
  steel: "鉄骨造",
  src: "SRC造",
  rc: "RC造",
};

const SEISMIC_LABELS: Record<SeismicGrade, string> = {
  pre_1981: "旧耐震",
  standard_1981: "新耐震(1981〜2000年基準)",
  enhanced_2000: "2000年基準以降",
};

/** PML% からリスクレベルへのマッピング */
function classifyRisk(pmlPercent: number): PmlResult["riskLevel"] {
  if (pmlPercent < 10) return "very_low";
  if (pmlPercent < 20) return "low";
  if (pmlPercent < 35) return "medium";
  if (pmlPercent < 50) return "high";
  return "very_high";
}

// ── calculatePml ───────────────────────────────────────────────────────────

/**
 * PML(%)を算出する
 *
 * 計算式:
 *   PML = baseRate × structureFactor × ageMultiplier × (1 - retrofitDiscount)
 *   + damageHistorySurcharge
 */
export function calculatePml(input: PmlInput): PmlResult {
  const {
    structureType,
    seismicGrade,
    buildingAgeYears,
    damageHistoryCount,
    retrofitCompleted,
    retrofitYearsAgo = 0,
  } = input;

  const notes: string[] = [];
  const baseRate = BASE_RATE[seismicGrade];
  const structureFactor = STRUCTURE_FACTOR[structureType];

  notes.push(`耐震グレード: ${SEISMIC_LABELS[seismicGrade]} → 基準率${(baseRate * 100).toFixed(0)}%`);
  notes.push(`構造種別: ${STRUCTURE_LABELS[structureType]} → 係数×${structureFactor}`);

  // 築年数係数: 築30年超で1.3、10年未満で0.9
  let ageMultiplier: number;
  if (buildingAgeYears < 10) {
    ageMultiplier = 0.9;
    notes.push(`築${buildingAgeYears}年 (新築) → 年数係数×0.90`);
  } else if (buildingAgeYears <= 20) {
    ageMultiplier = 1.0;
    notes.push(`築${buildingAgeYears}年 → 年数係数×1.00`);
  } else if (buildingAgeYears <= 30) {
    ageMultiplier = 1.15;
    notes.push(`築${buildingAgeYears}年 (築古) → 年数係数×1.15`);
  } else {
    ageMultiplier = 1.3;
    notes.push(`築${buildingAgeYears}年 (旧建物) → 年数係数×1.30`);
  }

  // 耐震補強割引
  let retrofitDiscount = 0;
  if (retrofitCompleted) {
    // 補強後の経過年数が長いほど割引効果が薄れる
    const yearsDecay = Math.min(retrofitYearsAgo / 20, 0.5);
    retrofitDiscount = Math.max(0.25 - yearsDecay * 0.1, 0.1);
    notes.push(`耐震補強済み (${retrofitYearsAgo}年前) → 割引${(retrofitDiscount * 100).toFixed(0)}%`);
  }

  // 損害履歴サーチャージ
  const damageHistorySurcharge = Math.min(damageHistoryCount * 0.02, 0.1);
  if (damageHistoryCount > 0) {
    notes.push(`損害履歴${damageHistoryCount}件 → サーチャージ+${(damageHistorySurcharge * 100).toFixed(0)}%`);
  }

  const rawPml = baseRate * structureFactor * ageMultiplier * (1 - retrofitDiscount) + damageHistorySurcharge;
  const pmlPercent = Math.min(Math.round(rawPml * 100 * 10) / 10, 100);

  const riskLevel = classifyRisk(pmlPercent);

  return {
    pmlPercent,
    breakdown: {
      baseRate,
      structureFactor,
      ageMultiplier,
      retrofitDiscount,
    },
    riskLevel,
    notes,
  };
}
