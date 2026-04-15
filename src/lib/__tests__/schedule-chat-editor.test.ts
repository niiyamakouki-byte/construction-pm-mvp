import { describe, expect, it } from "vitest";
import type { GeneratedSchedule, GeneratedTask } from "../ai-schedule-generator.js";
import {
  applyScheduleEdit,
  parseScheduleCommand,
  resolveTaskReference,
  summarizeRange,
} from "../schedule-chat-editor.js";
import type { ScheduleEdit } from "../schedule-chat-editor.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(
  overrides: Partial<GeneratedTask> & Pick<GeneratedTask, "id" | "name">,
): GeneratedTask {
  const start = new Date("2026-04-15");
  const end = new Date("2026-04-17");
  return {
    category: "painting",
    startDate: new Date(start),
    endDate: new Date(end),
    durationDays: 3,
    dependencies: [],
    crewSize: 1,
    ...overrides,
  };
}

function makeSchedule(tasks: GeneratedTask[]): GeneratedSchedule {
  const start = tasks.reduce(
    (min, t) => (t.startDate < min ? t.startDate : min),
    tasks[0].startDate,
  );
  const end = tasks.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    tasks[0].endDate,
  );
  return {
    projectId: "test-proj",
    projectName: "テストプロジェクト",
    tasks,
    totalDays: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    startDate: new Date(start),
    endDate: new Date(end),
    criticalPath: [],
    generatedAt: new Date("2026-01-01"),
  };
}

// ─── resolveTaskReference ─────────────────────────────────────────────────────

describe("resolveTaskReference", () => {
  const tasks = [
    makeTask({ id: "t1", name: "塗装" }),
    makeTask({ id: "t2", name: "101号室塗装", category: "painting" }),
    makeTask({ id: "t3", name: "美装", category: "cleaning" }),
    makeTask({ id: "t4", name: "床材施工", category: "interior_finish" }),
  ];

  it("完全一致で単一タスクを返す", () => {
    const result = resolveTaskReference("塗装", tasks);
    // 完全一致: "塗装" のみ（"101号室塗装" は完全一致しない）
    expect(result.map((t) => t.id)).toContain("t1");
    expect(result.every((t) => t.name === "塗装")).toBe(true);
  });

  it("部分一致で複数タスクを返す", () => {
    const result = resolveTaskReference("塗装", [
      makeTask({ id: "t1", name: "壁塗装" }),
      makeTask({ id: "t2", name: "天井塗装" }),
      makeTask({ id: "t3", name: "美装" }),
    ]);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("該当なしは空配列", () => {
    const result = resolveTaskReference("存在しない工事", tasks);
    expect(result).toHaveLength(0);
  });

  it("複数マッチを返す（部分一致）", () => {
    const result = resolveTaskReference("施工", [
      makeTask({ id: "a", name: "床材施工" }),
      makeTask({ id: "b", name: "タイル施工" }),
      makeTask({ id: "c", name: "塗装" }),
    ]);
    expect(result.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("かな変換で一致", () => {
    const result = resolveTaskReference("とそう", [
      makeTask({ id: "x", name: "とそう" }),
    ]);
    expect(result.map((t) => t.id)).toContain("x");
  });

  it("空文字列は空配列", () => {
    expect(resolveTaskReference("", tasks)).toHaveLength(0);
  });
});

// ─── parseScheduleCommand ─────────────────────────────────────────────────────

describe("parseScheduleCommand", () => {
  const paintTask = makeTask({ id: "paint-1", name: "塗装" });
  const cleanTask = makeTask({
    id: "clean-1",
    name: "美装",
    category: "cleaning",
    startDate: new Date("2026-04-18"),
    endDate: new Date("2026-04-20"),
    durationDays: 3,
  });
  const schedule = makeSchedule([paintTask, cleanTask]);

  it("後ろ倒し: 塗装を2日後ろ倒し", () => {
    const edits = parseScheduleCommand("塗装を2日後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_backward");
    expect(edits[0].days).toBe(2);
    expect(edits[0].taskIds).toContain("paint-1");
  });

  it("前倒し: 清掃を3日前倒し（美装に部分一致）", () => {
    const scheduleWithClean = makeSchedule([
      makeTask({ id: "clean-2", name: "清掃", category: "cleaning" }),
    ]);
    const edits = parseScheduleCommand("清掃を3日前倒し", scheduleWithClean);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_forward");
    expect(edits[0].days).toBe(3);
  });

  it("後ろ倒し: 塗装を5日遅らせて", () => {
    const edits = parseScheduleCommand("塗装を5日遅らせて", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_backward");
    expect(edits[0].days).toBe(5);
  });

  it("期間: 塗装を5日間に", () => {
    const edits = parseScheduleCommand("塗装を5日間に", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_duration");
    expect(edits[0].durationDays).toBe(5);
  });

  it("開始日: 塗装の開始を2026-04-20に", () => {
    const edits = parseScheduleCommand("塗装の開始を2026-04-20に", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_start");
    expect(edits[0].date?.getFullYear()).toBe(2026);
    expect(edits[0].date?.getMonth()).toBe(3); // April = 3
    expect(edits[0].date?.getDate()).toBe(20);
  });

  it("削除: 塗装を削除", () => {
    const edits = parseScheduleCommand("塗装を削除", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("remove");
    expect(edits[0].taskIds).toContain("paint-1");
  });

  it("削除: 塗装を消して", () => {
    const edits = parseScheduleCommand("塗装を消して", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("remove");
  });

  it("リネーム: 塗装を壁塗装に変更", () => {
    const edits = parseScheduleCommand("塗装を壁塗装に変更", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("rename");
    expect(edits[0].newName).toBe("壁塗装");
    expect(edits[0].taskIds).toContain("paint-1");
  });

  it("複数編集: 読点区切り", () => {
    const edits = parseScheduleCommand(
      "塗装を2日後ろ倒し、美装を1日前倒し",
      schedule,
    );
    expect(edits).toHaveLength(2);
    expect(edits[0].kind).toBe("shift_backward");
    expect(edits[1].kind).toBe("shift_forward");
  });

  it("複数編集: そして区切り", () => {
    const edits = parseScheduleCommand(
      "塗装を2日後ろ倒しそして美装を1日前倒し",
      schedule,
    );
    expect(edits).toHaveLength(2);
  });

  it("複数編集: および区切り", () => {
    const edits = parseScheduleCommand(
      "塗装を2日遅らせおよび美装を3日前倒し",
      schedule,
    );
    expect(edits).toHaveLength(2);
  });

  it("全角数字: 塗装を２日後ろ倒し", () => {
    const edits = parseScheduleCommand("塗装を２日後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].days).toBe(2);
  });

  it("漢数字: 塗装を三日後ろ倒し", () => {
    const edits = parseScheduleCommand("塗装を三日後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].days).toBe(3);
  });

  it("マッチしないコマンドは空配列", () => {
    const edits = parseScheduleCommand("意味不明なコマンドです", schedule);
    expect(edits).toHaveLength(0);
  });
});

// ─── applyScheduleEdit ────────────────────────────────────────────────────────

describe("applyScheduleEdit", () => {
  function freshSchedule() {
    return makeSchedule([
      makeTask({
        id: "t1",
        name: "塗装",
        startDate: new Date("2026-04-15"),
        endDate: new Date("2026-04-17"),
        durationDays: 3,
      }),
      makeTask({
        id: "t2",
        name: "美装",
        startDate: new Date("2026-04-18"),
        endDate: new Date("2026-04-20"),
        durationDays: 3,
      }),
    ]);
  }

  it("shift_backward: 開始・終了日を後ろにずらす", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "shift_backward",
      taskIds: ["t1"],
      days: 2,
      confidence: 1.0,
      sourceText: "塗装を2日後ろ倒し",
    };
    const result = applyScheduleEdit(sched, [edit]);
    const t1 = result.tasks.find((t) => t.id === "t1")!;
    expect(t1.startDate.toISOString().slice(0, 10)).toBe("2026-04-17");
    expect(t1.endDate.toISOString().slice(0, 10)).toBe("2026-04-19");
  });

  it("shift_forward: 開始・終了日を前にずらす", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "shift_forward",
      taskIds: ["t2"],
      days: 1,
      confidence: 1.0,
      sourceText: "美装を1日前倒し",
    };
    const result = applyScheduleEdit(sched, [edit]);
    const t2 = result.tasks.find((t) => t.id === "t2")!;
    expect(t2.startDate.toISOString().slice(0, 10)).toBe("2026-04-17");
    expect(t2.endDate.toISOString().slice(0, 10)).toBe("2026-04-19");
  });

  it("set_duration: 期間を変更する", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "set_duration",
      taskIds: ["t1"],
      durationDays: 5,
      confidence: 1.0,
      sourceText: "塗装を5日間に",
    };
    const result = applyScheduleEdit(sched, [edit]);
    const t1 = result.tasks.find((t) => t.id === "t1")!;
    expect(t1.durationDays).toBe(5);
    expect(t1.endDate.toISOString().slice(0, 10)).toBe("2026-04-19");
  });

  it("set_start: 開始日を変更する", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "set_start",
      taskIds: ["t1"],
      date: new Date("2026-04-14"),
      confidence: 1.0,
      sourceText: "塗装の開始を4/14に",
    };
    const result = applyScheduleEdit(sched, [edit]);
    const t1 = result.tasks.find((t) => t.id === "t1")!;
    expect(t1.startDate.toISOString().slice(0, 10)).toBe("2026-04-14");
  });

  it("set_end: 終了日を変更する", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "set_end",
      taskIds: ["t1"],
      date: new Date("2026-04-20"),
      confidence: 1.0,
      sourceText: "塗装の終了を4/20に",
    };
    const result = applyScheduleEdit(sched, [edit]);
    const t1 = result.tasks.find((t) => t.id === "t1")!;
    expect(t1.endDate.toISOString().slice(0, 10)).toBe("2026-04-20");
    expect(t1.durationDays).toBe(6); // 4/15-4/20 = 6 days
  });

  it("remove: タスクを削除する", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "remove",
      taskIds: ["t1"],
      confidence: 1.0,
      sourceText: "塗装を削除",
    };
    const result = applyScheduleEdit(sched, [edit]);
    expect(result.tasks.find((t) => t.id === "t1")).toBeUndefined();
    expect(result.tasks).toHaveLength(1);
  });

  it("rename: タスク名を変更する", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "rename",
      taskIds: ["t1"],
      newName: "壁塗装",
      confidence: 1.0,
      sourceText: "塗装を壁塗装に変更",
    };
    const result = applyScheduleEdit(sched, [edit]);
    const t1 = result.tasks.find((t) => t.id === "t1")!;
    expect(t1.name).toBe("壁塗装");
  });

  it("不変性: 元のスケジュールは変更されない", () => {
    const sched = freshSchedule();
    const originalStart = sched.tasks[0].startDate.toISOString();
    const edit: ScheduleEdit = {
      kind: "shift_backward",
      taskIds: ["t1"],
      days: 5,
      confidence: 1.0,
      sourceText: "テスト",
    };
    applyScheduleEdit(sched, [edit]);
    expect(sched.tasks[0].startDate.toISOString()).toBe(originalStart);
  });

  it("set_start > endDate で throw", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "set_start",
      taskIds: ["t1"],
      date: new Date("2026-04-25"), // endDate(4/17)より後
      confidence: 1.0,
      sourceText: "矛盾テスト",
    };
    expect(() => applyScheduleEdit(sched, [edit])).toThrow();
  });

  it("set_end < startDate で throw", () => {
    const sched = freshSchedule();
    const edit: ScheduleEdit = {
      kind: "set_end",
      taskIds: ["t1"],
      date: new Date("2026-04-10"), // startDate(4/15)より前
      confidence: 1.0,
      sourceText: "矛盾テスト",
    };
    expect(() => applyScheduleEdit(sched, [edit])).toThrow();
  });
});

// ─── summarizeRange ───────────────────────────────────────────────────────────

describe("summarizeRange", () => {
  const tasks = [
    makeTask({
      id: "a",
      name: "塗装",
      startDate: new Date("2026-04-15"),
      endDate: new Date("2026-04-17"),
    }),
    makeTask({
      id: "b",
      name: "電気工事",
      category: "mep_finish" as const,
      startDate: new Date("2026-04-16"),
      endDate: new Date("2026-04-19"),
    }),
    makeTask({
      id: "c",
      name: "美装",
      category: "cleaning" as const,
      startDate: new Date("2026-04-21"),
      endDate: new Date("2026-04-23"),
    }),
  ];
  const schedule = makeSchedule(tasks);

  it("範囲内のタスク件数が含まれる", () => {
    const result = summarizeRange(
      schedule,
      new Date("2026-04-15"),
      new Date("2026-04-20"),
    );
    expect(result).toContain("4/15");
    expect(result).toContain("4/20");
    // 塗装と電気工事が含まれる（美装は4/21からなので範囲外）
    expect(result).toContain("塗装");
    expect(result).toContain("電気工事");
    expect(result).not.toContain("美装(");
  });

  it("範囲外タスクを除外する", () => {
    const result = summarizeRange(
      schedule,
      new Date("2026-04-21"),
      new Date("2026-04-25"),
    );
    expect(result).toContain("美装");
    expect(result).not.toContain("塗装(");
  });

  it("該当なしは「なし」を返す", () => {
    const result = summarizeRange(
      schedule,
      new Date("2026-05-01"),
      new Date("2026-05-10"),
    );
    expect(result).toContain("なし");
  });

  it("日本語フォーマットで出力される", () => {
    const result = summarizeRange(
      schedule,
      new Date("2026-04-15"),
      new Date("2026-04-20"),
    );
    expect(result).toMatch(/の間の作業:/);
  });
});
