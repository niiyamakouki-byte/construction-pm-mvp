import { useMemo, useState } from "react";
import { buildProcurementAlerts } from "../lib/procurement-alerts.js";
import type { ProcurementAlert } from "../lib/procurement-alerts.js";
import type { Task } from "../domain/types.js";

// ── Demo seed data ──────────────────────────────────────────────────────────

type Material = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: "unordered" | "ordered" | "delivered" | "accepted";
  dueDate: string;
  projectId: string;
};

const DEMO_MATERIALS: Material[] = [
  { id: "m-1", name: "LGS 65mm", category: "軽鉄材", quantity: 200, unit: "本", status: "unordered", dueDate: "2025-07-10", projectId: "p-1" },
  { id: "m-2", name: "石膏ボード 12.5mm", category: "ボード", quantity: 500, unit: "枚", status: "ordered", dueDate: "2025-07-05", projectId: "p-1" },
  { id: "m-3", name: "フローリング材 オーク", category: "床材", quantity: 120, unit: "枚", status: "delivered", dueDate: "2025-06-28", projectId: "p-1" },
  { id: "m-4", name: "クロス (白)", category: "内装材", quantity: 300, unit: "m", status: "accepted", dueDate: "2025-06-20", projectId: "p-1" },
  { id: "m-5", name: "電線 VVF2.0mm", category: "電気材料", quantity: 100, unit: "m", status: "unordered", dueDate: "2025-07-15", projectId: "p-1" },
  { id: "m-6", name: "配管 VU50", category: "給排水", quantity: 30, unit: "本", status: "ordered", dueDate: "2025-07-08", projectId: "p-1" },
];

const DEMO_TASKS: Task[] = [
  { id: "t-1", projectId: "p-1", name: "空調機搬入", description: "", status: "todo", progress: 0, dependencies: [], createdAt: "", updatedAt: "", startDate: "2025-07-05", lead_time: 7 },
  { id: "t-2", projectId: "p-1", name: "電気配線工事", description: "", status: "todo", progress: 0, dependencies: [], createdAt: "", updatedAt: "", startDate: "2025-07-12", lead_time: 5 },
  { id: "t-3", projectId: "p-1", name: "給排水配管", description: "", status: "todo", progress: 0, dependencies: [], createdAt: "", updatedAt: "", startDate: "2025-07-20", lead_time: 10 },
];

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<Material["status"], string> = {
  unordered: "未発注",
  ordered: "発注済",
  delivered: "納品済",
  accepted: "検収済",
};

const STATUS_STYLES: Record<Material["status"], string> = {
  unordered: "bg-red-50 text-red-700 border-red-200",
  ordered: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function alertSeverity(alert: ProcurementAlert): "high" | "medium" | "low" {
  if (alert.daysRemaining <= 2) return "high";
  if (alert.daysRemaining <= alert.leadTime / 2) return "medium";
  return "low";
}

const SEVERITY_STYLES: Record<"high" | "medium" | "low", { badge: string; row: string }> = {
  high: { badge: "bg-red-100 text-red-700 border-red-200", row: "border-red-200" },
  medium: { badge: "bg-amber-100 text-amber-700 border-amber-200", row: "border-amber-200" },
  low: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", row: "border-emerald-200" },
};

const SEVERITY_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "高",
  medium: "中",
  low: "低",
};

// ── Calendar helpers ─────────────────────────────────────────────────────────

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

// ── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "alerts" | "materials" | "calendar";

const TAB_LABELS: { key: Tab; label: string; icon: string }[] = [
  { key: "alerts", label: "アラート", icon: "🔔" },
  { key: "materials", label: "資材一覧", icon: "📦" },
  { key: "calendar", label: "納期カレンダー", icon: "📅" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("alerts");
  const [materials, setMaterials] = useState<Material[]>(DEMO_MATERIALS);
  const today = new Date().toISOString().slice(0, 10);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const alerts = useMemo(
    () => buildProcurementAlerts(DEMO_TASKS, today),
    [today],
  );

  const calDays = useMemo(() => buildCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const dueDates = useMemo(() => {
    const map = new Map<string, Material[]>();
    materials.forEach((m) => {
      const list = map.get(m.dueDate) ?? [];
      list.push(m);
      map.set(m.dueDate, list);
    });
    return map;
  }, [materials]);

  const handleStatusChange = (id: string, status: Material["status"]) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m)),
    );
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">発注管理</h1>
        <p className="mt-1 text-sm text-slate-500">資材の発注状況と納期を管理します</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2">
        {(["unordered", "ordered", "delivered", "accepted"] as const).map((s) => {
          const count = materials.filter((m) => m.status === s).length;
          return (
            <div key={s} className={`rounded-xl border p-3 text-center ${STATUS_STYLES[s]}`}>
              <p className="text-lg font-bold tabular-nums">{count}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider">{STATUS_LABELS[s]}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TAB_LABELS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              activeTab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* Tab: Alerts */}
      {activeTab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-sm text-slate-500">発注アラートはありません</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const sev = alertSeverity(alert);
              return (
                <div
                  key={alert.taskId}
                  className={`rounded-xl border bg-white p-4 ${SEVERITY_STYLES[sev].row}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{alert.taskName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        開始日: {alert.startDate} / リードタイム: {alert.leadTime}日
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_STYLES[sev].badge}`}>
                        重要度: {SEVERITY_LABELS[sev]}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-slate-700">
                        残 {alert.daysRemaining}日
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Materials */}
      {activeTab === "materials" && (
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {m.category} / {m.quantity}{m.unit} / 納期: {m.dueDate}
                  </p>
                </div>
                <select
                  value={m.status}
                  onChange={(e) => handleStatusChange(m.id, e.target.value as Material["status"])}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[m.status]} focus:outline-none`}
                  aria-label={`${m.name}のステータス`}
                >
                  {(Object.keys(STATUS_LABELS) as Material["status"][]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Calendar */}
      {activeTab === "calendar" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="前月">
              &#8249;
            </button>
            <p className="text-sm font-bold text-slate-900">
              {calYear}年 {calMonth + 1}月
            </p>
            <button type="button" onClick={nextMonth} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="翌月">
              &#8250;
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px text-center text-[10px] font-bold text-slate-400">
            {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {calDays.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />;
              const dayMaterials = dueDates.get(dateStr) ?? [];
              const isToday = dateStr === today;
              return (
                <div
                  key={dateStr}
                  className={`min-h-[40px] rounded-lg p-1 text-center text-xs ${
                    isToday ? "bg-brand-50 ring-1 ring-brand-300" : ""
                  }`}
                >
                  <p className={`font-semibold ${isToday ? "text-brand-700" : "text-slate-700"}`}>
                    {Number(dateStr.slice(8))}
                  </p>
                  {dayMaterials.map((m) => (
                    <div
                      key={m.id}
                      className={`mt-0.5 truncate rounded px-1 text-[9px] font-medium border ${STATUS_STYLES[m.status]}`}
                      title={m.name}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
