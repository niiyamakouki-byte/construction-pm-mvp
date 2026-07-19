import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectPaymentPlan, ExecutionBudget } from "../domain/types.js";
import { createPaymentPlanRepository } from "../stores/payment-plan-store.js";
import { createExecutionBudgetRepository } from "../stores/execution-budget-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { ChangeRequestAdminPanel } from "./ChangeRequestAdminPanel.js";
import { getInvoicesByProject, type Invoice } from "../lib/invoice-store.js";

/**
 * 案件の請求書から「入金済み合計」「未入金合計」を算出する。
 * 表示計算専用 — 既存テーブルに書き込みは行わない。
 */
export function summarizeInvoicePayments(invoices: Invoice[]): {
  paidTotal: number;
  unpaidTotal: number;
} {
  let paidTotal = 0;
  let unpaidTotal = 0;
  for (const inv of invoices) {
    if (inv.status === "支払済み") paidTotal += inv.total;
    else unpaidTotal += inv.total;
  }
  return { paidTotal, unpaidTotal };
}

const currency = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const statusLabel: Record<ProjectPaymentPlan["status"], string> = {
  planned: "予定",
  invoiced: "請求済",
  paid: "入金済",
  overdue: "期日超過",
  cancelled: "取消",
};

const statusBg: Record<ProjectPaymentPlan["status"], string> = {
  planned: "bg-slate-100 text-slate-700",
  invoiced: "bg-blue-100 text-blue-700",
  paid: "bg-brand-100 text-brand-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-50 text-slate-400 line-through",
};

/**
 * Task #41: プロジェクト単位の入金計画 + 実行予算 パネル。
 * project_payment_plans / execution_budgets テーブルを直接読み書きする最小UI。
 */
export function ProjectFinancePanel({ projectId }: { projectId: string }) {
  const { organizationId } = useOrganizationContext();
  const paymentPlanRepo = useMemo(
    () => createPaymentPlanRepository(() => organizationId),
    [organizationId],
  );
  const budgetRepo = useMemo(
    () => createExecutionBudgetRepository(() => organizationId),
    [organizationId],
  );

  const [plans, setPlans] = useState<ProjectPaymentPlan[]>([]);
  const [budgets, setBudgets] = useState<ExecutionBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planMilestone, setPlanMilestone] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planAmount, setPlanAmount] = useState("");

  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetPlanned, setBudgetPlanned] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allPlans, allBudgets] = await Promise.all([
        paymentPlanRepo.findAll(),
        budgetRepo.findAll(),
      ]);
      setPlans(allPlans.filter((p) => p.projectId === projectId));
      setBudgets(allBudgets.filter((b) => b.projectId === projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [budgetRepo, paymentPlanRepo, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初期データ取得
    void loadData();
  }, [loadData]);

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planMilestone.trim() || !planDate || !planAmount) return;
    try {
      const now = new Date().toISOString();
      await paymentPlanRepo.create({
        id: crypto.randomUUID(),
        projectId,
        milestoneLabel: planMilestone.trim(),
        scheduledDate: planDate,
        scheduledAmount: Number(planAmount),
        status: "planned",
        createdAt: now,
        updatedAt: now,
      });
      setPlanMilestone("");
      setPlanDate("");
      setPlanAmount("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "入金計画の追加に失敗しました");
    }
  };

  const handleSyncFreee = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const { getSupabaseClient, hasSupabaseEnv } = await import("../infra/supabase-client.js");
      if (!hasSupabaseEnv()) {
        throw new Error("Supabase 未設定です");
      }
      const supabase = await getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("ログインしてください");

      const companiesRes = await fetch("/api/freee/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!companiesRes.ok) {
        const body = (await companiesRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `companies 取得失敗 (${companiesRes.status})`);
      }
      const { companies } = (await companiesRes.json()) as { companies: Array<{ id: number }> };
      if (!companies?.length) throw new Error("freee に事業所がありません");
      const companyId = companies[0].id;

      const syncRes = await fetch(
        `/api/freee/sync-payment-plans?company_id=${companyId}&project_id=${encodeURIComponent(projectId)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const body = (await syncRes.json().catch(() => ({}))) as {
        updated?: number;
        checked?: number;
        error?: string;
      };
      if (!syncRes.ok) {
        throw new Error(body.error ?? `同期失敗 (${syncRes.status})`);
      }
      setSyncMessage(`会計同期完了: ${body.updated ?? 0} / ${body.checked ?? 0} 件 更新`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "会計同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetCategory.trim() || !budgetPlanned) return;
    try {
      const now = new Date().toISOString();
      await budgetRepo.create({
        id: crypto.randomUUID(),
        projectId,
        category: budgetCategory.trim(),
        plannedAmount: Number(budgetPlanned),
        committedAmount: 0,
        actualAmount: 0,
        createdAt: now,
        updatedAt: now,
      });
      setBudgetCategory("");
      setBudgetPlanned("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "実行予算の追加に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  const totalScheduled = plans.reduce((s, p) => s + p.scheduledAmount, 0);
  const totalPaid = plans
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + (p.actualAmount ?? p.scheduledAmount), 0);
  const outstanding = totalScheduled - totalPaid;

  const totalPlannedBudget = budgets.reduce((s, b) => s + b.plannedAmount, 0);
  const totalActualBudget = budgets.reduce((s, b) => s + b.actualAmount, 0);

  // 請求書ベースの入金状況（表示のみ・既存テーブルへの書き込みなし）
  const projectInvoices = getInvoicesByProject(projectId);
  const { paidTotal: invoicePaidTotal, unpaidTotal: invoiceUnpaidTotal } =
    summarizeInvoicePayments(projectInvoices);

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-700">
          {syncMessage}
        </div>
      )}

      {/* 入金計画サマリ */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800">入金計画</h3>
          <button
            type="button"
            onClick={handleSyncFreee}
            disabled={syncing}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {syncing ? "会計同期中..." : "会計同期"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">予定合計</p>
            <p className="text-sm font-bold text-slate-800 tabular-nums">{currency.format(totalScheduled)}</p>
          </div>
          <div className="rounded-lg bg-brand-50 p-2">
            <p className="text-[10px] text-brand-600">入金済</p>
            <p className="text-sm font-bold text-brand-700 tabular-nums">{currency.format(totalPaid)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <p className="text-[10px] text-amber-600">未収</p>
            <p className="text-sm font-bold text-amber-700 tabular-nums">{currency.format(outstanding)}</p>
          </div>
        </div>

        {/* 請求書ベース（freee 照合反映） */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-center" data-testid="invoice-payment-summary">
          <div className="rounded-lg border border-brand-100 bg-white p-2">
            <p className="text-[10px] text-brand-600">請求書 入金済み合計</p>
            <p className="text-sm font-bold text-brand-700 tabular-nums">{currency.format(invoicePaidTotal)}</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-white p-2">
            <p className="text-[10px] text-amber-600">請求書 未入金合計</p>
            <p className="text-sm font-bold text-amber-700 tabular-nums">{currency.format(invoiceUnpaidTotal)}</p>
          </div>
        </div>

        <form onSubmit={handleAddPlan} className="flex flex-col gap-2 mb-3 sm:flex-row">
          <input
            type="text"
            value={planMilestone}
            onChange={(e) => setPlanMilestone(e.target.value)}
            placeholder="マイルストーン (例: 契約金)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={planAmount}
            onChange={(e) => setPlanAmount(e.target.value)}
            placeholder="金額"
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            追加
          </button>
        </form>

        {plans.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">入金計画はまだありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {plans
              .slice()
              .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
              .map((plan) => (
                <li key={plan.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{plan.milestoneLabel}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{plan.scheduledDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{currency.format(plan.scheduledAmount)}</p>
                    <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBg[plan.status]}`}>
                      {statusLabel[plan.status]}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* 実行予算 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-3">実行予算</h3>
        <div className="grid grid-cols-2 gap-2 mb-4 text-center">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">予算合計</p>
            <p className="text-sm font-bold text-slate-800 tabular-nums">{currency.format(totalPlannedBudget)}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-2">
            <p className="text-[10px] text-blue-600">実績合計</p>
            <p className="text-sm font-bold text-blue-700 tabular-nums">{currency.format(totalActualBudget)}</p>
          </div>
        </div>

        <form onSubmit={handleAddBudget} className="flex flex-col gap-2 mb-3 sm:flex-row">
          <input
            type="text"
            value={budgetCategory}
            onChange={(e) => setBudgetCategory(e.target.value)}
            placeholder="カテゴリ (例: 内装)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={budgetPlanned}
            onChange={(e) => setBudgetPlanned(e.target.value)}
            placeholder="予算額"
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            追加
          </button>
        </form>

        {budgets.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">実行予算はまだありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {budgets
              .slice()
              .sort((a, b) => a.category.localeCompare(b.category))
              .map((budget) => {
                const usage = budget.plannedAmount > 0
                  ? Math.round((budget.actualAmount / budget.plannedAmount) * 100)
                  : 0;
                const barColor = usage > 100 ? "bg-red-500" : usage > 80 ? "bg-amber-500" : "bg-brand-500";
                return (
                  <li key={budget.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-slate-800">{budget.category}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {currency.format(budget.actualAmount)} / {currency.format(budget.plannedAmount)}
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full ${barColor}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <ChangeRequestAdminPanel projectId={projectId} />
    </div>
  );
}
