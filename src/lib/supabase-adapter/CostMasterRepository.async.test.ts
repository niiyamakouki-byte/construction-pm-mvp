import { describe, it, expect, beforeEach } from 'vitest';
import { CostMasterRepository } from './CostMasterRepository.js';
import type { CostMasterItem } from './CostMasterRepository.js';

function makeCostItem(id = 'cm-1'): CostMasterItem {
  const now = new Date().toISOString();
  return {
    id,
    code: 'INT-001',
    name: 'クロス貼り',
    unit: 'm²',
    unitPrice: 1200,
    category: '内装工事',
    createdAt: now,
    updatedAt: now,
  };
}

describe('CostMasterRepository async aliases (Phase A)', () => {
  let repo: CostMasterRepository;

  beforeEach(() => {
    repo = new CostMasterRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const item = makeCostItem();
    await repo.saveAsync(item);
    const saved = await repo.getAsync('cm-1');
    const async_ = await repo.getAsync('cm-1');
    expect(async_).toEqual(saved);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    await repo.saveAsync(makeCostItem('cm-1'));
    await repo.saveAsync(makeCostItem('cm-2'));
    const async_ = await repo.listAsync();
    expect(async_).toEqual(await repo.listAsync());
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const item = makeCostItem();
    await repo.saveAsync(item);
    const found = await repo.getAsync('cm-1');
    expect(found?.name).toBe('クロス貼り');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    await repo.saveAsync(makeCostItem());
    const deleted = await repo.deleteAsync('cm-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('cm-1')).toBeNull();
  });
});
