/**
 * 工程遅延予測AI — 天候モック生成
 *
 * シーズンベースで5日間の WeatherCondition[] を生成する。
 * 将来 OpenWeather API への差し替えに対応できるよう WeatherProvider interface を定義。
 */

import { WeatherCondition } from "./types.js";

// ── Provider Interface (API差し替え対応) ─────────────────────────────────────

export interface WeatherProvider {
  /**
   * 指定開始日から days 日分の天候予報を取得する。
   * @param startDate ISO 8601 date string (YYYY-MM-DD)
   * @param days      取得日数
   */
  getForecast(startDate: string, days: number): Promise<WeatherCondition[]>;
}

// ── シーズン別確率テーブル ────────────────────────────────────────────────────

type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * シーズン別天候出現確率 (合計 1.0)
 * spring: 晴れ多め、時々雨
 * summer: 晴れ多め、急な大雨リスク
 * autumn: 曇り多め、雨もそこそこ
 * winter: 曇り多め、雪リスクあり
 */
const SEASON_WEIGHTS: Record<Season, Record<WeatherCondition, number>> = {
  spring: {
    [WeatherCondition.sunny]:     0.45,
    [WeatherCondition.cloudy]:    0.25,
    [WeatherCondition.rain]:      0.20,
    [WeatherCondition.heavy_rain]:0.07,
    [WeatherCondition.snow]:      0.03,
  },
  summer: {
    [WeatherCondition.sunny]:     0.50,
    [WeatherCondition.cloudy]:    0.20,
    [WeatherCondition.rain]:      0.15,
    [WeatherCondition.heavy_rain]:0.15,
    [WeatherCondition.snow]:      0.00,
  },
  autumn: {
    [WeatherCondition.sunny]:     0.35,
    [WeatherCondition.cloudy]:    0.30,
    [WeatherCondition.rain]:      0.25,
    [WeatherCondition.heavy_rain]:0.10,
    [WeatherCondition.snow]:      0.00,
  },
  winter: {
    [WeatherCondition.sunny]:     0.30,
    [WeatherCondition.cloudy]:    0.35,
    [WeatherCondition.rain]:      0.15,
    [WeatherCondition.heavy_rain]:0.05,
    [WeatherCondition.snow]:      0.15,
  },
};

/**
 * 現在月からシーズンを推定する。
 */
export function monthToSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/**
 * シードベースの擬似乱数生成 (テストの再現性のため)。
 * LCG (Linear Congruential Generator)
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * 重み付き確率テーブルから天候を1件選択する。
 */
function pickWeighted(
  weights: Record<WeatherCondition, number>,
  rand: number,
): WeatherCondition {
  const conditions = Object.keys(weights) as WeatherCondition[];
  let cumulative = 0;
  for (const condition of conditions) {
    cumulative += weights[condition];
    if (rand <= cumulative) return condition;
  }
  return WeatherCondition.cloudy; // fallback
}

// ── 公開API ───────────────────────────────────────────────────────────────────

/**
 * シーズンベースで days 日分の天候予報を生成する。
 *
 * @param season シーズン (省略時: 現在月から推定)
 * @param days   日数 (デフォルト: 5)
 * @param seed   擬似乱数シード (デフォルト: Date.now())
 */
export function generateWeatherForecast(
  season?: Season,
  days = 5,
  seed?: number,
): WeatherCondition[] {
  const resolvedSeason =
    season ?? monthToSeason(new Date().getMonth() + 1);
  const weights = SEASON_WEIGHTS[resolvedSeason];
  const rand = seededRandom(seed ?? Date.now());

  return Array.from({ length: days }, () => pickWeighted(weights, rand()));
}

// ── MockWeatherProvider ───────────────────────────────────────────────────────

/**
 * WeatherProvider のモック実装。
 * OpenWeather API 差し替え時はこのクラスを本番実装に置き換える。
 */
export class MockWeatherProvider implements WeatherProvider {
  private readonly season?: Season;
  private readonly seed?: number;

  constructor(options: { season?: Season; seed?: number } = {}) {
    this.season = options.season;
    this.seed = options.seed;
  }

  async getForecast(_startDate: string, days: number): Promise<WeatherCondition[]> {
    return generateWeatherForecast(this.season, days, this.seed);
  }
}
