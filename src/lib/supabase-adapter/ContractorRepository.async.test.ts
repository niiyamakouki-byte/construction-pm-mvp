import { describe, it, expect, beforeEach } from 'vitest';
import { ContractorRepository } from './ContractorRepository.js';
import type { ContractorRecord } from './ContractorRepository.js';

function makeContractor(id = 'c-1'): ContractorRecord {
  const now = new Date().toISOString();
  return {
    id,
    name: '山田内装工業',
    trade: '内装',
    phone: '03-1234-5678',
    email: 'yamada@example.com',
    createdAt: now,
    updatedAt: now,
  };
}

describe('ContractorRepository async aliases (Phase A)', () => {
  let repo: ContractorRepository;

  beforeEach(() => {
    repo = new ContractorRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const c = makeContractor();
    await repo.saveAsync(c);
    const sync = await repo.getAsync('c-1');
    const async_ = await repo.getAsync('c-1');
    expect(async_).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    await repo.saveAsync(makeContractor('c-1'));
    await repo.saveAsync(makeContractor('c-2'));
    const sync = await repo.listAsync();
    const async_ = await repo.listAsync();
    expect(async_).toEqual(sync);
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const c = makeContractor();
    await repo.saveAsync(c);
    const found = await repo.getAsync('c-1');
    expect(found?.name).toBe('山田内装工業');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    await repo.saveAsync(makeContractor());
    const deleted = await repo.deleteAsync('c-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('c-1')).toBeNull();
  });
});
