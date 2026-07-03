import { useEffect, useMemo, useState } from "react";
import type { Contractor, Project } from "../domain/types.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";
import { formatScheduleDate, statusColor, statusLabel } from "../components/gantt/utils.js";
import type { GanttTask } from "../components/gantt/types.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import { ACTION_LABELS } from "../lib/action-labels.js";

export function TasksPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const contractorRepository = useMemo(() => createContractorRepository(() => organizationId), [organizationId]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(readLastProjectId());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [allProjects, allTasks, allContractors] = await Promise.all([
        projectRepository.findAll(),
        taskRepository.findAll(),
        contractorRepository.findAll(),
      ]);
      const contractorMap = new Map<string, Contractor>(allContractors.map((contractor) => [contractor.id, contractor]));
      setProjects(allProjects);
      setSelectedProjectId((current) => current ?? allProjects[0]?.id ?? null);
      setTasks(
        filterScheduleTasks(allTasks)
          .map((task) => ({
            ...task,
            projectName: allProjects.find((project) => project.id === task.projectId)?.name ?? "不明な案件",
            startDate: task.startDate ?? task.dueDate ?? "",
            endDate: task.dueDate ?? task.startDate ?? "",
            isDateEstimated: !task.startDate || !task.dueDate,
            isMilestone: false,
            projectIncludesWeekends: true,
            contractorName: task.contractorId ? contractorMap.get(task.contractorId)?.name : undefined,
          }))
          .sort((left, right) => left.startDate.localeCompare(right.startDate)),
      );
      setLoading(false);
    };

    void load();
  }, [contractorRepository, projectRepository, taskRepository]);

  const visibleProjects = projects.length > 0 ? projects : [];
  const visibleTasks = tasks.filter((task) => !selectedProjectId || task.projectId === selectedProjectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="読み込み中">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] bg-white px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">タスク</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">案件タスク一覧</h1>
        <p className="mt-2 text-sm text-slate-500">案件を切り替えて、工程表へ戻る前に一覧で確認できます。</p>
        <div className="mobile-scroll-x mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {visibleProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  writeLastProjectId(project.id);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  project.id === selectedProjectId
                    ? "bg-[#007AFF] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {visibleTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => {
              writeLastProjectId(task.projectId);
              navigate(`/gantt/${task.projectId}`);
            }}
            className="flex w-full items-start justify-between gap-3 rounded-[24px] bg-white px-4 py-4 text-left shadow-sm ring-1 ring-slate-200"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: statusColor[task.status] }} />
                <p className="truncate text-base font-semibold text-slate-900">{task.name}</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">{task.contractorName ?? "協力会社未設定"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {formatScheduleDate(task.startDate)} - {formatScheduleDate(task.endDate)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {statusLabel[task.status]}
              </span>
              <p className="mt-2 text-sm font-bold tabular-nums text-slate-900">{task.progress}%</p>
            </div>
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">タスクがありません</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {selectedProjectId
              ? "この案件にタスクはまだありません。工程表からタスクを追加してください。"
              : "案件を選択するか、工程表からタスクを追加してください。"}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(selectedProjectId ? `/gantt/${selectedProjectId}` : "/gantt")}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
            >
              {selectedProjectId ? ACTION_LABELS.task.createFirst : "ガントで管理"}
            </button>
            {selectedProjectId && (
              <button
                type="button"
                onClick={() => navigate(`/gantt/${selectedProjectId}`)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                選択中案件のガントへ移動
              </button>
            )}
            {!selectedProjectId && (
              <button
                type="button"
                onClick={() => navigate("/app")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                案件を選ぶ
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
