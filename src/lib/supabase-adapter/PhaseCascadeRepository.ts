/**
 * PhaseCascadeRepository — Phase 2.0
 * 玉突き遅延の適用専用リポジトリ。
 * PhaseRepository への直接編集を避けるため別ファイルに分離する（並列 bg 衝突回避）。
 *
 * - applyCascade: 起点フェーズの遅延を BFS で子孫全体に伝播し Supabase を bulk update。
 * - applyRainDelay: 雨天中止ヘルパー（1 日デフォルト）。
 */

import { supabase } from '../repository/supabase-client.js';
import { PhaseRepository } from './PhaseRepository.js';
import { computeCascade, applyRainDelay as rainDelay } from '../phase-cascade.js';
import type { CascadeResult } from '../phase-cascade.js';

export type { CascadeResult };

export class PhaseCascadeRepository {
  private phaseRepo: PhaseRepository;

  constructor(useSupabase?: boolean) {
    this.phaseRepo = new PhaseRepository(useSupabase);
  }

  /**
   * 起点フェーズ originPhaseId が delayDays 日遅延した場合に
   * 子孫フェーズの日程を一括更新する。
   *
   * Supabase モードでは phases テーブルを upsert 更新する。
   * InMemory モードでは PhaseRepository の saveAsync を使う。
   *
   * @returns CascadeResult — 影響を受けた全フェーズの新日程リスト
   */
  async applyCascade(originPhaseId: string, delayDays: number): Promise<CascadeResult> {
    const origin = await this.phaseRepo.getAsync(originPhaseId);
    if (!origin) throw new Error(`Phase "${originPhaseId}" not found`);

    // プロジェクト内の全フェーズを取得して DAG を構築
    const allPhases = await this.phaseRepo.listByProjectAsync(origin.projectId);
    const result = computeCascade(allPhases, originPhaseId, delayDays);

    if (result.affected.length === 0) return result;

    // 日程を一括更新
    for (const shift of result.affected) {
      const phase = allPhases.find((p) => p.id === shift.phaseId);
      if (!phase) continue;

      const updated = {
        ...phase,
        startDate: shift.newStartDate ?? phase.startDate,
        endDate: shift.newEndDate ?? phase.endDate,
      };

      if (this.isSupabaseMode()) {
        const { error } = await supabase
          .from('phases')
          .update({
            start_date: updated.startDate,
            end_date: updated.endDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shift.phaseId);
        if (error) throw new Error(error.message);
      } else {
        await this.phaseRepo.saveAsync(updated);
      }
    }

    return result;
  }

  /**
   * 雨天中止: blockedPhaseId を days 日（デフォルト 1 日）繰り下げ、子孫に伝播する。
   */
  async applyRainDelay(blockedPhaseId: string, days = 1): Promise<CascadeResult> {
    const origin = await this.phaseRepo.getAsync(blockedPhaseId);
    if (!origin) throw new Error(`Phase "${blockedPhaseId}" not found`);

    const allPhases = await this.phaseRepo.listByProjectAsync(origin.projectId);
    const result = rainDelay(allPhases, blockedPhaseId, days);

    if (result.affected.length === 0) return result;

    for (const shift of result.affected) {
      const phase = allPhases.find((p) => p.id === shift.phaseId);
      if (!phase) continue;

      const updated = {
        ...phase,
        startDate: shift.newStartDate ?? phase.startDate,
        endDate: shift.newEndDate ?? phase.endDate,
      };

      if (this.isSupabaseMode()) {
        const { error } = await supabase
          .from('phases')
          .update({
            start_date: updated.startDate,
            end_date: updated.endDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shift.phaseId);
        if (error) throw new Error(error.message);
      } else {
        await this.phaseRepo.saveAsync(updated);
      }
    }

    return result;
  }

  private isSupabaseMode(): boolean {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_USE_SUPABASE === 'true';
    }
    return false;
  }
}
