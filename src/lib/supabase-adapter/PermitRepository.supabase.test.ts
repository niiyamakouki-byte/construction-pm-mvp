import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PermitRepository } from './PermitRepository.js';
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

describe('PermitRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getPermitAsync が permit_applications を参照する', async () => {
    const row = {
      id: 'pm-1',
      project_id: 'p-1',
      permit_type: '建築確認',
      jurisdiction: '世田谷区',
      application_date: '2026-05-01',
      applicant_name: 'ラポルタ',
      status: 'approved',
      approval_date: '2026-05-10',
      permit_number: 'A-12345',
      expiry_date: null,
      notes: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new PermitRepository(true);
    const result = await repo.getPermitAsync('pm-1');
    expect(mockFrom).toHaveBeenCalledWith('permit_applications');
    expect(result?.permitNumber).toBe('A-12345');
  });

  it('useSupabase=true の listInspectionsByPermitAsync が permit_inspections を参照しフィルタ', async () => {
    const rows = [
      {
        id: 'is-1',
        permit_id: 'pm-1',
        project_id: 'p-1',
        inspection_type: '中間',
        scheduled_date: '2026-06-15',
        status: 'scheduled',
        inspector_name: null,
        notes: null,
      },
      {
        id: 'is-2',
        permit_id: 'pm-2',
        project_id: 'p-1',
        inspection_type: '完了',
        scheduled_date: '2026-07-15',
        status: 'scheduled',
        inspector_name: null,
        notes: null,
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new PermitRepository(true);
    const result = await repo.listInspectionsByPermitAsync('pm-1');
    expect(mockFrom).toHaveBeenCalledWith('permit_inspections');
    expect(result).toHaveLength(1);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new PermitRepository(false);
    await repo.savePermitAsync({
      id: 'pm-1',
      projectId: 'p-1',
      permitType: 'x',
      jurisdiction: '',
      applicationDate: '2026-05-01',
      applicantName: '',
      status: 'applied',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
