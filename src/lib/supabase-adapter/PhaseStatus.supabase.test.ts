/**
 * PhaseStatus — Phase 1.6 ステータス遷移 + 履歴テスト
 * Supabase モード (モック) と InMemory モード両方を検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PhaseRepository, type PhaseRecord, type PhaseStatus } from './PhaseRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';

// ── mock builder ──────────────────────────────────────────────
function makeChainBuilder(terminal: { data: unknown; error: { message: string } | null }) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.update = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.order = vi.fn(chain);
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

// ── fixtures ──────────────────────────────────────────────────
function makePhaseRecord(overrides: Partial<PhaseRecord> = {}): PhaseRecord {
  return {
    id: 'phase-1',
    projectId: 'project-1',
    organizationId: null,
    parentId: null,
    level: 1,
    name: '内装工事',
    orderIndex: 0,
    startDate: '2026-06-01',
    endDate: '2026-07-31',
    status: 'planned',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

// ── テスト ────────────────────────────────────────────────────
describe('PhaseStatus — Phase 1.6', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. PhaseStatus 型が 5 値すべてを受け入れる
  it('PhaseStatus は 5 値すべてを受け入れる', () => {
    const statuses: PhaseStatus[] = ['planned', 'in_progress', 'blocked', 'done', 'canceled'];
    expect(statuses).toHaveLength(5);
    statuses.forEach((s) => {
      const phase = makePhaseRecord({ status: s });
      expect(phase.status).toBe(s);
    });
  });

  // 2. InMemory: updateStatus で status が更新される
  it('InMemory: updateStatus がステータスを更新する', async () => {
    const repo = new PhaseRepository(false);
    await repo.saveAsync(makePhaseRecord({ id: 'p1', status: 'planned' }));

    await repo.updateStatus('p1', 'in_progress');

    const phase = await repo.getAsync('p1');
    expect(phase?.status).toBe('in_progress');
  });

  // 3. InMemory: updateStatus が履歴を1件挿入する
  it('InMemory: updateStatus が履歴 record を1件挿入する', async () => {
    const repo = new PhaseRepository(false);
    await repo.saveAsync(makePhaseRecord({ id: 'p1', status: 'planned' }));

    await repo.updateStatus('p1', 'in_progress', 'user-uuid-1');

    const history = await repo.getStatusHistory('p1');
    expect(history).toHaveLength(1);
    expect(history[0].oldStatus).toBe('planned');
    expect(history[0].newStatus).toBe('in_progress');
    expect(history[0].changedBy).toBe('user-uuid-1');
  });

  // 4. InMemory: 複数回 updateStatus で履歴が累積される
  it('InMemory: 複数回変更で履歴が累積される', async () => {
    const repo = new PhaseRepository(false);
    await repo.saveAsync(makePhaseRecord({ id: 'p2', status: 'planned' }));

    await repo.updateStatus('p2', 'in_progress');
    await repo.updateStatus('p2', 'blocked');
    await repo.updateStatus('p2', 'done');

    const history = await repo.getStatusHistory('p2');
    expect(history).toHaveLength(3);
    expect(history[0].newStatus).toBe('in_progress');
    expect(history[1].newStatus).toBe('blocked');
    expect(history[2].newStatus).toBe('done');
  });

  // 5. InMemory: listByStatus がステータスでフィルタする
  it('InMemory: listByStatus がステータスでフィルタする', async () => {
    const repo = new PhaseRepository(false);
    await repo.saveAsync(makePhaseRecord({ id: 'p1', projectId: 'proj-a', status: 'planned', orderIndex: 0 }));
    await repo.saveAsync(makePhaseRecord({ id: 'p2', projectId: 'proj-a', status: 'in_progress', orderIndex: 1 }));
    await repo.saveAsync(makePhaseRecord({ id: 'p3', projectId: 'proj-a', status: 'done', orderIndex: 2 }));

    const planned = await repo.listByStatus('proj-a', 'planned');
    expect(planned).toHaveLength(1);
    expect(planned[0].id).toBe('p1');

    const done = await repo.listByStatus('proj-a', 'done');
    expect(done).toHaveLength(1);
    expect(done[0].id).toBe('p3');
  });

  // 6. InMemory: last-write-wins — 並行更新で最後の値が勝つ
  it('InMemory: 並行 updateStatus は last-write-wins になる', async () => {
    const repo = new PhaseRepository(false);
    await repo.saveAsync(makePhaseRecord({ id: 'p1', status: 'planned' }));

    // 同時に2つの update を発行
    await Promise.all([
      repo.updateStatus('p1', 'in_progress'),
      repo.updateStatus('p1', 'blocked'),
    ]);

    const phase = await repo.getAsync('p1');
    // どちらかが最後に書き込まれる。履歴は2件
    expect(['in_progress', 'blocked']).toContain(phase?.status);
    const history = await repo.getStatusHistory('p1');
    expect(history).toHaveLength(2);
  });

  // 7. Supabase モード: updateStatus が phases テーブルを update する
  it('Supabase: updateStatus が phases テーブルを update する', async () => {
    mockFrom.mockReturnValue(makeChainBuilder({ data: null, error: null }));

    const repo = new PhaseRepository(true);
    await repo.updateStatus('phase-1', 'done');

    expect(mockFrom).toHaveBeenCalledWith('phases');
  });

  // 8. Supabase モード: getStatusHistory が phase_status_history テーブルを参照する
  it('Supabase: getStatusHistory が phase_status_history テーブルを参照する', async () => {
    const historyRows = [
      {
        id: 'hist-1',
        phase_id: 'phase-1',
        old_status: 'planned',
        new_status: 'in_progress',
        changed_at: '2026-05-08T01:00:00.000Z',
        changed_by: null,
      },
    ];
    mockFrom.mockReturnValue(makeChainBuilder({ data: historyRows, error: null }));

    const repo = new PhaseRepository(true);
    const history = await repo.getStatusHistory('phase-1');

    expect(mockFrom).toHaveBeenCalledWith('phase_status_history');
    expect(history).toHaveLength(1);
    expect(history[0].oldStatus).toBe('planned');
    expect(history[0].newStatus).toBe('in_progress');
    expect(history[0].phaseId).toBe('phase-1');
  });

  // 9. InMemory: updateStatus で存在しない phaseId はエラーを投げる
  it('InMemory: updateStatus 存在しない ID はエラーを投げる', async () => {
    const repo = new PhaseRepository(false);
    await expect(repo.updateStatus('nonexistent', 'done')).rejects.toThrow('nonexistent');
  });
});
