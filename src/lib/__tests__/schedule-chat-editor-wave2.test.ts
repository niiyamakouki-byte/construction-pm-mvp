/**
 * 第2波(wave2, bead laporta-beads-1wb)拡張の単体テスト。
 * 追加分:
 *   - 単発シフトの週/月単位対応（「塗装を1週間後ろ倒し」）
 *   - 全工程一括シフト（shift_all_forward / shift_all_backward）
 *   - 担当者フェーズ一括（set_assignee_phase）
 *   - 進捗フェーズ一括（set_progress_phase）
 * 既存 schedule-chat-editor / -p5 テストを壊さないよう別ファイルに分けている。
 */
import { describe, expect, it } from "vitest";
import type { GeneratedSchedule, GeneratedTask } from "../ai-schedule-generator.js";
import {
  applyScheduleEdit,
  parseScheduleCommand,
  describeEdit,
  COMMAND_REGISTRY,
} from "../schedule-chat-editor.js";

function makeTask(
  overrides: Partial<GeneratedTask> & Pick<GeneratedTask, "id" | "name">,
): GeneratedTask {
  return {
    category: "other",
    startDate: new Date("2026-04-15"),
    endDate: new Date("2026-04-17"),
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
    projectId: "p1",
    projectName: "test",
    tasks,
    totalDays: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    startDate: new Date(start),
    endDate: new Date(end),
    criticalPath: [],
    generatedAt: new Date("2026-01-01"),
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── 単発シフトの週/月単位対応 ────────────────────────────────────────────────

describe("単発シフト: 週/月単位（wave2）", () => {
  const schedule = makeSchedule([
    makeTask({
      id: "paint",
      name: "塗装",
      startDate: new Date("2026-04-15"),
      endDate: new Date("2026-04-17"),
    }),
  ]);

  it("「塗装を1週間後ろ倒し」→ 7日後ろ", () => {
    const edits = parseScheduleCommand("塗装を1週間後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_backward");
    expect(edits[0].days).toBe(7);
    const r = applyScheduleEdit(schedule, edits);
    expect(iso(r.tasks[0].startDate)).toBe("2026-04-22");
  });

  it("「塗装を2週間前倒し」→ 14日前", () => {
    const edits = parseScheduleCommand("塗装を2週間前倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_forward");
    expect(edits[0].days).toBe(14);
    const r = applyScheduleEdit(schedule, edits);
    expect(iso(r.tasks[0].startDate)).toBe("2026-04-01");
  });

  it("「塗装を1ヶ月後ろ倒し」→ 30日後（概算）", () => {
    const edits = parseScheduleCommand("塗装を1ヶ月後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].days).toBe(30);
  });

  it("従来の「日」指定は不変（回帰なし）", () => {
    const edits = parseScheduleCommand("塗装を3日後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_backward");
    expect(edits[0].days).toBe(3);
  });
});

// ─── 全工程一括シフト ─────────────────────────────────────────────────────────

describe("shift_all（全工程一括シフト）", () => {
  const build = () =>
    makeSchedule([
      makeTask({
        id: "a",
        name: "解体",
        startDate: new Date("2026-04-15"),
        endDate: new Date("2026-04-17"),
      }),
      makeTask({
        id: "b",
        name: "電気",
        dependencies: ["a"],
        startDate: new Date("2026-04-18"),
        endDate: new Date("2026-04-20"),
      }),
    ]);

  it("「全体を1週間後ろ倒し」→ 全タスク+7日", () => {
    const schedule = build();
    const edits = parseScheduleCommand("全体を1週間後ろ倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_all_backward");
    expect(edits[0].days).toBe(7);
    expect(edits[0].taskIds.sort()).toEqual(["a", "b"]);
    const r = applyScheduleEdit(schedule, edits);
    expect(iso(r.tasks.find((t) => t.id === "a")!.startDate)).toBe("2026-04-22");
    expect(iso(r.tasks.find((t) => t.id === "b")!.startDate)).toBe("2026-04-25");
  });

  it("「全工程を3日前倒し」→ 全タスク-3日", () => {
    const schedule = build();
    const edits = parseScheduleCommand("全工程を3日前倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_all_forward");
    expect(edits[0].days).toBe(3);
    const r = applyScheduleEdit(schedule, edits);
    expect(iso(r.tasks.find((t) => t.id === "a")!.startDate)).toBe("2026-04-12");
    expect(iso(r.tasks.find((t) => t.id === "b")!.startDate)).toBe("2026-04-15");
  });

  it("全体シフトは相対順序を保つ（依存gapが不変）", () => {
    const schedule = build();
    const edits = parseScheduleCommand("全部の工程をまとめて2日後ろに", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("shift_all_backward");
    const r = applyScheduleEdit(schedule, edits);
    const a = r.tasks.find((t) => t.id === "a")!;
    const b = r.tasks.find((t) => t.id === "b")!;
    // a.end→b.start の隙間が元の1日のまま
    const gap =
      (b.startDate.getTime() - a.endDate.getTime()) / 86400000;
    expect(gap).toBe(1);
  });

  it("describeEdit は全工程シフト文言", () => {
    const schedule = build();
    const edits = parseScheduleCommand("全体を1週間後ろ倒し", schedule);
    const s = describeEdit(edits[0], schedule);
    expect(s).toContain("全工程");
    expect(s).toContain("7日");
    expect(s).toContain("2件");
  });
});

// ─── 担当者フェーズ一括 ───────────────────────────────────────────────────────

describe("set_assignee_phase（担当者フェーズ一括）", () => {
  const build = () =>
    makeSchedule([
      makeTask({ id: "k1", name: "解体本体", phase: "解体工事" }),
      makeTask({ id: "k2", name: "残材撤去", phase: "解体工事" }),
      makeTask({ id: "d1", name: "電気配線", phase: "電気工事" }),
    ]);

  it("「解体工事は全部田中さんに」→ 解体フェーズ2件に田中", () => {
    const schedule = build();
    const edits = parseScheduleCommand("解体工事は全部田中さんに", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_assignee_phase");
    expect(edits[0].assigneeName).toBe("田中");
    expect(edits[0].taskIds.sort()).toEqual(["k1", "k2"]);
    const r = applyScheduleEdit(schedule, edits);
    expect(r.tasks.find((t) => t.id === "k1")!.assigneeName).toBe("田中");
    expect(r.tasks.find((t) => t.id === "k2")!.assigneeName).toBe("田中");
    // 別フェーズは不変
    expect(r.tasks.find((t) => t.id === "d1")!.assigneeName ?? null).toBeNull();
  });

  it("「電気工事の担当を全部佐藤さんに」", () => {
    const schedule = build();
    const edits = parseScheduleCommand("電気工事の担当を全部佐藤さんに", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_assignee_phase");
    expect(edits[0].assigneeName).toBe("佐藤");
    expect(edits[0].taskIds).toEqual(["d1"]);
  });

  it("「解体工事をまとめて鈴木さんにアサイン」", () => {
    const schedule = build();
    const edits = parseScheduleCommand("解体工事をまとめて鈴木さんにアサイン", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_assignee_phase");
    expect(edits[0].assigneeName).toBe("鈴木");
  });

  it("フェーズが解決できなければ何も返さない", () => {
    const schedule = build();
    const edits = parseScheduleCommand("存在しない工事は全部田中さんに", schedule);
    expect(edits).toHaveLength(0);
  });
});

// ─── 進捗フェーズ一括 ─────────────────────────────────────────────────────────

describe("set_progress_phase（進捗フェーズ一括）", () => {
  const build = () =>
    makeSchedule([
      makeTask({ id: "k1", name: "解体本体", phase: "解体工事", progress: 0 }),
      makeTask({ id: "k2", name: "残材撤去", phase: "解体工事", progress: 0 }),
      makeTask({ id: "d1", name: "電気配線", phase: "電気工事", progress: 0 }),
    ]);

  it("「解体工事を全部完了」→ 100%", () => {
    const schedule = build();
    const edits = parseScheduleCommand("解体工事を全部完了", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_progress_phase");
    expect(edits[0].progressPercent).toBe(100);
    const r = applyScheduleEdit(schedule, edits);
    expect(r.tasks.find((t) => t.id === "k1")!.progress).toBe(100);
    expect(r.tasks.find((t) => t.id === "k2")!.progress).toBe(100);
    expect(r.tasks.find((t) => t.id === "d1")!.progress).toBe(0);
  });

  it("「解体工事を全部50%に」→ 50%", () => {
    const schedule = build();
    const edits = parseScheduleCommand("解体工事を全部50%に", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_progress_phase");
    expect(edits[0].progressPercent).toBe(50);
  });

  it("「解体工事をまとめて半分」→ 50%", () => {
    const schedule = build();
    const edits = parseScheduleCommand("解体工事をまとめて半分", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_progress_phase");
    expect(edits[0].progressPercent).toBe(50);
  });

  it("進捗値がなければフェーズシフトへ譲る（誤検出しない）", () => {
    const schedule = build();
    const edits = parseScheduleCommand("解体工事を全部3日後ろに", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("phase_shift_backward");
  });
});

// ─── レジストリ整合性 ────────────────────────────────────────────────────────

describe("wave2 kind 登録", () => {
  it("wave2 の新 kind がすべて登録されている", () => {
    const kinds = new Set(COMMAND_REGISTRY.map((c) => c.kind));
    expect(kinds.has("shift_all_backward")).toBe(true);
    expect(kinds.has("shift_all_forward")).toBe(true);
    expect(kinds.has("set_assignee_phase")).toBe(true);
    expect(kinds.has("set_progress_phase")).toBe(true);
  });

  it("kind 重複なし", () => {
    const kinds = COMMAND_REGISTRY.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

// ─── 複合コマンド（wave2 混在）───────────────────────────────────────────────

describe("複合: 全体シフト + フェーズ担当一括", () => {
  it("読点区切りで shift_all と set_assignee_phase を両取り", () => {
    const schedule = makeSchedule([
      makeTask({ id: "k1", name: "解体本体", phase: "解体工事" }),
      makeTask({ id: "d1", name: "電気配線", phase: "電気工事" }),
    ]);
    const edits = parseScheduleCommand(
      "全体を1週間後ろ倒し、解体工事は全部田中さんに",
      schedule,
    );
    expect(edits).toHaveLength(2);
    expect(edits[0].kind).toBe("shift_all_backward");
    expect(edits[1].kind).toBe("set_assignee_phase");
  });
});
