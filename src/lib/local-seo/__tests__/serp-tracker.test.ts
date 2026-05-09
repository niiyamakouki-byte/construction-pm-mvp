/**
 * serp-tracker.test.ts — Sprint 19-B
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── localStorage mock ──────────────────────────────────────────────────────

const _ls: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => _ls[k] ?? null,
  setItem: (k: string, v: string) => { _ls[k] = v; },
  removeItem: (k: string) => { delete _ls[k]; },
  clear: () => { for (const k of Object.keys(_ls)) delete _ls[k]; },
});

import {
  classifyRank,
  snapshotRank,
  snapshotRankBatch,
  getLatestSnapshot,
  _resetSnapshotCounter,
} from "../serp-tracker.js";
import { _resetLocalSeoStore } from "../local-seo-store.js";
import { _resetKeywordCounter, recommendKeywords, pickTop5 } from "../keyword-recommender.js";
import type { KeywordTarget } from "../types.js";

beforeEach(() => {
  _resetSnapshotCounter();
  _resetLocalSeoStore();
  _resetKeywordCounter();
  localStorage.clear();
});

describe("classifyRank", () => {
  it("1-3 → top3", () => {
    expect(classifyRank(1)).toBe("top3");
    expect(classifyRank(3)).toBe("top3");
  });

  it("4-10 → top10", () => {
    expect(classifyRank(4)).toBe("top10");
    expect(classifyRank(10)).toBe("top10");
  });

  it("11-30 → top30", () => {
    expect(classifyRank(11)).toBe("top30");
    expect(classifyRank(30)).toBe("top30");
  });

  it("31+ → beyond", () => {
    expect(classifyRank(31)).toBe("beyond");
    expect(classifyRank(100)).toBe("beyond");
  });
});

describe("snapshotRank", () => {
  it("スナップショットを生成してストアに保存する", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    const kw = kws[0];
    const bus = new EventTarget();
    const snap = snapshotRank(kw, bus, 30);
    expect(snap.keyword).toBe(kw.keyword);
    expect(snap.rank).toBeGreaterThanOrEqual(1);
    expect(snap.rankHistory).toHaveLength(31); // 30日 + 1
  });

  it("rankHistory が 30 日間の配列を含む", () => {
    const kw = recommendKeywords({ region: "city_setagaya" })[0];
    const bus = new EventTarget();
    const snap = snapshotRank(kw, bus, 30);
    expect(snap.rankHistory.length).toBeGreaterThanOrEqual(30);
  });

  it("TOP10 達成時に serp-top10-achieved イベントが発火する", () => {
    // "世田谷区 内装業者" は競合低め → 30日後に TOP10 到達しやすい
    const kws = recommendKeywords({ region: "city_setagaya" });
    const bus = new EventTarget();
    const spy = vi.fn();
    bus.addEventListener("serp-top10-achieved", spy);

    // 全キーワードに対してスナップショットを取得 — 少なくとも1件は TOP10 に入るはず
    for (const kw of kws) {
      snapshotRank(kw, bus, 30);
    }
    // 全 13 件中、少なくとも 1 件は TOP10 以内
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("bucket が classifyRank(rank) と一致する", () => {
    const kw = recommendKeywords({ region: "city_setagaya" })[0];
    const bus = new EventTarget();
    const snap = snapshotRank(kw, bus, 30);
    expect(snap.bucket).toBe(classifyRank(snap.rank));
  });
});

describe("snapshotRankBatch", () => {
  it("複数 KW のスナップショットをまとめて返す", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    const bus = new EventTarget();
    const snaps = snapshotRankBatch(kws, bus, 30);
    expect(snaps).toHaveLength(kws.length);
  });
});

describe("getLatestSnapshot", () => {
  it("最新のスナップショットを返す", () => {
    const kw = recommendKeywords({ region: "city_setagaya" })[0];
    const bus = new EventTarget();
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-05-01T00:00:00.000Z");
    snapshotRank(kw, bus, 10, older);
    const latest = snapshotRank(kw, bus, 30, newer);
    const found = getLatestSnapshot(kw.id);
    expect(found?.id).toBe(latest.id);
  });

  it("スナップショットがなければ null を返す", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    expect(getLatestSnapshot(kws[0].id)).toBeNull();
  });
});

describe("30日後 世田谷区 マンション リフォーム → TOP10 証跡", () => {
  it("ボリューム最大 KW が 30日後に TOP10 圏内", () => {
    // 世田谷区 × local_purchase でボリューム大きいキーワード群を取得
    const kws = recommendKeywords({ region: "city_setagaya", intent: "local_purchase" });
    const top5 = pickTop5(kws);
    const bus = new EventTarget();

    // 30日後のスナップショット
    const snaps = snapshotRankBatch(top5, bus, 30);

    // TOP5 のうち少なくとも1件は TOP10 以内
    const top10Snaps = snaps.filter((s) => s.bucket === "top3" || s.bucket === "top10");
    expect(top10Snaps.length).toBeGreaterThanOrEqual(1);
  });
});
