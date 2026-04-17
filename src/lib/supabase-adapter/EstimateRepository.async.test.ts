import { describe, it, expect, beforeEach } from 'vitest';
import { EstimateRepository } from './EstimateRepository.js';
import type { EstimateRecord } from './EstimateRepository.js';

function makeEstimate(id = 'e-1', projectId = 'p-1'): EstimateRecord {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    propertyName: 'KDX南青山',
    clientName: 'テスト顧客',
    totalAmount: 9460000,
    taxRate: 0.1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

describe('EstimateRepository async aliases (Phase A)', () => {
  let repo: EstimateRepository;

  beforeEach(() => {
    repo = new EstimateRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const e = makeEstimate();
    await repo.saveAsync(e);
    const saved = await repo.getAsync('e-1');
    const async_ = await repo.getAsync('e-1');
    expect(async_).toEqual(saved);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    await repo.saveAsync(makeEstimate('e-1'));
    await repo.saveAsync(makeEstimate('e-2'));
    const async_ = await repo.listAsync();
    expect(async_).toEqual(await repo.listAsync());
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const e = makeEstimate();
    await repo.saveAsync(e);
    const found = await repo.getAsync('e-1');
    expect(found?.propertyName).toBe('KDX南青山');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    await repo.saveAsync(makeEstimate());
    const deleted = await repo.deleteAsync('e-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('e-1')).toBeNull();
  });
});
