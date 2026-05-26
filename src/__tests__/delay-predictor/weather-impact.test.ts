/**
 * Tests for calculateWeatherRisk (delay-predictor)
 */

import { describe, expect, it } from "vitest";
import { calculateWeatherRisk } from "../../lib/delay-predictor/weather-impact.js";
import { WeatherCondition } from "../../lib/delay-predictor/types.js";

const { sunny, cloudy, rain, heavy_rain, snow } = WeatherCondition;

describe("calculateWeatherRisk — 基本加算", () => {
  it("空配列は 0", () => {
    expect(calculateWeatherRisk([])).toBe(0);
  });

  it("sunny のみは 0", () => {
    expect(calculateWeatherRisk([sunny, sunny, sunny])).toBe(0);
  });

  it("cloudy 1日 は 2", () => {
    expect(calculateWeatherRisk([cloudy])).toBe(2);
  });

  it("rain 1日 は 10", () => {
    expect(calculateWeatherRisk([rain])).toBe(10);
  });

  it("heavy_rain 1日 は 25", () => {
    expect(calculateWeatherRisk([heavy_rain])).toBe(25);
  });

  it("snow 1日 は 30", () => {
    expect(calculateWeatherRisk([snow])).toBe(30);
  });

  it("複合: sunny + cloudy + rain = 0 + 2 + 10 = 12", () => {
    expect(calculateWeatherRisk([sunny, cloudy, rain])).toBe(12);
  });

  it("heavy_rain + snow = 25 + 30 = 55", () => {
    expect(calculateWeatherRisk([heavy_rain, snow])).toBe(55);
  });
});

describe("calculateWeatherRisk — 連続降雨ペナルティ", () => {
  it("rain 2日連続で +15 追加される", () => {
    // rain×2 = 20 + penalty 15 = 35
    expect(calculateWeatherRisk([rain, rain])).toBe(35);
  });

  it("heavy_rain 2日連続で +15 追加される", () => {
    // 25×2 = 50 + 15 = 65
    expect(calculateWeatherRisk([heavy_rain, heavy_rain])).toBe(65);
  });

  it("rain + sunny + rain は連続ではない (ペナルティなし)", () => {
    // 10 + 0 + 10 = 20
    expect(calculateWeatherRisk([rain, sunny, rain])).toBe(20);
  });

  it("rain 3日連続でもペナルティは 1回のみ +15", () => {
    // 10×3 = 30 + 15 = 45
    expect(calculateWeatherRisk([rain, rain, rain])).toBe(45);
  });

  it("rain 1日のみはペナルティなし", () => {
    expect(calculateWeatherRisk([rain])).toBe(10);
  });

  it("heavy_rain + rain は連続とみなす", () => {
    // 25 + 10 + 15 = 50
    expect(calculateWeatherRisk([heavy_rain, rain])).toBe(50);
  });
});

describe("calculateWeatherRisk — 上限 100", () => {
  it("大量の heavy_rain でも 100 を超えない", () => {
    const forecast = Array(20).fill(heavy_rain);
    expect(calculateWeatherRisk(forecast)).toBeLessThanOrEqual(100);
  });

  it("snow + heavy_rain 混合でも 100 を超えない", () => {
    const forecast = Array(5).fill(snow).concat(Array(5).fill(heavy_rain));
    expect(calculateWeatherRisk(forecast)).toBeLessThanOrEqual(100);
  });
});
