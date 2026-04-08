import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Contractor, Project, ProjectStatus, TaskStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useGanttDrag } from "../hooks/useGanttDrag.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { CommunicationSidebar } from "../components/CommunicationSidebar.js";
import { GanttPageErrorBoundary } from "../components/PageErrorBoundaries.js";
import { GanttPageSkeleton } from "../components/PageSkeletons.js";
import { GanttHeader } from "../components/gantt/GanttHeader.js";
import { GanttChart } from "../components/gantt/GanttChart.js";
import { QuickAddForm } from "../components/gantt/QuickAddForm.js";
import { TaskEditModal } from "../components/gantt/TaskEditModal.js";
import type { GanttTask, ConnectState, QuickAddState, TaskDetailState, ChartLayout } from "../components/gantt/types.js";
import { addDays, daysBetween, formatScheduleDate, getAlertLevel, toLocalDateString } from "../components/gantt/utils.js";

const MAX_CHART_DAYS = 365;
const SAMPLE_CSV_GANTT = `タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数\n墨出し・下地確認,内装,2024-04-01,2024-04-02,田中工務店,,0\n解体・撤去,内装,2024-04-02,2024-04-05,田中工務店,,1\n`;

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[320px] items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <button
            onClick={onAction}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function GanttPageContent() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const contractorRepository = useMemo(() => createContractorRepository(() => organizationId), [organizationId]);

  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailState | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [zoomLevel, setZoomLevel] = useState<"day" | "week">("day");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; error: number } | null>(null);
  const [csvToastError, setCsvToastError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => toLocalDateString(new Date()), []);
  const effectiveDayWidth = zoomLevel === "week" ? 14 : 36;

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allTasks, allProjects, allContractors] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
        contractorRepository.findAll(),
      ]);

      setProjects(allProjects);
      setSelectedProjectId((current) => {
        if (current && allProjects.some((project) => project.id === current)) return current;
        const preferred = allProjects.find((project) => project.status === "active") ?? allProjects[0];
        return preferred?.id ?? null;
      });
      setContractors(allContractors);
      const projectMap = new Map<string, Project>();
      for (const project of allProjects) projectMap.set(project.id, project);
      const contractorMap = new Map<string, Contractor>();
      for (const contractor of allContractors) contractorMap.set(contractor.id, contractor);

      const tasks: GanttTask[] = allTasks.map((task) => {
        const project = projectMap.get(task.projectId);
        const projectStart = project?.startDate ?? today;
        const isDateEstimated = !task.dueDate;
        const startDate = task.startDate ?? (task.dueDate ? addDays(task.dueDate, -7) : projectStart);
        const endDate = task.dueDate ?? addDays(startDate, 7);
        const clampedStart = startDate < projectStart ? projectStart : startDate;
        const duration = daysBetween(clampedStart, endDate);
        return {
          ...task,
          projectName: project?.name ?? "不明",
          startDate: clampedStart,
          endDate,
          isDateEstimated,
          isMilestone: duration <= 1,
          projectIncludesWeekends: project?.includeWeekends ?? true,
          contractorName: task.contractorId ? contractorMap.get(task.contractorId)?.name : undefined,
        };
      });

      tasks.sort((left, right) => {
        const byStart = left.startDate.localeCompare(right.startDate);
        if (byStart !== 0) return byStart;
        return left.endDate.localeCompare(right.endDate);
      });
      setGanttTasks(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [contractorRepository, projectRepository, taskRepository, today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }
    setSelectedProjectId((current) => {
      if (current && projects.some((project) => project.id === current)) return current;
      const preferred = projects.find((project) => project.status === "active") ?? projects[0];
      return preferred?.id ?? null;
    });
  }, [projects]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayMarker = scrollRef.current.querySelector("[data-today]");
      if (todayMarker) todayMarker.scrollIntoView({ inline: "center", behavior: "smooth" });
    }
  }, [loading, selectedProjectId, zoomLevel]);

  const downloadSampleCsv = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV_GANTT], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample_tasks.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleCsvImport = useCallback(async (file: File) => {
    if (projects.length === 0) {
      setCsvToastError("CSVを取り込む前に案件を作成してください。");
      return;
    }

    setCsvImporting(true);
    setCsvResult(null);
    setCsvToastError(null);
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        setCsvResult({ success: 0, error: 0 });
        return;
      }

      const headers = lines[0].split(",").map((header) => header.trim());
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((value) => value.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ?? "";
        });
        return row;
      });

      const defaultProjectId = selectedProjectId ?? projects[0]?.id ?? "";
      const now = new Date();
      let success = 0;
      let failed = 0;
      for (const row of rows) {
        const taskName = row["タスク名"] ?? row["task_name"] ?? "";
        if (!taskName) {
          failed += 1;
          continue;
        }
        try {
          await taskRepository.create({
            id: crypto.randomUUID(),
            projectId: defaultProjectId,
            name: taskName,
            description: row["カテゴリ"] ?? "",
            status: "todo",
            startDate: row["開始日"] || undefined,
            dueDate: row["終了日"] || undefined,
            contractorId: row["担当業者"] ?? row["contractor"] ?? row["assignee"] ?? undefined,
            materials: row["材料"] ? [row["材料"]] : [],
            leadTimeDays: row["リードタイム日数"] ? Number(row["リードタイム日数"]) : 0,
            progress: 0,
            dependencies: [],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
          success += 1;
        } catch {
          failed += 1;
        }
      }
      setCsvResult({ success, error: failed });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV取り込みに失敗しました");
    } finally {
      setCsvImporting(false);
    }
  }, [loadData, projects, selectedProjectId, taskRepository]);

  const handleCsvFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleCsvImport(file);
    event.target.value = "";
  }, [handleCsvImport]);

  const { dragState, dragRef, startTaskDrag, startTaskResize } = useGanttDrag({
    ganttTasks,
    contractors,
    dayWidth: effectiveDayWidth,
    organizationId,
    taskRepository,
    loadData,
    onError: setError,
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const projectSummaries = useMemo(() => {
    return projects.map((project) => {
      const tasks = ganttTasks.filter((task) => task.projectId === project.id);
      const completed = tasks.filter((task) => task.status === "done").length;
      const inProgress = tasks.filter((task) => task.status === "in_progress").length;
      const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      return {
        project,
        tasks,
        completed,
        inProgress,
        progress,
        period: buildProjectPeriod(project, tasks),
      };
    });
  }, [ganttTasks, projects]);

  const selectedSummary = useMemo(
    () => projectSummaries.find((summary) => summary.project.id === selectedProjectId) ?? null,
    [projectSummaries, selectedProjectId],
  );

  const selectedProjectTasks = selectedSummary?.tasks ?? [];
  const filteredProjectTasks = useMemo(
    () => filterStatus === "all" ? selectedProjectTasks : selectedProjectTasks.filter((task) => task.status === filterStatus),
    [filterStatus, selectedProjectTasks],
  );

  const visibleRows = useMemo(
    () => filteredProjectTasks.map((task) => ({ type: "task" as const, task })),
    [filteredProjectTasks],
  );

  const completedTasksCount = selectedProjectTasks.filter((task) => task.status === "done").length;
  const estimatedCount = selectedProjectTasks.filter((task) => task.isDateEstimated).length;

  const alertSummary = useMemo(() => {
    const overdue = selectedProjectTasks.filter((task) => getAlertLevel(task, today) === "overdue");
    const urgent = selectedProjectTasks.filter((task) => getAlertLevel(task, today) === "urgent");
    const soon = selectedProjectTasks.filter((task) => getAlertLevel(task, today) === "soon");
    return { overdue, urgent, soon };
  }, [selectedProjectTasks, today]);

  const openQuickAdd = useCallback((projectId: string, projectName: string) => {
    const project = projects.find((item) => item.id === projectId);
    const defaultStart = project?.startDate ?? today;
    setQuickAdd({
      projectId,
      projectName,
      name: "",
      startDate: defaultStart,
      dueDate: addDays(defaultStart, 7),
      assigneeId: "",
      submitting: false,
      selectedCategory: "",
    });
  }, [projects, today]);

  const handleQuickAddSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickAdd || !quickAdd.name.trim()) return;
    setQuickAdd((current) => (current ? { ...current, submitting: true } : current));
    try {
      const now = new Date();
      await taskRepository.create({
        id: crypto.randomUUID(),
        projectId: quickAdd.projectId,
        name: quickAdd.name.trim(),
        description: "",
        status: "todo",
        startDate: quickAdd.startDate || undefined,
        dueDate: quickAdd.dueDate || undefined,
        assigneeId: quickAdd.assigneeId.trim() || undefined,
        progress: 0,
        dependencies: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
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

  const handleTaskDetailSave = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskDetail) return;
    const prevContractorId = taskDetail.task.contractorId;
    const nextContractorId = taskDetail.editContractorId || undefined;
    const prevStartDate = taskDetail.task.startDate;
    const nextStartDate = taskDetail.editStartDate || undefined;
    setTaskDetail((current) => (current ? { ...current, saving: true } : current));
    try {
      const parsedLeadTime = taskDetail.editLeadTimeDays ? Number(taskDetail.editLeadTimeDays) : undefined;
      const parsedMaterials = taskDetail.editMaterials
        ? taskDetail.editMaterials.split(",").map((value) => value.trim()).filter(Boolean)
        : undefined;

      await taskRepository.update(taskDetail.task.id, {
        name: taskDetail.editName.trim(),
        startDate: nextStartDate,
        dueDate: taskDetail.editDueDate || undefined,
        assigneeId: taskDetail.editAssigneeId.trim() || undefined,
        contractorId: nextContractorId,
        progress: taskDetail.editProgress,
        status: taskDetail.editStatus,
        materials: parsedMaterials,
        leadTimeDays: Number.isFinite(parsedLeadTime) ? parsedLeadTime : undefined,
        updatedAt: new Date().toISOString(),
      });

      if (nextContractorId && nextStartDate !== prevStartDate) {
        const contractor = contractors.find((item) => item.id === nextContractorId);
        const notificationRepository = createNotificationRepository(() => organizationId);
        const now = new Date();
        await notificationRepository.create({
          id: crypto.randomUUID(),
          projectId: taskDetail.task.projectId,
          taskId: taskDetail.task.id,
          contractorId: nextContractorId,
          type: prevContractorId === nextContractorId ? "schedule_changed" : "schedule_confirmed",
          message: `${taskDetail.editName.trim()}の開始日が${nextStartDate ?? "未設定"}に${prevContractorId === nextContractorId ? "変更されました" : "確定しました"}。（業者: ${contractor?.name ?? "不明"}）`,
          status: "pending",
          scheduledAt: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }

      setTaskDetail(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの更新に失敗しました");
      setTaskDetail((current) => (current ? { ...current, saving: false } : current));
    }
  }, [contractors, loadData, organizationId, taskDetail, taskRepository]);

  const wouldCreateCycle = useCallback((fromId: string, toId: string): boolean => {
    const visited = new Set<string>();
    const queue = [toId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const task = selectedProjectTasks.find((item) => item.id === current);
      if (!task) continue;
      for (const dependency of task.dependencies ?? []) queue.push(dependency);
    }
    return false;
  }, [selectedProjectTasks]);

  const handleConnectTask = useCallback(async (toTaskId: string) => {
    if (!connectState) return;
    const fromId = connectState.fromTaskId;
    if (fromId === toTaskId) {
      setConnectState(null);
      return;
    }
    const toTask = selectedProjectTasks.find((task) => task.id === toTaskId);
    if (!toTask) return;

    const currentDeps = toTask.dependencies ?? [];
    if (currentDeps.includes(fromId)) {
      try {
        await taskRepository.update(toTaskId, {
          dependencies: currentDeps.filter((dependency) => dependency !== fromId),
          updatedAt: new Date().toISOString(),
        });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "依存関係の削除に失敗しました");
      }
    } else {
      if (wouldCreateCycle(fromId, toTaskId)) {
        setError("循環依存が検出されました。この接続は設定できません。");
        setConnectState(null);
        return;
      }
      try {
        await taskRepository.update(toTaskId, {
          dependencies: [...currentDeps, fromId],
          updatedAt: new Date().toISOString(),
        });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "依存関係の追加に失敗しました");
      }
    }
    setConnectState(null);
  }, [connectState, loadData, selectedProjectTasks, taskRepository, wouldCreateCycle]);

  const chartLayout = useMemo((): ChartLayout | null => {
    if (!selectedProject) return null;
    const fallbackEnd = selectedProject.endDate ?? addDays(selectedProject.startDate, 21);
    const allDates = [selectedProject.startDate, fallbackEnd, today, ...selectedProjectTasks.flatMap((task) => [task.startDate, task.endDate])];
    const minDate = allDates.reduce((left, right) => (left < right ? left : right));
    const maxDate = allDates.reduce((left, right) => (left > right ? left : right));
    const chartStart = addDays(minDate, -2);
    const chartEnd = addDays(maxDate, 5);
    const rawTotalDays = daysBetween(chartStart, chartEnd);
    const totalDays = Math.min(rawTotalDays, MAX_CHART_DAYS);
    const isCapped = rawTotalDays > MAX_CHART_DAYS;
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
      isCapped,
      dates,
      dateInfo,
      highlightedDates: dateInfo.filter((item) => item.isToday || item.isWeekend),
      todayOffset: daysBetween(chartStart, today),
      dayWidth: effectiveDayWidth,
    };
  }, [effectiveDayWidth, selectedProject, selectedProjectTasks, today]);

  if (loading) return <GanttPageSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">読み込みエラー</h2>
          <p className="mt-2 text-base text-red-600">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              void loadData();
            }}
            className="mt-4 rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 pb-24">
        <EmptyScheduleState
          title="案件がまだありません"
          description="案件を作成すると、案件ごとの工程表をタイムラインで確認できます。"
          actionLabel="案件一覧へ移動"
          onAction={() => navigate("/app")}
        />
      </div>
    );
  }

  const selectedProjectPeriod = selectedProject ? buildProjectPeriod(selectedProject, selectedProjectTasks) : "期間未設定";

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24">
      {csvToastError && (
        <div className="fixed right-4 top-4 z-[60] w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg" role="alert">
          <div className="flex items-start gap-3 text-sm text-red-700">
            <span className="mt-0.5 shrink-0">!</span>
            <span className="flex-1">{csvToastError}</span>
            <button type="button" onClick={() => setCsvToastError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">
              &times;
            </button>
          </div>
        </div>
      )}

      <CommunicationSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {quickAdd && (
        <QuickAddForm
          quickAdd={quickAdd}
          onClose={() => setQuickAdd(null)}
          onSubmit={(event) => void handleQuickAddSubmit(event)}
          onChange={(updater) => setQuickAdd((current) => (current ? updater(current) : current))}
        />
      )}

      {taskDetail && (
        <TaskEditModal
          taskDetail={taskDetail}
          contractors={contractors}
          onClose={() => setTaskDetail(null)}
          onSubmit={(event) => void handleTaskDetailSave(event)}
          onChange={(updater) => setTaskDetail((current) => (current ? updater(current) : current))}
          onDelete={(taskId) => void handleTaskDelete(taskId)}
        />
      )}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCsvModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-slate-900">CSV取込</h3>
            <p className="mb-3 text-sm text-slate-500">CSV形式: タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数</p>
            {csvResult && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-base ${csvResult.error === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                成功: {csvResult.success}件 / エラー: {csvResult.error}件
              </div>
            )}
            <div className="space-y-3">
              <button onClick={downloadSampleCsv} className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base font-medium text-slate-600 hover:bg-slate-50">
                サンプルCSVをダウンロード
              </button>
              <input ref={csvFileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />
              <button
                onClick={() => csvFileRef.current?.click()}
                disabled={csvImporting}
                className="w-full rounded-lg bg-brand-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {csvImporting ? "取込中..." : "CSVファイルを選択"}
              </button>
            </div>
            <button onClick={() => setShowCsvModal(false)} className="mt-4 w-full rounded-lg px-4 py-3 text-base text-slate-500 hover:bg-slate-100">
              閉じる
            </button>
          </div>
        </div>
      )}

      <section className="mb-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">案件ビュー</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">案件別工程スケジュール</h1>
            <p className="mt-1 text-sm text-slate-500">案件をクリックすると、その案件の全工程をタイムラインで表示します。</p>
          </div>
        </div>
        <div className="mobile-scroll-x overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {projectSummaries.map((summary) => {
              const selected = summary.project.id === selectedProjectId;
              return (
                <button
                  key={summary.project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(summary.project.id)}
                  aria-pressed={selected}
                  className={`w-[280px] rounded-2xl border px-4 py-4 text-left transition-all ${
                    selected
                      ? "border-brand-500 bg-white shadow-[0_16px_40px_rgba(37,99,235,0.14)] ring-2 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">{summary.project.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{summary.period}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${projectStatusTone[summary.project.status]}`}>
                      {projectStatusLabel[summary.project.status]}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">全タスク</p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{summary.tasks.length}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">進行中</p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{summary.inProgress}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">完了率</p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{summary.progress}%</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {selectedProject && (
        <GanttHeader
          selectedProjectName={selectedProject.name}
          selectedProjectStatusLabel={projectStatusLabel[selectedProject.status]}
          selectedProjectPeriod={selectedProjectPeriod}
          connectMode={connectMode}
          connectState={connectState}
          sidebarOpen={sidebarOpen}
          filterStatus={filterStatus}
          zoomLevel={zoomLevel}
          totalTasks={selectedProjectTasks.length}
          visibleTasks={filteredProjectTasks.length}
          completedTasks={completedTasksCount}
          onToggleConnectMode={() => {
            setConnectMode((current) => !current);
            setConnectState(null);
          }}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          onOpenCsvModal={() => {
            setCsvResult(null);
            setCsvToastError(null);
            setShowCsvModal(true);
          }}
          onOpenQuickAdd={() => openQuickAdd(selectedProject.id, selectedProject.name)}
          onFilterStatus={setFilterStatus}
          onToggleZoom={() => setZoomLevel((current) => current === "day" ? "week" : "day")}
        />
      )}

      {(alertSummary.overdue.length > 0 || alertSummary.urgent.length > 0) && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <div className="text-sm text-red-700">
            {alertSummary.overdue.length > 0 && <span className="font-semibold">{alertSummary.overdue.length}件が期限超過</span>}
            {alertSummary.overdue.length > 0 && alertSummary.urgent.length > 0 && <span className="mx-1">・</span>}
            {alertSummary.urgent.length > 0 && <span className="font-semibold">{alertSummary.urgent.length}件が本日期限</span>}
            {alertSummary.soon.length > 0 && <span className="ml-2 text-amber-700">あと{alertSummary.soon.length}件が3日以内に期限です。</span>}
          </div>
        </div>
      )}

      {alertSummary.overdue.length === 0 && alertSummary.urgent.length === 0 && alertSummary.soon.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="font-semibold">{alertSummary.soon.length}件</span>のタスクが3日以内に期限を迎えます。
        </div>
      )}

      {chartLayout?.isCapped && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          日付範囲が広いため、最大{MAX_CHART_DAYS}日までに制限して表示しています。
        </div>
      )}

      {estimatedCount > 0 && (
        <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {estimatedCount}件のタスクは期限未設定のため、推定日程で表示しています（破線バー）。
        </div>
      )}

      {connectMode && (
        <div className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          依存関係モード: 接続元のバー右端を選び、続けて接続先のバーをクリックしてください。もう一度接続すると解除されます。
        </div>
      )}

      {!selectedProject ? null : selectedProjectTasks.length === 0 ? (
        <EmptyScheduleState
          title="この案件には工程がありません"
          description="タスクを追加すると、左に工程名、右に工程バーの案件スケジュールが表示されます。"
          actionLabel="最初のタスクを追加"
          onAction={() => openQuickAdd(selectedProject.id, selectedProject.name)}
        />
      ) : !chartLayout ? null : (
        <GanttChart
          ganttTasks={filteredProjectTasks}
          visibleRows={visibleRows}
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
        />
      )}
    </div>
  );
}

export function GanttPage() {
  return (
    <GanttPageErrorBoundary>
      <GanttPageContent />
    </GanttPageErrorBoundary>
  );
}
