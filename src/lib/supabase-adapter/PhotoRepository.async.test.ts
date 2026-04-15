import { describe, it, expect, beforeEach } from 'vitest';
import { PhotoRepository } from './PhotoRepository.js';
import type { PhotoRecord } from './PhotoRepository.js';

function makePhoto(id = 'ph-1', projectId = 'p-1'): PhotoRecord {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    fileName: '施工前.jpg',
    category: '施工前',
    url: 'https://example.com/施工前.jpg',
    createdAt: now,
    updatedAt: now,
  };
}

describe('PhotoRepository async aliases (Phase A)', () => {
  let repo: PhotoRepository;

  beforeEach(() => {
    repo = new PhotoRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const p = makePhoto();
    repo.save(p);
    const sync = repo.get('ph-1');
    const async_ = await repo.getAsync('ph-1');
    expect(async_).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    repo.save(makePhoto('ph-1'));
    repo.save(makePhoto('ph-2'));
    const sync = repo.list();
    const async_ = await repo.listAsync();
    expect(async_).toEqual(sync);
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const p = makePhoto();
    await repo.saveAsync(p);
    const found = await repo.getAsync('ph-1');
    expect(found?.fileName).toBe('施工前.jpg');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    repo.save(makePhoto());
    const deleted = await repo.deleteAsync('ph-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('ph-1')).toBeNull();
  });
});
