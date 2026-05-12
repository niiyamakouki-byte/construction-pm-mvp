import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { ClaimRepository } from './ClaimRepository.js';
import type {
  InsuranceClaimRecord,
  ClaimDocumentRecord,
  ClaimDisputeRecord,
} from './ClaimRepository.js';

function makeClaim(o: Partial<InsuranceClaimRecord> = {}): InsuranceClaimRecord {
  return {
    id: 'cl-1',
    projectId: 'proj-1',
    claimType: '水濡れ',
    incidentDate: '2026-05-10',
    description: '配管漏水',
    claimedAmount: 500000,
    status: 'open',
    openedBy: '我妻',
    ...o,
  };
}

function makeDocument(o: Partial<ClaimDocumentRecord> = {}): ClaimDocumentRecord {
  return {
    id: 'd-1',
    claimId: 'cl-1',
    projectId: 'proj-1',
    fileName: 'damage.jpg',
    documentType: 'photo',
    uploadedAt: '2026-05-11T10:00:00.000Z',
    uploadedBy: '我妻',
    ...o,
  };
}

function makeDispute(o: Partial<ClaimDisputeRecord> = {}): ClaimDisputeRecord {
  return {
    id: 'dp-1',
    claimId: 'cl-1',
    projectId: 'proj-1',
    reason: '査定額不服',
    disputedAmount: 200000,
    openedDate: '2026-05-12',
    status: 'open',
    ...o,
  };
}

describe('ClaimRepository async (InMemory mode)', () => {
  let repo: ClaimRepository;

  beforeEach(() => {
    repo = new ClaimRepository(false);
  });

  it('saveClaimAsync→getClaimAsync', async () => {
    await repo.saveClaimAsync(makeClaim({ approvedAmount: 450000, status: 'approved' }));
    const found = await repo.getClaimAsync('cl-1');
    expect(found?.approvedAmount).toBe(450000);
    expect(found?.status).toBe('approved');
  });

  it('listClaimsByProjectAsync がフィルタする', async () => {
    await repo.saveClaimAsync(makeClaim({ id: 'cl-1', projectId: 'A' }));
    await repo.saveClaimAsync(makeClaim({ id: 'cl-2', projectId: 'B' }));
    expect((await repo.listClaimsByProjectAsync('A')).length).toBe(1);
  });

  it('deleteClaimAsync は true/false を返す', async () => {
    await repo.saveClaimAsync(makeClaim());
    expect(await repo.deleteClaimAsync('cl-1')).toBe(true);
    expect(await repo.deleteClaimAsync('cl-1')).toBe(false);
  });

  it('appendDocumentAsync→listDocumentsByClaimAsync が claim でフィルタ', async () => {
    await repo.appendDocumentAsync(makeDocument({ id: 'd-1', claimId: 'cl-1' }));
    await repo.appendDocumentAsync(makeDocument({ id: 'd-2', claimId: 'cl-2' }));
    expect((await repo.listDocumentsByClaimAsync('cl-1')).length).toBe(1);
  });

  it('document type が保持される', async () => {
    await repo.appendDocumentAsync(makeDocument({ documentType: 'invoice' }));
    const list = await repo.listDocumentsByClaimAsync('cl-1');
    expect(list[0]?.documentType).toBe('invoice');
  });

  it('saveDisputeAsync→listDisputesByClaimAsync', async () => {
    await repo.saveDisputeAsync(makeDispute({ disputedAmount: 300000 }));
    const list = await repo.listDisputesByClaimAsync('cl-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.disputedAmount).toBe(300000);
  });

  it('dispute resolved 状態と outcome が保持される', async () => {
    await repo.saveDisputeAsync(
      makeDispute({
        status: 'resolved',
        resolutionDate: '2026-05-20',
        outcome: '20万円増額で和解',
      }),
    );
    const list = await repo.listDisputesByClaimAsync('cl-1');
    expect(list[0]?.status).toBe('resolved');
    expect(list[0]?.outcome).toBe('20万円増額で和解');
  });

  it('claim/document/dispute は独立した名前空間', async () => {
    await repo.saveClaimAsync(makeClaim({ id: 'shared' }));
    await repo.appendDocumentAsync(makeDocument({ id: 'shared' }));
    await repo.saveDisputeAsync(makeDispute({ id: 'shared' }));
    expect((await repo.listClaimsAsync()).length).toBe(1);
    expect((await repo.listDocumentsByClaimAsync('cl-1')).length).toBe(1);
    expect((await repo.listDisputesByClaimAsync('cl-1')).length).toBe(1);
  });
});
