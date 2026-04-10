import { useMemo, useState } from "react";
import {
  generateEstimate,
  listCategories,
  listItemsByCategory,
} from "../estimate/estimate-generator.js";
import { generateEstimatePdf } from "../estimate/pdf-estimate.js";
import type { Estimate, EstimateInput } from "../estimate/types.js";
import { EstimatePageErrorBoundary } from "../components/PageErrorBoundaries.js";
import {
  calculateFromMargin,
  simulateMultiple,
} from "../lib/profit-calculator.js";
import type { CostItem } from "../lib/profit-calculator.js";

type SelectedItem = EstimateInput & { name: string; unit: string; unitPrice: number; isLaborCost?: boolean };

const SIMULATION_MARGINS = [20, 25, 30];

function EstimatePageContent() {
  const [propertyName, setPropertyName] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [targetMargin, setTargetMargin] = useState<string>("25");
  const [includeLegalWelfare, setIncludeLegalWelfare] = useState(false);

  const costItems: CostItem[] = selectedItems.map((i) => ({
    code: i.code,
    name: i.name,
    unitPrice: i.unitPriceOverride ?? i.unitPrice,
    quantity: i.quantity,
    isLaborCost: i.isLaborCost ?? false,
  }));

  const hasCostItems = costItems.length > 0;

  const marginResult = useMemo(() => {
    if (!hasCostItems) return null;
    const m = parseFloat(targetMargin);
    if (isNaN(m) || m <= 0 || m >= 100) return null;
    try {
      return calculateFromMargin(costItems, m, includeLegalWelfare);
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, targetMargin, includeLegalWelfare, hasCostItems]);

  const simPatterns = useMemo(() => {
    if (!hasCostItems) return null;
    try {
      return simulateMultiple(costItems, SIMULATION_MARGINS, includeLegalWelfare);
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, includeLegalWelfare, hasCostItems]);

  const handleApplyMargin = () => {
    if (!marginResult) return;
    // 見積金額を自動計算した旨を表示するため、物件名が入力済みなら見積生成へ
    if (!propertyName.trim()) {
      setError("物件名を入力してください");
      return;
    }
    setError(null);
    try {
      const est = generateEstimate({
        propertyName: propertyName.trim(),
        clientName: clientName.trim() || "お客様",
        items: selectedItems.map((i) => ({ code: i.code, quantity: i.quantity })),
        notes: [`目標粗利率 ${targetMargin}% で算出（粗利額: ¥${marginResult.grossProfit.toLocaleString()}）`],
      });
      setEstimate(est);
    } catch (e) {
      setError(e instanceof Error ? e.message : "見積生成に失敗しました");
    }
  };

  const categories = listCategories();

  const handleAddItem = (code: string, name: string, unit: string, unitPrice: number) => {
    // Check if already added
    if (selectedItems.some((i) => i.code === code)) {
      setSelectedItems((prev) =>
        prev.map((i) => (i.code === code ? { ...i, quantity: i.quantity + 1 } : i)),
      );
      return;
    }
    setSelectedItems((prev) => [...prev, { code, name, unit, unitPrice, quantity: 1 }]);
  };

  const handleQuantityChange = (code: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems((prev) => prev.filter((i) => i.code !== code));
      return;
    }
    setSelectedItems((prev) =>
      prev.map((i) => (i.code === code ? { ...i, quantity: qty } : i)),
    );
  };

  const handleRemoveItem = (code: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.code !== code));
  };

  const handleGenerate = () => {
    setError(null);
    if (!propertyName.trim()) {
      setError("物件名を入力してください");
      return;
    }
    if (selectedItems.length === 0) {
      setError("品目を1つ以上追加してください");
      return;
    }
    try {
      const est = generateEstimate({
        propertyName: propertyName.trim(),
        clientName: clientName.trim() || "お客様",
        items: selectedItems.map((i) => ({ code: i.code, quantity: i.quantity })),
      });
      setEstimate(est);
    } catch (e) {
      setError(e instanceof Error ? e.message : "見積生成に失敗しました");
    }
  };

  const handleDownloadPdf = async () => {
    if (!estimate) return;
    setPdfLoading(true);
    try {
      const blob = await generateEstimatePdf(estimate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `見積書_${estimate.propertyName}_${estimate.createdAt}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("PDF出力に失敗しました");
    } finally {
      setPdfLoading(false);
    }
  };

  // Estimate result view
  if (estimate) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setEstimate(null)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 transition-colors"
          >
            <span aria-hidden="true">&larr;</span>
            見積入力に戻る
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-60"
          >
            {pdfLoading ? "生成中..." : "PDF出力"}
          </button>
        </div>

        <div className="responsive-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-slate-900">御見積書</h2>
            <div className="responsive-form-grid mt-2 gap-2 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">物件名: </span>
                {estimate.propertyName}
              </p>
              <p>
                <span className="text-slate-400">宛名: </span>
                {estimate.clientName} 様
              </p>
              <p>
                <span className="text-slate-400">作成日: </span>
                {estimate.createdAt}
              </p>
              <p>
                <span className="text-slate-400">有効期限: </span>
                {estimate.validUntil}
              </p>
            </div>
          </div>

          {/* Sections */}
          {estimate.sections.map((section) => (
            <div key={section.categoryId} className="mb-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brand-500" />
                {section.categoryName}
              </h3>
              <div className="responsive-table overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 text-left font-medium">品目</th>
                      <th className="py-1.5 text-right font-medium w-16">数量</th>
                      <th className="py-1.5 text-right font-medium w-16">単位</th>
                      <th className="py-1.5 text-right font-medium w-24">単価</th>
                      <th className="py-1.5 text-right font-medium w-24">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.lines.map((line) => (
                      <tr key={line.code} className="border-b border-slate-50">
                        <td className="py-1.5 text-slate-700">{line.name}</td>
                        <td className="py-1.5 text-right tabular-nums">{line.quantity}</td>
                        <td className="py-1.5 text-right text-slate-400">{line.unit}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          ¥{line.unitPrice.toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">
                          ¥{line.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={4} className="py-1.5 text-right font-semibold text-slate-500">
                        小計
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">
                        ¥{section.subtotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="border-t-2 border-slate-200 pt-3 mt-4 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>直接工事費</span>
              <span className="tabular-nums">¥{estimate.directCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>現場管理費 ({(estimate.managementFeeRate * 100).toFixed(0)}%)</span>
              <span className="tabular-nums">¥{estimate.managementFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>一般管理費 ({(estimate.generalExpenseRate * 100).toFixed(0)}%)</span>
              <span className="tabular-nums">¥{estimate.generalExpense.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>小計</span>
              <span className="tabular-nums">¥{estimate.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>消費税 ({(estimate.taxRate * 100).toFixed(0)}%)</span>
              <span className="tabular-nums">¥{estimate.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-lg font-bold text-slate-900">
              <span>合計</span>
              <span className="tabular-nums text-brand-700">
                ¥{estimate.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Input form view
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
      <h2 className="text-lg font-bold text-slate-900">見積作成</h2>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Project info */}
      <div className="responsive-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div>
          <label htmlFor="estimate-property" className="block text-sm font-medium text-slate-700">
            物件名 <span className="text-red-500">*</span>
          </label>
          <input
            id="estimate-property"
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            placeholder="例: 渋谷オフィスビル内装工事"
            maxLength={200}
            autoComplete="off"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="estimate-client" className="block text-sm font-medium text-slate-700">
            お客様名
          </label>
          <input
            id="estimate-client"
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="例: 株式会社○○"
            maxLength={200}
            autoComplete="organization"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Selected items */}
      {selectedItems.length > 0 && (
        <div className="responsive-card rounded-xl border border-brand-200 bg-brand-50/30 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-2">
            選択済み品目 ({selectedItems.length}件)
          </h3>
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li
                key={item.code}
                className="responsive-form-row flex items-center gap-2 rounded-lg border border-slate-100 bg-white p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    ¥{item.unitPrice.toLocaleString()} / {item.unit}
                  </p>
                </div>
                <div className="estimate-quantity-controls flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuantityChange(item.code, item.quantity - 1)}
                    className="h-11 w-11 rounded-lg bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) =>
                      handleQuantityChange(item.code, Math.max(0, Number(e.target.value)))
                    }
                    className="w-14 rounded-lg border border-slate-200 px-1 py-1.5 text-center text-sm tabular-nums"
                    min={0}
                  />
                  <button
                    onClick={() => handleQuantityChange(item.code, item.quantity + 1)}
                    className="h-11 w-11 rounded-lg bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.code)}
                  className="ml-1 flex h-11 w-11 items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          {/* 粗利逆算パネル */}
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-3">
            <p className="text-xs font-bold text-slate-700">粗利逆算</p>

            {/* 法定福利費チェック */}
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLegalWelfare}
                onChange={(e) => setIncludeLegalWelfare(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-500"
              />
              法定福利費を自動計上（労務費×15.35%）
            </label>

            {/* 目標粗利率入力 */}
            <div className="flex items-center gap-2">
              <label htmlFor="target-margin" className="text-xs text-slate-600 whitespace-nowrap">
                目標粗利率
              </label>
              <input
                id="target-margin"
                type="number"
                inputMode="decimal"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                min={1}
                max={99}
                step={1}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm tabular-nums focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">%</span>
              {marginResult && (
                <span className="text-xs text-emerald-700 font-semibold tabular-nums">
                  → ¥{marginResult.estimatePrice.toLocaleString()}
                  <span className="ml-1 font-normal text-slate-400">
                    (粗利 ¥{marginResult.grossProfit.toLocaleString()})
                  </span>
                </span>
              )}
            </div>

            {/* 松竹梅シミュレーション */}
            {simPatterns && (
              <div>
                <p className="text-[10px] text-slate-400 mb-1">松竹梅シミュレーション</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {simPatterns.map((p) => (
                    <div
                      key={p.label}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors"
                      onClick={() => setTargetMargin(String(p.marginPercent))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setTargetMargin(String(p.marginPercent))}
                      aria-label={`${p.label}パターン 粗利${p.marginPercent}%`}
                    >
                      <p className="text-xs font-bold text-slate-700">{p.label}</p>
                      <p className="text-[10px] text-slate-400">{p.marginPercent}%</p>
                      <p className="text-xs font-semibold tabular-nums text-brand-700">
                        ¥{p.estimatePrice.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-emerald-600 tabular-nums">
                        粗利 ¥{p.grossProfit.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="responsive-form-actions mt-3 flex items-center justify-between gap-3 border-t border-brand-100 pt-3">
            <span className="text-xs text-slate-500">
              仮計: ¥{selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString()}
            </span>
            <div className="flex gap-2">
              {marginResult && (
                <button
                  onClick={handleApplyMargin}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                >
                  粗利逆算で生成
                </button>
              )}
              <button
                onClick={handleGenerate}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
              >
                見積書を生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category browser */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <h3 className="px-4 py-3 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50/80">
          品目カタログ
        </h3>
        <div className="divide-y divide-slate-100">
          {categories.map((cat) => (
            <div key={cat.id}>
              <button
                onClick={() =>
                  setActiveCategory(activeCategory === cat.id ? null : cat.id)
                }
                className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-slate-700">{cat.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{cat.itemCount}品目</span>
                  <span
                    className={`text-slate-400 transition-transform ${
                      activeCategory === cat.id ? "rotate-180" : ""
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </span>
              </button>

              {activeCategory === cat.id && (
                <div className="bg-slate-50/50 px-4 py-2 space-y-1 page-enter">
                  {listItemsByCategory(cat.id).map((item) => {
                    const isSelected = selectedItems.some((i) => i.code === item.code);
                    return (
                      <button
                        key={item.code}
                        onClick={() =>
                          handleAddItem(item.code, item.name, item.unit, item.unitPrice)
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? "bg-brand-50 border border-brand-200"
                            : "hover:bg-white border border-transparent"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700 truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {item.code} / {item.unit}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-slate-600 tabular-nums">
                          ¥{item.unitPrice.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EstimatePage() {
  return (
    <EstimatePageErrorBoundary>
      <EstimatePageContent />
    </EstimatePageErrorBoundary>
  );
}
