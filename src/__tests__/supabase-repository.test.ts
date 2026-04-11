import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock はホイストされるので、factory 内で vi.fn() を直接定義する
vi.mock('../lib/repository/supabase-client.js', () => {
  const mockFrom = vi.fn();
  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
  };
});

// チェーン可能なビルダーファクトリ（モック設定ヘルパー）
function makeBuilder(terminalResult: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  const terminal = () => Promise.resolve(terminalResult);

  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.single = vi.fn(terminal);
  builder.maybeSingle = vi.fn(terminal);
  // getAll では select() が直接 await されるので thenable にする
  (builder as { then?: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(terminalResult).then(resolve, reject);

  return builder;
}

import { SupabaseRepository } from '../lib/repository/supabase-repository.js';
import * as supabaseClientModule from '../lib/repository/supabase-client.js';

type TestItem = { id: string; name: string; value: number };

// モジュール内の __mockFrom を取得
const { __mockFrom: mockFrom } = supabaseClientModule as unknown as { __mockFrom: ReturnType<typeof vi.fn> };

describe('SupabaseRepository', () => {
  let repo: SupabaseRepository<TestItem>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SupabaseRepository<TestItem>('test_items');
  });

  it('getAll: データを配列で返す', async () => {
    const rows = [
      { id: '1', name: 'A', value: 10 },
      { id: '2', name: 'B', value: 20 },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const result = await repo.getAll();
    expect(result).toEqual(rows);
  });

  it('getAll: エラー時は例外を投げる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'DB error' } }));

    await expect(repo.getAll()).rejects.toThrow('DB error');
  });

  it('getById: 存在するアイテムを返す', async () => {
    const row = { id: '1', name: 'A', value: 10 };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const result = await repo.getById('1');
    expect(result).toEqual(row);
  });

  it('getById: 存在しないIDはnullを返す', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));

    const result = await repo.getById('no-such-id');
    expect(result).toBeNull();
  });

  it('getById: エラー時は例外を投げる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'Not found error' } }));

    await expect(repo.getById('1')).rejects.toThrow('Not found error');
  });

  it('create: 新規アイテムを返す', async () => {
    const created = { id: 'new-id', name: 'C', value: 30 };
    mockFrom.mockReturnValue(makeBuilder({ data: created, error: null }));

    const result = await repo.create({ name: 'C', value: 30 });
    expect(result).toEqual(created);
  });

  it('create: エラー時は例外を投げる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'Insert failed' } }));

    await expect(repo.create({ name: 'X', value: 0 })).rejects.toThrow('Insert failed');
  });

  it('update: 更新済みアイテムを返す', async () => {
    const updated = { id: '1', name: 'Updated', value: 99 };
    mockFrom.mockReturnValue(makeBuilder({ data: updated, error: null }));

    const result = await repo.update('1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('update: IDが存在しない場合はエラーを投げる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(repo.update('no-such-id', { name: 'X' })).rejects.toThrow('not found');
  });

  it('update: エラー時は例外を投げる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'Update failed' } }));

    await expect(repo.update('1', { name: 'X' })).rejects.toThrow('Update failed');
  });

  it('delete: 存在するアイテムを削除できる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: { id: '1' }, error: null }));

    await expect(repo.delete('1')).resolves.toBeUndefined();
  });

  it('delete: IDが存在しない場合はエラーを投げる', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: null }));

    await expect(repo.delete('no-such-id')).rejects.toThrow('not found');
  });
});

// createRepository ファクトリのテスト
describe('createRepository ファクトリ', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('VITE_USE_SUPABASE=true のとき SupabaseRepository を返す', async () => {
    vi.stubEnv('VITE_USE_SUPABASE', 'true');
    const { createRepository } = await import('../lib/repository/create-repository.js');
    const repo = createRepository('some_table');
    expect(repo.constructor.name).toBe('SupabaseRepository');
    vi.unstubAllEnvs();
  });

  it('VITE_USE_SUPABASE が未設定のとき InMemoryRepository を返す', async () => {
    vi.unstubAllEnvs();
    const { createRepository } = await import('../lib/repository/create-repository.js');
    const repo = createRepository('some_table');
    expect(repo.constructor.name).toBe('InMemoryRepository');
  });

  it('VITE_USE_SUPABASE=false のとき InMemoryRepository を返す', async () => {
    vi.stubEnv('VITE_USE_SUPABASE', 'false');
    const { createRepository } = await import('../lib/repository/create-repository.js');
    const repo = createRepository('some_table');
    expect(repo.constructor.name).toBe('InMemoryRepository');
    vi.unstubAllEnvs();
  });
});
