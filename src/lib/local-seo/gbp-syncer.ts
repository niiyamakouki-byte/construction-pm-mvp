/**
 * gbp-syncer — Google Business Profile 連携 mock。
 *
 * - 週次投稿テンプレート自動生成
 * - 写真投稿スケジュール
 * - Q&A テンプレート
 * - GBP アクション数カウント (portfolio-aggregator 用)
 */

import type { SeoArticle, CompletionProjectMeta, RegionScope } from "./types.js";
import { regionScopeLabelJa } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type GbpPostKind = "update" | "offer" | "event" | "photo";

export type GbpPost = {
  kind: GbpPostKind;
  title: string;
  body: string;
  /** 予定公開日時 ISO 文字列 */
  scheduledAt: string;
  /** 投稿済みかどうか (mock) */
  posted: boolean;
};

export type GbpQa = {
  question: string;
  answer: string;
};

export type GbpSyncResult = {
  projectId: string;
  region: RegionScope;
  postsGenerated: GbpPost[];
  qaGenerated: GbpQa[];
  photosScheduled: number;
  syncedAt: string;
};

// ── GBP action counter (in-memory for metrics) ─────────────────────────────

let _gbpActionCount = 0;

export function getGbpActionCount(): number {
  return _gbpActionCount;
}

export function _resetGbpActionCount(): void {
  _gbpActionCount = 0;
}

// ── Weekly post templates ──────────────────────────────────────────────────

function generateWeeklyPosts(
  meta: CompletionProjectMeta,
  region: RegionScope,
  article: SeoArticle | undefined,
  now: Date,
): GbpPost[] {
  const regionJa = regionScopeLabelJa[region];
  const posts: GbpPost[] = [];

  // Week 1: 施工事例紹介
  const week1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  posts.push({
    kind: "update",
    title: `【施工事例】${regionJa}での${meta.workPart}が完成しました`,
    body: `${regionJa}${meta.siteName}にて、${meta.areaSqm}㎡の${meta.workPart}が完成いたしました。工期${meta.durationDays}日間で、Before/After写真${meta.beforePhotoCount + meta.afterPhotoCount}枚を公開中です。${article?.publishedUrl ? `詳細はこちら: ${article.publishedUrl}` : "詳細はウェブサイトでご覧ください。"}`,
    scheduledAt: week1.toISOString(),
    posted: false,
  });

  // Week 2: キャンペーン
  const week2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  posts.push({
    kind: "offer",
    title: `${regionJa}の内装リフォーム — 無料相談受付中`,
    body: `${regionJa}エリアでのリフォームをご検討の方、まずは無料相談からどうぞ。ラポルタは${regionJa}での施工実績多数。お問い合わせをお待ちしています。`,
    scheduledAt: week2.toISOString(),
    posted: false,
  });

  // Week 3: Before/After フォーカス
  const week3 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  posts.push({
    kind: "photo",
    title: `Before / After ギャラリー — ${regionJa}${meta.workPart}事例`,
    body: `施工前後の変化をご覧ください。床・壁・天井の全面リノベーションで、空間が見違えるほど明るくなりました。`,
    scheduledAt: week3.toISOString(),
    posted: false,
  });

  // Week 4: お客様の声
  const week4 = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
  posts.push({
    kind: "update",
    title: `お客様の声 — ${regionJa}での${meta.workPart}`,
    body: meta.ownerComment ?? `「丁寧な施工で大変満足しています。${regionJa}でリフォームをお考えの方にぜひおすすめしたいです」— ${regionJa}在住のお客様より`,
    scheduledAt: week4.toISOString(),
    posted: false,
  });

  return posts;
}

// ── Q&A templates ──────────────────────────────────────────────────────────

function generateQa(meta: CompletionProjectMeta, region: RegionScope): GbpQa[] {
  const regionJa = regionScopeLabelJa[region];
  return [
    {
      question: `${regionJa}でのマンション内装リフォームにはどのくらいかかりますか？`,
      answer: `${regionJa}エリアでのマンション内装リフォームは、${meta.areaSqm}㎡規模で¥${Math.round(meta.areaSqm * 8000 / 10000)}万〜¥${Math.round(meta.areaSqm * 15000 / 10000)}万が目安です。詳細はお気軽にご相談ください。`,
    },
    {
      question: `施工期間はどのくらいですか？`,
      answer: `${meta.areaSqm}㎡規模の内装リノベーションの場合、${meta.durationDays}日前後が標準工期です。範囲・仕様により変動します。`,
    },
    {
      question: `${regionJa}以外でも対応できますか？`,
      answer: `はい、${regionJa}を中心に渋谷区・港区・川崎市・横浜市にも対応しています。まずはお気軽にご相談ください。`,
    },
    {
      question: `アフターサービスはありますか？`,
      answer: `引渡し後3ヶ月・1年・3年・5年・10年の定期点検を無償で実施しています。長期にわたってお客様の住まいをサポートします。`,
    },
  ];
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * GBP 投稿・写真・Q&A を mock 生成し、GbpSyncResult を返す。
 */
export function syncToGbp(
  projectId: string,
  meta: CompletionProjectMeta,
  region: RegionScope,
  article?: SeoArticle,
  now = new Date(),
): GbpSyncResult {
  const posts = generateWeeklyPosts(meta, region, article, now);
  const qa = generateQa(meta, region);
  const photosScheduled = Math.min(meta.afterPhotoCount, 10);

  // Increment GBP action count
  _gbpActionCount += posts.length + qa.length + photosScheduled;

  return {
    projectId,
    region,
    postsGenerated: posts,
    qaGenerated: qa,
    photosScheduled,
    syncedAt: now.toISOString(),
  };
}
