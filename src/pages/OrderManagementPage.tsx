import { useState, useMemo } from "react";
import {
  createOrder,
  transitionOrder,
  listOrders,
  deleteOrder,
  getNextStatuses,
  getOrderSummaryByStatus,
} from "../lib/order-management.js";
import type { PurchaseOrder, OrderStatus, OrderItem } from "../lib/order-management.js";
import costMaster from "../estimate/cost-master.json";

// ── Types ────────────────────────────────────────────────────────────────────

type CostMasterItem = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  note: string;
};

type CostMasterCategory = {
  id: string;
  name: string;
  items: CostMasterItem[];
};

// ── Demo contractors ─────────────────────────────────────────────────────────

const DEMO_CONTRACTORS = [
  { id: "c-1", name: "山田内装工業" },
  { id: "c-2", name: "鈴木設備工事" },
  { id: "c-3", name: "東京電気工事" },
  { id: "c-4", name: "南青山建材" },
];

const DEMO_PROJECT_ID = "p-1";

// ── Status style helpers ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<OrderStatus, string> = {
  下書き: "bg-slate-100 text-slate-700 border-slate-200",
  発注済: "bg-blue-50 text-blue-700 border-blue-200",
  納品待ち: "bg-amber-50 text-amber-700 border-amber-200",
  納品済: "bg-indigo-50 text-indigo-700 border-indigo-200",
  検収済: "bg-teal-50 text-teal-700 border-teal-200",
  請求済: "bg-orange-50 text-orange-700 border-orange-200",
  支払済: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_ORDER: OrderStatus[] = [
  "下書き",
  "発注済",
  "納品待ち",
  "納品済",
  "検収済",
  "請求済",
  "支払済",
];

function fmt(n: number) {
  return n.toLocaleString("ja-JP");
}

// ── Item row for the order form ───────────────────────────────────────────────

type FormItem = {
  code: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

const EMPTY_ITEM: FormItem = { code: "", name: "", unit: "", quantity: "1", unitPrice: "0" };

function ItemRow({
  item,
  idx,
  allItems,
  onChange,
  onRemove,
}: {
  item: FormItem;
  idx: number;
  allItems: CostMasterItem[];
  onChange: (idx: number, field: keyof FormItem, value: string) => void;
  onRemove: (idx: number) => void;
}) {
  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = allItems.find((i) => i.code === e.target.value);
    if (found) {
      onChange(idx, "code", found.code);
      onChange(idx, "name", found.name);
      onChange(idx, "unit", found.unit);
      onChange(idx, "unitPrice", String(found.unitPrice));
    }
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">品目</label>}
        <select
          value={item.code}
          onChange={handleSelect}
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">-- 品目を選択 --</option>
          {(costMaster as { categories: CostMasterCategory[] }).categories.map((cat) => (
            <optgroup key={cat.id} label={cat.name}>
              {cat.items.map((ci) => (
                <option key={ci.code} value={ci.code}>
                  {ci.name}（{ci.unit}）
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">品目名</label>}
        <input
          value={item.name}
          onChange={(e) => onChange(idx, "name", e.target.value)}
          placeholder="品目名"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-1">
        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">単位</label>}
        <input
          value={item.unit}
          onChange={(e) => onChange(idx, "unit", e.target.value)}
          placeholder="単位"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-2">
        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">数量</label>}
        <input
          type="number"
          min="0"
          value={item.quantity}
          onChange={(e) => onChange(idx, "quantity", e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-2">
        {idx === 0 && <label className="block text-xs text-slate-500 mb-1">単価（円）</label>}
        <input
          type="number"
          min="0"
          value={item.unitPrice}
          onChange={(e) => onChange(idx, "unitPrice", e.target.value)}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="col-span-1 flex items-end pb-0.5">
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
          aria-label="品目を削除"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Order form modal ──────────────────────────────────────────────────────────

function OrderForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: PurchaseOrder) => void;
}) {
  const [contractorId, setContractorId] = useState(DEMO_CONTRACTORS[0].id);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<FormItem[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState("");

  const allMasterItems = useMemo(
    () =>
      (costMaster as { categories: CostMasterCategory[] }).categories.flatMap(
        (c) => c.items,
      ),
    [],
  );

  const contractor = DEMO_CONTRACTORS.find((c) => c.id === contractorId)!;

  const handleItemChange = (idx: number, field: keyof FormItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );
  const tax = Math.floor(subtotal * 0.1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryDate) {
      setError("納期を入力してください");
      return;
    }
    const validItems = items.filter((i) => i.name && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setError("品目を1件以上入力してください");
      return;
    }
    const orderItems = validItems.map((i) => ({
      code: i.code,
      name: i.name,
      unit: i.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    }));
    const order = createOrder(
      DEMO_PROJECT_ID,
      contractor.id,
      contractor.name,
      orderItems,
      deliveryDate,
      notes || undefined,
    );
    onCreated(order);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">発注書作成</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">業者</label>
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {DEMO_CONTRACTORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">納期</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">品目一覧</label>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + 品目追加
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <ItemRow
                  key={idx}
                  item={item}
                  idx={idx}
                  allItems={allMasterItems}
                  onChange={handleItemChange}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>小計</span>
              <span>¥{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>消費税（10%）</span>
              <span>¥{fmt(tax)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-800 text-base pt-1 border-t border-slate-200">
              <span>合計</span>
              <span>¥{fmt(subtotal + tax)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm resize-none"
              placeholder="納品場所・特記事項など"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              下書き保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onTransition,
  onDelete,
}: {
  order: PurchaseOrder;
  onTransition: (id: string, to: OrderStatus) => void;
  onDelete: (id: string) => void;
}) {
  const nextStatuses = getNextStatuses(order.status);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status]}`}>
              {order.status}
            </span>
            <span className="font-semibold text-slate-800 truncate">{order.contractorName}</span>
            <span className="text-xs text-slate-400">{order.id}</span>
          </div>
          <div className="flex gap-4 mt-1 text-sm text-slate-500 flex-wrap">
            <span>発注日: {order.orderDate}</span>
            <span>納期: {order.deliveryDate}</span>
            <span className="font-medium text-slate-700">¥{fmt(order.totalWithTax)}</span>
          </div>
          {order.notes && (
            <p className="mt-1 text-xs text-slate-400 truncate">{order.notes}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-slate-600 text-sm shrink-0"
        >
          {expanded ? "閉じる" : "詳細"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left pb-1">品目</th>
                <th className="text-right pb-1">数量</th>
                <th className="text-right pb-1">単価</th>
                <th className="text-right pb-1">金額</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1">{item.name}<span className="text-slate-400 text-xs ml-1">({item.unit})</span></td>
                  <td className="py-1 text-right">{item.quantity}</td>
                  <td className="py-1 text-right">¥{fmt(item.unitPrice)}</td>
                  <td className="py-1 text-right">¥{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-slate-500 text-xs">
                <td colSpan={3} className="pt-2 text-right">小計</td>
                <td className="pt-2 text-right">¥{fmt(order.totalAmount)}</td>
              </tr>
              <tr className="text-slate-500 text-xs">
                <td colSpan={3} className="text-right">消費税</td>
                <td className="text-right">¥{fmt(order.taxAmount)}</td>
              </tr>
              <tr className="font-semibold text-slate-800">
                <td colSpan={3} className="text-right pt-1 border-t border-slate-200">合計</td>
                <td className="text-right pt-1 border-t border-slate-200">¥{fmt(order.totalWithTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-2 flex-wrap">
        {nextStatuses.map((next) => (
          <button
            key={next}
            onClick={() => onTransition(order.id, next)}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            → {next}
          </button>
        ))}
        {order.status === "下書き" && (
          <button
            onClick={() => onDelete(order.id)}
            className="px-3 py-1 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 ml-auto"
          >
            削除
          </button>
        )}
      </div>
    </div>
  );
}

// ── Status column (kanban) ────────────────────────────────────────────────────

function StatusColumn({
  status,
  orders,
  onTransition,
  onDelete,
}: {
  status: OrderStatus;
  orders: PurchaseOrder[];
  onTransition: (id: string, to: OrderStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-w-[220px]">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium mb-3 ${STATUS_COLORS[status]}`}>
        <span>{status}</span>
        <span className="ml-auto text-xs font-bold">{orders.length}</span>
      </div>
      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onTransition={onTransition}
            onDelete={onDelete}
          />
        ))}
        {orders.length === 0 && (
          <p className="text-xs text-slate-300 text-center py-4">なし</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function OrderManagementPage() {
  const [showForm, setShowForm] = useState(false);
  const [tick, setTick] = useState(0); // force re-render after mutations
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "すべて">("すべて");

  const refresh = () => setTick((n) => n + 1);

  const allOrders = useMemo(() => {
    void tick;
    return listOrders(DEMO_PROJECT_ID);
  }, [tick]);

  const filteredOrders = useMemo(() => {
    if (filterStatus === "すべて") return allOrders;
    return allOrders.filter((o) => o.status === filterStatus);
  }, [allOrders, filterStatus]);

  const summary = useMemo(() => {
    void tick;
    return getOrderSummaryByStatus(DEMO_PROJECT_ID);
  }, [tick]);

  const handleTransition = (id: string, to: OrderStatus) => {
    transitionOrder(id, to);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteOrder(id);
    refresh();
  };

  const totalPending = allOrders
    .filter((o) => !["支払済", "下書き"].includes(o.status))
    .reduce((sum, o) => sum + o.totalWithTax, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">受発注管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">発注→納品→検収→請求→支払の全フロー管理</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm"
        >
          + 発注書作成
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">総発注数</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{allOrders.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs text-amber-600">進行中</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">
            {allOrders.filter((o) => !["支払済", "下書き"].includes(o.status)).length}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs text-emerald-600">支払済</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{summary["支払済"]}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs text-blue-600">未払合計</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">¥{fmt(totalPending)}</p>
        </div>
      </div>

      {/* View mode + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            リスト
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1.5 ${viewMode === "kanban" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            カンバン
          </button>
        </div>
        {viewMode === "list" && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as OrderStatus | "すべて")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="すべて">すべて</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}（{summary[s]}）
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {viewMode === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STATUS_ORDER.map((status) => (
              <StatusColumn
                key={status}
                status={status}
                orders={allOrders.filter((o) => o.status === status)}
                onTransition={handleTransition}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <p className="text-slate-400 text-sm">発注書がありません</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-blue-600 text-sm hover:underline"
              >
                最初の発注書を作成する
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onTransition={handleTransition}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <OrderForm
          onClose={() => setShowForm(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
