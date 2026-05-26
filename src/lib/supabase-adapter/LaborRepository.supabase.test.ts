/**
 * LaborRepository — Supabase ルーティングテスト
 * useSupabase=true で labor_time_entries / crew_assignments を参照することを確認する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import {
  LaborRepository,
  type LaborTimeEntryRecord,
  type CrewAssignmentRecord,
} from './LaborRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';

function makeBuilder(terminal: {
  data: unknown;
  error: { message: string } | null;
}) {
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

const mockFrom = (
  supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } }
).supabase.from;

function makeEntry(): LaborTimeEntryRecord {
  return {
    id: 'lt-1',
    projectId: 'proj-1',
    workerId: 'w-1',
    workerName: '山田太郎',
    trade: '大工',
    hourlyRate: 3000,
    clockInTime: '2026-05-13T09:00:00.000Z',
    status: 'active',
  };
}

function makeAssignment(): CrewAssignmentRecord {
  return {
    id: 'ca-1',
    projectId: 'proj-1',
    crewId: 'crew-A',
    crewName: 'Aチーム',
    workerId: 'w-1',
    workerName: '山田太郎',
    assignmentDate: '2026-05-13',
  };
}

describe('LaborRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getEntryAsync は labor_time_entries テーブルを参照し camelCase に変換する', async () => {
    const row = {
      id: 'lt-1',
      project_id: 'proj-1',
      worker_id: 'w-1',
      worker_name: '山田太郎',
      trade: '大工',
      hourly_rate: 3000,
      clock_in_time: '2026-05-13T09:00:00.000Z',
      clock_out_time: null,
      crew_id: null,
      status: 'active',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new LaborRepository(true);
    const result = await repo.getEntryAsync('lt-1');
    expect(mockFrom).toHaveBeenCalledWith('labor_time_entries');
    expect(result?.projectId).toBe('proj-1');
    expect(result?.workerName).toBe('山田太郎');
    expect(result?.hourlyRate).toBe(3000);
  });

  it('useSupabase=true の listEntriesAsync は配列を変換して返す', async () => {
    const rows = [
      {
        id: 'lt-1',
        project_id: 'proj-1',
        worker_id: 'w-1',
        worker_name: 'A',
        trade: '大工',
        hourly_rate: 3000,
        clock_in_time: '2026-05-13T09:00:00.000Z',
        clock_out_time: '2026-05-13T18:00:00.000Z',
        crew_id: 'c-1',
        status: 'completed',
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new LaborRepository(true);
    const result = await repo.listEntriesAsync();
    expect(mockFrom).toHaveBeenCalledWith('labor_time_entries');
    expect(result).toHaveLength(1);
    expect(result[0]?.clockOutTime).toBe('2026-05-13T18:00:00.000Z');
    expect(result[0]?.crewId).toBe('c-1');
    expect(result[0]?.status).toBe('completed');
  });

  it('useSupabase=true の getAssignmentAsync は crew_assignments テーブルを参照する', async () => {
    const row = {
      id: 'ca-1',
      project_id: 'proj-1',
      crew_id: 'crew-A',
      crew_name: 'Aチーム',
      worker_id: 'w-1',
      worker_name: '山田太郎',
      assignment_date: '2026-05-13',
      role: '班長',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new LaborRepository(true);
    const result = await repo.getAssignmentAsync('ca-1');
    expect(mockFrom).toHaveBeenCalledWith('crew_assignments');
    expect(result?.crewName).toBe('Aチーム');
    expect(result?.role).toBe('班長');
  });

  it('useSupabase=true の listAssignmentsByProjectAsync が project でフィルタする', async () => {
    const rows = [
      {
        id: 'ca-1',
        project_id: 'proj-A',
        crew_id: 'c-1',
        crew_name: 'X',
        worker_id: 'w-1',
        worker_name: 'A',
        assignment_date: '2026-05-13',
        role: null,
      },
      {
        id: 'ca-2',
        project_id: 'proj-B',
        crew_id: 'c-2',
        crew_name: 'Y',
        worker_id: 'w-2',
        worker_name: 'B',
        assignment_date: '2026-05-13',
        role: null,
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new LaborRepository(true);
    const result = await repo.listAssignmentsByProjectAsync('proj-A');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('ca-1');
  });

  it('useSupabase=false で Supabase クライアントを一切呼ばない', async () => {
    const repo = new LaborRepository(false);
    await repo.saveEntryAsync(makeEntry());
    await repo.saveAssignmentAsync(makeAssignment());
    await repo.listEntriesAsync();
    await repo.listAssignmentsAsync();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('useSupabase=false の deleteEntryAsync は同期 delete と同じ挙動', async () => {
    const repo = new LaborRepository(false);
    await repo.saveEntryAsync(makeEntry());
    expect(await repo.deleteEntryAsync('lt-1')).toBe(true);
    expect(await repo.deleteEntryAsync('ghost')).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
