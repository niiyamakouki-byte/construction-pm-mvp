/**
 * gantt-task-filter — P3 検索+フィルタ合成のユニットテスト
 */
import { describe, it, expect } from "vitest";
import type { GanttTask } from "../components/gantt/types.js";
import {
  TRADE_CATEGORIES,
  filterGanttTasks,
  matchesTaskSearch,
  resolveTradeCategory,
} from "./gantt-task-filter.js";

function mkTask(overrides: Partial<GanttTask> & { id: string; name: string }): GanttTask {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? "p1",
    name: overrides.name,
    description: overrides.description ?? "",
    status: overrides.status ?? "pending",
    progress: overrides.progress ?? 0,
    dependencies: overrides.dependencies ?? [],
    projectName: overrides.projectName ?? "テスト案件",
    startDate: overrides.startDate ?? "2026-07-06",
    endDate: overrides.endDate ?? "2026-07-08",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    contractorName: overrides.contractorName,
    majorCategory: overrides.majorCategory,
    middleCategory: overrides.middleCategory,
    minorCategory: overrides.minorCategory,
  } as GanttTask;
}

describe("resolveTradeCategory", () => {
  it("塗装関連は painting", () => {
    expect(resolveTradeCategory({ majorCategory: "塗装工事" })).toBe("painting");
    expect(resolveTradeCategory({ majorCategory: "PAINTING" })).toBe("painting");
  });

  it("軽鉄/下地は framing", () => {
    expect(resolveTradeCategory({ majorCategory: "軽鉄下地" })).toBe("framing");
  });

  it("該当なしは other にフォールバック", () => {
    expect(resolveTradeCategory({ majorCategory: "解体" })).toBe("other");
    expect(resolveTradeCategory({ majorCategory: undefined })).toBe("other");
  });
});

describe("matchesTaskSearch", () => {
  const task = mkTask({
    id: "t1",
    name: "1F 壁塗装",
    contractorName: "山田塗装",
    projectName: "田中邸 新築",
    majorCategory: "塗装工事",
  });

  it("空クエリはヒット扱い", () => {
    expect(matchesTaskSearch(task, "")).toBe(true);
    expect(matchesTaskSearch(task, "   ")).toBe(true);
  });

  it("タスク名の部分一致でヒット", () => {
    expect(matchesTaskSearch(task, "壁塗装")).toBe(true);
  });

  it("協力会社名でヒット", () => {
    expect(matchesTaskSearch(task, "山田")).toBe(true);
  });

  it("案件名でヒット", () => {
    expect(matchesTaskSearch(task, "田中邸")).toBe(true);
  });

  it("工種名（majorCategory）でヒット", () => {
    expect(matchesTaskSearch(task, "塗装工事")).toBe(true);
  });

  it("大文字小文字を無視する", () => {
    const en = mkTask({ id: "t2", name: "Electrical Wiring" });
    expect(matchesTaskSearch(en, "electrical")).toBe(true);
    expect(matchesTaskSearch(en, "ELECTRICAL")).toBe(true);
  });

  it("該当なしは false", () => {
    expect(matchesTaskSearch(task, "存在しない語")).toBe(false);
  });
});

describe("filterGanttTasks (工種フィルタ ∧ 検索)", () => {
  const tasks: GanttTask[] = [
    mkTask({ id: "t1", name: "1F 壁塗装", majorCategory: "塗装", contractorName: "山田塗装" }),
    mkTask({ id: "t2", name: "軽鉄下地組み", majorCategory: "軽鉄", contractorName: "佐藤" }),
    mkTask({ id: "t3", name: "電気配線", majorCategory: "電気工事", contractorName: "鈴木電設" }),
  ];

  it("全工種ONで検索なし→全件通過", () => {
    const result = filterGanttTasks(tasks, new Set(TRADE_CATEGORIES), "");
    expect(result).toHaveLength(3);
  });

  it("工種フィルタで塗装のみに絞る", () => {
    const result = filterGanttTasks(tasks, new Set(["painting"]), "");
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("検索クエリと工種フィルタは AND", () => {
    // 全工種ON + "山田" → 山田塗装のみ
    const r1 = filterGanttTasks(tasks, new Set(TRADE_CATEGORIES), "山田");
    expect(r1.map((t) => t.id)).toEqual(["t1"]);
    // 電気工種ONのみ + "山田" → 交集合ゼロ
    const r2 = filterGanttTasks(tasks, new Set(["electrical"]), "山田");
    expect(r2).toHaveLength(0);
  });

  it("工種セットが空なら全非表示", () => {
    const result = filterGanttTasks(tasks, new Set(), "");
    expect(result).toHaveLength(0);
  });
});
