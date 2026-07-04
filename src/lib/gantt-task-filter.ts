/**
 * gantt-task-filter — COMPASS基準 P3: フィルタ+検索の合成
 *
 * ガントで表示するタスクを、工種フィルタ（表示ON/OFFセット）と
 * フリーワード検索の AND で絞り込むピュアな純関数群。
 * UI 側の複雑さを削り、単体テストで挙動を保証する。
 */
import type { GanttTask } from "../components/gantt/types.js";

export const TRADE_CATEGORIES = [
  "painting",
  "framing",
  "electrical",
  "plumbing",
  "finishing",
  "other",
] as const;

export type TradeCategory = (typeof TRADE_CATEGORIES)[number];

export const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
  painting: "塗装",
  framing: "軽鉄",
  electrical: "電気",
  plumbing: "配管",
  finishing: "仕上",
  other: "その他",
};

/**
 * majorCategory 文字列から工種カテゴリを判定する。
 * 未該当は "other" に落とす（COMPASS の「その他フェーズ」相当）。
 */
export function resolveTradeCategory(task: Pick<GanttTask, "majorCategory">): TradeCategory {
  const raw = (task.majorCategory ?? "").toLowerCase();
  if (raw.includes("paint") || raw.includes("塗装")) return "painting";
  if (raw.includes("fram") || raw.includes("軽鉄") || raw.includes("下地")) return "framing";
  if (raw.includes("elect") || raw.includes("電気") || raw.includes("配線")) return "electrical";
  if (raw.includes("plumb") || raw.includes("配管") || raw.includes("給排水")) return "plumbing";
  if (raw.includes("finish") || raw.includes("仕上") || raw.includes("クロス") || raw.includes("床"))
    return "finishing";
  return "other";
}

/**
 * 1タスクが検索クエリにヒットするか判定する。
 * 大文字小文字を無視した部分一致で、タスク名／協力会社名／案件名／工種名のいずれかを対象とする。
 * 空クエリは常に true（=検索なし）。
 */
export function matchesTaskSearch(task: GanttTask, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [
    task.name,
    task.contractorName ?? "",
    task.projectName,
    task.majorCategory ?? "",
    task.middleCategory ?? "",
    task.minorCategory ?? "",
  ];
  return haystacks.some((s) => s.toLowerCase().includes(q));
}

/**
 * タスクリストを「工種フィルタ ∧ 検索クエリ」で絞り込む。
 * `activeTrades` は表示ONの工種カテゴリのセット（空なら全非表示）。
 * `query` は空文字なら検索なし扱い。
 */
export function filterGanttTasks(
  tasks: readonly GanttTask[],
  activeTrades: ReadonlySet<TradeCategory>,
  query: string,
): GanttTask[] {
  return tasks.filter(
    (task) => activeTrades.has(resolveTradeCategory(task)) && matchesTaskSearch(task, query),
  );
}
