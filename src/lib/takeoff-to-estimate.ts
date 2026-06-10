/**
 * takeoff-to-estimate — 拾い出しセッション → 見積品目行 変換
 *
 * DrawingViewer の拾いサイドバーから EstimatePage へ流し込む際の
 * 変換ロジック。純粋関数のみ。No DOM / No React.
 */

import { summariseSession } from "./takeoff-session.js";
import type { TakeoffSessionState } from "./takeoff-session.js";

/** EstimatePage の selectedItems 互換の品目行 */
export type TakeoffEstimateItem = {
  /** 拾い出し由来であることを示す疑似コード (例: "TAKEOFF_壁_area") */
  code: string;
  name: string;
  unit: string;
  /** 単価は 0 — 見積ページで手動入力 */
  unitPrice: number;
  /** 計測合計 (m または ㎡)、小数点2桁に丸め */
  quantity: number;
};

/** localStorage に書き込むペイロードのキー */
export const TAKEOFF_INJECT_KEY = "takeoff_estimate_inject";

/**
 * セッション集計を見積品目行のリストに変換する。
 * - mm → m / mm² → ㎡ 換算は **takeoff-session 側で完結**（値は既に m/㎡）
 * - quantity は小数点2桁に丸め
 * - カテゴリ+単位で1行。距離行と面積行は別行になる
 */
export function sessionToEstimateItems(
  session: TakeoffSessionState,
): TakeoffEstimateItem[] {
  const rows = summariseSession(session);
  if (rows.length === 0) return [];

  return rows.map((row) => {
    const unitLabel = row.measureKind === "area" ? "㎡" : "m";
    const kindLabel = row.measureKind === "area" ? "面積" : "距離";
    return {
      code: `TAKEOFF_${row.category}_${row.measureKind}`,
      name: `${row.category}（${kindLabel}）`,
      unit: unitLabel,
      unitPrice: 0,
      quantity: Math.round(row.totalValue * 100) / 100,
    };
  });
}

/**
 * 見積品目リストを localStorage に書き込む。
 * EstimatePage が次の mount 時に読み取って消費する。
 */
export function writeEstimateInject(items: TakeoffEstimateItem[]): void {
  try {
    localStorage.setItem(TAKEOFF_INJECT_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded — ignore
  }
}

/**
 * localStorage から見積品目リストを読み取り、キーを削除して返す。
 * エントリがなければ空配列を返す。
 */
export function readAndClearEstimateInject(): TakeoffEstimateItem[] {
  try {
    const raw = localStorage.getItem(TAKEOFF_INJECT_KEY);
    if (!raw) return [];
    localStorage.removeItem(TAKEOFF_INJECT_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as TakeoffEstimateItem[];
  } catch {
    return [];
  }
}
