import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Contractor, Project, Task, TaskStatus } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { createNotificationRepository } from "../stores/notification-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

// ── Helpers ──────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** Move a date by N calendar days, then skip forward past any weekends if includeWeekends=false */
function addDaysSkipWeekends(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  // Skip weekends: if landed on Saturday push to Monday, if Sunday push to Monday
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return toLocalDateString(d);
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const statusColor: Record<TaskStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#2563eb",
  done: "#10b981",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const progressColor = (progress: number): string => {
  if (progress >= 100) return "#10b981";
  if (progress >= 50) return "#2563eb";
  if (progress > 0) return "#f59e0b";
  return "#94a3b8";
};

// ── Construction Work Item Categories ─────────────────

type WorkItem = {
  name: string;
  defaultDays: number;
};

type WorkCategory = {
  label: string;
  items: WorkItem[];
};

const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: "仮設工事",
    items: [
      { name: "足場組立", defaultDays: 3 },
      { name: "足場解体", defaultDays: 2 },
      { name: "養生シート設置", defaultDays: 1 },
      { name: "仮設トイレ設置", defaultDays: 1 },
      { name: "仮囲い設置", defaultDays: 2 },
    ],
  },
  {
    label: "解体工事",
    items: [
      { name: "内装解体", defaultDays: 5 },
      { name: "床解体", defaultDays: 3 },
      { name: "天井解体", defaultDays: 2 },
      { name: "間仕切り撤去", defaultDays: 2 },
      { name: "設備撤去", defaultDays: 3 },
    ],
  },
  {
    label: "躯体工事",
    items: [
      { name: "基礎工事", defaultDays: 7 },
      { name: "コンクリート打設", defaultDays: 3 },
      { name: "型枠工事", defaultDays: 5 },
      { name: "鉄筋工事", defaultDays: 5 },
      { name: "鉄骨工事", defaultDays: 7 },
    ],
  },
  {
    label: "内装工事",
    items: [
      { name: "壁ボード貼り", defaultDays: 5 },
      { name: "クロス貼り", defaultDays: 4 },
      { name: "床材施工", defaultDays: 3 },
      { name: "天井施工", defaultDays: 4 },
      { name: "間仕切り設置", defaultDays: 3 },
      { name: "フローリング施工", defaultDays: 3 },
    ],
  },
  {
    label: "電気工事",
    items: [
      { name: "幹線工事", defaultDays: 3 },
      { name: "配線工事", defaultDays: 5 },
      { name: "照明器具取付", defaultDays: 2 },
      { name: "コンセント取付", defaultDays: 2 },
      { name: "分電盤工事", defaultDays: 2 },
      { name: "弱電工事", defaultDays: 2 },
    ],
  },
  {
    label: "給排水工事",
    items: [
      { name: "給水配管", defaultDays: 4 },
      { name: "排水配管", defaultDays: 4 },
      { name: "衛生器具取付", defaultDays: 3 },
      { name: "水道引込工事", defaultDays: 2 },
    ],
  },
  {
    label: "空調工事",
    items: [
      { name: "エアコン設置", defaultDays: 2 },
      { name: "ダクト工事", defaultDays: 4 },
      { name: "換気設備工事", defaultDays: 3 },
    ],
  },
  {
    label: "外装工事",
    items: [
      { name: "外壁工事", defaultDays: 7 },
      { name: "屋根工事", defaultDays: 5 },
      { name: "防水工事", defaultDays: 3 },
      { name: "外装タイル貼り", defaultDays: 5 },
    ],
  },
  {
    label: "建具工事",
    items: [
      { name: "ドア取付", defaultDays: 2 },
      { name: "窓サッシ取付", defaultDays: 3 },
      { name: "引き戸設置", defaultDays: 2 },
      { name: "シャッター設置", defaultDays: 2 },
    ],
  },
  {
    label: "左官工事",
    items: [
      { name: "モルタル塗り", defaultDays: 5 },
      { name: "タイル張り", defaultDays: 4 },
      { name: "コンクリート補修", defaultDays: 3 },
    ],
  },
  {
    label: "塗装工事",
    items: [
      { name: "外壁塗装", defaultDays: 5 },
      { name: "内壁塗装", defaultDays: 3 },
      { name: "床塗装", defaultDays: 2 },
      { name: "鉄部塗装", defaultDays: 3 },
    ],
  },
  {
    label: "クリーニング",
    items: [
      { name: "中間清掃", defaultDays: 1 },
      { name: "竣工清掃", defaultDays: 2 },
      { name: "ガラス清掃", defaultDays: 1 },
    ],
  },
  {
    label: "検査・引渡し",
    items: [
      { name: "社内検査", defaultDays: 1 },
      { name: "施主検査", defaultDays: 1 },
      { name: "是正工事", defaultDays: 3 },
      { name: "引渡し", defaultDays: 1 },
    ],
  },
];

// ── GanttTask type ────────────────────────────────────

type GanttTask = Task & {
  projectName: string;
  startDate: string;
  endDate: string;
  /** True if task had no dueDate and dates were auto-assigned */
  isDateEstimated: boolean;
  /** True if task is a milestone (0-1 day duration) */
  isMilestone: boolean;
  /** Whether the project includes weekends in schedule */
  projectIncludesWeekends: boolean;
  /** Contractor name, if any */
  contractorName?: string;
};

/** A group of tasks under a project/phase heading */
type PhaseGroup = {
  projectId: string;
  projectName: string;
  tasks: GanttTask[];
  collapsed: boolean;
};

/** Cap the total chart days to prevent browser meltdown with extreme date ranges */
const MAX_CHART_DAYS = 365;

/** Get initials from an assigneeId or fallback */
function getAssigneeInitial(assigneeId?: string): string | null {
  if (!assigneeId) return null;
  return assigneeId.slice(0, 2).toUpperCase();
}

// ── Alert helpers ─────────────────────────────────────

function getAlertLevel(task: GanttTask, today: string): "overdue" | "urgent" | "soon" | null {
  if (task.status === "done") return null;
  const diff = daysBetween(today, task.endDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "urgent";
  if (diff <= 3) return "soon";
  return null;
}

// ── Quick-add form state type ─────────────────────────

type QuickAddState = {
  projectId: string;
  projectName: string;
  name: string;
  startDate: string;
  dueDate: string;
  assigneeId: string;
  submitting: boolean;
  selectedCategory: string;
};

type TaskDetailState = {
  task: GanttTask;
  editName: string;
  editStartDate: string;
  editDueDate: string;
  editAssigneeId: string;
  editContractorId: string;
  editProgress: number;
  editStatus: TaskStatus;
  saving: boolean;
};

// ── Drag state ────────────────────────────────────────

type DragState = {
  taskId: string;
  type: "move" | "resize";
  startX: number;
  originalStartDate: string;
  originalEndDate: string;
  previewStartDate: string;
  previewEndDate: string;
};

// ── Connect mode state ────────────────────────────────

type ConnectState = {
  fromTaskId: string;
};

// ── Component ────────────────────────────────────────

export function GanttPage() {
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

  // Drag & drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Connect (dependency) mode state
  const [connectMode, setConnectMode] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState | null>(null);

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
  }, [today]);

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

  // Global mouse event handlers for drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dayWidth = 36;
      const deltaDays = Math.round((e.clientX - drag.startX) / dayWidth);

      // Check if dragged task's project excludes weekends
      const draggedTask = ganttTasks.find((t) => t.id === drag.taskId);
      const skipWeekends = draggedTask ? !draggedTask.projectIncludesWeekends : false;
      const addFn = skipWeekends ? addDaysSkipWeekends : addDays;

      let previewStartDate = drag.originalStartDate;
      let previewEndDate = drag.originalEndDate;

      if (drag.type === "move") {
        previewStartDate = addFn(drag.originalStartDate, deltaDays);
        previewEndDate = addFn(drag.originalEndDate, deltaDays);
      } else {
        // resize: only move end date, minimum 1 day
        const originalDuration = daysBetween(drag.originalStartDate, drag.originalEndDate);
        const newDuration = Math.max(1, originalDuration + deltaDays);
        previewEndDate = addFn(drag.originalStartDate, newDuration);
      }

      const newDrag = { ...drag, previewStartDate, previewEndDate };
      dragRef.current = newDrag;
      setDragState(newDrag);
    };

    const handleMouseUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDragState(null);

      if (
        drag.previewStartDate !== drag.originalStartDate ||
        drag.previewEndDate !== drag.originalEndDate
      ) {
        try {
          await taskRepository.update(drag.taskId, {
            startDate: drag.previewStartDate,
            dueDate: drag.previewEndDate,
            updatedAt: new Date().toISOString(),
          });
          // Create notification if task has a contractor and start date changed
          if (drag.previewStartDate !== drag.originalStartDate) {
            const movedTask = ganttTasks.find((t) => t.id === drag.taskId);
            if (movedTask?.contractorId) {
              const contractor = contractors.find((c) => c.id === movedTask.contractorId);
              const notificationRepo = createNotificationRepository(() => organizationId);
              const now = new Date();
              await notificationRepo.create({
                id: crypto.randomUUID(),
                projectId: movedTask.projectId,
                taskId: movedTask.id,
                contractorId: movedTask.contractorId,
                type: "schedule_changed",
                message: `${movedTask.name}の開始日が${drag.previewStartDate}に変更されました。（業者: ${contractor?.name ?? "不明"}）`,
                status: "pending",
                scheduledAt: now.toISOString(),
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              });
            }
          }
          await loadData();
        } catch (err) {
          setError(err instanceof Error ? err.message : "タスクの更新に失敗しました");
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", () => { void handleMouseUp(); });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", () => { void handleMouseUp(); });
    };
  }, [taskRepository, loadData, ganttTasks, contractors, organizationId]);

  // Build phase groups from tasks, grouped by project
  const phaseGroups = useMemo((): PhaseGroup[] => {
    const groupMap = new Map<string, GanttTask[]>();
    const projectNameMap = new Map<string, string>();
    for (const task of ganttTasks) {
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
  }, [ganttTasks, collapsedPhases]);

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
      await taskRepository.update(taskDetail.task.id, {
        name: taskDetail.editName.trim(),
        startDate: newStartDate,
        dueDate: taskDetail.editDueDate || undefined,
        assigneeId: taskDetail.editAssigneeId.trim() || undefined,
        contractorId: newContractorId,
        progress: taskDetail.editProgress,
        status: taskDetail.editStatus,
        updatedAt: new Date().toISOString(),
      });
      // Create notification record when start date changes and contractor is set
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
    // BFS/DFS: starting from toId, can we reach fromId following existing deps?
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

  // Handle connecting two tasks (dependency)
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
      // Already connected - remove dependency
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
      // Check for circular dependency: fromId -> toTaskId would be circular if toTaskId is already upstream of fromId
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
  const chartLayout = useMemo(() => {
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
    };
  }, [ganttTasks, today]);

  // Alert summary
  const alertSummary = useMemo(() => {
    const overdue = ganttTasks.filter((t) => getAlertLevel(t, today) === "overdue");
    const urgent = ganttTasks.filter((t) => getAlertLevel(t, today) === "urgent");
    const soon = ganttTasks.filter((t) => getAlertLevel(t, today) === "soon");
    return { overdue, urgent, soon };
  }, [ganttTasks, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16" role="status" aria-label="読み込み中">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center" role="alert">
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white p-8">
          <h2 className="text-lg font-bold text-slate-900">読み込みエラー</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            onClick={() => { setLoading(true); void loadData(); }}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
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
          <h2 className="text-lg font-bold text-slate-900">ガントチャート</h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200">
            <div className="shrink-0 border-r border-slate-200 bg-slate-50/80 px-3 py-3" style={{ width: 240 }}>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">タスク</span>
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
              <h3 className="text-base font-bold text-slate-900">タスクがありません</h3>
              <p className="mt-1.5 text-sm text-slate-500">
                プロジェクトにタスクを追加すると、ガントチャートが表示されます。
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate("/app")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

  const { chartStart, totalDays, isCapped, dateInfo, highlightedDates, todayOffset } = chartLayout;
  const dayWidth = 36;
  const rowHeight = 44;
  const phaseRowHeight = 36;
  const headerHeight = 56;
  const labelWidth = 240;

  const estimatedCount = ganttTasks.filter((t) => t.isDateEstimated).length;

  // Build a map of taskId -> row index for SVG dependency line rendering
  const taskRowIndexMap = new Map<string, number>();
  let rowIdx = 0;
  for (const row of visibleRows) {
    if (row.type === "task") {
      taskRowIndexMap.set(row.task.id, rowIdx);
    }
    rowIdx++;
  }

  // Compute SVG dependency lines
  const dependencyLines: Array<{
    fromTaskId: string;
    toTaskId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }> = [];

  for (const task of ganttTasks) {
    if (!task.dependencies || task.dependencies.length === 0) continue;
    const toRowIdx = taskRowIndexMap.get(task.id);
    if (toRowIdx === undefined) continue;

    for (const depId of task.dependencies) {
      const fromTask = ganttTasks.find((t) => t.id === depId);
      if (!fromTask) continue;
      const fromRowIdx = taskRowIndexMap.get(depId);
      if (fromRowIdx === undefined) continue;

      const fromEndOffset = daysBetween(chartStart, fromTask.endDate);
      const toStartOffset = daysBetween(chartStart, task.startDate);

      const x1 = fromEndOffset * dayWidth + dayWidth / 2;
      const y1 = headerHeight + fromRowIdx * rowHeight + rowHeight / 2;
      const x2 = toStartOffset * dayWidth;
      const y2 = headerHeight + toRowIdx * rowHeight + rowHeight / 2;

      dependencyLines.push({ fromTaskId: depId, toTaskId: task.id, x1, y1, x2, y2 });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      {/* Quick-add task modal */}
      {quickAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setQuickAdd(null)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-bold text-slate-900">
              タスクを追加 — {quickAdd.projectName}
            </h3>
            <form onSubmit={(e) => void handleQuickAddSubmit(e)} className="flex flex-col gap-3">
              {/* Work item selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">作業項目を選ぶ（任意）</label>
                <select
                  value={quickAdd.selectedCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setQuickAdd((q) => q ? { ...q, selectedCategory: "" } : q);
                      return;
                    }
                    // Parse "CategoryIndex:ItemIndex"
                    const [ci, ii] = val.split(":").map(Number);
                    const category = WORK_CATEGORIES[ci];
                    const item = category?.items[ii];
                    if (!item) return;
                    const newDueDate = addDays(quickAdd.startDate, item.defaultDays);
                    setQuickAdd((q) => q ? {
                      ...q,
                      selectedCategory: val,
                      name: item.name,
                      dueDate: newDueDate,
                    } : q);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none bg-white"
                >
                  <option value="">-- カテゴリから選択 --</option>
                  {WORK_CATEGORIES.map((cat, ci) => (
                    <optgroup key={ci} label={cat.label}>
                      {cat.items.map((item, ii) => (
                        <option key={ii} value={`${ci}:${ii}`}>
                          {item.name}（標準{item.defaultDays}日）
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={quickAdd.name}
                onChange={(e) => setQuickAdd((q) => q ? { ...q, name: e.target.value } : q)}
                placeholder="タスク名 *"
                required
                maxLength={200}
                autoFocus
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">開始日</label>
                  <input
                    type="date"
                    value={quickAdd.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setQuickAdd((q) => {
                        if (!q) return q;
                        // If a work item was selected, auto-recalculate end date
                        if (q.selectedCategory && newStart) {
                          const [ci, ii] = q.selectedCategory.split(":").map(Number);
                          const item = WORK_CATEGORIES[ci]?.items[ii];
                          if (item) {
                            return { ...q, startDate: newStart, dueDate: addDays(newStart, item.defaultDays) };
                          }
                        }
                        return { ...q, startDate: newStart };
                      });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">終了日</label>
                  <input
                    type="date"
                    value={quickAdd.dueDate}
                    onChange={(e) => setQuickAdd((q) => q ? { ...q, dueDate: e.target.value } : q)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="text"
                value={quickAdd.assigneeId}
                onChange={(e) => setQuickAdd((q) => q ? { ...q, assigneeId: e.target.value } : q)}
                placeholder="担当者名（任意）"
                maxLength={100}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickAdd(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={quickAdd.submitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
                >
                  {quickAdd.submitting ? "追加中..." : "追加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task detail / edit modal */}
      {taskDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setTaskDetail(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-bold text-slate-900">タスク編集</h3>
            <form onSubmit={(e) => void handleTaskDetailSave(e)} className="flex flex-col gap-3">
              <input
                type="text"
                value={taskDetail.editName}
                onChange={(e) => setTaskDetail((d) => d ? { ...d, editName: e.target.value } : d)}
                placeholder="タスク名 *"
                required
                maxLength={200}
                autoFocus
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">開始日</label>
                  <input
                    type="date"
                    value={taskDetail.editStartDate}
                    onChange={(e) => setTaskDetail((d) => d ? { ...d, editStartDate: e.target.value } : d)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">終了日</label>
                  <input
                    type="date"
                    value={taskDetail.editDueDate}
                    onChange={(e) => setTaskDetail((d) => d ? { ...d, editDueDate: e.target.value } : d)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="text"
                value={taskDetail.editAssigneeId}
                onChange={(e) => setTaskDetail((d) => d ? { ...d, editAssigneeId: e.target.value } : d)}
                placeholder="担当者名（任意）"
                maxLength={100}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              {contractors.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">業者</label>
                  <select
                    value={taskDetail.editContractorId}
                    onChange={(e) => setTaskDetail((d) => d ? { ...d, editContractorId: e.target.value } : d)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none bg-white"
                  >
                    <option value="">-- 業者なし --</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">
                  進捗 {taskDetail.editProgress}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={taskDetail.editProgress}
                  onChange={(e) => setTaskDetail((d) => d ? { ...d, editProgress: Number(e.target.value) } : d)}
                  className="w-full accent-brand-500"
                />
              </div>
              <div className="flex gap-2">
                {(["todo", "in_progress", "done"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTaskDetail((d) => d ? { ...d, editStatus: s } : d)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      taskDetail.editStatus === s
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {statusLabel[s]}
                  </button>
                ))}
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(`/project/${taskDetail.task.projectId}`)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  詳細ページへ
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskDetail(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={taskDetail.saving}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
                  >
                    {taskDetail.saving ? "保存中..." : "保存"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-900">ガントチャート</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Connect mode toggle */}
          <button
            onClick={() => {
              setConnectMode((m) => !m);
              setConnectState(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              connectMode
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            title="依存関係接続モード"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            {connectMode ? (connectState ? "→ 接続先を選択" : "接続元を選択") : "依存関係"}
          </button>

          <div className="flex gap-3 text-xs" role="list" aria-label="ステータス凡例">
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

      {/* Alert banner */}
      {(alertSummary.overdue.length > 0 || alertSummary.urgent.length > 0) && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5" role="alert">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="text-sm text-red-700">
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
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700" role="status">
          <span className="font-semibold">{alertSummary.soon.length}件</span>のタスクが3日以内に期限を迎えます。
        </div>
      )}

      {/* Warnings */}
      {isCapped && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700" role="alert">
          日付範囲が広いため、最大{MAX_CHART_DAYS}日間に制限して表示しています。
        </div>
      )}
      {estimatedCount > 0 && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700" role="status">
          {estimatedCount}件のタスクに期限が未設定のため、推定日程で表示しています（破線バー）。
        </div>
      )}

      {connectMode && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-700" role="status">
          依存関係モード: タスクバーの右端のコネクタポイントをクリックして接続元を選び、次に接続先のタスクバーの左端をクリックしてください。もう一度クリックで接続解除。
        </div>
      )}

      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        role="figure"
        aria-label={`ガントチャート: ${ganttTasks.length}タスク`}
      >
        <div className="flex">
          {/* Left: Task labels with assignee & progress */}
          <div
            className="shrink-0 border-r border-slate-200 bg-slate-50/80"
            style={{ width: labelWidth }}
          >
            <div
              className="flex items-end border-b border-slate-200 px-3 py-2"
              style={{ height: headerHeight }}
            >
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                タスク ({ganttTasks.length})
              </span>
            </div>
            {visibleRows.map((row) => {
              if (row.type === "phase") {
                const { group } = row;
                return (
                  <div
                    key={`phase-${group.projectId}`}
                    className="flex items-center border-b border-slate-200 bg-slate-100/80 px-2 select-none hover:bg-slate-100"
                    style={{ height: phaseRowHeight }}
                  >
                    <button
                      className="flex flex-1 min-w-0 items-center gap-0 cursor-pointer"
                      onClick={() => togglePhase(group.projectId)}
                      aria-label={`${group.projectName}を${group.collapsed ? "展開" : "折りたたむ"}`}
                    >
                      <svg
                        className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${group.collapsed ? "" : "rotate-90"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <span className="ml-1.5 text-xs font-bold text-slate-700 truncate">
                        {group.projectName}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 shrink-0">
                        {group.tasks.length}件
                      </span>
                    </button>
                    <button
                      className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                      onClick={(e) => { e.stopPropagation(); openQuickAdd(group.projectId, group.projectName); }}
                      aria-label={`${group.projectName}にタスクを追加`}
                      title="タスクを追加"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </div>
                );
              }

              const { task } = row;
              const initial = getAssigneeInitial(task.assigneeId);
              const alertLevel = getAlertLevel(task, today);
              return (
                <div
                  key={task.id}
                  className="flex items-center border-b border-slate-100 px-3 gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ height: rowHeight }}
                  onClick={() => {
                    if (connectMode) return; // Don't open detail in connect mode
                    openTaskDetail(task);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" && !connectMode) openTaskDetail(task); }}
                  aria-label={`${task.name}を編集`}
                >
                  {/* Assignee avatar */}
                  {initial ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600">
                      {initial}
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400">
                      --
                    </span>
                  )}
                  {/* Task name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {task.isMilestone && (
                        <svg className="mr-1 inline h-2.5 w-2.5 -mt-0.5" viewBox="0 0 12 12" aria-hidden="true">
                          <polygon points="6,0 12,6 6,12 0,6" fill="#f59e0b" />
                        </svg>
                      )}
                      {task.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {task.contractorName
                        ? <span className="text-brand-500">{task.contractorName}</span>
                        : task.projectName}
                    </p>
                  </div>
                  {/* Alert badge */}
                  {alertLevel === "overdue" && (
                    <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      遅延
                    </span>
                  )}
                  {alertLevel === "urgent" && (
                    <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                      今日
                    </span>
                  )}
                  {alertLevel === "soon" && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                      3日
                    </span>
                  )}
                  {/* Progress % */}
                  {alertLevel === null && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                      style={{
                        backgroundColor: `${progressColor(task.progress)}15`,
                        color: progressColor(task.progress),
                      }}
                    >
                      {task.progress}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Chart area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto"
          >
            <div style={{ width: totalDays * dayWidth, minWidth: "100%" }} className="relative">
              {/* Date header */}
              <div
                className="flex border-b border-slate-200"
                style={{ height: headerHeight }}
              >
                {dateInfo.map((di) => (
                  <div
                    key={di.date}
                    data-today={di.isToday ? "true" : undefined}
                    className={`flex flex-col items-center justify-end border-r border-slate-100 pb-1 ${
                      di.isToday
                        ? "bg-red-50"
                        : di.isWeekend
                          ? "bg-slate-50"
                          : ""
                    }`}
                    style={{ width: dayWidth }}
                  >
                    <span
                      className={`text-[10px] font-semibold tabular-nums ${
                        di.isToday
                          ? "text-red-600"
                          : di.isWeekend
                            ? "text-slate-400"
                            : "text-slate-500"
                      }`}
                    >
                      {formatDateShort(di.date)}
                    </span>
                    {di.isToday && (
                      <span className="mt-0.5 text-[8px] font-bold text-red-600 uppercase">
                        TODAY
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Today vertical red dashed line (full height) */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: todayOffset * dayWidth + dayWidth / 2,
                    top: 0,
                    bottom: 0,
                    width: 0,
                    borderLeft: "2px dashed #ef4444",
                  }}
                />
              )}

              {/* SVG dependency lines overlay */}
              {dependencyLines.length > 0 && (
                <svg
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ width: totalDays * dayWidth, height: "100%" }}
                  overflow="visible"
                >
                  <defs>
                    <marker
                      id="dep-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" opacity="0.7" />
                    </marker>
                  </defs>
                  {dependencyLines.map((line) => {
                    const cx = (line.x1 + line.x2) / 2;
                    const d = `M ${line.x1} ${line.y1} C ${cx} ${line.y1} ${cx} ${line.y2} ${line.x2} ${line.y2}`;
                    return (
                      <path
                        key={`${line.fromTaskId}-${line.toTaskId}`}
                        d={d}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="1.5"
                        strokeOpacity="0.6"
                        markerEnd="url(#dep-arrow)"
                      />
                    );
                  })}
                </svg>
              )}

              {/* Rows */}
              {visibleRows.map((row, rowIndex) => {
                if (row.type === "phase") {
                  const { group } = row;
                  return (
                    <div
                      key={`phase-chart-${group.projectId}`}
                      className="relative border-b border-slate-200 bg-slate-100/50"
                      style={{ height: phaseRowHeight }}
                    >
                      {highlightedDates.map((di) => {
                        const offset = daysBetween(chartStart, di.date);
                        return (
                          <div
                            key={di.date}
                            className={`absolute top-0 h-full ${
                              di.isToday ? "bg-red-50/30" : "bg-slate-50/50"
                            }`}
                            style={{ left: offset * dayWidth, width: dayWidth }}
                          />
                        );
                      })}
                    </div>
                  );
                }

                const { task } = row;
                const isDragging = dragState?.taskId === task.id;
                const displayStartDate = isDragging ? dragState.previewStartDate : task.startDate;
                const displayEndDate = isDragging ? dragState.previewEndDate : task.endDate;

                const startOffset = daysBetween(chartStart, displayStartDate);
                const duration = Math.max(1, daysBetween(displayStartDate, displayEndDate));
                const left = startOffset * dayWidth;
                const width = duration * dayWidth;
                const alertLevel = getAlertLevel(task, today);

                // Bar background color override for alerts
                let barBg = statusColor[task.status];
                if (alertLevel === "overdue") barBg = "#ef4444";
                else if (alertLevel === "urgent") barBg = "#f97316";
                else if (alertLevel === "soon") barBg = "#f59e0b";

                const isConnectFrom = connectState?.fromTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="relative border-b border-slate-50"
                    style={{ height: rowHeight }}
                    data-row-index={rowIndex}
                  >
                    {/* Grid lines */}
                    {highlightedDates.map((di) => {
                      const offset = daysBetween(chartStart, di.date);
                      const weekendClass =
                        di.isWeekend && !task.projectIncludesWeekends
                          ? "bg-slate-200/70"
                          : di.isToday
                            ? "bg-red-50/30"
                            : "bg-slate-50/50";
                      return (
                        <div
                          key={di.date}
                          className={`absolute top-0 h-full ${weekendClass}`}
                          style={{ left: offset * dayWidth, width: dayWidth }}
                        />
                      );
                    })}

                    {/* Milestone diamond marker */}
                    {task.isMilestone ? (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`マイルストーン: ${task.name}: ${task.startDate}${task.isDateEstimated ? " (推定)" : ""}`}
                        className="absolute cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                        style={{
                          left: left + dayWidth / 2 - 10,
                          top: rowHeight / 2 - 10,
                          width: 20,
                          height: 20,
                        }}
                        title={`${task.name}: ${task.startDate}${task.isDateEstimated ? " (推定)" : ""} — クリックで編集`}
                        onClick={() => {
                          if (connectMode) {
                            if (!connectState) {
                              setConnectState({ fromTaskId: task.id });
                            } else {
                              void handleConnectTask(task.id);
                            }
                            return;
                          }
                          openTaskDetail(task);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!connectMode) openTaskDetail(task);
                          }
                        }}
                      >
                        <svg viewBox="0 0 20 20" className="h-5 w-5 drop-shadow-sm hover:drop-shadow-md transition-all">
                          <polygon
                            points="10,1 19,10 10,19 1,10"
                            fill="#f59e0b"
                            stroke="#d97706"
                            strokeWidth="1"
                          />
                          {task.progress >= 100 && (
                            <text x="10" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">
                              &#10003;
                            </text>
                          )}
                        </svg>
                      </div>
                    ) : (
                      /* Regular bar */
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${task.name}: ${displayStartDate} から ${displayEndDate}${task.isDateEstimated ? " (推定)" : ""} (${task.progress}%)`}
                        className={`absolute rounded-md shadow-sm transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 ${
                          isDragging ? "opacity-80 shadow-lg cursor-grabbing" : "hover:shadow-md hover:brightness-110"
                        } ${isConnectFrom ? "ring-2 ring-violet-500 ring-offset-1" : ""}`}
                        style={{
                          left: left + 2,
                          top: 8,
                          width: Math.max(width - 4, 8),
                          height: rowHeight - 16,
                          backgroundColor: barBg,
                          opacity: task.status === "done" ? 0.6 : 0.9,
                          ...(task.isDateEstimated
                            ? {
                                border: "2px dashed rgba(255,255,255,0.5)",
                                boxSizing: "border-box" as const,
                              }
                            : {}),
                          userSelect: "none",
                        }}
                        title={`${task.name}: ${displayStartDate} ~ ${displayEndDate} (${task.progress}%)${task.isDateEstimated ? " (推定)" : ""} — ドラッグで移動、右端をドラッグで日数変更`}
                        onMouseDown={(e) => {
                          if (connectMode) return;
                          // Only initiate drag on left click on bar body
                          if (e.button !== 0) return;
                          e.preventDefault();
                          const newDrag: DragState = {
                            taskId: task.id,
                            type: "move",
                            startX: e.clientX,
                            originalStartDate: task.startDate,
                            originalEndDate: task.endDate,
                            previewStartDate: task.startDate,
                            previewEndDate: task.endDate,
                          };
                          dragRef.current = newDrag;
                          setDragState(newDrag);
                        }}
                        onClick={(e) => {
                          if (connectMode) {
                            e.stopPropagation();
                            if (!connectState) {
                              setConnectState({ fromTaskId: task.id });
                            } else {
                              void handleConnectTask(task.id);
                            }
                            return;
                          }
                          // Only open detail if not dragging
                          if (dragRef.current) return;
                          openTaskDetail(task);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!connectMode) openTaskDetail(task);
                          }
                        }}
                      >
                        {/* Progress fill inside the bar */}
                        {task.progress > 0 && task.progress < 100 && (
                          <div
                            className="absolute left-0 top-0 h-full rounded-md opacity-30"
                            style={{
                              width: `${task.progress}%`,
                              backgroundColor: "#ffffff",
                            }}
                          />
                        )}
                        {width > 80 && (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white truncate z-10 pointer-events-none">
                            {task.name}
                            {width > 130 && (
                              <span className="ml-auto text-[9px] opacity-80 shrink-0">
                                {task.progress}%
                              </span>
                            )}
                          </span>
                        )}

                        {/* Resize handle on right edge */}
                        {!connectMode && (
                          <div
                            className="absolute right-0 top-0 h-full w-3 cursor-ew-resize flex items-center justify-center z-20"
                            title="ドラッグで工期を伸縮"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const newDrag: DragState = {
                                taskId: task.id,
                                type: "resize",
                                startX: e.clientX,
                                originalStartDate: task.startDate,
                                originalEndDate: task.endDate,
                                previewStartDate: task.startDate,
                                previewEndDate: task.endDate,
                              };
                              dragRef.current = newDrag;
                              setDragState(newDrag);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="h-4 w-1 rounded-full bg-white/40" />
                          </div>
                        )}

                        {/* Connect mode: connector points */}
                        {connectMode && (
                          <>
                            {/* Left connector */}
                            <div
                              className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 z-30 ${
                                connectState ? "border-violet-400 bg-violet-200 cursor-pointer" : "border-slate-300 bg-white"
                              }`}
                              title="接続先（この点をクリック）"
                            />
                            {/* Right connector */}
                            <div
                              className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 z-30 cursor-pointer ${
                                isConnectFrom ? "border-violet-600 bg-violet-400" : "border-violet-400 bg-violet-200 hover:bg-violet-300"
                              }`}
                              title="接続元としてこのタスクを選択"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!connectState) {
                                  setConnectState({ fromTaskId: task.id });
                                }
                              }}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
