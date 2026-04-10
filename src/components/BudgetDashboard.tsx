import { useState } from "react";
import {
  calculateBudgetBreakdown,
  type BudgetBreakdown,
  type BudgetCategory,
} from "../lib/budget-calculator.js";

const CATEGORY_LABELS = [
  "人件費",
  "資材費",
  "機材費",
  "外注費",
  "諸経費",
] as const;

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function fmt(value: number): string {
  return currencyFormatter.format(value);
}

type CategoryInput = {
  name: string;
  estimated: number;
  actual: number;
};

type Props = {
  projectName: string;
  categories?: CategoryInput[];
};

const STATUS_TONE: Record<BudgetBreakdown["status"], string> = {
  under_budget: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  on_budget: "bg-blue-50 text-blue-700 ring-blue-200",
  over_budget: "bg-red-50 text-red-700 ring-red-200",
};

const STATUS_LABEL: Record<BudgetBreakdown["status"], string> = {
  under_budget: "予算内",
  on_budget: "予算通り",
  over_budget: "予算超過",
};

const CATEGORY_COLORS: Record<string, string> = {
  人件費: "bg-blue-500",
  資材費: "bg-emerald-500",
  機材費: "bg-amber-500",
  外注費: "bg-purple-500",
  諸経費: "bg-slate-500",
};

function ProgressBar({ pct, over }: { pct: number; over: boolean }) {
  const width = Math.min(100, Math.abs(pct));
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-emerald-500"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function CategoryCard({ cat }: { cat: BudgetCategory }) {
  const diff = cat.actualAmount - cat.estimatedAmount;
  const pct = cat.estimatedAmount > 0 ? (diff / cat.estimatedAmount) * 100 : 0;
  const over = diff > 0;
  const dot = CATEGORY_COLORS[cat.name] ?? "bg-slate-400";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="text-xs font-semibold text-slate-700">{cat.name}</span>
        {over && (
          <span className="ml-auto rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            超過
          </span>
        )}
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">{fmt(cat.actualAmount)}</p>
      <p className="text-xs text-slate-500">見積: {fmt(cat.estimatedAmount)}</p>
      <ProgressBar pct={pct} over={over} />
      <p className={`mt-1 text-right text-xs font-semibold tabular-nums ${over ? "text-red-600" : "text-emerald-600"}`}>
        {over ? "+" : ""}{fmt(diff)}
      </p>
    </div>
  );
}

function CategoryTableRow({ cat }: { cat: BudgetCategory }) {
  const diff = cat.actualAmount - cat.estimatedAmount;
  const pct = cat.estimatedAmount > 0 ? (diff / cat.estimatedAmount) * 100 : 0;
  const over = diff > 0;
  const dot = CATEGORY_COLORS[cat.name] ?? "bg-slate-400";

  return (
    <tr className="border-t border-slate-100 text-sm text-slate-700">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
          {cat.name}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{fmt(cat.estimatedAmount)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{fmt(cat.actualAmount)}</td>
      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${over ? "text-red-600" : "text-emerald-600"}`}>
        {over ? "+" : ""}{fmt(diff)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500">
        {pct.toFixed(1)}%
      </td>
    </tr>
  );
}

export function BudgetDashboard({ projectName, categories }: Props) {
  const [view, setView] = useState<"card" | "table">("card");

  const defaultCategories: CategoryInput[] = CATEGORY_LABELS.map((name) => ({
    name,
    estimated: 0,
    actual: 0,
  }));

  const inputs = categories ?? defaultCategories;
  const breakdown = calculateBudgetBreakdown(projectName, inputs);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">予算</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">予算消化状況</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_TONE[breakdown.status]}`}
          >
            {STATUS_LABEL[breakdown.status]}
          </span>
          <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setView("card")}
              className={`min-h-[36px] min-w-[44px] rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                view === "card"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-pressed={view === "card"}
            >
              カード
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`min-h-[36px] min-w-[44px] rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                view === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              aria-pressed={view === "table"}
            >
              テーブル
            </button>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">総見積</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{fmt(breakdown.totalEstimated)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700">総実績</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-900">{fmt(breakdown.totalActual)}</p>
        </div>
        <div
          className={`col-span-2 rounded-2xl border px-4 py-3 sm:col-span-1 ${
            breakdown.variance > 0
              ? "border-red-200 bg-red-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <p className={`text-xs font-semibold tracking-[0.14em] ${breakdown.variance > 0 ? "text-red-700" : "text-blue-700"}`}>
            差異 ({breakdown.variancePct > 0 ? "+" : ""}{breakdown.variancePct}%)
          </p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${breakdown.variance > 0 ? "text-red-900" : "text-blue-900"}`}>
            {breakdown.variance > 0 ? "+" : ""}{fmt(breakdown.variance)}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mt-4">
        {view === "card" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {breakdown.categories.map((cat) => (
              <CategoryCard key={cat.name} cat={cat} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">カテゴリ</th>
                  <th className="px-4 py-3 text-right">見積額</th>
                  <th className="px-4 py-3 text-right">実績額</th>
                  <th className="px-4 py-3 text-right">差額</th>
                  <th className="px-4 py-3 text-right">差異率</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.categories.map((cat) => (
                  <CategoryTableRow key={cat.name} cat={cat} />
                ))}
              </tbody>
              <tfoot className="bg-slate-50 text-sm font-bold text-slate-900">
                <tr>
                  <td className="px-4 py-3">合計</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(breakdown.totalEstimated)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(breakdown.totalActual)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${breakdown.variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {breakdown.variance > 0 ? "+" : ""}{fmt(breakdown.variance)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500">
                    {breakdown.variancePct > 0 ? "+" : ""}{breakdown.variancePct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
