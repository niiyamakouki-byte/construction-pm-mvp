/**
 * 工程遅延予測AI — 労務リスク計算
 *
 * 純関数。外部依存なし。
 */

import type { LaborAvailability } from "./types.js";

/**
 * 労務稼働データからリスクスコア (0-100) を算出する。
 *
 * 各日の available/required ratio の平均を計算し:
 *   ratio < 0.70  → risk +30
 *   ratio < 0.85  → risk +15
 *   ratio >= 1.0  → risk 0
 *
 * required_workers = 0 の日は ratio = 1.0 として扱う。
 */
export function calculateLaborRisk(availability: LaborAvailability[]): number {
  if (availability.length === 0) return 0;

  let totalRatio = 0;
  for (const day of availability) {
    if (day.required_workers === 0) {
      totalRatio += 1.0;
    } else {
      totalRatio += day.available_workers / day.required_workers;
    }
  }

  const avgRatio = totalRatio / availability.length;

  if (avgRatio < 0.70) return Math.min(100, 30);
  if (avgRatio < 0.85) return Math.min(100, 15);
  return 0;
}
