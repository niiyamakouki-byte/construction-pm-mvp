/**
 * Schedule Chat Editor — PROCOLLA蒸留 / P5拡張
 *
 * 自然言語コマンドで工程表を編集するルールベースパーサー。
 * P5では次を追加した:
 *   - 依存関係の追加/削除（「軽鉄はボード貼りの前」「解体が終わったら電気」）
 *   - 担当者設定（「照明計画は鈴木さんに」）
 *   - 進捗率設定（「墨出し半分終わった」→50%）
 *   - フェーズ一括操作（「解体工事を全部3日後ろに」）
 *   - コマンドをレジストリ登録制にした（kind→パーサー+アプライヤ）ため、
 *     新コマンド追加は本ファイル末尾の COMMAND_REGISTRY への1エントリ追記で済む
 *   - 曖昧マッチ時に confidence を下げ、UI 側で確認チップを出せるようにした
 *
 * 将来 LLM 差し替えを想定して NLParser 抽象化を保持している。
 */

import type { GeneratedSchedule, GeneratedTask } from "./ai-schedule-generator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleEditKind =
  | "shift_forward"       // 前倒し
  | "shift_backward"      // 後ろ倒し
  | "set_duration"        // 期間を指定日数に
  | "set_start"           // 開始日を指定
  | "set_end"             // 終了日を指定
  | "remove"              // タスク削除
  | "rename"              // タスク名変更
  | "add_dependency"      // 依存関係を追加
  | "remove_dependency"   // 依存関係を削除
  | "set_assignee"        // 担当者を設定
  | "set_progress"        // 進捗率を設定
  | "phase_shift_forward" // フェーズ配下タスクを一括前倒し
  | "phase_shift_backward"; // フェーズ配下タスクを一括後ろ倒し

export interface ScheduleEdit {
  kind: ScheduleEditKind;
  taskIds: string[];
  days?: number;
  date?: Date;
  durationDays?: number;
  newName?: string;
  /** add_dependency / remove_dependency: 先行タスク ID */
  predecessorIds?: string[];
  /** set_assignee: 担当者名 */
  assigneeName?: string;
  /** set_progress: 進捗率 0-100 */
  progressPercent?: number;
  /** phase_shift_*: 対象フェーズ名（表示・確認用）*/
  phaseName?: string;
  /** phase_shift_*: cascade で更新された後続タスクの ID 群 */
  cascadedTaskIds?: string[];
  /** 0-1、曖昧マッチほど低く */
  confidence: number;
  /** パーサーへの原文（デバッグ・履歴表示用）*/
  sourceText: string;
}

/** confidence がこの値未満なら UI で「この解釈で合ってますか」チップを出す */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function needsConfirmation(edit: ScheduleEdit): boolean {
  return edit.confidence < LOW_CONFIDENCE_THRESHOLD;
}

// ─── Japanese number utilities ───────────────────────────────────────────────

const KANJI_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

/** 文字列中の数字（半角/全角/漢数字一〜十）を取り出す */
function extractNumber(s: string): number | null {
  const m1 = s.match(/[0-9０-９]+/);
  if (m1) {
    const normalized = m1[0].replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
    );
    return parseInt(normalized, 10);
  }
  for (const [k, v] of Object.entries(KANJI_MAP)) {
    if (s.includes(k)) return v;
  }
  return null;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(s: string, referenceYear: number): Date | null {
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }
  const slash = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return new Date(referenceYear, parseInt(slash[1]) - 1, parseInt(slash[2]));
  }
  const jp = s.match(/(\d{1,2})月(\d{1,2})日/);
  if (jp) {
    return new Date(referenceYear, parseInt(jp[1]) - 1, parseInt(jp[2]));
  }
  return null;
}

// ─── resolveTaskReference ─────────────────────────────────────────────────────

/**
 * ファジーなタスク名 → GeneratedTask[] 解決。
 * 完全一致 > 部分一致 > かな無視一致 の順。
 */
export function resolveTaskReference(
  fuzzyName: string,
  tasks: GeneratedTask[],
): GeneratedTask[] {
  if (!fuzzyName || tasks.length === 0) return [];

  const exact = tasks.filter((t) => t.name === fuzzyName);
  if (exact.length > 0) return exact;

  const partial = tasks.filter(
    (t) =>
      t.name.includes(fuzzyName) ||
      t.category.includes(fuzzyName),
  );
  if (partial.length > 0) return partial;

  function toKatakana(str: string): string {
    return str.replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
  }
  const fKana = toKatakana(fuzzyName);
  const kanaMatch = tasks.filter(
    (t) =>
      toKatakana(t.name).includes(fKana) ||
      toKatakana(t.category).includes(fKana),
  );
  return kanaMatch;
}

/** フェーズ名（majorCategory）でタスクを絞り込む */
export function resolveTasksInPhase(
  phaseName: string,
  tasks: GeneratedTask[],
): GeneratedTask[] {
  if (!phaseName) return [];
  const trimmed = phaseName.trim();
  return tasks.filter((t) => {
    if (!t.phase) return false;
    return t.phase === trimmed || t.phase.includes(trimmed) || trimmed.includes(t.phase);
  });
}

// ─── Segment splitting ────────────────────────────────────────────────────────

function splitCommands(nl: string): string[] {
  return nl
    .split(/[、,，。;；]|および|そして/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Command registry ────────────────────────────────────────────────────────

interface CommandContext {
  schedule: GeneratedSchedule;
  referenceYear: number;
}

interface ApplyContext {
  tasksById: Map<string, GeneratedTask>;
  removedIds: Set<string>;
  originalSchedule: GeneratedSchedule;
}

/**
 * 単一コマンドの定義。parse は自然言語 segment → ScheduleEdit | null、
 * apply は tasksById を破壊的に更新する（clone 済み前提）。
 *
 * 新コマンドを追加するときは COMMAND_REGISTRY へエントリを1つ足すだけでよい。
 */
export interface CommandDefinition {
  kind: ScheduleEditKind;
  parse: (segment: string, ctx: CommandContext) => ScheduleEdit | null;
  apply: (edit: ScheduleEdit, ctx: ApplyContext) => void;
}

// ─── Small helpers used by appliers ──────────────────────────────────────────

function cloneTask(t: GeneratedTask): GeneratedTask {
  return {
    ...t,
    startDate: new Date(t.startDate),
    endDate: new Date(t.endDate),
    dependencies: [...t.dependencies],
  };
}

function addCalendarDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function requireDate(edit: ScheduleEdit, kind: string): Date {
  if (!edit.date) throw new Error(`${kind} requires date`);
  return edit.date;
}

function shiftTaskInPlace(task: GeneratedTask, days: number): void {
  task.startDate = addCalendarDays(task.startDate, days);
  task.endDate = addCalendarDays(task.endDate, days);
}

function recomputeDuration(task: GeneratedTask): void {
  task.durationDays =
    Math.round((task.endDate.getTime() - task.startDate.getTime()) / 86400000) + 1;
}

function assertNonInverted(task: GeneratedTask): void {
  if (task.startDate > task.endDate) {
    throw new Error(
      `Contradiction: startDate ${task.startDate.toISOString()} > endDate ${task.endDate.toISOString()} for task ${task.id}`,
    );
  }
}

/**
 * FS 依存のみ簡易カスケード。changed の endDate 変化を後続に伝播。
 * chat editor はここでは軽量 cascade で十分（本格的な weekend / FF・SS
 * サポートは cascade-scheduler が担当している）。
 */
function cascadeFsShift(
  tasksById: Map<string, GeneratedTask>,
  seedIds: string[],
  shiftDays: number,
): string[] {
  if (shiftDays === 0) return [];
  const cascaded: string[] = [];
  const successorMap = new Map<string, string[]>();
  for (const t of tasksById.values()) {
    for (const dep of t.dependencies) {
      const list = successorMap.get(dep) ?? [];
      list.push(t.id);
      successorMap.set(dep, list);
    }
  }
  const visited = new Set<string>(seedIds);
  const queue: string[] = [...seedIds];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const succs = successorMap.get(cur) ?? [];
    for (const sid of succs) {
      if (visited.has(sid)) continue;
      visited.add(sid);
      const succ = tasksById.get(sid);
      if (!succ) continue;
      shiftTaskInPlace(succ, shiftDays);
      cascaded.push(sid);
      queue.push(sid);
    }
  }
  return cascaded;
}

// ─── Command: rename ─────────────────────────────────────────────────────────

const RENAME_COMMAND: CommandDefinition = {
  kind: "rename",
  parse(segment, ctx) {
    const m = segment.match(/^(.+?)を(.+?)(?:に変更|にリネーム|と変更)/);
    if (!m) return null;
    const matched = resolveTaskReference(m[1].trim(), ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "rename",
      taskIds: matched.map((t) => t.id),
      newName: m[2].trim(),
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById }) {
    if (!edit.newName) throw new Error("rename requires newName");
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (t) t.name = edit.newName;
    }
  },
};

// ─── Command: remove ─────────────────────────────────────────────────────────

const REMOVE_COMMAND: CommandDefinition = {
  kind: "remove",
  parse(segment, ctx) {
    const m = segment.match(/^(.+?)(?:を削除|を消して|を消す)/);
    if (!m) return null;
    const matched = resolveTaskReference(m[1].trim(), ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "remove",
      taskIds: matched.map((t) => t.id),
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById, removedIds }) {
    for (const id of edit.taskIds) {
      tasksById.delete(id);
      removedIds.add(id);
    }
  },
};

// ─── Command: add_dependency ─────────────────────────────────────────────────
//   「軽鉄はボード貼りの前」→ 軽鉄→ボード貼り (軽鉄が先行)
//   「解体が終わったら電気」→ 解体→電気 (解体が先行)
//   「電気は解体の後」   → 解体→電気
//   「A→B」             → A→B

const ADD_DEP_COMMAND: CommandDefinition = {
  kind: "add_dependency",
  parse(segment, ctx) {
    // 削除方向のフレーズを含むときは他コマンドへ譲る
    if (/依存.*(?:削除|解除|外|消)/.test(segment)) return null;

    // 「A→B」
    const arrow = segment.match(/^(.+?)(?:→|->|-＞)(.+?)$/);
    if (arrow) {
      return buildDependencyEdit(arrow[1], arrow[2], ctx, segment, "add");
    }
    // 「Aが終わったらB」「Aが終わったら B を開始」
    const finish = segment.match(/^(.+?)が(?:終わった|終了した|完了した)ら(.+?)$/);
    if (finish) {
      return buildDependencyEdit(finish[1], finish[2], ctx, segment, "add");
    }
    // 「AはBの前」「AはBの前に」
    const before = segment.match(/^(.+?)は(.+?)の前(?:に|$)/);
    if (before) {
      // A is before B → A precedes B
      return buildDependencyEdit(before[1], before[2], ctx, segment, "add");
    }
    // 「AはBの後」「AはBの後に」
    const after = segment.match(/^(.+?)は(.+?)の後(?:に|$)/);
    if (after) {
      // A is after B → B precedes A
      return buildDependencyEdit(after[2], after[1], ctx, segment, "add");
    }
    return null;
  },
  apply(edit, { tasksById }) {
    const predecessors = edit.predecessorIds ?? [];
    for (const succId of edit.taskIds) {
      const succ = tasksById.get(succId);
      if (!succ) continue;
      const set = new Set(succ.dependencies);
      let changed = false;
      for (const pred of predecessors) {
        if (pred === succId) continue; // 自己依存禁止
        if (!set.has(pred)) {
          set.add(pred);
          changed = true;
        }
      }
      if (changed) succ.dependencies = Array.from(set);
    }
  },
};

// ─── Command: remove_dependency ──────────────────────────────────────────────
//   「軽鉄とボード貼りの依存を削除」
//   「軽鉄とボード貼りの依存を外す」
//   「AをBの依存から外す」

const REMOVE_DEP_COMMAND: CommandDefinition = {
  kind: "remove_dependency",
  parse(segment, ctx) {
    // 「AとBの依存を...」
    const both = segment.match(/^(.+?)と(.+?)の依存(?:関係)?を(?:削除|解除|外|消)/);
    if (both) {
      return buildDependencyEdit(both[1], both[2], ctx, segment, "remove");
    }
    // 「AをBの依存から外す/削除」
    const single = segment.match(/^(.+?)を(.+?)の(?:依存|先行)から(?:外|削除|解除)/);
    if (single) {
      // A を B の先行から外す → predecessor A, successor B
      return buildDependencyEdit(single[1], single[2], ctx, segment, "remove");
    }
    return null;
  },
  apply(edit, { tasksById }) {
    const predecessors = edit.predecessorIds ?? [];
    for (const succId of edit.taskIds) {
      const succ = tasksById.get(succId);
      if (!succ) continue;
      if (succ.dependencies.length === 0) continue;
      const before = succ.dependencies.length;
      succ.dependencies = succ.dependencies.filter((d) => !predecessors.includes(d));
      if (succ.dependencies.length !== before) {
        // 更新済み
      }
    }
  },
};

function buildDependencyEdit(
  predName: string,
  succName: string,
  ctx: CommandContext,
  segment: string,
  variant: "add" | "remove",
): ScheduleEdit | null {
  const preds = resolveTaskReference(predName.trim(), ctx.schedule.tasks);
  const succs = resolveTaskReference(succName.trim(), ctx.schedule.tasks);
  if (preds.length === 0 || succs.length === 0) return null;
  // 完全一意ペアなら 1.0、どちらか多重マッチなら 0.6
  const confidence = preds.length === 1 && succs.length === 1 ? 1.0 : 0.6;
  return {
    kind: variant === "add" ? "add_dependency" : "remove_dependency",
    taskIds: succs.map((t) => t.id),
    predecessorIds: preds.map((t) => t.id),
    confidence,
    sourceText: segment,
  };
}

// ─── Command: set_assignee ───────────────────────────────────────────────────
//   「照明計画は鈴木さんに」「照明計画の担当は鈴木さん」
//   「照明計画を鈴木さんにアサイン」「照明計画を鈴木さんにお願い」

const SET_ASSIGNEE_COMMAND: CommandDefinition = {
  kind: "set_assignee",
  parse(segment, ctx) {
    // 「Aの担当は Bさん」（「担当」語で明示なので優先）
    const m2 = segment.match(/^(.+?)の担当(?:者)?は(.+?)(?:さん|様)?$/);
    if (m2) {
      const r = buildAssigneeEdit(m2[1], m2[2], ctx, segment);
      if (r) return r;
    }
    // 「Aを Bさんにアサイン/お願い」
    const m3 = segment.match(/^(.+?)を(.+?)(?:さん|様)?に(?:アサイン|お願い|担当)/);
    if (m3) {
      const r = buildAssigneeEdit(m3[1], m3[2], ctx, segment);
      if (r) return r;
    }
    // 「Aは Bさんに」/ 「Aは Bさん」（reluctant 一致で失敗した場合の最終フォールバック）
    const m1 = segment.match(/^(.+?)は(.+?)(?:さん|様)(?:に|$)/);
    if (m1) {
      const r = buildAssigneeEdit(m1[1], m1[2], ctx, segment);
      if (r) return r;
    }
    return null;
  },
  apply(edit, { tasksById }) {
    if (!edit.assigneeName) throw new Error("set_assignee requires assigneeName");
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (t) {
        t.assigneeName = edit.assigneeName;
        // 名前で指定した時点で ID の対応関係は不明になるので明示的にクリア
        t.assigneeId = null;
      }
    }
  },
};

function buildAssigneeEdit(
  taskName: string,
  personName: string,
  ctx: CommandContext,
  segment: string,
): ScheduleEdit | null {
  const matched = resolveTaskReference(taskName.trim(), ctx.schedule.tasks);
  if (matched.length === 0) return null;
  const cleanName = personName.trim().replace(/\s+/g, "");
  if (!cleanName) return null;
  return {
    kind: "set_assignee",
    taskIds: matched.map((t) => t.id),
    assigneeName: cleanName,
    confidence: matched.length === 1 ? 1.0 : 0.6,
    sourceText: segment,
  };
}

// ─── Command: set_progress ───────────────────────────────────────────────────
//   「墨出し半分終わった」→ 50%
//   「墨出しを50%に」 → 50%
//   「墨出し80%完了」 → 80%
//   「墨出し完了」   → 100%
//   「墨出しは終わった」→ 100%

const SET_PROGRESS_COMMAND: CommandDefinition = {
  kind: "set_progress",
  parse(segment, ctx) {
    // 「Aを完了」「A完了」「Aは完了した」「Aは終わった」「Aを終わらせた」
    if (/(?:を|は)?(?:完了|終わ(?:った|らせた|り))/.test(segment)) {
      const nameMatch =
        segment.match(/^(.+?)(?:を|は)?(?:完了|終わ(?:った|らせた|り))/);
      if (nameMatch) {
        const matched = resolveTaskReference(nameMatch[1].trim(), ctx.schedule.tasks);
        if (matched.length > 0) {
          return {
            kind: "set_progress",
            taskIds: matched.map((t) => t.id),
            progressPercent: 100,
            confidence: matched.length === 1 ? 1.0 : 0.6,
            sourceText: segment,
          };
        }
      }
    }
    // 「A半分終わった」「Aちょうど半分」
    const half = segment.match(/^(.+?)(?:を|は|が)?(?:ちょうど)?半分(?:終わった|進んだ|完了)?/);
    if (half) {
      const matched = resolveTaskReference(half[1].trim(), ctx.schedule.tasks);
      if (matched.length > 0) {
        return {
          kind: "set_progress",
          taskIds: matched.map((t) => t.id),
          progressPercent: 50,
          confidence: matched.length === 1 ? 0.9 : 0.6,
          sourceText: segment,
        };
      }
    }
    // 「Aを50%に」「A50%完了」「Aは50パーセント」
    const pct = segment.match(
      /^(.+?)(?:を|は|が)?([0-9０-９]+)(?:%|％|パーセント)/,
    );
    if (pct) {
      const num = extractNumber(pct[2]);
      if (num !== null && num >= 0 && num <= 100) {
        // 「Aを」で終わっている場合の余分な「を」除去
        const rawName = pct[1].trim().replace(/(?:を|は|が)$/, "").trim();
        const matched = resolveTaskReference(rawName, ctx.schedule.tasks);
        if (matched.length > 0) {
          return {
            kind: "set_progress",
            taskIds: matched.map((t) => t.id),
            progressPercent: num,
            confidence: matched.length === 1 ? 1.0 : 0.6,
            sourceText: segment,
          };
        }
      }
    }
    return null;
  },
  apply(edit, { tasksById }) {
    const p = edit.progressPercent;
    if (p === undefined || p < 0 || p > 100) {
      throw new Error(`set_progress requires progressPercent 0-100 (got ${p})`);
    }
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (t) t.progress = p;
    }
  },
};

// ─── Command: phase_shift_backward / phase_shift_forward ─────────────────────
//   「解体工事を全部3日後ろに」「解体を一括で2日遅らせ」
//   「内装工事をまとめて3日前倒し」

function tryParsePhaseShift(
  segment: string,
  ctx: CommandContext,
  direction: "forward" | "backward",
): ScheduleEdit | null {
  const bulkMarker = /(?:全部|全て|まとめて|一括(?:で)?)/;
  if (!bulkMarker.test(segment)) return null;

  const numRegex = "([0-9０-９一二三四五六七八九十]+)日";
  const dirRegex =
    direction === "backward"
      ? "(?:後ろ|後ろ倒し|後倒し|遅らせ|遅らす|延期|後に|後ろに)"
      : "(?:前倒し|前倒|早め|前に|繰り上げ)";

  const re = new RegExp(
    `^(.+?)を(?:${bulkMarker.source})?${numRegex}${dirRegex}`,
  );
  const m = segment.match(re);
  if (!m) return null;
  const phaseName = m[1].trim().replace(/(?:を|は)$/, "").trim();
  const days = extractNumber(m[2]);
  if (!days || days <= 0) return null;

  // 「工事」suffix を許容: 「解体工事」→ phase 「解体工事」or「解体」
  const inPhase = resolveTasksInPhase(phaseName, ctx.schedule.tasks);
  if (inPhase.length === 0) return null;

  // フェーズ名がタスク名と衝突しているかチェック（confidence 下げる材料）
  const conflictTaskName = ctx.schedule.tasks.some((t) => t.name === phaseName);
  const confidence = conflictTaskName ? 0.6 : 0.95;

  return {
    kind: direction === "backward" ? "phase_shift_backward" : "phase_shift_forward",
    taskIds: inPhase.map((t) => t.id),
    days,
    phaseName,
    confidence,
    sourceText: segment,
  };
}

const PHASE_SHIFT_BACKWARD_COMMAND: CommandDefinition = {
  kind: "phase_shift_backward",
  parse(segment, ctx) {
    return tryParsePhaseShift(segment, ctx, "backward");
  },
  apply(edit, ctx) {
    const shift = edit.days ?? 0;
    for (const id of edit.taskIds) {
      const t = ctx.tasksById.get(id);
      if (t) shiftTaskInPlace(t, shift);
    }
    const cascaded = cascadeFsShift(ctx.tasksById, edit.taskIds, shift);
    edit.cascadedTaskIds = cascaded;
  },
};

const PHASE_SHIFT_FORWARD_COMMAND: CommandDefinition = {
  kind: "phase_shift_forward",
  parse(segment, ctx) {
    return tryParsePhaseShift(segment, ctx, "forward");
  },
  apply(edit, ctx) {
    const shift = -(edit.days ?? 0);
    for (const id of edit.taskIds) {
      const t = ctx.tasksById.get(id);
      if (t) shiftTaskInPlace(t, shift);
    }
    const cascaded = cascadeFsShift(ctx.tasksById, edit.taskIds, shift);
    edit.cascadedTaskIds = cascaded;
  },
};

// ─── Command: set_start / set_end / set_duration ─────────────────────────────

const SET_START_COMMAND: CommandDefinition = {
  kind: "set_start",
  parse(segment, ctx) {
    const m = segment.match(
      /^(.+?)(?:の開始を|の開始日を|の始まりを)(.+?)(?:に|$)/,
    );
    if (!m) return null;
    const date = parseDate(m[2].trim(), ctx.referenceYear);
    if (!date) return null;
    const matched = resolveTaskReference(m[1].trim(), ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "set_start",
      taskIds: matched.map((t) => t.id),
      date,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById }) {
    const date = requireDate(edit, "set_start");
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (!t) continue;
      t.startDate = new Date(date);
      assertNonInverted(t);
      recomputeDuration(t);
    }
  },
};

const SET_END_COMMAND: CommandDefinition = {
  kind: "set_end",
  parse(segment, ctx) {
    const m = segment.match(
      /^(.+?)(?:の終了を|の終了日を|の終わりを)(.+?)(?:に|$)/,
    );
    if (!m) return null;
    const date = parseDate(m[2].trim(), ctx.referenceYear);
    if (!date) return null;
    const matched = resolveTaskReference(m[1].trim(), ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "set_end",
      taskIds: matched.map((t) => t.id),
      date,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById }) {
    const date = requireDate(edit, "set_end");
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (!t) continue;
      t.endDate = new Date(date);
      assertNonInverted(t);
      recomputeDuration(t);
    }
  },
};

const SET_DURATION_COMMAND: CommandDefinition = {
  kind: "set_duration",
  parse(segment, ctx) {
    const m = segment.match(
      /^(.+?)(?:の期間を|の工期を)?([0-9０-９一二三四五六七八九十]+)(?:日間|日)(?:に|$)/,
    );
    if (!m) return null;
    const taskName = m[1].trim().replace(/を$/, "").trim();
    const days = extractNumber(m[2]);
    if (!days || days <= 0) return null;
    const matched = resolveTaskReference(taskName, ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "set_duration",
      taskIds: matched.map((t) => t.id),
      durationDays: days,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById }) {
    const dur = edit.durationDays;
    if (!dur || dur <= 0) throw new Error(`Invalid durationDays: ${dur}`);
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (!t) continue;
      t.durationDays = dur;
      t.endDate = addCalendarDays(t.startDate, dur - 1);
    }
  },
};

// ─── Command: shift_backward / shift_forward ─────────────────────────────────

const SHIFT_BACKWARD_COMMAND: CommandDefinition = {
  kind: "shift_backward",
  parse(segment, ctx) {
    const m = segment.match(
      /^(.+?)を([0-9０-９一二三四五六七八九十]+)日(?:後ろ倒し|後倒し|遅らせ|延期)/,
    );
    if (!m) return null;
    const days = extractNumber(m[2]);
    if (!days || days <= 0) return null;
    const matched = resolveTaskReference(m[1].trim(), ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "shift_backward",
      taskIds: matched.map((t) => t.id),
      days,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById }) {
    const shift = edit.days ?? 0;
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (t) shiftTaskInPlace(t, shift);
    }
  },
};

const SHIFT_FORWARD_COMMAND: CommandDefinition = {
  kind: "shift_forward",
  parse(segment, ctx) {
    const m = segment.match(
      /^(.+?)を([0-9０-９一二三四五六七八九十]+)日(?:前倒し|前倒|早め|繰り上げ)/,
    );
    if (!m) return null;
    const days = extractNumber(m[2]);
    if (!days || days <= 0) return null;
    const matched = resolveTaskReference(m[1].trim(), ctx.schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "shift_forward",
      taskIds: matched.map((t) => t.id),
      days,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  },
  apply(edit, { tasksById }) {
    const shift = -(edit.days ?? 0);
    for (const id of edit.taskIds) {
      const t = tasksById.get(id);
      if (t) shiftTaskInPlace(t, shift);
    }
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────
//   *** 新コマンドを追加するときはここに1エントリ追加するだけ ***
//   優先順位に注意: より具体的なパターン（依存/フェーズ/進捗）を先に置く。
export const COMMAND_REGISTRY: CommandDefinition[] = [
  RENAME_COMMAND,
  REMOVE_COMMAND,
  REMOVE_DEP_COMMAND,       // 「AとBの依存を...」を add_dependency より先に
  ADD_DEP_COMMAND,
  PHASE_SHIFT_BACKWARD_COMMAND, // 「〜全部N日後ろに」 shift より先に
  PHASE_SHIFT_FORWARD_COMMAND,
  SET_ASSIGNEE_COMMAND,
  SET_PROGRESS_COMMAND,
  SET_START_COMMAND,
  SET_END_COMMAND,
  SET_DURATION_COMMAND,
  SHIFT_BACKWARD_COMMAND,
  SHIFT_FORWARD_COMMAND,
];

const APPLIERS: Map<ScheduleEditKind, CommandDefinition["apply"]> = new Map(
  COMMAND_REGISTRY.map((c) => [c.kind, c.apply]),
);

// ─── Internal NLParser abstraction (future LLM swap point) ───────────────────

export interface NLParserContext {
  schedule: GeneratedSchedule;
}

export interface NLParser {
  parse(nl: string, ctx: NLParserContext): ScheduleEdit[];
}

class RuleBasedNLParser implements NLParser {
  parse(nl: string, ctx: NLParserContext): ScheduleEdit[] {
    const segments = splitCommands(nl);
    const referenceYear = ctx.schedule.startDate.getFullYear();
    const cmdCtx: CommandContext = { schedule: ctx.schedule, referenceYear };
    const edits: ScheduleEdit[] = [];
    for (const seg of segments) {
      for (const cmd of COMMAND_REGISTRY) {
        const edit = cmd.parse(seg, cmdCtx);
        if (edit) {
          edits.push(edit);
          break; // first match wins per segment
        }
      }
    }
    return edits;
  }
}

const defaultParser: NLParser = new RuleBasedNLParser();

/**
 * 自然言語コマンドを解釈して ScheduleEdit[] を返す。
 * 対応パターンは COMMAND_REGISTRY を参照。
 */
export function parseScheduleCommand(
  nl: string,
  schedule: GeneratedSchedule,
): ScheduleEdit[] {
  return defaultParser.parse(nl, { schedule });
}

// ─── applyScheduleEdit ────────────────────────────────────────────────────────

/**
 * ScheduleEdit[] を適用して新しい GeneratedSchedule を返す（不変更新）。
 * phase_shift_* は cascade を含むが、単発 shift は既存挙動どおり非 cascade。
 * 未知 kind や矛盾（start > end）は throw。
 */
export function applyScheduleEdit(
  schedule: GeneratedSchedule,
  edits: ScheduleEdit[],
): GeneratedSchedule {
  const tasksById = new Map(
    schedule.tasks.map((t) => [t.id, cloneTask(t)]),
  );
  const removedIds = new Set<string>();
  const applyCtx: ApplyContext = { tasksById, removedIds, originalSchedule: schedule };

  for (const edit of edits) {
    const applier = APPLIERS.get(edit.kind);
    if (!applier) {
      throw new Error(`Unknown ScheduleEditKind: ${edit.kind}`);
    }
    applier(edit, applyCtx);
  }

  const newTasks = schedule.tasks
    .map((t) => tasksById.get(t.id))
    .filter((t): t is GeneratedTask => t !== undefined);

  const newStart =
    newTasks.length > 0
      ? newTasks.reduce(
          (min, t) => (t.startDate < min ? t.startDate : min),
          newTasks[0].startDate,
        )
      : schedule.startDate;
  const newEnd =
    newTasks.length > 0
      ? newTasks.reduce(
          (max, t) => (t.endDate > max ? t.endDate : max),
          newTasks[0].endDate,
        )
      : schedule.endDate;
  const totalDays =
    Math.round((newEnd.getTime() - newStart.getTime()) / 86400000) + 1;

  return {
    ...schedule,
    tasks: newTasks,
    startDate: newStart,
    endDate: newEnd,
    totalDays,
  };
}

// ─── summarizeRange ───────────────────────────────────────────────────────────

function padDate(n: number): string {
  return String(n).padStart(2, "0");
}

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${padDate(d.getDate())}`;
}

/**
 * 期間範囲のタスクを日本語要約する。
 * 例: 「4/15-4/20の間の作業: 101号室塗装(4/15-4/17)、... など5件」
 */
export function summarizeRange(
  schedule: GeneratedSchedule,
  from: Date,
  to: Date,
): string {
  const inRange = schedule.tasks.filter(
    (t) => t.startDate <= to && t.endDate >= from,
  );

  if (inRange.length === 0) {
    return `${formatShortDate(from)}-${formatShortDate(to)}の間の作業: なし`;
  }

  const MAX_SHOW = 3;
  const shown = inRange.slice(0, MAX_SHOW);
  const rest = inRange.length - shown.length;

  const items = shown
    .map(
      (t) =>
        `${t.name}(${formatShortDate(t.startDate)}-${formatShortDate(t.endDate)})`,
    )
    .join("、");

  const suffix = rest > 0 ? ` など${inRange.length}件` : `（${inRange.length}件）`;

  return `${formatShortDate(from)}-${formatShortDate(to)}の間の作業: ${items}${suffix}`;
}

// ─── describeEdit (UIラベル生成) ─────────────────────────────────────────────

/**
 * 確認チップに表示するための「〇〇を△△にします」文字列を生成する。
 * confidence が低いときの人間チェック用。
 */
export function describeEdit(
  edit: ScheduleEdit,
  schedule: GeneratedSchedule,
): string {
  const taskName = (id: string) =>
    schedule.tasks.find((t) => t.id === id)?.name ?? id;
  const targets = edit.taskIds.map(taskName).join("・");
  switch (edit.kind) {
    case "shift_backward":
      return `${targets}を${edit.days}日後ろ倒しにします`;
    case "shift_forward":
      return `${targets}を${edit.days}日前倒しにします`;
    case "set_duration":
      return `${targets}の期間を${edit.durationDays}日にします`;
    case "set_start":
      return `${targets}の開始を${edit.date ? formatShortDate(edit.date) : "?"}にします`;
    case "set_end":
      return `${targets}の終了を${edit.date ? formatShortDate(edit.date) : "?"}にします`;
    case "remove":
      return `${targets}を削除します`;
    case "rename":
      return `${targets}を「${edit.newName}」に変更します`;
    case "add_dependency": {
      const preds = (edit.predecessorIds ?? []).map(taskName).join("・");
      return `${preds}を${targets}の先行タスクに追加します`;
    }
    case "remove_dependency": {
      const preds = (edit.predecessorIds ?? []).map(taskName).join("・");
      return `${preds}と${targets}の依存関係を解除します`;
    }
    case "set_assignee":
      return `${targets}の担当を${edit.assigneeName}にします`;
    case "set_progress":
      return `${targets}の進捗を${edit.progressPercent}%にします`;
    case "phase_shift_backward":
      return `${edit.phaseName ?? "フェーズ"}を全部${edit.days}日後ろ倒し (${edit.taskIds.length}件対象)`;
    case "phase_shift_forward":
      return `${edit.phaseName ?? "フェーズ"}を全部${edit.days}日前倒し (${edit.taskIds.length}件対象)`;
    default: {
      const _exhaustive: never = edit.kind;
      return `未対応: ${_exhaustive}`;
    }
  }
}
