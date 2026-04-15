import { describe, it, expect, beforeEach } from 'vitest';
import { RoomRepository } from './RoomRepository.js';
import type { RoomRecord } from './RoomRepository.js';

function makeRoom(id = 'r-1', projectId = 'p-1'): RoomRecord {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    name: 'リビング',
    floor: 1,
    area: 25.5,
    createdAt: now,
    updatedAt: now,
  };
}

describe('RoomRepository async aliases (Phase A)', () => {
  let repo: RoomRepository;

  beforeEach(() => {
    repo = new RoomRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const r = makeRoom();
    repo.save(r);
    const sync = repo.get('r-1');
    const async_ = await repo.getAsync('r-1');
    expect(async_).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    repo.save(makeRoom('r-1'));
    repo.save(makeRoom('r-2'));
    const sync = repo.list();
    const async_ = await repo.listAsync();
    expect(async_).toEqual(sync);
    expect(async_).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const r = makeRoom();
    await repo.saveAsync(r);
    const found = await repo.getAsync('r-1');
    expect(found?.name).toBe('リビング');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    repo.save(makeRoom());
    const deleted = await repo.deleteAsync('r-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('r-1')).toBeNull();
  });
});
