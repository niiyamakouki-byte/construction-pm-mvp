/**
 * case-study-matcher — 過去施工事例から類似案件をマッチングする。
 *
 * Sprint 18-A: 施主提案AI
 */

import type { OwnerProfile, SuggestionPlanKind, LifestyleTag } from "./types.js";

// ── Case study DB (hardcoded 15 cases) ────────────────────────────────────

type CaseStudyRecord = {
  id: string;
  titleJa: string;
  summaryJa: string;
  /** 築年数 */
  buildingAge: number;
  /** 間取り (例: "2LDK", "3LDK") */
  layout: string;
  /** 予算帯 (万円) */
  budgetManJpy: number;
  /** 採用材料タグ */
  materialTags: string[];
  /** ライフスタイルタグ */
  lifestyleTags: LifestyleTag[];
  /** 施主満足度 (1-5) */
  satisfactionScore: number;
};

const CASE_STUDIES: CaseStudyRecord[] = [
  {
    id: "cs-001", titleJa: "南青山 3LDK フルリノベ（料理好き夫婦）",
    summaryJa: "IHキッチン拡張+大型レンジフードで料理空間を最適化。アイランドキッチン採用で開放感UP。",
    buildingAge: 20, layout: "3LDK", budgetManJpy: 800, materialTags: ["タイル", "無垢フロア"],
    lifestyleTags: ["cooking", "entertain_guests"], satisfactionScore: 5,
  },
  {
    id: "cs-002", titleJa: "世田谷区 2LDK コンパクトリノベ（単身）",
    summaryJa: "限られた予算で機能性を最大化。シート系フロアと量産クロスで施工コスト削減。",
    buildingAge: 30, layout: "2LDK", budgetManJpy: 300, materialTags: ["CFシート", "量産クロス"],
    lifestyleTags: ["work_from_home"], satisfactionScore: 4,
  },
  {
    id: "cs-003", titleJa: "港区 4LDK ファミリーリノベ（3人家族 + 猫）",
    summaryJa: "ペット対応フロア全室採用。消臭クロスと足洗いスペース新設で快適なペットライフ。",
    buildingAge: 15, layout: "4LDK", budgetManJpy: 1200, materialTags: ["UV塗装複合フロア", "消臭クロス"],
    lifestyleTags: ["pet_owner", "entertain_guests"], satisfactionScore: 5,
  },
  {
    id: "cs-004", titleJa: "目黒区 3LDK バリアフリー改修（60代夫婦）",
    summaryJa: "廊下拡張と手すり全室設置。段差解消と滑り止め床材でご高齢でも安心の住まい。",
    buildingAge: 35, layout: "3LDK", budgetManJpy: 600, materialTags: ["ノンスリップシート", "手すり"],
    lifestyleTags: ["elderly_care"], satisfactionScore: 5,
  },
  {
    id: "cs-005", titleJa: "渋谷区 1LDK 在宅ワーク特化リノベ",
    summaryJa: "書斎ゾーン新設と防音壁採用。LAN配線増設で快適なテレワーク環境を実現。",
    buildingAge: 18, layout: "1LDK", budgetManJpy: 400, materialTags: ["吸音パネル", "防音ボード"],
    lifestyleTags: ["work_from_home"], satisfactionScore: 4,
  },
  {
    id: "cs-006", titleJa: "新宿区 3LDK ゲスト対応リノベ（来客多め）",
    summaryJa: "リビング拡張とオープンキッチン採用。無垢フロアで高級感のある空間に。",
    buildingAge: 22, layout: "3LDK", budgetManJpy: 900, materialTags: ["無垢フロア", "タイル"],
    lifestyleTags: ["entertain_guests", "cooking"], satisfactionScore: 5,
  },
  {
    id: "cs-007", titleJa: "品川区 2LDK プレミアムフルリノベ（DINKS）",
    summaryJa: "セラミックカウンターキッチンと織物クロスで高品質空間。資産価値重視の仕上がり。",
    buildingAge: 10, layout: "2LDK", budgetManJpy: 1100, materialTags: ["織物クロス", "セラミック"],
    lifestyleTags: ["cooking", "entertain_guests"], satisfactionScore: 5,
  },
  {
    id: "cs-008", titleJa: "杉並区 3LDK ファミリーバランスリノベ",
    summaryJa: "子供部屋の防音対応と突板フロアで耐久性確保。コストと品質のバランスプラン。",
    buildingAge: 25, layout: "3LDK", budgetManJpy: 700, materialTags: ["突板フロア", "1000番クロス"],
    lifestyleTags: ["entertain_guests"], satisfactionScore: 4,
  },
  {
    id: "cs-009", titleJa: "豊島区 1LDK コスト重視リノベ",
    summaryJa: "量産材料を最大活用しつつ、清掃しやすいシート系フロアで実用的な仕上がり。",
    buildingAge: 40, layout: "1LDK", budgetManJpy: 200, materialTags: ["CFシート", "量産クロス"],
    lifestyleTags: [], satisfactionScore: 3,
  },
  {
    id: "cs-010", titleJa: "中野区 3LDK ペット+料理好きリノベ",
    summaryJa: "ペット対応床 + 業務用レンジフードで料理×ペットが両立できる住空間。",
    buildingAge: 28, layout: "3LDK", budgetManJpy: 850, materialTags: ["UV塗装フロア", "消臭クロス", "タイル"],
    lifestyleTags: ["pet_owner", "cooking"], satisfactionScore: 5,
  },
  {
    id: "cs-011", titleJa: "江東区 4LDK 大家族バリアフリーリノベ",
    summaryJa: "3世代同居を想定したバリアフリー設計。廊下90cm確保と全室スロープ化。",
    buildingAge: 32, layout: "4LDK", budgetManJpy: 1300, materialTags: ["手すり", "ノンスリップ"],
    lifestyleTags: ["elderly_care", "entertain_guests"], satisfactionScore: 5,
  },
  {
    id: "cs-012", titleJa: "文京区 2LDK デザイン特化リノベ",
    summaryJa: "モルタル風塗装壁と無垢フロアで、カフェのような空間を実現。インスタ映えを意識。",
    buildingAge: 20, layout: "2LDK", budgetManJpy: 950, materialTags: ["モルタル", "無垢フロア"],
    lifestyleTags: ["entertain_guests"], satisfactionScore: 4,
  },
  {
    id: "cs-013", titleJa: "墨田区 3LDK 在宅ワーク + 料理好きリノベ",
    summaryJa: "書斎と対面キッチンを両立。LAN + 調光 LED で快適なワーク×ライフバランス。",
    buildingAge: 17, layout: "3LDK", budgetManJpy: 750, materialTags: ["防音ボード", "1000番クロス"],
    lifestyleTags: ["work_from_home", "cooking"], satisfactionScore: 4,
  },
  {
    id: "cs-014", titleJa: "台東区 2LDK シニア向け安全リノベ",
    summaryJa: "浴室手すり + 段差解消 + 滑り止め床で転倒防止。ヒートショック対策断熱も施工。",
    buildingAge: 38, layout: "2LDK", budgetManJpy: 500, materialTags: ["ノンスリップシート", "手すり"],
    lifestyleTags: ["elderly_care"], satisfactionScore: 5,
  },
  {
    id: "cs-015", titleJa: "荒川区 3LDK コスパ重視ファミリーリノベ",
    summaryJa: "子供3人の5人家族向け。CFシート + 量産クロスで広さを確保しつつコストを最小化。",
    buildingAge: 42, layout: "3LDK", budgetManJpy: 450, materialTags: ["CFシート", "量産クロス"],
    lifestyleTags: [], satisfactionScore: 3,
  },
];

// ── Scoring ────────────────────────────────────────────────────────────────

type MatchScore = {
  caseStudyId: string;
  titleJa: string;
  similarity: number;
  summaryJa: string;
};

function computeSimilarity(
  profile: OwnerProfile,
  planKind: SuggestionPlanKind,
  cs: CaseStudyRecord,
): number {
  let score = 0;

  // Budget match: ±20%
  const budgetMan = profile.budget / 10000;
  const ratio = cs.budgetManJpy / budgetMan;
  if (ratio >= 0.8 && ratio <= 1.2) score += 0.4;
  else if (ratio >= 0.6 && ratio <= 1.4) score += 0.2;

  // Lifestyle tag match
  const matchingTags = profile.lifestyle.filter((t) => cs.lifestyleTags.includes(t));
  if (profile.lifestyle.length > 0) {
    score += 0.4 * (matchingTags.length / profile.lifestyle.length);
  } else {
    score += 0.2; // neutral
  }

  // Plan kind hint
  if (planKind === "budget_focused" && cs.budgetManJpy <= budgetMan * 0.9) score += 0.1;
  if (planKind === "premium" && cs.budgetManJpy >= budgetMan * 1.1) score += 0.1;

  // Satisfaction bonus
  score += (cs.satisfactionScore - 3) * 0.025; // -0.05 ~ +0.05

  return Math.min(1, Math.max(0, score));
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * OwnerProfile とプランKindに基づいて類似施工事例 top 3 を返す。
 */
export function matchCaseStudies(
  profile: OwnerProfile,
  planKind: SuggestionPlanKind,
): MatchScore[] {
  const scored = CASE_STUDIES.map((cs) => ({
    caseStudyId: cs.id,
    titleJa: cs.titleJa,
    summaryJa: cs.summaryJa,
    similarity: computeSimilarity(profile, planKind, cs),
  }));

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}
