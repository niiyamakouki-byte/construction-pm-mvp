import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { SiteEntryRepository } from './SiteEntryRepository.js';
import * as supabaseClient from '../repository/supabase-client.js';

function makeBuilder(terminal: { data: unknown; error: { message: string } | null }) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  const term = () => Promise.resolve(terminal);
  b.select = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.limit = vi.fn(chain);
  b.insert = vi.fn(chain);
  b.update = vi.fn(chain);
  b.delete = vi.fn(chain);
  b.single = vi.fn(term);
  b.maybeSingle = vi.fn(term);
  (b as { then?: unknown }).then = (
    res: (v: unknown) => unknown,
    rej?: (e: unknown) => unknown,
  ) => Promise.resolve(terminal).then(res, rej);
  return b;
}

const mockFrom = (
  supabaseClient as unknown as { supabase: { from: ReturnType<typeof vi.fn> } }
).supabase.from;

describe('SiteEntryRepository — Supabase routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useSupabase=true の getAsync が site_entry_records を参照し camelCase に変換', async () => {
    const row = {
      id: 'e-1',
      project_id: 'p-1',
      worker_name: '山田',
      company_name: 'ラポルタ',
      entry_at: '2026-05-13T09:00:00.000Z',
      exit_at: '2026-05-13T18:00:00.000Z',
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SiteEntryRepository(true);
    const result = await repo.getAsync('e-1');
    expect(mockFrom).toHaveBeenCalledWith('site_entry_records');
    expect(result?.workerName).toBe('山田');
    expect(result?.exitTime).toBe('2026-05-13T18:00:00.000Z');
  });

  it('exit_at=null が exitTime undefined に変換される', async () => {
    const row = {
      id: 'e-1',
      project_id: 'p-1',
      worker_name: '山田',
      company_name: 'ラポルタ',
      entry_at: '2026-05-13T09:00:00.000Z',
      exit_at: null,
    };
    mockFrom.mockReturnValue(makeBuilder({ data: row, error: null }));

    const repo = new SiteEntryRepository(true);
    const result = await repo.getAsync('e-1');
    expect(result?.exitTime).toBeUndefined();
  });

  it('useSupabase=false で Supabase を呼ばない', async () => {
    const repo = new SiteEntryRepository(false);
    await repo.saveAsync({
      id: 'e-1',
      projectId: 'p-1',
      workerName: '山田',
      company: 'ラポルタ',
      entryTime: '2026-05-13T09:00:00.000Z',
    });
    await repo.listAsync();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // 回帰テスト: construction_pm_mvp-g6sf
  // site_entry_records.organization_id は not null 制約付き。新規 insert 時に
  // projects テーブルから organization_id を引いて補うことを検証する。
  it('useSupabase=true で saveAsync (新規) は projects から organization_id を解決して insert に含める', async () => {
    const insertSpy = vi.fn();
    const existingCheckBuilder = makeBuilder({ data: null, error: null });
    const projectLookupBuilder = makeBuilder({
      data: { organization_id: 'org-abc' },
      error: null,
    });
    const createBuilder = makeBuilder({
      data: {
        id: 'e-1',
        project_id: 'p-1',
        organization_id: 'org-abc',
        worker_name: '山田',
        company_name: 'ラポルタ',
        entry_at: '2026-05-13T09:00:00.000Z',
        exit_at: null,
      },
      error: null,
    });
    createBuilder.insert = vi.fn((item: unknown) => {
      insertSpy(item);
      return createBuilder;
    });

    mockFrom
      .mockReturnValueOnce(existingCheckBuilder) // getById(site_entry_records) → 新規
      .mockReturnValueOnce(projectLookupBuilder) // resolveOrganizationId → projects
      .mockReturnValueOnce(createBuilder); // create(site_entry_records)

    const repo = new SiteEntryRepository(true);
    await repo.saveAsync({
      id: 'e-1',
      projectId: 'p-1',
      workerName: '山田',
      company: 'ラポルタ',
      entryTime: '2026-05-13T09:00:00.000Z',
    });

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'projects');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'p-1', organization_id: 'org-abc' }),
    );
  });

  // 本番の実態（2026-07時点）: projects.organization_id は常に未設定。
  // その場合は organizations テーブル（RLSで自組織のみ見える単一テナント運用）にフォールバックする。
  it('projects.organization_id が未設定でも organizations フォールバックで解決して insert する', async () => {
    const insertSpy = vi.fn();
    const existingCheckBuilder = makeBuilder({ data: null, error: null });
    const projectLookupBuilder = makeBuilder({ data: { organization_id: null }, error: null });
    const orgFallbackBuilder = makeBuilder({
      data: { id: '795fb114-c382-41f0-9935-652ca66b9db0' },
      error: null,
    });
    const createBuilder = makeBuilder({
      data: {
        id: 'e-1',
        project_id: 'p-1',
        organization_id: '795fb114-c382-41f0-9935-652ca66b9db0',
        worker_name: '田中',
        company_name: 'ABC建設',
        entry_at: '2026-05-13T09:00:00.000Z',
        exit_at: null,
      },
      error: null,
    });
    createBuilder.insert = vi.fn((item: unknown) => {
      insertSpy(item);
      return createBuilder;
    });

    mockFrom
      .mockReturnValueOnce(existingCheckBuilder) // getById(site_entry_records)
      .mockReturnValueOnce(projectLookupBuilder) // projects.organization_id → null
      .mockReturnValueOnce(orgFallbackBuilder) // organizations フォールバック
      .mockReturnValueOnce(createBuilder); // create(site_entry_records)

    const repo = new SiteEntryRepository(true);
    await repo.saveAsync({
      id: 'e-1',
      projectId: 'p-1',
      workerName: '田中',
      company: 'ABC建設',
      entryTime: '2026-05-13T09:00:00.000Z',
    });

    expect(mockFrom).toHaveBeenNthCalledWith(3, 'organizations');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: '795fb114-c382-41f0-9935-652ca66b9db0',
      }),
    );
  });

  it('projects・organizations どちらからも解決できない場合は null のまま insert を試みる（RLS/not-null は DB 側に委ねる）', async () => {
    const insertSpy = vi.fn();
    const existingCheckBuilder = makeBuilder({ data: null, error: null });
    const projectLookupBuilder = makeBuilder({ data: null, error: null });
    const orgFallbackBuilder = makeBuilder({ data: null, error: null });
    const createBuilder = makeBuilder({ data: null, error: { message: 'not-null violation' } });
    createBuilder.insert = vi.fn((item: unknown) => {
      insertSpy(item);
      return createBuilder;
    });

    mockFrom
      .mockReturnValueOnce(existingCheckBuilder)
      .mockReturnValueOnce(projectLookupBuilder)
      .mockReturnValueOnce(orgFallbackBuilder)
      .mockReturnValueOnce(createBuilder);

    const repo = new SiteEntryRepository(true);
    await expect(
      repo.saveAsync({
        id: 'e-2',
        projectId: 'missing-project',
        workerName: '田中',
        company: 'ABC建設',
        entryTime: '2026-05-13T09:00:00.000Z',
      }),
    ).rejects.toThrow();

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: null }),
    );
  });

  it('saveAsync (更新) は organization_id を引き直さず update する', async () => {
    const existingRow = {
      id: 'e-1',
      project_id: 'p-1',
      worker_name: '山田',
      company_name: 'ラポルタ',
      entry_at: '2026-05-13T09:00:00.000Z',
      exit_at: null,
    };
    const updateSpy = vi.fn();
    const existingCheckBuilder = makeBuilder({ data: existingRow, error: null });
    const updateBuilder = makeBuilder({
      data: { ...existingRow, exit_at: '2026-05-13T18:00:00.000Z' },
      error: null,
    });
    updateBuilder.update = vi.fn((item: unknown) => {
      updateSpy(item);
      return updateBuilder;
    });

    mockFrom
      .mockReturnValueOnce(existingCheckBuilder) // getById → 既存あり
      .mockReturnValueOnce(updateBuilder); // update(site_entry_records)

    const repo = new SiteEntryRepository(true);
    await repo.saveAsync({
      id: 'e-1',
      projectId: 'p-1',
      workerName: '山田',
      company: 'ラポルタ',
      entryTime: '2026-05-13T09:00:00.000Z',
      exitTime: '2026-05-13T18:00:00.000Z',
    });

    // projects テーブルへは問い合わせない（更新時は organization_id 不変のため再解決不要）
    expect(mockFrom).not.toHaveBeenCalledWith('projects');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ organization_id: expect.anything() }),
    );
  });
});
