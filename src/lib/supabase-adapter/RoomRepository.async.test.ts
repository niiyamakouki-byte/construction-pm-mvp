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

  it('getAsync でデータを取得できる', async () => {
    const r = makeRoom();
    await repo.saveAsync(r);
    const result = await repo.getAsync('r-1');
    expect(result).toEqual(r);
  });

  it('listAsync は保存したデータを全件返す', async () => {
    await repo.saveAsync(makeRoom('r-1'));
    await repo.saveAsync(makeRoom('r-2'));
    const result = await repo.listAsync();
    expect(result).toHaveLength(2);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const r = makeRoom();
    await repo.saveAsync(r);
    const found = await repo.getAsync('r-1');
    expect(found?.name).toBe('リビング');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    await repo.saveAsync(makeRoom());
    const deleted = await repo.deleteAsync('r-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('r-1')).toBeNull();
  });
});
