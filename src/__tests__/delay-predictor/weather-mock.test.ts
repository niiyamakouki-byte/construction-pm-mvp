/**
 * Tests for weather-mock (delay-predictor)
 */

import { describe, expect, it } from "vitest";
import {
  generateWeatherForecast,
  monthToSeason,
  MockWeatherProvider,
} from "../../lib/delay-predictor/weather-mock.js";
import { WeatherCondition } from "../../lib/delay-predictor/types.js";

const ALL_CONDITIONS = Object.values(WeatherCondition);

describe("monthToSeason", () => {
  it("3-5月 は spring", () => {
    expect(monthToSeason(3)).toBe("spring");
    expect(monthToSeason(5)).toBe("spring");
  });

  it("6-8月 は summer", () => {
    expect(monthToSeason(6)).toBe("summer");
    expect(monthToSeason(8)).toBe("summer");
  });

  it("9-11月 は autumn", () => {
    expect(monthToSeason(9)).toBe("autumn");
    expect(monthToSeason(11)).toBe("autumn");
  });

  it("12, 1, 2月 は winter", () => {
    expect(monthToSeason(12)).toBe("winter");
    expect(monthToSeason(1)).toBe("winter");
    expect(monthToSeason(2)).toBe("winter");
  });
});

describe("generateWeatherForecast", () => {
  it("デフォルト 5日分を返す", () => {
    const result = generateWeatherForecast("spring", 5, 42);
    expect(result).toHaveLength(5);
  });

  it("指定日数分を返す", () => {
    expect(generateWeatherForecast("summer", 7, 1)).toHaveLength(7);
    expect(generateWeatherForecast("winter", 3, 2)).toHaveLength(3);
  });

  it("返り値は WeatherCondition の値のみ", () => {
    const result = generateWeatherForecast("autumn", 10, 99);
    for (const c of result) {
      expect(ALL_CONDITIONS).toContain(c);
    }
  });

  it("同じ seed で同じ結果が返る", () => {
    const a = generateWeatherForecast("spring", 5, 12345);
    const b = generateWeatherForecast("spring", 5, 12345);
    expect(a).toEqual(b);
  });

  it("winter シーズンでは snow が出現しうる (確率 0.15)", () => {
    // 大量試行で少なくとも 1件は snow が出るはず
    let hasSnow = false;
    for (let seed = 0; seed < 100; seed++) {
      const result = generateWeatherForecast("winter", 10, seed);
      if (result.includes(WeatherCondition.snow)) {
        hasSnow = true;
        break;
      }
    }
    expect(hasSnow).toBe(true);
  });
});

describe("MockWeatherProvider", () => {
  it("WeatherProvider interface を満たす", async () => {
    const provider = new MockWeatherProvider({ season: "spring", seed: 7 });
    const result = await provider.getForecast("2026-05-01", 5);
    expect(result).toHaveLength(5);
    for (const c of result) {
      expect(ALL_CONDITIONS).toContain(c);
    }
  });
});
