import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { SiteEntryRepository } from './SiteEntryRepository.js';
import type { SiteEntryRecord } from './SiteEntryRepository.js';

function makeRecord(overrides: Partial<SiteEntryRecord> = {}): SiteEntryRecord {
  return {
    id: 'entry-1',
    projectId: 'proj-1',
    workerName: '山田太郎',
    company: 'ラポルタ',
    entryTime: '2026-05-13T09:00:00.000Z',
    ...overrides,
  };
}

describe('SiteEntryRepository async (InMemory mode)', () => {
  let repo: SiteEntryRepository;

  beforeEach(() => {
    repo = new SiteEntryRepository(false);
  });

  it('save→get で永続化と取得ができる', async () => {
    await repo.saveAsync(makeRecord());
    const found = await repo.getAsync('entry-1');
    expect(found?.workerName).toBe('山田太郎');
  });

  it('getAsync は存在しない id で null', async () => {
    expect(await repo.getAsync('nope')).toBeNull();
  });

  it('listAsync が全件返す', async () => {
    await repo.saveAsync(makeRecord({ id: 'e-1' }));
    await repo.saveAsync(makeRecord({ id: 'e-2' }));
    expect((await repo.listAsync()).length).toBe(2);
  });

  it('listByProjectAsync がプロジェクトでフィルタする', async () => {
    await repo.saveAsync(makeRecord({ id: 'e-1', projectId: 'A' }));
    await repo.saveAsync(makeRecord({ id: 'e-2', projectId: 'B' }));
    const list = await repo.listByProjectAsync('A');
    expect(list).toHaveLength(1);
    expect(list[0]?.projectId).toBe('A');
  });

  it('listByProjectAsync が日付で絞り込む', async () => {
    await repo.saveAsync(
      makeRecord({ id: 'e-1', entryTime: '2026-05-13T09:00:00.000Z' }),
    );
    await repo.saveAsync(
      makeRecord({ id: 'e-2', entryTime: '2026-05-14T09:00:00.000Z' }),
    );
    const list = await repo.listByProjectAsync('proj-1', '2026-05-13');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('e-1');
  });

  it('exitTime を含む更新が反映される', async () => {
    await repo.saveAsync(makeRecord());
    await repo.saveAsync(
      makeRecord({ exitTime: '2026-05-13T18:00:00.000Z' }),
    );
    const found = await repo.getAsync('entry-1');
    expect(found?.exitTime).toBe('2026-05-13T18:00:00.000Z');
  });

  it('deleteAsync は true/false を返す', async () => {
    await repo.saveAsync(makeRecord());
    expect(await repo.deleteAsync('entry-1')).toBe(true);
    expect(await repo.deleteAsync('entry-1')).toBe(false);
  });

  it('新フィールド jobType / startPhotoId / endPhotoId / taskId の往復', async () => {
    await repo.saveAsync(
      makeRecord({
        jobType: '電気',
        startPhotoId: 'photo-start-1',
        endPhotoId: 'photo-end-1',
        taskId: 'task-1',
      }),
    );
    const found = await repo.getAsync('entry-1');
    expect(found?.jobType).toBe('電気');
    expect(found?.startPhotoId).toBe('photo-start-1');
    expect(found?.endPhotoId).toBe('photo-end-1');
    expect(found?.taskId).toBe('task-1');
  });

  it('新フィールドが undefined の場合は省略される', async () => {
    await repo.saveAsync(makeRecord());
    const found = await repo.getAsync('entry-1');
    expect(found?.jobType).toBeUndefined();
    expect(found?.startPhotoId).toBeUndefined();
    expect(found?.endPhotoId).toBeUndefined();
    expect(found?.taskId).toBeUndefined();
  });
});
