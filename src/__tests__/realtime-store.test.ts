/**
 * realtime-store テスト
 * subscribe / unsubscribe / update / pullFromAPI 成功・失敗 / stop をカバー
 */

/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonitorRealtimeStore } from "../lib/monitor-tool/realtime-store.js";
import type { MonitorSnapshot } from "../lib/monitor-tool/monitor-aggregator.js";

// ── フィクスチャ ──────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    today: new Date("2026-05-09T03:00:00.000Z"),
    ganttSummary: { delayed: 0, onTrack: 1, ahead: 0, totalProgress: 50 },
    todayReports: [],
    recentChats: [],
    recentPhotos: [],
    alerts: [],
    ...overrides,
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("MonitorRealtimeStore", () => {
  let store: MonitorRealtimeStore;

  beforeEach(() => {
    store = new MonitorRealtimeStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    store.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // subscribe / update
  it("subscribe したコールバックが update で呼ばれる", () => {
    const cb = vi.fn();
    store.subscribe(cb);
    const snap = makeSnapshot();
    store.update(snap);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(snap);
  });

  it("unsubscribe 後はコールバックが呼ばれない", () => {
    const cb = vi.fn();
    const unsub = store.subscribe(cb);
    unsub();
    store.update(makeSnapshot());
    expect(cb).not.toHaveBeenCalled();
  });

  it("複数 subscriber が全員通知を受ける", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    store.subscribe(cb1);
    store.subscribe(cb2);
    store.update(makeSnapshot());
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("getSnapshot は update 前 null を返す", () => {
    expect(store.getSnapshot()).toBeNull();
  });

  it("update 後 getSnapshot が最新スナップショットを返す", () => {
    const snap = makeSnapshot({ ganttSummary: { delayed: 2, onTrack: 0, ahead: 0, totalProgress: 20 } });
    store.update(snap);
    expect(store.getSnapshot()).toEqual(snap);
  });

  // pullFromAPI — 成功
  it("pullFromAPI が fetch を呼び update する", async () => {
    const snap = makeSnapshot();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => snap,
    }));

    const cb = vi.fn();
    store.subscribe(cb);
    store.pullFromAPI(5000);

    // 初回即時 fetch の Promise を flush
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/monitor/snapshot");
    expect(cb).toHaveBeenCalledWith(snap);
  });

  it("pullFromAPI が 5秒ごとに fetch を繰り返す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSnapshot(),
    }));

    store.pullFromAPI(5000);
    await vi.advanceTimersByTimeAsync(0); // 初回
    const firstCount = vi.mocked(fetch).mock.calls.length;

    await vi.advanceTimersByTimeAsync(5000); // インターバル1回分
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(firstCount);
    store.stop();
  });

  // pullFromAPI — 失敗 (ok: false)
  it("fetch が ok:false のとき console.warn を出して update しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const cb = vi.fn();
    store.subscribe(cb);
    store.pullFromAPI(5000);
    await vi.advanceTimersByTimeAsync(0);

    expect(warnSpy).toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });

  // pullFromAPI — ネットワークエラー
  it("fetch がネットワークエラーのとき console.warn を出して update しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const cb = vi.fn();
    store.subscribe(cb);
    store.pullFromAPI(5000);
    await vi.advanceTimersByTimeAsync(0);

    expect(warnSpy).toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });

  // stop
  it("stop 後は fetch が新たに呼ばれない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSnapshot(),
    }));

    store.pullFromAPI(5000);
    await vi.advanceTimersByTimeAsync(0); // 初回
    const countBefore = vi.mocked(fetch).mock.calls.length;

    store.stop();
    await vi.advanceTimersByTimeAsync(20000); // 4 interval ぶん進める
    expect(vi.mocked(fetch).mock.calls.length).toBe(countBefore);
  });

  // 二重起動ガード
  it("pullFromAPI を二重に呼んでも interval は1つだけ", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSnapshot(),
    }));

    store.pullFromAPI(5000);
    store.pullFromAPI(5000); // 2回目は無視されるべき
    await vi.advanceTimersByTimeAsync(0); // 初回 fetch flush

    await vi.advanceTimersByTimeAsync(5000); // 1 interval
    // 2本のintervalが走っていれば fetch は 4 回になるが、1本なら 2 回
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(3);
    store.stop();
  });
});
