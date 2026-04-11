/**
 * 異常検出モジュール
 * ParsedEstimateItem[] を解析して EstimateAlert[] を返す
 */

import type { ParsedEstimateItem } from "../estimate/nl-estimate-parser";

export type AlertSeverity = "warning" | "info";

export type EstimateAlert = {
  /** 警告ID */
  id: string;
  /** 重要度 */
  severity: AlertSeverity;
  /** 警告メッセージ */
  message: string;
};

/** 仕上げ系品目コードのプレフィックス */
const FINISH_CODE_PREFIXES = ["IN-"];
/** 撤去・解体系品目コードのプレフィックス */
const DEMOLISH_CODE_PREFIXES = ["DM-"];
/** 養生費コード */
const PROTECTION_CODE = "DM-009";

/** 業界平均単価レンジ (円/㎡) - 内装工事の目安 */
const INDUSTRY_AVG_PER_SQM_MIN = 3000;
const INDUSTRY_AVG_PER_SQM_MAX = 80000;

/**
 * 見積品目リストの異常を検出する
 *
 * @param items - ParsedEstimateItem[]
 * @param options - オプション設定
 * @returns EstimateAlert[]
 */
export function detectAnomalies(
  items: ParsedEstimateItem[],
  options: {
    /** 総見積金額 (業界平均乖離チェック用) */
    totalAmount?: number;
    /** 面積 (業界平均乖離チェック用) */
    areaSqm?: number;
  } = {},
): EstimateAlert[] {
  const alerts: EstimateAlert[] = [];

  const hasFinish = items.some((i) => FINISH_CODE_PREFIXES.some((p) => i.code.startsWith(p)));
  const hasDemolish = items.some((i) => DEMOLISH_CODE_PREFIXES.some((p) => i.code.startsWith(p)));
  const hasProtection = items.some((i) => i.code === PROTECTION_CODE);

  // 「撤去なしで仕上げのみ」→ 警告
  if (hasFinish && !hasDemolish) {
    alerts.push({
      id: "no-demolish",
      severity: "warning",
      message: "仕上げ工事が含まれていますが撤去工事がありません。既存材の撤去が必要な場合は別途ご確認ください。",
    });
  }

  // 「養生費なし」→ 警告
  if (!hasProtection && items.length > 0) {
    alerts.push({
      id: "no-protection",
      severity: "warning",
      message: "養生費が含まれていません。工事規模によっては養生費が別途必要な場合があります。",
    });
  }

  // 合計金額が業界平均から大幅に乖離
  if (options.totalAmount && options.areaSqm && options.areaSqm > 0) {
    const perSqm = options.totalAmount / options.areaSqm;
    if (perSqm < INDUSTRY_AVG_PER_SQM_MIN) {
      alerts.push({
        id: "price-too-low",
        severity: "warning",
        message: `概算単価(¥${Math.round(perSqm).toLocaleString("ja-JP")}/㎡)が業界平均を大きく下回っています。見積内容をご確認ください。`,
      });
    } else if (perSqm > INDUSTRY_AVG_PER_SQM_MAX) {
      alerts.push({
        id: "price-too-high",
        severity: "warning",
        message: `概算単価(¥${Math.round(perSqm).toLocaleString("ja-JP")}/㎡)が業界平均を大きく上回っています。見積内容をご確認ください。`,
      });
    }
  }

  return alerts;
}
