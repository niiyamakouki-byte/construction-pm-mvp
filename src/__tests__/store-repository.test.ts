import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '../lib/repository/index.js';
import {
  getProjects,
  addProject,
  updateProject,
  deleteProject,
  getProject,
  _resetProjectStore,
  type StoreProject,
} from '../lib/store.js';

function makeProject(overrides: Partial<StoreProject> = {}): StoreProject {
  const now = new Date().toISOString();
  return {
    id: 'p-1',
    name: '南青山内装工事',
    description: 'テスト用プロジェクト',
    status: 'planning',
    startDate: '2025-04-01',
    includeWeekends: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── projectRepository (InMemoryRepository) CRUD tests ──────────────────────

describe('projectRepository CRUD', () => {
  let repo: InMemoryRepository<StoreProject>;

  beforeEach(() => {
    repo = new InMemoryRepository<StoreProject>();
  });

  it('create でアイテムを生成してidを付与する', async () => {
    const { id: _id, ...input } = makeProject({ id: 'ignored' });
    void _id;
    const created = await repo.create(input);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('南青山内装工事');
  });

  it('getById で作成したアイテムを取得できる', async () => {
    const { id: _id, ...input } = makeProject();
    void _id;
    const created = await repo.create(input);
    const found = await repo.getById(created.id);
    expect(found).toEqual(created);
  });

  it('getAll で全件取得できる', async () => {
    const { id: _id1, ...input1 } = makeProject({ name: 'プロジェクトA' });
    void _id1;
    const { id: _id2, ...input2 } = makeProject({ name: 'プロジェクトB' });
    void _id2;
    await repo.create(input1);
    await repo.create(input2);
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
  });

  it('update でフィールドを更新できる', async () => {
    const { id: _id, ...input } = makeProject();
    void _id;
    const created = await repo.create(input);
    const updated = await repo.update(created.id, { status: 'active' });
    expect(updated.status).toBe('active');
    expect(updated.name).toBe('南青山内装工事');
  });

  it('delete でアイテムを削除できる', async () => {
    const { id: _id, ...input } = makeProject();
    void _id;
    const created = await repo.create(input);
    await repo.delete(created.id);
    const found = await repo.getById(created.id);
    expect(found).toBeNull();
  });

  it('delete で存在しないidはエラーを投げる', async () => {
    await expect(repo.delete('no-such-id')).rejects.toThrow('not found');
  });

  it('update で存在しないidはエラーを投げる', async () => {
    await expect(repo.update('ghost', { name: 'x' })).rejects.toThrow('not found');
  });

  it('getById の返り値を変更してもストアに影響しない（深いコピー）', async () => {
    const { id: _id, ...input } = makeProject({ name: '元の名前' });
    void _id;
    const created = await repo.create(input);
    const found = await repo.getById(created.id);
    found!.name = '改ざん';
    const again = await repo.getById(created.id);
    expect(again!.name).toBe('元の名前');
  });
});

// ── 既存store関数との整合性テスト ─────────────────────────────────────────

describe('store functions (Map-based)', () => {
  beforeEach(() => _resetProjectStore());

  it('addProject → getProject で取得できる', () => {
    const p = makeProject();
    addProject(p);
    expect(getProject('p-1')).toEqual(p);
  });

  it('getProjects で全件取得できる', () => {
    addProject(makeProject({ id: 'p-1', name: 'A工事' }));
    addProject(makeProject({ id: 'p-2', name: 'B工事' }));
    expect(getProjects()).toHaveLength(2);
  });

  it('updateProject でフィールドが更新される', () => {
    addProject(makeProject());
    const updated = updateProject('p-1', { status: 'active' });
    expect(updated?.status).toBe('active');
    expect(getProject('p-1')?.status).toBe('active');
  });

  it('updateProject で存在しないidはnullを返す', () => {
    expect(updateProject('ghost', { name: 'X' })).toBeNull();
  });

  it('deleteProject でアイテムを削除できる', () => {
    addProject(makeProject());
    expect(deleteProject('p-1')).toBe(true);
    expect(getProject('p-1')).toBeUndefined();
  });

  it('deleteProject で存在しないidはfalseを返す', () => {
    expect(deleteProject('no-such')).toBe(false);
  });

  it('store関数とrepositoryは独立したストアを持つ', async () => {
    // Map-based storeに追加
    addProject(makeProject({ id: 'p-1', name: 'store側' }));
    // repositoryには追加しない
    const repo = new InMemoryRepository<StoreProject>();
    const repoAll = await repo.getAll();
    expect(repoAll).toHaveLength(0);
    // store側は1件
    expect(getProjects()).toHaveLength(1);
  });
});
