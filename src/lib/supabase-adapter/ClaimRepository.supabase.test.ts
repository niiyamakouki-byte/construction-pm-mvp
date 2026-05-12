import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ClaimRepository } from './ClaimRepository.js';
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

describe('ClaimRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getClaimAsync が insurance_claims を参照', async () => {
    const row = {
      id: 'cl-1',
      project_id: 'p-1',
      claim_type: '水濡れ',
      incident_date: '2026-05-10',
      description: 'desc',
      claimed_amount: 500000,
      approved_amount: 450000,
      status: 'approved',
      opened_by: '我妻',
      resolution_date: null,
      notes: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new ClaimRepository(true);
    const result = await repo.getClaimAsync('cl-1');
    expect(mockFrom).toHaveBeenCalledWith('insurance_claims');
    expect(result?.approvedAmount).toBe(450000);
  });

  it('useSupabase=true の listDocumentsByClaimAsync が claim_documents を参照しフィルタ', async () => {
    const rows = [
      {
        id: 'd-1',
        claim_id: 'cl-1',
        project_id: 'p-1',
        file_name: 'x.jpg',
        document_type: 'photo',
        uploaded_at: '2026-05-11T10:00:00.000Z',
        uploaded_by: '我妻',
      },
      {
        id: 'd-2',
        claim_id: 'cl-2',
        project_id: 'p-1',
        file_name: 'y.pdf',
        document_type: 'invoice',
        uploaded_at: '2026-05-11T10:00:00.000Z',
        uploaded_by: '鈴木',
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new ClaimRepository(true);
    const result = await repo.listDocumentsByClaimAsync('cl-1');
    expect(mockFrom).toHaveBeenCalledWith('claim_documents');
    expect(result).toHaveLength(1);
  });

  it('useSupabase=true の listDisputesByClaimAsync が claim_disputes を参照', async () => {
    const rows = [
      {
        id: 'dp-1',
        claim_id: 'cl-1',
        project_id: 'p-1',
        reason: '不服',
        disputed_amount: 200000,
        opened_date: '2026-05-12',
        status: 'open',
        resolution_date: null,
        outcome: null,
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new ClaimRepository(true);
    const result = await repo.listDisputesByClaimAsync('cl-1');
    expect(mockFrom).toHaveBeenCalledWith('claim_disputes');
    expect(result[0]?.disputedAmount).toBe(200000);
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new ClaimRepository(false);
    await repo.saveClaimAsync({
      id: 'cl-1',
      projectId: 'p-1',
      claimType: 'x',
      incidentDate: '2026-05-10',
      description: '',
      claimedAmount: 0,
      status: 'open',
      openedBy: '',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
