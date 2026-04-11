import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '../lib/repository/index.js';

type TestItem = {
  id: string;
  name: string;
  value: number;
};

describe('InMemoryRepository (src/lib/repository)', () => {
  let repo: InMemoryRepository<TestItem>;

  beforeEach(() => {
    repo = new InMemoryRepository<TestItem>();
  });

  it('create でアイテムを生成してidを付与する', async () => {
    const item = await repo.create({ name: 'テスト', value: 42 });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('テスト');
    expect(item.value).toBe(42);
  });

  it('getById で作成したアイテムを取得できる', async () => {
    const created = await repo.create({ name: 'アイテムA', value: 1 });
    const found = await repo.getById(created.id);
    expect(found).toEqual(created);
  });

  it('getById で存在しないidはnullを返す', async () => {
    const result = await repo.getById('no-such-id');
    expect(result).toBeNull();
  });

  it('getAll で全件取得できる', async () => {
    await repo.create({ name: 'A', value: 1 });
    await repo.create({ name: 'B', value: 2 });
    await repo.create({ name: 'C', value: 3 });
    const all = await repo.getAll();
    expect(all).toHaveLength(3);
  });

  it('getAll で空のリポジトリは空配列を返す', async () => {
    const all = await repo.getAll();
    expect(all).toEqual([]);
  });

  it('update でフィールドを更新できる', async () => {
    const created = await repo.create({ name: '変更前', value: 10 });
    const updated = await repo.update(created.id, { name: '変更後' });
    expect(updated.name).toBe('変更後');
    expect(updated.value).toBe(10);
    expect(updated.id).toBe(created.id);
  });

  it('update でgetByIdにも反映される', async () => {
    const created = await repo.create({ name: '元の名前', value: 5 });
    await repo.update(created.id, { value: 99 });
    const found = await repo.getById(created.id);
    expect(found?.value).toBe(99);
  });

  it('update で存在しないidはエラーを投げる', async () => {
    await expect(repo.update('ghost', { name: 'x' })).rejects.toThrow('not found');
  });

  it('delete でアイテムを削除できる', async () => {
    const created = await repo.create({ name: '削除対象', value: 0 });
    await repo.delete(created.id);
    const found = await repo.getById(created.id);
    expect(found).toBeNull();
  });

  it('delete でgetAllから消える', async () => {
    const a = await repo.create({ name: 'A', value: 1 });
    await repo.create({ name: 'B', value: 2 });
    await repo.delete(a.id);
    const all = await repo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('B');
  });

  it('delete で存在しないidはエラーを投げる', async () => {
    await expect(repo.delete('no-such-id')).rejects.toThrow('not found');
  });

  it('getById の返り値変更がストアに影響しない（深いコピー）', async () => {
    const created = await repo.create({ name: '元', value: 1 });
    const found = await repo.getById(created.id);
    found!.name = '改ざん';
    const again = await repo.getById(created.id);
    expect(again!.name).toBe('元');
  });

  it('getAll の返り値変更がストアに影響しない（深いコピー）', async () => {
    await repo.create({ name: '元', value: 1 });
    const all = await repo.getAll();
    all[0].name = '改ざん';
    const fresh = await repo.getAll();
    expect(fresh[0].name).toBe('元');
  });

  it('複数create→update→deleteの連続操作が整合する', async () => {
    const a = await repo.create({ name: 'A', value: 1 });
    const b = await repo.create({ name: 'B', value: 2 });
    await repo.update(a.id, { value: 100 });
    await repo.delete(b.id);
    const all = await repo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(a.id);
    expect(all[0].value).toBe(100);
  });
});
