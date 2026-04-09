import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Contractor, Project, ProjectStatus, TaskStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useGanttDrag } from "../hooks/useGanttDrag.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { GanttPageErrorBoundary } from "../components/PageErrorBoundaries.js";
import { GanttPageSkeleton } from "../components/PageSkeletons.js";
import { GanttChart } from "../components/gantt/GanttChart.js";
import { QuickAddForm } from "../components/gantt/QuickAddForm.js";
import { TaskEditModal } from "../components/gantt/TaskEditModal.js";
import type { ChartLayout, GanttTask, QuickAddState, TaskDetailState } from "../components/gantt/types.js";
import { addDays, daysBetween, formatScheduleDate, toLocalDateString } from "../components/gantt/utils.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";
import { cascadeSchedule } from "../lib/cascade-scheduler.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import type { ConnectState } from "../components/gantt/types.js";

const MAX_CHART_DAYS = 240;
const MIN_DAY_WIDTH = 20;
const MAX_DAY_WIDTH = 52;
const DEFAULT_DAY_WIDTH = 32;

const projectStatusLabel: Record<ProjectStatus, string> = {
  planning: "計画中",
  active: "進行中",
  completed: "完了",
  on_hold: "保留",
};

const projectStatusTone: Record<ProjectStatus, string> = {
  planning: "bg-blue-50 text-blue-700 ring-blue-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  on_hold: "bg-amber-50 text-amber-700 ring-amber-200",
};

function buildProjectPeriod(project: Project, tasks: GanttTask[]) {
  const rangeStart = [project.startDate, ...tasks.map((task) => task.startDate)].sort()[0] ?? project.startDate;
  const fallbackEnd = addDays(project.startDate, 21);
  const rangeEnd = [project.endDate ?? fallbackEnd, ...tasks.map((task) => task.endDate)].sort().at(-1) ?? fallbackEnd;
  return `${formatScheduleDate(rangeStart)} - ${formatScheduleDate(rangeEnd)}`;
}

function EmptyScheduleState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
      >
        {actionLabel}
      </button>
    </div>
  );
}

type GanttPageProps = {
  initialProjectId?: string | null;
};

function GanttPageContent({ initialProjectId = null }: GanttPageProps) {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const contractorRepository = useMemo(() => createContractorRepository(() => organizationId), [organizationId]);

  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId ?? readLastProjectId());
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailState | null>(null);
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [connectMode, setConnectMode] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{
    distance: number;
    dayWidth: number;
    anchorDay: number;
  } | null>(null);
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allTasks, allProjects, allContractors] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
        contractorRepository.findAll(),
      ]);

      setProjects(allProjects);
      setContractors(allContractors);

      const contractorMap = new Map(allContractors.map((contractor) => [contractor.id, contractor]));
      const projectMap = new Map(allProjects.map((project) => [project.id, project]));

      const nextTasks = filterScheduleTasks(allTasks)
        .map((task) => {
          const project = projectMap.get(task.projectId);
          const projectStart = project?.startDate ?? today;
          const startDate = task.startDate ?? (task.dueDate ? addDays(task.dueDate, -2) : projectStart);
          const endDate = task.dueDate ?? addDays(startDate, 2);
          return {
            ...task,
            projectName: project?.name ?? "不明な案件",
            startDate,
            endDate,
            isDateEstimated: !task.startDate || !task.dueDate,
            isMilestone: false,
            projectIncludesWeekends: project?.includeWeekends ?? true,
            contractorName: task.contractorId ? contractorMap.get(task.contractorId)?.name : undefined,
          } satisfies GanttTask;
        })
        .sort((left, right) => {
          const byStart = left.startDate.localeCompare(right.startDate);
          if (byStart !== 0) return byStart;
          return left.endDate.localeCompare(right.endDate);
        });

      setGanttTasks(nextTasks);
      setSelectedProjectId((current) => {
        const candidates = [initialProjectId, current, readLastProjectId()].filter(Boolean) as string[];
        const matched = candidates.find((candidate) => allProjects.some((project) => project.id === candidate));
        if (matched) return matched;
        const preferred = allProjects.find((project) => project.status === "active") ?? allProjects[0];
        return preferred?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "工程表の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [contractorRepository, initialProjectId, projectRepository, taskRepository, today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialProjectId) return;
    setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    writeLastProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedProjectTasks = useMemo(
    () => ganttTasks.filter((task) => task.projectId === selectedProjectId),
    [ganttTasks, selectedProjectId],
  );

  const selectedProjectPeriod = useMemo(() => {
    if (!selectedProject) return "期間未設定";
    return buildProjectPeriod(selectedProject, selectedProjectTasks);
  }, [selectedProject, selectedProjectTasks]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayMarker = scrollRef.current.querySelector('[data-today="true"]');
      if (todayMarker) {
        todayMarker.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
      }
    }
  }, [loading, selectedProjectId, dayWidth]);

  const openQuickAdd = useCallback((projectId: string, projectName: string) => {
    const project = projects.find((item) => item.id === projectId);
    const startDate = project?.startDate ?? today;
    setQuickAdd({
      projectId,
      projectName,
      name: "",
      startDate,
      dueDate: addDays(startDate, 2),
      contractorId: "",
      status: "todo",
      submitting: false,
      selectedCategory: "",
    });
  }, [projects, today]);

  const openTaskDetail = useCallback((task: GanttTask) => {
    setTaskDetail({
      task,
      editName: task.name,
      editStartDate: task.startDate,
      editDueDate: task.endDate,
      editAssigneeId: task.assigneeId ?? "",
      editContractorId: task.contractorId ?? "",
      editProgress: task.progress,
      editStatus: task.status,
      editMaterials: task.materials?.join(", ") ?? "",
      editLeadTimeDays: task.leadTimeDays != null ? String(task.leadTimeDays) : "",
      saving: false,
    });
  }, []);

  const handleQuickAddSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickAdd || !quickAdd.name.trim()) return;

    setQuickAdd((current) => (current ? { ...current, submitting: true } : current));
    try {
      const now = new Date().toISOString();
      await taskRepository.create({
        id: crypto.randomUUID(),
        projectId: quickAdd.projectId,
        name: quickAdd.name.trim(),
        description: "",
        status: quickAdd.status,
        startDate: quickAdd.startDate || undefined,
        dueDate: quickAdd.dueDate || undefined,
        contractorId: quickAdd.contractorId || undefined,
        progress: quickAdd.status === "done" ? 100 : quickAdd.status === "in_progress" ? 40 : 0,
        dependencies: [],
        createdAt: now,
        updatedAt: now,
      });
      setQuickAdd(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの追加に失敗しました");
      setQuickAdd((current) => (current ? { ...current, submitting: false } : current));
    }
  }, [loadData, quickAdd, taskRepository]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    try {
      await taskRepository.delete(taskId);
      setTaskDetail(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの削除に失敗しました");
    }
  }, [loadData, taskRepository]);

  const handleTaskDetailSave = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskDetail) return;

    const previousStartDate = taskDetail.task.startDate;
    const nextStartDate = taskDetail.editStartDate || undefined;
    const previousContractorId = taskDetail.task.contractorId;
    const nextContractorId = taskDetail.editContractorId || undefined;

    setTaskDetail((current) => (current ? { ...current, saving: true } : current));
    try {
      const materials = taskDetail.editMaterials
        ? taskDetail.editMaterials.split(",").map((value) => value.trim()).filter(Boolean)
        : undefined;
      const leadTimeDays = taskDetail.editLeadTimeDays ? Number(taskDetail.editLeadTimeDays) : undefined;

      await taskRepository.update(taskDetail.task.id, {
        name: taskDetail.editName.trim(),
        startDate: nextStartDate,
        dueDate: taskDetail.editDueDate || undefined,
        assigneeId: taskDetail.editAssigneeId.trim() || undefined,
        contractorId: nextContractorId,
        progress: taskDetail.editProgress,
        status: taskDetail.editStatus,
        materials,
        leadTimeDays: Number.isFinite(leadTimeDays) ? leadTimeDays : undefined,
        updatedAt: new Date().toISOString(),
      });

      if (nextContractorId && nextStartDate !== previousStartDate) {
        const notificationRepository = createNotificationRepository(() => organizationId);
        const contractor = contractors.find((item) => item.id === nextContractorId);
        const now = new Date().toISOString();
        await notificationRepository.create({
          id: crypto.randomUUID(),
          projectId: taskDetail.task.projectId,
          taskId: taskDetail.task.id,
          contractorId: nextContractorId,
          type: previousContractorId === nextContractorId ? "schedule_changed" : "schedule_confirmed",
          message: `${taskDetail.editName.trim()}の開始日が${nextStartDate ?? "未設定"}になりました。（業者: ${contractor?.name ?? "不明"}）`,
          status: "pending",
          scheduledAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Cascade date changes to downstream dependents
      const newEndDate = taskDetail.editDueDate || taskDetail.task.endDate;
      const cascadeUpdates = cascadeSchedule(ganttTasks, taskDetail.task.id, taskDetail.editStartDate || taskDetail.task.startDate, newEndDate);
      const now2 = new Date().toISOString();
      await Promise.all(
        Array.from(cascadeUpdates.entries()).map(([taskId, dates]) =>
          taskRepository.update(taskId, { startDate: dates.startDate, dueDate: dates.endDate, updatedAt: now2 }),
        ),
      );

      setTaskDetail(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの更新に失敗しました");
      setTaskDetail((current) => (current ? { ...current, saving: false } : current));
    }
  }, [contractors, ganttTasks, loadData, organizationId, taskDetail, taskRepository]);

  const handleConnectTask = useCallback(async (toTaskId: string) => {
    if (!connectState) return;
    const { fromTaskId } = connectState;
    if (fromTaskId === toTaskId) return;

    setConnectState(null);
    setConnectMode(false);

    const toTask = ganttTasks.find((t) => t.id === toTaskId);
    if (!toTask) return;

    // Prevent duplicate dependencies
    if (toTask.dependencies?.includes(fromTaskId)) return;

    try {
      await taskRepository.update(toTaskId, {
        dependencies: [...(toTask.dependencies ?? []), fromTaskId],
        updatedAt: new Date().toISOString(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "依存関係の設定に失敗しました");
    }
  }, [connectState, ganttTasks, loadData, taskRepository]);

  const handleToggleConnectMode = useCallback(() => {
    setConnectMode((prev) => {
      if (prev) setConnectState(null);
      return !prev;
    });
  }, []);

  const { dragState, dragRef, startTaskDrag, startTaskResize } = useGanttDrag({
    ganttTasks,
    contractors,
    dayWidth,
    organizationId,
    taskRepository,
    loadData,
    onError: setError,
  });

  const chartLayout = useMemo((): ChartLayout | null => {
    if (!selectedProject) return null;

    const fallbackEnd = selectedProject.endDate ?? addDays(selectedProject.startDate, 14);
    const allDates = [
      selectedProject.startDate,
      fallbackEnd,
      today,
      ...selectedProjectTasks.flatMap((task) => [task.startDate, task.endDate]),
    ];
    const minDate = allDates.reduce((left, right) => (left < right ? left : right));
    const maxDate = allDates.reduce((left, right) => (left > right ? left : right));
    const chartStart = addDays(minDate, -2);
    const chartEnd = addDays(maxDate, 4);
    const rawTotalDays = daysBetween(chartStart, chartEnd);
    const totalDays = Math.min(rawTotalDays, MAX_CHART_DAYS);
    const dates: string[] = [];
    for (let index = 0; index <= totalDays; index += 1) dates.push(addDays(chartStart, index));
    const dateInfo = dates.map((date) => {
      const day = new Date(date).getDay();
      return { date, isToday: date === today, isWeekend: day === 0 || day === 6 };
    });

    return {
      chartStart,
      chartEnd,
      totalDays,
      isCapped: rawTotalDays > MAX_CHART_DAYS,
      dates,
      dateInfo,
      highlightedDates: dateInfo.filter((item) => item.isToday || item.isWeekend),
      todayOffset: daysBetween(chartStart, today),
      dayWidth,
    };
  }, [dayWidth, selectedProject, selectedProjectTasks, today]);

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    writeLastProjectId(projectId);
    navigate(`/gantt/${projectId}`);
  }, []);

  const handleTimelineTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !scrollRef.current) return;
    const firstTouch = event.touches.item(0);
    const secondTouch = event.touches.item(1);
    if (!firstTouch || !secondTouch) return;
    const distance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
    const rect = scrollRef.current.getBoundingClientRect();
    const midpointX = (firstTouch.clientX + secondTouch.clientX) / 2 - rect.left;
    pinchRef.current = {
      distance,
      dayWidth,
      anchorDay: (scrollRef.current.scrollLeft + midpointX) / dayWidth,
    };
  }, [dayWidth]);

  const handleTimelineTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !scrollRef.current || !pinchRef.current) return;
    event.preventDefault();
    const firstTouch = event.touches.item(0);
    const secondTouch = event.touches.item(1);
    if (!firstTouch || !secondTouch) return;
    const distance = Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY,
    );
    const rect = scrollRef.current.getBoundingClientRect();
    const midpointX = (firstTouch.clientX + secondTouch.clientX) / 2 - rect.left;
    const nextDayWidth = Math.min(
      MAX_DAY_WIDTH,
      Math.max(MIN_DAY_WIDTH, (distance / pinchRef.current.distance) * pinchRef.current.dayWidth),
    );
    setDayWidth(nextDayWidth);
    requestAnimationFrame(() => {
      if (!scrollRef.current || !pinchRef.current) return;
      scrollRef.current.scrollLeft = pinchRef.current.anchorDay * nextDayWidth - midpointX;
    });
  }, []);

  const handleTimelineTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  if (loading) return <GanttPageSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-[26px] border border-red-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">工程表を表示できません</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadData();
            }}
            className="mt-5 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyScheduleState
        title="案件がありません"
        description="先に案件を1件作成すると、案件を選んですぐ工程表を開けます。"
        actionLabel="案件一覧へ"
        onAction={() => navigate("/app")}
      />
    );
  }

  if (!selectedProject) {
    return (
      <EmptyScheduleState
        title="案件を選択してください"
        description="案件一覧または上の案件チップから工程表を開けます。"
        actionLabel="案件一覧へ"
        onAction={() => navigate("/app")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] space-y-4 pb-24">
      {quickAdd ? (
        <QuickAddForm
          quickAdd={quickAdd}
          contractors={contractors}
          onClose={() => setQuickAdd(null)}
          onSubmit={(event) => void handleQuickAddSubmit(event)}
          onChange={(updater) => setQuickAdd((current) => (current ? updater(current) : current))}
        />
      ) : null}

      {taskDetail ? (
        <TaskEditModal
          taskDetail={taskDetail}
          contractors={contractors}
          onClose={() => setTaskDetail(null)}
          onSubmit={(event) => void handleTaskDetailSave(event)}
          onChange={(updater) => setTaskDetail((current) => (current ? updater(current) : current))}
          onDelete={(taskId) => void handleTaskDelete(taskId)}
        />
      ) : null}

      <section className="rounded-[28px] bg-[linear-gradient(145deg,#fff8ef_0%,#f7fbff_55%,#eef6ff_100%)] px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">工程表</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{selectedProject.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${projectStatusTone[selectedProject.status]}`}>
                {projectStatusLabel[selectedProject.status]}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {selectedProjectPeriod}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {selectedProjectTasks.length}件
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
              ピンチで拡大縮小 / バーをドラッグして日程変更
            </div>
            <button
              type="button"
              onClick={handleToggleConnectMode}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                connectMode
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {connectMode
                ? connectState
                  ? "接続先を選択"
                  : "接続元を選択"
                : "依存関係を接続"}
            </button>
          </div>
        </div>

        <div className="mobile-scroll-x mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {projects.map((project) => {
              const active = project.id === selectedProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleProjectSelect(project.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {project.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {selectedProjectTasks.length === 0 || !chartLayout ? (
        <EmptyScheduleState
          title="この案件に工程がありません"
          description="右下の追加ボタンから最初の工程を登録すると、すぐにバーで表示されます。"
          actionLabel="工程を追加"
          onAction={() => openQuickAdd(selectedProject.id, selectedProject.name)}
        />
      ) : (
        <GanttChart
          ganttTasks={selectedProjectTasks}
          visibleRows={selectedProjectTasks.map((task) => ({ type: "task" as const, task }))}
          chartLayout={chartLayout}
          dragState={dragState}
          dragRef={dragRef}
          connectMode={connectMode}
          connectState={connectState}
          today={today}
          scrollRef={scrollRef}
          onTaskDragStart={startTaskDrag}
          onTaskResizeStart={startTaskResize}
          onOpenTaskDetail={openTaskDetail}
          onOpenQuickAdd={openQuickAdd}
          onTogglePhase={() => undefined}
          onSetConnectState={setConnectState}
          onConnectTask={(toTaskId) => void handleConnectTask(toTaskId)}
          onTimelineTouchStart={handleTimelineTouchStart}
          onTimelineTouchMove={handleTimelineTouchMove}
          onTimelineTouchEnd={handleTimelineTouchEnd}
        />
      )}

      <button
        type="button"
        onClick={() => openQuickAdd(selectedProject.id, selectedProject.name)}
        className="safe-bottom fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-[0_16px_30px_rgba(37,99,235,0.35)] md:bottom-6"
        aria-label="新しいタスクを追加"
      >
        +
      </button>
    </div>
  );
}

export function GanttPage({ initialProjectId = null }: GanttPageProps) {
  return (
    <GanttPageErrorBoundary>
      <GanttPageContent initialProjectId={initialProjectId} />
    </GanttPageErrorBoundary>
  );
}
