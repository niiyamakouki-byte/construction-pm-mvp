import { describe, it, expect, beforeEach } from 'vitest';
import { InvoiceRepository } from './InvoiceRepository.js';
import type { InvoiceRecord } from './InvoiceRepository.js';

const baseInvoiceData: Omit<InvoiceRecord, 'id'> = {
  projectId: 'proj-1',
  vendorName: '田中工務店',
  vendorContact: '田中太郎',
  amount: 100000,
  tax: 10000,
  total: 110000,
  items: [{ description: '内装工事', quantity: 1, unitPrice: 100000, amount: 100000 }],
  bankInfo: '三菱UFJ銀行',
  invoiceDate: '2026-04-01',
  dueDate: '2026-04-30',
  status: '未確認',
};

describe('InvoiceRepository async aliases (Phase A)', () => {
  let repo: InvoiceRepository;

  beforeEach(() => {
    repo = new InvoiceRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const inv = repo.add(baseInvoiceData);
    const sync = repo.get(inv.id);
    const result = await repo.getAsync(inv.id);
    expect(result).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    repo.add(baseInvoiceData);
    repo.add({ ...baseInvoiceData, vendorName: '山田建設' });
    const sync = repo.list();
    const result = await repo.listAsync();
    expect(result).toEqual(sync);
    expect(result).toHaveLength(2);
  });

  it('addAsync で請求書を追加し getAsync で取得できる', async () => {
    const inv = await repo.addAsync(baseInvoiceData);
    expect(inv.id).toMatch(/^inv-/);
    const found = await repo.getAsync(inv.id);
    expect(found?.vendorName).toBe('田中工務店');
    expect(found?.total).toBe(110000);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const inv = repo.add(baseInvoiceData);
    await repo.saveAsync({ ...inv, status: '振込済' });
    const found = await repo.getAsync(inv.id);
    expect(found?.status).toBe('振込済');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    const inv = repo.add(baseInvoiceData);
    const deleted = await repo.deleteAsync(inv.id);
    expect(deleted).toBe(true);
    expect(await repo.getAsync(inv.id)).toBeNull();
  });

  it('存在しない id の deleteAsync は false を返す', async () => {
    expect(await repo.deleteAsync('nonexistent')).toBe(false);
  });

  it('addAsync で追加した複数請求書を listAsync で全件取得できる', async () => {
    await repo.addAsync(baseInvoiceData);
    await repo.addAsync({ ...baseInvoiceData, projectId: 'proj-2' });
    const all = await repo.listAsync();
    expect(all).toHaveLength(2);
  });
});
