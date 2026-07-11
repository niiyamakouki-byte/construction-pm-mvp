import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Sun,
  CloudSun,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  Thermometer,
  MapPin,
  Printer,
  HardHat,
  FileDown,
} from "lucide-react";
import type { Project, ProjectMode, Task, TaskStatus, CostItem, Expense } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import { effectiveProgress } from "../components/gantt/utils.js";
import { EmptyState } from "../components/EmptyState.js";
import { DocumentsPage } from "../components/DocumentsPageImpl.js";
import { ProjectDetailTabs } from "../components/ProjectDetailTabs.js";
import { ProjectMapEmbed } from "../components/ProjectMapEmbed.js";
import { ProjectFlowWidget } from "../components/ProjectFlowWidget.js";
import { createInitialStageProgresses } from "../lib/project-flow.js";
import { ProjectFinancePanel } from "../components/ProjectFinancePanel.js";
import { ContractChecklistPanel } from "../components/ContractChecklistPanel.js";
import { ConfirmDialog } from "../components/common/ConfirmDialog.js";
import { ACTION_LABELS } from "../lib/action-labels.js";
import {
  ConstructionPhase,
  getPhaseChecklist,
  getPhaseLabel,
  evaluatePhaseCompletion,
} from "../lib/construction-checklist.js";
import { generateProjectQR, generateFieldModeUrl } from "../lib/qr-code.js";
import {
  generateSiteEntryPrintHtml,
  generateSiteEntryPosterPdf,
  DEFAULT_SITE_ENTRY_NOTES,
} from "../lib/site-entry-qr.js";
import { SiteEntryRepository } from "../lib/supabase-adapter/SiteEntryRepository.js";
import type { SiteEntryRecord } from "../lib/supabase-adapter/SiteEntryRepository.js";

const siteEntryRepository = new SiteEntryRepository();

// ── Construction templates ────────────────────────────

type TemplateTask = { name: string; startOffsetDays: number; durationDays: number };

const CONSTRUCTION_TEMPLATES: { label: string; tasks: TemplateTask[] }[] = [
  {
    label: "内装工事",
    tasks: [
      { name: "墨出し・下地確認", startOffsetDays: 0, durationDays: 1 },
      { name: "解体・撤去", startOffsetDays: 1, durationDays: 3 },
      { name: "下地工事", startOffsetDays: 4, durationDays: 5 },
      { name: "電気・設備配管", startOffsetDays: 6, durationDays: 4 },
      { name: "ボード張り", startOffsetDays: 9, durationDays: 3 },
      { name: "塗装・クロス貼り", startOffsetDays: 11, durationDays: 5 },
      { name: "床仕上げ", startOffsetDays: 15, durationDays: 3 },
      { name: "建具取付", startOffsetDays: 17, durationDays: 2 },
      { name: "清掃・養生撤去", startOffsetDays: 19, durationDays: 1 },
      { name: "竣工検査", startOffsetDays: 20, durationDays: 1 },
    ],
  },
  {
    label: "外構工事",
    tasks: [
      { name: "測量・墨出し", startOffsetDays: 0, durationDays: 1 },
      { name: "掘削・土工事", startOffsetDays: 1, durationDays: 3 },
      { name: "基礎・砕石工事", startOffsetDays: 4, durationDays: 3 },
      { name: "配管工事", startOffsetDays: 6, durationDays: 2 },
      { name: "コンクリート打設", startOffsetDays: 8, durationDays: 2 },
      { name: "養生期間", startOffsetDays: 10, durationDays: 3 },
      { name: "仕上げ・植栽", startOffsetDays: 13, durationDays: 3 },
      { name: "竣工検査", startOffsetDays: 16, durationDays: 1 },
    ],
  },
  {
    label: "設備工事",
    tasks: [
      { name: "現場調査・図面確認", startOffsetDays: 0, durationDays: 1 },
      { name: "材料搬入", startOffsetDays: 1, durationDays: 1 },
      { name: "配管・配線工事", startOffsetDays: 2, durationDays: 5 },
      { name: "機器取付", startOffsetDays: 7, durationDays: 3 },
      { name: "試運転・調整", startOffsetDays: 10, durationDays: 2 },
      { name: "竣工検査", startOffsetDays: 12, durationDays: 1 },
    ],
  },
];

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const statusBg: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-500",
  in_progress: "bg-emerald-100 text-emerald-800",
  done: "bg-gray-200 text-gray-600",
};

const statusIcon: Record<TaskStatus, string> = {
  todo: "○",
  in_progress: "◉",
  done: "✓",
};

const projectModeLabel: Record<ProjectMode, string> = {
  memo: "メモ案件",
  normal: "通常案件",
  full: "完全案件",
};

const projectModeClass: Record<ProjectMode, string> = {
  memo: "bg-emerald-100 text-emerald-700",
  normal: "bg-indigo-100 text-indigo-700",
  full: "bg-fuchsia-100 text-fuchsia-700",
};

function projectMode(project: Project): ProjectMode {
  return project.mode ?? "normal";
}

type WeatherData = {
  temperature: number;
  description: string;
  icon: ReactNode;
};

const weatherCodes: Record<number, { desc: string; icon: ReactNode }> = {
  0: { desc: "快晴", icon: <Sun className="h-5 w-5" aria-hidden="true" /> },
  1: { desc: "晴れ", icon: <CloudSun className="h-5 w-5" aria-hidden="true" /> },
  2: { desc: "曇り", icon: <Cloud className="h-5 w-5" aria-hidden="true" /> },
  3: { desc: "曇天", icon: <Cloud className="h-5 w-5" aria-hidden="true" /> },
  51: { desc: "小雨", icon: <CloudDrizzle className="h-5 w-5" aria-hidden="true" /> },
  53: { desc: "雨", icon: <CloudRain className="h-5 w-5" aria-hidden="true" /> },
  55: { desc: "強い雨", icon: <CloudRain className="h-5 w-5" aria-hidden="true" /> },
  61: { desc: "小雨", icon: <CloudDrizzle className="h-5 w-5" aria-hidden="true" /> },
  63: { desc: "雨", icon: <CloudRain className="h-5 w-5" aria-hidden="true" /> },
  65: { desc: "大雨", icon: <CloudRain className="h-5 w-5" aria-hidden="true" /> },
  80: { desc: "にわか雨", icon: <CloudDrizzle className="h-5 w-5" aria-hidden="true" /> },
  95: { desc: "雷雨", icon: <CloudLightning className="h-5 w-5" aria-hidden="true" /> },
};

function inferWorkType(project: Project, tasks: Task[]): string {
  const source = [project.description, project.name, ...tasks.map((task) => task.name)]
    .filter(Boolean)
    .join(" ");
  if (source.includes("電気")) return "電気";
  if (source.includes("設備") || source.includes("配管") || source.includes("空調")) return "設備";
  if (source.includes("塗装")) return "塗装";
  if (source.includes("左官")) return "左官";
  if (source.includes("解体")) return "解体";
  if (source.includes("外構")) return "外構";
  if (source.includes("内装") || source.includes("クロス") || source.includes("ボード")) return "内装";
  return "共通";
}

function getFieldPersona(tasks: Task[], todayEntryLog: SiteEntryRecord[]): {
  displayName: string;
  company?: string;
} {
  const latestEntry = [...todayEntryLog].sort((a, b) => b.entryTime.localeCompare(a.entryTime))[0];
  const activeAssignee = tasks.find((task) => task.status === "in_progress" && task.assigneeId)?.assigneeId;
  if (activeAssignee) {
    const matchedEntry = todayEntryLog.find((entry) => entry.workerName === activeAssignee);
    return {
      displayName: activeAssignee,
      company: matchedEntry?.company || latestEntry?.company || undefined,
    };
  }

  const latestAssignedTask = [...tasks]
    .reverse()
    .find((task) => task.assigneeId)?.assigneeId;
  if (latestAssignedTask) {
    const matchedEntry = todayEntryLog.find((entry) => entry.workerName === latestAssignedTask);
    return {
      displayName: latestAssignedTask,
      company: matchedEntry?.company || latestEntry?.company || undefined,
    };
  }

  if (latestEntry) {
    return {
      displayName: latestEntry.workerName,
      company: latestEntry.company || undefined,
    };
  }

  return { displayName: "未ログイン" };
}

function getCurrentTask(tasks: Task[]): Task | null {
  const inProgress = tasks
    .filter((task) => task.status === "in_progress")
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  if (inProgress[0]) return inProgress[0];

  const upcoming = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => (a.startDate ?? a.dueDate ?? "").localeCompare(b.startDate ?? b.dueDate ?? ""));
  return upcoming[0] ?? null;
}

async function fetchWeather(
  lat: number,
  lon: number,
): Promise<WeatherData | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const current = data.current;
    if (current) {
      const code = current.weather_code ?? 0;
      const info = weatherCodes[code] ?? {
        desc: "不明",
        icon: <Thermometer className="h-5 w-5" aria-hidden="true" />,
      };
      return {
        temperature: current.temperature_2m ?? 0,
        description: info.desc,
        icon: info.icon,
      };
    }
  } catch {
    // non-critical: weather is a nice-to-have
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

export function ProjectDetailPage({
  projectId,
  subPath,
}: {
  projectId: string;
  subPath?: string | null;
}) {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const taskRepository = useMemo(
    () => createTaskRepository(() => organizationId),
    [organizationId],
  );
  const costItemRepository = useMemo(
    () => createCostItemRepository(() => organizationId),
    [organizationId],
  );
  const expenseRepository = useMemo(
    () => createAppRepository<Expense>("expenses", () => organizationId),
    [organizationId],
  );
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskProgress, setTaskProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const weatherFetchKeyRef = useRef<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string>(ConstructionPhase.demolition);
  const [completedChecklistIds, setCompletedChecklistIds] = useState<Set<string>>(new Set());
  const [todayEntryLog, setTodayEntryLog] = useState<SiteEntryRecord[]>([]);
  const [onSiteCount, setOnSiteCount] = useState(0);
  const [siteEntryNotesDraft, setSiteEntryNotesDraft] = useState(DEFAULT_SITE_ENTRY_NOTES);
  const [savingSiteEntryNotes, setSavingSiteEntryNotes] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [p, allTasks, allCosts, allExpenses] = await Promise.all([
        projectRepository.findById(projectId),
        taskRepository.findAll(),
        costItemRepository.findAll(),
        expenseRepository.findAll(),
      ]);
      setProject(p);
      setTasks(filterScheduleTasks(allTasks).filter((t) => t.projectId === projectId));
      setCostItems(allCosts.filter((c) => c.projectId === projectId));
      setExpenses(allExpenses.filter((e) => e.projectId === projectId));

      if (p?.latitude && p?.longitude) {
        const weatherKey = `${projectId}:${p.latitude}:${p.longitude}`;
        if (weatherFetchKeyRef.current !== weatherKey) {
          weatherFetchKeyRef.current = weatherKey;
          const w = await fetchWeather(p.latitude, p.longitude);
          setWeather(w);
        }
      } else {
        weatherFetchKeyRef.current = null;
        setWeather(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [costItemRepository, expenseRepository, projectId, projectRepository, taskRepository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- プロジェクト詳細データの取得トリガー
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    const loadEntryLog = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const records = await siteEntryRepository.listByProjectAsync(projectId, today);
      if (cancelled) return;
      setTodayEntryLog(records);
      setOnSiteCount(records.filter((r) => !r.exitTime).length);
    };
    void loadEntryLog();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    // Seed the editable draft once per project load (not on every project
    // update) so in-progress edits aren't clobbered by unrelated saves.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- プロジェクト読込時に現場ルール編集欄を同期する意図的なパターン
    setSiteEntryNotesDraft(project?.siteEntryNotes ?? DEFAULT_SITE_ENTRY_NOTES);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- project?.id のみを見て再同期する意図的な依存配列
  }, [project?.id]);

  const handleSaveSiteEntryNotes = async () => {
    if (!project) return;
    setSavingSiteEntryNotes(true);
    try {
      await projectRepository.update(project.id, {
        siteEntryNotes: siteEntryNotesDraft,
        updatedAt: new Date().toISOString(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "現場ルールの保存に失敗しました");
    } finally {
      setSavingSiteEntryNotes(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskRepository.update(taskId, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ステータス更新に失敗しました");
    }
  };

  const resetTaskForm = () => {
    setTaskName("");
    setTaskStartDate("");
    setTaskDueDate("");
    setTaskAssigneeId("");
    setTaskDescription("");
    setTaskProgress(0);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      await taskRepository.create({
        id: crypto.randomUUID(),
        projectId,
        name: taskName.trim(),
        description: taskDescription.trim(),
        status: "todo",
        startDate: taskStartDate || undefined,
        dueDate: taskDueDate || undefined,
        assigneeId: taskAssigneeId.trim() || undefined,
        progress: taskProgress,
        dependencies: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      resetTaskForm();
      setShowTaskForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyTemplate = async (templateIndex: number) => {
    const template = CONSTRUCTION_TEMPLATES[templateIndex];
    if (!template || !project) return;
    setApplyingTemplate(true);
    setError(null);
    try {
      const baseDate = project.startDate;
      const now = new Date();
      for (const t of template.tasks) {
        await taskRepository.create({
          id: crypto.randomUUID(),
          projectId,
          name: t.name,
          description: "",
          status: "todo",
          startDate: addDaysToDate(baseDate, t.startOffsetDays),
          dueDate: addDaysToDate(baseDate, t.startOffsetDays + Math.max(0, t.durationDays - 1)),
          progress: 0,
          dependencies: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "テンプレートの適用に失敗しました");
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleCopyTask = async (task: Task) => {
    setError(null);
    try {
      const now = new Date();
      await taskRepository.create({
        id: crypto.randomUUID(),
        projectId,
        name: `${task.name} (コピー)`,
        description: task.description,
        status: "todo",
        startDate: task.startDate,
        dueDate: task.dueDate,
        assigneeId: task.assigneeId,
        progress: 0,
        dependencies: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクのコピーに失敗しました");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeletingTaskId(taskId);
  };

  const confirmDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await taskRepository.delete(deletingTaskId);
      setDeletingTaskId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの削除に失敗しました");
      setDeletingTaskId(null);
    }
  };

  const confirmDeleteProject = async () => {
    setDeletingProject(true);
    setError(null);
    try {
      await projectRepository.delete(projectId);
      setShowDeleteProjectConfirm(false);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "案件の削除に失敗しました");
    } finally {
      setDeletingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-slate-500">案件が見つかりません</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 ios-btn-primary px-4 py-2 text-sm"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  if (subPath === "documents") {
    return <DocumentsPage projectId={projectId} />;
  }

  // Stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const totalCost = costItems.reduce((sum, c) => sum + c.amount, 0);

  // Cash flow calculations
  const budget = project?.budget ?? 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetUsagePercent = budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;
  const budgetBarColor =
    budgetUsagePercent > 80
      ? "bg-red-500"
      : budgetUsagePercent > 50
        ? "bg-amber-400"
        : "bg-emerald-500";

  // Monthly expenses for SVG bar chart (last 6 months)
  const monthlyExpenses = (() => {
    const now = new Date();
    const months: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getMonth() + 1}月`;
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const amount = expenses
        .filter((e) => e.expenseDate.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount, 0);
      months.push({ label, amount });
    }
    return months;
  })();

  const statusColorMap: Record<string, string> = {
    planning: "bg-gray-100 text-gray-500",
    active: "bg-emerald-100 text-emerald-800",
    completed: "bg-gray-200 text-gray-600",
    on_hold: "bg-amber-100 text-amber-700",
  };

  const statusLabelMap: Record<string, string> = {
    planning: "計画中",
    active: "進行中",
    completed: "完了",
    on_hold: "保留",
  };
  const mode = projectMode(project);
  const shouldShowRecordUpgradePrompt = mode === "memo" && project.status === "completed" && tasks.length === 0;
  const deletingTask = tasks.find((task) => task.id === deletingTaskId);
  const workType = inferWorkType(project, tasks);
  const fieldPersona = getFieldPersona(tasks, todayEntryLog);
  const currentTask = getCurrentTask(tasks);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#007AFF] transition-colors"
      >
        <span aria-hidden="true">&larr;</span>
        案件一覧
      </button>

      {/* Error banner */}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 mt-0.5">!</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      <ConfirmDialog
        open={deletingTaskId !== null}
        title="タスクを削除"
        message={
          <>
            <span className="font-semibold text-slate-800">{deletingTask?.name ?? "このタスク"}</span>
            を削除します。この操作は取り消せません。
          </>
        }
        confirmLabel="削除する"
        variant="danger"
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => setDeletingTaskId(null)}
      />

      <ConfirmDialog
        open={showDeleteProjectConfirm}
        title="案件を削除"
        message={
          <>
            <span className="font-semibold text-slate-800">{project.name}</span>
            を削除します。紐づく工程・資材・変更履歴・通知・関連書類・写真の記録もすべて削除されます。この操作は取り消せません。
          </>
        }
        confirmLabel={deletingProject ? "削除中..." : "削除する"}
        variant="danger"
        onConfirm={() => void confirmDeleteProject()}
        onCancel={() => setShowDeleteProjectConfirm(false)}
      />

      {/* Project Header */}
      <div className="rounded-2xl bg-brand-800 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-white/70">{project.description}</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusColorMap[project.status]}`}
          >
            {statusLabelMap[project.status]}
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${projectModeClass[mode]}`}
          >
            {projectModeLabel[mode]}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {project.address && (
            <span className="flex items-center gap-1 text-white/60">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {project.address}
            </span>
          )}
          <span className="flex items-center gap-1 text-white/60 tabular-nums">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {project.startDate}
            {project.endDate && ` 〜 ${project.endDate}`}
          </span>
        </div>

        {/* Weather */}
        {weather && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <span className="inline-flex items-center">{weather.icon}</span>
            <span className="font-bold">{weather.temperature}°C</span>
            <span className="text-sm text-white/60">{weather.description}</span>
          </div>
        )}
      </div>

      <ProjectDetailTabs
        projectId={projectId}
        activeTab={
          subPath === "chat" ? "chat" :
          subPath === "finance" ? "finance" :
          subPath === "contract" ? "contract" :
          "overview"
        }
      />

      {/* Chat tab */}
      {subPath === "chat" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 flex flex-col items-center gap-4 text-center" style={{ minHeight: "60vh" }}>
          <h2 className="text-base font-semibold text-slate-800">連絡・相談</h2>
          <p className="text-sm text-slate-600 max-w-sm">
            チャットはAI秘書に一本化しました。質問や連絡はAI秘書パネルからどうぞ（担当に届きます）
          </p>
          <button
            type="button"
            className="min-h-[44px] rounded-lg bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700 active:bg-slate-900"
            onClick={() => window.dispatchEvent(new CustomEvent("genbahub:assistant-open"))}
          >
            AI秘書に相談する
          </button>
        </div>
      )}

      {/* Finance tab (Task #41) */}
      {subPath === "finance" && (
        <ProjectFinancePanel projectId={projectId} />
      )}

      {/* Contract checklist tab */}
      {subPath === "contract" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-800">契約チェックリスト</h2>
          <ContractChecklistPanel projectId={projectId} />
        </div>
      )}

      {/* Overview tab content */}
      {subPath !== "chat" && subPath !== "finance" && subPath !== "contract" && <>

      {shouldShowRecordUpgradePrompt && (
        <section
          aria-label="記録案件のAI提案"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
              AI
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-950">この記録から工程表を起こしますか？</p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">
                単価・職人・工期の引用元として使えるので、完了済み案件もあとから工程化できます。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CONSTRUCTION_TEMPLATES.map((tpl, i) => (
                  <button
                    key={tpl.label}
                    type="button"
                    disabled={applyingTemplate}
                    onClick={() => void handleApplyTemplate(i)}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {applyingTemplate ? "適用中..." : `${tpl.label}で起こす`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Project Flow */}
      <ProjectFlowWidget
        currentStage="inquiry"
        stageProgresses={createInitialStageProgresses()}
      />

      {/* 現場ロケーション */}
      {project.address && (
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">現場ロケーション</h2>
          <ProjectMapEmbed address={project.address} />
        </div>
      )}

      {/* Settings */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">案件設定</h2>
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={project.includeWeekends ?? true}
              onChange={async (e) => {
                const checked = e.target.checked;
                try {
                  await projectRepository.update(project.id, {
                    includeWeekends: checked,
                    updatedAt: new Date().toISOString(),
                  });
                  await loadData();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "設定の保存に失敗しました");
                }
              }}
            />
            <div
              className={`h-5 w-9 rounded-full transition-colors ${
                (project.includeWeekends ?? true) ? "bg-[#007AFF]" : "bg-slate-300"
              }`}
            />
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                (project.includeWeekends ?? true) ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">土日を工期に含める</p>
            <p className="text-xs text-slate-500">
              {(project.includeWeekends ?? true)
                ? "土日も工期カウント対象です"
                : "土日を除いた営業日ベースで工期を計算します"}
            </p>
          </div>
        </label>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">危険な操作</p>
          <button
            type="button"
            onClick={() => setShowDeleteProjectConfirm(true)}
            className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
          >
            この案件を削除する
          </button>
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 text-center">
          <div className="relative mx-auto h-14 w-14">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="4"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${(progressPercent / 100) * 150.8} 150.8`}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-800 tabular-nums">
              {progressPercent}%
            </span>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            進捗率
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 text-center">
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {doneTasks}/{totalTasks}
          </p>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            タスク完了
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 text-center">
          <p className="text-lg font-bold text-slate-900 tabular-nums">
            {totalCost > 0 ? `¥${totalCost.toLocaleString("ja-JP")}` : "-"}
          </p>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            コスト合計
          </p>
        </div>
      </div>

      {/* Cash Flow / Finance Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">財務</h2>

        {budget > 0 ? (
          <>
            {/* Budget bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">予算消化率</span>
                <span className={`text-xs font-bold tabular-nums ${
                  budgetUsagePercent > 80 ? "text-red-600" : budgetUsagePercent > 50 ? "text-amber-600" : "text-emerald-600"
                }`}>
                  {budgetUsagePercent}%
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${budgetBarColor}`}
                  style={{ width: `${Math.min(budgetUsagePercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-400 tabular-nums">
                <span>支出: ¥{totalExpenses.toLocaleString("ja-JP")}</span>
                <span>予算: ¥{budget.toLocaleString("ja-JP")}</span>
              </div>
            </div>

            {/* Monthly expenses bar chart (SVG) */}
            {expenses.length > 0 && (() => {
              const maxAmt = Math.max(...monthlyExpenses.map((m) => m.amount), 1);
              const chartH = 60;
              const barW = 24;
              const gap = 8;
              const totalW = monthlyExpenses.length * (barW + gap) - gap;
              return (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">月次支出推移</p>
                  <svg width={totalW} height={chartH + 20} className="overflow-visible">
                    {monthlyExpenses.map((m, i) => {
                      const barH = maxAmt > 0 ? Math.round((m.amount / maxAmt) * chartH) : 0;
                      const x = i * (barW + gap);
                      return (
                        <g key={m.label}>
                          <rect
                            x={x}
                            y={chartH - barH}
                            width={barW}
                            height={barH || 2}
                            rx="3"
                            fill="#2563eb"
                            opacity="0.8"
                          />
                          <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">
                            {m.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
          </>
        ) : (
          <p className="text-xs text-slate-400">
            案件に予算を設定するとキャッシュフローが表示されます。
            {totalExpenses > 0 && ` 現在の支出: ¥${totalExpenses.toLocaleString("ja-JP")}`}
          </p>
        )}
      </section>

      {/* Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">タスク一覧</h2>
          <button
            onClick={() => setShowTaskForm(!showTaskForm)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:opacity-85 transition-colors"
          >
            <span className="text-sm leading-none">{showTaskForm ? "−" : "+"}</span>
            タスク追加
          </button>
        </div>

        {/* Construction templates — show when no tasks yet */}
        {tasks.length === 0 && !showTaskForm && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-xs font-semibold text-amber-800">工事テンプレートからまとめて追加</p>
            <div className="flex flex-wrap gap-2">
              {CONSTRUCTION_TEMPLATES.map((tpl, i) => (
                <button
                  key={tpl.label}
                  type="button"
                  disabled={applyingTemplate}
                  onClick={() => void handleApplyTemplate(i)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {applyingTemplate ? "適用中..." : `${tpl.label}（${tpl.tasks.length}工程）`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task creation form */}
        {showTaskForm && (
          <form
            onSubmit={handleAddTask}
            className="mb-4 rounded-xl border border-[#007AFF]/20 bg-white p-4 shadow-sm page-enter"
          >
            <div className="flex flex-col gap-3">
              {/* Row 1: task name */}
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="タスク名 *"
                required
                maxLength={200}
                autoComplete="off"
                aria-label="タスク名"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] focus:outline-none"
              />
              {/* Row 2: dates */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">開始日</label>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    aria-label="開始日"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] focus:outline-none"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">終了日（期限）</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    aria-label="終了日"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] focus:outline-none"
                  />
                </div>
              </div>
              {/* Row 3: assignee + progress */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  placeholder="担当者名"
                  maxLength={100}
                  autoComplete="off"
                  aria-label="担当者名"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] focus:outline-none"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">進捗 {taskProgress}%</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={taskProgress}
                    onChange={(e) => setTaskProgress(Number(e.target.value))}
                    aria-label="進捗率"
                    className="w-full accent-[#007AFF]"
                  />
                </div>
              </div>
              {/* Row 4: description */}
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="備考・説明（任意）"
                rows={2}
                maxLength={500}
                aria-label="備考・説明"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] focus:outline-none resize-none"
              />
              {/* Row 5: actions */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { resetTaskForm(); setShowTaskForm(false); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {ACTION_LABELS.form.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? ACTION_LABELS.task.adding : ACTION_LABELS.task.add}
                </button>
              </div>
            </div>
          </form>
        )}

        {tasks.length === 0 ? (
          <EmptyState
            title={mode === "memo" ? "工程表はまだありません" : "タスクがまだありません"}
            description={
              mode === "memo"
                ? "メモ案件として保存済みです。工程表を作るなら Gantt で一括追加できます。"
                : "工程表テンプレートを使うと内装・外構・設備の標準工程を一括追加できます。"
            }
            actionLabel="工程表で追加"
            onAction={() => navigate(`/gantt/${projectId}?openMaster=1`)}
            secondaryActionLabel="1件ずつ追加"
            onSecondaryAction={() => setShowTaskForm(true)}
          />
        ) : (
          <ul className="space-y-2">
            {tasks
              .sort((a, b) => {
                const order: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2 };
                return order[a.status] - order[b.status];
              })
              .map((task) => (
                <li
                  key={task.id}
                  className={`rounded-xl border bg-white p-3 shadow-sm transition-all ${
                    task.status === "done" ? "opacity-60 border-slate-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Status toggle */}
                    <button
                      onClick={() =>
                        handleStatusChange(
                          task.id,
                          task.status === "done"
                            ? "todo"
                            : task.status === "todo"
                              ? "in_progress"
                              : "done",
                        )
                      }
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${statusBg[task.status]}`}
                      title={`${statusLabel[task.status]} - タップで変更`}
                      aria-label={`${task.name}のステータスを変更 (現在: ${statusLabel[task.status]})`}
                    >
                      {statusIcon[task.status]}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold leading-tight ${
                          task.status === "done" ? "text-slate-400 line-through" : "text-slate-900"
                        }`}
                      >
                        {task.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {task.startDate && (
                          <span className="text-xs text-slate-400 tabular-nums">
                            {task.startDate}〜
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-xs text-slate-400 tabular-nums">
                            {task.startDate ? task.dueDate : `期限: ${task.dueDate}`}
                          </span>
                        )}
                        {task.assigneeId && (
                          <span className="inline-flex items-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-800">
                            {task.assigneeId}
                          </span>
                        )}
                        {effectiveProgress(task) > 0 && (
                          <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                            {effectiveProgress(task)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleCopyTask(task)}
                      className="shrink-0 rounded-lg p-2.5 text-slate-300 hover:text-brand-700 hover:bg-brand-100 transition-colors"
                      title="コピー"
                      aria-label={`${task.name}をコピー`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="shrink-0 rounded-lg p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="削除"
                      aria-label={`${task.name}を削除`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Construction Checklist */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">工事チェックリスト</h2>

        <div className="mb-3">
          <label htmlFor="phase-select" className="block text-xs font-semibold text-slate-500 mb-1">工事フェーズ選択</label>
          <select
            id="phase-select"
            value={selectedPhase}
            onChange={(e) => {
              setSelectedPhase(e.target.value);
              setCompletedChecklistIds(new Set());
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.values(ConstructionPhase).map((phase) => (
              <option key={phase} value={phase}>{getPhaseLabel(phase)}</option>
            ))}
          </select>
        </div>

        {(() => {
          const phase = selectedPhase as import("../lib/construction-checklist.js").ConstructionPhase;
          const items = getPhaseChecklist(phase);
          const completion = evaluatePhaseCompletion(phase, Array.from(completedChecklistIds));

          return (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 min-w-[80px] rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${completion.passed ? "bg-emerald-500" : "bg-[#007AFF]"}`}
                      style={{ width: `${completion.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-600">{completion.percentage}%</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  completion.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {completion.passed ? "合格" : `必須: ${completion.requiredCompleted}/${completion.requiredTotal}`}
                </span>
              </div>

              <ul className="space-y-1.5">
                {items.map((item) => {
                  const checked = completedChecklistIds.has(item.id);
                  return (
                    <li key={item.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`cl-${item.id}`}
                        checked={checked}
                        onChange={() => {
                          setCompletedChecklistIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-[#007AFF]"
                      />
                      <label htmlFor={`cl-${item.id}`} className={`text-sm ${checked ? "text-slate-400 line-through" : "text-slate-700"}`}>
                        {item.descriptionJa}
                        {item.required && <span className="ml-1 text-red-500 text-xs">*</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          );
        })()}
      </section>

      {/* QR Code for field access */}
      <section
        aria-label="現場スタート導線"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">現場スタート導線</h2>
            <p className="mt-1 text-xs text-slate-500">
              QRで入場したあと、最低限 `始まり` と `終わり` の2枚を残す運用を基準にします。
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            必須2枚で台帳更新
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">まず必須にするもの</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            着工前の1枚で基準を作り、完了時の1枚で差分を閉じます。中間写真は必要に応じて追加で十分です。
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              step: "必須1",
              title: "開始写真を上げる",
              body: "工事開始前の状態を先に残して、写真台帳と進捗の基準点にします。",
              action: "開始写真を開く",
              onClick: () => navigate("/photos"),
            },
            {
              step: "必須2",
              title: "終了写真を上げる",
              body: "作業後の状態を同じ場所に残して、着工前との差分をそのまま完了記録にします。",
              action: "終了写真を開く",
              onClick: () => navigate("/photos"),
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white">
                  {item.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    {item.action}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              step: "補助1",
              title: "入口QRを掲示",
              body: "現場入口にQRを貼って、職人の入場を最初の記録にします。",
              action: "キオスクを開く",
              onClick: () => navigate(`/entry/${projectId}`),
            },
            {
              step: "補助2",
              title: "中間写真も足せる",
              body: "工程の節目だけ追加すれば十分です。始まりと終わりが揃っていれば台帳として成立します。",
              action: "写真一覧を開く",
              onClick: () => navigate("/photos"),
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                  {item.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {item.action}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-label="役割別の最新導線"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">役割別の最新導線</h2>
            <p className="mt-1 text-xs text-slate-500">
              Chatworkの最新資料が前に見える感覚で、`業種` と `ログイン名` に近い情報から今触るものを絞ります。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
              想定業種: {workType}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              直近: {fieldPersona.displayName}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-950">
            {fieldPersona.displayName}
            {fieldPersona.company ? ` / ${fieldPersona.company}` : ""} が最初に触る想定
          </p>
          <p className="mt-1 text-xs leading-5 text-sky-900/80">
            {currentTask
              ? `今の基準工程は「${currentTask.name}」です。ここを軸に資料確認 → 開始写真 → 作業 → 終了写真まで閉じます。`
              : "まだ工程が無いので、まずは工程表か入口導線から始められる状態にしておく想定です。"}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              key: "schedule",
              eyebrow: "最新工程",
              title: currentTask ? currentTask.name : "工程表を確認する",
              body: currentTask
                ? `${workType}の担当が今日まず見る工程です。開始・完了写真の基準もここに合わせます。`
                : `${workType}向けの工程を先に整えて、誰が入っても同じ順番で触れる状態にします。`,
              action: "工程表を開く",
              onClick: () => navigate(`/gantt/${projectId}`),
            },
            {
              key: "portal",
              eyebrow: "最新資料",
              title: `${workType}向けの共有ビュー`,
              body: "業者ポータル側で、現場に必要な段取りと共有事項をすぐ見に行く想定です。",
              action: "共有ビューを開く",
              onClick: () => navigate(
                fieldPersona.company
                  ? `/portal/${projectId}/${encodeURIComponent(fieldPersona.company)}`
                  : `/portal/${projectId}`,
              ),
            },
            {
              key: "safety",
              eyebrow: "必須書類",
              title: "KY・安全書類を確認する",
              body: `${workType}でも共通で必要な注意事項や提出書類を、着工前にここで最新化します。`,
              action: "安全書類を開く",
              onClick: () => navigate("/safety"),
            },
            {
              key: "chat",
              eyebrow: "最新連絡",
              title: "連絡・更新履歴を見る",
              body: "Chatworkっぽく最新の段取りや指示を前に出して、口頭依存を減らします。",
              action: "連絡タブを開く",
              onClick: () => navigate(`/project/${projectId}/chat`),
            },
          ].map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
            >
              <p className="text-[11px] font-semibold text-sky-700">{item.eyebrow}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p>
              <button
                type="button"
                onClick={item.onClick}
                className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                {item.action}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* QR Code for field access */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">現場QRコード</h2>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <img
            src={generateProjectQR(projectId)}
            alt={`${project?.name ?? projectId} フィールドアクセス QR`}
            width={120}
            height={120}
            className="rounded-lg border border-slate-200"
          />
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-800">フィールドモードURL</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">
              {generateFieldModeUrl(projectId, "https://app.genbahub.com")}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              現場でスキャンするとモバイル最適化ビューが開きます。
            </p>
          </div>
        </div>
      </section>

      {/* Site Entry QR — print and today's log */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">入退場QRコード</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void (async () => {
                const html = await generateSiteEntryPrintHtml(
                  projectId,
                  project.name,
                  window.location.origin,
                );
                const blob = new Blob([html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              })()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700 active:bg-slate-900 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              QR印刷
            </button>
            <button
              type="button"
              onClick={() => void (async () => {
                const blob = await generateSiteEntryPosterPdf(
                  projectId,
                  project.name,
                  window.location.origin,
                  siteEntryNotesDraft,
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `入退場QRポスター_${project.name}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              })()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5f7766] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#4d6154] active:bg-[#3d4d43] transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              QRポスターPDF
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          印刷したQRを現場入口に掲示。職人がスマホでスキャンして入退場を記録できます。
        </p>

        {/* Custom site rules / notices — reflected on the poster PDF */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <label htmlFor="site-entry-notes" className="mb-1.5 block text-xs font-semibold text-slate-700">
            現場ルール・注意事項（QRポスターPDFに反映されます）
          </label>
          <textarea
            id="site-entry-notes"
            value={siteEntryNotesDraft}
            onChange={(e) => setSiteEntryNotesDraft(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-[#5f7766] focus:outline-none focus:ring-1 focus:ring-[#5f7766]"
          />
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => void handleSaveSiteEntryNotes()}
              disabled={savingSiteEntryNotes}
              className="inline-flex items-center rounded-lg bg-[#5f7766] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#4d6154] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingSiteEntryNotes ? "保存中…" : "保存"}
            </button>
          </div>
        </div>

        {/* On-site count badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
          <HardHat className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-emerald-700">現在の入場者数</p>
            <p className="text-2xl font-bold text-emerald-800 tabular-nums leading-tight">{onSiteCount}<span className="text-sm font-normal ml-0.5">名</span></p>
          </div>
        </div>

        {/* Today's entry log */}
        {todayEntryLog.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">本日の入退場記録</p>
            <ul className="space-y-1.5">
              {todayEntryLog.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{record.workerName}</p>
                    {record.company && (
                      <p className="text-xs text-slate-400">{record.company}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-500 tabular-nums">
                    <p>入: {new Date(record.entryTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
                    {record.exitTime ? (
                      <p>退: {new Date(record.exitTime).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
                    ) : (
                      <span className="inline-block mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">入場中</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-400">本日の入退場記録はありません。</p>
        )}
      </section>

      </>}
    </div>
  );
}
