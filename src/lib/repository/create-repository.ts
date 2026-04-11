import type { Repository } from './types.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { SupabaseRepository } from './supabase-repository.js';

/**
 * ファクトリ関数。
 * VITE_USE_SUPABASE=true のときは SupabaseRepository、
 * それ以外は InMemoryRepository を返す。
 * 既存の動作は一切変わらない（後方互換性100%）。
 */
export function createRepository<T extends { id: string }>(
  tableName: string,
): Repository<T> {
  if (import.meta.env.VITE_USE_SUPABASE === 'true') {
    return new SupabaseRepository<T>(tableName);
  }
  return new InMemoryRepository<T>();
}
