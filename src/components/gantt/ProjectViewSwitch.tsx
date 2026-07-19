import { CalendarDays, GanttChartSquare, LayoutGrid, List } from "lucide-react";

// 来歴: laporta-beads-pe4m1 (GenbaHub: 工程関連ルートと名称を統合) / worker(opus) / 2026-07-20
// 案件内の工程を 今日 / 一覧 / ガント / カード の4ビューで切替える共有セグメント。
// 分裂していた /gantt・/cards・工程表・全案件ガントを「工程」の1体験に束ねる。
// 配色はGenbaHub基調(セージ brand / slate)。アクティブのみ brand で塗る。

export type ProjectView = "today" | "list" | "gantt" | "cards";

const SEGMENTS: { key: ProjectView; label: string; icon: typeof List }[] = [
  { key: "today", label: "今日", icon: CalendarDays },
  { key: "list", label: "一覧", icon: List },
  { key: "gantt", label: "ガント", icon: GanttChartSquare },
  { key: "cards", label: "カード", icon: LayoutGrid },
];

type Props = {
  active: ProjectView;
  onSelect: (view: ProjectView) => void;
};

export function ProjectViewSwitch({ active, onSelect }: Props) {
  return (
    <div
      data-testid="project-view-switch"
      role="tablist"
      aria-label="工程の表示切替"
      className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5"
    >
      {SEGMENTS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
