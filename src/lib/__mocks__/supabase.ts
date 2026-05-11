/**
 * src/lib/__mocks__/supabase.ts — テスト用 Supabase mock
 *
 * vi.mock('../supabase.js') で自動使用される。
 * supabase.from() チェーン全メソッドを vi.fn() で提供し、
 * デフォルトは { data: [], error: null } を解決する。
 *
 * 使い方:
 *   import { getMockFrom } from '../__mocks__/supabase.js';
 *   getMockFrom().mockReturnValue(makeBuilder({ data: [...], error: null }));
 */

import { vi } from 'vitest';

// ── クエリビルダー生成ヘルパー ──────────────────────────────────────────────

export type MockQueryResult = { data: unknown; error: { message: string } | null };

export function makeMockBuilder(terminal: MockQueryResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: Record<string, any> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.neq = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.update = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.upsert = vi.fn(chain);
  b.single = vi.fn(term);
  b.maybeSingle = vi.fn(term);
  b.limit = vi.fn(chain);
  b.order = vi.fn(chain);
  b.filter = vi.fn(chain);
  b.in = vi.fn(chain);
  // Promise 直接 await をサポート
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(terminal).then(res, rej);
  return b;
}

// ── mock supabase client ───────────────────────────────────────────────────

const _mockFrom = vi.fn(() => makeMockBuilder({ data: [], error: null }));

export const supabase = {
  from: _mockFrom,
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
    })),
  },
};

/** テスト内で mockFrom を参照するためのヘルパー */
export function getMockFrom() {
  return _mockFrom;
}

/** 各テスト前にリセット */
export function resetMockSupabase() {
  _mockFrom.mockClear();
  _mockFrom.mockImplementation(() => makeMockBuilder({ data: [], error: null }));
}

// FEATURE_SUPABASE フラグ mock
export function isFeatureSupabaseEnabled(): boolean {
  return false;
}
