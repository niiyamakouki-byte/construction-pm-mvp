/**
 * resource-analysis — P4 集計ロジックの詳細ユニットテスト
 */
import { describe, it, expect } from "vitest";
import {
  HOURS_PER_DAY,
  computeResourceAnalysis,
  workdaysBetween,
  type ResourceAnalysisTask,
} from "./resource-analysis.js";

describe("workdaysBetween", () => {
  it("月〜金の1週間は 5日", () => {
    expect(workdaysBetween("2026-07-06", "2026-07-10")).toBe(5);
  });

  it("土日を含む1週間(土〜金)も 5日", () => {
    // 2026-07-04(Sat)〜2026-07-10(Fri)
    expect(workdaysBetween("2026-07-04", "2026-07-10")).toBe(5);
  });

  it("1日(月曜)は 1日", () => {
    expect(workdaysBetween("2026-07-06", "2026-07-06")).toBe(1);
  });

  it("土曜単日は 0日", () => {
    expect(workdaysBetween("2026-07-04", "2026-07-04")).toBe(0);
  });

  it("日曜単日は 0日", () => {
    expect(workdaysBetween("2026-07-05", "2026-07-05")).toBe(0);
  });

  it("start > end は 0 を返す", () => {
    expect(workdaysBetween("2026-07-10", "2026-07-06")).toBe(0);
  });

  it("不正な日付文字列は 0", () => {
    expect(workdaysBetween("not-a-date", "2026-07-06")).toBe(0);
  });
});

describe("computeResourceAnalysis", () => {
  it("期間外のタスクは集計されない", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-06-01", endDate: "2026-06-05", contractorName: "田中" },
    ];
    const { rows, totalHours, totalTasks } = computeResourceAnalysis(
      tasks,
      "2026-07-06",
      "2026-07-10",
    );
    expect(rows).toHaveLength(0);
    expect(totalHours).toBe(0);
    expect(totalTasks).toBe(0);
  });

  it("担当者別に稼働時間を集計する", () => {
    // 2026-07-06(Mon)〜07-08(Wed) = 3稼働日 × 8h = 24h
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-06", endDate: "2026-07-08", contractorName: "山田" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-06", "2026-07-10");
    const yamada = rows.find((r) => r.name === "山田");
    expect(yamada?.hours).toBe(24);
    expect(yamada?.taskCount).toBe(1);
  });

  it("担当者名の空白は trim し、空文字は「未割当」に集約", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-07", endDate: "2026-07-07", contractorName: "  " },
      { id: "t2", startDate: "2026-07-07", endDate: "2026-07-07", contractorName: undefined },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-07", "2026-07-07");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("未割当");
    expect(rows[0]?.taskCount).toBe(2);
  });

  it("期間との重なり分だけ集計する（overlap クリッピング）", () => {
    // タスク 07-01〜07-15 のうち、期間 07-06〜07-10 の 5 稼働日分
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-01", endDate: "2026-07-15", contractorName: "佐藤" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-06", "2026-07-10");
    expect(rows[0]?.hours).toBe(5 * HOURS_PER_DAY);
  });

  it("土日のみと重なるタスクは集計されない", () => {
    // 07-04(Sat)〜07-05(Sun) のみのタスクは、07-04〜07-05 期間で 0h
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-04", endDate: "2026-07-05", contractorName: "鈴木" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-04", "2026-07-05");
    expect(rows).toHaveLength(0);
  });

  it("複数タスクの担当者別 hours を合算する", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-06", endDate: "2026-07-06", contractorName: "山田" },
      { id: "t2", startDate: "2026-07-07", endDate: "2026-07-07", contractorName: "山田" },
      { id: "t3", startDate: "2026-07-06", endDate: "2026-07-06", contractorName: "佐藤" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-06", "2026-07-10");
    const yamada = rows.find((r) => r.name === "山田");
    const sato = rows.find((r) => r.name === "佐藤");
    expect(yamada?.hours).toBe(16); // 2 日 × 8h
    expect(yamada?.taskCount).toBe(2);
    expect(sato?.hours).toBe(8);
  });

  it("稼働時間が多い順にソートされる", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-06", endDate: "2026-07-06", contractorName: "A" },
      { id: "t2", startDate: "2026-07-06", endDate: "2026-07-08", contractorName: "B" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-06", "2026-07-10");
    expect(rows[0]?.name).toBe("B");
    expect(rows[1]?.name).toBe("A");
  });

  it("キャパは 1人1日8h 固定 × 稼働日数", () => {
    const { rows } = computeResourceAnalysis(
      [{ id: "t1", startDate: "2026-07-06", endDate: "2026-07-10", contractorName: "X" }],
      "2026-07-06",
      "2026-07-10",
    );
    // 期間 5 稼働日 → capacity = 40h
    expect(rows[0]?.capacityHours).toBe(40);
    expect(rows[0]?.utilizationPct).toBe(100);
  });

  it("稼働率100%超（過負荷）", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-06", endDate: "2026-07-06", contractorName: "X" },
      { id: "t2", startDate: "2026-07-06", endDate: "2026-07-06", contractorName: "X" }, // 同日ダブル
      { id: "t3", startDate: "2026-07-06", endDate: "2026-07-06", contractorName: "X" },
    ];
    const { rows } = computeResourceAnalysis(tasks, "2026-07-06", "2026-07-06");
    // 3 タスク × 8h = 24h / 8h(1日キャパ) → 300%
    expect(rows[0]?.utilizationPct).toBe(300);
  });

  it("サマリー: totalHours / totalTasks / avgPersons を返す", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-06", endDate: "2026-07-10", contractorName: "山田" },
      { id: "t2", startDate: "2026-07-06", endDate: "2026-07-10", contractorName: "佐藤" },
    ];
    const summary = computeResourceAnalysis(tasks, "2026-07-06", "2026-07-10");
    expect(summary.totalHours).toBe(80);
    expect(summary.totalTasks).toBe(2);
    expect(summary.workdays).toBe(5);
    expect(summary.avgPersons).toBe(2.0); // 80h / 40h = 2 人/日
  });

  it("空タスクリストでも安全に 0 を返す", () => {
    const { rows, totalHours, avgPersons } = computeResourceAnalysis(
      [],
      "2026-07-06",
      "2026-07-10",
    );
    expect(rows).toHaveLength(0);
    expect(totalHours).toBe(0);
    expect(avgPersons).toBe(0);
  });

  it("workdays=0 (土日のみ期間) でも 0 割りせず 0% を返す", () => {
    const tasks: ResourceAnalysisTask[] = [
      { id: "t1", startDate: "2026-07-04", endDate: "2026-07-05", contractorName: "X" },
    ];
    const { rows, avgPersons } = computeResourceAnalysis(tasks, "2026-07-04", "2026-07-05");
    // 土日のみのタスクなので rows は空、avgPersons も 0
    expect(rows).toHaveLength(0);
    expect(avgPersons).toBe(0);
  });
});
