/**
 * P5 拡張分の自然言語コマンド + レジストリ + 確認チップの単体テスト。
 * 既存 schedule-chat-editor.test.ts を壊さないよう別ファイルに分けた。
 */
import { describe, expect, it } from "vitest";
import type { GeneratedSchedule, GeneratedTask } from "../ai-schedule-generator.js";
import {
  applyScheduleEdit,
  parseScheduleCommand,
  needsConfirmation,
  describeEdit,
  resolveTasksInPhase,
  COMMAND_REGISTRY,
  LOW_CONFIDENCE_THRESHOLD,
} from "../schedule-chat-editor.js";
import type { ScheduleEdit } from "../schedule-chat-editor.js";

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

// ─── add_dependency ──────────────────────────────────────────────────────────

describe("add_dependency parse", () => {
  const schedule = makeSchedule([
    makeTask({ id: "keitetsu", name: "軽鉄" }),
    makeTask({ id: "board", name: "ボード貼り" }),
    makeTask({ id: "kaitai", name: "解体" }),
    makeTask({ id: "denki", name: "電気" }),
  ]);

  it("「軽鉄はボード貼りの前」→ 軽鉄→ボード貼り", () => {
    const edits = parseScheduleCommand("軽鉄はボード貼りの前", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("add_dependency");
    expect(edits[0].taskIds).toEqual(["board"]);
    expect(edits[0].predecessorIds).toEqual(["keitetsu"]);
  });

  it("「解体が終わったら電気」→ 解体→電気", () => {
    const edits = parseScheduleCommand("解体が終わったら電気", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("add_dependency");
    expect(edits[0].taskIds).toEqual(["denki"]);
    expect(edits[0].predecessorIds).toEqual(["kaitai"]);
  });

  it("「電気は解体の後」→ 解体→電気", () => {
    const edits = parseScheduleCommand("電気は解体の後", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("add_dependency");
    expect(edits[0].taskIds).toEqual(["denki"]);
    expect(edits[0].predecessorIds).toEqual(["kaitai"]);
  });

  it("「軽鉄→ボード貼り」矢印記法", () => {
    const edits = parseScheduleCommand("軽鉄→ボード貼り", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("add_dependency");
    expect(edits[0].predecessorIds).toEqual(["keitetsu"]);
  });

  it("解決できないタスク名は無視", () => {
    const edits = parseScheduleCommand("存在しない工事はボード貼りの前", schedule);
    expect(edits).toHaveLength(0);
  });
});

describe("add_dependency apply", () => {
  const schedule = makeSchedule([
    makeTask({ id: "a", name: "A" }),
    makeTask({ id: "b", name: "B" }),
  ]);

  it("dependencies に追加される", () => {
    const edit: ScheduleEdit = {
      kind: "add_dependency",
      taskIds: ["b"],
      predecessorIds: ["a"],
      confidence: 1.0,
      sourceText: "test",
    };
    const result = applyScheduleEdit(schedule, [edit]);
    const b = result.tasks.find((t) => t.id === "b")!;
    expect(b.dependencies).toEqual(["a"]);
  });

  it("重複追加しない", () => {
    const s = makeSchedule([
      makeTask({ id: "a", name: "A" }),
      makeTask({ id: "b", name: "B", dependencies: ["a"] }),
    ]);
    const edit: ScheduleEdit = {
      kind: "add_dependency",
      taskIds: ["b"],
      predecessorIds: ["a"],
      confidence: 1.0,
      sourceText: "test",
    };
    const result = applyScheduleEdit(s, [edit]);
    const b = result.tasks.find((t) => t.id === "b")!;
    expect(b.dependencies).toEqual(["a"]);
  });

  it("自己依存は無視", () => {
    const edit: ScheduleEdit = {
      kind: "add_dependency",
      taskIds: ["a"],
      predecessorIds: ["a"],
      confidence: 1.0,
      sourceText: "test",
    };
    const result = applyScheduleEdit(schedule, [edit]);
    const a = result.tasks.find((t) => t.id === "a")!;
    expect(a.dependencies).toEqual([]);
  });
});

// ─── remove_dependency ───────────────────────────────────────────────────────

describe("remove_dependency parse & apply", () => {
  const schedule = makeSchedule([
    makeTask({ id: "keitetsu", name: "軽鉄" }),
    makeTask({ id: "board", name: "ボード貼り", dependencies: ["keitetsu"] }),
  ]);

  it("「軽鉄とボード貼りの依存を削除」→ 依存から外れる", () => {
    const edits = parseScheduleCommand("軽鉄とボード貼りの依存を削除", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("remove_dependency");
    const result = applyScheduleEdit(schedule, edits);
    const b = result.tasks.find((t) => t.id === "board")!;
    expect(b.dependencies).toEqual([]);
  });

  it("「軽鉄とボード貼りの依存を外す」も同様", () => {
    const edits = parseScheduleCommand("軽鉄とボード貼りの依存を外す", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("remove_dependency");
  });

  it("先に add_dependency と間違えないこと（削除フレーズ優先）", () => {
    const edits = parseScheduleCommand("軽鉄とボード貼りの依存を削除", schedule);
    expect(edits[0].kind).toBe("remove_dependency");
  });
});

// ─── set_assignee ────────────────────────────────────────────────────────────

describe("set_assignee", () => {
  const schedule = makeSchedule([
    makeTask({ id: "lighting", name: "照明計画" }),
    makeTask({ id: "paint", name: "塗装" }),
  ]);

  it("「照明計画は鈴木さんに」", () => {
    const edits = parseScheduleCommand("照明計画は鈴木さんに", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_assignee");
    expect(edits[0].assigneeName).toBe("鈴木");
    expect(edits[0].taskIds).toEqual(["lighting"]);
  });

  it("「照明計画の担当は鈴木さん」", () => {
    const edits = parseScheduleCommand("照明計画の担当は鈴木さん", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_assignee");
    expect(edits[0].assigneeName).toBe("鈴木");
  });

  it("「塗装を田中さんにアサイン」", () => {
    const edits = parseScheduleCommand("塗装を田中さんにアサイン", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_assignee");
    expect(edits[0].assigneeName).toBe("田中");
  });

  it("apply で GeneratedTask.assigneeName が更新される", () => {
    const edits = parseScheduleCommand("照明計画は鈴木さんに", schedule);
    const result = applyScheduleEdit(schedule, edits);
    const lighting = result.tasks.find((t) => t.id === "lighting")!;
    expect(lighting.assigneeName).toBe("鈴木");
    expect(lighting.assigneeId).toBeNull();
  });
});

// ─── set_progress ────────────────────────────────────────────────────────────

describe("set_progress", () => {
  const schedule = makeSchedule([
    makeTask({ id: "sumidashi", name: "墨出し", progress: 0 }),
    makeTask({ id: "paint", name: "塗装", progress: 20 }),
  ]);

  it("「墨出し半分終わった」→ 50%", () => {
    const edits = parseScheduleCommand("墨出し半分終わった", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("set_progress");
    expect(edits[0].progressPercent).toBe(50);
  });

  it("「墨出しを50%に」→ 50%", () => {
    const edits = parseScheduleCommand("墨出しを50%に", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].progressPercent).toBe(50);
  });

  it("「墨出しは80パーセント」→ 80%", () => {
    const edits = parseScheduleCommand("墨出しは80パーセント", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].progressPercent).toBe(80);
  });

  it("「墨出し完了」→ 100%", () => {
    const edits = parseScheduleCommand("墨出し完了", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].progressPercent).toBe(100);
  });

  it("「墨出しは終わった」→ 100%", () => {
    const edits = parseScheduleCommand("墨出しは終わった", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].progressPercent).toBe(100);
  });

  it("apply で progress が更新される", () => {
    const edits = parseScheduleCommand("墨出し半分終わった", schedule);
    const result = applyScheduleEdit(schedule, edits);
    const t = result.tasks.find((t) => t.id === "sumidashi")!;
    expect(t.progress).toBe(50);
  });

  it("100%以上の指定は無視", () => {
    // 「Aを120%に」は範囲外なのでマッチしない
    const edits = parseScheduleCommand("墨出しを120%に", schedule);
    // apply には到達しないが直接呼ばれた時のガード
    if (edits.length > 0 && edits[0].kind === "set_progress" && edits[0].progressPercent !== undefined) {
      expect(edits[0].progressPercent).toBeLessThanOrEqual(100);
    }
    // regex 「[0-9]{1,3}」を許容しているので 120 は取れてしまうが apply でガード
    const invalid: ScheduleEdit = {
      kind: "set_progress",
      taskIds: ["sumidashi"],
      progressPercent: 120,
      confidence: 1.0,
      sourceText: "test",
    };
    expect(() => applyScheduleEdit(schedule, [invalid])).toThrow();
  });
});

// ─── phase bulk shift ────────────────────────────────────────────────────────

describe("phase_shift_backward / forward", () => {
  const kaitai1 = makeTask({
    id: "k1",
    name: "解体本体",
    phase: "解体工事",
    startDate: new Date("2026-04-15"),
    endDate: new Date("2026-04-17"),
  });
  const kaitai2 = makeTask({
    id: "k2",
    name: "残材撤去",
    phase: "解体工事",
    startDate: new Date("2026-04-18"),
    endDate: new Date("2026-04-19"),
  });
  const denki = makeTask({
    id: "d1",
    name: "電気",
    phase: "電気工事",
    dependencies: ["k2"],
    startDate: new Date("2026-04-20"),
    endDate: new Date("2026-04-22"),
  });
  const schedule = makeSchedule([kaitai1, kaitai2, denki]);

  it("「解体工事を全部3日後ろに」→ phase_shift_backward, 3件対象", () => {
    const edits = parseScheduleCommand("解体工事を全部3日後ろに", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("phase_shift_backward");
    expect(edits[0].days).toBe(3);
    expect(edits[0].taskIds.sort()).toEqual(["k1", "k2"]);
  });

  it("apply でフェーズ配下タスクが全部後ろ倒し", () => {
    const edits = parseScheduleCommand("解体工事を全部3日後ろに", schedule);
    const result = applyScheduleEdit(schedule, edits);
    const k1 = result.tasks.find((t) => t.id === "k1")!;
    const k2 = result.tasks.find((t) => t.id === "k2")!;
    expect(k1.startDate.toISOString().slice(0, 10)).toBe("2026-04-18");
    expect(k2.startDate.toISOString().slice(0, 10)).toBe("2026-04-21");
  });

  it("apply で cascade により後続タスクも波及", () => {
    const edits = parseScheduleCommand("解体工事を全部3日後ろに", schedule);
    const result = applyScheduleEdit(schedule, edits);
    const d1 = result.tasks.find((t) => t.id === "d1")!;
    // d1 は k2 に依存: k2 が +3 なので d1 も +3 されている
    expect(d1.startDate.toISOString().slice(0, 10)).toBe("2026-04-23");
    // cascadedTaskIds 記録されている
    expect(edits[0].cascadedTaskIds).toEqual(["d1"]);
  });

  it("「解体工事をまとめて2日前倒し」→ phase_shift_forward", () => {
    const edits = parseScheduleCommand("解体工事をまとめて2日前倒し", schedule);
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe("phase_shift_forward");
    expect(edits[0].days).toBe(2);
  });

  it("「まとめて」なしなら phase_shift ではなく普通の shift 判定に落ちる", () => {
    const edits = parseScheduleCommand("解体工事を3日後ろ倒し", schedule);
    // フェーズ「解体工事」に一致するタスク名はないので shift_backward もマッチしない
    // → 0 件
    expect(edits.length).toBeLessThanOrEqual(1);
    if (edits.length === 1) {
      expect(edits[0].kind).not.toBe("phase_shift_backward");
    }
  });
});

// ─── resolveTasksInPhase ─────────────────────────────────────────────────────

describe("resolveTasksInPhase", () => {
  const tasks = [
    makeTask({ id: "a", name: "解体", phase: "解体工事" }),
    makeTask({ id: "b", name: "電気配線", phase: "電気工事" }),
    makeTask({ id: "c", name: "その他", phase: undefined }),
  ];

  it("完全一致で phase 取得", () => {
    const result = resolveTasksInPhase("解体工事", tasks);
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("phase 未設定のタスクは対象外", () => {
    const result = resolveTasksInPhase("その他", tasks);
    expect(result).toHaveLength(0);
  });

  it("部分一致でも取得（「解体」→「解体工事」）", () => {
    const result = resolveTasksInPhase("解体", tasks);
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });
});

// ─── confidence / needsConfirmation ──────────────────────────────────────────

describe("needsConfirmation", () => {
  it("confidence >= しきい値 は false", () => {
    const edit: ScheduleEdit = {
      kind: "rename",
      taskIds: ["t1"],
      newName: "x",
      confidence: LOW_CONFIDENCE_THRESHOLD,
      sourceText: "",
    };
    expect(needsConfirmation(edit)).toBe(false);
  });

  it("confidence < しきい値 は true", () => {
    const edit: ScheduleEdit = {
      kind: "rename",
      taskIds: ["t1"],
      newName: "x",
      confidence: LOW_CONFIDENCE_THRESHOLD - 0.01,
      sourceText: "",
    };
    expect(needsConfirmation(edit)).toBe(true);
  });

  it("複数マッチした rename は confidence 低い", () => {
    const schedule = makeSchedule([
      makeTask({ id: "a", name: "壁塗装" }),
      makeTask({ id: "b", name: "天井塗装" }),
    ]);
    const edits = parseScheduleCommand("塗装を仕上塗装に変更", schedule);
    expect(edits).toHaveLength(1);
    expect(needsConfirmation(edits[0])).toBe(true);
  });

  it("単一マッチの rename は confidence 高い", () => {
    const schedule = makeSchedule([
      makeTask({ id: "a", name: "塗装" }),
    ]);
    const edits = parseScheduleCommand("塗装を仕上塗装に変更", schedule);
    expect(edits).toHaveLength(1);
    expect(needsConfirmation(edits[0])).toBe(false);
  });
});

// ─── describeEdit ────────────────────────────────────────────────────────────

describe("describeEdit", () => {
  const schedule = makeSchedule([
    makeTask({ id: "a", name: "塗装" }),
    makeTask({ id: "b", name: "清掃" }),
  ]);

  it("shift_backward の説明文", () => {
    const edit: ScheduleEdit = {
      kind: "shift_backward",
      taskIds: ["a"],
      days: 2,
      confidence: 1.0,
      sourceText: "",
    };
    expect(describeEdit(edit, schedule)).toBe("塗装を2日後ろ倒しにします");
  });

  it("add_dependency の説明文", () => {
    const edit: ScheduleEdit = {
      kind: "add_dependency",
      taskIds: ["b"],
      predecessorIds: ["a"],
      confidence: 0.6,
      sourceText: "",
    };
    expect(describeEdit(edit, schedule)).toBe("塗装を清掃の先行タスクに追加します");
  });

  it("phase_shift_backward の説明文", () => {
    const edit: ScheduleEdit = {
      kind: "phase_shift_backward",
      taskIds: ["a", "b"],
      days: 3,
      phaseName: "解体工事",
      confidence: 0.95,
      sourceText: "",
    };
    expect(describeEdit(edit, schedule)).toContain("解体工事");
    expect(describeEdit(edit, schedule)).toContain("3日");
    expect(describeEdit(edit, schedule)).toContain("2件");
  });

  it("set_assignee の説明文", () => {
    const edit: ScheduleEdit = {
      kind: "set_assignee",
      taskIds: ["a"],
      assigneeName: "鈴木",
      confidence: 1.0,
      sourceText: "",
    };
    expect(describeEdit(edit, schedule)).toBe("塗装の担当を鈴木にします");
  });
});

// ─── レジストリ拡張性 ──────────────────────────────────────────────────────

describe("COMMAND_REGISTRY registration integrity", () => {
  it("全 kind に parse + apply が揃っている", () => {
    for (const cmd of COMMAND_REGISTRY) {
      expect(typeof cmd.parse).toBe("function");
      expect(typeof cmd.apply).toBe("function");
      expect(cmd.kind).toBeTypeOf("string");
    }
  });

  it("kind 重複なし", () => {
    const kinds = COMMAND_REGISTRY.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("P5 新規 kind がすべて登録されている", () => {
    const kinds = new Set(COMMAND_REGISTRY.map((c) => c.kind));
    expect(kinds.has("add_dependency")).toBe(true);
    expect(kinds.has("remove_dependency")).toBe(true);
    expect(kinds.has("set_assignee")).toBe(true);
    expect(kinds.has("set_progress")).toBe(true);
    expect(kinds.has("phase_shift_backward")).toBe(true);
    expect(kinds.has("phase_shift_forward")).toBe(true);
  });
});

// ─── 複合コマンド ────────────────────────────────────────────────────────────

describe("複合コマンドの解釈", () => {
  const schedule = makeSchedule([
    makeTask({ id: "a", name: "塗装", progress: 0 }),
    makeTask({ id: "b", name: "清掃", progress: 0 }),
  ]);

  it("読点区切りで進捗+担当設定", () => {
    const edits = parseScheduleCommand(
      "塗装半分終わった、清掃は鈴木さんに",
      schedule,
    );
    expect(edits).toHaveLength(2);
    expect(edits[0].kind).toBe("set_progress");
    expect(edits[1].kind).toBe("set_assignee");
  });

  it("読点区切りで shift + add_dependency", () => {
    const s = makeSchedule([
      makeTask({ id: "a", name: "軽鉄" }),
      makeTask({ id: "b", name: "ボード貼り" }),
    ]);
    const edits = parseScheduleCommand(
      "軽鉄を2日後ろ倒し、軽鉄はボード貼りの前",
      s,
    );
    expect(edits).toHaveLength(2);
    expect(edits[0].kind).toBe("shift_backward");
    expect(edits[1].kind).toBe("add_dependency");
  });
});
