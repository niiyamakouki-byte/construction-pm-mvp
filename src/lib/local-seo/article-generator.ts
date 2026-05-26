/**
 * article-generator — 完工案件メタデータから地域SEO記事を生成する。
 *
 * 生成物:
 *   - タイトル候補 4本
 *   - 見出し 5本
 *   - 本文セクション (背景/施工内容/Before-After/お客様の声/料金目安) 各 300-500字
 */

import type {
  SeoArticle,
  SeoArticleId,
  CompletionProjectMeta,
  RegionScope,
  ArticleBodySection,
} from "./types.js";
import { makeSeoArticleId, regionScopeLabelJa } from "./types.js";

// ── ID counter ─────────────────────────────────────────────────────────────

let _articleCounter = 0;

function newArticleId(): SeoArticleId {
  return makeSeoArticleId(`art-${Date.now()}-${++_articleCounter}`);
}

// ── Title generation ───────────────────────────────────────────────────────

export function generateTitleCandidates(
  meta: CompletionProjectMeta,
  region: RegionScope,
): string[] {
  const regionJa = regionScopeLabelJa[region];
  const areaTsubo = Math.round(meta.areaSqm / 3.31);
  return [
    `${regionJa}${meta.siteName}の${meta.workPart}事例（${meta.areaSqm}㎡/${meta.durationDays}日）`,
    `【${regionJa}】${meta.workPart}リノベーション施工事例 ${meta.areaSqm}㎡`,
    `${regionJa}でマンション${meta.workPart}をご検討の方へ — ラポルタの施工事例`,
    `${regionJa}の内装業者が手がけた${meta.workPart}（${areaTsubo}坪・${meta.durationDays}日間）`,
  ];
}

// ── Heading generation ─────────────────────────────────────────────────────

export function generateHeadings(
  meta: CompletionProjectMeta,
  region: RegionScope,
): string[] {
  const regionJa = regionScopeLabelJa[region];
  return [
    `${regionJa}での${meta.workPart}：ご依頼の背景`,
    `施工内容と使用した素材・工法`,
    `Before / After フォトギャラリー（${meta.beforePhotoCount + meta.afterPhotoCount}枚）`,
    `施主様のお声`,
    `${regionJa}での${meta.workPart}の料金目安`,
  ];
}

// ── Body section generation ────────────────────────────────────────────────

function backgroundSection(meta: CompletionProjectMeta, region: RegionScope): ArticleBodySection {
  const regionJa = regionScopeLabelJa[region];
  return {
    heading: `${regionJa}での${meta.workPart}：ご依頼の背景`,
    content: `今回ご紹介するのは、${regionJa}${meta.siteName}にお住まいのお客様からご依頼いただいた${meta.workPart}の施工事例です。\n\nご相談のきっかけは「老朽化した内装を一新したい」「生活スタイルに合わせた空間にリノベーションしたい」というご要望でした。物件は${meta.areaSqm}㎡の広さがあり、全体的な計画を丁寧にヒアリングしながら進めました。\n\n${regionJa}エリアでの施工実績が豊富なラポルタだからこそ、地域の建物特性や素材の調達ルートを熟知しており、スムーズな提案が可能です。初回相談から設計・施工・引渡しまで一気通貫でサポートしました。`,
  };
}

function constructionSection(meta: CompletionProjectMeta): ArticleBodySection {
  return {
    heading: "施工内容と使用した素材・工法",
    content: `施工面積は${meta.areaSqm}㎡（約${Math.round(meta.areaSqm / 3.31)}坪）で、工期は${meta.durationDays}日間でした。\n\n主な施工内容は以下の通りです。\n\n・床材の全面張り替え（無垢フローリングまたは複合フローリング）\n・壁面クロスの貼り替え（抗菌・防汚機能付きビニルクロス）\n・天井クロスの貼り替えおよびダウンライト設置\n・建具（ドア・建付け）の調整・交換\n\n使用材料はすべて国内一流メーカーの製品を採用。施工職人は自社管理の熟練技術者が担当し、品質にこだわった仕上がりを実現しました。また、施工期間中はお客様の生活動線への配慮を徹底し、養生・清掃を毎日実施しました。`,
  };
}

function beforeAfterSection(meta: CompletionProjectMeta): ArticleBodySection {
  return {
    heading: `Before / After フォトギャラリー（${meta.beforePhotoCount + meta.afterPhotoCount}枚）`,
    content: `施工前後の変化を${meta.beforePhotoCount + meta.afterPhotoCount}枚の写真でご確認いただけます（Before ${meta.beforePhotoCount}枚 / After ${meta.afterPhotoCount}枚）。\n\n写真からもわかるように、施工前は経年劣化による黄ばみや傷が目立っていた床・壁が、施工後は明るく清潔感のある空間へと生まれ変わりました。\n\nLDKの床をウォールナット調のフローリングに統一したことで、空間全体に落ち着いた高級感が生まれています。また、白を基調とした壁面クロスとの組み合わせにより、採光効率も向上し、日中は照明なしでも十分な明るさを確保できるようになりました。\n\nギャラリーページでは各部屋の詳細な施工前後比較をご覧いただけます。`,
  };
}

function ownerVoiceSection(meta: CompletionProjectMeta): ArticleBodySection {
  const comment =
    meta.ownerComment ??
    `「ラポルタさんに頼んで本当によかったです。工事中も丁寧に説明してくださり、仕上がりも期待以上でした。友人にも紹介したいと思います」`;
  return {
    heading: "施主様のお声",
    content: `施工完了後、お客様からうれしいお言葉をいただきました。\n\n${comment}\n\n弊社では引渡し後もアフターフォローを徹底しており、3ヶ月・1年・3年・5年・10年の定期点検を無償で実施しています。長期にわたってお客様の住まいを守り続けることが私たちのミッションです。\n\nご不満やご要望がございましたら、いつでもお気軽にご連絡ください。担当スタッフが迅速に対応いたします。`,
  };
}

function priceGuideSection(meta: CompletionProjectMeta, region: RegionScope): ArticleBodySection {
  const regionJa = regionScopeLabelJa[region];
  const minPrice = Math.round((meta.areaSqm * 8000) / 10000) * 10000;
  const maxPrice = Math.round((meta.areaSqm * 15000) / 10000) * 10000;
  const minManJpy = (minPrice / 10000).toFixed(0);
  const maxManJpy = (maxPrice / 10000).toFixed(0);
  return {
    heading: `${regionJa}での${meta.workPart}の料金目安`,
    content: `今回の施工事例（${meta.areaSqm}㎡）の総工費は¥${minManJpy}万〜¥${maxManJpy}万の範囲でご提案しております（仕様・素材グレードにより変動）。\n\n${regionJa}エリアでの内装リノベーション相場は、マンションの場合1㎡あたり8,000〜15,000円程度が目安です。ラポルタでは現地調査・ヒアリングを経た上で、お客様の予算に合わせた最適なプランをご提案します。\n\n■ 主な費用内訳（目安）\n・床工事: ¥${Math.round(meta.areaSqm * 3500 / 1000) * 1000}〜\n・壁・天井クロス工事: ¥${Math.round(meta.areaSqm * 2000 / 1000) * 1000}〜\n・建具・設備調整: ¥100,000〜\n\n無料見積もりはお問い合わせフォームまたはお電話にてお受けしています。`,
  };
}

// ── Main function ──────────────────────────────────────────────────────────

/**
 * 完工案件メタデータから SEO 記事を生成する。
 */
export function generateArticle(
  projectId: string,
  meta: CompletionProjectMeta,
  region: RegionScope,
  primaryKeyword: string,
  secondaryKeywords: string[] = [],
  now = new Date(),
): SeoArticle {
  const titleCandidates = generateTitleCandidates(meta, region);
  const headings = generateHeadings(meta, region);
  const bodySections: ArticleBodySection[] = [
    backgroundSection(meta, region),
    constructionSection(meta),
    beforeAfterSection(meta),
    ownerVoiceSection(meta),
    priceGuideSection(meta, region),
  ];

  return {
    id: newArticleId(),
    projectId,
    region,
    status: "draft",
    title: titleCandidates[0],
    titleCandidates,
    headings,
    bodySections,
    primaryKeyword,
    secondaryKeywords,
    createdAt: now.toISOString(),
  };
}

/** 記事の本文全体を文字列として結合する (文字数確認用) */
export function articleBodyText(article: SeoArticle): string {
  return article.bodySections.map((s) => s.heading + "\n" + s.content).join("\n\n");
}

/** 記事本文の文字数を返す */
export function articleCharCount(article: SeoArticle): number {
  return articleBodyText(article).length;
}

/** テスト用カウンタリセット */
export function _resetArticleCounter(): void {
  _articleCounter = 0;
}
