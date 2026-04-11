/**
 * MoodBoardPage — ムードボード（Houzz Pro蒸留）
 * 内装デザイン提案を視覚化するボード
 * /mood-board/:projectId
 */

import { useMemo, useRef, useState } from "react";
import {
  type MoodBoard,
  type MoodBoardCategory,
  type MoodBoardItem,
  addMoodBoardItem,
  calcTotalPrice,
  createMoodBoard,
  getMoodBoardsByProject,
  moveItem,
  removeMoodBoardItem,
  resizeItem,
} from "../lib/mood-board.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: MoodBoardCategory[] = [
  "床",
  "壁",
  "天井",
  "家具",
  "照明",
  "カーテン",
  "その他",
];

const CATEGORY_COLOR: Record<MoodBoardCategory, string> = {
  床: "border-amber-400 bg-amber-50",
  壁: "border-blue-400 bg-blue-50",
  天井: "border-slate-400 bg-slate-50",
  家具: "border-emerald-400 bg-emerald-50",
  照明: "border-yellow-400 bg-yellow-50",
  カーテン: "border-purple-400 bg-purple-50",
  その他: "border-rose-400 bg-rose-50",
};

const CATEGORY_BADGE: Record<MoodBoardCategory, string> = {
  床: "bg-amber-100 text-amber-700",
  壁: "bg-blue-100 text-blue-700",
  天井: "bg-slate-100 text-slate-700",
  家具: "bg-emerald-100 text-emerald-700",
  照明: "bg-yellow-100 text-yellow-700",
  カーテン: "bg-purple-100 text-purple-700",
  その他: "bg-rose-100 text-rose-700",
};

// ── Demo seed ─────────────────────────────────────────────────────────────────

function seedDemo(projectId: string): MoodBoard {
  const boards = getMoodBoardsByProject(projectId);
  if (boards.length > 0) return boards[0];

  const board = createMoodBoard({ projectId, title: "リビング内装提案" });

  const demoItems: Omit<MoodBoardItem, "id">[] = [
    {
      imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
      title: "オーク突板フローリング",
      description: "天然木・15mm厚・ウレタン塗装",
      category: "床",
      supplier: "住友林業",
      price: 120000,
      position: { x: 10, y: 10 },
      size: { w: 220, h: 160 },
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1615873968403-89e068629265?w=400",
      title: "珪藻土塗り壁",
      description: "調湿機能・左官仕上げ",
      category: "壁",
      supplier: "エコカルファ",
      price: 85000,
      position: { x: 250, y: 10 },
      size: { w: 220, h: 160 },
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400",
      title: "北欧ソファ 3P",
      description: "ファブリック・グレー",
      category: "家具",
      supplier: "IKEA",
      price: 95000,
      position: { x: 10, y: 190 },
      size: { w: 220, h: 160 },
    },
    {
      imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400",
      title: "パナソニックLEDシーリング",
      description: "調光・調色・6畳〜8畳",
      category: "照明",
      supplier: "パナソニック",
      price: 25000,
      position: { x: 250, y: 190 },
      size: { w: 220, h: 160 },
    },
  ];

  for (const item of demoItems) {
    addMoodBoardItem(board.id, item);
  }

  return getMoodBoardsByProject(projectId)[0];
}

// ── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({
  onAdd,
  onClose,
}: {
  onAdd: (params: Omit<MoodBoardItem, "id">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MoodBoardCategory>("床");
  const [imageUrl, setImageUrl] = useState("");
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      description: description.trim(),
      category,
      imageUrl: imageUrl.trim() || "https://via.placeholder.com/400x300?text=No+Image",
      supplier: supplier.trim() || undefined,
      price: price ? Number(price) : undefined,
      position: { x: 20, y: 20 },
      size: { w: 220, h: 160 },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">アイテムを追加</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">タイトル *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="例：オーク床材"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MoodBoardCategory)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">説明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="例：天然木・15mm厚"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">画像URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">仕入先</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="例：メーカーA"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">金額（円）</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Canvas Item ───────────────────────────────────────────────────────────────

function CanvasItem({
  item,
  onMove,
  onRemove,
}: {
  item: MoodBoardItem;
  onMove: (pos: { x: number; y: number }) => void;
  onRemove: () => void;
}) {
  const dragStart = useRef<{ mx: number; my: number; ix: number; iy: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, ix: item.position.x, iy: item.position.y };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      onMove({ x: Math.max(0, dragStart.current.ix + dx), y: Math.max(0, dragStart.current.iy + dy) });
    };

    const onMouseUp = () => {
      dragStart.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: item.position.x,
        top: item.position.y,
        width: item.size.w,
        height: item.size.h,
        cursor: "grab",
      }}
      className={`rounded-xl border-2 shadow-md overflow-hidden ${CATEGORY_COLOR[item.category]}`}
      onMouseDown={handleMouseDown}
    >
      <img
        src={item.imageUrl}
        alt={item.title}
        className="w-full object-cover"
        style={{ height: item.size.h - 72 }}
        draggable={false}
      />
      <div className="px-2 py-1.5 bg-white/90">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-800">{item.title}</p>
            <p className="truncate text-[10px] text-slate-500">{item.description}</p>
            {item.price !== undefined && (
              <p className="text-[10px] font-bold text-blue-600">¥{item.price.toLocaleString()}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${CATEGORY_BADGE[item.category]}`}>
              {item.category}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="mt-0.5 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
              aria-label="削除"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PDF export helper ─────────────────────────────────────────────────────────

function exportToPdf(board: MoodBoard, total: number) {
  const win = window.open("", "_blank");
  if (!win) return;
  const items = board.items
    .map(
      (item) => `
        <div style="break-inside:avoid;margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;gap:12px">
          <img src="${item.imageUrl}" alt="${item.title}" style="width:120px;height:90px;object-fit:cover;border-radius:6px" />
          <div>
            <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b">${item.title}</p>
            <p style="margin:2px 0;font-size:12px;color:#64748b">${item.category}${item.supplier ? ` / ${item.supplier}` : ""}</p>
            <p style="margin:2px 0;font-size:12px;color:#64748b">${item.description}</p>
            ${item.price !== undefined ? `<p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#2563eb">¥${item.price.toLocaleString()}</p>` : ""}
          </div>
        </div>`,
    )
    .join("");

  win.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>ムードボード - ${board.title}</title>
  <style>
    body { font-family: sans-serif; margin: 32px; color: #1e293b; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .total { margin-top: 24px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; font-size: 16px; font-weight: 700; color: #1d4ed8; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>ムードボード：${board.title}</h1>
  <div class="meta">作成日：${new Date(board.createdAt).toLocaleDateString("ja-JP")}　アイテム数：${board.items.length}点</div>
  ${items}
  <div class="total">合計概算：¥${total.toLocaleString()}</div>
  <button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">印刷 / PDF保存</button>
</body>
</html>`);
  win.document.close();
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MoodBoardPage({ projectId }: { projectId: string }) {
  const [board, setBoard] = useState<MoodBoard>(() => seedDemo(projectId));
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<MoodBoardCategory | "all">("all");

  const refreshBoard = () => {
    const boards = getMoodBoardsByProject(projectId);
    if (boards.length > 0) setBoard(boards[0]);
  };

  const handleAddItem = (params: Omit<MoodBoardItem, "id">) => {
    addMoodBoardItem(board.id, params);
    refreshBoard();
  };

  const handleMove = (itemId: string, pos: { x: number; y: number }) => {
    moveItem(board.id, itemId, pos);
    refreshBoard();
  };

  const handleRemove = (itemId: string) => {
    removeMoodBoardItem(board.id, itemId);
    refreshBoard();
  };

  const total = useMemo(() => calcTotalPrice(board), [board]);

  const visibleItems = useMemo(
    () => (filterCategory === "all" ? board.items : board.items.filter((i) => i.category === filterCategory)),
    [board.items, filterCategory],
  );

  // Canvas height: enough for all items
  const canvasHeight = useMemo(() => {
    if (board.items.length === 0) return 400;
    return Math.max(400, ...board.items.map((i) => i.position.y + i.size.h + 20));
  }, [board.items]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{board.title}</h1>
          <p className="text-sm text-slate-500">{board.items.length}点　合計概算：¥{total.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => exportToPdf(board, total)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PDF出力
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <span aria-hidden="true">+</span>
            アイテム追加
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategory("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${filterCategory === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          すべて
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filterCategory === cat ? "bg-slate-900 text-white" : `${CATEGORY_BADGE[cat]} hover:opacity-80`}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        className="relative overflow-auto rounded-2xl border border-slate-200 bg-slate-50"
        style={{ minHeight: 400 }}
      >
        <div style={{ position: "relative", minWidth: 600, height: canvasHeight }}>
          {visibleItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <p className="text-3xl mb-2">🖼</p>
                <p className="text-sm">アイテムを追加してデザインを組み立ててください</p>
              </div>
            </div>
          )}
          {visibleItems.map((item) => (
            <CanvasItem
              key={item.id}
              item={item}
              onMove={(pos) => handleMove(item.id, pos)}
              onRemove={() => handleRemove(item.id)}
            />
          ))}
        </div>
      </div>

      {/* Price summary by category */}
      {board.items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-700">カテゴリ別金額</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const items = board.items.filter((i) => i.category === cat);
              const catTotal = items.reduce((s, i) => s + (i.price ?? 0), 0);
              if (items.length === 0) return null;
              return (
                <div key={cat} className={`rounded-lg border-l-4 p-3 ${CATEGORY_COLOR[cat]}`}>
                  <p className="text-xs font-medium text-slate-600">{cat}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">¥{catTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">{items.length}点</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3 text-right">
            <span className="text-sm font-bold text-blue-700">合計概算：¥{total.toLocaleString()}</span>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddItemForm onAdd={handleAddItem} onClose={() => setShowAddForm(false)} />
      )}
    </div>
  );
}
