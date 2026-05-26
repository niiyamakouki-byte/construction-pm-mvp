import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { EquipmentRepository } from './EquipmentRepository.js';
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

describe('EquipmentRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getRentalAsync が equipment_rentals テーブルを参照する', async () => {
    const row = {
      id: 'r-1',
      project_id: 'proj-1',
      item_name: '高所作業車',
      quantity: 1,
      daily_rate: 25000,
      rental_start_date: '2026-05-13',
      expected_return_date: '2026-05-20',
      actual_return_date: null,
      vendor: 'アクティオ',
      status: 'active',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new EquipmentRepository(true);
    const result = await repo.getRentalAsync('r-1');
    expect(mockFrom).toHaveBeenCalledWith('equipment_rentals');
    expect(result?.itemName).toBe('高所作業車');
    expect(result?.dailyRate).toBe(25000);
  });

  it('useSupabase=true の listUsageByRentalAsync が equipment_usage_logs を参照し rental_id でフィルタ', async () => {
    const rows = [
      {
        id: 'u-1',
        rental_id: 'r-1',
        project_id: 'p-1',
        usage_date: '2026-05-13',
        hours_used: 6,
        available_hours: 8,
      },
      {
        id: 'u-2',
        rental_id: 'r-2',
        project_id: 'p-1',
        usage_date: '2026-05-13',
        hours_used: 4,
        available_hours: 8,
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new EquipmentRepository(true);
    const result = await repo.listUsageByRentalAsync('r-1');
    expect(mockFrom).toHaveBeenCalledWith('equipment_usage_logs');
    expect(result).toHaveLength(1);
    expect(result[0]?.hoursUsed).toBe(6);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new EquipmentRepository(false);
    await repo.saveRentalAsync({
      id: 'r-1',
      projectId: 'p-1',
      itemName: 'x',
      quantity: 1,
      dailyRate: 1000,
      rentalStartDate: '2026-05-13',
      expectedReturnDate: '2026-05-14',
      status: 'active',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
