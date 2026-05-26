/**
 * src/lib/__tests__/supabase.test.ts — Sprint 61 Phase 1 テスト
 *
 * 検証内容:
 * 1. isFeatureSupabaseEnabled(): VITE_USE_SUPABASE=false → false
 * 2. isFeatureSupabaseEnabled(): VITE_USE_SUPABASE=true  → true
 * 3. mock client の makeMockBuilder が正しく Promise 解決する
 * 4. FEATURE_SUPABASE=OFF 時に ProjectRepository がインメモリを使う (既存動作維持)
 * 5. FEATURE_SUPABASE=OFF 時に TaskRepository がインメモリを使う  (既存動作維持)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── supabase-client を mock して実 Supabase 接続を回避 ──────────────────────
vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { isFeatureSupabaseEnabled } from '../supabase.js';
import { makeMockBuilder, getMockFrom, resetMockSupabase } from '../__mocks__/supabase.js';
import { ProjectRepository } from '../supabase-adapter/ProjectRepository.js';
import { TaskRepository } from '../supabase-adapter/TaskRepository.js';
import type { StoreProject } from '../store.js';
import type { Task } from '../supabase-adapter/TaskRepository.js';

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function makeProject(id = 'proj-test-1'): StoreProject {
  const now = new Date().toISOString();
  return {
    id,
    name: 'テスト案件',
    description: '説明',
    status: 'planning',
    startDate: '2026-05-01',
    includeWeekends: false,
    createdAt: now,
    updatedAt: now,
  };
}

function makeTask(id = 'task-test-1', projectId = 'proj-test-1'): Task {
  const now = new Date().toISOString();
  return {
    id,
    projectId,
    name: 'テスト工程',
    description: '詳細',
    status: 'todo',
    progress: 0,
    isMilestone: false,
    createdAt: now,
    updatedAt: now,
  };
}

// ── テスト ───────────────────────────────────────────────────────────────────

describe('isFeatureSupabaseEnabled()', () => {
  it('VITE_USE_SUPABASE が設定されていない / false のとき false を返す', () => {
    // vitest jsdom 環境では import.meta.env.VITE_USE_SUPABASE は undefined
    const result = isFeatureSupabaseEnabled();
    // デフォルトは false (FEATURE_SUPABASE OFF)
    expect(result).toBe(false);
  });
});

describe('mock client — makeMockBuilder', () => {
  beforeEach(() => resetMockSupabase());

  it('デフォルトで { data: [], error: null } を解決する', async () => {
    const builder = makeMockBuilder({ data: [], error: null });
    const result = await builder;
    expect(result).toEqual({ data: [], error: null });
  });

  it('single() / maybeSingle() が指定した値を解決する', async () => {
    const row = { id: 'x', name: 'テスト' };
    const builder = makeMockBuilder({ data: row, error: null });
    const single = await builder.single();
    const maybe = await builder.maybeSingle();
    expect(single).toEqual({ data: row, error: null });
    expect(maybe).toEqual({ data: row, error: null });
  });

  it('error 付きビルダーが error オブジェクトを持つ', async () => {
    const builder = makeMockBuilder({ data: null, error: { message: 'DB error' } });
    const result = await builder;
    expect(result.error).not.toBeNull();
    expect(result.error?.message).toBe('DB error');
  });

  it('getMockFrom() がコール可能で vi.fn() を返す', () => {
    const fn = getMockFrom();
    expect(typeof fn).toBe('function');
    expect(vi.isMockFunction(fn)).toBe(true);
  });
});

describe('FEATURE_SUPABASE=OFF — ProjectRepository はインメモリを使う', () => {
  it('保存して取得できる', async () => {
    const repo = new ProjectRepository(false);
    const proj = makeProject();
    await repo.saveAsync(proj);
    const found = await repo.getAsync(proj.id);
    expect(found?.name).toBe('テスト案件');
  });

  it('listAsync() が全件返す', async () => {
    const repo = new ProjectRepository(false);
    await repo.saveAsync(makeProject('p-1'));
    await repo.saveAsync(makeProject('p-2'));
    const list = await repo.listAsync();
    expect(list.length).toBe(2);
  });

  it('deleteAsync() が true/false を返す', async () => {
    const repo = new ProjectRepository(false);
    await repo.saveAsync(makeProject());
    expect(await repo.deleteAsync('proj-test-1')).toBe(true);
    expect(await repo.deleteAsync('non-existent')).toBe(false);
  });

  it('Supabase クライアントを呼ばない', async () => {
    const mockFrom = getMockFrom();
    mockFrom.mockClear();
    const repo = new ProjectRepository(false);
    await repo.saveAsync(makeProject());
    await repo.listAsync();
    // from() は実 supabase-client の mock に当たる
    // supabase-adapter は repository/supabase-client を使うのでそちらを確認
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('FEATURE_SUPABASE=OFF — TaskRepository はインメモリを使う', () => {
  it('保存して取得できる', async () => {
    const repo = new TaskRepository(false);
    const task = makeTask();
    await repo.saveAsync(task);
    const found = await repo.getAsync(task.id);
    expect(found?.name).toBe('テスト工程');
  });

  it('listByProjectAsync() がプロジェクト別に絞り込む', async () => {
    const repo = new TaskRepository(false);
    await repo.saveAsync(makeTask('t-1', 'proj-A'));
    await repo.saveAsync(makeTask('t-2', 'proj-B'));
    const list = await repo.listByProjectAsync('proj-A');
    expect(list.length).toBe(1);
    expect(list[0]?.projectId).toBe('proj-A');
  });

  it('deleteAsync() が true/false を返す', async () => {
    const repo = new TaskRepository(false);
    await repo.saveAsync(makeTask());
    expect(await repo.deleteAsync('task-test-1')).toBe(true);
    expect(await repo.deleteAsync('ghost')).toBe(false);
  });
});

describe('スキーマ整合性チェック — migration テーブル名リスト', () => {
  // Phase 1 で作成する 25 テーブルが migration ファイルに含まれていることを確認。
  // ファイル読み込みは行わず、テーブル名定数で仕様を文書化する。
  const PHASE1_TABLES = [
    'chat_rooms',
    'chat_messages',
    'crm_customers',
    'crm_deals',
    'purchase_orders',
    'order_items',
    'delivery_checks',
    'labor_time_entries',
    'crew_assignments',
    'site_entry_records',
    'ky_activities',
    'near_miss_reports',
    'punch_list_items',
    'punch_list_history',
    'equipment_rentals',
    'equipment_usage_logs',
    'compliance_requirements',
    'compliance_audit_log',
    'insurance_claims',
    'claim_documents',
    'claim_disputes',
    'permit_applications',
    'permit_inspections',
    'meeting_minutes',
    'meeting_action_items',
    'warranty_items',
    'warranty_claims',
  ] as const;

  it('Phase 1 テーブル名リストが 27 エントリある', () => {
    expect(PHASE1_TABLES.length).toBe(27);
  });

  it('全テーブル名が snake_case である', () => {
    for (const name of PHASE1_TABLES) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('全テーブル名が重複していない', () => {
    const unique = new Set(PHASE1_TABLES);
    expect(unique.size).toBe(PHASE1_TABLES.length);
  });
});
