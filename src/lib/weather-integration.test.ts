import { describe, expect, it } from "vitest";
import {
  type DailyForecast,
  calculateRainDelay,
  fetchForecast,
  suggestScheduleAdjustment,
} from "./weather-integration.js";

const clearDay: DailyForecast = {
  date: "2025-06-01",
  condition: "clear",
  tempHigh: 28,
  tempLow: 18,
  precipitationMm: 0,
  windSpeedKmh: 10,
};

const rainyDay: DailyForecast = {
  date: "2025-06-02",
  condition: "rain",
  tempHigh: 22,
  tempLow: 16,
  precipitationMm: 15,
  windSpeedKmh: 20,
};

const stormDay: DailyForecast = {
  date: "2025-06-03",
  condition: "storm",
  tempHigh: 20,
  tempLow: 14,
  precipitationMm: 50,
  windSpeedKmh: 60,
};

// ── fetchForecast ─────────────────────────────────────

describe("fetchForecast", () => {
  it("returns mock data when provided", () => {
    const result = fetchForecast("Tokyo", 3, [clearDay, rainyDay, stormDay]);
    expect(result.location).toBe("Tokyo");
    expect(result.forecasts).toHaveLength(3);
  });

  it("generates default forecast when no mock", () => {
    const result = fetchForecast("Tokyo", 5);
    expect(result.forecasts).toHaveLength(5);
    expect(result.fetchedAt).toBeTruthy();
  });

  it("limits to requested days", () => {
    const result = fetchForecast("Tokyo", 2, [clearDay, rainyDay, stormDay]);
    expect(result.forecasts).toHaveLength(2);
  });
});

// ── calculateRainDelay ────────────────────────────────

describe("calculateRainDelay", () => {
  it("no delay on clear day", () => {
    const delay = calculateRainDelay(clearDay);
    expect(delay.delayHours).toBe(0);
  });

  it("moderate delay on rain", () => {
    const delay = calculateRainDelay(rainyDay);
    expect(delay.delayHours).toBeGreaterThan(0);
    expect(delay.delayHours).toBeLessThan(8);
  });

  it("full day delay on storm", () => {
    const delay = calculateRainDelay(stormDay);
    expect(delay.delayHours).toBe(8);
    expect(delay.canWorkIndoors).toBe(false);
  });

  it("delay on high wind", () => {
    const windyDay: DailyForecast = {
      ...clearDay,
      windSpeedKmh: 55,
    };
    const delay = calculateRainDelay(windyDay);
    expect(delay.delayHours).toBe(4);
  });

  it("delay on snow", () => {
    const snowDay: DailyForecast = {
      ...clearDay,
      condition: "snow",
    };
    const delay = calculateRainDelay(snowDay);
    expect(delay.delayHours).toBe(4);
  });
});

// ── suggestScheduleAdjustment ─────────────────────────

describe("suggestScheduleAdjustment", () => {
  const forecasts = [clearDay, rainyDay, stormDay, { ...clearDay, date: "2025-06-04" }];

  it("no adjustment on clear day", () => {
    const result = suggestScheduleAdjustment(forecasts, "2025-06-01");
    expect(result).toBeNull();
  });

  it("suggests adjustment for rainy day", () => {
    const result = suggestScheduleAdjustment(forecasts, "2025-06-02");
    expect(result).not.toBeNull();
    expect(result!.originalDate).toBe("2025-06-02");
    expect(result!.suggestedDate).toBe("2025-06-04");
  });

  it("high severity for storm", () => {
    const result = suggestScheduleAdjustment(forecasts, "2025-06-03");
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high");
  });

  it("no adjustment for indoor work when can work indoors", () => {
    const result = suggestScheduleAdjustment(forecasts, "2025-06-02", false);
    expect(result).toBeNull();
  });

  it("returns null for unknown date", () => {
    const result = suggestScheduleAdjustment(forecasts, "2099-01-01");
    expect(result).toBeNull();
  });
});
