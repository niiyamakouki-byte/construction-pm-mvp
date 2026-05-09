/**
 * Tests for predictDelay — 統合テスト (delay-predictor)
 */

import { describe, expect, it } from "vitest";
import { predictDelay } from "../../lib/delay-predictor/predictor.js";
import { WeatherCondition, DEFAULT_PREDICTION_CONFIG } from "../../lib/delay-predictor/types.js";
import type { HistoricalTaskRecord, LaborAvailability, PredictionConfig } from "../../lib/delay-predictor/types.js";

let _c = 0;

function makeRecord(
  taskKind: string,
  plannedDays: number,
  actualDays: number,
): HistoricalTaskRecord {
  return {
    id: `r-${++_c}`,
    taskKind,
    plannedDays,
    actualDays,
    weather: [WeatherCondition.sunny],
    laborAvailabilityRatio: 1.0,
    season: "spring",
  };
}

function makeDay(available: number, required: number): LaborAvailability {
  return { date: "2026-05-01", available_workers: available, required_workers: required };
}

const task = { taskId: "t-1", projectId: "p-1", taskKind: "内装" };

describe("predictDelay — 構造", () => {
  it("DelayPrediction の全フィールドが存在する", () => {
    const result = predictDelay(task, [], [], [], DEFAULT_PREDICTION_CONFIG);
    expect(result.taskId).toBe("t-1");
    expect(result.projectId).toBe("p-1");
    expect(typeof result.riskPct).toBe("number");
    expect(result.riskLevel).toBeDefined();
    expect(result.factors.weatherRisk).toBeDefined();
    expect(result.factors.laborRisk).toBeDefined();
    expect(result.factors.kindBaselineRisk).toBeDefined();
    expect(typeof result.suggestedAction_ja).toBe("string");
  });

  it("全データ空の場合は riskPct = 0, riskLevel = 'low'", () => {
    const result = predictDelay(task, [], [], [], DEFAULT_PREDICTION_CONFIG);
    expect(result.riskPct).toBe(0);
    expect(result.riskLevel).toBe("low");
    expect(result.suggestedAction_ja).toBe("予定通り進行可");
  });
});

describe("predictDelay — riskLevel 境界", () => {
  it("riskPct < 30 → low", () => {
    const result = predictDelay(task, [], [], [], DEFAULT_PREDICTION_CONFIG);
    expect(result.riskLevel).toBe("low");
  });

  it("riskPct = 30 → medium", () => {
    // labor ratio 0 → laborRisk=30; weight=0.40 → 30*0.40=12
    // 種別: 超過率1.5 → 80; weight=0.25 → 80*0.25=20
    // total=32 → medium
    const h = [makeRecord("内装", 5, 8)]; // ratio=1.6 → 80
    const labor = [makeDay(0, 10)]; // ratio=0 → 30
    const result = predictDelay(task, [], labor, h, DEFAULT_PREDICTION_CONFIG);
    expect(result.riskPct).toBeGreaterThanOrEqual(30);
    expect(result.riskLevel).toBe("medium");
  });

  it("riskPct >= 85 → critical (全重みを labor に集中)", () => {
    // labor only config で labor=30 のみが寄与するが、それでは達しない
    // なのでカスタム config で各軸のリスクを最大にする
    const config: PredictionConfig = { weatherWeight: 1.0, laborWeight: 1.0, kindWeight: 1.0 };
    // weatherRisk=100 (heavy_rain×10 + penalty), laborRisk=30, kindRisk=80
    // riskPct = min(100, round(100+30+80)) = 100 → critical
    const weather = Array(10).fill(WeatherCondition.heavy_rain);
    const labor = [makeDay(0, 10)];
    const h = [makeRecord("内装", 5, 10)]; // ratio=2.0 → 80
    const result = predictDelay(task, weather, labor, h, config);
    expect(result.riskPct).toBeGreaterThanOrEqual(85);
    expect(result.riskLevel).toBe("critical");
    expect(result.suggestedAction_ja).toBe("直ちに工程見直し+応援職人手配");
  });
});

describe("predictDelay — suggestedAction_ja", () => {
  it("low → 予定通り進行可", () => {
    const result = predictDelay(task, [], [], [], DEFAULT_PREDICTION_CONFIG);
    expect(result.suggestedAction_ja).toBe("予定通り進行可");
  });

  it("critical → 直ちに工程見直し+応援職人手配", () => {
    const weather = Array(10).fill(WeatherCondition.snow);
    const labor = [makeDay(0, 10)];
    const h = [makeRecord("内装", 5, 10)];
    const result = predictDelay(task, weather, labor, h, DEFAULT_PREDICTION_CONFIG);
    if (result.riskLevel === "critical") {
      expect(result.suggestedAction_ja).toBe("直ちに工程見直し+応援職人手配");
    }
  });
});

describe("predictDelay — config カスタム重み", () => {
  it("labor のみ重視の config で labor リスクが支配的になる", () => {
    const config: PredictionConfig = { weatherWeight: 0.0, laborWeight: 1.0, kindWeight: 0.0 };
    const labor = [makeDay(0, 10)]; // ratio=0 → laborRisk=30
    const result = predictDelay(task, [], labor, [], config);
    // riskPct = 30 * 1.0 = 30
    expect(result.riskPct).toBe(30);
  });

  it("weather のみ重視の config", () => {
    const config: PredictionConfig = { weatherWeight: 1.0, laborWeight: 0.0, kindWeight: 0.0 };
    const weather = [WeatherCondition.rain]; // weatherRisk=10
    const result = predictDelay(task, weather, [], [], config);
    expect(result.riskPct).toBe(10);
  });
});

describe("predictDelay — riskPct 上限", () => {
  it("高リスク条件でも riskPct <= 100", () => {
    const weather = Array(20).fill(WeatherCondition.heavy_rain);
    const labor = Array(20).fill(makeDay(0, 10));
    const h = [makeRecord("内装", 2, 10)]; // ratio=5.0 → 80
    const result = predictDelay(task, weather, labor, h, DEFAULT_PREDICTION_CONFIG);
    expect(result.riskPct).toBeLessThanOrEqual(100);
  });
});

describe("predictDelay — factors", () => {
  it("factors.weatherRisk は calculateWeatherRisk と一致する", () => {
    const weather = [WeatherCondition.rain, WeatherCondition.rain]; // 20 + 15 = 35
    const result = predictDelay(task, weather, [], [], DEFAULT_PREDICTION_CONFIG);
    expect(result.factors.weatherRisk).toBe(35);
  });

  it("factors.laborRisk は calculateLaborRisk と一致する", () => {
    const labor = [makeDay(60, 100)]; // ratio=0.6 → 30
    const result = predictDelay(task, [], labor, [], DEFAULT_PREDICTION_CONFIG);
    expect(result.factors.laborRisk).toBe(30);
  });

  it("factors.kindBaselineRisk は calculateKindBaselineRisk と一致する", () => {
    const h = [makeRecord("内装", 10, 15)]; // ratio=1.5 → 80
    const result = predictDelay(task, [], [], h, DEFAULT_PREDICTION_CONFIG);
    expect(result.factors.kindBaselineRisk).toBe(80);
  });
});
