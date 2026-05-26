/**
 * phase-state-machine.ts — Phase 2.0
 * 工程ステータス遷移テーブルとガード関数。
 * PhaseRepository から独立させることで並列 bg との衝突を回避する。
 */

import type { PhaseStatus } from './supabase-adapter/PhaseRepository.js';

export type { PhaseStatus };

/** 各ステータスから遷移可能なステータスの一覧 */
export const PHASE_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  planned:     ['in_progress', 'canceled'],
  in_progress: ['blocked', 'done', 'canceled'],
  blocked:     ['in_progress', 'canceled'],
  done:        [],
  canceled:    [],
};

/**
 * 指定の遷移が許可されているかどうかを返す。
 */
export function canTransition(from: PhaseStatus, to: PhaseStatus): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

/**
 * 遷移が許可されていない場合に例外を投げる。
 * @throws Error 'invalid phase status transition: {from} -> {to}'
 */
export function assertTransition(from: PhaseStatus, to: PhaseStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid phase status transition: ${from} -> ${to}`);
  }
}

/** 指定ステータスが終端（それ以上遷移できない）かどうか */
export function isTerminal(status: PhaseStatus): boolean {
  return PHASE_TRANSITIONS[status].length === 0;
}
