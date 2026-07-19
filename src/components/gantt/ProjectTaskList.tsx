import { ChevronRight } from "lucide-react";
import type { GanttTask } from "./types.js";
import {
  compareGanttRows,
  effectiveProgress,
  formatScheduleDate,
  getAlertLevel,
  statusColor,
  statusLabel,
} from "./utils.js";

// 来歴: laporta-beads-pe4m1 (GenbaHub: 工程関連ルートと名称を統合) / worker(opus) / 2026-07-20
// 「工程」の一覧ビュー。工種(majorCategory)ごとに束ね、全工程を縦に俯瞰する。
// ガント/カードと同じ Task データを別レイアウトで見せる（データソースは共通）。

type Props = {
  tasks: GanttTask[];
  today: string;
  onOpenTaskDetail: (task: GanttTask) => void;
};

function groupByPhase(tasks: GanttTask[]): { phase: string; items: GanttTask[] }[] {
  const map = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    const phase = task.majorCategory?.trim() || "その他";
    if (!map.has(phase)) map.set(phase, []);
    map.get(phase)!.push(task);
  }
  return Array.from(map.entries()).map(([phase, items]) => ({
    phase,
    items: [...items].sort(compareGanttRows),
  }));
}

export function ProjectTaskList({ tasks, today, onOpenTaskDetail }: Props) {
  const groups = groupByPhase(tasks);

  return (
    <div data-testid="project-task-list" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-900">工程一覧</p>
        <p className="text-xs text-slate-500">{tasks.length}件の工程</p>
      </div>
      {groups.map(({ phase, items }) => (
        <section key={phase} className="rounded-2xl bg-white ring-1 ring-slate-200">
          <h3 className="rounded-t-2xl bg-slate-50/70 px-3.5 py-2 text-xs font-bold text-slate-600">{phase}</h3>
          <ul className="divide-y divide-slate-100">
            {items.map((task) => {
              const progress = effectiveProgress(task);
              const alert = getAlertLevel(task, today);
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTaskDetail(task)}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: statusColor[task.status] }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-slate-800">{task.name}</span>
                        {alert === "overdue" ? (
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            期限切
                          </span>
                        ) : alert === "urgent" || alert === "soon" ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            {alert === "urgent" ? "本日期限" : "期限間近"}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{statusLabel[task.status]}</span>
                        <span className="truncate">
                          {formatScheduleDate(task.startDate)} 〜 {formatScheduleDate(task.endDate)}
                        </span>
                        {task.contractorName ? <span className="truncate">・{task.contractorName}</span> : null}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{progress}%</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
