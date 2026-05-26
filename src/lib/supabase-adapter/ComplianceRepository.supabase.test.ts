import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ComplianceRepository } from './ComplianceRepository.js';
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

describe('ComplianceRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getRequirementAsync が compliance_requirements を参照する', async () => {
    const row = {
      id: 'c-1',
      project_id: 'p-1',
      name: '足場設置届',
      category: '法定',
      description: 'desc',
      due_date: '2026-05-20',
      status: 'warning',
      completed_date: null,
      responsible_person: '我妻',
      document_url: null,
      notes: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new ComplianceRepository(true);
    const result = await repo.getRequirementAsync('c-1');
    expect(mockFrom).toHaveBeenCalledWith('compliance_requirements');
    expect(result?.status).toBe('warning');
    expect(result?.responsiblePerson).toBe('我妻');
  });

  it('useSupabase=true の listAuditByRequirementAsync が compliance_audit_log を参照しフィルタ', async () => {
    const rows = [
      {
        id: 'a-1',
        requirement_id: 'c-1',
        action: 'created',
        performed_by: 'sys',
        timestamp: '2026-05-13T00:00:00.000Z',
        details: 'x',
      },
      {
        id: 'a-2',
        requirement_id: 'c-2',
        action: 'created',
        performed_by: 'sys',
        timestamp: '2026-05-13T00:00:00.000Z',
        details: 'y',
      },
    ];
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }));

    const repo = new ComplianceRepository(true);
    const result = await repo.listAuditByRequirementAsync('c-1');
    expect(mockFrom).toHaveBeenCalledWith('compliance_audit_log');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a-1');
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new ComplianceRepository(false);
    await repo.saveRequirementAsync({
      id: 'c-1',
      projectId: 'p-1',
      name: 'x',
      category: '',
      description: '',
      dueDate: '2026-05-20',
      status: 'compliant',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
