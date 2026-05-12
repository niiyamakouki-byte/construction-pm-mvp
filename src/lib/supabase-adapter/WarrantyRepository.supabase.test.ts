import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { WarrantyRepository } from './WarrantyRepository.js';
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

describe('WarrantyRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getItemAsync が warranty_items を参照する', async () => {
    const row = {
      id: 'w-1',
      project_id: 'p-1',
      asset_name: 'エアコン',
      category: '空調',
      vendor_name: 'ダイキン',
      start_date: '2026-05-13',
      expiry_date: '2031-05-12',
      warranty_terms: '5年',
      serial_number: 'SN-12345',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new WarrantyRepository(true);
    const result = await repo.getItemAsync('w-1');
    expect(mockFrom).toHaveBeenCalledWith('warranty_items');
    expect(result?.assetName).toBe('エアコン');
    expect(result?.serialNumber).toBe('SN-12345');
  });

  it('useSupabase=true の listClaimsByItemAsync が warranty_claims を参照しフィルタ', async () => {
    const rows = [
      {
        id: 'wc-1',
        warranty_item_id: 'w-1',
        claim_date: '2026-06-01',
        issue: '冷えない',
        status: 'submitted',
        resolution_notes: null,
      },
      {
        id: 'wc-2',
        warranty_item_id: 'w-2',
        claim_date: '2026-06-01',
        issue: '別件',
        status: 'submitted',
        resolution_notes: null,
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new WarrantyRepository(true);
    const result = await repo.listClaimsByItemAsync('w-1');
    expect(mockFrom).toHaveBeenCalledWith('warranty_claims');
    expect(result).toHaveLength(1);
    expect(result[0]?.issue).toBe('冷えない');
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new WarrantyRepository(false);
    await repo.saveItemAsync({
      id: 'w-1',
      projectId: 'p-1',
      assetName: 'x',
      category: '',
      vendorName: '',
      startDate: '2026-05-13',
      expiryDate: '2031-05-12',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
