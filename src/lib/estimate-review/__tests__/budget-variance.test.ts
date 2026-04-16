import { describe, expect, it } from "vitest";
import { buildVarianceReport } from "../budget-variance.js";

describe("buildVarianceReport", () => {
  it("returns green alert for small variance", () => {
    const report = buildVarianceReport("p-1", [
      { category: "材料費", estimated: 1_000_000, actual: 1_050_000 },
    ]);
    expect(report.items[0].alert).toBe("green");
    expect(report.overallAlert).toBe("green");
  });

  it("returns yellow alert at ±10% threshold", () => {
    const report = buildVarianceReport("p-1", [
      { category: "人件費", estimated: 1_000_000, actual: 1_150_000 },
    ]);
    expect(report.items[0].alert).toBe("yellow");
    expect(report.feedback[0]).toContain("要注意");
  });

  it("returns red alert at ±20% threshold", () => {
    const report = buildVarianceReport("p-1", [
      { category: "設備費", estimated: 1_000_000, actual: 1_250_000 },
    ]);
    expect(report.items[0].alert).toBe("red");
    expect(report.feedback[0]).toContain("要修正");
  });

  it("generates positive feedback when all items are within ±10%", () => {
    const report = buildVarianceReport("p-2", [
      { category: "材料費", estimated: 2_000_000, actual: 2_050_000 },
      { category: "人件費", estimated: 1_000_000, actual: 980_000 },
    ]);
    expect(report.overallAlert).toBe("green");
    expect(report.feedback[0]).toContain("良好");
  });
});
