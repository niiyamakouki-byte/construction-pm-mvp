/**
 * reply-draft-generator — 問い合わせ返信メール下書きを生成する
 *
 * 日本語ビジネスメール。松竹梅の概算金額 + 現地調査 CTA + ラポルタ署名。
 * LLM 不使用。テンプレートベース。
 */

import { formatYen } from "../estimate-assistant/cost-lookup.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";
import type { ContactSubmission } from "./contact-webhook-receiver.js";
import type { AutoEstimateResult } from "./auto-estimate-pipeline.js";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type ReplyDraft = {
  subject: string;
  body: string;
};

export type ReplyDraftInput = {
  submission: ContactSubmission;
  estimate: EstimateRange;
  confidence?: AutoEstimateResult["confidence"];
};

// ── 定数 ────────────────────────────────────────────────────────────────────

const SIGNATURE = `
--
株式会社ラポルタ
〒157-0065 東京都世田谷区給田5-12-12
TEL: 03-6876-7749
担当: 新山光輝
`.trim();

// ── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * 問い合わせと見積結果から返信メール下書き（件名 + 本文）を生成する。
 */
export function generateReplyDraft({ submission, estimate, confidence = "medium" }: ReplyDraftInput): ReplyDraft {
  const subject = `【株式会社ラポルタ】お問い合わせいただきありがとうございます`;

  const body = buildBody(submission, estimate, confidence);

  return { subject, body };
}

// ── 内部ヘルパー ─────────────────────────────────────────────────────────────

function buildBody(
  submission: ContactSubmission,
  estimate: EstimateRange,
  confidence: AutoEstimateResult["confidence"],
): string {
  const { name, message } = submission;
  const { taxIncludedLow, taxIncludedMid, taxIncludedHigh } = estimate;

  const confidenceNote =
    confidence === "low"
      ? "今回はお問い合わせ内容を基に概算を算出いたしましたが、詳細な情報をお聞きすることでより正確なお見積りをご提示できます。"
      : confidence === "high"
        ? "ご連絡いただいた情報を基に、概算金額をご案内申し上げます。"
        : "いただいたご要望を基に、参考となる概算金額をご案内申し上げます。";

  return `${name} 様

いつもお世話になっております。
株式会社ラポルタの新山でございます。

この度はお問い合わせいただきまして、誠にありがとうございます。
以下の通り、概算金額をご案内させていただきます。

${confidenceNote}

━━━━━━━━━━━━━━━━━━━━━━
■ 概算金額（税込）
━━━━━━━━━━━━━━━━━━━━━━

　【梅】エコノミーグレード  ${formatYen(taxIncludedLow)}
　【竹】標準グレード        ${formatYen(taxIncludedMid)}
　【松】ハイグレード        ${formatYen(taxIncludedHigh)}

※ 上記は概算となります。現地調査後に±20%程度変動する場合がございます。
※ 東京・世田谷区周辺の標準工事単価を基準としております。

━━━━━━━━━━━━━━━━━━━━━━
■ お問い合わせ内容（確認）
━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━

より正確なお見積りのため、無料の現地調査をお勧めしております。
ご都合のよい日程をお知らせいただければ、担当者よりご連絡差し上げます。

ご不明な点がございましたら、お気軽にご連絡ください。
どうぞよろしくお願いいたします。

${SIGNATURE}`;
}
