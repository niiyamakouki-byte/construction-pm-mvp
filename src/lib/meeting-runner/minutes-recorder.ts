/**
 * minutes-recorder — 会議中の発言を3カテゴリに分類・保存する
 *
 * Sprint 17-A: 工程会議自動進行AI
 * Rule-based (LLM不使用)
 * - decisions: 「〜に決定」「〜を採用」「〜に合意」などのキーワードで検出
 * - actionItems: 「〜すること」「〜を実施」「〜担当」「〜まで」などのパターン
 * - unresolvedItems: 「継続審議」「次回持越」「要確認」などのキーワード
 */

import type { AgendaItem, ActionItem, MeetingMinutes, MeetingId } from "./types.js";

// ── Classification rules ───────────────────────────────────────────────────

const DECISION_KEYWORDS = [
  "に決定", "を採用", "に合意", "で確定", "と決まった", "決定事項",
  "承認", "了承", "採択", "確定した",
];

const ACTION_KEYWORDS = [
  "すること", "を実施", "を確認", "担当", "対応する", "手配する",
  "まで提出", "まで回答", "まで完了", "まで対応",
];

const UNRESOLVED_KEYWORDS = [
  "継続審議", "次回持越", "次回確認", "要確認", "検討中", "保留",
  "持ち越し", "再検討", "未決", "保留事項",
];

// ── Classifier ────────────────────────────────────────────────────────────

type LineCategory = "decision" | "action" | "unresolved" | "other";

function classifyLine(line: string): LineCategory {
  const trimmed = line.trim();
  if (!trimmed) return "other";

  // Check decision patterns first (highest priority)
  for (const kw of DECISION_KEYWORDS) {
    if (trimmed.includes(kw)) return "decision";
  }
  // Check unresolved
  for (const kw of UNRESOLVED_KEYWORDS) {
    if (trimmed.includes(kw)) return "unresolved";
  }
  // Check action
  for (const kw of ACTION_KEYWORDS) {
    if (trimmed.includes(kw)) return "action";
  }
  return "other";
}

// ── Action item parser ─────────────────────────────────────────────────────

let _counter = 0;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

const DUE_DATE_PATTERNS = [
  /(\d{1,2})\/(\d{1,2})まで/,
  /(\d{4})-(\d{2})-(\d{2})まで/,
  /来週(月|火|水|木|金)曜日?まで/,
];

function extractDueDate(line: string, meetingDate: Date): string {
  // YYYY-MM-DD形式
  const isoMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(line);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // M/D形式
  const mdMatch = /(\d{1,2})\/(\d{1,2})/.exec(line);
  if (mdMatch) {
    const m = mdMatch[1].padStart(2, "0");
    const d = mdMatch[2].padStart(2, "0");
    return `${meetingDate.getFullYear()}-${m}-${d}`;
  }

  // 来週 → +7 days
  if (DUE_DATE_PATTERNS[2].test(line)) {
    const next = new Date(meetingDate);
    next.setDate(next.getDate() + 7);
    return next.toISOString().split("T")[0];
  }

  // Default: 7 days from meeting date
  const defaultDue = new Date(meetingDate);
  defaultDue.setDate(defaultDue.getDate() + 7);
  return defaultDue.toISOString().split("T")[0];
}

function extractAssignee(line: string): string {
  // 「〜が〜」「〜は〜」「担当: 〜」「〜担当」パターン
  const colonMatch = /担当[:：]\s*([^\s、。]+)/.exec(line);
  if (colonMatch) return colonMatch[1];

  const ga = /^([^\s]{2,8})[がは]/.exec(line.trim());
  if (ga) return ga[1];

  return "未定";
}

function parseActionLine(line: string, meetingDate: Date): ActionItem {
  return {
    id: newId("action"),
    description: line.trim(),
    assignee: extractAssignee(line),
    dueDate: extractDueDate(line, meetingDate),
    status: "open",
  };
}

// ── Unresolved item parser ─────────────────────────────────────────────────

function parseUnresolvedLine(
  line: string,
  relatedAgendaItem?: AgendaItem,
): AgendaItem {
  return {
    id: newId("unresolved"),
    title: line.trim(),
    source: "previous_unresolved",
    priority: relatedAgendaItem?.priority ?? 3,
    estimatedMinutes: relatedAgendaItem?.estimatedMinutes ?? 10,
    owner: relatedAgendaItem?.owner ?? "未定",
    status: "deferred",
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 会議中のテキスト入力を3カテゴリに分類して MeetingMinutes を生成する。
 * 各行がどのカテゴリに属するかを rule-based で判定。
 */
export function recordMinutes(params: {
  meetingId: MeetingId;
  lines: string[];
  meetingDate: Date;
  agendaItems?: AgendaItem[];
}): MeetingMinutes {
  const { meetingId, lines, meetingDate, agendaItems = [] } = params;

  const decisions: string[] = [];
  const actionItems: ActionItem[] = [];
  const unresolvedItems: AgendaItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const category = classifyLine(trimmed);

    switch (category) {
      case "decision":
        decisions.push(trimmed);
        break;
      case "action": {
        actionItems.push(parseActionLine(trimmed, meetingDate));
        break;
      }
      case "unresolved": {
        // Try to link with current agenda item
        const related = agendaItems.find(
          (a) =>
            a.status === "discussing" ||
            trimmed.includes(a.title.substring(0, 6)),
        );
        unresolvedItems.push(parseUnresolvedLine(trimmed, related));
        break;
      }
      default:
        // "other" — ignore or treat as context
        break;
    }
  }

  return {
    meetingId,
    decisions,
    actionItems,
    unresolvedItems,
  };
}

/**
 * 既存の MeetingMinutes に行を追記する (会議途中のリアルタイム更新用)。
 */
export function appendToMinutes(
  existing: MeetingMinutes,
  newLines: string[],
  meetingDate: Date,
  agendaItems?: AgendaItem[],
): MeetingMinutes {
  const added = recordMinutes({
    meetingId: existing.meetingId,
    lines: newLines,
    meetingDate,
    agendaItems,
  });

  return {
    meetingId: existing.meetingId,
    decisions: [...existing.decisions, ...added.decisions],
    actionItems: [...existing.actionItems, ...added.actionItems],
    unresolvedItems: [...existing.unresolvedItems, ...added.unresolvedItems],
  };
}

/** Classify a single line (exported for testing). */
export { classifyLine };
