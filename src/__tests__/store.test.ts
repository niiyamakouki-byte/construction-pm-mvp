import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProjects,
  getProject,
  addProject,
  updateProject,
  deleteProject,
  _resetProjectStore,
  type StoreProject,
} from '../lib/store.js';

function makeProject(overrides: Partial<StoreProject> = {}): StoreProject {
  const now = new Date().toISOString();
  return {
    id: 'proj-1',
    name: 'テスト工事',
    description: '説明文',
    status: 'planning',
    startDate: '2025-06-01',
    includeWeekends: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  _resetProjectStore();
});

// ── getProjects ────────────────────────────────────────────────────────────────

describe('getProjects', () => {
  it('初期状態は空配列を返す', () => {
    expect(getProjects()).toEqual([]);
  });

  it('追加したプロジェクトを全件返す', () => {
    addProject(makeProject({ id: 'p-1', name: 'A工事' }));
    addProject(makeProject({ id: 'p-2', name: 'B工事' }));
    expect(getProjects()).toHaveLength(2);
  });
});

// ── getProject ─────────────────────────────────────────────────────────────────

describe('getProject', () => {
  it('存在するidでプロジェクトを返す', () => {
    const p = makeProject();
    addProject(p);
    expect(getProject('proj-1')).toEqual(p);
  });

  it('存在しないidはundefinedを返す', () => {
    expect(getProject('no-such')).toBeUndefined();
  });
});

// ── addProject ─────────────────────────────────────────────────────────────────

describe('addProject', () => {
  it('プロジェクトを追加して返す', () => {
    const p = makeProject();
    const result = addProject(p);
    expect(result).toEqual(p);
    expect(getProject(p.id)).toEqual(p);
  });

  it('同じidで上書きする', () => {
    addProject(makeProject({ id: 'dup', name: '元' }));
    addProject(makeProject({ id: 'dup', name: '上書き' }));
    expect(getProject('dup')?.name).toBe('上書き');
    expect(getProjects()).toHaveLength(1);
  });
});

// ── updateProject ──────────────────────────────────────────────────────────────

describe('updateProject', () => {
  it('ステータスを更新できる', () => {
    addProject(makeProject());
    const updated = updateProject('proj-1', { status: 'active' });
    expect(updated?.status).toBe('active');
    expect(getProject('proj-1')?.status).toBe('active');
  });

  it('updatedAt が更新される', () => {
    const p = makeProject({ updatedAt: '2025-01-01T00:00:00.000Z' });
    addProject(p);
    const updated = updateProject('proj-1', { name: '変更後' });
    expect(updated?.updatedAt).not.toBe('2025-01-01T00:00:00.000Z');
  });

  it('createdAt は変更されない', () => {
    const p = makeProject();
    addProject(p);
    const updated = updateProject('proj-1', { name: '変更後' });
    expect(updated?.createdAt).toBe(p.createdAt);
  });

  it('存在しないidはnullを返す', () => {
    expect(updateProject('ghost', { name: 'x' })).toBeNull();
  });

  it('複数フィールドを同時に更新できる', () => {
    addProject(makeProject());
    const updated = updateProject('proj-1', { name: '新名称', status: 'completed', budget: 5000000 });
    expect(updated?.name).toBe('新名称');
    expect(updated?.status).toBe('completed');
    expect(updated?.budget).toBe(5000000);
  });
});

// ── deleteProject ──────────────────────────────────────────────────────────────

describe('deleteProject', () => {
  it('存在するidを削除してtrueを返す', () => {
    addProject(makeProject());
    expect(deleteProject('proj-1')).toBe(true);
    expect(getProject('proj-1')).toBeUndefined();
  });

  it('削除後はgetProjectsに含まれない', () => {
    addProject(makeProject({ id: 'p-1' }));
    addProject(makeProject({ id: 'p-2' }));
    deleteProject('p-1');
    expect(getProjects()).toHaveLength(1);
    expect(getProjects()[0].id).toBe('p-2');
  });

  it('存在しないidはfalseを返す', () => {
    expect(deleteProject('missing')).toBe(false);
  });
});

// ── _resetProjectStore ─────────────────────────────────────────────────────────

describe('_resetProjectStore', () => {
  it('リセット後は空になる', () => {
    addProject(makeProject({ id: 'p-1' }));
    addProject(makeProject({ id: 'p-2' }));
    _resetProjectStore();
    expect(getProjects()).toEqual([]);
  });
});
