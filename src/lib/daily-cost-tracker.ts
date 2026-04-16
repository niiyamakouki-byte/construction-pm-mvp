/**
 * Daily Cost Tracker (DDC Phase 3)
 * 職人日次入力 → 週次集計 → 予算消化率計算
 * Pure functions, no storage layer.
 */

export interface DailyCostEntry {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  category: 'labor' | 'material' | 'equipment' | 'subcontract' | 'other';
  amount: number; // 円
  description: string;
  enteredBy: string; // 職人名 or ID
  createdAt: Date;
}

export interface WeeklyCostSummary {
  projectId: string;
  weekStart: string; // YYYY-MM-DD (月曜)
  totalByCategory: Record<DailyCostEntry['category'], number>;
  totalAmount: number;
  entryCount: number;
}

export interface BudgetConsumption {
  projectId: string;
  budgetTotal: number;
  consumedTotal: number;
  consumedRate: number; // 0-1
  remainingBudget: number;
  daysElapsed: number;
  burnRatePerDay: number; // 円/日
  projectedTotal: number; // 現在のペースで完工した場合の予測
  forecastOverrun: number; // 予測超過額（プラスなら超過、マイナスなら余裕）
}

const CATEGORIES: DailyCostEntry['category'][] = [
  'labor',
  'material',
  'equipment',
  'subcontract',
  'other',
];

function zeroCategoryMap(): Record<DailyCostEntry['category'], number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    DailyCostEntry['category'],
    number
  >;
}

/**
 * Record a daily cost entry.
 * Assigns a UUID and createdAt timestamp.
 */
export function recordDailyCost(
  entry: Omit<DailyCostEntry, 'id' | 'createdAt'>,
): DailyCostEntry {
  return {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
}

/**
 * Returns ISO date string (YYYY-MM-DD) for the Monday of the week
 * that contains the given date string.
 */
function getMondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Summarize cost entries for the calendar week that starts on weekStart (Monday).
 * Entries whose Monday is not weekStart are excluded.
 */
export function summarizeWeek(
  entries: DailyCostEntry[],
  weekStart: string,
): WeeklyCostSummary {
  // Determine projectId from first entry if available
  const projectId = entries[0]?.projectId ?? '';

  const weekEntries = entries.filter(
    (e) => getMondayOf(e.date) === weekStart,
  );

  const totalByCategory = zeroCategoryMap();
  for (const e of weekEntries) {
    totalByCategory[e.category] += e.amount;
  }

  return {
    projectId,
    weekStart,
    totalByCategory,
    totalAmount: weekEntries.reduce((sum, e) => sum + e.amount, 0),
    entryCount: weekEntries.length,
  };
}

/**
 * Compute budget consumption and burn-rate projection.
 * @param entries     All cost entries for the project
 * @param budgetTotal Total budget in yen
 * @param projectStartDate YYYY-MM-DD
 * @param projectEndDate   YYYY-MM-DD
 */
export function computeBudgetConsumption(
  entries: DailyCostEntry[],
  budgetTotal: number,
  projectStartDate: string,
  projectEndDate: string,
): BudgetConsumption {
  const projectId = entries[0]?.projectId ?? '';

  const consumedTotal = entries.reduce((sum, e) => sum + e.amount, 0);

  const start = new Date(`${projectStartDate}T00:00:00Z`);
  const end = new Date(`${projectEndDate}T00:00:00Z`);
  const now = new Date();

  // Days elapsed since project start (capped at project duration)
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
  const rawElapsed = Math.round(
    (now.getTime() - start.getTime()) / 86_400_000,
  );
  const daysElapsed = Math.max(1, Math.min(rawElapsed, totalDays));

  const burnRatePerDay = consumedTotal / daysElapsed;
  const projectedTotal = Math.round(burnRatePerDay * totalDays);
  const consumedRate = budgetTotal > 0 ? consumedTotal / budgetTotal : 0;
  const remainingBudget = budgetTotal - consumedTotal;
  const forecastOverrun = projectedTotal - budgetTotal;

  return {
    projectId,
    budgetTotal,
    consumedTotal,
    consumedRate,
    remainingBudget,
    daysElapsed,
    burnRatePerDay: Math.round(burnRatePerDay),
    projectedTotal,
    forecastOverrun,
  };
}
