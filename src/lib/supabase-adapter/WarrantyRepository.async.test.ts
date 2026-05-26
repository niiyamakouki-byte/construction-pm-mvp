import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { WarrantyRepository } from './WarrantyRepository.js';
import type {
  WarrantyItemRecord,
  WarrantyClaimRecord,
} from './WarrantyRepository.js';

function makeItem(o: Partial<WarrantyItemRecord> = {}): WarrantyItemRecord {
  return {
    id: 'w-1',
    projectId: 'proj-1',
    assetName: 'エアコン',
    category: '空調設備',
    vendorName: 'ダイキン',
    startDate: '2026-05-13',
    expiryDate: '2031-05-12',
    ...o,
  };
}

function makeClaim(o: Partial<WarrantyClaimRecord> = {}): WarrantyClaimRecord {
  return {
    id: 'wc-1',
    warrantyItemId: 'w-1',
    claimDate: '2026-06-01',
    issue: '冷えない',
    status: 'submitted',
    ...o,
  };
}

describe('WarrantyRepository async (InMemory mode)', () => {
  let repo: WarrantyRepository;

  beforeEach(() => {
    repo = new WarrantyRepository(false);
  });

  it('saveItemAsync→getItemAsync', async () => {
    await repo.saveItemAsync(
      makeItem({
        warrantyTerms: '5年無償修理',
        serialNumber: 'SN-12345',
      }),
    );
    const found = await repo.getItemAsync('w-1');
    expect(found?.assetName).toBe('エアコン');
    expect(found?.warrantyTerms).toBe('5年無償修理');
    expect(found?.serialNumber).toBe('SN-12345');
  });

  it('listItemsByProjectAsync がフィルタする', async () => {
    await repo.saveItemAsync(makeItem({ id: 'w-1', projectId: 'A' }));
    await repo.saveItemAsync(makeItem({ id: 'w-2', projectId: 'B' }));
    expect((await repo.listItemsByProjectAsync('A')).length).toBe(1);
  });

  it('expiryDate を含む更新が反映される', async () => {
    await repo.saveItemAsync(makeItem());
    await repo.saveItemAsync(makeItem({ expiryDate: '2033-05-12' }));
    const found = await repo.getItemAsync('w-1');
    expect(found?.expiryDate).toBe('2033-05-12');
  });

  it('deleteItemAsync は true/false を返す', async () => {
    await repo.saveItemAsync(makeItem());
    expect(await repo.deleteItemAsync('w-1')).toBe(true);
    expect(await repo.deleteItemAsync('w-1')).toBe(false);
  });

  it('saveClaimAsync→listClaimsByItemAsync が warranty item でフィルタ', async () => {
    await repo.saveClaimAsync(makeClaim({ id: 'wc-1', warrantyItemId: 'w-1' }));
    await repo.saveClaimAsync(makeClaim({ id: 'wc-2', warrantyItemId: 'w-2' }));
    const list = await repo.listClaimsByItemAsync('w-1');
    expect(list).toHaveLength(1);
  });

  it('warranty claim resolved 状態と resolutionNotes が保持される', async () => {
    await repo.saveClaimAsync(
      makeClaim({
        status: 'resolved',
        resolutionNotes: '基板交換で対応',
      }),
    );
    const list = await repo.listClaimsByItemAsync('w-1');
    expect(list[0]?.status).toBe('resolved');
    expect(list[0]?.resolutionNotes).toBe('基板交換で対応');
  });

  it('deleteClaimAsync は true/false を返す', async () => {
    await repo.saveClaimAsync(makeClaim());
    expect(await repo.deleteClaimAsync('wc-1')).toBe(true);
    expect(await repo.deleteClaimAsync('wc-1')).toBe(false);
  });
});
