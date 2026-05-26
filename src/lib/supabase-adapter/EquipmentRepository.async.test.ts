import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { EquipmentRepository } from './EquipmentRepository.js';
import type {
  EquipmentRentalRecord,
  EquipmentUsageLogRecord,
} from './EquipmentRepository.js';

function makeRental(o: Partial<EquipmentRentalRecord> = {}): EquipmentRentalRecord {
  return {
    id: 'r-1',
    projectId: 'proj-1',
    itemName: '高所作業車',
    quantity: 1,
    dailyRate: 25000,
    rentalStartDate: '2026-05-13',
    expectedReturnDate: '2026-05-20',
    status: 'active',
    ...o,
  };
}

function makeUsage(o: Partial<EquipmentUsageLogRecord> = {}): EquipmentUsageLogRecord {
  return {
    id: 'u-1',
    rentalId: 'r-1',
    projectId: 'proj-1',
    usageDate: '2026-05-13',
    hoursUsed: 6,
    availableHours: 8,
    ...o,
  };
}

describe('EquipmentRepository async (InMemory mode)', () => {
  let repo: EquipmentRepository;

  beforeEach(() => {
    repo = new EquipmentRepository(false);
  });

  it('saveRentalAsync→getRentalAsync', async () => {
    await repo.saveRentalAsync(makeRental({ vendor: 'アクティオ' }));
    const found = await repo.getRentalAsync('r-1');
    expect(found?.itemName).toBe('高所作業車');
    expect(found?.vendor).toBe('アクティオ');
  });

  it('listRentalsByProjectAsync がフィルタする', async () => {
    await repo.saveRentalAsync(makeRental({ id: 'r-1', projectId: 'A' }));
    await repo.saveRentalAsync(makeRental({ id: 'r-2', projectId: 'B' }));
    const list = await repo.listRentalsByProjectAsync('A');
    expect(list).toHaveLength(1);
  });

  it('returned 状態と actualReturnDate を保持', async () => {
    await repo.saveRentalAsync(
      makeRental({
        status: 'returned',
        actualReturnDate: '2026-05-19',
      }),
    );
    const found = await repo.getRentalAsync('r-1');
    expect(found?.status).toBe('returned');
    expect(found?.actualReturnDate).toBe('2026-05-19');
  });

  it('deleteRentalAsync は true/false を返す', async () => {
    await repo.saveRentalAsync(makeRental());
    expect(await repo.deleteRentalAsync('r-1')).toBe(true);
    expect(await repo.deleteRentalAsync('r-1')).toBe(false);
  });

  it('listUsageByRentalAsync が rentalId でフィルタする', async () => {
    await repo.saveUsageAsync(makeUsage({ id: 'u-1', rentalId: 'r-1' }));
    await repo.saveUsageAsync(makeUsage({ id: 'u-2', rentalId: 'r-2' }));
    const list = await repo.listUsageByRentalAsync('r-1');
    expect(list).toHaveLength(1);
  });

  it('saveUsageAsync で hoursUsed が保持される', async () => {
    await repo.saveUsageAsync(makeUsage({ hoursUsed: 7.5 }));
    const list = await repo.listUsageByRentalAsync('r-1');
    expect(list[0]?.hoursUsed).toBe(7.5);
  });

  it('deleteUsageAsync は true/false を返す', async () => {
    await repo.saveUsageAsync(makeUsage());
    expect(await repo.deleteUsageAsync('u-1')).toBe(true);
    expect(await repo.deleteUsageAsync('u-1')).toBe(false);
  });
});
