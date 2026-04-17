import { describe, it, expect, beforeEach } from 'vitest';
import { CRMRepository } from './CRMRepository.js';
import type { CustomerRecord, DealRecord } from './CRMRepository.js';

function makeCustomer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: 'c-1',
    name: '田中 太郎',
    company: '田中建設',
    phone: '03-1234-5678',
    email: 'tanaka@example.com',
    address: '東京都港区',
    note: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  const now = new Date().toISOString();
  return {
    id: 'd-1',
    customerId: 'c-1',
    projectName: '南青山内装工事',
    stage: '引合',
    estimatedAmount: 5000000,
    actualAmount: null,
    probability: 20,
    expectedCloseDate: '2025-06-30',
    note: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CRMRepository async aliases (Phase A)', () => {
  let repo: CRMRepository;

  beforeEach(() => {
    repo = new CRMRepository();
  });

  // Customer async
  it('getCustomerAsync は同期 getCustomer と同じ結果を返す', async () => {
    const c = makeCustomer();
    repo.saveCustomer(c);
    const sync = repo.getCustomer('c-1');
    const result = await repo.getCustomerAsync('c-1');
    expect(result).toEqual(sync);
  });

  it('listCustomersAsync は同期 listCustomers と同じ結果を返す', async () => {
    repo.saveCustomer(makeCustomer({ id: 'c-1' }));
    repo.saveCustomer(makeCustomer({ id: 'c-2' }));
    const sync = repo.listCustomers();
    const result = await repo.listCustomersAsync();
    expect(result).toEqual(sync);
    expect(result).toHaveLength(2);
  });

  it('saveCustomerAsync でデータを永続化し getCustomerAsync で取得できる', async () => {
    const c = makeCustomer();
    await repo.saveCustomerAsync(c);
    const found = await repo.getCustomerAsync('c-1');
    expect(found?.name).toBe('田中 太郎');
  });

  it('deleteCustomerAsync で削除後に getCustomerAsync が null を返す', async () => {
    repo.saveCustomer(makeCustomer());
    const deleted = await repo.deleteCustomerAsync('c-1');
    expect(deleted).toBe(true);
    expect(await repo.getCustomerAsync('c-1')).toBeNull();
  });

  it('存在しない顧客の deleteCustomerAsync は false を返す', async () => {
    expect(await repo.deleteCustomerAsync('nonexistent')).toBe(false);
  });

  // Deal async
  it('getDealAsync は同期 getDeal と同じ結果を返す', async () => {
    const d = makeDeal();
    repo.saveDeal(d);
    const sync = repo.getDeal('d-1');
    const result = await repo.getDealAsync('d-1');
    expect(result).toEqual(sync);
  });

  it('listDealsAsync は同期 listDeals と同じ結果を返す', async () => {
    repo.saveDeal(makeDeal({ id: 'd-1' }));
    repo.saveDeal(makeDeal({ id: 'd-2' }));
    const sync = repo.listDeals();
    const result = await repo.listDealsAsync();
    expect(result).toEqual(sync);
    expect(result).toHaveLength(2);
  });

  it('saveDealAsync でデータを永続化し getDealAsync で取得できる', async () => {
    const d = makeDeal();
    await repo.saveDealAsync(d);
    const found = await repo.getDealAsync('d-1');
    expect(found?.projectName).toBe('南青山内装工事');
  });

  it('deleteDealAsync で削除後に getDealAsync が null を返す', async () => {
    repo.saveDeal(makeDeal());
    const deleted = await repo.deleteDealAsync('d-1');
    expect(deleted).toBe(true);
    expect(await repo.getDealAsync('d-1')).toBeNull();
  });

  it('存在しない案件の deleteDealAsync は false を返す', async () => {
    expect(await repo.deleteDealAsync('nonexistent')).toBe(false);
  });
});
