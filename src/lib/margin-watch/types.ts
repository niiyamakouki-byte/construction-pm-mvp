/**
 * Margin Watch — shared types.
 *
 * All monetary values are in JPY (円).
 * 粗利率の閾値:
 *   safe     ≥ 30%
 *   caution  25–30%
 *   warning  15–25%
 *   critical < 15%
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type MarginAlertLevel = "safe" | "caution" | "warning" | "critical";

// ── Domain objects ─────────────────────────────────────────────────────────

export type ProjectFinanceSnapshot = {
  projectId: string;
  projectName: string;
  /** 受注額 (JPY) */
  contractAmountYen: number;
  /** 実原価合計 (JPY) */
  totalCostYen: number;
  /** 予測残原価 (EAC ベース, JPY) */
  estimatedRemainingCostYen: number;
  /** 実粗利率 (%) — calculateMargin が計算して上書きするが input にも乗せる */
  marginRatioPct: number;
  /** 予測粗利率 (%) — EAC ベース */
  forecastMarginRatioPct: number;
};

export type MarginAlert = {
  id: string;
  projectId: string;
  projectName: string;
  level: MarginAlertLevel;
  marginRatioPct: number;
  forecastMarginRatioPct: number;
  /** target(25%) からの乖離 (%) — 負値なら目標未達 */
  deltaFromTargetPct: number;
  /** 原因タグ (例: "受注額減", "原価増") */
  causeTag: string[];
  /** 改善アクション (日本語) */
  suggestedAction_ja: string;
  /** ISO 8601 */
  raisedAt: string;
};

// ── Config ─────────────────────────────────────────────────────────────────

export type MarginWatchConfig = {
  /** 目標粗利率 (%) — デフォルト 25 */
  targetMarginPct: number;
  /** critical 閾値 (%) — デフォルト 15 */
  criticalMarginPct: number;
  /** caution 閾値 (%) — デフォルト 30 */
  cautionMarginPct: number;
};

export const DEFAULT_MARGIN_WATCH_CONFIG: MarginWatchConfig = {
  targetMarginPct: 25,
  criticalMarginPct: 15,
  cautionMarginPct: 30,
};
