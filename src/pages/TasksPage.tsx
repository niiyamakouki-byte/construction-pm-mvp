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
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
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
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  project.id === selectedProjectId
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600"
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
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          この案件に表示できるタスクはありません。
        </div>
      ) : null}
    </div>
  );
}
