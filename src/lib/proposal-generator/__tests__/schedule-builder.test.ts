/**
 * schedule-builder unit tests.
 */

import { describe, it, expect } from "vitest";
import { buildSchedule } from "../schedule-builder.js";
import type { WorkCategory, WorkScale } from "../types.js";

describe("buildSchedule", () => {
  it("durationDays が正の整数である", () => {
    const result = buildSchedule({ workCategory: "kitchen", workScale: "medium" });
    expect(result.durationDays).toBeGreaterThan(0);
    expect(Number.isInteger(result.durationDays)).toBe(true);
  });

  it("phasesJa が1件以上ある", () => {
    const result = buildSchedule({ workCategory: "kitchen", workScale: "medium" });
    expect(result.phasesJa.length).toBeGreaterThan(0);
  });

  it("small < medium < large の工期順序を保つ", () => {
    const small = buildSchedule({ workCategory: "full_renovation", workScale: "small" });
    const medium = buildSchedule({ workCategory: "full_renovation", workScale: "medium" });
    const large = buildSchedule({ workCategory: "full_renovation", workScale: "large" });
    expect(small.durationDays).toBeLessThan(medium.durationDays);
    expect(medium.durationDays).toBeLessThan(large.durationDays);
  });

  it("full_renovation は repair より工期が長い", () => {
    const reno = buildSchedule({ workCategory: "full_renovation", workScale: "medium" });
    const repair = buildSchedule({ workCategory: "repair", workScale: "medium" });
    expect(reno.durationDays).toBeGreaterThan(repair.durationDays);
  });

  it("着工準備フェーズが含まれる", () => {
    const result = buildSchedule({ workCategory: "full_renovation", workScale: "large" });
    expect(result.phasesJa.some((p) => p.includes("着工準備"))).toBe(true);
  });

  it("引渡フェーズが含まれる", () => {
    const result = buildSchedule({ workCategory: "kitchen", workScale: "small" });
    expect(result.phasesJa.some((p) => p.includes("引渡"))).toBe(true);
  });

  it("full_renovation large は解体フェーズを含む", () => {
    const result = buildSchedule({ workCategory: "full_renovation", workScale: "large" });
    expect(result.phasesJa.some((p) => p.includes("解体"))).toBe(true);
  });

  const allCategories: WorkCategory[] = [
    "full_renovation", "partial_renovation", "kitchen", "bath",
    "store_fit", "office_fit", "exterior", "repair", "other",
  ];
  const allScales: WorkScale[] = ["small", "medium", "large", "extra_large"];

  it.each(allCategories)("category=%s が正常に動作する", (cat) => {
    const result = buildSchedule({ workCategory: cat, workScale: "medium" });
    expect(result.durationDays).toBeGreaterThan(0);
    expect(result.phasesJa.length).toBeGreaterThan(0);
  });

  it.each(allScales)("scale=%s が正常に動作する", (sc) => {
    const result = buildSchedule({ workCategory: "full_renovation", workScale: sc });
    expect(result.durationDays).toBeGreaterThan(0);
  });
});
