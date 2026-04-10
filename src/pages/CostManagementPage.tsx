import { useCallback, useEffect, useMemo, useState } from "react";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { BudgetDashboard } from "../components/BudgetDashboard.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import {
  buildProjectCostRows,
  getProjectBudgetSummary,
  groupCostRowsByCategory,
  summarizeCostRows,
  type CostRow,
} from "../lib/cost-management.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";
import {
  calculateOverheadCosts,
  generateForecastReport,
  type MonthlyData,
  type OverheadBreakdown,
} from "../lib/cost-forecaster.js";
import {
  calculateEarnedValue,
  type EarnedValueMetrics,
} from "../lib/earned-value.js";
import {
  calculateWaste,
  forecastNeeded,
  getDeliveries,
} from "../lib/material-tracker.js";
import {
  getPaymentSchedule,
  calculateOutstanding,
  type PaymentScheduleEntry,
} from "../lib/payment-tracker.js";
import { daysBetween } from "../components/gantt/utils.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const breakdownLabel = {
  task_cost: "タスク原価",
  material_cost: "材料費",
  change_order_cost: "変更注文",
  invoice_received: "受領請求",
} as const;

const paymentStatusLabel = {
  paid: "支払済",
  unpaid: "未払い",
} as const;

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatCostDate(date: string): string {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${year}/${month}/${day}`;
}

function buildMonthlyCostSeries(project: Project | null, rows: CostRow[]): MonthlyData[] {
  if (!project || rows.length === 0) return [];

  const monthlyTotals = new Map<string, number>();
  for (const row of rows) {
    const monthKey = row.date.slice(0, 7);
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + row.amount);
  }

  const months = Array.from(monthlyTotals.keys()).sort();
  const budgetPerMonth = months.length > 0
    ? Math.round((project.budget ?? 0) / months.length)
    : 0;

  return months.map((month) => ({
    month,
    actualCost: monthlyTotals.get(month) ?? 0,
    budgetedCost: budgetPerMonth,
  }));
}

function getRemainingProjectDays(project: Project | null, tasks: Task[], today: string): number {
  if (!project) return 30;

  const endDate = [
    project.endDate,
    ...tasks.map((task) => task.dueDate ?? task.startDate),
  ]
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)
    ?? today;

  return Math.max(0, daysBetween(today, endDate));
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold tracking-[0.16em]">{label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function CategoryTable({ category, rows }: { category: string; rows: CostRow[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{category}</h2>
          <p className="mt-1 text-sm text-slate-500">{rows.length}件</p>
        </div>
        <p className="text-sm font-bold tabular-nums text-slate-900">
          {formatCurrency(rows.reduce((sum, row) => sum + row.amount, 0))}
        </p>
      </div>
      <div className="responsive-table overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-5 py-3">日付</th>
              <th className="px-5 py-3">内容</th>
              <th className="px-5 py-3 text-right">金額</th>
              <th className="px-5 py-3 text-center">支払状況</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 text-sm text-slate-700">
                <td className="px-5 py-4 tabular-nums text-slate-500">{formatCostDate(row.date)}</td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{row.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{breakdownLabel[row.breakdownType]}</p>
                </td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-5 py-4 text-center">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      row.paymentStatus === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {paymentStatusLabel[row.paymentStatus]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CostManagementPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const costItemRepository = useMemo(() => createCostItemRepository(() => organizationId), [organizationId]);
  const expenseRepository = useMemo(
    () => createAppRepository<Expense>("expenses", () => organizationId),
    [organizationId],
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(readLastProjectId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allProjects, allTasks, allCostItems, allExpenses] = await Promise.all([
        projectRepository.findAll(),
        taskRepository.findAll(),
        costItemRepository.findAll(),
        expenseRepository.findAll(),
      ]);

      setProjects(allProjects);
      setTasks(allTasks);
      setCostItems(allCostItems);
      setExpenses(allExpenses);
      setSelectedProjectId((current) => {
        const candidates = [current, readLastProjectId()].filter(Boolean) as string[];
        const matched = candidates.find((candidate) => allProjects.some((project) => project.id === candidate));
        if (matched) return matched;
        const preferred = allProjects.find((project) => project.status === "active") ?? allProjects[0];
        return preferred?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "コスト情報の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [costItemRepository, expenseRepository, projectRepository, taskRepository]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedProjectId) return;
    writeLastProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const projectCostRows = useMemo(
    () =>
      selectedProjectId
        ? buildProjectCostRows(selectedProjectId, { tasks, costItems, expenses })
        : [],
    [costItems, expenses, selectedProjectId, tasks],
  );
  const summary = useMemo(() => summarizeCostRows(projectCostRows), [projectCostRows]);
  const budgetSummary = useMemo(
    () => getProjectBudgetSummary(selectedProject, projectCostRows),
    [projectCostRows, selectedProject],
  );
  const categoryGroups = useMemo(() => groupCostRowsByCategory(projectCostRows), [projectCostRows]);
  const selectedProjectTasks = useMemo(
    () => tasks.filter((task) => task.projectId === selectedProjectId),
    [selectedProjectId, tasks],
  );
  const monthlyCostSeries = useMemo(
    () => buildMonthlyCostSeries(selectedProject, projectCostRows),
    [projectCostRows, selectedProject],
  );
  const forecastReport = useMemo(
    () => (
      selectedProject
        ? generateForecastReport(
          selectedProject,
          selectedProjectTasks,
          expenses.filter((expense) => expense.projectId === selectedProject.id),
          monthlyCostSeries,
        )
        : null
    ),
    [expenses, monthlyCostSeries, selectedProject, selectedProjectTasks],
  );
  const overheadBreakdown = useMemo<OverheadBreakdown | null>(
    () => (summary.total > 0 ? calculateOverheadCosts(summary.total) : null),
    [summary.total],
  );
  const paymentSchedule = useMemo<PaymentScheduleEntry[]>(
    () => (selectedProjectId ? getPaymentSchedule(selectedProjectId) : []),
    [selectedProjectId],
  );
  const earnedValueMetrics = useMemo<EarnedValueMetrics | null>(
    () =>
      selectedProject && selectedProjectTasks.length > 0
        ? calculateEarnedValue(selectedProjectTasks, selectedProject.budget ?? 0)
        : null,
    [selectedProject, selectedProjectTasks],
  );
  const outstandingAmount = useMemo<number>(
    () => (selectedProjectId ? calculateOutstanding(selectedProjectId) : 0),
    [selectedProjectId],
  );
  const materialDeliveries = useMemo(
    () => (selectedProjectId ? getDeliveries(selectedProjectId) : []),
    [selectedProjectId],
  );
  const materialForecasts = useMemo(
    () => (
      selectedProjectId
        ? forecastNeeded(
          selectedProjectId,
          getRemainingProjectDays(selectedProject, selectedProjectTasks, new Date().toISOString().slice(0, 10)),
        )
        : []
    ),
    [selectedProject, selectedProjectId, selectedProjectTasks],
  );
  const materialWaste = useMemo(
    () => (selectedProjectId ? calculateWaste(selectedProjectId) : []),
    [selectedProjectId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">コスト情報を読み込み中...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">コスト管理</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">案件を作成するとコスト管理を始められます。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-[linear-gradient(145deg,#f8fbff_0%,#fffaf2_55%,#f3f9f7_100%)] px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">コスト</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">コスト管理</h1>
            <p className="mt-2 text-sm text-slate-500">案件ごとの予算、支払状況、カテゴリ別コストを一覧で確認できます。</p>
          </div>
          <div className="w-full sm:w-80">
            <label htmlFor="cost-project-select" className="block text-xs font-semibold tracking-[0.16em] text-slate-500">
              案件選択
            </label>
            <select
              id="cost-project-select"
              value={selectedProjectId ?? ""}
              onChange={(event) => setSelectedProjectId(event.target.value || null)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
      {error ? (
        <div role="alert" className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="総予算" value={formatCurrency(budgetSummary.budget)} tone="border-slate-200 bg-white text-slate-900" />
        <StatCard label="総支出" value={formatCurrency(budgetSummary.spent)} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
        <StatCard label="残予算" value={formatCurrency(budgetSummary.remaining)} tone="border-amber-200 bg-amber-50 text-amber-900" />
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">予測</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">コスト予測トレンド</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              forecastReport?.riskLevel === "high"
                ? "bg-red-50 text-red-700"
                : forecastReport?.riskLevel === "medium"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            }`}>
              {forecastReport?.riskLevel === "high"
                ? "High Risk"
                : forecastReport?.riskLevel === "medium"
                  ? "Medium Risk"
                  : "Low Risk"}
            </span>
          </div>
          {forecastReport ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="予測最終原価"
                  value={formatCurrency(forecastReport.predictedFinalCost)}
                  tone="border-slate-200 bg-slate-50 text-slate-900"
                />
                <StatCard
                  label="次月予測"
                  value={formatCurrency(forecastReport.trend.projectedNext)}
                  tone="border-slate-200 bg-white text-slate-900"
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>進捗率</span>
                  <span className="font-semibold tabular-nums text-slate-900">{forecastReport.completionPct}%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>トレンド</span>
                  <span className="font-semibold text-slate-900">
                    {forecastReport.trend.trend === "increasing"
                      ? "増加傾向"
                      : forecastReport.trend.trend === "decreasing"
                        ? "減少傾向"
                        : "安定"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>予算差</span>
                  <span className={`font-semibold tabular-nums ${
                    forecastReport.overUnder > 0 ? "text-red-600" : "text-emerald-600"
                  }`}>
                    {forecastReport.overUnder > 0 ? "+" : ""}
                    {formatCurrency(forecastReport.overUnder)}
                  </span>
                </div>
              </div>
              <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {forecastReport.recommendations[0]}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">予測対象の案件データがありません。</p>
          )}
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">資材</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">資材配送ステータス</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {materialDeliveries.length}件
            </span>
          </div>
          {materialDeliveries.length > 0 ? (
            <div className="mt-4 space-y-3">
              {materialDeliveries.slice(0, 3).map((delivery) => (
                <div key={delivery.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{delivery.materialName}</p>
                      <p className="text-xs text-slate-500">
                        {delivery.quantity}
                        {delivery.unit}
                        {" "}
                        ·
                        {" "}
                        {formatCostDate(delivery.deliveryDate)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      delivery.inspectionPassed
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {delivery.inspectionPassed ? "検収済" : "要確認"}
                    </span>
                  </div>
                </div>
              ))}
              {materialForecasts.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600">
                  補充目安:
                  {" "}
                  {materialForecasts[0].materialName}
                  {" "}
                  /
                  {" "}
                  残
                  {" "}
                  {Number.isFinite(materialForecasts[0].daysRemaining) ? `${materialForecasts[0].daysRemaining}日` : "十分"}
                  {" "}
                  /
                  {" "}
                  追加見込
                  {" "}
                  {materialForecasts[0].forecastedNeed}
                  {materialForecasts[0].unit}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
              material-tracker に配送データが入ると、納品状況と補充見込みを表示します。
            </p>
          )}
          {materialWaste.length > 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              ロス率:
              {" "}
              {materialWaste[0].materialName}
              {" "}
              {materialWaste[0].wastePercentage.toFixed(1)}%
            </p>
          ) : null}
        </article>
      </section>
      {/* Overhead Cost Breakdown */}
      {overheadBreakdown && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">諸経費</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">諸経費内訳</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <StatCard
              label={`現場管理費 (${(overheadBreakdown.rates.siteManagement * 100).toFixed(0)}%)`}
              value={formatCurrency(overheadBreakdown.siteManagement)}
              tone="border-slate-200 bg-white text-slate-900"
            />
            <StatCard
              label={`一般管理費 (${(overheadBreakdown.rates.generalAdmin * 100).toFixed(0)}%)`}
              value={formatCurrency(overheadBreakdown.generalAdmin)}
              tone="border-slate-200 bg-white text-slate-900"
            />
            <StatCard
              label={`設計料 (${(overheadBreakdown.rates.designFee * 100).toFixed(0)}%)`}
              value={formatCurrency(overheadBreakdown.designFee)}
              tone="border-slate-200 bg-white text-slate-900"
            />
            <StatCard
              label="諸経費込み合計"
              value={formatCurrency(overheadBreakdown.grandTotal)}
              tone="border-brand-200 bg-brand-50 text-brand-900"
            />
          </div>
        </section>
      )}

      {/* Payment Tracker */}
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">支払管理</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">支払スケジュール</h2>
          </div>
          {outstandingAmount > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              未払残: {formatCurrency(outstandingAmount)}
            </span>
          )}
        </div>
        {paymentSchedule.length > 0 ? (
          <div className="responsive-table mt-4 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">支払日</th>
                  <th className="px-5 py-3">業者</th>
                  <th className="px-5 py-3 text-right">金額</th>
                  <th className="px-5 py-3 text-center">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {paymentSchedule.map((entry) => (
                  <tr key={entry.payment.id} className="border-t border-slate-100 text-sm text-slate-700">
                    <td className="px-5 py-4 tabular-nums text-slate-500">{formatCostDate(entry.dueDate)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{entry.payment.vendor}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                      {formatCurrency(entry.payment.amount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        entry.payment.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : entry.payment.status === "overdue"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}>
                        {entry.payment.status === "paid" ? "支払済" : entry.payment.status === "overdue" ? "期限超過" : "未払い"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
            payment-tracker に支払データが入ると、スケジュールと未払残を表示します。
          </p>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">支払サマリー</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{selectedProject?.name ?? "案件未選択"}</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {projectCostRows.length}件
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatCard label="総額" value={formatCurrency(summary.total)} tone="border-slate-200 bg-slate-50 text-slate-900" />
          <StatCard label="支払済" value={formatCurrency(summary.paid)} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
          <StatCard label="未払い" value={formatCurrency(summary.unpaid)} tone="border-amber-200 bg-amber-50 text-amber-900" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <StatCard label="タスク原価" value={formatCurrency(summary.byBreakdown.taskCost)} tone="border-slate-200 bg-white text-slate-900" />
          <StatCard label="材料費" value={formatCurrency(summary.byBreakdown.materialCost)} tone="border-slate-200 bg-white text-slate-900" />
          <StatCard label="変更注文" value={formatCurrency(summary.byBreakdown.changeOrderCost)} tone="border-slate-200 bg-white text-slate-900" />
          <StatCard label="受領請求" value={formatCurrency(summary.byBreakdown.invoicesReceived)} tone="border-slate-200 bg-white text-slate-900" />
        </div>
      </section>
      {earnedValueMetrics ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">アーンドバリュー分析</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">EVM 進捗指標</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="EV（出来高）" value={formatCurrency(earnedValueMetrics.ev)} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
            <StatCard label="PV（計画出来高）" value={formatCurrency(earnedValueMetrics.pv)} tone="border-blue-200 bg-blue-50 text-blue-900" />
            <StatCard label="BAC（完成時予算）" value={formatCurrency(earnedValueMetrics.bac)} tone="border-slate-200 bg-slate-50 text-slate-900" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">実績進捗率</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{earnedValueMetrics.percentComplete.toFixed(1)}%</p>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${earnedValueMetrics.percentComplete}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">計画進捗率</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{earnedValueMetrics.plannedPercentComplete.toFixed(1)}%</p>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${earnedValueMetrics.plannedPercentComplete}%` }} />
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <BudgetDashboard
        projectName={selectedProject?.name ?? ""}
        categories={[
          { name: "人件費", estimated: Math.round((selectedProject?.budget ?? 0) * 0.4), actual: summary.byBreakdown.taskCost },
          { name: "資材費", estimated: Math.round((selectedProject?.budget ?? 0) * 0.25), actual: summary.byBreakdown.materialCost },
          { name: "機材費", estimated: Math.round((selectedProject?.budget ?? 0) * 0.1), actual: 0 },
          { name: "外注費", estimated: Math.round((selectedProject?.budget ?? 0) * 0.15), actual: summary.byBreakdown.invoicesReceived },
          { name: "諸経費", estimated: Math.round((selectedProject?.budget ?? 0) * 0.1), actual: summary.byBreakdown.changeOrderCost },
        ]}
      />
      {projectCostRows.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">コスト項目はまだありません</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">材料費、外注費、請求書受領分が登録されるとここに表示されます。</p>
        </div>
      ) : (
        <>
          {categoryGroups.filter((group) => group.rows.length > 0).map((group) => (
            <CategoryTable key={group.category} category={group.category} rows={group.rows} />
          ))}
        </>
      )}
    </div>
  );
}
