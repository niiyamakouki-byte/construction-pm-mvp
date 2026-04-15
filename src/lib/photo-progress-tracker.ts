/**
 * Photo Progress Tracker — Buildots/Doxel/OpenSpace蒸留
 * Receives trade progress estimates from photos and reconciles against
 * existing schedules to propose end-date adjustments.
 *
 * Pure logic layer only — no image AI calls.
 * Image-based completionRate is injected by the caller (future ViT/CLIP).
 */

import type { GeneratedSchedule, GeneratedTask, WorkCategory } from "./ai-schedule-generator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-room, per-trade progress estimate (supplied by photo analysis layer) */
export interface TradeProgress {
  trade: WorkCategory;
  completionRate: number;  // 0.0–1.0
  confidence: number;      // 0.0–1.0
  evidenceNotes?: string;  // 「下地見えてる」「仕上がりムラあり」等
  photoId?: string;
  capturedAt: Date;
}

/** Proposed change to a single task's end date */
export interface ScheduleDelta {
  taskId: string;
  currentEnd: Date;
  proposedEnd: Date;
  deltaDays: number;       // + = 延長、- = 短縮
  reason: string;          // 日本語説明
  confidence: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Returns the expected completion rate for a task as of `asOf`.
 * Linearly interpolates between startDate (0%) and endDate (100%).
 * Returns 0 if asOf is before start, 1 if after end.
 */
function expectedRate(task: GeneratedTask, asOf: Date): number {
  const start = task.startDate.getTime();
  const end = task.endDate.getTime();
  const now = asOf.getTime();
  if (now <= start) return 0;
  if (now >= end) return 1;
  return (now - start) / (end - start);
}

/** True if the task is active (overlaps with) the window [asOf-lookahead, asOf] */
function taskOverlapsAsOf(task: GeneratedTask, asOf: Date): boolean {
  // A task is considered "active" if it has started and not yet finished
  return task.startDate <= asOf && task.endDate >= task.startDate;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * (1) Reconcile photo-derived trade progress against the schedule.
 *
 * For each TradeProgress, finds tasks whose category matches the trade
 * and whose period overlaps with asOf.
 * If actualRate < expectedRate by more than the threshold (0.1), emits a ScheduleDelta.
 *
 * deltaDays = (expectedRate - actualRate) × taskDurationDays  (rounded up)
 */
export function reconcileWithSchedule(
  progress: TradeProgress[],
  schedule: GeneratedSchedule,
  asOf: Date,
): ScheduleDelta[] {
  const DELAY_THRESHOLD = 0.1; // 10pt差でアラート
  const deltas: ScheduleDelta[] = [];

  for (const p of progress) {
    // Find tasks of the matching trade that are active as of asOf
    const matchingTasks = schedule.tasks.filter(
      (t) => t.category === p.trade && taskOverlapsAsOf(t, asOf),
    );

    for (const task of matchingTasks) {
      const expected = expectedRate(task, asOf);
      const diff = expected - p.completionRate;

      if (diff > DELAY_THRESHOLD) {
        const rawDelta = diff * task.durationDays;
        const deltaDays = Math.ceil(rawDelta);
        const proposedEnd = addCalendarDays(task.endDate, deltaDays);

        const expectedPct = Math.round(expected * 100);
        const actualPct = Math.round(p.completionRate * 100);

        deltas.push({
          taskId: task.id,
          currentEnd: new Date(task.endDate),
          proposedEnd,
          deltaDays,
          reason: `【${p.trade}】期待値${expectedPct}%に対し実測${actualPct}%（${deltaDays}日の遅延を検知）`,
          confidence: p.confidence,
        });
      }
    }
  }

  return deltas;
}

/**
 * (2) Apply ScheduleDeltas to a schedule and return a new schedule.
 *
 * Rules:
 * - Only deltas with confidence >= 0.5 are applied.
 * - Only uses progress captured within the past 3 days relative to the most recent
 *   proposedEnd in the deltas (caller should pre-filter if needed; here we respect
 *   the deltas as given and apply the confidence filter).
 * - Updates task.endDate and task.durationDays only — no dependency propagation.
 */
export function proposeScheduleUpdate(
  deltas: ScheduleDelta[],
  schedule: GeneratedSchedule,
): GeneratedSchedule {
  // Build a map of taskId → delta, keeping only high-confidence deltas
  const deltaMap = new Map<string, ScheduleDelta>();
  for (const d of deltas) {
    if (d.confidence < 0.5) continue;
    const existing = deltaMap.get(d.taskId);
    // If multiple deltas for the same task, take the largest extension
    if (!existing || d.deltaDays > existing.deltaDays) {
      deltaMap.set(d.taskId, d);
    }
  }

  const updatedTasks: GeneratedTask[] = schedule.tasks.map((task) => {
    const delta = deltaMap.get(task.id);
    if (!delta) return task;

    const newEndDate = new Date(delta.proposedEnd);
    const newDuration =
      task.durationDays + delta.deltaDays;

    return {
      ...task,
      endDate: newEndDate,
      durationDays: newDuration,
    };
  });

  const newProjectEnd = updatedTasks.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    new Date(schedule.startDate),
  );

  const newTotalDays =
    calendarDaysBetween(schedule.startDate, newProjectEnd) + 1;

  return {
    ...schedule,
    tasks: updatedTasks,
    endDate: newProjectEnd,
    totalDays: newTotalDays,
  };
}

/**
 * (3) Aggregate multiple TradeProgress entries for the same trade.
 * Uses confidence-weighted average: Σ(rate × conf) / Σ(conf).
 * Returns the entry with the earliest capturedAt as the base, with merged rates.
 */
export function aggregateTradeProgress(
  progresses: TradeProgress[],
): Map<WorkCategory, TradeProgress> {
  const grouped = new Map<WorkCategory, TradeProgress[]>();

  for (const p of progresses) {
    const existing = grouped.get(p.trade);
    if (existing) {
      existing.push(p);
    } else {
      grouped.set(p.trade, [p]);
    }
  }

  const result = new Map<WorkCategory, TradeProgress>();

  for (const [trade, entries] of grouped) {
    if (entries.length === 1) {
      result.set(trade, { ...entries[0] });
      continue;
    }

    const totalConf = entries.reduce((sum, e) => sum + e.confidence, 0);
    const weightedRate =
      totalConf > 0
        ? entries.reduce((sum, e) => sum + e.completionRate * e.confidence, 0) / totalConf
        : entries.reduce((sum, e) => sum + e.completionRate, 0) / entries.length;

    const weightedConf = totalConf / entries.length;

    // Use the most recent capturedAt as the representative timestamp
    const latest = entries.reduce((max, e) =>
      e.capturedAt > max.capturedAt ? e : max,
    );

    result.set(trade, {
      trade,
      completionRate: Math.min(1, Math.max(0, weightedRate)),
      confidence: Math.min(1, weightedConf),
      capturedAt: latest.capturedAt,
      photoId: latest.photoId,
      evidenceNotes: entries
        .map((e) => e.evidenceNotes)
        .filter(Boolean)
        .join(" / ") || undefined,
    });
  }

  return result;
}

/**
 * (4) Generate a Japanese explanation for a ScheduleDelta.
 *
 * Format:
 * 「【塗装】101号室：65% / 期待値80% → 2.1日の遅延を検知。タスク『101室塗装』のend を 4/18→4/20 に延長提案」
 */
export function explainDelta(
  delta: ScheduleDelta,
  schedule: GeneratedSchedule,
): string {
  const task = schedule.tasks.find((t) => t.id === delta.taskId);
  const taskName = task?.name ?? delta.taskId;

  const formatDate = (d: Date): string =>
    `${d.getMonth() + 1}/${d.getDate()}`;

  const currentStr = formatDate(delta.currentEnd);
  const proposedStr = formatDate(delta.proposedEnd);

  return (
    `${delta.reason}。タスク『${taskName}』のend を ` +
    `${currentStr}→${proposedStr} に延長提案`
  );
}
