/**
 * SelectionBoardPage — 施主セレクションボード（Sprint 3-4 強化版）
 * シンプル路線: 余白+フォント階層で見せる、装飾最小化、アクセント1色
 */

import { useEffect, useMemo, useState } from "react";
import {
  type SelectionCategory,
  type SelectionItem,
  type SelectionOption,
  approveSelection,
  getSelectionItemsByProject,
  selectOption,
  setStatus,
  updateSelectionItem,
} from "../lib/selection-board.js";
import {
  SelectionRepository,
  type SelectionItemRecord,
} from "../lib/supabase-adapter/SelectionRepository.js";

// 部位フィルタ用カテゴリ（要件: 床/壁/天井/建具 + 全体）
const FILTER_CATEGORIES: Array<SelectionCategory | "すべて"> = [
  "すべて",
  "床材",
  "壁材",
  "天井材",
  "建具",
  "照明",
  "衛生器具",
  "その他",
];

// ── Repository ────────────────────────────────────────────────────────────────

const repository = new SelectionRepository();

function recordToItem(r: SelectionItemRecord): SelectionItem {
  return {
    id: r.id,
    projectId: r.projectId,
    category: r.category as SelectionCategory,
    name: r.name,
    options: r.options as SelectionOption[],
    selectedOptionId: r.selectedOptionId,
    status: r.status,
    clientNote: r.clientNote,
  };
}

function itemToRecord(item: SelectionItem, createdAt: string): SelectionItemRecord {
  return {
    id: item.id,
    projectId: item.projectId,
    category: item.category,
    name: item.name,
    options: item.options,
    selectedOptionId: item.selectedOptionId,
    status: item.status,
    clientNote: item.clientNote,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

async function loadItems(projectId: string): Promise<SelectionItem[]> {
  const persisted = await repository.listByProjectAsync(projectId);
  return persisted.map(recordToItem);
}

async function persistItem(item: SelectionItem, createdAt: string): Promise<void> {
  await repository.saveAsync(itemToRecord(item, createdAt));
}

// ── Material card (1仕上げ材 = 1カード) ──────────────────────────────────────

function MaterialCard({
  item,
  onUpdate,
}: {
  item: SelectionItem;
  onUpdate: (updated: SelectionItem) => void;
}) {
  const approved = item.status === "承認済";
  const rejected = item.status === "変更依頼";
  const selectedOpt = item.options.find((o) => o.id === item.selectedOptionId) ?? null;

  // 採用状態による枠色: 採用=セージグリーン、不採用=薄グレー、未決定=デフォルト
  const borderClass = approved
    ? "border-[#7BA88A]"
    : rejected
    ? "border-slate-200"
    : "border-slate-200";

  const handleSelect = () => {
    if (approved) return;
    // オプションが1つだけの場合は直接選択、複数の場合は最初のオプションをデフォルト選択
    const nextOpt = selectedOpt
      ? item.options[(item.options.indexOf(selectedOpt) + 1) % item.options.length]
      : item.options[0];
    if (!nextOpt) return;
    const updated = selectOption(item.id, nextOpt.id);
    onUpdate(updated);
  };

  const handleApprove = () => {
    if (!item.selectedOptionId || approved) return;
    const updated = approveSelection(item.id);
    onUpdate(updated);
  };

  const handleReject = () => {
    const updated = setStatus(item.id, "変更依頼");
    onUpdate(updated);
  };

  return (
    <article
      data-testid="material-card"
      data-status={item.status}
      className={`rounded-xl border-2 bg-white p-4 transition-colors duration-[150ms] ${borderClass}`}
    >
      {/* 画像エリア */}
      <div className="mb-3 h-28 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
        {selectedOpt?.imageUrl ? (
          <img
            src={selectedOpt.imageUrl}
            alt={selectedOpt.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-slate-400">画像なし</span>
        )}
      </div>

      {/* 品名 + カテゴリ */}
      <p className="text-xs text-slate-400 mb-0.5">{item.category}</p>
      <h3 className="font-semibold text-slate-800 text-sm leading-snug">{item.name}</h3>

      {/* 選択中オプション */}
      {selectedOpt ? (
        <p className="mt-1 text-xs text-slate-500 truncate">{selectedOpt.name}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">未選択</p>
      )}

      {/* 単価 */}
      <p className="mt-2 text-sm font-bold text-slate-800">
        {selectedOpt
          ? `¥${selectedOpt.unitPrice.toLocaleString()}`
          : item.options[0]
          ? `¥${item.options[0].unitPrice.toLocaleString()}〜`
          : "—"}
        <span className="ml-1 text-xs font-normal text-slate-400">/㎡</span>
      </p>

      {/* 採用ボタン */}
      <div className="mt-3 flex gap-2">
        {approved ? (
          <span
            data-testid="approved-badge"
            className="inline-flex items-center gap-1 rounded-md bg-[#E8F2EB] px-3 py-1.5 text-xs font-medium text-[#5E8A6C]"
          >
            ✓ 採用済
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={handleApprove}
              disabled={!item.selectedOptionId}
              data-testid="approve-button"
              className="flex-1 rounded-md bg-[#7BA88A] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-[150ms] hover:bg-[#5E8A6C] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ 採用
            </button>
            {item.options.length > 1 && !approved && (
              <button
                type="button"
                onClick={handleSelect}
                data-testid="cycle-option-button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors duration-[150ms] hover:bg-slate-50"
              >
                変更
              </button>
            )}
            {item.status === "施主確認待ち" && (
              <button
                type="button"
                onClick={handleReject}
                data-testid="reject-button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors duration-[150ms] hover:bg-slate-50"
              >
                差戻
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SelectionBoardPage({ projectId }: { projectId: string }) {
  const [activeFilter, setActiveFilter] = useState<SelectionCategory | "すべて">("すべて");
  const [items, setItems] = useState<SelectionItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createdAtById] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const persisted = await loadItems(projectId);
        const local = getSelectionItemsByProject(projectId);
        const merged = persisted.length > 0 ? persisted : local;
        const now = new Date().toISOString();
        for (const it of merged) {
          if (!createdAtById.has(it.id)) createdAtById.set(it.id, now);
        }
        if (!cancelled) setItems(merged);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "読み込みに失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, createdAtById]);

  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (item) => activeFilter === "すべて" || item.category === activeFilter,
      ),
    [items, activeFilter],
  );

  // 採用済み件数
  const approvedCount = useMemo(
    () => (items ?? []).filter((i) => i.status === "承認済").length,
    [items],
  );

  // 採用合計金額（採用済みで選択オプションがある品目の単価合計）
  const approvedTotal = useMemo(() => {
    return (items ?? [])
      .filter((i) => i.status === "承認済" && i.selectedOptionId)
      .reduce((sum, i) => {
        const opt = i.options.find((o) => o.id === i.selectedOptionId);
        return sum + (opt?.unitPrice ?? 0);
      }, 0);
  }, [items]);

  // フィルタに品目が存在するカテゴリのみ表示
  const availableFilters = useMemo(() => {
    const used = new Set((items ?? []).map((i) => i.category));
    return FILTER_CATEGORIES.filter((f) => f === "すべて" || used.has(f as SelectionCategory));
  }, [items]);

  const handleUpdate = (updated: SelectionItem) => {
    setItems((prev) => (prev ?? []).map((i) => (i.id === updated.id ? updated : i)));
    const createdAt = createdAtById.get(updated.id) ?? new Date().toISOString();
    createdAtById.set(updated.id, createdAt);
    void persistItem(updated, createdAt);
  };

  if (loadError) {
    return (
      <div className="p-6 text-sm text-red-700">読み込みに失敗しました：{loadError}</div>
    );
  }

  if (items === null) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-500">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
          aria-hidden="true"
        />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-baseline justify-between gap-4">
          <h1 className="text-lg font-bold text-slate-800">セレクションボード</h1>
          {/* 採用済み件数バッジ */}
          <span
            data-testid="approved-count-badge"
            className="shrink-0 rounded-full bg-[#E8F2EB] px-3 py-0.5 text-xs font-medium text-[#5E8A6C]"
          >
            採用 {approvedCount} 件
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5">
        {/* フィルタ (部位絞り込み) */}
        <div
          data-testid="filter-bar"
          className="mb-6 flex gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label="部位フィルタ"
        >
          {availableFilters.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveFilter(cat)}
              data-testid={`filter-${cat}`}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-[150ms] ${
                activeFilter === cat
                  ? "bg-[#7BA88A] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* カードグリッド */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <p className="text-sm text-slate-400">品目がありません</p>
          </div>
        ) : (
          <div
            data-testid="card-grid"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {filtered.map((item) => (
              <MaterialCard key={item.id} item={item} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>

      {/* フッター: 採用合計金額 */}
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-sm">
          <span className="text-slate-500">採用合計</span>
          <span
            data-testid="approved-total"
            className="font-bold text-slate-800"
          >
            ¥{approvedTotal.toLocaleString()}
          </span>
        </div>
      </footer>
    </div>
  );
}
