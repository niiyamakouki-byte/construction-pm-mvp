/**
 * keyword-recommender — RegionScope × KeywordIntent 組合せからキーワードを推奨する。
 *
 * - 月間検索ボリューム mock (50-2000)
 * - 競合度スコア (0-100)
 * - 推奨KW TOP5
 */

import type { KeywordTarget, KeywordTargetId, RegionScope, KeywordIntent } from "./types.js";
import { makeKeywordTargetId, regionScopeLabelJa } from "./types.js";

// ── ID counter ─────────────────────────────────────────────────────────────

let _kwCounter = 0;

function newKeywordId(): KeywordTargetId {
  return makeKeywordTargetId(`kw-${Date.now()}-${++_kwCounter}`);
}

// ── Keyword templates ──────────────────────────────────────────────────────

type KwTemplate = {
  template: (regionJa: string) => string;
  intent: KeywordIntent;
  /** 月間検索ボリューム base (50-2000) — 決定論的 mock */
  volumeBase: number;
  /** 競合度 base (0-100) */
  competitionBase: number;
};

const KW_TEMPLATES: KwTemplate[] = [
  // research
  { template: (r) => `${r} リフォーム 相場`, intent: "research", volumeBase: 1200, competitionBase: 55 },
  { template: (r) => `${r} 内装リノベーション 費用`, intent: "research", volumeBase: 900, competitionBase: 48 },
  { template: (r) => `${r} マンションリフォーム 価格`, intent: "research", volumeBase: 800, competitionBase: 52 },
  // local_purchase
  { template: (r) => `${r} マンション リフォーム`, intent: "local_purchase", volumeBase: 2000, competitionBase: 72 },
  { template: (r) => `${r} 内装 リノベーション`, intent: "local_purchase", volumeBase: 1800, competitionBase: 68 },
  { template: (r) => `${r} 内装業者`, intent: "local_purchase", volumeBase: 600, competitionBase: 40 },
  { template: (r) => `${r} リフォーム 会社`, intent: "local_purchase", volumeBase: 1400, competitionBase: 65 },
  // service
  { template: (r) => `${r} マンション 内装`, intent: "service", volumeBase: 500, competitionBase: 35 },
  { template: (r) => `${r} 壁紙 張り替え`, intent: "service", volumeBase: 400, competitionBase: 30 },
  { template: (r) => `${r} フローリング 張り替え`, intent: "service", volumeBase: 350, competitionBase: 28 },
  { template: (r) => `${r} 内装工事 おすすめ`, intent: "service", volumeBase: 200, competitionBase: 22 },
  { template: (r) => `${r} リノベーション 施工事例`, intent: "service", volumeBase: 300, competitionBase: 25 },
  { template: (r) => `${r} 内装 リフォーム 口コミ`, intent: "service", volumeBase: 150, competitionBase: 20 },
];

// ── Town-specific templates ────────────────────────────────────────────────

/** 町名が指定されている場合に追加するテンプレート */
function townTemplates(townName: string, regionJa: string): KwTemplate[] {
  return [
    { template: () => `${townName} リフォーム会社`, intent: "local_purchase", volumeBase: 120, competitionBase: 15 },
    { template: () => `${townName} 内装工事`, intent: "local_purchase", volumeBase: 80, competitionBase: 12 },
    { template: () => `${regionJa} ${townName} リノベーション`, intent: "local_purchase", volumeBase: 100, competitionBase: 18 },
  ];
}

// ── Volume / competition mock ──────────────────────────────────────────────

/** 決定論的に base から ±20% の範囲でジッタを加える (seed: keyword 文字列長 × index) */
function deterministicVolume(base: number, jitterSeed: number): number {
  const jitter = (jitterSeed % 40) - 20; // -20 〜 +19
  return Math.max(50, Math.min(2000, base + Math.round((base * jitter) / 100)));
}

function deterministicCompetition(base: number, jitterSeed: number): number {
  const jitter = (jitterSeed % 20) - 10;
  return Math.max(0, Math.min(100, base + jitter));
}

// ── Public API ─────────────────────────────────────────────────────────────

export type RecommendOptions = {
  region: RegionScope;
  intent?: KeywordIntent;
  /** 町名 — 指定すると町名クエリを追加 */
  townName?: string;
  /** 最大取得数 (8-15) */
  maxKeywords?: number;
};

/**
 * 指定地域・検索意図からキーワードターゲット一覧を生成する。
 */
export function recommendKeywords(
  options: RecommendOptions,
  now = new Date(),
): KeywordTarget[] {
  const { region, intent, townName, maxKeywords = 12 } = options;
  const regionJa = regionScopeLabelJa[region];

  let templates = [...KW_TEMPLATES];
  if (intent) {
    templates = templates.filter((t) => t.intent === intent);
  }
  if (townName) {
    templates = [...templates, ...townTemplates(townName, regionJa)];
  }

  return templates.slice(0, maxKeywords).map((t, idx) => {
    const keyword = t.template(regionJa);
    const seed = keyword.length + idx;
    return {
      id: newKeywordId(),
      keyword,
      region,
      intent: t.intent,
      monthlySearchVolume: deterministicVolume(t.volumeBase, seed),
      competitionScore: deterministicCompetition(t.competitionBase, seed),
      priority: idx + 1,
      createdAt: now.toISOString(),
    };
  });
}

/**
 * キーワード一覧から推奨 TOP5 を返す。
 * スコア = monthlySearchVolume / (competitionScore + 1) で降順ソート。
 */
export function pickTop5(keywords: KeywordTarget[]): KeywordTarget[] {
  return [...keywords]
    .sort((a, b) => {
      const scoreA = a.monthlySearchVolume / (a.competitionScore + 1);
      const scoreB = b.monthlySearchVolume / (b.competitionScore + 1);
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map((kw, idx) => ({ ...kw, priority: idx + 1 }));
}

/** テスト用カウンタリセット */
export function _resetKeywordCounter(): void {
  _kwCounter = 0;
}
