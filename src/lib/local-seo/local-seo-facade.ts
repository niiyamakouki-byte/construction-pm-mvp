/**
 * local-seo-facade — 地域SEO自動化ワークフローの公開API
 *
 * Sprint 19-B: registerCompletion → recommendKeywords → generateArticle
 *             → publishToHp(mock) → trackSerp → reportToGbp
 */

import type {
  SeoArticle,
  SeoArticleId,
  KeywordTarget,
  KeywordTargetId,
  BackLinkRecord,
  BackLinkId,
  SerpSnapshot,
  LocalSeoStrategy,
  CompletionProjectMeta,
  RegionScope,
  KeywordIntent,
} from "./types.js";
import { makeSeoArticleId, makeBackLinkId } from "./types.js";
import { localSeoStore } from "./local-seo-store.js";
import { recommendKeywords, pickTop5 } from "./keyword-recommender.js";
import { generateArticle } from "./article-generator.js";
import { snapshotRankBatch } from "./serp-tracker.js";
import { syncToGbp } from "./gbp-syncer.js";
import type { GbpSyncResult } from "./gbp-syncer.js";
import { isSlugCollisionError, publishHpPost } from "./hp-publisher.js";
import type { HpPostParams } from "./hp-publisher.js";

// ── In-memory state ────────────────────────────────────────────────────────

const _strategies = new Map<string, LocalSeoStrategy>();
const _eventBus = new EventTarget();

/** テスト用リセット */
export function _resetLocalSeoFacade(): void {
  _strategies.clear();
}

// ── ID counters ────────────────────────────────────────────────────────────

let _backlinkCounter = 0;

function newBacklinkId(): BackLinkId {
  return makeBackLinkId(`bl-${Date.now()}-${++_backlinkCounter}`);
}

// ── Workflow steps ─────────────────────────────────────────────────────────

/**
 * Step 1: 完工案件を登録し、キーワード推奨リストを生成して保存する。
 */
export function registerCompletion(
  projectId: string,
  meta: CompletionProjectMeta,
  region: RegionScope,
  intentFilter?: KeywordIntent,
  now = new Date(),
): { strategy: LocalSeoStrategy; allKeywords: KeywordTarget[]; top5: KeywordTarget[] } {
  const allKeywords = recommendKeywords(
    {
      region,
      intent: intentFilter,
      townName: extractTownName(meta.siteName),
      maxKeywords: 13,
    },
    now,
  );

  for (const kw of allKeywords) {
    localSeoStore.addKeyword(kw);
  }

  const top5 = pickTop5(allKeywords);

  const strategy: LocalSeoStrategy = {
    projectId,
    region,
    projectMeta: meta,
    recommendedKeywords: top5,
    serpSnapshots: [],
  };

  _strategies.set(projectId, strategy);

  return { strategy, allKeywords, top5 };
}

/**
 * Step 2: SEO記事を生成してストアに保存する。
 */
export function generateAndSaveArticle(
  projectId: string,
  primaryKeyword: string,
  secondaryKeywords: string[] = [],
  now = new Date(),
): SeoArticle | null {
  const strategy = _strategies.get(projectId);
  if (!strategy) return null;

  const article = generateArticle(
    projectId,
    strategy.projectMeta,
    strategy.region,
    primaryKeyword,
    secondaryKeywords,
    now,
  );

  localSeoStore.addArticle(article);
  _strategies.set(projectId, { ...strategy, article });

  return article;
}

/**
 * Step 3: laporta-hp へ記事を公開する。
 * dryRun=true の場合は従来の mock 公開 URL を使う。
 */
export function publishToHp(
  articleId: SeoArticleId,
  mockUrl?: string,
  now = new Date(),
  dryRun = false,
): SeoArticle | null {
  const article = localSeoStore.getArticle(articleId);
  if (!article) return null;

  const slugBase = toHpSlug(articleId);
  const publishedSlug = dryRun
    ? slugBase
    : publishArticleWithRetry(buildHpPostParams(article, slugBase), now);
  const publishedUrl =
    dryRun
      ? mockUrl ??
        `https://laporta.co.jp/case/${articleId}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
      : `https://laporta.co.jp/case/${publishedSlug}`;

  const updated = localSeoStore.updateArticle(articleId, {
    status: "published",
    publishedUrl,
    publishedAt: now.toISOString(),
  });

  if (updated) {
    // Update strategy article reference
    for (const [pid, strategy] of _strategies) {
      if (strategy.article?.id === articleId) {
        _strategies.set(pid, { ...strategy, article: updated });
      }
    }
  }

  return updated;
}

/**
 * Step 4: キーワードターゲット群の SERP 順位をスナップショットする。
 */
export function trackSerp(
  projectId: string,
  daysElapsed = 30,
  now = new Date(),
): SerpSnapshot[] {
  const strategy = _strategies.get(projectId);
  if (!strategy) return [];

  const snapshots = snapshotRankBatch(strategy.recommendedKeywords, _eventBus, daysElapsed, now);

  _strategies.set(projectId, { ...strategy, serpSnapshots: snapshots });

  return snapshots;
}

/**
 * Step 5: Google Business Profile に投稿スケジュールを生成する。
 */
export function reportToGbp(
  projectId: string,
  now = new Date(),
): GbpSyncResult | null {
  const strategy = _strategies.get(projectId);
  if (!strategy) return null;

  const result = syncToGbp(
    projectId,
    strategy.projectMeta,
    strategy.region,
    strategy.article,
    now,
  );

  _strategies.set(projectId, { ...strategy, gbpLastSyncAt: result.syncedAt });

  return result;
}

/**
 * フルワークフロー: registerCompletion → generateArticle → publishToHp → trackSerp → reportToGbp
 */
export function runFullWorkflow(
  projectId: string,
  meta: CompletionProjectMeta,
  region: RegionScope,
  intentFilter?: KeywordIntent,
  daysElapsed = 30,
  now = new Date(),
  dryRun = false,
): {
  strategy: LocalSeoStrategy;
  allKeywords: KeywordTarget[];
  top5: KeywordTarget[];
  article: SeoArticle | null;
  serpSnapshots: SerpSnapshot[];
  gbpResult: GbpSyncResult | null;
} {
  const { strategy, allKeywords, top5 } = registerCompletion(
    projectId,
    meta,
    region,
    intentFilter,
    now,
  );

  const primaryKw = top5[0]?.keyword ?? `${meta.siteName} リフォーム`;
  const secondaryKws = top5.slice(1, 4).map((k) => k.keyword);

  const article = generateAndSaveArticle(projectId, primaryKw, secondaryKws, now);

  let publishedArticle: SeoArticle | null = null;
  if (article) {
    publishedArticle = publishToHp(article.id, undefined, now, dryRun);
  }

  const serpSnapshots = trackSerp(projectId, daysElapsed, now);
  const gbpResult = reportToGbp(projectId, now);

  const finalStrategy = _strategies.get(projectId) ?? strategy;

  return {
    strategy: finalStrategy,
    allKeywords,
    top5,
    article: publishedArticle ?? article,
    serpSnapshots,
    gbpResult,
  };
}

// ── Backlink registration ──────────────────────────────────────────────────

/**
 * バックリンクを記録する。
 */
export function recordBacklink(
  articleId: SeoArticleId,
  sourceUrl: string,
  anchorText: string,
  domainAuthority: number,
  now = new Date(),
): BackLinkRecord {
  const backlink: BackLinkRecord = {
    id: newBacklinkId(),
    articleId,
    sourceUrl,
    anchorText,
    domainAuthority,
    acquiredAt: now.toISOString(),
  };

  localSeoStore.addBacklink(backlink);
  return backlink;
}

// ── Query helpers ──────────────────────────────────────────────────────────

export function listArticles(limit = 100): SeoArticle[] {
  return localSeoStore.getArticles(limit);
}

export function getArticle(id: SeoArticleId): SeoArticle | null {
  return localSeoStore.getArticle(id);
}

export function listKeywords(limit = 200): KeywordTarget[] {
  return localSeoStore.getKeywords(limit);
}

export function getKeyword(id: KeywordTargetId): KeywordTarget | null {
  return localSeoStore.getKeyword(id);
}

export function listBacklinks(limit = 200): BackLinkRecord[] {
  return localSeoStore.getBacklinks(limit);
}

export function getBacklink(id: BackLinkId): BackLinkRecord | null {
  return localSeoStore.getBacklink(id);
}

export function listSnapshots(limit = 500): SerpSnapshot[] {
  return localSeoStore.getSnapshots(limit);
}

export function getStrategy(projectId: string): LocalSeoStrategy | null {
  return _strategies.get(projectId) ?? null;
}

/** イベントバスを取得 (for testing) */
export function getLocalSeoEventBus(): EventTarget {
  return _eventBus;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** 現場名から町名を抽出する簡易パーサ */
function extractTownName(siteName: string): string | undefined {
  // "世田谷区松原3丁目マンション" → "松原"
  const match = siteName.match(/区(.+?)[0-9０-９]/);
  if (match?.[1]) return match[1];
  const match2 = siteName.match(/市(.+?)[0-9０-９]/);
  if (match2?.[1]) return match2[1];
  return undefined;
}

function publishArticleWithRetry(params: HpPostParams, now: Date): string {
  try {
    return publishHpPost(params).slug;
  } catch (error) {
    if (!isSlugCollisionError(error)) {
      throw error;
    }
  }

  const retryParams = {
    ...params,
    slug: `${params.slug}-${formatTimestamp(now)}`,
  };
  return publishHpPost(retryParams).slug;
}

function buildHpPostParams(article: SeoArticle, slug: string): HpPostParams {
  const keywords = [article.primaryKeyword, ...article.secondaryKeywords]
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);

  return {
    slug,
    title: article.title,
    description: buildDescription(article),
    keywords,
    category: "interior-seo",
    body: buildMarkdownBody(article),
  };
}

function buildMarkdownBody(article: SeoArticle): string {
  const sections = article.bodySections.map(
    (section) => `## ${section.heading}\n\n${section.content}`,
  );
  return [`# ${article.title}`, ...sections].join("\n\n");
}

function buildDescription(article: SeoArticle): string {
  const text = article.bodySections[0]?.content.replace(/\s+/g, " ").trim() ?? article.title;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function toHpSlug(articleId: SeoArticleId): string {
  return articleId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatTimestamp(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}${ss}`;
}
