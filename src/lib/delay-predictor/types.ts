/**
 * 工程遅延予測AI — 型定義 (Sprint 13-A)
 *
 * 過去案件×天候×職人稼働率から各工程の遅延リスクを予測。
 * 外部API不使用。ルールベース + 重み付き合算。
 */

// ── 天候 ─────────────────────────────────────────────────────────────────────

export enum WeatherCondition {
  sunny = "sunny",
  cloudy = "cloudy",
  rain = "rain",
  heavy_rain = "heavy_rain",
  snow = "snow",
}

// ── 労務稼働 ─────────────────────────────────────────────────────────────────

export type LaborAvailability = {
  date: string; // ISO 8601 date (YYYY-MM-DD)
  available_workers: number;
  required_workers: number;
};

// ── 過去タスク実績 ───────────────────────────────────────────────────────────

export type HistoricalTaskRecord = {
  id: string;
  taskKind: string;
  plannedDays: number;
  actualDays: number;
  weather: WeatherCondition[];
  laborAvailabilityRatio: number; // 0-1
  season: "spring" | "summer" | "autumn" | "winter";
};

// ── 予測結果 ─────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type DelayPrediction = {
  taskId: string;
  projectId: string;
  /** 総合リスク (0-100) */
  riskPct: number;
  riskLevel: RiskLevel;
  factors: {
    weatherRisk: number;
    laborRisk: number;
    kindBaselineRisk: number;
  };
  /** 日本語の推奨アクション */
  suggestedAction_ja: string;
};

// ── 予測設定 ─────────────────────────────────────────────────────────────────

export type PredictionConfig = {
  weatherWeight: number; // default: 0.35
  laborWeight: number;   // default: 0.40
  kindWeight: number;    // default: 0.25
};

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  weatherWeight: 0.35,
  laborWeight: 0.40,
  kindWeight: 0.25,
};
