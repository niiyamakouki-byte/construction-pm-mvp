/**
 * Discord向け見積フォーマッター
 *
 * 自然言語テキスト → NLパーサー → 見積生成 → Discord Markdown出力
 *
 * 使用例:
 *   const result = discordEstimate("6畳の壁紙張替え");
 *   // → Discordに貼れるMarkdownテーブル文字列
 */

import { parseNaturalLanguage } from "./nl-estimate-parser";
import { generateEstimate } from "./estimate-generator";
import type { Estimate, EstimateInput } from "./types";
import type { ParseResult } from "./nl-estimate-parser";

/** Discord出力結果 */
export type DiscordEstimateResult = {
  /** Discord用Markdown文字列 */
  message: string;
  /** 生成された見積オブジェクト */
  estimate: Estimate;
  /** パース結果 (デバッグ用) */
  parseResult: ParseResult;
};

/** 金額を3桁カンマ区切りで表示 */
function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

/**
 * パース結果のサマリー行を生成（面積検出情報など）
 */
function formatDetectionLine(result: ParseResult): string {
  if (result.detectedTatami) {
    const sqm = (result.detectedTatami * 1.62).toFixed(1);
    return `${result.detectedTatami}畳 (${sqm}m\u00B2)`;
  }
  if (result.detectedArea) {
    return `${result.detectedArea.sqm.toFixed(1)}m\u00B2`;
  }
  return "面積指定なし (デフォルト10m\u00B2)";
}

/**
 * 見積をDiscord Markdown形式にフォーマット
 */
export function formatEstimateForDiscord(estimate: Estimate, parseResult: ParseResult): string {
  const lines: string[] = [];

  // ヘッダー
  lines.push(`## \uD83D\uDCCB 概算見積`);
  lines.push(`> ${parseResult.originalText}`);
  lines.push(`> 検出: ${formatDetectionLine(parseResult)}`);
  lines.push("");

  // 明細テーブル
  lines.push("| 品目 | 数量 | 単価 | 金額 |");
  lines.push("|:-----|-----:|-----:|-----:|");

  for (const section of estimate.sections) {
    // セクションヘッダー行
    lines.push(`| **${section.categoryName}** | | | |`);
    for (const line of section.lines) {
      lines.push(
        `| ${line.name} | ${line.quantity}${line.unit} | ${formatYen(line.unitPrice)} | ${formatYen(line.amount)} |`,
      );
    }
  }

  lines.push("");

  // 集計
  lines.push("```");
  lines.push(`直接工事費         ${formatYen(estimate.directCost)}`);
  lines.push(`現場管理費(${(estimate.managementFeeRate * 100).toFixed(0)}%)    ${formatYen(estimate.managementFee)}`);
  lines.push(`一般管理費(${(estimate.generalExpenseRate * 100).toFixed(0)}%)     ${formatYen(estimate.generalExpense)}`);
  lines.push(`─────────────────────────`);
  lines.push(`税抜合計           ${formatYen(estimate.subtotal)}`);
  lines.push(`消費税(${(estimate.taxRate * 100).toFixed(0)}%)        ${formatYen(estimate.tax)}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`税込合計           ${formatYen(estimate.total)}`);
  lines.push("```");

  // 未マッチ警告
  if (parseResult.unmatched.length > 0) {
    lines.push("");
    lines.push(
      `> \u26A0\uFE0F 未対応: ${parseResult.unmatched.map((u) => `「${u}」`).join("、")}`,
    );
  }

  // フッター
  lines.push("");
  lines.push("-# \uD83C\uDFD7\uFE0F ラポルタ概算見積AI | 正式見積は別途ご依頼ください");

  return lines.join("\n");
}

/** Discord Botへの返答ペイロード */
export type DiscordReplyPayload = {
  /** 返答Markdown文字列 */
  content: string;
  /** 見積が生成された場合は見積データ、失敗時はnull */
  estimate: DiscordEstimateResult["estimate"] | null;
  /** 処理成功フラグ */
  ok: boolean;
};

/**
 * Discord Botがメッセージを受け取って見積を処理するハンドラー
 *
 * トリガーパターン:
 *   「見積」「見積もり」「estimate」「いくら」「費用」「工事」などを含むメッセージ
 *
 * @param message - Discordから届いた生テキスト
 * @returns 返答ペイロード（content をそのままDiscordに送れる）
 */
export function handleDiscordEstimateMessage(message: string): DiscordReplyPayload {
  const trimmed = message.trim();

  if (!trimmed) {
    return {
      content: "メッセージが空です。例: 「6畳の壁紙張替え」「20m²のタイルカーペット張替えとLED照明10台」",
      estimate: null,
      ok: false,
    };
  }

  const result = discordEstimate(trimmed);

  return {
    content: result.message,
    estimate: result.estimate ?? null,
    ok: result.estimate != null,
  };
}

/**
 * Discordメッセージが見積依頼かどうか判定
 *
 * @param message - Discordから届いた生テキスト
 * @returns 見積依頼と判定した場合はtrue
 */
export function isEstimateRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const triggers = [
    "見積", "見積もり", "みつもり",
    "estimate", "いくら", "費用", "値段", "価格",
    "工事", "張替", "はりかえ", "リノベ", "解体",
    "壁紙", "フローリング", "タイル", "照明", "エアコン",
    "内装", "塗装",
  ];
  return triggers.some((t) => lower.includes(t) || message.includes(t));
}

/**
 * 自然言語テキストからDiscord用見積メッセージを一発生成
 *
 * @param text - "6畳の壁紙張替え" 等の自然言語テキスト
 * @param propertyName - 物件名 (省略時はテキストから生成)
 * @returns Discord用Markdown文字列と見積データ
 */
export function discordEstimate(
  text: string,
  propertyName?: string,
): DiscordEstimateResult {
  // 1. NLパース
  const parseResult = parseNaturalLanguage(text, {
    includeProtection: false,
    includeCleaning: false,
  });

  // パースで品目が0件の場合
  if (parseResult.items.length === 0) {
    return {
      message: `## \uD83D\uDCCB 概算見積\n> ${text}\n\n\u274C 工事内容を特定できませんでした。\n例: 「6畳の壁紙張替え」「20m\u00B2のタイルカーペット張替えとLED照明10台」\n\n-# \uD83C\uDFD7\uFE0F ラポルタ概算見積AI`,
      estimate: null as unknown as Estimate,
      parseResult,
    };
  }

  // 2. EstimateInput[] に変換
  const items: EstimateInput[] = parseResult.items.map(({ code, quantity }) => ({
    code,
    quantity,
  }));

  // 3. 見積生成
  const estimate = generateEstimate({
    propertyName: propertyName ?? `概算: ${text.slice(0, 30)}`,
    clientName: "Discord見積",
    items,
  });

  // 4. Discord Markdown にフォーマット
  const message = formatEstimateForDiscord(estimate, parseResult);

  return { message, estimate, parseResult };
}
