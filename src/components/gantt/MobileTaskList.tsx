import { BarChart2, ChevronRight } from "lucide-react";
import type { GanttTask } from "./types.js";
import {
  addDays,
  daysBetween,
  effectiveProgress,
  formatWeekdayLabel,
  getAlertLevel,
  statusColor,
  statusLabel,
} from "./utils.js";

// 来歴: laporta-beads-ftaqp (GenbaHub: モバイル工程表を7日縦リスト化) / worker(opus) / 2026-07-20
// 390px以下では横スクロールのガントだと文字が極小になるため、既定を「今日から7日」の
// 縦リストにする。横タイムライン(ガント)は onShowTimeline の全画面表示へ分離する。
// 配色はGenbaHub基調(セージ brand / slate)に寄せ、緊急度のみ amber/red を最小限に使う。

type Props = {
  tasks: GanttTask[];
  today: string;
  onOpenTaskDetail: (task: GanttTask) => void;
  onShowTimeline: () => void;
  windowDays?: number;
};

function relativeDayLabel(offset: number): string | null {
  if (offset === 0) return "今日";
  if (offset === 1) return "明日";
  return null;
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function overlapsDay(task: GanttTask, day: string): boolean {
  return task.startDate <= day && day <= task.endDate;
}

export function MobileTaskList({ tasks, today, onOpenTaskDetail, onShowTimeline, windowDays = 7 }: Props) {
  const days = Array.from({ length: windowDays }, (_, i) => addDays(today, i));
  const windowEnd = days[days.length - 1];
  const tasksInWindow = tasks.filter((task) => task.startDate <= windowEnd && task.endDate >= today);

  return (
    <div data-testid="gantt-mobile-list" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">今日からの7日間</p>
          <p className="text-xs text-slate-500">{tasksInWindow.length}件の工程</p>
        </div>
        <button
          type="button"
          onClick={onShowTimeline}
          data-testid="gantt-show-timeline"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 active:bg-brand-200"
        >
          <BarChart2 className="h-4 w-4" aria-hidden="true" />
          ガントを見る
        </button>
      </div>

      {tasksInWindow.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">今日から7日間の工程はありません</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
            この期間に予定された工程がありません。全体の流れはガントで確認できます。
          </p>
          <button
            type="button"
            onClick={onShowTimeline}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 active:bg-brand-700"
          >
            <BarChart2 className="h-4 w-4" aria-hidden="true" />
            ガントを見る
          </button>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {days.map((day, offset) => {
            const dayTasks = tasksInWindow
              .filter((task) => overlapsDay(task, day))
              .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
            const rel = relativeDayLabel(offset);
            const isToday = offset === 0;
            return (
              <li key={day} className="rounded-2xl bg-white ring-1 ring-slate-200">
                <div
                  className={`flex items-baseline gap-2 rounded-t-2xl px-3.5 py-2 ${
                    isToday ? "bg-brand-50" : "bg-slate-50/70"
                  }`}
                >
                  <span className={`text-sm font-bold ${isToday ? "text-brand-700" : "text-slate-700"}`}>
                    {shortDate(day)}
                  </span>
                  <span className="text-xs text-slate-400">（{formatWeekdayLabel(day)}）</span>
                  {rel ? (
                    <span className={`text-xs font-semibold ${isToday ? "text-brand-600" : "text-slate-500"}`}>
                      {rel}
                    </span>
                  ) : null}
                </div>
                {dayTasks.length === 0 ? (
                  <p className="px-3.5 py-3 text-xs text-slate-400">予定なし</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {dayTasks.map((task) => {
                      const progress = effectiveProgress(task);
                      const alert = getAlertLevel(task, today);
                      const starts = task.startDate === day;
                      const ends = task.endDate === day;
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={() => onOpenTaskDetail(task)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                          >
                            <span
                              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: statusColor[task.status] }}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-slate-800">{task.name}</span>
                                {starts ? (
                                  <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                                    開始
                                  </span>
                                ) : null}
                                {ends ? (
                                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                    完了予定
                                  </span>
                                ) : null}
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
                                {task.contractorName ? (
                                  <span className="truncate">・{task.contractorName}</span>
                                ) : null}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{progress}%</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
