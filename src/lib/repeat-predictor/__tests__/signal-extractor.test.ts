/**
 * Tests for signal-extractor.
 */

import { describe, expect, it } from "vitest";
import { extractSignal } from "../signal-extractor.js";
import type { CustomerJobHistory, CustomerJob } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const REF = new Date("2025-06-01T00:00:00Z");

function makeJob(
  jobId: string,
  completedAt: string,
  revenueYen = 1000000,
  marginPct = 25,
  satisfactionScore: number | null = 4,
  hasComplaint = false,
  isReferral = false,
): CustomerJob {
  return { jobId, completedAt, revenueYen, marginPct, satisfactionScore, hasComplaint, isReferral };
}

function makeHistory(
  customerId: string,
  jobs: CustomerJob[],
  totalLifetimeValue = 0,
): CustomerJobHistory {
  return {
    customerId,
    customerName: `テスト顧客 ${customerId}`,
    jobs,
    totalLifetimeValue: totalLifetimeValue || jobs.reduce((s, j) => s + j.revenueYen, 0),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("extractSignal — 空の案件履歴", () => {
  it("案件なしで jobsCount=0、lastJobMonthsAgo=999", () => {
    const h = makeHistory("c000", []);
    const s = extractSignal(h, REF);
    expect(s.jobsCount).toBe(0);
    expect(s.lastJobMonthsAgo).toBe(999);
    expect(s.avgIntervalMonths).toBeNull();
    expect(s.totalRevenue).toBe(0);
    expect(s.referralCount).toBe(0);
  });
});

describe("extractSignal — 単一案件", () => {
  it("1件でも基本シグナルが正しく抽出される", () => {
    const job = makeJob("j1", "2025-03-01", 2000000, 28, 5, false, true);
    const h = makeHistory("c001", [job]);
    const s = extractSignal(h, REF);
    expect(s.jobsCount).toBe(1);
    expect(s.totalRevenue).toBe(2000000);
    expect(s.avgMarginPct).toBe(28);
    expect(s.lastSatisfactionScore).toBe(5);
    expect(s.referralCount).toBe(1);
    expect(s.complaintCount).toBe(0);
    expect(s.avgIntervalMonths).toBeNull();
    // March 1 to June 1 ≈ 3 months
    expect(s.lastJobMonthsAgo).toBeGreaterThan(2.9);
    expect(s.lastJobMonthsAgo).toBeLessThan(3.2);
  });
});

describe("extractSignal — 複数案件", () => {
  it("複数案件で平均間隔が計算される", () => {
    const jobs = [
      makeJob("j1", "2024-06-01"),
      makeJob("j2", "2024-12-01"),
      makeJob("j3", "2025-04-01"),
    ];
    const h = makeHistory("c002", jobs);
    const s = extractSignal(h, REF);
    expect(s.jobsCount).toBe(3);
    // interval: ~6 months + ~4 months → avg ~5 months
    expect(s.avgIntervalMonths).toBeGreaterThan(4);
    expect(s.avgIntervalMonths).toBeLessThan(6);
  });

  it("totalRevenue が全案件の合計になる", () => {
    const jobs = [
      makeJob("j1", "2024-01-01", 1000000),
      makeJob("j2", "2024-07-01", 2000000),
      makeJob("j3", "2025-01-01", 3000000),
    ];
    const h = makeHistory("c003", jobs);
    const s = extractSignal(h, REF);
    expect(s.totalRevenue).toBe(6000000);
  });

  it("最新の満足度が lastSatisfactionScore に設定される", () => {
    const jobs = [
      makeJob("j1", "2023-01-01", 1000000, 25, 3),
      makeJob("j2", "2024-01-01", 1000000, 25, 4),
      makeJob("j3", "2025-01-01", 1000000, 25, 5),
    ];
    const h = makeHistory("c004", jobs);
    const s = extractSignal(h, REF);
    expect(s.lastSatisfactionScore).toBe(5);
  });

  it("クレーム件数が正しく集計される", () => {
    const jobs = [
      makeJob("j1", "2023-06-01", 1000000, 25, 3, true, false),
      makeJob("j2", "2024-01-01", 1000000, 25, 4, false, false),
      makeJob("j3", "2024-08-01", 1000000, 25, 2, true, false),
    ];
    const h = makeHistory("c005", jobs);
    const s = extractSignal(h, REF);
    expect(s.complaintCount).toBe(2);
  });

  it("紹介件数が正しく集計される", () => {
    const jobs = [
      makeJob("j1", "2024-01-01", 1000000, 25, 4, false, true),
      makeJob("j2", "2024-07-01", 1000000, 25, 5, false, true),
      makeJob("j3", "2025-01-01", 1000000, 25, 5, false, false),
    ];
    const h = makeHistory("c006", jobs);
    const s = extractSignal(h, REF);
    expect(s.referralCount).toBe(2);
  });

  it("満足度なしの案件のみの場合 lastSatisfactionScore が null", () => {
    const jobs = [
      makeJob("j1", "2024-06-01", 1000000, 25, null),
      makeJob("j2", "2025-01-01", 1000000, 25, null),
    ];
    const h = makeHistory("c007", jobs);
    const s = extractSignal(h, REF);
    expect(s.lastSatisfactionScore).toBeNull();
  });
});

describe("extractSignal — 時刻計算", () => {
  it("24ヶ月前の最終発注でも正しく計算される", () => {
    const job = makeJob("j1", "2023-06-01");
    const h = makeHistory("c010", [job]);
    const s = extractSignal(h, REF);
    expect(s.lastJobMonthsAgo).toBeGreaterThan(23);
    expect(s.lastJobMonthsAgo).toBeLessThan(25);
  });
});
