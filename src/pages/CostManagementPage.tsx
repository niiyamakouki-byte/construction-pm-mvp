import { useCallback, useEffect, useMemo, useState } from "react";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import {
  buildProjectCostRows,
  getProjectBudgetSummary,
  groupCostRowsByCategory,
  summarizeCostRows,
  type CostRow,
} from "../lib/cost-management.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";
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
      <div className="overflow-x-auto">
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
