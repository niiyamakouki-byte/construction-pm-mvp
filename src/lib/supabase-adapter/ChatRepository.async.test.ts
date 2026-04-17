import { describe, it, expect, beforeEach } from 'vitest';
import { ChatRepository } from './ChatRepository.js';
import type { ChatMessageRecord } from './ChatRepository.js';

function makeMessage(overrides: Partial<ChatMessageRecord> = {}): ChatMessageRecord {
  return {
    id: 'chat-1',
    projectId: 'proj-1',
    userId: 'user-1',
    userName: '新山',
    content: 'こんにちは',
    timestamp: new Date().toISOString(),
    type: 'text',
    readBy: [],
    ...overrides,
  };
}

describe('ChatRepository async aliases (Phase A)', () => {
  let repo: ChatRepository;

  beforeEach(() => {
    repo = new ChatRepository();
  });

  it('getAsync は同期 get と同じ結果を返す', async () => {
    const msg = makeMessage();
    await repo.saveAsync(msg);
    const sync = await repo.getAsync('chat-1');
    const result = await repo.getAsync('chat-1');
    expect(result).toEqual(sync);
  });

  it('listAsync は同期 list と同じ結果を返す', async () => {
    await repo.saveAsync(makeMessage({ id: 'chat-1' }));
    await repo.saveAsync(makeMessage({ id: 'chat-2' }));
    const sync = await repo.listAsync();
    const result = await repo.listAsync();
    expect(result).toEqual(sync);
    expect(result).toHaveLength(2);
  });

  it('listByProjectAsync はプロジェクト別にフィルタする', async () => {
    repo.save(makeMessage({ id: 'chat-1', projectId: 'proj-1' }));
    repo.save(makeMessage({ id: 'chat-2', projectId: 'proj-2' }));
    const result = await repo.listByProjectAsync('proj-1');
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe('proj-1');
  });

  it('addAsync でメッセージを追加し getAsync で取得できる', async () => {
    const msg = await repo.addAsync('proj-1', 'user-1', '新山', 'テストメッセージ');
    const found = await repo.getAsync(msg.id);
    expect(found?.content).toBe('テストメッセージ');
    expect(found?.type).toBe('text');
  });

  it('addAsync は attachments を保持する', async () => {
    const msg = await repo.addAsync('proj-1', 'u1', 'A', 'see file', ['図面.pdf']);
    expect(msg.attachments).toEqual(['図面.pdf']);
  });

  it('saveAsync でデータを永続化し getAsync で取得できる', async () => {
    const msg = makeMessage({ content: '更新済み' });
    await repo.saveAsync(msg);
    const found = await repo.getAsync('chat-1');
    expect(found?.content).toBe('更新済み');
  });

  it('deleteAsync で削除後に getAsync が null を返す', async () => {
    await repo.saveAsync(makeMessage());
    const deleted = await repo.deleteAsync('chat-1');
    expect(deleted).toBe(true);
    expect(await repo.getAsync('chat-1')).toBeNull();
  });

  it('存在しない id の deleteAsync は false を返す', async () => {
    expect(await repo.deleteAsync('nonexistent')).toBe(false);
  });
});
