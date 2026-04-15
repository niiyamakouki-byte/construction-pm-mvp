/**
 * Schedule Chat Editor — PROCOLLA蒸留
 * 自然言語コマンドで工程表を編集するルールベースパーサー。
 * 将来のLLM差し替えに備えてNLParserインターフェースを内部抽象化として持つ。
 */

import type { GeneratedSchedule, GeneratedTask } from "./ai-schedule-generator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleEditKind =
  | "shift_forward"   // 前倒し
  | "shift_backward"  // 後ろ倒し
  | "set_duration"    // 期間を指定日数に
  | "set_start"       // 開始日を指定
  | "set_end"         // 終了日を指定
  | "remove"          // タスク削除
  | "rename";         // タスク名変更

export interface ScheduleEdit {
  kind: ScheduleEditKind;
  taskIds: string[];      // 対象タスクID（複数マッチ可）
  days?: number;          // shift用
  date?: Date;            // set_start/set_end用
  durationDays?: number;  // set_duration用
  newName?: string;       // rename用
  confidence: number;     // 0-1、曖昧マッチほど低く
  sourceText: string;     // パーサーへの原文（デバッグ用）
}

// ─── Internal NLParser abstraction (future LLM swap point) ───────────────────

interface NLParserContext {
  schedule: GeneratedSchedule;
}

interface NLParser {
  parse(nl: string, ctx: NLParserContext): ScheduleEdit[];
}

// ─── Japanese number utilities ───────────────────────────────────────────────

const KANJI_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseJapaneseNumber(s: string): number | null {
  // 半角数字
  const half = s.match(/^[0-9]+$/);
  if (half) return parseInt(s, 10);

  // 全角数字 → 半角に変換
  const normalized = s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
  if (/^[0-9]+$/.test(normalized)) return parseInt(normalized, 10);

  // 漢数字（一〜十）
  if (KANJI_MAP[s] !== undefined) return KANJI_MAP[s];

  return null;
}

/** 文字列中の数字（半角/全角/漢数字一〜十）を取り出す */
function extractNumber(s: string): number | null {
  // 半角 or 全角数字（複数桁）
  const m1 = s.match(/[0-9０-９]+/);
  if (m1) {
    const normalized = m1[0].replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
    );
    return parseInt(normalized, 10);
  }
  // 漢数字1文字
  for (const [k, v] of Object.entries(KANJI_MAP)) {
    if (s.includes(k)) return v;
  }
  return null;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * 3形式の日付をパース:
 *   YYYY-MM-DD / MM/DD（当年補完） / M月D日（当年補完）
 */
function parseDate(s: string, referenceYear: number): Date | null {
  // YYYY-MM-DD
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }

  // MM/DD
  const slash = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return new Date(referenceYear, parseInt(slash[1]) - 1, parseInt(slash[2]));
  }

  // M月D日
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

  // 完全一致
  const exact = tasks.filter((t) => t.name === fuzzyName);
  if (exact.length > 0) return exact;

  // 部分一致（name / trade / category に fuzzyName を含む）
  const partial = tasks.filter(
    (t) =>
      t.name.includes(fuzzyName) ||
      t.category.includes(fuzzyName),
  );
  if (partial.length > 0) return partial;

  // かな無視: ひらがな→カタカナ正規化して再マッチ
  function toKatakana(str: string): string {
    return str.replace(/[\u3041-\u3096]/g, (c) =>
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

// ─── Rule-based NL Parser ────────────────────────────────────────────────────

/** セパレータで複数コマンドに分割 */
function splitCommands(nl: string): string[] {
  return nl
    .split(/[、,，。;；]|および|そして/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** タスク名候補を抽出: 「を」「の」の前の部分 */
function extractTaskName(segment: string): string {
  // 「〇〇を△△に変更」「〇〇を〇〇に」→ 最初の「を」「の」前
  const m = segment.match(/^(.+?)(?:を|の)/);
  return m ? m[1].trim() : segment.trim();
}

function buildRuleBasedEdit(
  segment: string,
  schedule: GeneratedSchedule,
): ScheduleEdit | null {
  const referenceYear = schedule.startDate.getFullYear();

  // ── rename: 「〇〇を××に変更」「〇〇を××にリネーム」───────────────────────
  const renameMatch = segment.match(
    /^(.+?)を(.+?)(?:に変更|にリネーム|と変更)/,
  );
  if (renameMatch) {
    const taskName = renameMatch[1].trim();
    const newName = renameMatch[2].trim();
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "rename",
      taskIds: matched.map((t) => t.id),
      newName,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  // ── remove: 「〇〇を削除」「〇〇を消して」──────────────────────────────────
  const removeMatch = segment.match(/^(.+?)(?:を削除|を消して|を消す)/);
  if (removeMatch) {
    const taskName = removeMatch[1].trim();
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "remove",
      taskIds: matched.map((t) => t.id),
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  // ── set_start: 「〇〇の開始を〇〇に」─────────────────────────────────────
  const setStartMatch = segment.match(
    /^(.+?)(?:の開始を|の開始日を|の始まりを)(.+?)(?:に|$)/,
  );
  if (setStartMatch) {
    const taskName = setStartMatch[1].trim();
    const dateStr = setStartMatch[2].trim();
    const date = parseDate(dateStr, referenceYear);
    if (!date) return null;
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "set_start",
      taskIds: matched.map((t) => t.id),
      date,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  // ── set_end: 「〇〇の終了を〇〇に」──────────────────────────────────────
  const setEndMatch = segment.match(
    /^(.+?)(?:の終了を|の終了日を|の終わりを)(.+?)(?:に|$)/,
  );
  if (setEndMatch) {
    const taskName = setEndMatch[1].trim();
    const dateStr = setEndMatch[2].trim();
    const date = parseDate(dateStr, referenceYear);
    if (!date) return null;
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "set_end",
      taskIds: matched.map((t) => t.id),
      date,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  // ── set_duration: 「〇〇の期間を5日に」「〇〇を3日間に」────────────────────
  const durationMatch = segment.match(
    /^(.+?)(?:の期間を|の工期を)?([0-9０-９一二三四五六七八九十]+)(?:日間|日)(?:に|$)/,
  );
  if (durationMatch) {
    const rawTaskPart = durationMatch[1].trim();
    // 「〇〇を」形式のとき「を」を除去
    const taskName = rawTaskPart.replace(/を$/, "").trim();
    const days = extractNumber(durationMatch[2]);
    if (!days || days <= 0) return null;
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "set_duration",
      taskIds: matched.map((t) => t.id),
      durationDays: days,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  // ── shift_backward: 後ろ倒し / 遅らせる / 延期 ────────────────────────────
  const backwardMatch = segment.match(
    /^(.+?)を([0-9０-９一二三四五六七八九十]+)日(?:後ろ倒し|後倒し|遅らせ|延期)/,
  );
  if (backwardMatch) {
    const taskName = backwardMatch[1].trim();
    const days = extractNumber(backwardMatch[2]);
    if (!days || days <= 0) return null;
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "shift_backward",
      taskIds: matched.map((t) => t.id),
      days,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  // ── shift_forward: 前倒し / 早める / 繰り上げ ────────────────────────────
  const forwardMatch = segment.match(
    /^(.+?)を([0-9０-９一二三四五六七八九十]+)日(?:前倒し|前倒|早め|繰り上げ)/,
  );
  if (forwardMatch) {
    const taskName = forwardMatch[1].trim();
    const days = extractNumber(forwardMatch[2]);
    if (!days || days <= 0) return null;
    const matched = resolveTaskReference(taskName, schedule.tasks);
    if (matched.length === 0) return null;
    return {
      kind: "shift_forward",
      taskIds: matched.map((t) => t.id),
      days,
      confidence: matched.length === 1 ? 1.0 : 0.7,
      sourceText: segment,
    };
  }

  return null;
}

class RuleBasedNLParser implements NLParser {
  parse(nl: string, ctx: NLParserContext): ScheduleEdit[] {
    const segments = splitCommands(nl);
    const edits: ScheduleEdit[] = [];
    for (const seg of segments) {
      const edit = buildRuleBasedEdit(seg, ctx.schedule);
      if (edit) edits.push(edit);
    }
    return edits;
  }
}

// ─── parseScheduleCommand ─────────────────────────────────────────────────────

const defaultParser: NLParser = new RuleBasedNLParser();

/**
 * 自然言語コマンドを解釈して ScheduleEdit[] を返す。
 * 対応パターンは RuleBasedNLParser を参照。
 */
export function parseScheduleCommand(
  nl: string,
  schedule: GeneratedSchedule,
): ScheduleEdit[] {
  return defaultParser.parse(nl, { schedule });
}

// ─── applyScheduleEdit ────────────────────────────────────────────────────────

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

/**
 * ScheduleEdit[] を適用して新しい GeneratedSchedule を返す（不変更新）。
 * 依存タスクへの伝播はしない（純粋にタスク単体更新のみ）。
 * 未知 kind や矛盾（start > end）は throw。
 */
export function applyScheduleEdit(
  schedule: GeneratedSchedule,
  edits: ScheduleEdit[],
): GeneratedSchedule {
  // deep clone tasks
  const tasksById = new Map(
    schedule.tasks.map((t) => [t.id, cloneTask(t)]),
  );

  for (const edit of edits) {
    for (const taskId of edit.taskIds) {
      const task = tasksById.get(taskId);
      if (!task) continue;

      switch (edit.kind) {
        case "shift_forward": {
          const shiftDays = -(edit.days ?? 0);
          task.startDate = addCalendarDays(task.startDate, shiftDays);
          task.endDate = addCalendarDays(task.endDate, shiftDays);
          break;
        }
        case "shift_backward": {
          const shiftDays = edit.days ?? 0;
          task.startDate = addCalendarDays(task.startDate, shiftDays);
          task.endDate = addCalendarDays(task.endDate, shiftDays);
          break;
        }
        case "set_duration": {
          const dur = edit.durationDays;
          if (!dur || dur <= 0) throw new Error(`Invalid durationDays: ${dur}`);
          task.durationDays = dur;
          task.endDate = addCalendarDays(task.startDate, dur - 1);
          break;
        }
        case "set_start": {
          if (!edit.date) throw new Error("set_start requires date");
          task.startDate = new Date(edit.date);
          if (task.startDate > task.endDate) {
            throw new Error(
              `Contradiction: startDate ${task.startDate.toISOString()} > endDate ${task.endDate.toISOString()} for task ${task.id}`,
            );
          }
          task.durationDays =
            Math.round(
              (task.endDate.getTime() - task.startDate.getTime()) /
                86400000,
            ) + 1;
          break;
        }
        case "set_end": {
          if (!edit.date) throw new Error("set_end requires date");
          task.endDate = new Date(edit.date);
          if (task.startDate > task.endDate) {
            throw new Error(
              `Contradiction: startDate ${task.startDate.toISOString()} > endDate ${task.endDate.toISOString()} for task ${task.id}`,
            );
          }
          task.durationDays =
            Math.round(
              (task.endDate.getTime() - task.startDate.getTime()) /
                86400000,
            ) + 1;
          break;
        }
        case "remove":
          tasksById.delete(taskId);
          break;
        case "rename": {
          if (!edit.newName) throw new Error("rename requires newName");
          task.name = edit.newName;
          break;
        }
        default: {
          const _exhaustive: never = edit.kind;
          throw new Error(`Unknown ScheduleEditKind: ${_exhaustive}`);
        }
      }
    }
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
