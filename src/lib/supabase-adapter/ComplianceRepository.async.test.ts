import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ComplianceRepository } from './ComplianceRepository.js';
import type {
  ComplianceRequirementRecord,
  ComplianceAuditEntryRecord,
} from './ComplianceRepository.js';

function makeReq(o: Partial<ComplianceRequirementRecord> = {}): ComplianceRequirementRecord {
  return {
    id: 'c-1',
    projectId: 'proj-1',
    name: '足場設置届',
    category: '法定',
    description: '労基署提出',
    dueDate: '2026-05-20',
    status: 'compliant',
    ...o,
  };
}

function makeAudit(o: Partial<ComplianceAuditEntryRecord> = {}): ComplianceAuditEntryRecord {
  return {
    id: 'a-1',
    requirementId: 'c-1',
    action: 'created',
    performedBy: 'system',
    timestamp: '2026-05-13T00:00:00.000Z',
    details: 'Requirement created',
    ...o,
  };
}

describe('ComplianceRepository async (InMemory mode)', () => {
  let repo: ComplianceRepository;

  beforeEach(() => {
    repo = new ComplianceRepository(false);
  });

  it('saveRequirementAsync→getRequirementAsync', async () => {
    await repo.saveRequirementAsync(makeReq({ status: 'overdue' }));
    const found = await repo.getRequirementAsync('c-1');
    expect(found?.status).toBe('overdue');
    expect(found?.name).toBe('足場設置届');
  });

  it('listRequirementsByProjectAsync がフィルタする', async () => {
    await repo.saveRequirementAsync(makeReq({ id: 'c-1', projectId: 'A' }));
    await repo.saveRequirementAsync(makeReq({ id: 'c-2', projectId: 'B' }));
    expect((await repo.listRequirementsByProjectAsync('A')).length).toBe(1);
  });

  it('オプショナルフィールドが保持される', async () => {
    await repo.saveRequirementAsync(
      makeReq({
        completedDate: '2026-05-15',
        responsiblePerson: '我妻',
        documentUrl: 'https://example.com/cert.pdf',
        notes: '完了',
      }),
    );
    const found = await repo.getRequirementAsync('c-1');
    expect(found?.responsiblePerson).toBe('我妻');
    expect(found?.documentUrl).toBe('https://example.com/cert.pdf');
  });

  it('deleteRequirementAsync は true/false を返す', async () => {
    await repo.saveRequirementAsync(makeReq());
    expect(await repo.deleteRequirementAsync('c-1')).toBe(true);
    expect(await repo.deleteRequirementAsync('c-1')).toBe(false);
  });

  it('appendAuditAsync→listAuditByRequirementAsync が requirement でフィルタ', async () => {
    await repo.appendAuditAsync(makeAudit({ id: 'a-1', requirementId: 'c-1' }));
    await repo.appendAuditAsync(makeAudit({ id: 'a-2', requirementId: 'c-2' }));
    const list = await repo.listAuditByRequirementAsync('c-1');
    expect(list).toHaveLength(1);
  });

  it('audit action と details が保持される', async () => {
    await repo.appendAuditAsync(
      makeAudit({ action: 'status_updated', details: 'compliant→overdue' }),
    );
    const list = await repo.listAuditByRequirementAsync('c-1');
    expect(list[0]?.action).toBe('status_updated');
    expect(list[0]?.details).toBe('compliant→overdue');
  });

  it('deleteAuditAsync は true/false を返す', async () => {
    await repo.appendAuditAsync(makeAudit());
    expect(await repo.deleteAuditAsync('a-1')).toBe(true);
    expect(await repo.deleteAuditAsync('a-1')).toBe(false);
  });
});
