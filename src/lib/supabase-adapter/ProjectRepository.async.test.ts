import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectRepository } from './ProjectRepository.js';
import type { StoreProject } from '../store.js';

function makeProject(id = 'p-1'): StoreProject {
  const now = new Date().toISOString();
  return {
    id,
    name: '南青山内装工事',
    description: 'テスト',
    status: 'planning',
    startDate: '2025-04-01',
    includeWeekends: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('ProjectRepository async aliases (Phase A)', () => {
  let repo: ProjectRepository;

  beforeEach(() => {
    repo = new ProjectRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const p = makeProject();
    await repo.saveAsync(p);
    const sync = await repo.getAsync('p-1');
    const async_ = await repo.getAsync('p-1');
    expect(async_).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    await repo.saveAsync(makeProject('p-1'));
    await repo.saveAsync(makeProject('p-2'));
    const sync = await repo.listAsync();
    const async_ = await repo.listAsync();
    expect(async_).toEqual(sync);
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const p = makeProject();
    await repo.saveAsync(p);
    const found = await repo.getAsync('p-1');
    expect(found?.name).toBe('南青山内装工事');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    await repo.saveAsync(makeProject());
    const deleted = await repo.deleteAsync('p-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('p-1')).toBeNull();
  });
});
