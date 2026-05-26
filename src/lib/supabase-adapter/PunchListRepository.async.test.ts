import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PunchListRepository } from './PunchListRepository.js';
import type {
  PunchListItemRecord,
  PunchListHistoryRecord,
} from './PunchListRepository.js';

function makeItem(o: Partial<PunchListItemRecord> = {}): PunchListItemRecord {
  return {
    id: 'p-1',
    projectId: 'proj-1',
    title: 'クロス浮き',
    description: 'リビング南壁',
    location: 'リビング',
    trade: '内装',
    priority: 'medium',
    status: 'open',
    createdBy: '我妻',
    createdAt: '2026-05-13T00:00:00.000Z',
    ...o,
  };
}

function makeHistory(o: Partial<PunchListHistoryRecord> = {}): PunchListHistoryRecord {
  return {
    id: 'h-1',
    itemId: 'p-1',
    action: 'created',
    status: 'open',
    actor: '我妻',
    timestamp: '2026-05-13T00:00:00.000Z',
    ...o,
  };
}

describe('PunchListRepository async (InMemory mode)', () => {
  let repo: PunchListRepository;

  beforeEach(() => {
    repo = new PunchListRepository(false);
  });

  // ── items ───────────────────────────────────────────────────────────

  it('saveItemAsync→getItemAsync', async () => {
    await repo.saveItemAsync(makeItem({ priority: 'high' }));
    const found = await repo.getItemAsync('p-1');
    expect(found?.priority).toBe('high');
    expect(found?.title).toBe('クロス浮き');
  });

  it('listItemsByProjectAsync がフィルタする', async () => {
    await repo.saveItemAsync(makeItem({ id: 'p-1', projectId: 'A' }));
    await repo.saveItemAsync(makeItem({ id: 'p-2', projectId: 'B' }));
    const list = await repo.listItemsByProjectAsync('A');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('p-1');
  });

  it('resolved 系フィールドが保持される', async () => {
    await repo.saveItemAsync(
      makeItem({
        status: 'resolved',
        resolvedAt: '2026-05-13T18:00:00.000Z',
        resolvedBy: '鈴木',
        resolutionNotes: '再施工済',
      }),
    );
    const found = await repo.getItemAsync('p-1');
    expect(found?.resolvedBy).toBe('鈴木');
    expect(found?.resolutionNotes).toBe('再施工済');
  });

  it('deleteItemAsync は true/false を返す', async () => {
    await repo.saveItemAsync(makeItem());
    expect(await repo.deleteItemAsync('p-1')).toBe(true);
    expect(await repo.deleteItemAsync('p-1')).toBe(false);
  });

  // ── history ─────────────────────────────────────────────────────────

  it('appendHistoryAsync→listHistoryByItemAsync が item でフィルタする', async () => {
    await repo.appendHistoryAsync(makeHistory({ id: 'h-1', itemId: 'p-1' }));
    await repo.appendHistoryAsync(makeHistory({ id: 'h-2', itemId: 'p-2' }));
    const list = await repo.listHistoryByItemAsync('p-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('h-1');
  });

  it('履歴 action が保持される', async () => {
    await repo.appendHistoryAsync(makeHistory({ action: 'resolved' }));
    const list = await repo.listHistoryByItemAsync('p-1');
    expect(list[0]?.action).toBe('resolved');
  });

  it('deleteHistoryAsync は true/false を返す', async () => {
    await repo.appendHistoryAsync(makeHistory());
    expect(await repo.deleteHistoryAsync('h-1')).toBe(true);
    expect(await repo.deleteHistoryAsync('h-1')).toBe(false);
  });
});
