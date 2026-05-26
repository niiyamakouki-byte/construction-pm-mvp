/**
 * action-recommender — segment-based recommended actions in Japanese.
 */

import type { CustomerSegment, RepeatSignal } from "./types.js";

/**
 * Return a recommended action string in Japanese based on segment and signal context.
 */
export function recommendAction_ja(
  segment: CustomerSegment,
  signal: RepeatSignal,
): string {
  switch (segment) {
    case "vip":
      if (signal.referralCount >= 3) {
        return "VIP特別感謝キャンペーンを提案し、新規プロジェクトの早期相談を促してください。紹介プログラムの優遇条件を提示すると効果的です。";
      }
      return "VIPとして優先対応を継続し、新規物件情報や限定提案を先行してご案内ください。紹介インセンティブも提示しましょう。";

    case "loyal":
      if (signal.lastJobMonthsAgo > 6) {
        return "発注間隔が空いてきています。近況確認の訪問またはメールで次のプロジェクト計画をヒアリングしてください。";
      }
      return "継続発注への感謝を伝えるとともに、次回案件の早期相談窓口を案内してください。アフターフォロー訪問も効果的です。";

    case "promising":
      if (signal.jobsCount === 1) {
        return "初回案件の満足度を確認し、次回発注につながる提案資料を送付してください。施工事例集の共有が有効です。";
      }
      return "発注実績を積み上げ中のお客様です。ロイヤリティプログラムへの招待と、次回案件の見積もり優遇を提案してください。";

    case "dormant":
      if (signal.lastJobMonthsAgo >= 24) {
        return "長期間ご連絡がありません。近況確認のご挨拶メールと、最新施工事例を送付してください。季節ごとのキャンペーンDMも検討してください。";
      }
      return "しばらく発注が途絶えています。近況確認の連絡とともに、新サービスや価格改定のご案内をお送りください。";

    case "at_risk":
      if (signal.complaintCount >= 2) {
        return "クレームが複数件あります。担当者が直接お詫び訪問を行い、改善報告書を持参してください。関係修復が最優先です。";
      }
      return "満足度が低下しています。アフターフォロー連絡を至急行い、不満点を直接お聞きして改善対応してください。";

    default:
      return "定期的なコンタクトを継続し、次回発注の機会を逃さないようフォローしてください。";
  }
}
