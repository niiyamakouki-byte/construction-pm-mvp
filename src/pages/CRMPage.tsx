import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addCustomer,
  addDeal,
  changeStage,
  deleteDeal,
  getAllCustomers,
  getAllDeals,
  getCRMStats,
  getDealsByCustomer,
  getStageOrder,
  searchCustomers,
  type Customer,
  type Deal,
  type DealStage,
} from "../lib/crm-store.js";

// Seed demo data only if store is empty (called inside useEffect, not at module level)
let seeded = false;
function seedDemoData() {
  if (seeded) return;
  seeded = true;
  if (getAllCustomers().length > 0) return;
  const now = new Date().toISOString();

  const customers: Customer[] = [
    { id: "demo-c1", name: "田中 光一", company: "田中建設", phone: "03-1234-5678", email: "tanaka@example.com", address: "東京都港区南青山1-1-1", note: "メイン顧客", createdAt: "2025-01-10T09:00:00Z" },
    { id: "demo-c2", name: "鈴木 美智子", company: "鈴木不動産", phone: "03-2345-6789", email: "suzuki@example.com", address: "東京都渋谷区2-2-2", note: "", createdAt: "2025-02-01T09:00:00Z" },
    { id: "demo-c3", name: "佐藤 健", company: "佐藤商事", phone: "03-3456-7890", email: "sato@example.com", address: "東京都新宿区3-3-3", note: "", createdAt: "2025-02-15T09:00:00Z" },
  ];
  const deals: Deal[] = [
    { id: "demo-d1", customerId: "demo-c1", projectName: "南青山マンション内装", stage: "商談中", estimatedAmount: 4750000, actualAmount: null, probability: 70, expectedCloseDate: "2025-07-31", note: "KDX物件", createdAt: "2025-03-01T09:00:00Z", updatedAt: now },
    { id: "demo-d2", customerId: "demo-c1", projectName: "港区オフィスリノベ", stage: "受注", estimatedAmount: 2800000, actualAmount: 2950000, probability: 100, expectedCloseDate: "2025-04-30", note: "", createdAt: "2025-01-15T09:00:00Z", updatedAt: now },
    { id: "demo-d3", customerId: "demo-c2", projectName: "渋谷区戸建てリフォーム", stage: "見積提出", estimatedAmount: 1500000, actualAmount: null, probability: 40, expectedCloseDate: "2025-08-31", note: "", createdAt: "2025-03-20T09:00:00Z", updatedAt: now },
    { id: "demo-d4", customerId: "demo-c3", projectName: "新宿区店舗改装", stage: "引合", estimatedAmount: 800000, actualAmount: null, probability: 10, expectedCloseDate: "2025-09-30", note: "", createdAt: "2025-04-01T09:00:00Z", updatedAt: now },
    { id: "demo-d5", customerId: "demo-c2", projectName: "渋谷区倉庫床リノリウム", stage: "失注", estimatedAmount: 600000, actualAmount: null, probability: 0, expectedCloseDate: "2025-05-31", note: "他社受注", createdAt: "2025-02-10T09:00:00Z", updatedAt: now },
  ];
  customers.forEach(addCustomer);
  deals.forEach(addDeal);
}

const currencyFmt = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
function fmt(v: number) { return currencyFmt.format(v); }

const STAGE_COLORS: Record<DealStage, string> = {
  "引合": "bg-slate-100 text-slate-700",
  "現調": "bg-blue-100 text-blue-700",
  "見積提出": "bg-yellow-100 text-yellow-700",
  "商談中": "bg-orange-100 text-orange-700",
  "受注": "bg-green-100 text-green-700",
  "失注": "bg-red-100 text-red-700",
};

const STAGE_BG: Record<DealStage, string> = {
  "引合": "border-l-4 border-slate-300 bg-slate-50",
  "現調": "border-l-4 border-blue-300 bg-blue-50",
  "見積提出": "border-l-4 border-yellow-300 bg-yellow-50",
  "商談中": "border-l-4 border-orange-300 bg-orange-50",
  "受注": "border-l-4 border-green-300 bg-green-50",
  "失注": "border-l-4 border-red-300 bg-red-50",
};

type Tab = "pipeline" | "customers" | "stats";

export function CRMPage() {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);

  // Seed demo data on first render, not at module level
  useEffect(() => { seedDemoData(); }, []);

  const customers = useMemo(() => getAllCustomers(), [refresh]);
  const deals = useMemo(() => getAllDeals(), [refresh]);
  const stats = useMemo(() => getCRMStats(), [refresh]);
  const stages = useMemo(() => getStageOrder(), []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM / 引合粗利管理</h1>
          <p className="text-sm text-slate-500">商談パイプラインと顧客管理</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {([["pipeline", "📊 パイプライン"], ["customers", "👥 顧客一覧"], ["stats", "📈 サマリー"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pipeline" && <PipelineView deals={deals} stages={stages} customers={customers} onRefresh={bump} />}
      {tab === "customers" && <CustomersView customers={customers} deals={deals} onRefresh={bump} />}
      {tab === "stats" && <StatsView stats={stats} />}
    </div>
  );
}

// ---- Pipeline (Kanban) ----

function PipelineView({
  deals,
  stages,
  customers,
  onRefresh,
}: {
  deals: Deal[];
  stages: DealStage[];
  customers: Customer[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const dealsByStage = useMemo(() => {
    const map = new Map<DealStage, Deal[]>();
    for (const stage of stages) map.set(stage, []);
    for (const d of deals) {
      map.get(d.stage)?.push(d);
    }
    return map;
  }, [deals, stages]);

  const handleStageChange = (dealId: string, stage: DealStage) => {
    changeStage(dealId, stage);
    onRefresh();
  };

  const handleDelete = (dealId: string) => {
    deleteDeal(dealId);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + 商談追加
        </button>
      </div>

      {showForm && (
        <DealForm
          customers={customers}
          onSave={() => { setShowForm(false); onRefresh(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Kanban columns - scrollable horizontally on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = dealsByStage.get(stage) ?? [];
          const total = stageDeals.reduce((s, d) => s + d.estimatedAmount, 0);
          return (
            <div key={stage} className="min-w-[200px] flex-shrink-0 w-48">
              <div className={`mb-2 rounded-lg px-3 py-1.5 text-xs font-bold ${STAGE_COLORS[stage]}`}>
                {stage} <span className="ml-1 opacity-60">({stageDeals.length})</span>
                {total > 0 && <div className="text-[10px] font-normal opacity-70">{fmt(total)}</div>}
              </div>
              <div className="space-y-2">
                {stageDeals.map((deal) => {
                  const customer = customerMap.get(deal.customerId);
                  return (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      customerName={customer?.name ?? "不明"}
                      stages={stages}
                      onStageChange={handleStageChange}
                      onDelete={handleDelete}
                    />
                  );
                })}
                {stageDeals.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    なし
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  customerName,
  stages,
  onStageChange,
  onDelete,
}: {
  deal: Deal;
  customerName: string;
  stages: DealStage[];
  onStageChange: (id: string, stage: DealStage) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg p-3 shadow-sm ${STAGE_BG[deal.stage]}`}>
      <button type="button" className="w-full text-left" onClick={() => setExpanded((v) => !v)}>
        <p className="text-xs font-semibold text-slate-800 leading-snug">{deal.projectName}</p>
        <p className="text-[11px] text-slate-500">{customerName}</p>
        <p className="mt-1 text-xs font-bold text-slate-700">{fmt(deal.estimatedAmount)}</p>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
          <p className="text-[11px] text-slate-500">確度: {deal.probability}%</p>
          <p className="text-[11px] text-slate-500">予定: {deal.expectedCloseDate}</p>
          {deal.note && <p className="text-[11px] text-slate-500">{deal.note}</p>}
          <select
            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
            value={deal.stage}
            onChange={(e) => onStageChange(deal.id, e.target.value as DealStage)}
            aria-label="ステージ変更"
          >
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            onClick={() => onDelete(deal.id)}
            className="w-full rounded bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Deal Form ----

function DealForm({
  customers,
  onSave,
  onCancel,
}: {
  customers: Customer[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const stages = getStageOrder();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");
  const [stage, setStage] = useState<DealStage>("引合");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [probability, setProbability] = useState("20");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [note, setNote] = useState("");
  const [customerForm, setCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !customerId) return;
    const now = new Date().toISOString();
    addDeal({
      id: crypto.randomUUID(),
      customerId,
      projectName: projectName.trim(),
      stage,
      estimatedAmount: Number(estimatedAmount) || 0,
      actualAmount: null,
      probability: Number(probability) || 0,
      expectedCloseDate,
      note: note.trim(),
      createdAt: now,
      updatedAt: now,
    });
    onSave();
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    const id = crypto.randomUUID();
    addCustomer({
      id,
      name: newCustomerName.trim(),
      company: newCustomerCompany.trim(),
      phone: "",
      email: "",
      address: "",
      note: "",
      createdAt: new Date().toISOString(),
    });
    setCustomerId(id);
    setCustomerForm(false);
    setNewCustomerName("");
    setNewCustomerCompany("");
    onSave(); // trigger refresh so select re-renders with new customer
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-800">新規商談</h3>
      {customerForm ? (
        <form onSubmit={handleAddCustomer} className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">新規顧客</p>
          <input className="input-base w-full" placeholder="氏名 *" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} required />
          <input className="input-base w-full" placeholder="会社名" value={newCustomerCompany} onChange={(e) => setNewCustomerCompany(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white">追加</button>
            <button type="button" onClick={() => setCustomerForm(false)} className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-600">戻る</button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <select className="input-base flex-1" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required aria-label="顧客選択">
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
            <button type="button" onClick={() => setCustomerForm(true)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">+顧客</button>
          </div>
          <input className="input-base w-full" placeholder="案件名 *" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <select className="input-base" value={stage} onChange={(e) => setStage(e.target.value as DealStage)} aria-label="ステージ">
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input-base" type="number" placeholder="見積金額" value={estimatedAmount} onChange={(e) => setEstimatedAmount(e.target.value)} min={0} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input-base" type="number" placeholder="確度 %" value={probability} onChange={(e) => setProbability(e.target.value)} min={0} max={100} />
            <input className="input-base" type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} aria-label="受注予定日" />
          </div>
          <textarea className="input-base w-full" placeholder="メモ" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700">保存</button>
            <button type="button" onClick={onCancel} className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">キャンセル</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---- Customers View ----

function CustomersView({
  customers,
  deals,
  onRefresh,
}: {
  customers: Customer[];
  deals: Deal[];
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  const filtered = useMemo(
    () => query.trim() ? searchCustomers(query) : customers,
    [query, customers],
  );

  const customerDeals = useMemo(
    () => selected ? getDealsByCustomer(selected.id) : [],
    [selected, deals],
  );

  return (
    <div className="space-y-4">
      <input
        type="search"
        className="input-base w-full"
        placeholder="顧客検索（名前・会社・メール）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="顧客検索"
      />

      {selected ? (
        <CustomerDetail
          customer={selected}
          deals={customerDeals}
          onBack={() => setSelected(null)}
          onRefresh={onRefresh}
        />
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">顧客が見つかりません</p>
          )}
          {filtered.map((c) => {
            const cDeals = deals.filter((d) => d.customerId === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.company}</p>
                  <p className="text-xs text-slate-400">{c.phone} · {c.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-700">{cDeals.length}件</p>
                  <p className="text-[10px] text-slate-400">商談</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomerDetail({
  customer,
  deals,
  onBack,
  onRefresh,
}: {
  customer: Customer;
  deals: Deal[];
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [editNote, setEditNote] = useState(false);
  const [note, setNote] = useState(customer.note);

  const handleSaveNote = () => {
    import("../lib/crm-store.js").then(({ updateCustomer }) => {
      updateCustomer(customer.id, { note });
      setEditNote(false);
      onRefresh();
    });
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
        ← 一覧へ戻る
      </button>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
        <p className="text-sm text-slate-500">{customer.company}</p>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          {customer.phone && <p>📞 {customer.phone}</p>}
          {customer.email && <p>📧 {customer.email}</p>}
          {customer.address && <p>📍 {customer.address}</p>}
        </div>
        <div className="mt-3">
          {editNote ? (
            <div className="space-y-2">
              <textarea className="input-base w-full" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveNote} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">保存</button>
                <button type="button" onClick={() => setEditNote(false)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">キャンセル</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setEditNote(true)} className="text-xs text-slate-500 hover:text-slate-700">
              {customer.note ? customer.note : "メモを追加..."} ✏️
            </button>
          )}
        </div>
      </div>

      <h3 className="text-sm font-bold text-slate-700">商談履歴 ({deals.length}件)</h3>
      {deals.length === 0 && <p className="text-sm text-slate-400">商談なし</p>}
      <div className="space-y-2">
        {deals.map((d) => (
          <div key={d.id} className={`rounded-xl p-3 shadow-sm ${STAGE_BG[d.stage]}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{d.projectName}</p>
                <p className="text-xs text-slate-500">{fmt(d.estimatedAmount)} · 確度{d.probability}%</p>
                {d.note && <p className="text-xs text-slate-400">{d.note}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STAGE_COLORS[d.stage]}`}>{d.stage}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Stats View ----

function StatsView({ stats }: { stats: ReturnType<typeof getCRMStats> }) {
  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="総商談数" value={`${stats.totalDeals}件`} />
        <KpiCard label="受注率" value={`${stats.winRate}%`} accent="text-green-700" />
        <KpiCard label="受注見込み" value={fmt(stats.totalEstimated)} />
        <KpiCard label="受注実績" value={fmt(stats.totalActual)} accent="text-blue-700" />
      </div>

      {/* Pipeline bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-700">パイプライン別</h3>
        <div className="space-y-2">
          {stats.pipeline.map((row) => (
            <div key={row.stage} className="flex items-center gap-3">
              <span className={`w-16 rounded-full px-2 py-0.5 text-center text-[10px] font-bold ${STAGE_COLORS[row.stage]}`}>{row.stage}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{row.count}件</span>
                  <span className="text-slate-500">{fmt(row.totalEstimated)}</span>
                </div>
                {row.count > 0 && (
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.min((row.totalEstimated / (stats.totalEstimated || 1)) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="w-20 text-right text-[11px] text-slate-400">加重: {fmt(row.weightedAmount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Win / Loss breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-bold text-green-700">受注</p>
          <p className="text-2xl font-black text-green-800">{stats.wonDeals}件</p>
          <p className="text-xs text-green-600">{fmt(stats.totalActual)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-700">失注</p>
          <p className="text-2xl font-black text-red-800">{stats.lostDeals}件</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent = "text-slate-900" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${accent}`}>{value}</p>
    </div>
  );
}
