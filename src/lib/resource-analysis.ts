/**
 * resource-analysis — COMPASS基準 P4: リソース分析ビューの集計ロジック
 *
 * 担当者（協力会社）別の稼働時間・タスク数・キャパシティ・稼働率を、
 * 純関数として集計する。UI と切り離して単体テストで検証する。
 *
 * 前提:
 *   - キャパシティは「1人 1稼働日 = 8h」の固定仮定（仕様書指示。設定化しない）
 *   - 稼働日 = 平日（土日は除外）
 *   - タスクの稼働時間 = 期間内の重なり × 稼働日数 × 8h（担当者は 1タスクに 1人）
 */

/** 1人1日あたりの稼働キャパ（h）。仕様書 P4 の固定仮定。 */
export const HOURS_PER_DAY = 8;

/** 集計に必要な最小限のタスクフィールドだけを受ける（テストしやすくするため） */
export type ResourceAnalysisTask = {
  id: string;
  startDate: string;
  endDate: string;
  contractorName?: string;
};

export type ResourceRow = {
  /** 担当者表示名（未設定は "未割当"） */
  name: string;
  /** 期間内延べ稼働時間 (h) */
  hours: number;
  /** 期間内タスク数 */
  taskCount: number;
  /** 期間内キャパシティ = 稼働日数 × 8h (1人あたり) */
  capacityHours: number;
  /** 稼働率 (%)。100%超は過負荷 */
  utilizationPct: number;
};

export type ResourceAnalysisSummary = {
  rows: ResourceRow[];
  /** 全員合計の稼働時間 (h) */
  totalHours: number;
  /** 全員合計のタスク数 */
  totalTasks: number;
  /**
   * 期間内の平均稼働人数（人）= 延べ稼働時間 ÷ (稼働日数 × 8h)。
   * 「単なるユニーク人数」ではなく、期間内に平均何人並列に動いたかを表す。
   */
  avgPersons: number;
  /** 期間の稼働日数（平日カウント） */
  workdays: number;
};

/**
 * ISO YYYY-MM-DD 文字列区間の稼働日数（土日除く）を計算する。
 * start > end のときは 0 を返す。
 */
export function workdaysBetween(start: string, end: string): number {
  if (start > end) return 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * タスクリストと期間から担当者別集計 + 全体サマリーを返す。
 * `periodStart` / `periodEnd` は "YYYY-MM-DD"（両端含む）。
 */
export function computeResourceAnalysis(
  tasks: readonly ResourceAnalysisTask[],
  periodStart: string,
  periodEnd: string,
): ResourceAnalysisSummary {
  const workdays = workdaysBetween(periodStart, periodEnd);
  const capacityPerPerson = workdays * HOURS_PER_DAY;

  const map = new Map<string, { tasks: Set<string>; hours: number }>();

  for (const task of tasks) {
    const overlapStart = task.startDate > periodStart ? task.startDate : periodStart;
    const overlapEnd = task.endDate < periodEnd ? task.endDate : periodEnd;
    if (overlapStart > overlapEnd) continue;

    const name = task.contractorName?.trim() || "未割当";
    const days = workdaysBetween(overlapStart, overlapEnd);
    if (days === 0) continue; // 期間の重なりが土日のみのケース

    const hours = days * HOURS_PER_DAY;
    const existing = map.get(name) ?? { tasks: new Set<string>(), hours: 0 };
    existing.tasks.add(task.id);
    existing.hours += hours;
    map.set(name, existing);
  }

  const rows: ResourceRow[] = Array.from(map.entries())
    .map(([name, { tasks: taskIds, hours }]) => ({
      name,
      hours,
      taskCount: taskIds.size,
      capacityHours: capacityPerPerson,
      utilizationPct:
        capacityPerPerson > 0 ? Math.round((hours / capacityPerPerson) * 100) : 0,
    }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const totalTasks = rows.reduce((sum, r) => sum + r.taskCount, 0);

  // 平均稼働人数 = 延べ稼働時間 ÷ (稼働日数 × 8h)。小数第1位まで。
  const avgPersons =
    capacityPerPerson > 0 ? Math.round((totalHours / capacityPerPerson) * 10) / 10 : 0;

  return { rows, totalHours, totalTasks, avgPersons, workdays };
}
