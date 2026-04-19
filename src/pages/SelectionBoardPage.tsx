/**
 * SelectionBoardPage — 施主セレクションボード（Buildertrend/CoConstruct蒸留）
 * 内装工事の仕上材を施主がオンラインで選定するページ
 * 認証不要 /selection/:projectId
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

const CATEGORIES: SelectionCategory[] = [
  "床材",
  "壁材",
  "天井材",
  "建具",
  "照明",
  "衛生器具",
  "その他",
];

const STATUS_BADGE: Record<SelectionItem["status"], string> = {
  選定中: "bg-slate-100 text-slate-600",
  施主確認待ち: "bg-yellow-100 text-yellow-700",
  承認済: "bg-green-100 text-green-700",
  変更依頼: "bg-red-100 text-red-700",
};

// ── Repository (Supabase or InMemory) ─────────────────────────────────────────

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
  const now = new Date().toISOString();
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
    updatedAt: now,
  };
}

/** 初回読み込み: 永続化された品目を取得する（デモは自動挿入しない）。 */
async function loadItems(projectId: string): Promise<SelectionItem[]> {
  const persisted = await repository.listByProjectAsync(projectId);
  return persisted.map(recordToItem);
}

async function persistItem(item: SelectionItem, createdAt: string): Promise<void> {
  await repository.saveAsync(itemToRecord(item, createdAt));
}

// ── Option card ───────────────────────────────────────────────────────────────

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: SelectionOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="mb-2 h-24 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
        {option.imageUrl ? (
          <img src={option.imageUrl} alt={option.name} className="h-full w-full object-cover rounded-lg" />
        ) : (
          "画像なし"
        )}
      </div>
      <p className="font-medium text-slate-800 text-sm">{option.name}</p>
      <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
      <p className="mt-2 text-sm font-semibold text-blue-600">
        ¥{option.unitPrice.toLocaleString()}
        <span className="text-xs font-normal text-slate-400 ml-1">/㎡</span>
      </p>
      {option.catalogUrl && (
        <a
          href={option.catalogUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-block text-xs text-blue-500 underline"
        >
          カタログ
        </a>
      )}
    </button>
  );
}

// ── Selection item card ───────────────────────────────────────────────────────

function ItemCard({
  item,
  onUpdate,
}: {
  item: SelectionItem;
  onUpdate: (updated: SelectionItem) => void;
}) {
  const [note, setNote] = useState(item.clientNote);
  const [saving, setSaving] = useState(false);

  const handleSelect = (optionId: string) => {
    if (item.status === "承認済") return;
    const updated = selectOption(item.id, optionId);
    onUpdate(updated);
  };

  const handleApprove = () => {
    if (!item.selectedOptionId) return;
    setSaving(true);
    const updated = approveSelection(item.id);
    onUpdate(updated);
    setSaving(false);
  };

  const handleRequestChange = () => {
    const updated = setStatus(item.id, "変更依頼");
    onUpdate(updated);
  };

  const handleNoteBlur = () => {
    const updated = updateSelectionItem(item.id, { clientNote: note });
    onUpdate(updated);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{item.name}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status]}`}>
          {item.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {item.options.map((opt) => (
          <OptionCard
            key={opt.id}
            option={opt}
            selected={item.selectedOptionId === opt.id}
            onSelect={() => handleSelect(opt.id)}
          />
        ))}
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">施主コメント</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          disabled={item.status === "承認済"}
          rows={2}
          placeholder="ご要望・確認事項をご記入ください"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {item.status !== "承認済" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!item.selectedOptionId || saving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            承認
          </button>
          {item.status === "施主確認待ち" && (
            <button
              type="button"
              onClick={handleRequestChange}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              変更依頼
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SelectionBoardPage({ projectId }: { projectId: string }) {
  const [activeCategory, setActiveCategory] = useState<SelectionCategory>("床材");
  const [items, setItems] = useState<SelectionItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createdAtById] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 永続化済みレコードを優先。空のときはインメモリ（tests 等）にフォールバック。
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
          setLoadError(err instanceof Error ? err.message : "セレクションの読み込みに失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, createdAtById]);

  const filtered = useMemo(
    () => (items ?? []).filter((item) => item.category === activeCategory),
    [items, activeCategory],
  );

  const approvedCount = (items ?? []).filter((i) => i.status === "承認済").length;
  const totalCount = items?.length ?? 0;

  const handleUpdate = (updated: SelectionItem) => {
    setItems((prev) => (prev ?? []).map((i) => (i.id === updated.id ? updated : i)));
    const createdAt = createdAtById.get(updated.id) ?? new Date().toISOString();
    createdAtById.set(updated.id, createdAt);
    void persistItem(updated, createdAt);
  };

  if (loadError) {
    return (
      <div className="p-6 text-sm text-red-700">セレクションの読み込みに失敗しました：{loadError}</div>
    );
  }

  if (items === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden="true" />
        <span className="ml-2">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-lg font-bold text-slate-800">施主セレクションボード</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            仕上材を選択し「承認」で確定してください
            <span className="ml-2 font-medium text-blue-600">
              {approvedCount}/{totalCount} 承認済
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5">
        {/* Category tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            if (count === 0) return null;
            const approved = items.filter(
              (i) => i.category === cat && i.status === "承認済",
            ).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {cat}
                <span className={`ml-1.5 text-xs ${activeCategory === cat ? "text-blue-200" : "text-slate-400"}`}>
                  {approved}/{count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Items */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
            <p className="text-sm text-slate-500">このカテゴリに品目がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
