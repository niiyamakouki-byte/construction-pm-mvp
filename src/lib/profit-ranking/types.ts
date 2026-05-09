/**
 * Profit Ranking — shared types.
 *
 * Sprint 14-A: 案件粗利ランキング
 * All monetary values are in JPY (円).
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type RankingSortKey =
  | "marginRatioPct"
  | "marginAmount"
  | "marginPerMonth"
  | "forecastDelta";

export type RankingBadge = "top" | "warning" | "stable";

// ── Domain objects ─────────────────────────────────────────────────────────

export type ProjectProfitMetrics = {
  projectId: string;
  projectName: string;
  /** 受注額 (JPY) */
  orderAmount: number;
  /** 実原価合計 (JPY) */
  actualCost: number;
  /** 予測原価 (EAC: 実原価 + 見込残原価) (JPY) */
  forecastCost: number;
  /** 実粗利金額 (JPY) */
  marginAmount: number;
  /** 実粗利率 (%) */
  marginRatioPct: number;
  /** 予測粗利率 (%) — EAC ベース */
  forecastMarginRatioPct: number;
  /** 工期 (月) — startDate から endDate or 今日まで */
  durationMonths: number;
  /** 月割粗利 (JPY/月) — marginAmount / durationMonths */
  marginPerMonth: number;
  /** 顧客名 */
  clientName: string;
  /** 案件種別 */
  projectKind: string;
};

export type ProfitRankingEntry = {
  rank: number;
  projectMetrics: ProjectProfitMetrics;
  /** ソートキーに対するスコア寄与率 (0–100) */
  scoreContribution: number;
  badge: RankingBadge;
};

export type ProfitRankingSnapshot = {
  entries: ProfitRankingEntry[];
  /** ISO 8601 */
  generatedAt: string;
  sortKey: RankingSortKey;
  totalProjects: number;
  /** 全案件の平均粗利率 (%) */
  avgMarginRatioPct: number;
};
