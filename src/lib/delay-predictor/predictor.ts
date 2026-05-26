/**
 * 工程遅延予測AI — メイン予測エンジン
 *
 * 天候リスク×労務リスク×種別ベースラインリスクを重み付き合算して
 * DelayPrediction を返す。
 */

import type {
  DelayPrediction,
  HistoricalTaskRecord,
  LaborAvailability,
  PredictionConfig,
  RiskLevel,
} from "./types.js";
import { DEFAULT_PREDICTION_CONFIG, WeatherCondition } from "./types.js";
import { calculateWeatherRisk } from "./weather-impact.js";
import { calculateLaborRisk } from "./labor-impact.js";
import { calculateKindBaselineRisk } from "./baseline-by-kind.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function resolveRiskLevel(riskPct: number): RiskLevel {
  if (riskPct >= 85) return "critical";
  if (riskPct >= 60) return "high";
  if (riskPct >= 30) return "medium";
  return "low";
}

function resolveSuggestedAction(level: RiskLevel): string {
  switch (level) {
    case "critical":
      return "直ちに工程見直し+応援職人手配";
    case "high":
      return "予備日確保+雨天時室内作業切替";
    case "medium":
      return "天気予報を毎朝確認";
    case "low":
      return "予定通り進行可";
  }
}

// ── 公開API ───────────────────────────────────────────────────────────────────

export type TaskInput = {
  taskId: string;
  projectId: string;
  taskKind: string;
};

/**
 * 1タスクの遅延リスクを予測する。
 *
 * @param task       対象タスク情報
 * @param weather    予測天候リスト (5日程度を想定)
 * @param labor      労務稼働データ
 * @param history    過去タスク実績 (HistoricalStore から渡す)
 * @param config     重み設定 (省略時: DEFAULT_PREDICTION_CONFIG)
 */
export function predictDelay(
  task: TaskInput,
  weather: WeatherCondition[],
  labor: LaborAvailability[],
  history: HistoricalTaskRecord[],
  config: PredictionConfig = DEFAULT_PREDICTION_CONFIG,
): DelayPrediction {
  const weatherRisk = calculateWeatherRisk(weather);
  const laborRisk = calculateLaborRisk(labor);
  const kindBaselineRisk = calculateKindBaselineRisk(task.taskKind, history);

  const rawRisk =
    weatherRisk * config.weatherWeight +
    laborRisk * config.laborWeight +
    kindBaselineRisk * config.kindWeight;

  const riskPct = Math.min(100, Math.round(rawRisk));
  const riskLevel = resolveRiskLevel(riskPct);

  return {
    taskId: task.taskId,
    projectId: task.projectId,
    riskPct,
    riskLevel,
    factors: {
      weatherRisk,
      laborRisk,
      kindBaselineRisk,
    },
    suggestedAction_ja: resolveSuggestedAction(riskLevel),
  };
}
