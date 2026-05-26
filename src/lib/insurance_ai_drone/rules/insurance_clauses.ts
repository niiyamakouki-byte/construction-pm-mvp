/**
 * 損害保険協会 工事保険約款 + IRDR国際基準 ルール辞書
 * Sprint 60-C: 工事保険AI査定エンジン
 */

export type DamageType = "fire" | "water" | "theft" | "earthquake" | "third_party";

export type InsuranceClause = {
  id: string;
  articleNumber: string;
  title: string;
  description: string;
  applicableDamageTypes: DamageType[];
  deductibleRate: number; // 0.0〜1.0 (免責割合)
  coverageRatio: number; // 0.0〜1.0 (補償割合)
  irrdrReference?: string; // IRDR国際基準参照番号
};

export const INSURANCE_CLAUSES: InsuranceClause[] = [
  {
    id: "clause_001",
    articleNumber: "第3条",
    title: "火災・爆発損害",
    description: "火災、落雷、爆発または破裂による損害を補償する",
    applicableDamageTypes: ["fire"],
    deductibleRate: 0.0,
    coverageRatio: 1.0,
    irrdrReference: "IRDR-F-101",
  },
  {
    id: "clause_002",
    articleNumber: "第4条",
    title: "水濡れ損害",
    description: "給排水管の破損、水漏れ、洪水等による水濡れ損害を補償する",
    applicableDamageTypes: ["water"],
    deductibleRate: 0.1,
    coverageRatio: 0.9,
    irrdrReference: "IRDR-W-201",
  },
  {
    id: "clause_003",
    articleNumber: "第5条",
    title: "盗難・破壊損害",
    description: "盗難、ひったくりまたは不法な侵入者による損害を補償する",
    applicableDamageTypes: ["theft"],
    deductibleRate: 0.1,
    coverageRatio: 0.85,
    irrdrReference: "IRDR-T-301",
  },
  {
    id: "clause_004",
    articleNumber: "第6条",
    title: "地震・噴火・津波損害",
    description: "地震もしくは噴火またはこれらによる津波による損害を補償する（特約要）",
    applicableDamageTypes: ["earthquake"],
    deductibleRate: 0.2,
    coverageRatio: 0.5,
    irrdrReference: "IRDR-E-401",
  },
  {
    id: "clause_005",
    articleNumber: "第7条",
    title: "第三者賠償責任",
    description: "工事作業中の第三者への身体障害・財物損害に対する賠償責任を補償する",
    applicableDamageTypes: ["third_party"],
    deductibleRate: 0.05,
    coverageRatio: 0.95,
    irrdrReference: "IRDR-L-501",
  },
  {
    id: "clause_006",
    articleNumber: "第8条",
    title: "自然災害包括免責",
    description: "台風・暴風雨・豪雨による損害で予見可能かつ防止措置未実施の場合は免責",
    applicableDamageTypes: ["water", "earthquake"],
    deductibleRate: 0.3,
    coverageRatio: 0.7,
    irrdrReference: "IRDR-N-601",
  },
];

/** 損害種別に適用される約款一覧を返す */
export function getClausesForDamageType(damageType: DamageType): InsuranceClause[] {
  return INSURANCE_CLAUSES.filter((c) => c.applicableDamageTypes.includes(damageType));
}

/** 損害種別ごとの基本補償率（主約款の coverageRatio） */
export function getPrimaryCoverageRatio(damageType: DamageType): number {
  const clauses = getClausesForDamageType(damageType);
  if (clauses.length === 0) return 0;
  // 最初の適用約款（主要約款）の補償率を返す
  return clauses[0].coverageRatio;
}

/** 損害種別ごとの基本免責率 */
export function getPrimaryDeductibleRate(damageType: DamageType): number {
  const clauses = getClausesForDamageType(damageType);
  if (clauses.length === 0) return 0;
  return clauses[0].deductibleRate;
}
