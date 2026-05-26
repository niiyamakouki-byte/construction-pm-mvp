/**
 * src/lib/supabase.ts — Sprint 61 Phase 1 公開エントリポイント
 *
 * FEATURE_SUPABASE (= VITE_USE_SUPABASE) が 'true' のとき実 Supabase クライアントを返す。
 * それ以外は no-op stub を返すので既存テストは壊れない。
 *
 * 実装は既存の src/lib/repository/supabase-client.ts に委譲している。
 * このファイルは「import パス統一」と「FEATURE_SUPABASE フラグ検査」のためだけに存在する。
 */

export { supabase } from './repository/supabase-client.js';

/**
 * FEATURE_SUPABASE フラグ。
 * VITE_USE_SUPABASE=true のとき true を返す。
 * テスト内では vi.stubEnv / import.meta.env を通じて上書き可能。
 */
export function isFeatureSupabaseEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_USE_SUPABASE === 'true';
  }
  // Node / vitest 環境フォールバック
  return process.env['VITE_USE_SUPABASE'] === 'true';
}
