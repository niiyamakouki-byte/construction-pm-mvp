import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Contractor, Project } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useGanttDrag } from "../hooks/useGanttDrag.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { AiActionCard } from "../components/AiActionCard.js";
import type { AiAction } from "../components/AiActionCard.js";
import { CommunicationSidebar } from "../components/CommunicationSidebar.js";
import { GanttPageErrorBoundary } from "../components/PageErrorBoundaries.js";
import { GanttPageSkeleton } from "../components/PageSkeletons.js";
import { cascadeShiftPhase, detectPhaseOverlap } from "../domain/cascade-service.js";

// Sub-components
import { GanttHeader } from "../components/gantt/GanttHeader.js";
import { GanttChart } from "../components/gantt/GanttChart.js";
import { QuickAddForm } from "../components/gantt/QuickAddForm.js";
import { TaskEditModal } from "../components/gantt/TaskEditModal.js";

// Types & utils
import type { TaskStatus } from "../domain/types.js";
import type {
  GanttTask,
  PhaseGroup,
  ConnectState,
  QuickAddState,
  TaskDetailState,
  ChartLayout,
} from "../components/gantt/types.js";
import {
  toLocalDateString,
  addDays,
  daysBetween,
  getAlertLevel,
} from "../components/gantt/utils.js";

/** Cap the total chart days to prevent browser meltdown with extreme date ranges */
const MAX_CHART_DAYS = 365;
const SAMPLE_CSV_GANTT = `タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数\n墨出し・下地確認,内装,2024-04-01,2024-04-02,田中工務店,,0\n解体・撤去,内装,2024-04-02,2024-04-05,田中工務店,,1\n`;

// ── Component ────────────────────────────────────────

function GanttPageContent() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const taskRepository = useMemo(
    () => createTaskRepository(() => organizationId),
    [organizationId],
  );
  const contractorRepository = useMemo(
    () => createContractorRepository(() => organizationId),
    [organizationId],
  );
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailState | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => toLocalDateString(new Date()), []);

  // Connect (dependency) mode state
  const [connectMode, setConnectMode] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cascade shift confirm dialog state
  const [cascadeConfirm, setCascadeConfirm] = useState<{
    targetProjectId: string;
    delayDays: number;
    affectedCount: number;
  } | null>(null);

  // Filter + zoom state
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [zoomLevel, setZoomLevel] = useState<"day" | "week">("day");
  const effectiveDayWidth = zoomLevel === "week" ? 14 : 36;

  // CSV import state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; error: number } | null>(null);
  const [csvToastError, setCsvToastError] = useState<string | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

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
      const projectMap = new Map<string, Project>();
      for (const p of allProjects) projectMap.set(p.id, p);
      const contractorMap = new Map<string, Contractor>();
      for (const c of allContractors) contractorMap.set(c.id, c);

      const tasks: GanttTask[] = allTasks.map((t) => {
        const project = projectMap.get(t.projectId);
        const projectStart = project?.startDate ?? today;
        const isDateEstimated = !t.dueDate;
        const startDate = t.startDate ?? (t.dueDate ? addDays(t.dueDate, -7) : projectStart);
        const endDate = t.dueDate ?? addDays(startDate, 7);
        const clampedStart = startDate < projectStart ? projectStart : startDate;
        const duration = daysBetween(clampedStart, endDate);
        const isMilestone = duration <= 1;
        const contractor = t.contractorId ? contractorMap.get(t.contractorId) : undefined;

        return {
          ...t,
          projectName: project?.name ?? "不明",
          startDate: clampedStart,
          endDate,
          isDateEstimated,
          isMilestone,
          projectIncludesWeekends: project?.includeWeekends ?? true,
          contractorName: contractor?.name,
        };
      });

      tasks.sort((a, b) => a.startDate.localeCompare(b.startDate));
      setGanttTasks(tasks);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "データの読み込みに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }, [contractorRepository, projectRepository, taskRepository, today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Scroll to today on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayMarker = scrollRef.current.querySelector("[data-today]");
      if (todayMarker) {
        todayMarker.scrollIntoView({ inline: "center", behavior: "smooth" });
      }
    }
  }, [loading]);

  // ── CSV Import ─────────────────────────────────────────────
  const downloadSampleCsv = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV_GANTT], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleCsvImport = useCallback(async (file: File) => {
    if (projects.length === 0) {
      setCsvToastError("CSVをインポートする前に、プロジェクトを1件以上作成してください。");
      return;
    }

    setCsvImporting(true);
    setCsvResult(null);
    setCsvToastError(null);
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) { setCsvResult({ success: 0, error: 0 }); return; }
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
        return row;
      });

      const defaultProjectId = projects[0]?.id ?? "";
      const now = new Date();
      let successCount = 0;
      let errorCount = 0;
      for (const row of rows) {
        const taskName = row["タスク名"] ?? row["task_name"] ?? "";
        if (!taskName) { errorCount++; continue; }
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
          successCount++;
        } catch {
          errorCount++;
        }
      }
      setCsvResult({ success: successCount, error: errorCount });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSVインポート失敗");
    } finally {
      setCsvImporting(false);
    }
  }, [projects, taskRepository, loadData]);

  const handleCsvFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleCsvImport(file);
    e.target.value = "";
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

  // Filtered tasks based on status filter
  const filteredGanttTasks = useMemo(
    () => filterStatus === "all" ? ganttTasks : ganttTasks.filter((t) => t.status === filterStatus),
    [ganttTasks, filterStatus],
  );

  // Summary counts
  const completedTasksCount = useMemo(
    () => ganttTasks.filter((t) => t.status === "done").length,
    [ganttTasks],
  );

  // Build phase groups from tasks, grouped by project
  const phaseGroups = useMemo((): PhaseGroup[] => {
    const groupMap = new Map<string, GanttTask[]>();
    const projectNameMap = new Map<string, string>();
    for (const task of filteredGanttTasks) {
      if (!groupMap.has(task.projectId)) {
        groupMap.set(task.projectId, []);
        projectNameMap.set(task.projectId, task.projectName);
      }
      groupMap.get(task.projectId)!.push(task);
    }
    const groups: PhaseGroup[] = [];
    for (const [projectId, tasks] of groupMap) {
      groups.push({
        projectId,
        projectName: projectNameMap.get(projectId) ?? "不明",
        tasks,
        collapsed: collapsedPhases.has(projectId),
      });
    }
    return groups;
  }, [filteredGanttTasks, collapsedPhases]);

  // Flat list of visible rows for chart rendering
  const visibleRows = useMemo((): Array<{ type: "phase"; group: PhaseGroup } | { type: "task"; task: GanttTask }> => {
    const rows: Array<{ type: "phase"; group: PhaseGroup } | { type: "task"; task: GanttTask }> = [];
    for (const group of phaseGroups) {
      rows.push({ type: "phase", group });
      if (!group.collapsed) {
        for (const task of group.tasks) {
          rows.push({ type: "task", task });
        }
      }
    }
    return rows;
  }, [phaseGroups]);

  const togglePhase = useCallback((projectId: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const openQuickAdd = useCallback((projectId: string, projectName: string) => {
    const proj = projects.find((p) => p.id === projectId);
    const defaultStart = proj?.startDate ?? today;
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

  const handleQuickAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdd || !quickAdd.name.trim()) return;
    setQuickAdd((q) => q ? { ...q, submitting: true } : q);
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
      setQuickAdd((q) => q ? { ...q, submitting: false } : q);
    }
  }, [quickAdd, taskRepository, loadData]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    try {
      await taskRepository.delete(taskId);
      setTaskDetail(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの削除に失敗しました");
    }
  }, [taskRepository, loadData]);

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

  const handleTaskDetailSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDetail) return;
    const prevContractorId = taskDetail.task.contractorId;
    const newContractorId = taskDetail.editContractorId || undefined;
    const prevStartDate = taskDetail.task.startDate;
    const newStartDate = taskDetail.editStartDate || undefined;
    setTaskDetail((d) => d ? { ...d, saving: true } : d);
    try {
      const parsedLeadTime = taskDetail.editLeadTimeDays
        ? Number(taskDetail.editLeadTimeDays)
        : undefined;
      const parsedMaterials = taskDetail.editMaterials
        ? taskDetail.editMaterials.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      await taskRepository.update(taskDetail.task.id, {
        name: taskDetail.editName.trim(),
        startDate: newStartDate,
        dueDate: taskDetail.editDueDate || undefined,
        assigneeId: taskDetail.editAssigneeId.trim() || undefined,
        contractorId: newContractorId,
        progress: taskDetail.editProgress,
        status: taskDetail.editStatus,
        materials: parsedMaterials,
        leadTimeDays: Number.isFinite(parsedLeadTime) ? parsedLeadTime : undefined,
        updatedAt: new Date().toISOString(),
      });
      if (newContractorId && newStartDate !== prevStartDate) {
        const contractor = contractors.find((c) => c.id === newContractorId);
        const notificationRepository = createNotificationRepository(() => organizationId);
        const now = new Date();
        await notificationRepository.create({
          id: crypto.randomUUID(),
          projectId: taskDetail.task.projectId,
          taskId: taskDetail.task.id,
          contractorId: newContractorId,
          type: prevContractorId === newContractorId ? "schedule_changed" : "schedule_confirmed",
          message: `${taskDetail.editName.trim()}の開始日が${newStartDate ?? "未設定"}に${prevContractorId === newContractorId ? "変更されました" : "確定しました"}。（業者: ${contractor?.name ?? "不明"}）`,
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
      setTaskDetail((d) => d ? { ...d, saving: false } : d);
    }
  }, [taskDetail, taskRepository, loadData, contractors, organizationId]);

  // Check if adding fromId -> toId would create a circular dependency
  const wouldCreateCycle = useCallback((fromId: string, toId: string): boolean => {
    const visited = new Set<string>();
    const queue = [toId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const task = ganttTasks.find((t) => t.id === current);
      if (task) {
        for (const dep of task.dependencies ?? []) {
          queue.push(dep);
        }
      }
    }
    return false;
  }, [ganttTasks]);

  const handleConnectTask = useCallback(async (toTaskId: string) => {
    if (!connectState) return;
    const fromId = connectState.fromTaskId;
    if (fromId === toTaskId) {
      setConnectState(null);
      return;
    }
    const toTask = ganttTasks.find((t) => t.id === toTaskId);
    if (!toTask) return;

    const currentDeps = toTask.dependencies ?? [];
    if (currentDeps.includes(fromId)) {
      try {
        await taskRepository.update(toTaskId, {
          dependencies: currentDeps.filter((d) => d !== fromId),
          updatedAt: new Date().toISOString(),
        });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "依存関係の削除に失敗しました");
      }
    } else {
      if (wouldCreateCycle(fromId, toTaskId)) {
        setError(`循環依存が検出されました。このタスクへの接続はできません。`);
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
  }, [connectState, ganttTasks, taskRepository, loadData]);

  // Memoize chart layout calculations
  const chartLayout = useMemo((): ChartLayout | null => {
    if (ganttTasks.length === 0) return null;

    const allDates = ganttTasks.flatMap((t) => [t.startDate, t.endDate]);
    allDates.push(today);
    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));
    const chartStart = addDays(minDate, -3);
    const chartEnd = addDays(maxDate, 7);
    const rawTotalDays = daysBetween(chartStart, chartEnd);
    const totalDays = Math.min(rawTotalDays, MAX_CHART_DAYS);
    const isCapped = rawTotalDays > MAX_CHART_DAYS;

    const dates: string[] = [];
    for (let i = 0; i <= totalDays; i++) {
      dates.push(addDays(chartStart, i));
    }

    const dateInfo = dates.map((d) => {
      const dateObj = new Date(d);
      const day = dateObj.getDay();
      return {
        date: d,
        isToday: d === today,
        isWeekend: day === 0 || day === 6,
      };
    });

    const highlightedDates = dateInfo.filter((di) => di.isToday || di.isWeekend);
    const todayOffset = daysBetween(chartStart, today);

    return {
      chartStart,
      chartEnd,
      totalDays,
      isCapped,
      dates,
      dateInfo,
      highlightedDates,
      todayOffset,
      dayWidth: effectiveDayWidth,
    };
  }, [ganttTasks, today, effectiveDayWidth]);

  // Alert summary
  const alertSummary = useMemo(() => {
    const overdue = ganttTasks.filter((t) => getAlertLevel(t, today) === "overdue");
    const urgent = ganttTasks.filter((t) => getAlertLevel(t, today) === "urgent");
    const soon = ganttTasks.filter((t) => getAlertLevel(t, today) === "soon");
    return { overdue, urgent, soon };
  }, [ganttTasks, today]);

  // Cascade shift: detect overlapping phases per project
  const cascadeOpportunities = useMemo(() => {
    const results: Array<{
      projectId: string;
      delayDays: number;
      affectedCount: number;
    }> = [];

    for (const group of phaseGroups) {
      const sorted = [...group.tasks].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      );
      if (sorted.length < 2) continue;

      const midpoint = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midpoint);
      const secondHalf = sorted.slice(midpoint);

      const delayDays = detectPhaseOverlap(
        { projectId: group.projectId, tasks: firstHalf.map((t) => ({ id: t.id, projectId: t.projectId, startDate: t.startDate, endDate: t.endDate })) },
        { projectId: group.projectId, tasks: secondHalf.map((t) => ({ id: t.id, projectId: t.projectId, startDate: t.startDate, endDate: t.endDate })) },
      );

      if (delayDays !== null) {
        results.push({
          projectId: group.projectId,
          delayDays,
          affectedCount: secondHalf.length,
        });
      }
    }
    return results;
  }, [phaseGroups]);

  // AI action cards
  const aiActions = useMemo((): AiAction[] => {
    const actions: AiAction[] = [];

    if (alertSummary.overdue.length > 0) {
      actions.push({
        id: "overdue-check",
        severity: "urgent",
        message: `${alertSummary.overdue.length}件のタスクが期限を過ぎています。担当業者に確認しますか？`,
        actionLabel: "確認通知を作成",
        onAction: async () => {
          const notificationRepo = createNotificationRepository(() => organizationId);
          const now = new Date();
          for (const t of alertSummary.overdue) {
            if (!t.contractorId) continue;
            await notificationRepo.create({
              id: crypto.randomUUID(),
              projectId: t.projectId,
              taskId: t.id,
              contractorId: t.contractorId,
              type: "alert",
              message: `${t.name}が期限を過ぎています。進捗確認をお願いします。`,
              status: "pending",
              scheduledAt: now.toISOString(),
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            });
          }
        },
      });
    }

    const recentlyMoved = ganttTasks.filter(
      (t) => t.contractorId && getAlertLevel(t, today) !== null,
    );
    if (recentlyMoved.length > 0) {
      const task = recentlyMoved[0];
      const contractor = contractors.find((c) => c.id === task.contractorId);
      actions.push({
        id: `reschedule-${task.id}`,
        severity: "warning",
        message: `${task.name}が遅延しています。${contractor?.name ?? "担当業者"}にリスケ通知を送りますか？`,
        actionLabel: "通知作成",
        onAction: async () => {
          const notificationRepo = createNotificationRepository(() => organizationId);
          const now = new Date();
          await notificationRepo.create({
            id: crypto.randomUUID(),
            projectId: task.projectId,
            taskId: task.id,
            contractorId: task.contractorId!,
            type: "schedule_changed",
            message: `${task.name}のスケジュールが変更されました。リスケをご確認ください。（業者: ${contractor?.name ?? "不明"}）`,
            status: "pending",
            scheduledAt: now.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
        },
      });
    }

    const MATERIAL_ALERT_DAYS = 7;
    const materialAlerts = ganttTasks.filter((t) => {
      if (!t.leadTimeDays || !t.startDate) return false;
      const orderDeadline = addDays(t.startDate, -t.leadTimeDays);
      const diff = daysBetween(today, orderDeadline);
      return diff <= MATERIAL_ALERT_DAYS;
    });

    for (const t of materialAlerts) {
      const orderDeadline = addDays(t.startDate, -(t.leadTimeDays ?? 0));
      const daysUntil = daysBetween(today, orderDeadline);
      actions.push({
        id: `material-${t.id}`,
        severity: daysUntil < 0 ? "urgent" : "warning",
        message: daysUntil < 0
          ? `${t.name}の材料発注期限が${Math.abs(daysUntil)}日過ぎています。今すぐ発注してください。`
          : `${t.name}の材料発注期限が${daysUntil}日後（${orderDeadline}）です。発注しますか？`,
        actionLabel: "発注通知を作成",
        onAction: async () => {
          const notificationRepo = createNotificationRepository(() => organizationId);
          const now = new Date();
          await notificationRepo.create({
            id: crypto.randomUUID(),
            projectId: t.projectId,
            taskId: t.id,
            contractorId: t.contractorId,
            type: "reminder",
            message: `${t.name}の材料発注期限（${orderDeadline}）が近づいています。発注を確認してください。`,
            status: "pending",
            scheduledAt: now.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
        },
      });
    }

    return actions;
  }, [alertSummary, ganttTasks, contractors, today, organizationId]);

  const handleCascadeConfirm = useCallback(async () => {
    if (!cascadeConfirm) return;
    const { targetProjectId, delayDays } = cascadeConfirm;
    const group = phaseGroups.find((g) => g.projectId === targetProjectId);
    if (!group) {
      setCascadeConfirm(null);
      return;
    }

    const sorted = [...group.tasks].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    const midpoint = Math.floor(sorted.length / 2);
    const secondHalf = sorted.slice(midpoint);

    const result = cascadeShiftPhase(
      {
        projectId: targetProjectId,
        tasks: secondHalf.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          startDate: t.startDate,
          endDate: t.endDate,
        })),
      },
      delayDays,
    );

    try {
      for (const shifted of result.shiftedTasks) {
        await taskRepository.update(shifted.id, {
          startDate: shifted.newStartDate,
          dueDate: shifted.newEndDate,
          updatedAt: new Date().toISOString(),
        });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "フェーズシフトに失敗しました");
    } finally {
      setCascadeConfirm(null);
    }
  }, [cascadeConfirm, phaseGroups, taskRepository, loadData]);

  // ── Loading / Error states ──────────────────────────────────
  if (loading) {
    return <GanttPageSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">読み込みエラー</h2>
          <p className="mt-2 text-base text-red-600">{error}</p>
          <button
            onClick={() => { setLoading(true); void loadData(); }}
            className="mt-4 rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600"
            style={{ minHeight: 48 }}
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────
  if (ganttTasks.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">ガントチャート</h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200">
            <div className="shrink-0 border-r border-slate-200 bg-slate-50/80 px-3 py-3" style={{ width: 240 }}>
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">タスク</span>
            </div>
            <div className="flex-1 flex">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex-1 border-r border-slate-100 px-1 py-3 min-w-[36px]">
                  <div className="h-3 w-6 rounded bg-slate-100 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <svg className="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">タスクがありません</h3>
              <p className="mt-1.5 text-base text-slate-500">
                プロジェクトにタスクを追加すると、ガントチャートが表示されます。
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate("/app")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700"
                  style={{ minHeight: 60 }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  タスクを追加
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chartLayout) return null;

  const { isCapped } = chartLayout;
  const estimatedCount = ganttTasks.filter((t) => t.isDateEstimated).length;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      {csvToastError && (
        <div className="fixed right-4 top-4 z-[60] w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg" role="alert">
          <div className="flex items-start gap-3 text-sm text-red-700">
            <span className="mt-0.5 shrink-0">!</span>
            <span className="flex-1">{csvToastError}</span>
            <button
              type="button"
              onClick={() => setCsvToastError(null)}
              className="shrink-0 text-red-400 hover:text-red-600"
              aria-label="エラーを閉じる"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Communication sidebar */}
      <CommunicationSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Cascade shift confirm dialog */}
      {cascadeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setCascadeConfirm(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-bold text-slate-900">フェーズ自動調整</h3>
            <p className="text-base text-slate-700">
              この変更により後続{cascadeConfirm.affectedCount}件のタスクが
              自動的に<strong>{cascadeConfirm.delayDays}日</strong>押し出されます。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCascadeConfirm(null)}
                className="rounded-lg px-5 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                style={{ minHeight: 48 }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => { void handleCascadeConfirm(); }}
                className="rounded-lg bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-600"
                style={{ minHeight: 48 }}
              >
                調整する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add task modal */}
      {quickAdd && (
        <QuickAddForm
          quickAdd={quickAdd}
          onClose={() => setQuickAdd(null)}
          onSubmit={(e) => void handleQuickAddSubmit(e)}
          onChange={(updater) => setQuickAdd((q) => q ? updater(q) : q)}
        />
      )}

      {/* Task detail / edit modal */}
      {taskDetail && (
        <TaskEditModal
          taskDetail={taskDetail}
          contractors={contractors}
          onClose={() => setTaskDetail(null)}
          onSubmit={(e) => void handleTaskDetailSave(e)}
          onChange={(updater) => setTaskDetail((d) => d ? updater(d) : d)}
          onDelete={(taskId) => void handleTaskDelete(taskId)}
        />
      )}

      {/* CSV import modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCsvModal(false)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">CSVインポート</h3>
            <p className="text-sm text-slate-500 mb-3">CSV形式: タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数</p>
            {csvResult && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-base ${csvResult.error === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                成功: {csvResult.success}件 / エラー: {csvResult.error}件
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={downloadSampleCsv}
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-base font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                style={{ minHeight: 48 }}
              >
                サンプルCSVをダウンロード
              </button>
              <input ref={csvFileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />
              <button
                onClick={() => csvFileRef.current?.click()}
                disabled={csvImporting}
                className="w-full rounded-lg bg-brand-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
                style={{ minHeight: 60 }}
              >
                {csvImporting ? "インポート中..." : "CSVファイルを選択"}
              </button>
            </div>
            <button
              onClick={() => setShowCsvModal(false)}
              className="mt-4 w-full rounded-lg px-4 py-3 text-base text-slate-500 hover:bg-slate-100 transition-colors"
              style={{ minHeight: 48 }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Header: title + toolbar */}
      <GanttHeader
        connectMode={connectMode}
        connectState={connectState}
        sidebarOpen={sidebarOpen}
        filterStatus={filterStatus}
        zoomLevel={zoomLevel}
        totalTasks={ganttTasks.length}
        completedTasks={completedTasksCount}
        onToggleConnectMode={() => { setConnectMode((m) => !m); setConnectState(null); }}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenCsvModal={() => { setCsvResult(null); setCsvToastError(null); setShowCsvModal(true); }}
        onFilterStatus={setFilterStatus}
        onToggleZoom={() => setZoomLevel((z) => z === "day" ? "week" : "day")}
      />

      {/* Alert banner */}
      {(alertSummary.overdue.length > 0 || alertSummary.urgent.length > 0) && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5" role="alert">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="text-base text-red-700">
              {alertSummary.overdue.length > 0 && (
                <span className="font-semibold">{alertSummary.overdue.length}件が期限超過</span>
              )}
              {alertSummary.overdue.length > 0 && alertSummary.urgent.length > 0 && <span className="mx-1">·</span>}
              {alertSummary.urgent.length > 0 && (
                <span className="font-semibold">{alertSummary.urgent.length}件が本日期限</span>
              )}
              {alertSummary.soon.length > 0 && (
                <span className="ml-2 text-amber-700">（あと{alertSummary.soon.length}件が3日以内に期限）</span>
              )}
            </div>
          </div>
        </div>
      )}
      {alertSummary.overdue.length === 0 && alertSummary.urgent.length === 0 && alertSummary.soon.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-base text-amber-700" role="status">
          <span className="font-semibold">{alertSummary.soon.length}件</span>のタスクが3日以内に期限を迎えます。
        </div>
      )}

      {/* Warnings */}
      {isCapped && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-base text-amber-700" role="alert">
          日付範囲が広いため、最大{MAX_CHART_DAYS}日間に制限して表示しています。
        </div>
      )}
      {estimatedCount > 0 && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700" role="status">
          {estimatedCount}件のタスクに期限が未設定のため、推定日程で表示しています（破線バー）。
        </div>
      )}

      {connectMode && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-700" role="status">
          依存関係モード: タスクバーの右端のコネクタポイントをクリックして接続元を選び、次に接続先のタスクバーの左端をクリックしてください。もう一度クリックで接続解除。
        </div>
      )}

      {/* AI Action Cards */}
      {aiActions.length > 0 && (
        <AiActionCard actions={aiActions} />
      )}

      {/* Cascade phase shift alerts */}
      {cascadeOpportunities.map((opp) => {
        const group = phaseGroups.find((g) => g.projectId === opp.projectId);
        if (!group) return null;
        return (
          <div
            key={`cascade-${opp.projectId}`}
            className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5"
            role="alert"
          >
            <p className="text-base text-orange-800">
              <span className="font-semibold">{group.projectName}</span>:
              フェーズの遅延により後続{opp.affectedCount}件のタスクへの影響が検出されました。
            </p>
            <button
              type="button"
              onClick={() => setCascadeConfirm({ targetProjectId: opp.projectId, delayDays: opp.delayDays, affectedCount: opp.affectedCount })}
              className="shrink-0 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
              style={{ minHeight: 48 }}
            >
              {opp.delayDays}日 自動調整
            </button>
          </div>
        );
      })}

      {/* Main Gantt Chart */}
      <GanttChart
        ganttTasks={ganttTasks}
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
        onTogglePhase={togglePhase}
        onSetConnectState={setConnectState}
        onConnectTask={(toTaskId) => void handleConnectTask(toTaskId)}
      />
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
