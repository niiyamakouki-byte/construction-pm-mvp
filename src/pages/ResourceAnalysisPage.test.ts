/**
 * P4: リソース分析ページの集計ロジック統合テスト。
 * 実装本体（src/lib/resource-analysis.ts）を直接 import して回帰を防ぐ。
 * ロジック単体のより詳細なケースは src/lib/resource-analysis.test.ts を参照。
 */
import { describe, it, expect } from "vitest";
import {
  HOURS_PER_DAY,
  computeResourceAnalysis,
  workdaysBetween,
  type ResourceAnalysisTask,
} from "../lib/resource-analysis.js";

describe("P4 リソース分析 — 集計ロジック回帰", () => {
  it("キャパ定数は 8h/日（設定化しない）", () => {
    expect(HOURS_PER_DAY).toBe(8);
  });

  it("担当者名なしは「未割当」にまとめる", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-07", endDate: "2026-07-07" },
      { id: "t2", startDate: "2026-07-07", endDate: "2026-07-07" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-07", "2026-07-07");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("未割当");
    expect(rows[0]?.taskCount).toBe(2);
  });

  it("平均稼働人数 = 延べh ÷ (稼働日 × 8h)", () => {
    // 期間: 2026-07-06(Mon)〜07-10(Fri) = 5 稼働日, 1人キャパ = 40h
    // 山田が 5 日フル + 佐藤が 5 日フル = 80h → 平均 2.0 人/日
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-06", endDate: "2026-07-10", contractorName: "山田" },
      { id: "t2", startDate: "2026-07-06", endDate: "2026-07-10", contractorName: "佐藤" },
    ];
    const { totalHours, avgPersons, workdays } = computeResourceAnalysis(
      tasks,
      "2026-07-06",
      "2026-07-10",
    );
    expect(workdays).toBe(5);
    expect(totalHours).toBe(80);
    expect(avgPersons).toBe(2.0);
  });

  it("稼働率が 100% 超のケース(過負荷)を検出する", () => {
    // 期間 1 稼働日, 山田さんが 2 タスクを同日フル → 16h / 8h = 200%
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-07", endDate: "2026-07-07", contractorName: "山田" },
      { id: "t2", startDate: "2026-07-07", endDate: "2026-07-07", contractorName: "山田" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-07", "2026-07-07");
    expect(rows[0]?.utilizationPct).toBe(200);
  });

  it("workdaysBetween: 反転日付は 0", () => {
    expect(workdaysBetween("2026-07-10", "2026-07-06")).toBe(0);
  });
});
