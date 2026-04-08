import type { TaskStatus } from "../../domain/types.js";
import { navigate } from "../../hooks/useHashRouter.js";
import { statusColor, statusLabel } from "./utils.js";

type Props = {
  selectedProjectName: string;
  selectedProjectStatusLabel: string;
  selectedProjectPeriod: string;
  connectMode: boolean;
  connectState: { fromTaskId: string } | null;
  sidebarOpen: boolean;
  filterStatus: TaskStatus | "all";
  zoomLevel: "day" | "week";
  totalTasks: number;
  visibleTasks: number;
  completedTasks: number;
  onToggleConnectMode: () => void;
  onToggleSidebar: () => void;
  onOpenCsvModal: () => void;
  onOpenQuickAdd: () => void;
  onFilterStatus: (status: TaskStatus | "all") => void;
  onToggleZoom: () => void;
};

export function GanttHeader({
  selectedProjectName,
  selectedProjectStatusLabel,
  selectedProjectPeriod,
  connectMode,
  connectState,
  sidebarOpen,
  filterStatus,
  zoomLevel,
  totalTasks,
  visibleTasks,
  completedTasks,
  onToggleConnectMode,
  onToggleSidebar,
  onOpenCsvModal,
  onOpenQuickAdd,
  onFilterStatus,
  onToggleZoom,
}: Props) {
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="mb-5 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#f8fafc_0%,#eef4ff_48%,#ffffff_100%)] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">案件工程表</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedProjectName}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">{selectedProjectStatusLabel}</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">{selectedProjectPeriod}</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200">表示 {visibleTasks} / 全 {totalTasks} タスク</span>
              </div>
            </div>
            <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">全体進捗</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{overallProgress}%</p>
                </div>
                <p className="text-sm font-semibold text-slate-600">完了 {completedTasks} / {totalTasks}</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${overallProgress}%`,
                    backgroundColor: overallProgress >= 100 ? "#10b981" : overallProgress >= 50 ? "#2563eb" : "#94a3b8",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenQuickAdd}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            タスク追加
          </button>
          <button
            onClick={onToggleZoom}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200"
            title={zoomLevel === "day" ? "週表示に切替" : "日表示に切替"}
          >
            {zoomLevel === "day" ? "週表示" : "日表示"}
          </button>
          <button
            onClick={onOpenCsvModal}
            className="inline-flex min-h-12 items-center rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
          >
            CSV取込
          </button>
          <button
            onClick={onToggleConnectMode}
            className={`inline-flex min-h-12 items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              connectMode ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {connectMode ? (connectState ? "接続先を選択" : "接続元を選択") : "依存関係"}
          </button>
          <button
            onClick={onToggleSidebar}
            className={`inline-flex min-h-12 items-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              sidebarOpen ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            現場チャット
          </button>
          <button
            onClick={() => navigate("/node-schedule")}
            className="inline-flex min-h-12 items-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            ノード表示
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm" role="list" aria-label="ステータス凡例">
          {(["todo", "in_progress", "done"] as const).map((status) => (
            <span key={status} className="flex items-center gap-1.5" role="listitem">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: statusColor[status] }} aria-hidden="true" />
              {statusLabel[status]}
            </span>
          ))}
          <span className="flex items-center gap-1.5" role="listitem">
            <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true">
              <polygon points="6,0 12,6 6,12 0,6" fill="#f59e0b" />
            </svg>
            マイルストーン
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="ステータスフィルター">
          <span className="mr-1 text-sm text-slate-500">表示条件:</span>
          {(["all", "todo", "in_progress", "done"] as const).map((status) => (
            <button
              key={status}
              onClick={() => onFilterStatus(status)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                filterStatus === status ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status === "all" ? "全ステータス" : statusLabel[status]}
            </button>
          ))}
        </div>
        <div className="text-sm text-slate-500">工程バーには進捗率を表示しています。</div>
      </div>
    </div>
  );
}
