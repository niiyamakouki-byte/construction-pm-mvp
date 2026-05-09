/**
 * 工程遅延予測AI — 天候リスク計算
 *
 * 純関数。外部依存なし。
 */

import { WeatherCondition } from "./types.js";

/**
 * 予測天候リストから天候リスクスコア (0-100) を算出する。
 *
 * 加算ルール:
 *   heavy_rain: +25
 *   rain:       +10
 *   snow:       +30
 *   cloudy:     +2
 *   sunny:      0
 *
 * 連続2日以上 rain / heavy_rain が続く場合: 追加 +15
 */
export function calculateWeatherRisk(forecast: WeatherCondition[]): number {
  if (forecast.length === 0) return 0;

  let risk = 0;

  for (const condition of forecast) {
    switch (condition) {
      case WeatherCondition.heavy_rain:
        risk += 25;
        break;
      case WeatherCondition.rain:
        risk += 10;
        break;
      case WeatherCondition.snow:
        risk += 30;
        break;
      case WeatherCondition.cloudy:
        risk += 2;
        break;
      case WeatherCondition.sunny:
        // no contribution
        break;
    }
  }

  // 連続降雨ペナルティ
  let consecutiveRainDays = 0;
  let maxConsecutive = 0;
  for (const condition of forecast) {
    if (condition === WeatherCondition.rain || condition === WeatherCondition.heavy_rain) {
      consecutiveRainDays++;
      if (consecutiveRainDays > maxConsecutive) {
        maxConsecutive = consecutiveRainDays;
      }
    } else {
      consecutiveRainDays = 0;
    }
  }

  if (maxConsecutive >= 2) {
    risk += 15;
  }

  return Math.min(100, risk);
}
