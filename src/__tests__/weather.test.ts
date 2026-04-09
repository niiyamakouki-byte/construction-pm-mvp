import { describe, expect, it } from "vitest";
import type { Project } from "../domain/types.js";
import {
  buildMockConstructionSiteForecasts,
  collectWeatherWarnings,
  getConstructionRecommendation,
  getDailyWeatherRisk,
} from "../lib/weather.js";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "晴海再開発",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("weather helpers", () => {
  it("marks heavy rain and strong wind as danger", () => {
    const risk = getDailyWeatherRisk({ pop: 0.84, wind_speed: 16.2 });

    expect(risk.level).toBe("danger");
    expect(risk.reasons.join(" ")).toContain("降水確率");
    expect(getConstructionRecommendation({ pop: 0.84, wind_speed: 16.2 })).toContain("延期");
  });

  it("collects warning days from mock site forecasts", () => {
    const forecasts = buildMockConstructionSiteForecasts([
      makeProject({ id: "p-1", name: "東京現場" }),
      makeProject({ id: "p-2", name: "横浜現場" }),
    ]);

    const warnings = collectWeatherWarnings(forecasts, 2);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((warning) => warning.siteName === "横浜現場")).toBe(true);
    expect(warnings[0].risk.level === "warning" || warnings[0].risk.level === "danger").toBe(true);
  });
});
