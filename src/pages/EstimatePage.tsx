import { useState } from "react";
import {
  generateEstimate,
  listCategories,
  listItemsByCategory,
} from "../estimate/estimate-generator.js";
import type { Estimate, EstimateInput } from "../estimate/types.js";

type SelectedItem = EstimateInput & { name: string; unit: string; unitPrice: number };

export function EstimatePage() {
  const [propertyName, setPropertyName] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Estimate result view
  if (estimate) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24">
        <button
          onClick={() => setEstimate(null)}
          className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 transition-colors"
        >
          <span aria-hidden="true">&larr;</span>
          見積入力に戻る
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-slate-900">御見積書</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600">
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
              <div className="overflow-x-auto">
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            物件名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            placeholder="例: 渋谷オフィスビル内装工事"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            お客様名
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="例: 株式会社○○"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Selected items */}
      {selectedItems.length > 0 && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-2">
            選択済み品目 ({selectedItems.length}件)
          </h3>
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li
                key={item.code}
                className="flex items-center gap-2 rounded-lg bg-white p-2 border border-slate-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    ¥{item.unitPrice.toLocaleString()} / {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuantityChange(item.code, item.quantity - 1)}
                    className="h-9 w-9 rounded-lg bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleQuantityChange(item.code, Math.max(0, Number(e.target.value)))
                    }
                    className="w-14 rounded-lg border border-slate-200 px-1 py-1.5 text-center text-sm tabular-nums"
                    min={0}
                  />
                  <button
                    onClick={() => handleQuantityChange(item.code, item.quantity + 1)}
                    className="h-9 w-9 rounded-lg bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.code)}
                  className="ml-1 rounded p-1 text-slate-300 hover:text-red-500 hover:bg-red-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between items-center border-t border-brand-100 pt-3">
            <span className="text-xs text-slate-500">
              仮計: ¥{selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString()}
            </span>
            <button
              onClick={handleGenerate}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
            >
              見積書を生成
            </button>
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
