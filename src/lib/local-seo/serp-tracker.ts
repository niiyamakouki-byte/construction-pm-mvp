/**
 * serp-tracker — SERP 順位の mock 取得・追跡・bucket 分類。
 *
 * 決定論的 mock: keyword の文字数 × region の hash → 初期順位
 * 直近30日推移: 線形改善トレンド (日次 -0.5 ランク)
 * 上位獲得 (TOP10) でイベント発火
 */

import type { SerpSnapshot, SeoMetricsId, KeywordTarget, RegionScope, SerpRankBucket } from "./types.js";
import { makeSeoMetricsId } from "./types.js";
import { localSeoStore } from "./local-seo-store.js";

// ── ID counter ─────────────────────────────────────────────────────────────

let _snapshotCounter = 0;

function newSnapshotId(): SeoMetricsId {
  return makeSeoMetricsId(`snap-${Date.now()}-${++_snapshotCounter}`);
}

// ── Bucket classification ──────────────────────────────────────────────────

export function classifyRank(rank: number): SerpRankBucket {
  if (rank <= 3) return "top3";
  if (rank <= 10) return "top10";
  if (rank <= 30) return "top30";
  return "beyond";
}

// ── Deterministic mock rank ────────────────────────────────────────────────

const REGION_SEEDS: Record<RegionScope, number> = {
  city_setagaya: 7,
  city_shibuya: 11,
  city_minato: 13,
  city_yokohama: 17,
  city_kawasaki: 19,
};

/**
 * 決定論的にキーワードの初期順位 (1-80) を返す。
 * keyword.length × regionSeed mod 80 + 5
 */
function deterministicInitialRank(keyword: string, region: RegionScope): number {
  const seed = REGION_SEEDS[region];
  return ((keyword.length * seed) % 76) + 5;
}

/**
 * 直近 daysBack 日間の順位推移を生成 (線形改善トレンド)。
 * 初期順位から1日あたり -0.5 ランク改善 (下限 1)。
 */
function generateRankHistory(initialRank: number, daysBack = 30): number[] {
  const history: number[] = [];
  for (let d = daysBack; d >= 0; d--) {
    const rank = Math.max(1, Math.round(initialRank - (daysBack - d) * 0.5));
    history.push(rank);
  }
  return history;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * キーワードターゲットの現在順位を mock 取得し、SerpSnapshot を生成・保存する。
 * TOP10 入り時は "serp-top10-achieved" カスタムイベントを EventTarget に発火。
 */
export function snapshotRank(
  kwTarget: KeywordTarget,
  eventTarget: EventTarget,
  daysElapsed = 30,
  now = new Date(),
): SerpSnapshot {
  const initialRank = deterministicInitialRank(kwTarget.keyword, kwTarget.region);
  const currentRank = Math.max(1, Math.round(initialRank - daysElapsed * 0.5));
  const bucket = classifyRank(currentRank);
  const rankHistory = generateRankHistory(initialRank, Math.min(daysElapsed, 30));

  const snapshot: SerpSnapshot = {
    id: newSnapshotId(),
    keywordTargetId: kwTarget.id,
    keyword: kwTarget.keyword,
    rank: currentRank,
    bucket,
    snapshotAt: now.toISOString(),
    rankHistory,
  };

  localSeoStore.addSnapshot(snapshot);

  if (bucket === "top3" || bucket === "top10") {
    eventTarget.dispatchEvent(
      new CustomEvent("serp-top10-achieved", {
        detail: { keyword: kwTarget.keyword, rank: currentRank, bucket },
      }),
    );
  }

  return snapshot;
}

/**
 * 複数キーワードのスナップショットをまとめて取得する。
 */
export function snapshotRankBatch(
  kwTargets: KeywordTarget[],
  eventTarget: EventTarget,
  daysElapsed = 30,
  now = new Date(),
): SerpSnapshot[] {
  return kwTargets.map((kw) => snapshotRank(kw, eventTarget, daysElapsed, now));
}

/**
 * キーワードターゲットID から最新スナップショットを返す。
 */
export function getLatestSnapshot(keywordTargetId: KeywordTarget["id"]): SerpSnapshot | null {
  const snapshots = localSeoStore.getSnapshotsByKeyword(keywordTargetId);
  if (snapshots.length === 0) return null;
  return snapshots.sort(
    (a, b) => new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime(),
  )[0];
}

/** テスト用カウンタリセット */
export function _resetSnapshotCounter(): void {
  _snapshotCounter = 0;
}
