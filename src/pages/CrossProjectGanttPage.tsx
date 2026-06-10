import { useEffect, useMemo, useState } from "react";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import {
  getCrossProjectTasks,
  getProjectSummaryCards,
  groupByProject,
} from "../lib/gantt/cross-project-gantt.js";
import { searchGanttTasks } from "../lib/gantt/gantt-search.js";
import type { GanttSearchFilter } from "../lib/gantt/gantt-search.js";
import type { CrossProjectGanttTask, ProjectSummaryCard } from "../lib/gantt/cross-project-gantt.js";
import type { GanttTask } from "../components/gantt/types.js";
import type { TaskStatus } from "../domain/types.js";

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const statusBadge: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-500",
  in_progress: "bg-emerald-100 text-emerald-800",
  done: "bg-gray-200 text-gray-600",
};

function SummaryCard({ card }: { card: ProjectSummaryCard }) {
  const hasOverdue = card.overdueCount > 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="truncate text-sm font-bold text-slate-800">{card.projectName}</h3>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-slate-500">進捗率</span>
            <span className="text-xs font-bold text-slate-800">{card.progressRate}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${card.progressRate}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span>タスク: {card.taskCount}件</span>
        <span>完了: {card.completedCount}件</span>
        {hasOverdue && (
          <span className="font-semibold text-red-600">期限超過: {card.overdueCount}件</span>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: CrossProjectGanttTask }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[task.status]}`}
      >
        {statusLabel[task.status]}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{task.name}</span>
      {task.assigneeId && (
        <span className="shrink-0 text-xs text-slate-500">{task.assigneeId}</span>
      )}
      {task.dueDate && (
        <span className="shrink-0 text-xs text-slate-400">{task.dueDate}</span>
      )}
    </div>
  );
}

export function CrossProjectGanttPage() {
  const { organizationId } = useOrganizationContext();
  const [allTasks, setAllTasks] = useState<CrossProjectGanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    const projectRepo = createProjectRepository(() => organizationId);
    const taskRepo = createTaskRepository(() => organizationId);

    async function load() {
      const [projects, tasks] = await Promise.all([
        projectRepo.findAll(),
        taskRepo.findAll(),
      ]);
      if (cancelled) return;

      const byProject = projects.map((project) => ({
        projectId: project.id,
        projectName: project.name,
        tasks: tasks
          .filter((task) => task.projectId === project.id)
          .map(
            (task): GanttTask => ({
              ...task,
              projectName: project.name,
              startDate: task.dueDate ?? project.startDate,
              endDate: task.dueDate ?? project.startDate,
              isDateEstimated: !task.dueDate,
              isMilestone: false,
              projectIncludesWeekends: project.includeWeekends,
            }),
          ),
      }));

      setAllTasks(getCrossProjectTasks(byProject));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const summaryCards = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return getProjectSummaryCards(allTasks, today);
  }, [allTasks]);

  const assignees = useMemo(() => {
    const ids = new Set<string>();
    for (const task of allTasks) {
      if (task.assigneeId) ids.add(task.assigneeId);
    }
    return Array.from(ids).sort();
  }, [allTasks]);

  const filter: GanttSearchFilter = useMemo(
    () => ({
      query,
      statuses: statusFilter ? [statusFilter as TaskStatus] : [],
      assigneeId: assigneeFilter || undefined,
    }),
    [query, statusFilter, assigneeFilter],
  );

  const searchResults = useMemo(
    () => searchGanttTasks(filter, allTasks),
    [filter, allTasks],
  );

  const groupedResults = useMemo(
    () => groupByProject(searchResults.map((r) => r.task)),
    [searchResults],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">全案件ガントチャート</h1>
        <p className="mt-1 text-sm text-slate-500">全プロジェクトのタスクを横断表示</p>
      </div>

      {/* Summary cards */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card) => (
            <SummaryCard key={card.projectId} card={card} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="タスク・担当者・案件名で検索..."
          aria-label="タスク検索"
          className="h-9 min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
          aria-label="ステータスフィルタ"
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">全ステータス</option>
          <option value="todo">未着手</option>
          <option value="in_progress">進行中</option>
          <option value="done">完了</option>
        </select>
        {assignees.length > 0 && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="担当者フィルタ"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">全担当者</option>
            {assignees.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Task list grouped by project */}
      {groupedResults.size === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            {allTasks.length === 0 ? "タスクがありません" : "条件に一致するタスクが見つかりません"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedResults.entries()).map(([projectId, tasks]) => (
            <div key={projectId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                <span className="text-sm font-bold text-slate-700">{tasks[0].projectName}</span>
                <span className="ml-2 text-xs text-slate-400">{tasks.length}件</span>
              </div>
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
