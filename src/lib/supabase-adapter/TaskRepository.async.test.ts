import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRepository } from './TaskRepository.js';
import type { Task } from './TaskRepository.js';

function makeTask(id = 't-1', projectId = 'p-1'): Task {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    name: '内装工事タスク',
    description: 'テスト',
    status: 'todo',
    progress: 0,
    isMilestone: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('TaskRepository async aliases (Phase A)', () => {
  let repo: TaskRepository;

  beforeEach(() => {
    repo = new TaskRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const t = makeTask();
    repo.save(t);
    const sync = repo.get('t-1');
    const async_ = await repo.getAsync('t-1');
    expect(async_).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    repo.save(makeTask('t-1'));
    repo.save(makeTask('t-2'));
    const sync = repo.list();
    const async_ = await repo.listAsync();
    expect(async_).toEqual(sync);
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const t = makeTask();
    await repo.saveAsync(t);
    const found = await repo.getAsync('t-1');
    expect(found?.name).toBe('内装工事タスク');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    repo.save(makeTask());
    const deleted = await repo.deleteAsync('t-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('t-1')).toBeNull();
  });
});
