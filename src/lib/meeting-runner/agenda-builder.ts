/**
 * agenda-builder — 議題ドラフトを自動生成する
 *
 * Sprint 17-A: 工程会議自動進行AI
 * - 前回 minutes の unresolvedItems + actionItems を引き継ぎ
 * - プロジェクトの在工程/遅延工程から新規議題を自動抽出
 */

import type { AgendaItem, MeetingMinutes, MeetingKind } from "./types.js";
import { makeMeetingId } from "./types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

let _counter = 0;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

// ── Project-phase source types ─────────────────────────────────────────────

export type ProjectPhaseInfo = {
  phaseName: string;
  /** 0–100 */
  progressPct: number;
  /** true if behind schedule */
  isDelayed: boolean;
  /** Responsible person */
  owner: string;
};

// ── Previous-minutes extraction ────────────────────────────────────────────

/**
 * 前回議事録の unresolvedItems → 今回の AgendaItem (source: previous_unresolved) に変換。
 */
export function extractFromPreviousMinutes(
  minutes: MeetingMinutes,
): AgendaItem[] {
  const items: AgendaItem[] = [];

  // Unresolved agenda items
  for (const item of minutes.unresolvedItems) {
    items.push({
      ...item,
      id: newId("agenda-prev"),
      source: "previous_unresolved",
      status: "pending",
    });
  }

  // Overdue / open action items → agenda for status check
  for (const action of minutes.actionItems) {
    if (action.status === "open" || action.status === "in_progress" || action.status === "overdue") {
      items.push({
        id: newId("agenda-action"),
        title: `アクション確認: ${action.description}（担当: ${action.assignee}）`,
        source: "previous_unresolved",
        priority: action.status === "overdue" ? 1 : 3,
        estimatedMinutes: 5,
        owner: action.assignee,
        status: "pending",
      });
    }
  }

  return items;
}

// ── Project-phase extraction ───────────────────────────────────────────────

/**
 * 在工程/遅延工程から新規議題を抽出する。
 * 遅延工程は priority 1、通常工程は priority 3。
 */
export function extractFromProjectPhases(
  phases: ProjectPhaseInfo[],
): AgendaItem[] {
  return phases.map((phase) => ({
    id: newId("agenda-phase"),
    title: phase.isDelayed
      ? `【遅延】${phase.phaseName} 対応協議 (進捗 ${phase.progressPct}%)`
      : `${phase.phaseName} 進捗確認 (${phase.progressPct}%)`,
    source: "new_topic" as const,
    priority: (phase.isDelayed ? 1 : 3) as 1 | 2 | 3 | 4 | 5,
    estimatedMinutes: phase.isDelayed ? 15 : 5,
    owner: phase.owner,
    status: "pending" as const,
  }));
}

// ── Kind-specific default agenda ───────────────────────────────────────────

const KIND_DEFAULT_AGENDA: Record<MeetingKind, Array<{ title: string; estimatedMinutes: number; priority: 1 | 2 | 3 | 4 | 5 }>> = {
  weekly_progress: [
    { title: "先週の進捗報告", estimatedMinutes: 10, priority: 2 },
    { title: "今週の作業予定", estimatedMinutes: 10, priority: 2 },
    { title: "安全・品質確認", estimatedMinutes: 5, priority: 2 },
  ],
  design_review: [
    { title: "設計変更点の確認", estimatedMinutes: 20, priority: 1 },
    { title: "図面整合性チェック", estimatedMinutes: 15, priority: 2 },
    { title: "施主確認事項", estimatedMinutes: 10, priority: 2 },
  ],
  subcontractor_briefing: [
    { title: "施工範囲・仕様の説明", estimatedMinutes: 20, priority: 1 },
    { title: "工程・入場日程の確認", estimatedMinutes: 10, priority: 2 },
    { title: "安全教育・ルール説明", estimatedMinutes: 10, priority: 1 },
  ],
  site_walkthrough: [
    { title: "施工品質の確認", estimatedMinutes: 20, priority: 1 },
    { title: "残作業・パンチリスト確認", estimatedMinutes: 15, priority: 2 },
    { title: "近隣配慮・清掃状況", estimatedMinutes: 5, priority: 3 },
  ],
};

/**
 * 会議種別に応じたデフォルト議題を生成する。
 */
export function buildDefaultAgenda(kind: MeetingKind, owner: string): AgendaItem[] {
  return KIND_DEFAULT_AGENDA[kind].map((def) => ({
    id: newId("agenda-default"),
    title: def.title,
    source: "new_topic" as const,
    priority: def.priority,
    estimatedMinutes: def.estimatedMinutes,
    owner,
    status: "pending" as const,
  }));
}

// ── Combined builder ───────────────────────────────────────────────────────

/**
 * 議題ドラフトを組み立てる。
 * 優先度順に並び替えて返す。
 */
export function buildAgenda(options: {
  kind: MeetingKind;
  defaultOwner: string;
  previousMinutes?: MeetingMinutes;
  projectPhases?: ProjectPhaseInfo[];
  manualItems?: AgendaItem[];
}): AgendaItem[] {
  const { kind, defaultOwner, previousMinutes, projectPhases, manualItems } = options;

  const items: AgendaItem[] = [];

  // 1) previous unresolved (highest priority group)
  if (previousMinutes) {
    items.push(...extractFromPreviousMinutes(previousMinutes));
  }

  // 2) delayed/active phases
  if (projectPhases && projectPhases.length > 0) {
    items.push(...extractFromProjectPhases(projectPhases));
  } else {
    // Fallback: kind-specific defaults
    items.push(...buildDefaultAgenda(kind, defaultOwner));
  }

  // 3) manual additions
  if (manualItems) {
    items.push(...manualItems);
  }

  // Sort: priority ASC (1=highest), then source (previous_unresolved first)
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.source === "previous_unresolved" && b.source !== "previous_unresolved") return -1;
    if (b.source === "previous_unresolved" && a.source !== "previous_unresolved") return 1;
    return 0;
  });

  return items;
}

/** Total estimated duration in minutes. */
export function totalEstimatedMinutes(items: AgendaItem[]): number {
  return items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
}
