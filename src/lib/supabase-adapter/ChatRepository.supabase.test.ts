/**
 * ChatRepository — Phase B (Supabase mode) ルーティングテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ChatRepository, type ChatMessageRecord } from './ChatRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';

function makeBuilder(terminal: { data: unknown; error: { message: string } | null }) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.update = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.single = vi.fn(term);
  b.maybeSingle = vi.fn(term);
  (b as { then?: unknown }).then = (
    res: (v: unknown) => unknown,
    rej?: (e: unknown) => unknown,
  ) => Promise.resolve(terminal).then(res, rej);
  return b;
}

const mockFrom = (supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } })
  .supabase.from;

function makeMessage(): ChatMessageRecord {
  return {
    id: 'chat-1',
    projectId: 'p-1',
    userId: 'user-1',
    userName: '山田',
    content: 'テストメッセージ',
    timestamp: '2025-04-17T00:00:00.000Z',
    type: 'text',
    readBy: [],
  };
}

describe('ChatRepository Phase B — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true で getAsync は chat_messages テーブルを参照し camelCase マッピングする', async () => {
    const row = {
      id: 'chat-1',
      project_id: 'p-1',
      sender: 'user-1',
      content: 'テストメッセージ',
      created_at: '2025-04-17T00:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new ChatRepository(true);
    const result = await repo.getAsync('chat-1');
    expect(mockFrom).toHaveBeenCalledWith('chat_messages');
    expect(result?.projectId).toBe('p-1');
    expect(result?.content).toBe('テストメッセージ');
  });

  it('useSupabase=true で listAsync は Supabase から取得する', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: [], error: null }));
    const repo = new ChatRepository(true);
    const result = await repo.listAsync();
    expect(mockFrom).toHaveBeenCalledWith('chat_messages');
    expect(result).toEqual([]);
  });

  it('useSupabase=true で listByProjectAsync が project_id でフィルタする', async () => {
    const rows = [
      { id: 'chat-1', project_id: 'p-1', sender: 'u1', content: 'A', created_at: '' },
      { id: 'chat-2', project_id: 'p-2', sender: 'u2', content: 'B', created_at: '' },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new ChatRepository(true);
    const result = await repo.listByProjectAsync('p-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('chat-1');
  });

  it('useSupabase=false で async はインメモリ', async () => {
    const repo = new ChatRepository(false);
    await repo.saveAsync(makeMessage());
    const found = await repo.getAsync('chat-1');
    expect(found?.content).toBe('テストメッセージ');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useSupabase=false で deleteAsync は同期 delete と同じ挙動', async () => {
    const repo = new ChatRepository(false);
    repo.save(makeMessage());
    expect(await repo.deleteAsync('chat-1')).toBe(true);
    expect(await repo.deleteAsync('ghost')).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
