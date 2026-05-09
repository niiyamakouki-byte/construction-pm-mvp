/**
 * Local SEO — shared types.
 *
 * Sprint 19-B: 地域SEO自動化
 * 完工案件ごとに地域SEO記事を自動生成・laporta-hp 投稿・Google Business Profile 連携し、
 * 地域検索1位獲得を目指す。
 */

// ── Branded types ──────────────────────────────────────────────────────────

export type SeoArticleId = string & { readonly __brand: "SeoArticleId" };
export type KeywordTargetId = string & { readonly __brand: "KeywordTargetId" };
export type BackLinkId = string & { readonly __brand: "BackLinkId" };
export type SeoMetricsId = string & { readonly __brand: "SeoMetricsId" };

export function makeSeoArticleId(raw: string): SeoArticleId {
  return raw as SeoArticleId;
}

export function makeKeywordTargetId(raw: string): KeywordTargetId {
  return raw as KeywordTargetId;
}

export function makeBackLinkId(raw: string): BackLinkId {
  return raw as BackLinkId;
}

export function makeSeoMetricsId(raw: string): SeoMetricsId {
  return raw as SeoMetricsId;
}

// ── Enumerations ───────────────────────────────────────────────────────────

export type RegionScope =
  | "city_setagaya"
  | "city_shibuya"
  | "city_minato"
  | "city_yokohama"
  | "city_kawasaki";

export type ArticleStatus = "draft" | "scheduled" | "published" | "archived";

export type KeywordIntent = "research" | "local_purchase" | "service";

export type SerpRankBucket = "top3" | "top10" | "top30" | "beyond";

// ── Domain types ───────────────────────────────────────────────────────────

export type SeoArticle = {
  id: SeoArticleId;
  /** 対象プロジェクトID */
  projectId: string;
  /** ターゲット地域 */
  region: RegionScope;
  /** 記事ステータス */
  status: ArticleStatus;
  /** タイトル */
  title: string;
  /** タイトル候補4本 */
  titleCandidates: string[];
  /** 見出し5本 */
  headings: string[];
  /** 本文セクション */
  bodySections: ArticleBodySection[];
  /** 主要キーワード */
  primaryKeyword: string;
  /** セカンダリキーワード一覧 */
  secondaryKeywords: string[];
  /** laporta-hp 投稿URL (published 後に設定) */
  publishedUrl?: string;
  /** 公開日時 ISO 文字列 */
  publishedAt?: string;
  /** 作成日時 ISO 文字列 */
  createdAt: string;
};

export type ArticleBodySection = {
  heading: string;
  content: string;
};

export type KeywordTarget = {
  id: KeywordTargetId;
  /** 関連記事ID */
  articleId?: SeoArticleId;
  /** キーワード文字列 */
  keyword: string;
  /** 地域スコープ */
  region: RegionScope;
  /** 検索意図 */
  intent: KeywordIntent;
  /** 月間検索ボリューム mock スコア (50-2000) */
  monthlySearchVolume: number;
  /** 競合度スコア (0-100) */
  competitionScore: number;
  /** 推奨優先度 (1=最高) */
  priority: number;
  /** 作成日時 ISO 文字列 */
  createdAt: string;
};

export type BackLinkRecord = {
  id: BackLinkId;
  /** 関連記事ID */
  articleId: SeoArticleId;
  /** バックリンク元URL */
  sourceUrl: string;
  /** アンカーテキスト */
  anchorText: string;
  /** ドメインオーソリティ (0-100) */
  domainAuthority: number;
  /** 取得日時 ISO 文字列 */
  acquiredAt: string;
};

export type SerpSnapshot = {
  id: SeoMetricsId;
  /** 対象キーワードID */
  keywordTargetId: KeywordTargetId;
  /** 対象キーワード文字列 */
  keyword: string;
  /** 順位 (1-100+) */
  rank: number;
  /** 順位バケット */
  bucket: SerpRankBucket;
  /** スナップショット日時 ISO 文字列 */
  snapshotAt: string;
  /** 直近30日の順位推移 (index 0 = 最古) */
  rankHistory: number[];
};

export type LocalSeoStrategy = {
  /** 対象プロジェクトID */
  projectId: string;
  /** ターゲット地域 */
  region: RegionScope;
  /** 完工案件メタデータ */
  projectMeta: CompletionProjectMeta;
  /** 推奨キーワード TOP5 */
  recommendedKeywords: KeywordTarget[];
  /** 生成記事 */
  article?: SeoArticle;
  /** SERP スナップショット一覧 */
  serpSnapshots: SerpSnapshot[];
  /** GBP 最終同期日時 ISO 文字列 */
  gbpLastSyncAt?: string;
};

export type CompletionProjectMeta = {
  /** 現場名 */
  siteName: string;
  /** 工事部位 (例: 内装リノベーション) */
  workPart: string;
  /** 坪数 */
  areaSqm: number;
  /** 工期 (日数) */
  durationDays: number;
  /** Before 写真件数 */
  beforePhotoCount: number;
  /** After 写真件数 */
  afterPhotoCount: number;
  /** 施主コメント (任意) */
  ownerComment?: string;
  /** 完工日 ISO 文字列 */
  completedAt: string;
};

// ── Label maps ─────────────────────────────────────────────────────────────

export const regionScopeLabelJa: Record<RegionScope, string> = {
  city_setagaya: "世田谷区",
  city_shibuya: "渋谷区",
  city_minato: "港区",
  city_yokohama: "横浜市",
  city_kawasaki: "川崎市",
};

export const articleStatusLabelJa: Record<ArticleStatus, string> = {
  draft: "下書き",
  scheduled: "予約済み",
  published: "公開中",
  archived: "アーカイブ",
};

export const keywordIntentLabelJa: Record<KeywordIntent, string> = {
  research: "調査系",
  local_purchase: "地域購買系",
  service: "サービス系",
};

export const serpRankBucketLabelJa: Record<SerpRankBucket, string> = {
  top3: "TOP3",
  top10: "TOP10",
  top30: "TOP30",
  beyond: "30位以下",
};
