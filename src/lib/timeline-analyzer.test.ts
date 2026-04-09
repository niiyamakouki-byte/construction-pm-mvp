import { describe, expect, it } from "vitest";
import {
  type DelayEntry,
  analyzeDelay,
  predictCompletionDate,
  generateTimelineReport,
} from "./timeline-analyzer.js";

const delays: DelayEntry[] = [
  { taskName: "基礎工事", category: "weather", delayDays: 3, description: "大雨", date: "2025-05-01" },
  { taskName: "外壁", category: "material", delayDays: 5, description: "資材遅延", date: "2025-05-10" },
  { taskName: "配管", category: "weather", delayDays: 2, description: "台風", date: "2025-05-15" },
  { taskName: "電気", category: "labor", delayDays: 1, description: "作業員不足", date: "2025-05-20" },
];

// ── analyzeDelay ──────────────────────────────────────

describe("analyzeDelay", () => {
  it("calculates total delay days", () => {
    const result = analyzeDelay(delays);
    expect(result.totalDelayDays).toBe(11);
  });

  it("identifies causes by category", () => {
    const result = analyzeDelay(delays);
    expect(result.causes.length).toBe(3);
  });

  it("identifies largest cause", () => {
    const result = analyzeDelay(delays);
    // weather: 5 days, material: 5 days — weather has more occurrences
    expect(["weather", "material"]).toContain(result.largestCause);
  });

  it("identifies most frequent cause", () => {
    const result = analyzeDelay(delays);
    expect(result.mostFrequentCause).toBe("weather"); // 2 occurrences
  });

  it("handles empty delays", () => {
    const result = analyzeDelay([]);
    expect(result.totalDelayDays).toBe(0);
    expect(result.causes).toHaveLength(0);
  });

  it("calculates percentages", () => {
    const result = analyzeDelay(delays);
    const totalPct = result.causes.reduce((s, c) => s + c.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

// ── predictCompletionDate ─────────────────────────────

describe("predictCompletionDate", () => {
  it("on-track when progress matches time", () => {
    const result = predictCompletionDate("2025-01-01", "2025-04-01", 50, 45);
    expect(result.slippageDays).toBe(0);
  });

  it("predicts slippage when behind", () => {
    const result = predictCompletionDate("2025-01-01", "2025-04-01", 25, 45);
    expect(result.slippageDays).toBeGreaterThan(0);
  });

  it("high confidence when progress > 70%", () => {
    const result = predictCompletionDate("2025-01-01", "2025-07-01", 80, 150);
    expect(result.confidence).toBe("high");
  });

  it("low confidence when progress < 20%", () => {
    const result = predictCompletionDate("2025-01-01", "2025-07-01", 10, 20);
    expect(result.confidence).toBe("low");
  });
});

// ── generateTimelineReport ────────────────────────────

describe("generateTimelineReport", () => {
  it("generates complete report", () => {
    const report = generateTimelineReport({
      projectName: "テストPJ",
      startDate: "2025-01-01",
      originalEndDate: "2025-06-30",
      totalTasks: 20,
      completedTasks: 15,
      delays,
      elapsedDays: 120,
    });
    expect(report.projectName).toBe("テストPJ");
    expect(report.progressPct).toBe(75);
    expect(report.delayAnalysis.totalDelayDays).toBe(11);
  });

  it("reports on-track for good progress", () => {
    const report = generateTimelineReport({
      projectName: "On Track PJ",
      startDate: "2025-01-01",
      originalEndDate: "2025-06-30",
      totalTasks: 10,
      completedTasks: 6,
      delays: [],
      elapsedDays: 100,
    });
    expect(report.onTrack).toBe(true);
  });

  it("handles zero tasks", () => {
    const report = generateTimelineReport({
      projectName: "Empty",
      startDate: "2025-01-01",
      originalEndDate: "2025-03-01",
      totalTasks: 0,
      completedTasks: 0,
      delays: [],
      elapsedDays: 30,
    });
    expect(report.progressPct).toBe(0);
  });
});
