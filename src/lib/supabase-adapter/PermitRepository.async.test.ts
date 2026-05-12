import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { PermitRepository } from './PermitRepository.js';
import type {
  PermitApplicationRecord,
  PermitInspectionRecord,
} from './PermitRepository.js';

function makePermit(o: Partial<PermitApplicationRecord> = {}): PermitApplicationRecord {
  return {
    id: 'pm-1',
    projectId: 'proj-1',
    permitType: '建築確認',
    jurisdiction: '世田谷区',
    applicationDate: '2026-05-01',
    applicantName: '株式会社ラポルタ',
    status: 'applied',
    ...o,
  };
}

function makeInspection(o: Partial<PermitInspectionRecord> = {}): PermitInspectionRecord {
  return {
    id: 'is-1',
    permitId: 'pm-1',
    projectId: 'proj-1',
    inspectionType: '中間検査',
    scheduledDate: '2026-06-15',
    status: 'scheduled',
    ...o,
  };
}

describe('PermitRepository async (InMemory mode)', () => {
  let repo: PermitRepository;

  beforeEach(() => {
    repo = new PermitRepository(false);
  });

  it('savePermitAsync→getPermitAsync', async () => {
    await repo.savePermitAsync(
      makePermit({
        status: 'approved',
        approvalDate: '2026-05-10',
        permitNumber: 'A-12345',
      }),
    );
    const found = await repo.getPermitAsync('pm-1');
    expect(found?.status).toBe('approved');
    expect(found?.permitNumber).toBe('A-12345');
  });

  it('listPermitsByProjectAsync がフィルタする', async () => {
    await repo.savePermitAsync(makePermit({ id: 'pm-1', projectId: 'A' }));
    await repo.savePermitAsync(makePermit({ id: 'pm-2', projectId: 'B' }));
    expect((await repo.listPermitsByProjectAsync('A')).length).toBe(1);
  });

  it('expiryDate が保持される', async () => {
    await repo.savePermitAsync(
      makePermit({ expiryDate: '2027-05-01', notes: '一年有効' }),
    );
    const found = await repo.getPermitAsync('pm-1');
    expect(found?.expiryDate).toBe('2027-05-01');
    expect(found?.notes).toBe('一年有効');
  });

  it('deletePermitAsync は true/false を返す', async () => {
    await repo.savePermitAsync(makePermit());
    expect(await repo.deletePermitAsync('pm-1')).toBe(true);
    expect(await repo.deletePermitAsync('pm-1')).toBe(false);
  });

  it('saveInspectionAsync→listInspectionsByPermitAsync が permit でフィルタ', async () => {
    await repo.saveInspectionAsync(makeInspection({ id: 'is-1', permitId: 'pm-1' }));
    await repo.saveInspectionAsync(makeInspection({ id: 'is-2', permitId: 'pm-2' }));
    const list = await repo.listInspectionsByPermitAsync('pm-1');
    expect(list).toHaveLength(1);
  });

  it('inspection 結果と inspectorName が保持される', async () => {
    await repo.saveInspectionAsync(
      makeInspection({
        status: 'passed',
        inspectorName: '山田検査官',
      }),
    );
    const list = await repo.listInspectionsByPermitAsync('pm-1');
    expect(list[0]?.status).toBe('passed');
    expect(list[0]?.inspectorName).toBe('山田検査官');
  });

  it('deleteInspectionAsync は true/false を返す', async () => {
    await repo.saveInspectionAsync(makeInspection());
    expect(await repo.deleteInspectionAsync('is-1')).toBe(true);
    expect(await repo.deleteInspectionAsync('is-1')).toBe(false);
  });
});
