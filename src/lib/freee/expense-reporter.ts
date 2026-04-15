/**
 * 案件別経費集計レポート生成
 *
 * freee の取引（deals）を期間・案件 ID でフィルタし、
 * 売上・原価・粗利を集計して返す。
 * クライアント未設定時は空のレポートを返す（no-op）。
 */

import type { FreeeClient } from "./client.js";
import type { Deal } from "./types.js";

export type ExpenseBreakdown = {
  category: string;
  amount: number;
};

export type ProjectExpenseReport = {
  projectId: string;
  period: { from: Date; to: Date };
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  breakdown: ExpenseBreakdown[];
};

// ── Helpers ──────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isInPeriod(dateStr: string, from: Date, to: Date): boolean {
  const t = new Date(dateStr).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/**
 * deal.details から勘定科目 ID をカテゴリ名にマップする（暫定）。
 * Phase 2 で freee の account_items API から名称を取得する予定。
 */
function accountLabel(accountItemId: number): string {
  // 暫定マッピング（freee標準勘定科目コードに基づく）
  const labels: Record<number, string> = {
    1: "売上高",
    2: "売上原価",
    3: "材料費",
    4: "外注費",
    5: "労務費",
    6: "経費",
    7: "水道光熱費",
    8: "通信費",
    9: "交通費",
    10: "接待交際費",
  };
  return labels[accountItemId] ?? `勘定科目 ${accountItemId}`;
}

function aggregateDeals(deals: Deal[]): {
  totalRevenue: number;
  totalCost: number;
  breakdown: ExpenseBreakdown[];
} {
  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;
  let totalCost = 0;

  for (const deal of deals) {
    for (const detail of deal.details) {
      const label = accountLabel(detail.account_item_id);
      const current = categoryMap.get(label) ?? 0;
      categoryMap.set(label, current + detail.amount);
    }

    if (deal.type === "income") {
      totalRevenue += deal.amount;
    } else {
      totalCost += deal.amount;
    }
  }

  const breakdown: ExpenseBreakdown[] = Array.from(categoryMap.entries()).map(
    ([category, amount]) => ({ category, amount }),
  );

  return { totalRevenue, totalCost, breakdown };
}

// ── Main export ───────────────────────────────────────

/**
 * 指定案件・期間の経費レポートを生成する。
 *
 * @param client      FreeeClient インスタンス
 * @param companyId   freee 事業所 ID
 * @param projectId   GenbaHub 案件 ID（ref_number として freee に保存される）
 * @param period      集計期間 { from, to }
 */
export async function generateProjectExpenseReport(
  client: FreeeClient,
  companyId: number,
  projectId: string,
  period: { from: Date; to: Date },
): Promise<ProjectExpenseReport> {
  const empty: ProjectExpenseReport = {
    projectId,
    period,
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    breakdown: [],
  };

  if (!client.isConfigured()) {
    return empty;
  }

  const allDeals = await client.listDeals(companyId, {
    start_issue_date: toISODate(period.from),
    end_issue_date: toISODate(period.to),
  });

  // ref_number が projectId に一致する取引だけに絞る
  const projectDeals = allDeals.filter(
    (d) => d.ref_number === projectId && isInPeriod(d.issue_date, period.from, period.to),
  );

  if (projectDeals.length === 0) {
    return empty;
  }

  const { totalRevenue, totalCost, breakdown } = aggregateDeals(projectDeals);

  return {
    projectId,
    period,
    totalRevenue,
    totalCost,
    grossProfit: totalRevenue - totalCost,
    breakdown,
  };
}
