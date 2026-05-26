/**
 * ConversionAnalyzer — ステージ別変換率分析.
 *
 * Sprint 16-B: 営業パイプライン可視化
 */

import type { Deal, DealStage, StageMetrics } from "./types.js";
import { DEFAULT_STAGE_PROBABILITY, weightedAmount } from "./probability-model.js";
import { currentDwellDays } from "./stall-detector.js";

const ORDERED_STAGES: DealStage[] = [
  "inquiry",
  "first_reply",
  "site_survey",
  "proposal",
  "contract",
  "kickoff",
  "won",
];

/**
 * 過去90日のステージ遷移ログからステージ→次ステージの変換率を算出する。
 * 「どのステージで一番落ちているか」を示す StageMetrics[] を返す。
 * 最終エントリは「最も変換率が低いステージ」を示す。
 */
export function analyzeConversionFunnel(deals: Deal[]): StageMetrics[] {
  const since90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // ステージ別に商談をグループ化 (won/lost 含む全件)
  const byStage = new Map<DealStage, Deal[]>();
  for (const stage of ORDERED_STAGES) {
    byStage.set(stage, []);
  }
  byStage.set("lost", []);

  for (const deal of deals) {
    const list = byStage.get(deal.currentStage);
    if (list) {
      list.push(deal);
    }
  }

  // 過去90日の遷移ログから stage→next の変換数を集計
  const transitionCounts = new Map<string, number>();
  for (const deal of deals) {
    for (const t of deal.stageHistory) {
      if (new Date(t.transitionedAt) < since90Days) continue;
      const key = `${t.fromStage}→${t.toStage}`;
      transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
    }
  }

  const metrics: StageMetrics[] = [];

  for (let i = 0; i < ORDERED_STAGES.length; i++) {
    const stage = ORDERED_STAGES[i];
    const dealsInStage = byStage.get(stage) ?? [];

    const totalAmountJpy = dealsInStage.reduce((sum, d) => sum + d.expectedAmountJpy, 0);
    const weightedAmountJpy = dealsInStage.reduce((sum, d) => sum + weightedAmount(d), 0);

    // 平均滞留日数: 現ステージの deal は currentDwellDays、過去遷移ログから計算
    let avgDaysInStage = 0;
    const allDwells: number[] = [];
    for (const deal of deals) {
      for (const t of deal.stageHistory) {
        if (t.fromStage === stage) {
          allDwells.push(t.daysInPreviousStage);
        }
      }
    }
    // 現在このステージにいる商談の滞留日数も加算
    for (const deal of dealsInStage) {
      allDwells.push(currentDwellDays(deal));
    }
    if (allDwells.length > 0) {
      avgDaysInStage = Math.round(allDwells.reduce((s, d) => s + d, 0) / allDwells.length);
    }

    // 変換率: 次ステージへの遷移数 / このステージを出た総数
    let conversionRateToNext = 0;
    if (i < ORDERED_STAGES.length - 1) {
      const nextStage = ORDERED_STAGES[i + 1];
      const movedToNext = transitionCounts.get(`${stage}→${nextStage}`) ?? 0;

      // このステージから出た全遷移数
      let totalExited = 0;
      for (const [key, count] of transitionCounts) {
        if (key.startsWith(`${stage}→`)) {
          totalExited += count;
        }
      }

      if (totalExited > 0) {
        conversionRateToNext = Math.round((movedToNext / totalExited) * 100);
      } else if (stage !== "won" && dealsInStage.length > 0) {
        // 遷移ログがない場合はデフォルト確度差から推定
        const currentPct = DEFAULT_STAGE_PROBABILITY[stage];
        const nextPct = DEFAULT_STAGE_PROBABILITY[nextStage];
        conversionRateToNext = currentPct > 0 ? Math.round((nextPct / currentPct) * 100) : 0;
      }
    } else {
      conversionRateToNext = 100; // won stage
    }

    metrics.push({
      stage,
      dealCount: dealsInStage.length,
      totalAmountJpy,
      weightedAmountJpy,
      avgDaysInStage,
      conversionRateToNext,
    });
  }

  return metrics;
}
