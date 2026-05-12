import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../repository/supabase-client.js', () => ({
  supabase: { from: vi.fn() },
}));

import { SafetyRepository } from './SafetyRepository.js';
import type {
  KyActivityRecord,
  NearMissReportRecord,
} from './SafetyRepository.js';

function makeKy(o: Partial<KyActivityRecord> = {}): KyActivityRecord {
  return {
    id: 'ky-1',
    date: '2026-05-13',
    participants: ['山田', '佐藤'],
    hazards: ['転落'],
    countermeasures: ['手すり設置'],
    createdAt: '2026-05-13T00:00:00.000Z',
    ...o,
  };
}

function makeNm(o: Partial<NearMissReportRecord> = {}): NearMissReportRecord {
  return {
    id: 'nm-1',
    datetime: '2026-05-13T10:30:00.000Z',
    location: '3階エレベーター前',
    description: '工具落下',
    severity: 'medium',
    causeAnalysis: '養生不足',
    countermeasure: '養生強化',
    createdAt: '2026-05-13T10:30:00.000Z',
    ...o,
  };
}

describe('SafetyRepository async (InMemory mode)', () => {
  let repo: SafetyRepository;

  beforeEach(() => {
    repo = new SafetyRepository(false);
  });

  // ── ky_activities ──────────────────────────────────────────────────

  it('saveKyAsync→getKyAsync で KY活動を保存/取得できる', async () => {
    await repo.saveKyAsync(makeKy());
    const found = await repo.getKyAsync('ky-1');
    expect(found?.participants).toEqual(['山田', '佐藤']);
    expect(found?.hazards).toEqual(['転落']);
  });

  it('listKyAsync が全件返す', async () => {
    await repo.saveKyAsync(makeKy({ id: 'k-1' }));
    await repo.saveKyAsync(makeKy({ id: 'k-2' }));
    expect((await repo.listKyAsync()).length).toBe(2);
  });

  it('deleteKyAsync は true/false を返す', async () => {
    await repo.saveKyAsync(makeKy());
    expect(await repo.deleteKyAsync('ky-1')).toBe(true);
    expect(await repo.deleteKyAsync('ky-1')).toBe(false);
  });

  // ── near_miss_reports ──────────────────────────────────────────────

  it('saveNearMissAsync→getNearMissAsync でヒヤリ報告を保存/取得できる', async () => {
    await repo.saveNearMissAsync(makeNm());
    const found = await repo.getNearMissAsync('nm-1');
    expect(found?.severity).toBe('medium');
    expect(found?.location).toBe('3階エレベーター前');
  });

  it('listNearMissAsync が全件返す', async () => {
    await repo.saveNearMissAsync(makeNm({ id: 'n-1' }));
    await repo.saveNearMissAsync(makeNm({ id: 'n-2' }));
    expect((await repo.listNearMissAsync()).length).toBe(2);
  });

  it('deleteNearMissAsync は true/false を返す', async () => {
    await repo.saveNearMissAsync(makeNm());
    expect(await repo.deleteNearMissAsync('nm-1')).toBe(true);
    expect(await repo.deleteNearMissAsync('nm-1')).toBe(false);
  });

  it('ky と near-miss は独立した名前空間', async () => {
    await repo.saveKyAsync(makeKy({ id: 'shared' }));
    await repo.saveNearMissAsync(makeNm({ id: 'shared' }));
    expect((await repo.listKyAsync()).length).toBe(1);
    expect((await repo.listNearMissAsync()).length).toBe(1);
  });
});
