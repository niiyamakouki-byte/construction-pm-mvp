import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { LaborRepository } from './LaborRepository.js';
import type {
  LaborTimeEntryRecord,
  CrewAssignmentRecord,
} from './LaborRepository.js';

function makeEntry(
  overrides: Partial<LaborTimeEntryRecord> = {},
): LaborTimeEntryRecord {
  return {
    id: 'lt-1',
    projectId: 'proj-1',
    workerId: 'w-1',
    workerName: '山田太郎',
    trade: '大工',
    hourlyRate: 3000,
    clockInTime: '2026-05-13T09:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<CrewAssignmentRecord> = {},
): CrewAssignmentRecord {
  return {
    id: 'ca-1',
    projectId: 'proj-1',
    crewId: 'crew-A',
    crewName: 'Aチーム',
    workerId: 'w-1',
    workerName: '山田太郎',
    assignmentDate: '2026-05-13',
    ...overrides,
  };
}

describe('LaborRepository async (InMemory mode)', () => {
  let repo: LaborRepository;

  beforeEach(() => {
    repo = new LaborRepository(false);
  });

  // ── labor_time_entries ─────────────────────────────────────────────

  it('saveEntryAsync→getEntryAsync で永続化と取得ができる', async () => {
    await repo.saveEntryAsync(makeEntry());
    const found = await repo.getEntryAsync('lt-1');
    expect(found?.workerName).toBe('山田太郎');
    expect(found?.trade).toBe('大工');
  });

  it('getEntryAsync は存在しない id で null を返す', async () => {
    expect(await repo.getEntryAsync('nope')).toBeNull();
  });

  it('listEntriesAsync が全件返す', async () => {
    await repo.saveEntryAsync(makeEntry({ id: 'lt-1' }));
    await repo.saveEntryAsync(makeEntry({ id: 'lt-2' }));
    const list = await repo.listEntriesAsync();
    expect(list).toHaveLength(2);
  });

  it('listEntriesByProjectAsync がプロジェクトでフィルタする', async () => {
    await repo.saveEntryAsync(makeEntry({ id: 'lt-1', projectId: 'A' }));
    await repo.saveEntryAsync(makeEntry({ id: 'lt-2', projectId: 'B' }));
    const list = await repo.listEntriesByProjectAsync('A');
    expect(list).toHaveLength(1);
    expect(list[0]?.projectId).toBe('A');
  });

  it('listEntriesByProjectAsync が日付でも絞り込む', async () => {
    await repo.saveEntryAsync(
      makeEntry({ id: 'lt-1', clockInTime: '2026-05-13T09:00:00.000Z' }),
    );
    await repo.saveEntryAsync(
      makeEntry({ id: 'lt-2', clockInTime: '2026-05-14T09:00:00.000Z' }),
    );
    const list = await repo.listEntriesByProjectAsync('proj-1', '2026-05-13');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('lt-1');
  });

  it('saveEntryAsync は同じ id で上書き保存する', async () => {
    await repo.saveEntryAsync(makeEntry({ status: 'active' }));
    await repo.saveEntryAsync(
      makeEntry({
        status: 'completed',
        clockOutTime: '2026-05-13T18:00:00.000Z',
      }),
    );
    const found = await repo.getEntryAsync('lt-1');
    expect(found?.status).toBe('completed');
    expect(found?.clockOutTime).toBe('2026-05-13T18:00:00.000Z');
  });

  it('deleteEntryAsync は true/false を返す', async () => {
    await repo.saveEntryAsync(makeEntry());
    expect(await repo.deleteEntryAsync('lt-1')).toBe(true);
    expect(await repo.deleteEntryAsync('lt-1')).toBe(false);
  });

  // ── crew_assignments ───────────────────────────────────────────────

  it('saveAssignmentAsync→getAssignmentAsync で永続化と取得ができる', async () => {
    await repo.saveAssignmentAsync(makeAssignment({ role: '班長' }));
    const found = await repo.getAssignmentAsync('ca-1');
    expect(found?.crewName).toBe('Aチーム');
    expect(found?.role).toBe('班長');
  });

  it('listAssignmentsByProjectAsync が日付でも絞り込む', async () => {
    await repo.saveAssignmentAsync(
      makeAssignment({ id: 'ca-1', assignmentDate: '2026-05-13' }),
    );
    await repo.saveAssignmentAsync(
      makeAssignment({ id: 'ca-2', assignmentDate: '2026-05-14' }),
    );
    const list = await repo.listAssignmentsByProjectAsync(
      'proj-1',
      '2026-05-13',
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('ca-1');
  });

  it('deleteAssignmentAsync は true/false を返す', async () => {
    await repo.saveAssignmentAsync(makeAssignment());
    expect(await repo.deleteAssignmentAsync('ca-1')).toBe(true);
    expect(await repo.deleteAssignmentAsync('ca-1')).toBe(false);
  });

  it('entries と assignments は独立した名前空間', async () => {
    await repo.saveEntryAsync(makeEntry({ id: 'shared-id' }));
    await repo.saveAssignmentAsync(makeAssignment({ id: 'shared-id' }));
    expect((await repo.listEntriesAsync()).length).toBe(1);
    expect((await repo.listAssignmentsAsync()).length).toBe(1);
  });
});
