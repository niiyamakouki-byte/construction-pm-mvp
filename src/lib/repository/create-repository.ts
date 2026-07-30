import type { Repository } from './types.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { SupabaseRepository } from './supabase-repository.js';

// mt9d5: FreeeRepository(584095d)と同じくE2Eバイパス中はVITE_USE_SUPABASE=trueでも
// 実Supabaseへ問い合わせずインメモリへフォールバックする(初回セッション直行でスキーマ未整備エラーに詰まないため)。
function isE2EBypass(): boolean {
  return typeof window !== 'undefined' && (window as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ === true;
}

/**
 * ファクトリ関数。
 * VITE_USE_SUPABASE=true のときは SupabaseRepository、
 * それ以外は InMemoryRepository を返す。
 * 既存の動作は一切変わらない（後方互換性100%）。
 */
export function createRepository<T extends { id: string }>(
  tableName: string,
): Repository<T> {
  if (import.meta.env.VITE_USE_SUPABASE === 'true' && !isE2EBypass()) {
    return new SupabaseRepository<T>(tableName);
  }
  return new InMemoryRepository<T>();
}
