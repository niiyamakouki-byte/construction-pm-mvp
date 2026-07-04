/**
 * gantt-phase-grouping.test.ts — COMPASS基準 P1 ロジック検証
 */
import { describe, it, expect } from "vitest";
import type { GanttTask } from "../components/gantt/types.js";
import {
  PHASE_FALLBACK_NAME,
  buildGanttVisibleRows,
  collapsedPhasesStorageKey,
  computePhaseProgress,
  computePhaseProgressMap,
  computePhaseSpan,
  groupTasksByPhase,
  readCollapsedPhases,
  writeCollapsedPhases,
} from "./gantt-phase-grouping.js";

function makeTask(overrides: Partial<GanttTask> & { id: string; startDate: string; endDate: string }): GanttTask {
  const { id, ...rest } = overrides;
  return {
    id,
    projectId: "proj-1",
    name: id,
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    sortIndex: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    projectName: "案件A",
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: false,
    ...rest,
  } as GanttTask;
}

describe("groupTasksByPhase", () => {
  it("majorCategory 別にタスクを束ね、入力順を保つ", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "t1", startDate: "2026-06-01", endDate: "2026-06-03", majorCategory: "電気工事" }),
      makeTask({ id: "t2", startDate: "2026-06-04", endDate: "2026-06-05", majorCategory: "内装仕上" }),
      makeTask({ id: "t3", startDate: "2026-06-06", endDate: "2026-06-07", majorCategory: "電気工事" }),
    ];
    const groups = groupTasksByPhase(tasks);
    expect(Array.from(groups.keys())).toEqual(["電気工事", "内装仕上"]);
    expect(groups.get("電気工事")!.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(groups.get("内装仕上")!.map((t) => t.id)).toEqual(["t2"]);
  });

  it("majorCategory 未設定/空文字は 'その他' に集約", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "t1", startDate: "2026-06-01", endDate: "2026-06-02" }),
      makeTask({ id: "t2", startDate: "2026-06-03", endDate: "2026-06-04", majorCategory: "" }),
      makeTask({ id: "t3", startDate: "2026-06-05", endDate: "2026-06-06", majorCategory: "   " }),
    ];
    const groups = groupTasksByPhase(tasks);
    expect(Array.from(groups.keys())).toEqual([PHASE_FALLBACK_NAME]);
    expect(groups.get(PHASE_FALLBACK_NAME)!.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("空入力で空 Map を返す", () => {
    const groups = groupTasksByPhase([]);
    expect(groups.size).toBe(0);
  });
});

describe("computePhaseProgress — 日数加重", () => {
  it("同じ日数のタスクは単純平均になる", () => {
    // 各 2 日, 進捗 50/100 → 平均 75
    const tasks: GanttTask[] = [
      makeTask({ id: "a", startDate: "2026-06-01", endDate: "2026-06-02", progress: 50 }),
      makeTask({ id: "b", startDate: "2026-06-03", endDate: "2026-06-04", progress: 100 }),
    ];
    expect(computePhaseProgress(tasks)).toBe(75);
  });

  it("長期タスクの進捗が重く反映される (日数加重)", () => {
    // A: 10 日 / 0%,  B: 2 日 / 100% → (0*10 + 100*2) / 12 = 16.67 → 17
    const tasks: GanttTask[] = [
      makeTask({ id: "a", startDate: "2026-06-01", endDate: "2026-06-10", progress: 0 }),
      makeTask({ id: "b", startDate: "2026-06-11", endDate: "2026-06-12", progress: 100 }),
    ];
    expect(computePhaseProgress(tasks)).toBe(17);
  });

  it("全タスク 100% で 100 を返す", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "a", startDate: "2026-06-01", endDate: "2026-06-03", progress: 100 }),
      makeTask({ id: "b", startDate: "2026-06-04", endDate: "2026-06-05", progress: 100 }),
    ];
    expect(computePhaseProgress(tasks)).toBe(100);
  });

  it("空入力で 0", () => {
    expect(computePhaseProgress([])).toBe(0);
  });

  it("progress 範囲外は 0-100 にクランプ", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "a", startDate: "2026-06-01", endDate: "2026-06-02", progress: -20 }),
      makeTask({ id: "b", startDate: "2026-06-03", endDate: "2026-06-04", progress: 150 }),
    ];
    // 日数同じ 2 → (0 + 100) / 2 = 50
    expect(computePhaseProgress(tasks)).toBe(50);
  });

  it("startDate/endDate 欠損は 1 日として扱う (異常時フォールバック)", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "a", startDate: "", endDate: "", progress: 40 }),
      makeTask({ id: "b", startDate: "2026-06-03", endDate: "2026-06-04", progress: 60 }),
    ];
    // a=1日 * 40, b=2日 * 60 → 160 / 3 = 53.33 → 53
    expect(computePhaseProgress(tasks)).toBe(53);
  });
});

describe("computePhaseProgressMap", () => {
  it("Map<phaseName, タスク[]> → Map<phaseName, progress> を返す", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "t1", startDate: "2026-06-01", endDate: "2026-06-02", progress: 100, majorCategory: "解体" }),
      makeTask({ id: "t2", startDate: "2026-06-03", endDate: "2026-06-04", progress: 0, majorCategory: "電気" }),
    ];
    const map = computePhaseProgressMap(groupTasksByPhase(tasks));
    expect(map.get("解体")).toBe(100);
    expect(map.get("電気")).toBe(0);
  });
});

describe("computePhaseSpan", () => {
  it("最小 startDate / 最大 endDate を返す", () => {
    const tasks: GanttTask[] = [
      makeTask({ id: "a", startDate: "2026-06-05", endDate: "2026-06-08" }),
      makeTask({ id: "b", startDate: "2026-06-01", endDate: "2026-06-04" }),
      makeTask({ id: "c", startDate: "2026-06-03", endDate: "2026-06-10" }),
    ];
    expect(computePhaseSpan(tasks)).toEqual({ start: "2026-06-01", end: "2026-06-10" });
  });

  it("空入力で null", () => {
    expect(computePhaseSpan([])).toBeNull();
  });
});

describe("buildGanttVisibleRows", () => {
  const tasks: GanttTask[] = [
    makeTask({ id: "t1", startDate: "2026-06-01", endDate: "2026-06-02", majorCategory: "解体" }),
    makeTask({ id: "t2", startDate: "2026-06-03", endDate: "2026-06-04", majorCategory: "解体" }),
    makeTask({ id: "t3", startDate: "2026-06-05", endDate: "2026-06-06", majorCategory: "電気" }),
  ];

  it("フェーズヘッダ + タスク行を挿入順に並べる", () => {
    const rows = buildGanttVisibleRows(groupTasksByPhase(tasks), new Set(), {
      projectId: "proj-1",
      projectName: "案件A",
      fallbackTasks: tasks,
    });
    expect(rows.map((row) => (row.type === "phase" ? `PHASE:${row.group.phaseName}` : `TASK:${row.task.id}`))).toEqual([
      "PHASE:解体",
      "TASK:t1",
      "TASK:t2",
      "PHASE:電気",
      "TASK:t3",
    ]);
  });

  it("collapsed に含まれるフェーズは配下タスクを畳む", () => {
    const rows = buildGanttVisibleRows(groupTasksByPhase(tasks), new Set(["解体"]), {
      projectId: "proj-1",
      projectName: "案件A",
      fallbackTasks: tasks,
    });
    expect(rows.map((row) => (row.type === "phase" ? `PHASE:${row.group.phaseName}(${row.group.collapsed})` : `TASK:${row.task.id}`))).toEqual([
      "PHASE:解体(true)",
      "PHASE:電気(false)",
      "TASK:t3",
    ]);
  });

  it("フェーズ行に projectId / projectName / タスク配列が乗る", () => {
    const rows = buildGanttVisibleRows(groupTasksByPhase(tasks), new Set(), {
      projectId: "proj-42",
      projectName: "銀座店",
      fallbackTasks: tasks,
    });
    const phaseRow = rows.find((row) => row.type === "phase" && row.group.phaseName === "解体");
    expect(phaseRow).toBeDefined();
    if (phaseRow?.type === "phase") {
      expect(phaseRow.group.projectId).toBe("proj-42");
      expect(phaseRow.group.projectName).toBe("銀座店");
      expect(phaseRow.group.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    }
  });

  it("groups が空でもフォールバックタスクだけを行として並べる", () => {
    const rows = buildGanttVisibleRows(new Map(), new Set(), {
      projectId: "proj-1",
      projectName: "案件A",
      fallbackTasks: tasks,
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.type === "task")).toBe(true);
  });
});

describe("collapsedPhases storage", () => {
  function makeMemStorage(): Storage {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear() {
        map.clear();
      },
      key(i: number) {
        return Array.from(map.keys())[i] ?? null;
      },
      getItem(key: string) {
        return map.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        map.set(key, value);
      },
      removeItem(key: string) {
        map.delete(key);
      },
    };
  }

  it("キーは projectId ごとに独立する", () => {
    expect(collapsedPhasesStorageKey("proj-1")).toBe("genbahub:collapsed-phases:proj-1");
    expect(collapsedPhasesStorageKey("proj-1")).not.toBe(collapsedPhasesStorageKey("proj-2"));
  });

  it("write / read で往復できる", () => {
    const storage = makeMemStorage();
    writeCollapsedPhases("proj-1", new Set(["解体", "電気"]), storage);
    const restored = readCollapsedPhases("proj-1", storage);
    expect(restored.has("解体")).toBe(true);
    expect(restored.has("電気")).toBe(true);
    expect(restored.size).toBe(2);
  });

  it("空集合を書くとキーが削除される", () => {
    const storage = makeMemStorage();
    writeCollapsedPhases("proj-1", new Set(["解体"]), storage);
    expect(storage.getItem(collapsedPhasesStorageKey("proj-1"))).not.toBeNull();
    writeCollapsedPhases("proj-1", new Set(), storage);
    expect(storage.getItem(collapsedPhasesStorageKey("proj-1"))).toBeNull();
  });

  it("壊れた JSON は空集合として復元する", () => {
    const storage = makeMemStorage();
    storage.setItem(collapsedPhasesStorageKey("proj-1"), "{not json");
    const restored = readCollapsedPhases("proj-1", storage);
    expect(restored.size).toBe(0);
  });

  it("配列でない値も空集合として復元する", () => {
    const storage = makeMemStorage();
    storage.setItem(collapsedPhasesStorageKey("proj-1"), JSON.stringify({ foo: "bar" }));
    expect(readCollapsedPhases("proj-1", storage).size).toBe(0);
  });

  it("storage が null なら副作用なしで動く", () => {
    expect(() => writeCollapsedPhases("proj-1", new Set(["解体"]), null)).not.toThrow();
    expect(readCollapsedPhases("proj-1", null).size).toBe(0);
  });
});
