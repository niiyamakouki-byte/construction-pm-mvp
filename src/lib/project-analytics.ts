/**
 * 案件横断アナリティクス - ANDPADブラウザ蒸留
 * 経営ダッシュボード・KPI・月次推移・ランキング・アラート
 */

// ── 型定義 ────────────────────────────────────────────

export type AnalyticsPeriod = "monthly" | "quarterly" | "yearly";

export type ProjectKPI = {
  projectId: string;
  projectName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitRate: number;
  completionRate: number;
  manDaysPlanned: number;
  manDaysActual: number;
  photoCount: number;
  correctionCount: number;
  safetyIncidents: number;
};

export type ProjectInput = {
  projectId: string;
  projectName: string;
  revenue: number;
  cost: number;
  completionRate?: number;
  manDaysPlanned?: number;
  manDaysActual?: number;
  photoCount?: number;
  correctionCount?: number;
  safetyIncidents?: number;
};

export type CompanyDashboard = {
  totalRevenue: number;
  totalCost: number;
  totalGrossProfit: number;
  averageGrossProfitRate: number;
  projectCount: number;
  activeProjectCount: number;
};

export type MonthlyTrendPoint = {
  month: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitRate: number;
};

export type RankingEntry = {
  rank: number;
  projectId: string;
  projectName: string;
  value: number;
};

export type AlertLevel = "warning" | "critical";

export type AnalyticsAlert = {
  projectId: string;
  projectName: string;
  level: AlertLevel;
  type: "negative_profit" | "progress_delay" | "correction_unresolved" | "safety_incident";
  message: string;
};

// ── 内部ストア（テスト用に差し替え可能） ─────────────

let _projectStore: ProjectInput[] = [];

/** テスト用: プロジェクトデータを差し替える */
export function setProjectStore(projects: ProjectInput[]): void {
  _projectStore = projects;
}

/** テスト用: ストアをリセット */
export function clearProjectStore(): void {
  _projectStore = [];
}

// ── KPI計算ユーティリティ ──────────────────────────────

function calcKPI(p: ProjectInput): ProjectKPI {
  const grossProfit = p.revenue - p.cost;
  const grossProfitRate = p.revenue > 0 ? (grossProfit / p.revenue) * 100 : 0;
  return {
    projectId: p.projectId,
    projectName: p.projectName,
    revenue: p.revenue,
    cost: p.cost,
    grossProfit,
    grossProfitRate: Math.round(grossProfitRate * 100) / 100,
    completionRate: p.completionRate ?? 0,
    manDaysPlanned: p.manDaysPlanned ?? 0,
    manDaysActual: p.manDaysActual ?? 0,
    photoCount: p.photoCount ?? 0,
    correctionCount: p.correctionCount ?? 0,
    safetyIncidents: p.safetyIncidents ?? 0,
  };
}

// ── 公開API ───────────────────────────────────────────

/**
 * 複数プロジェクトのKPIを一括取得する。
 * projectIdsが空の場合はストア全件を返す。
 */
export function getProjectKPIs(projectIds: string[] = []): ProjectKPI[] {
  const targets =
    projectIds.length === 0
      ? _projectStore
      : _projectStore.filter((p) => projectIds.includes(p.projectId));
  return targets.map(calcKPI);
}

/**
 * 全案件の経営ダッシュボード集計を返す。
 * activeProjectCount は completionRate < 100 の案件数。
 */
export function getCompanyDashboard(): CompanyDashboard {
  const kpis = getProjectKPIs();
  const totalRevenue = kpis.reduce((s, k) => s + k.revenue, 0);
  const totalCost = kpis.reduce((s, k) => s + k.cost, 0);
  const totalGrossProfit = totalRevenue - totalCost;
  const averageGrossProfitRate =
    totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue) * 10000) / 100 : 0;
  const activeProjectCount = kpis.filter((k) => k.completionRate < 100).length;

  return {
    totalRevenue,
    totalCost,
    totalGrossProfit,
    averageGrossProfitRate,
    projectCount: kpis.length,
    activeProjectCount,
  };
}

/**
 * 月別KPI推移を生成する。
 * 実際の月次データがない場合は、ストアデータを均等に月割りした模擬推移を返す。
 * months: 取得する月数（デフォルト6）
 */
export function getMonthlyTrend(months = 6): MonthlyTrendPoint[] {
  const kpis = getProjectKPIs();
  const totalRevenue = kpis.reduce((s, k) => s + k.revenue, 0);
  const totalCost = kpis.reduce((s, k) => s + k.cost, 0);

  const now = new Date();
  const result: MonthlyTrendPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    // 均等月割り（実運用ではDBから月次実績を取る）
    const revenue = Math.round(totalRevenue / months);
    const cost = Math.round(totalCost / months);
    const grossProfit = revenue - cost;
    const grossProfitRate = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
    result.push({ month: label, revenue, cost, grossProfit, grossProfitRate });
  }

  return result;
}

export type RankingMetric =
  | "grossProfitRate"
  | "grossProfit"
  | "revenue"
  | "completionRate"
  | "safetyIncidents";

/**
 * 指標別の案件ランキングを返す。
 * limit: 取得件数（デフォルト5）
 */
export function getRankings(metric: RankingMetric, limit = 5): RankingEntry[] {
  const kpis = getProjectKPIs();
  const sorted = [...kpis].sort((a, b) => b[metric] - a[metric]);
  return sorted.slice(0, limit).map((k, i) => ({
    rank: i + 1,
    projectId: k.projectId,
    projectName: k.projectName,
    value: k[metric],
  }));
}

/**
 * 異常値アラートを検知する。
 * - 粗利率マイナス (critical)
 * - 進捗遅延: completionRate < 30% かつ manDaysActual > manDaysPlanned (warning)
 * - 是正未対応: correctionCount > 0 (warning)
 * - 安全インシデント: safetyIncidents > 0 (critical)
 */
export function getAlerts(): AnalyticsAlert[] {
  const kpis = getProjectKPIs();
  const alerts: AnalyticsAlert[] = [];

  for (const k of kpis) {
    if (k.grossProfit < 0) {
      alerts.push({
        projectId: k.projectId,
        projectName: k.projectName,
        level: "critical",
        type: "negative_profit",
        message: `粗利がマイナスです (${k.grossProfitRate.toFixed(1)}%)`,
      });
    }

    if (k.completionRate < 30 && k.manDaysActual > k.manDaysPlanned && k.manDaysPlanned > 0) {
      alerts.push({
        projectId: k.projectId,
        projectName: k.projectName,
        level: "warning",
        type: "progress_delay",
        message: `進捗遅延: 進捗${k.completionRate}% / 工数超過`,
      });
    }

    if (k.correctionCount > 0) {
      alerts.push({
        projectId: k.projectId,
        projectName: k.projectName,
        level: "warning",
        type: "correction_unresolved",
        message: `是正未対応が${k.correctionCount}件あります`,
      });
    }

    if (k.safetyIncidents > 0) {
      alerts.push({
        projectId: k.projectId,
        projectName: k.projectName,
        level: "critical",
        type: "safety_incident",
        message: `安全インシデントが${k.safetyIncidents}件発生しています`,
      });
    }
  }

  return alerts;
}

/**
 * 経営ダッシュボードHTMLを生成する。
 */
export function buildAnalyticsDashboardHtml(): string {
  const dashboard = getCompanyDashboard();
  const rankings = getRankings("grossProfitRate", 5);
  const alerts = getAlerts();

  const alertRows = alerts
    .map((a) => {
      const color = a.level === "critical" ? "#ef4444" : "#f59e0b";
      return `<tr style="border-left:4px solid ${color}"><td>${a.projectName}</td><td>${a.message}</td></tr>`;
    })
    .join("\n");

  const rankingRows = rankings
    .map(
      (r) =>
        `<tr><td>${r.rank}</td><td>${r.projectName}</td><td>${r.value.toFixed(1)}%</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>経営ダッシュボード</title>
<style>
body{font-family:sans-serif;padding:2rem;max-width:960px;margin:0 auto;color:#1f2937}
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0}
.kpi-card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem}
.kpi-card h3{margin:0 0 .5rem;font-size:.875rem;color:#6b7280}
.kpi-card p{margin:0;font-size:1.5rem;font-weight:700;color:#111827}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left}
th{background:#f3f4f6;font-weight:600}
h2{border-bottom:2px solid #e5e7eb;padding-bottom:.5rem}
</style></head>
<body>
<h1>経営ダッシュボード</h1>
<div class="kpi-grid">
  <div class="kpi-card"><h3>売上合計</h3><p>¥${dashboard.totalRevenue.toLocaleString()}</p></div>
  <div class="kpi-card"><h3>粗利合計</h3><p>¥${dashboard.totalGrossProfit.toLocaleString()}</p></div>
  <div class="kpi-card"><h3>平均粗利率</h3><p>${dashboard.averageGrossProfitRate}%</p></div>
  <div class="kpi-card"><h3>案件数</h3><p>${dashboard.projectCount}件</p></div>
  <div class="kpi-card"><h3>進行中</h3><p>${dashboard.activeProjectCount}件</p></div>
  <div class="kpi-card"><h3>原価合計</h3><p>¥${dashboard.totalCost.toLocaleString()}</p></div>
</div>
<h2>粗利率ランキング TOP${rankings.length}</h2>
<table>
<thead><tr><th>順位</th><th>案件名</th><th>粗利率</th></tr></thead>
<tbody>${rankingRows}</tbody>
</table>
<h2>アラート (${alerts.length}件)</h2>
${
  alerts.length === 0
    ? "<p>異常なし</p>"
    : `<table><thead><tr><th>案件名</th><th>内容</th></tr></thead><tbody>${alertRows}</tbody></table>`
}
</body></html>`;
}
