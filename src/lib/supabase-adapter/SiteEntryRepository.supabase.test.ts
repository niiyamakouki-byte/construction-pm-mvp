import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { SiteEntryRepository } from './SiteEntryRepository.js';
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

const mockFrom = (
  supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } }
).supabase.from;

describe('SiteEntryRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getAsync が site_entry_records を参照し camelCase に変換', async () => {
    const row = {
      id: 'e-1',
      project_id: 'p-1',
      worker_name: '山田',
      company_name: 'ラポルタ',
      entry_at: '2026-05-13T09:00:00.000Z',
      exit_at: '2026-05-13T18:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SiteEntryRepository(true);
    const result = await repo.getAsync('e-1');
    expect(mockFrom).toHaveBeenCalledWith('site_entry_records');
    expect(result?.workerName).toBe('山田');
    expect(result?.exitTime).toBe('2026-05-13T18:00:00.000Z');
  });

  it('exit_at=null が exitTime undefined に変換される', async () => {
    const row = {
      id: 'e-1',
      project_id: 'p-1',
      worker_name: '山田',
      company_name: 'ラポルタ',
      entry_at: '2026-05-13T09:00:00.000Z',
      exit_at: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SiteEntryRepository(true);
    const result = await repo.getAsync('e-1');
    expect(result?.exitTime).toBeUndefined();
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new SiteEntryRepository(false);
    await repo.saveAsync({
      id: 'e-1',
      projectId: 'p-1',
      workerName: '山田',
      company: 'ラポルタ',
      entryTime: '2026-05-13T09:00:00.000Z',
    });
    await repo.listAsync();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
