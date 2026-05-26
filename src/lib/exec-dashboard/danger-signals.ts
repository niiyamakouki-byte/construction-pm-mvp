/**
 * Danger signal detection for the Executive Dashboard.
 * Pure rule-based logic — no external API calls.
 */

import type { Project, Task, Invoice, ChatMessage, Photo } from "../../domain/types.js";

// ── Types ──────────────────────────────────────────────────────────────────

export const DangerSignalKind = {
  delayedSchedule: "delayedSchedule",
  budgetOverrun: "budgetOverrun",
  overdueInvoice: "overdueInvoice",
  lowMargin: "lowMargin",
  stalledChat: "stalledChat",
  photoMissing7Days: "photoMissing7Days",
} as const;

export type DangerSignalKind = (typeof DangerSignalKind)[keyof typeof DangerSignalKind];

export type DangerSignal = {
  projectId: string;
  projectName: string;
  kind: DangerSignalKind;
  detectedAt: string;
  /** Human-readable detail for the signal */
  detail: string;
};

export type ProjectDangerInput = {
  project: Project;
  /** Tasks for this project */
  tasks: Task[];
  /** Invoices for this project */
  invoices: Invoice[];
  /** Chat messages for this project */
  chatMessages: ChatMessage[];
  /** Photos for this project */
  photos: Photo[];
  /** Project contract amount (used for budgetOverrun check). Defaults to project.budget */
  contractAmount?: number;
  /** Estimated At Completion cost (sum of all cost items). Defaults to 0 */
  eac?: number;
  /** Gross profit amount */
  grossProfit?: number;
  /** Reference date for all "today" comparisons (YYYY-MM-DD, defaults to today) */
  today?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysDiff(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  return Math.round((b - a) / 86_400_000);
}

// ── Detection rules ────────────────────────────────────────────────────────

/**
 * delayedSchedule: any task is overdue (dueDate < today) and status !== 'done' by > 3 days
 */
function detectDelayedSchedule(input: ProjectDangerInput, today: string): DangerSignal | null {
  const { project, tasks } = input;
  let maxDelay = 0;
  for (const task of tasks) {
    if (task.status === "done") continue;
    if (!task.dueDate) continue;
    const delay = daysDiff(task.dueDate, today);
    if (delay > maxDelay) maxDelay = delay;
  }
  if (maxDelay <= 3) return null;
  return {
    projectId: project.id,
    projectName: project.name,
    kind: DangerSignalKind.delayedSchedule,
    detectedAt: today,
    detail: `工程遅延 ${maxDelay}日`,
  };
}

/**
 * budgetOverrun: EAC exceeds contractAmount by more than 5%
 */
function detectBudgetOverrun(input: ProjectDangerInput, today: string): DangerSignal | null {
  const { project } = input;
  const contractAmount = input.contractAmount ?? project.budget ?? 0;
  const eac = input.eac ?? 0;
  if (contractAmount <= 0 || eac <= 0) return null;
  const overrunRate = (eac - contractAmount) / contractAmount;
  if (overrunRate <= 0.05) return null;
  const pct = Math.round(overrunRate * 100);
  return {
    projectId: project.id,
    projectName: project.name,
    kind: DangerSignalKind.budgetOverrun,
    detectedAt: today,
    detail: `EAC が契約額を ${pct}% 超過`,
  };
}

/**
 * overdueInvoice: any invoice has dueDate > 30 days past and status !== 'paid'
 */
function detectOverdueInvoice(input: ProjectDangerInput, today: string): DangerSignal | null {
  const { project, invoices } = input;
  let maxOverdue = 0;
  for (const inv of invoices) {
    if (inv.status === "paid" || inv.status === "cancelled") continue;
    const overdue = daysDiff(inv.dueDate, today);
    if (overdue > maxOverdue) maxOverdue = overdue;
  }
  if (maxOverdue <= 30) return null;
  return {
    projectId: project.id,
    projectName: project.name,
    kind: DangerSignalKind.overdueInvoice,
    detectedAt: today,
    detail: `請求書延滞 ${maxOverdue}日`,
  };
}

/**
 * lowMargin: gross margin < 10%
 * margin = grossProfit / contractAmount
 */
function detectLowMargin(input: ProjectDangerInput, today: string): DangerSignal | null {
  const { project } = input;
  const contractAmount = input.contractAmount ?? project.budget ?? 0;
  if (contractAmount <= 0) return null;
  const grossProfit = input.grossProfit ?? 0;
  const marginRate = grossProfit / contractAmount;
  if (marginRate >= 0.1) return null;
  const pct = Math.round(marginRate * 100 * 10) / 10;
  return {
    projectId: project.id,
    projectName: project.name,
    kind: DangerSignalKind.lowMargin,
    detectedAt: today,
    detail: `粗利率 ${pct}%（基準10%未満）`,
  };
}

/**
 * stalledChat: most recent chat message is > 7 days ago
 */
function detectStalledChat(input: ProjectDangerInput, today: string): DangerSignal | null {
  const { project, chatMessages } = input;
  if (chatMessages.length === 0) {
    // No chat ever — treat as stalled if project is active
    if (project.status !== "active") return null;
    return {
      projectId: project.id,
      projectName: project.name,
      kind: DangerSignalKind.stalledChat,
      detectedAt: today,
      detail: "チャット履歴なし",
    };
  }
  const latest = chatMessages.reduce((a, b) =>
    a.timestamp > b.timestamp ? a : b,
  );
  const daysSinceLast = daysDiff(latest.timestamp.slice(0, 10), today);
  if (daysSinceLast <= 7) return null;
  return {
    projectId: project.id,
    projectName: project.name,
    kind: DangerSignalKind.stalledChat,
    detectedAt: today,
    detail: `最終チャット ${daysSinceLast}日前`,
  };
}

/**
 * photoMissing7Days: no photo taken in the last 7 days (for active projects)
 */
function detectPhotoMissing7Days(input: ProjectDangerInput, today: string): DangerSignal | null {
  const { project, photos } = input;
  if (project.status !== "active") return null;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const recent = photos.filter((p) => {
    const date = (p.takenAt ?? p.createdAt).slice(0, 10);
    return date >= cutoffStr;
  });
  if (recent.length > 0) return null;
  return {
    projectId: project.id,
    projectName: project.name,
    kind: DangerSignalKind.photoMissing7Days,
    detectedAt: today,
    detail: "直近7日間 写真ゼロ",
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect all danger signals for a single project.
 * Returns an array (may be empty if no signals detected).
 */
export function detectDangerSignals(input: ProjectDangerInput): DangerSignal[] {
  const today = input.today ?? todayString();
  const signals: DangerSignal[] = [];

  const checks = [
    detectDelayedSchedule,
    detectBudgetOverrun,
    detectOverdueInvoice,
    detectLowMargin,
    detectStalledChat,
    detectPhotoMissing7Days,
  ];

  for (const check of checks) {
    const signal = check(input, today);
    if (signal !== null) signals.push(signal);
  }

  return signals;
}
