import type { TaskStatus } from "../../domain/types.js";
import { navigate } from "../../hooks/useHashRouter.js";
import { statusColor, statusLabel } from "./utils.js";

type Props = {
  connectMode: boolean;
  connectState: { fromTaskId: string } | null;
  sidebarOpen: boolean;
  filterStatus: TaskStatus | "all";
  zoomLevel: "day" | "week";
  totalTasks: number;
  completedTasks: number;
  onToggleConnectMode: () => void;
  onToggleSidebar: () => void;
  onOpenCsvModal: () => void;
  onFilterStatus: (status: TaskStatus | "all") => void;
  onToggleZoom: () => void;
};

export function GanttHeader({
  connectMode,
  connectState,
  sidebarOpen,
  filterStatus,
  zoomLevel,
  totalTasks,
  completedTasks,
  onToggleConnectMode,
  onToggleSidebar,
  onOpenCsvModal,
  onFilterStatus,
  onToggleZoom,
}: Props) {
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="mb-4 space-y-2">
      {/* Row 1: title + toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">ガントチャート</h2>
          <button
            onClick={() => navigate("/node-schedule")}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            style={{ minHeight: 48 }}
          >
            ノード表示
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom toggle */}
          <button
            onClick={onToggleZoom}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            style={{ minHeight: 48 }}
            title={zoomLevel === "day" ? "週表示に切替" : "日表示に切替"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            {zoomLevel === "day" ? "週表示" : "日表示"}
          </button>

          {/* CSV import */}
          <button
            onClick={onOpenCsvModal}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
            style={{ minHeight: 48 }}
          >
            CSVインポート
          </button>

          {/* Connect mode toggle */}
          <button
            onClick={onToggleConnectMode}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              connectMode
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            style={{ minHeight: 48 }}
            title="依存関係接続モード"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            {connectMode ? (connectState ? "→ 接続先を選択" : "接続元を選択") : "依存関係"}
          </button>

          {/* Sidebar toggle */}
          <button
            onClick={onToggleSidebar}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              sidebarOpen
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            style={{ minHeight: 48 }}
            title="コミュニケーションパネル"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            現場チャット
          </button>

          {/* Legend */}
          <div className="flex gap-3 text-sm" role="list" aria-label="ステータス凡例">
            {(["todo", "in_progress", "done"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5" role="listitem">
                <span
                  className="inline-block h-3 w-3 rounded"
                  style={{ backgroundColor: statusColor[s] }}
                  aria-hidden="true"
                />
                {statusLabel[s]}
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
      </div>

      {/* Row 2: filter bar + progress summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Status filter */}
        <div className="flex items-center gap-1" role="group" aria-label="ステータスフィルター">
          <span className="text-sm text-slate-500 mr-1">絞込:</span>
          {(["all", "todo", "in_progress", "done"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onFilterStatus(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filterStatus === s
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={{ minHeight: 36 }}
            >
              {s === "all" ? "全て" : statusLabel[s]}
            </button>
          ))}
        </div>

        {/* Overall progress bar */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">全体進捗</span>
            <div className="w-32 h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${overallProgress}%`,
                  backgroundColor: overallProgress >= 100 ? "#10b981" : overallProgress >= 50 ? "#2563eb" : "#f59e0b",
                }}
              />
            </div>
            <span className="font-semibold tabular-nums text-slate-700">
              {overallProgress}% ({completedTasks}/{totalTasks})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
