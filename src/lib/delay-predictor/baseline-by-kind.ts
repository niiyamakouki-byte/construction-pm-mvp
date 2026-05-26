/**
 * 工程遅延予測AI — 工種ベースラインリスク計算
 *
 * 純関数。外部依存なし。
 * 過去の同種タスク実績から超過率を算出し、リスクスコアを返す。
 */

import type { HistoricalTaskRecord } from "./types.js";

/**
 * 同種タスクの過去実績から種別ベースラインリスクスコア (0-100) を算出する。
 *
 * 超過率 = 平均(actualDays / plannedDays)
 *   超過率 >= 1.5  → risk 80
 *   超過率 >= 1.2  → risk 60
 *   超過率 >= 1.0  → risk 40
 *   超過率 < 1.0   → risk 0  (予定内)
 *
 * 同種の過去データがない場合: risk 0
 */
export function calculateKindBaselineRisk(
  taskKind: string,
  history: HistoricalTaskRecord[],
): number {
  const same = history.filter((r) => r.taskKind === taskKind);
  if (same.length === 0) return 0;

  const totalRatio = same.reduce((acc, r) => {
    const ratio = r.plannedDays > 0 ? r.actualDays / r.plannedDays : 1.0;
    return acc + ratio;
  }, 0);
  const avgRatio = totalRatio / same.length;

  if (avgRatio >= 1.5) return 80;
  if (avgRatio >= 1.2) return 60;
  if (avgRatio >= 1.0) return 40;
  return 0;
}
