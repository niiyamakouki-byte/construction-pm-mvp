/** 引合粗利管理ライブラリ（ANDPAD蒸留 P1-4） */
import { escapeHtml } from "./utils/escape-html";

export type DealPhase =
  | '引合'
  | '現調'
  | '見積提出'
  | '商談中'
  | '受注'
  | '施工中'
  | '完工'
  | '請求済'
  | '入金済'
  | '失注';

export const ACTIVE_PHASES: DealPhase[] = [
  '引合',
  '現調',
  '見積提出',
  '商談中',
  '受注',
  '施工中',
];

export const COMPLETED_PHASES: DealPhase[] = ['完工', '請求済', '入金済'];

export type ChangeOrder = {
  id: string;
  description: string;
  amount: number;
  type: 'revenue' | 'cost';
  approvedAt: string;
};

export type DealProfit = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  phase: DealPhase;
  estimatedRevenue: number;
  estimatedCost: number;
  actualRevenue: number;
  actualCost: number;
  changeOrders: ChangeOrder[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type PhaseSummary = {
  phase: DealPhase;
  count: number;
  totalEstimatedRevenue: number;
  totalEstimatedCost: number;
  totalEstimatedGrossProfit: number;
};

export type PipelineSummary = {
  byPhase: PhaseSummary[];
  totalDeals: number;
  totalEstimatedRevenue: number;
  totalEstimatedGrossProfit: number;
};

export type MonthlyProfitTrend = {
  month: string; // YYYY-MM
  completedDeals: number;
  actualRevenue: number;
  actualCost: number;
  actualGrossProfit: number;
  grossProfitRate: number;
};

// In-memory store (per-module singleton, matches project patterns)
const deals: DealProfit[] = [];

/** 新規引合を登録 */
export function createDeal(deal: DealProfit): DealProfit {
  deals.push({ ...deal, changeOrders: [...deal.changeOrders] });
  return deal;
}

/** 引合情報を更新 */
export function updateDeal(
  id: string,
  updates: Partial<Omit<DealProfit, 'id' | 'createdAt'>>,
): DealProfit | null {
  const index = deals.findIndex((d) => d.id === id);
  if (index === -1) return null;
  const updated = { ...deals[index], ...updates, id, createdAt: deals[index].createdAt };
  deals[index] = updated;
  return { ...updated };
}

/** 変更注文を追加 */
export function addChangeOrder(dealId: string, changeOrder: ChangeOrder): DealProfit | null {
  const index = deals.findIndex((d) => d.id === dealId);
  if (index === -1) return null;
  deals[index] = {
    ...deals[index],
    changeOrders: [...deals[index].changeOrders, changeOrder],
    updatedAt: changeOrder.approvedAt,
  };
  return { ...deals[index] };
}

/** フェーズを更新 */
export function updatePhase(
  dealId: string,
  phase: DealPhase,
  updatedAt: string,
): DealProfit | null {
  return updateDeal(dealId, { phase, updatedAt });
}

// ─── 粗利計算 ────────────────────────────────────────────────

/** 変更注文による売上増減合計 */
function changeOrderRevenueDelta(deal: DealProfit): number {
  return deal.changeOrders
    .filter((co) => co.type === 'revenue')
    .reduce((sum, co) => sum + co.amount, 0);
}

/** 変更注文によるコスト増減合計 */
function changeOrderCostDelta(deal: DealProfit): number {
  return deal.changeOrders
    .filter((co) => co.type === 'cost')
    .reduce((sum, co) => sum + co.amount, 0);
}

/** 見積粗利（estimatedRevenue - estimatedCost） */
export function getGrossProfit(deal: DealProfit): number {
  return deal.estimatedRevenue - deal.estimatedCost;
}

/** 実績粗利（actualRevenue + 売上変更注文 - actualCost - コスト変更注文） */
export function getActualGrossProfit(deal: DealProfit): number {
  const revenue = deal.actualRevenue + changeOrderRevenueDelta(deal);
  const cost = deal.actualCost + changeOrderCostDelta(deal);
  return revenue - cost;
}

/** 粗利率（見積ベース）。売上が0の場合は0を返す */
export function getGrossProfitRate(deal: DealProfit): number {
  const revenue = deal.estimatedRevenue;
  if (revenue === 0) return 0;
  return (getGrossProfit(deal) / revenue) * 100;
}

// ─── 一覧取得 ────────────────────────────────────────────────

/** フェーズで絞り込み */
export function getDealsByPhase(phase: DealPhase): DealProfit[] {
  return deals.filter((d) => d.phase === phase).map((d) => ({ ...d }));
}

/** アクティブパイプライン（引合〜施工中） */
export function getActivePipeline(): DealProfit[] {
  return deals
    .filter((d) => (ACTIVE_PHASES as string[]).includes(d.phase))
    .map((d) => ({ ...d }));
}

/** 完了案件（完工・請求済・入金済） */
export function getCompletedDeals(): DealProfit[] {
  return deals
    .filter((d) => (COMPLETED_PHASES as string[]).includes(d.phase))
    .map((d) => ({ ...d }));
}

/** すべての案件を取得 */
export function getAllDeals(): DealProfit[] {
  return deals.map((d) => ({ ...d }));
}

// ─── サマリ ──────────────────────────────────────────────────

/** フェーズ別の件数・金額集計 */
export function getPipelineSummary(): PipelineSummary {
  const allPhases: DealPhase[] = [...ACTIVE_PHASES, ...COMPLETED_PHASES, '失注'];
  const byPhase: PhaseSummary[] = allPhases.map((phase) => {
    const phaseDeals = deals.filter((d) => d.phase === phase);
    const totalEstimatedRevenue = phaseDeals.reduce((sum, d) => sum + d.estimatedRevenue, 0);
    const totalEstimatedCost = phaseDeals.reduce((sum, d) => sum + d.estimatedCost, 0);
    return {
      phase,
      count: phaseDeals.length,
      totalEstimatedRevenue,
      totalEstimatedCost,
      totalEstimatedGrossProfit: totalEstimatedRevenue - totalEstimatedCost,
    };
  });

  const activeDeals = deals.filter((d) => d.phase !== '失注');
  return {
    byPhase,
    totalDeals: activeDeals.length,
    totalEstimatedRevenue: activeDeals.reduce((sum, d) => sum + d.estimatedRevenue, 0),
    totalEstimatedGrossProfit: activeDeals.reduce((sum, d) => sum + getGrossProfit(d), 0),
  };
}

/** 月次粗利推移（完了案件のupdatedAt月でグループ化） */
export function getMonthlyProfitTrend(): MonthlyProfitTrend[] {
  const completed = getCompletedDeals();
  const byMonth = new Map<string, DealProfit[]>();

  for (const deal of completed) {
    const month = deal.updatedAt.slice(0, 7); // YYYY-MM
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(deal);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthDeals]) => {
      const actualRevenue = monthDeals.reduce(
        (sum, d) => sum + d.actualRevenue + changeOrderRevenueDelta(d),
        0,
      );
      const actualCost = monthDeals.reduce(
        (sum, d) => sum + d.actualCost + changeOrderCostDelta(d),
        0,
      );
      const actualGrossProfit = actualRevenue - actualCost;
      return {
        month,
        completedDeals: monthDeals.length,
        actualRevenue,
        actualCost,
        actualGrossProfit,
        grossProfitRate: actualRevenue > 0 ? (actualGrossProfit / actualRevenue) * 100 : 0,
      };
    });
}

// ─── 帳票 ────────────────────────────────────────────────────


function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/** 引合粗利管理ダッシュボードHTML */
export function buildProfitDashboardHtml(): string {
  const summary = getPipelineSummary();
  const trend = getMonthlyProfitTrend();
  const allDeals = getAllDeals();

  const phaseRows = summary.byPhase
    .filter((p) => p.count > 0)
    .map(
      (p) => `<tr>
  <td>${escapeHtml(p.phase)}</td>
  <td>${p.count}</td>
  <td>${formatYen(p.totalEstimatedRevenue)}</td>
  <td>${formatYen(p.totalEstimatedCost)}</td>
  <td>${formatYen(p.totalEstimatedGrossProfit)}</td>
  <td>${p.totalEstimatedRevenue > 0 ? formatRate((p.totalEstimatedGrossProfit / p.totalEstimatedRevenue) * 100) : '—'}</td>
</tr>`,
    )
    .join('\n');

  const dealRows =
    allDeals.length > 0
      ? allDeals
          .map((d) => {
            const rate = getGrossProfitRate(d);
            return `<tr>
  <td>${escapeHtml(d.projectName)}</td>
  <td>${escapeHtml(d.clientName)}</td>
  <td>${escapeHtml(d.phase)}</td>
  <td>${formatYen(d.estimatedRevenue)}</td>
  <td>${formatYen(d.estimatedCost)}</td>
  <td>${formatYen(getGrossProfit(d))}</td>
  <td>${formatRate(rate)}</td>
</tr>`;
          })
          .join('\n')
      : '<tr><td colspan="7">案件がありません</td></tr>';

  const trendRows =
    trend.length > 0
      ? trend
          .map(
            (t) => `<tr>
  <td>${escapeHtml(t.month)}</td>
  <td>${t.completedDeals}</td>
  <td>${formatYen(t.actualRevenue)}</td>
  <td>${formatYen(t.actualCost)}</td>
  <td>${formatYen(t.actualGrossProfit)}</td>
  <td>${formatRate(t.grossProfitRate)}</td>
</tr>`,
          )
          .join('\n')
      : '<tr><td colspan="6">データなし</td></tr>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>引合粗利管理ダッシュボード</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    h2 { font-size: 1.1rem; margin-top: 24px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #111827; color: white; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
    .card { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; background: #f9fafb; }
    .card-label { font-size: 0.75rem; color: #6b7280; }
    .card-value { font-size: 1.25rem; font-weight: bold; margin-top: 4px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>引合粗利管理ダッシュボード</h1>
  <div class="summary">
    <div class="card">
      <div class="card-label">アクティブ案件数</div>
      <div class="card-value">${summary.totalDeals}</div>
    </div>
    <div class="card">
      <div class="card-label">パイプライン合計（見積売上）</div>
      <div class="card-value">${formatYen(summary.totalEstimatedRevenue)}</div>
    </div>
    <div class="card">
      <div class="card-label">パイプライン粗利合計</div>
      <div class="card-value">${formatYen(summary.totalEstimatedGrossProfit)}</div>
    </div>
  </div>

  <h2>フェーズ別サマリ</h2>
  <table>
    <thead>
      <tr>
        <th>フェーズ</th>
        <th>件数</th>
        <th>見積売上合計</th>
        <th>見積原価合計</th>
        <th>見積粗利合計</th>
        <th>粗利率</th>
      </tr>
    </thead>
    <tbody>
      ${phaseRows || '<tr><td colspan="6">データなし</td></tr>'}
    </tbody>
  </table>

  <h2>案件一覧</h2>
  <table>
    <thead>
      <tr>
        <th>案件名</th>
        <th>顧客名</th>
        <th>フェーズ</th>
        <th>見積売上</th>
        <th>見積原価</th>
        <th>見積粗利</th>
        <th>粗利率</th>
      </tr>
    </thead>
    <tbody>
      ${dealRows}
    </tbody>
  </table>

  <h2>月次粗利推移</h2>
  <table>
    <thead>
      <tr>
        <th>月</th>
        <th>完了件数</th>
        <th>実績売上</th>
        <th>実績原価</th>
        <th>実績粗利</th>
        <th>粗利率</th>
      </tr>
    </thead>
    <tbody>
      ${trendRows}
    </tbody>
  </table>
</body>
</html>`;
}

/** テスト用クリア */
export function clearDeals(): void {
  deals.length = 0;
}

// ─── 3軸ダッシュボード ────────────────────────────────────────

export type ThreeAxisSummary = {
  /** 過去実績: 完工+請求済+入金済の粗利合計 */
  pastActual: {
    deals: DealProfit[];
    totalActualRevenue: number;
    totalActualCost: number;
    totalActualGrossProfit: number;
    grossProfitRate: number;
    byPhase: { phase: DealPhase; count: number; totalGrossProfit: number }[];
  };
  /** 今月着地: 今月updatedAtの施工中/受注案件の見込粗利 */
  thisMonthLanding: {
    deals: DealProfit[];
    totalEstimatedRevenue: number;
    totalEstimatedGrossProfit: number;
    grossProfitRate: number;
    byPhase: { phase: DealPhase; count: number; totalGrossProfit: number }[];
  };
  /** 来月見込: それ以外のアクティブ案件パイプライン */
  nextMonthPipeline: {
    deals: DealProfit[];
    totalEstimatedRevenue: number;
    totalEstimatedGrossProfit: number;
    grossProfitRate: number;
    byPhase: { phase: DealPhase; count: number; totalGrossProfit: number }[];
  };
  /** 粗利率前月比トレンド（+/-/0） */
  trendDirection: 'up' | 'down' | 'flat';
  trendDiff: number; // percentage points
};

/** 今月のYYYY-MMを返す（テストでDI可能にするため引数で受ける） */
function getCurrentMonth(now?: Date): string {
  const d = now ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 前月のYYYY-MMを返す */
function getPrevMonth(now?: Date): string {
  const d = now ?? new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function phaseSummary(
  phaseDeals: DealProfit[],
  grossFn: (d: DealProfit) => number,
): { phase: DealPhase; count: number; totalGrossProfit: number }[] {
  const map = new Map<DealPhase, { count: number; totalGrossProfit: number }>();
  for (const d of phaseDeals) {
    const prev = map.get(d.phase) ?? { count: 0, totalGrossProfit: 0 };
    map.set(d.phase, {
      count: prev.count + 1,
      totalGrossProfit: prev.totalGrossProfit + grossFn(d),
    });
  }
  return [...map.entries()].map(([phase, v]) => ({ phase, ...v }));
}

/** 3軸ダッシュボード用サマリを計算 */
export function calcThreeAxisSummary(
  allDeals: DealProfit[],
  now?: Date,
): ThreeAxisSummary {
  const currentMonth = getCurrentMonth(now);
  const prevMonth = getPrevMonth(now);

  // 過去実績
  const pastDeals = allDeals.filter((d) =>
    (COMPLETED_PHASES as string[]).includes(d.phase),
  );
  const pastRevenue = pastDeals.reduce(
    (s, d) => s + d.actualRevenue + changeOrderRevenueDelta(d),
    0,
  );
  const pastCost = pastDeals.reduce(
    (s, d) => s + d.actualCost + changeOrderCostDelta(d),
    0,
  );
  const pastGP = pastRevenue - pastCost;

  // 今月着地: 今月updatedAtの施工中/受注案件
  const landingPhases: DealPhase[] = ['受注', '施工中'];
  const thisMonthDeals = allDeals.filter(
    (d) =>
      (landingPhases as string[]).includes(d.phase) &&
      d.updatedAt.slice(0, 7) === currentMonth,
  );
  const thisRevenue = thisMonthDeals.reduce((s, d) => s + d.estimatedRevenue, 0);
  const thisGP = thisMonthDeals.reduce((s, d) => s + getGrossProfit(d), 0);

  // 来月見込: アクティブ案件のうち今月着地に含まれない案件
  const thisMonthIds = new Set(thisMonthDeals.map((d) => d.id));
  const nextDeals = allDeals.filter(
    (d) =>
      (ACTIVE_PHASES as string[]).includes(d.phase) &&
      !thisMonthIds.has(d.id),
  );
  const nextRevenue = nextDeals.reduce((s, d) => s + d.estimatedRevenue, 0);
  const nextGP = nextDeals.reduce((s, d) => s + getGrossProfit(d), 0);

  // 前月比トレンド（完了案件の月次粗利率で比較）
  const completedByMonth = new Map<string, DealProfit[]>();
  for (const d of pastDeals) {
    const m = d.updatedAt.slice(0, 7);
    if (!completedByMonth.has(m)) completedByMonth.set(m, []);
    completedByMonth.get(m)!.push(d);
  }
  function monthRate(month: string): number | null {
    const ds = completedByMonth.get(month);
    if (!ds || ds.length === 0) return null;
    const rev = ds.reduce((s, d) => s + d.actualRevenue + changeOrderRevenueDelta(d), 0);
    const cost = ds.reduce((s, d) => s + d.actualCost + changeOrderCostDelta(d), 0);
    return rev > 0 ? ((rev - cost) / rev) * 100 : null;
  }
  const curRate = monthRate(currentMonth);
  const prevRate = monthRate(prevMonth);
  let trendDirection: ThreeAxisSummary['trendDirection'] = 'flat';
  let trendDiff = 0;
  if (curRate !== null && prevRate !== null) {
    trendDiff = curRate - prevRate;
    if (trendDiff > 0.05) trendDirection = 'up';
    else if (trendDiff < -0.05) trendDirection = 'down';
  }

  return {
    pastActual: {
      deals: pastDeals,
      totalActualRevenue: pastRevenue,
      totalActualCost: pastCost,
      totalActualGrossProfit: pastGP,
      grossProfitRate: pastRevenue > 0 ? (pastGP / pastRevenue) * 100 : 0,
      byPhase: phaseSummary(pastDeals, getActualGrossProfit),
    },
    thisMonthLanding: {
      deals: thisMonthDeals,
      totalEstimatedRevenue: thisRevenue,
      totalEstimatedGrossProfit: thisGP,
      grossProfitRate: thisRevenue > 0 ? (thisGP / thisRevenue) * 100 : 0,
      byPhase: phaseSummary(thisMonthDeals, getGrossProfit),
    },
    nextMonthPipeline: {
      deals: nextDeals,
      totalEstimatedRevenue: nextRevenue,
      totalEstimatedGrossProfit: nextGP,
      grossProfitRate: nextRevenue > 0 ? (nextGP / nextRevenue) * 100 : 0,
      byPhase: phaseSummary(nextDeals, getGrossProfit),
    },
    trendDirection,
    trendDiff,
  };
}

/** 3軸ダッシュボードHTMLを生成 */
export function buildThreeAxisDashboardHtml(
  allDeals: DealProfit[],
  now?: Date,
): string {
  const s = calcThreeAxisSummary(allDeals, now);

  const trendArrow =
    s.trendDirection === 'up' ? '▲' : s.trendDirection === 'down' ? '▼' : '─';
  const trendColor =
    s.trendDirection === 'up' ? '#16a34a' : s.trendDirection === 'down' ? '#dc2626' : '#6b7280';
  const trendLabel =
    s.trendDirection === 'up'
      ? `${trendArrow} +${s.trendDiff.toFixed(1)}pt`
      : s.trendDirection === 'down'
        ? `${trendArrow} ${s.trendDiff.toFixed(1)}pt`
        : `${trendArrow} 前月比変化なし`;

  function phaseRows(
    rows: { phase: DealPhase; count: number; totalGrossProfit: number }[],
  ): string {
    if (rows.length === 0) return '<tr><td colspan="3">—</td></tr>';
    return rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.phase)}</td><td>${r.count}</td><td>${formatYen(r.totalGrossProfit)}</td></tr>`,
      )
      .join('\n');
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>粗利3軸ダッシュボード</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    h2 { font-size: 1.1rem; margin-top: 24px; margin-bottom: 8px; }
    h3 { font-size: 0.95rem; margin-top: 16px; margin-bottom: 4px; color: #374151; }
    .axes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
    .axis-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background: #f9fafb; }
    .axis-title { font-size: 0.8rem; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .axis-value { font-size: 1.5rem; font-weight: bold; margin-top: 6px; }
    .axis-sub { font-size: 0.85rem; color: #6b7280; margin-top: 2px; }
    .trend { font-size: 1rem; font-weight: bold; color: ${trendColor}; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 0.85rem; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
    th { background: #374151; color: white; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>粗利3軸ダッシュボード</h1>
  <p class="trend">粗利率前月比: ${escapeHtml(trendLabel)}</p>

  <div class="axes">
    <!-- 過去実績 -->
    <div class="axis-card">
      <div class="axis-title">過去実績</div>
      <div class="axis-value">${formatYen(s.pastActual.totalActualGrossProfit)}</div>
      <div class="axis-sub">粗利率 ${formatRate(s.pastActual.grossProfitRate)} / ${s.pastActual.deals.length}件</div>
      <div class="axis-sub">売上 ${formatYen(s.pastActual.totalActualRevenue)}</div>
      <h3>フェーズ別内訳</h3>
      <table>
        <thead><tr><th>フェーズ</th><th>件数</th><th>実績粗利</th></tr></thead>
        <tbody>${phaseRows(s.pastActual.byPhase)}</tbody>
      </table>
    </div>

    <!-- 今月着地 -->
    <div class="axis-card">
      <div class="axis-title">今月着地</div>
      <div class="axis-value">${formatYen(s.thisMonthLanding.totalEstimatedGrossProfit)}</div>
      <div class="axis-sub">粗利率 ${formatRate(s.thisMonthLanding.grossProfitRate)} / ${s.thisMonthLanding.deals.length}件</div>
      <div class="axis-sub">見積売上 ${formatYen(s.thisMonthLanding.totalEstimatedRevenue)}</div>
      <h3>フェーズ別内訳</h3>
      <table>
        <thead><tr><th>フェーズ</th><th>件数</th><th>見込粗利</th></tr></thead>
        <tbody>${phaseRows(s.thisMonthLanding.byPhase)}</tbody>
      </table>
    </div>

    <!-- 来月見込 -->
    <div class="axis-card">
      <div class="axis-title">来月見込</div>
      <div class="axis-value">${formatYen(s.nextMonthPipeline.totalEstimatedGrossProfit)}</div>
      <div class="axis-sub">粗利率 ${formatRate(s.nextMonthPipeline.grossProfitRate)} / ${s.nextMonthPipeline.deals.length}件</div>
      <div class="axis-sub">パイプライン ${formatYen(s.nextMonthPipeline.totalEstimatedRevenue)}</div>
      <h3>フェーズ別内訳</h3>
      <table>
        <thead><tr><th>フェーズ</th><th>件数</th><th>見込粗利</th></tr></thead>
        <tbody>${phaseRows(s.nextMonthPipeline.byPhase)}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
