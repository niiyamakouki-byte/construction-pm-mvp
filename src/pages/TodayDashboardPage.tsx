import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { Contractor, CostItem, Expense, Task, TaskStatus, Project } from "../domain/types.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { createPhotoStore } from "../stores/photo-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { GreetingHeader } from "../components/GreetingHeader.js";
import { DashboardCard } from "../components/DashboardCard.js";
import { OnboardingChecklist } from "../components/OnboardingChecklist.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { usePersona } from "../contexts/PersonaContext.js";
import { TodayDashboardPageErrorBoundary } from "../components/PageErrorBoundaries.js";
import { TodayDashboardSkeleton } from "../components/PageSkeletons.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import {
  buildProjectCostRows,
  filterScheduleTasks,
} from "../lib/cost-management.js";
import {
  calculateBudgetBreakdown,
  compareEstimateVsActual,
} from "../lib/budget-calculator.js";
import {
  generateTimelineReport,
  type DelayCategory,
} from "../lib/timeline-analyzer.js";
import { assessProjectHealth } from "../lib/project-health.js";
import { generateDailyReport } from "../lib/daily-report-generator.js";
import { ACTION_LABELS } from "../lib/action-labels.js";
import {
  fetchConstructionSiteForecasts,
  buildMockConstructionSiteForecasts,
  getConstructionRecommendation,
  getDailyWeatherRisk,
  getWeatherEmoji,
} from "../lib/weather.js";
import { daysBetween } from "../components/gantt/utils.js";
import {
  createBudgetAlert,
  createDeadlineAlert,
  evaluateAlerts,
  type TriggeredAlert,
} from "../lib/alert-rules.js";
import { buildProcurementAlerts, type ProcurementAlert } from "../lib/procurement-alerts.js";
import {
  validatePhoto,
  getCategoryLabel,
  PhotoCategory,
  type PhotoValidationResult,
} from "../lib/photo-upload.js";
import { classifyByFilename } from "../lib/photo-classifier.js";
import {
  getTodayWorkerCount,
  getEntryLog,
} from "../lib/site-entry-log.js";
import { generateForecastReport } from "../lib/cost-forecaster.js";
import { criticalPath } from "../lib/schedule-validator.js";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar.js";
import { detectScheduleConflicts } from "../lib/schedule-conflict.js";
import {
  CockpitDashboard,
  type CriticalPathStatus,
  type ProjectCockpitSummary,
} from "../components/CockpitDashboard.js";

// ── Helpers ────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateJP(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const date = new Date(dateStr);
  const weekday = weekdays[date.getDay()];
  return `${Number(m)}月${Number(d)}日 (${weekday})`;
}

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const statusIcon: Record<TaskStatus, string> = {
  todo: "○",
  in_progress: "◉",
  done: "✓",
};

const statusBg: Record<TaskStatus, string> = {
  todo: "bg-[#fdf8f0] text-[#7a7062] border-[#e8dfd3]",
  in_progress: "bg-[#e8f2eb] text-[#5e8a6c] border-[#c4dcc9]",
  done: "bg-[#f5f0e8] text-[#a69e93] border-[#e8dfd3]",
};

const statusButtonStyle: Record<TaskStatus, string> = {
  done: "bg-[#7ba88a] text-white active:bg-[#5e8a6c]",
  in_progress: "bg-[#7ba88a] text-white active:bg-[#5e8a6c]",
  todo: "bg-[#d4a853] text-white active:bg-[#b8903f]",
};

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const budgetStatusTone = {
  under_budget: "bg-[#e8f2eb] text-[#5e8a6c] border-[#c4dcc9]",
  on_budget: "bg-[#fff4d9] text-[#b8903f] border-[#f0d898]",
  over_budget: "bg-[#fde8e2] text-[#c0614f] border-[#f2bdb3]",
} as const;

const healthGradeTone = {
  A: "bg-[#e8f2eb] text-[#5e8a6c] border-[#c4dcc9]",
  B: "bg-[#e8f2eb] text-[#7ba88a] border-[#c4dcc9]",
  C: "bg-[#fff4d9] text-[#d4a853] border-[#f0d898]",
  D: "bg-[#fde8e2] text-[#e8836b] border-[#f2bdb3]",
  F: "bg-[#fde8e2] text-[#c0614f] border-[#f2bdb3]",
} as const;

const confidenceLabel = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

const delayCategoryLabel: Record<DelayCategory, string> = {
  weather: "天候",
  material: "資材",
  labor: "人員",
  permit: "許認可",
  design_change: "設計変更",
  equipment: "機材",
  unknown: "要確認",
};

type TaskWithProject = Task & { projectName: string };
type UploadPhotoCategory = (typeof PhotoCategory)[keyof typeof PhotoCategory];

const classifierCategoryMap: Record<string, UploadPhotoCategory> = {
  foundation: PhotoCategory.foundation,
  framing: PhotoCategory.framing,
  mep_rough: PhotoCategory.plumbing,
  mep_finish: PhotoCategory.electrical,
  interior_rough: PhotoCategory.interior,
  interior_finish: PhotoCategory.finishing,
  exterior: PhotoCategory.exterior,
  waterproof: PhotoCategory.roofing,
  safety: PhotoCategory.safety,
  defect: PhotoCategory.inspection,
  progress: PhotoCategory.other,
  material: PhotoCategory.other,
  equipment: PhotoCategory.other,
  other: PhotoCategory.other,
};

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function suggestUploadCategory(fileName: string): { category: UploadPhotoCategory; confidence: number } | null {
  const classification = classifyByFilename(fileName);
  const category = classifierCategoryMap[classification.category];
  if (!category || category === PhotoCategory.other || classification.confidence <= 0) return null;
  return { category, confidence: classification.confidence };
}

function getPriorityProject(projects: Project[]): Project | null {
  return projects.find((project) => project.status === "active")
    ?? projects.find((project) => project.status === "planning")
    ?? projects[0]
    ?? null;
}

function inferDelayCategory(task: Task): DelayCategory {
  if ((task.materials ?? []).length > 0) return "material";
  if (task.contractorId) return "labor";
  return "unknown";
}

function getProjectEndDate(project: Project, tasks: Task[]): string {
  return tasks
    .map((task) => task.dueDate ?? task.startDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)
    ?? project.endDate
    ?? project.startDate;
}

function isTaskActiveOnDate(task: Task, date: string): boolean {
  if (!task.startDate) return task.status === "in_progress";
  const endDate = task.dueDate ?? task.startDate;
  return task.startDate <= date && endDate >= date;
}

function getWeatherRiskLabel(level: "normal" | "warning" | "danger"): string {
  if (level === "danger") return "延期候補";
  if (level === "warning") return "要注意";
  return "施工可";
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function clampMinimumCount(value: number): number {
  return Math.max(0, value);
}

// ── Main Component ─────────────────────────────────────

function TodayDashboardPageContent() {
  const { organizationId } = useOrganizationContext();
  const taskRepository = useMemo(
    () => createTaskRepository(() => organizationId),
    [organizationId],
  );
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const costItemRepository = useMemo(
    () => createCostItemRepository(() => organizationId),
    [organizationId],
  );
  const contractorRepository = useMemo(
    () => createContractorRepository(() => organizationId),
    [organizationId],
  );
  const expenseRepository = useMemo(
    () => createAppRepository<Expense>("expenses", () => organizationId),
    [organizationId],
  );
  const photoStore = useMemo(() => createPhotoStore(), []);
  const today = toLocalDateString(new Date());
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [allProjectTasks, setAllProjectTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dailyReportStatus, setDailyReportStatus] = useState<string | null>(null);
  const [dailyReportExporting, setDailyReportExporting] = useState(false);
  const [photoCategory, setPhotoCategory] = useState<string>(PhotoCategory.other);
  const [photoCategorySuggestion, setPhotoCategorySuggestion] = useState<{ label: string; confidence: number } | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoInputResetKey, setPhotoInputResetKey] = useState(0);
  const [photoValidation, setPhotoValidation] = useState<PhotoValidationResult | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [allSiteForecasts, setAllSiteForecasts] = useState<import("../lib/weather.js").ConstructionSiteForecast[]>(
    () => buildMockConstructionSiteForecasts(allProjects),
  );
  useEffect(() => {
    if (allProjects.length === 0) return;
    void fetchConstructionSiteForecasts(allProjects).then(setAllSiteForecasts);
  // allProjects の identity が変わったときのみ再 fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProjects.length]);
  const siteForecasts = useMemo(
    () => allSiteForecasts.slice(0, 3),
    [allSiteForecasts],
  );

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [allT, allP, allContractors, allCostItems, allExpenses] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
        contractorRepository.findAll(),
        costItemRepository.findAll(),
        expenseRepository.findAll(),
      ]);

      const scheduleTasks = filterScheduleTasks(allT);

      setAllProjectTasks(allT);
      setAllTasks(scheduleTasks);
      setAllProjects(allP);
      setContractors(allContractors);
      setCostItems(allCostItems);
      setExpenses(allExpenses);

      const projectMap = new Map<string, Project>();
      for (const p of allP) projectMap.set(p.id, p);

      const todayTasks = scheduleTasks
        .filter((t) => {
          if (t.status === "done") return false;
          if (t.dueDate === today) return true;
          if (t.dueDate && t.dueDate < today) return true;
          if (!t.dueDate && t.status === "in_progress") return true;
          return false;
        })
        .map((t) => ({
          ...t,
          projectName: projectMap.get(t.projectId)?.name ?? "不明",
        }));

      setTasks(todayTasks);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [contractorRepository, costItemRepository, expenseRepository, projectRepository, taskRepository, today]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ダッシュボードデータの取得トリガー
    void loadData();
  }, [loadData]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await taskRepository.update(taskId, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      await loadData();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "ステータス更新に失敗しました");
    }
  };

  // ── Stats ────────────────────────────────────────────
  const { persona } = usePersona();
  const _totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "done").length;
  const overdueTasks = allTasks.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate < today,
  ).length;
  const inProgressTasks = allTasks.filter(
    (t) => t.status === "in_progress",
  ).length;
  const activeProjectsCount = allProjects.filter(
    (p) => p.status === "active" || p.status === "planning",
  ).length;
  const completedMemoProjects = allProjects.filter(
    (p) => (p.mode ?? "normal") === "memo" && p.status === "completed",
  );

  // Upcoming milestones: tasks due within next 7 days (not overdue, not done)
  const upcomingMilestones = useMemo(() => {
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = toLocalDateString(in7Days);
    const projectMap = new Map<string, Project>();
    for (const p of allProjects) projectMap.set(p.id, p);
    return allTasks
      .filter(
        (t) =>
          t.status !== "done" &&
          t.dueDate &&
          t.dueDate > today &&
          t.dueDate <= in7DaysStr,
      )
      .slice(0, 5)
      .map((t) => ({
        ...t,
        projectName: projectMap.get(t.projectId)?.name ?? "不明",
      }));
  }, [allTasks, allProjects, today]);

  // Project completion stats for executive mode
  const projectStats = useMemo(() => {
    return allProjects.map((p) => {
      const pTasks = allTasks.filter((t) => t.projectId === p.id);
      const done = pTasks.filter((t) => t.status === "done").length;
      const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
      return { ...p, taskCount: pTasks.length, doneCount: done, pct };
    });
  }, [allProjects, allTasks]);

  const insightProject = useMemo(() => getPriorityProject(allProjects), [allProjects]);

  // Googleカレンダー個人予定 × 今日のタスクのダブり (Phase A: 今日だけ警告チップ)
  const todayBoundsRange = useMemo(() => {
    const start = new Date(`${today}T00:00:00`);
    const end = new Date(`${today}T23:59:59`);
    return { timeMin: start, timeMax: end };
  }, [today]);
  const todayGoogleCalendar = useGoogleCalendar(todayBoundsRange);
  const todayHasConflict = useMemo(() => {
    if (!todayGoogleCalendar.connected) return false;
    const todayTasks = allTasks
      .filter((t) => {
        const start = t.startDate ?? undefined;
        const due = t.dueDate ?? start;
        if (!start) return false;
        return start <= today && (due ?? start) >= today;
      })
      .map((t) => ({ id: t.id, startDate: t.startDate ?? null, endDate: t.dueDate ?? t.startDate ?? null }));
    const result = detectScheduleConflicts(todayGoogleCalendar.events, todayTasks);
    return Object.keys(result.conflictsByTaskId).length > 0;
  }, [allTasks, today, todayGoogleCalendar.connected, todayGoogleCalendar.events]);

  const insightTasks = useMemo(
    () => (insightProject ? allTasks.filter((task) => task.projectId === insightProject.id) : []),
    [allTasks, insightProject],
  );

  const insightCostRows = useMemo(
    () => (
      insightProject
        ? buildProjectCostRows(insightProject.id, { tasks: allProjectTasks, costItems, expenses })
        : []
    ),
    [allProjectTasks, costItems, expenses, insightProject],
  );

  const budgetInsight = useMemo(() => {
    if (!insightProject) return null;

    const estimatedAmount = insightProject.budget ?? 0;
    const actualAmount = insightCostRows.reduce((sum, row) => sum + row.amount, 0);

    return {
      breakdown: calculateBudgetBreakdown(insightProject.name, [
        { name: "総コスト", estimated: estimatedAmount, actual: actualAmount },
      ]),
      comparison: compareEstimateVsActual([
        { category: "総コスト", estimated: estimatedAmount, actual: actualAmount },
      ]),
    };
  }, [insightCostRows, insightProject]);

  const timelineInsight = useMemo(() => {
    if (!insightProject) return null;

    const projectEndDate = getProjectEndDate(insightProject, insightTasks);
    const delayEntries = insightTasks
      .filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today)
      .map((task) => ({
        taskName: task.name,
        category: inferDelayCategory(task),
        delayDays: Math.max(1, daysBetween(task.dueDate!, today)),
        description: `${task.name} が期限を超過しています`,
        date: task.dueDate!,
      }));

    return generateTimelineReport({
      projectName: insightProject.name,
      startDate: insightProject.startDate,
      originalEndDate: projectEndDate,
      totalTasks: insightTasks.length,
      completedTasks: insightTasks.filter((task) => task.status === "done").length,
      delays: delayEntries,
      elapsedDays: Math.max(0, daysBetween(insightProject.startDate, today) + 1),
    });
  }, [insightProject, insightTasks, today]);

  const healthInsight = useMemo(
    () => (
      insightProject
        ? assessProjectHealth({
          project: insightProject,
          tasks: insightTasks,
          costRows: insightCostRows,
          asOfDate: today,
        })
        : null
    ),
    [insightCostRows, insightProject, insightTasks, today],
  );

  const dailyReportProject = insightProject;

  const dailyReportTasks = useMemo(
    () => (
      dailyReportProject
        ? allProjectTasks.filter((task) => task.projectId === dailyReportProject.id)
        : []
    ),
    [allProjectTasks, dailyReportProject],
  );

  const dailyReportActiveTasks = useMemo(
    () => dailyReportTasks.filter((task) => isTaskActiveOnDate(task, today)),
    [dailyReportTasks, today],
  );

  const dailyReportForecast = useMemo(
    () => (
      dailyReportProject
        ? allSiteForecasts.find((site) => site.projectId === dailyReportProject.id) ?? allSiteForecasts[0] ?? null
        : allSiteForecasts[0] ?? null
    ),
    [allSiteForecasts, dailyReportProject],
  );

  const dailyWeatherSummary = useMemo(() => {
    if (!dailyReportForecast) {
      return {
        title: "天候情報なし",
        detail: "天気データを取得できません",
        exportText: "天候情報なし",
        issues: [] as string[],
      };
    }

    const todayForecast = dailyReportForecast.forecast.daily[0];
    const risk = getDailyWeatherRisk(todayForecast);
    const riskLabel = getWeatherRiskLabel(risk.level);

    return {
      title: `${getWeatherEmoji(todayForecast.weather[0]?.icon)} ${riskLabel}`,
      detail: `${Math.round(todayForecast.temp.max)}° / ${Math.round(todayForecast.temp.min)}° · 降水 ${Math.round(todayForecast.pop * 100)}% · ${getConstructionRecommendation(todayForecast)}`,
      exportText: `${getWeatherEmoji(todayForecast.weather[0]?.icon)} ${riskLabel} / 最高 ${Math.round(todayForecast.temp.max)}℃ / 最低 ${Math.round(todayForecast.temp.min)}℃ / 降水 ${Math.round(todayForecast.pop * 100)}% / 風速 ${todayForecast.wind_speed.toFixed(1)}m/s`,
      issues: risk.reasons.map((reason) => `天候注意: ${reason}`),
    };
  }, [dailyReportForecast]);

  const dailyReportWorkerNames = useMemo(() => {
    const contractorMap = new Map(contractors.map((contractor) => [contractor.id, contractor.name]));

    return Array.from(
      new Set(
        dailyReportActiveTasks
          .map((task) => task.contractorId)
          .filter((contractorId): contractorId is string => Boolean(contractorId))
          .map((contractorId) => contractorMap.get(contractorId) ?? contractorId),
      ),
    ).sort();
  }, [contractors, dailyReportActiveTasks]);

  const dailyReportIssues = useMemo(() => {
    const overdueIssues = dailyReportTasks
      .filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today)
      .slice(0, 3)
      .map((task) => `期限超過: ${task.name}`);

    return [...dailyWeatherSummary.issues, ...overdueIssues];
  }, [dailyReportTasks, dailyWeatherSummary.issues, today]);

  const handleDailyReportExport = useCallback(() => {
    if (!dailyReportProject) {
      setDailyReportStatus("日報出力対象の案件がありません");
      return;
    }

    setDailyReportExporting(true);
    setDailyReportStatus(null);

    try {
      const html = generateDailyReport({
        project: dailyReportProject,
        date: today,
        weather: dailyWeatherSummary.exportText,
        tasks: dailyReportTasks,
        contractors,
        issues: dailyReportIssues,
        notes: dailyReportActiveTasks.length > 0
          ? `進行中作業 ${dailyReportActiveTasks.length}件 / 入場業者 ${dailyReportWorkerNames.length}社`
          : "本日の進行中作業はありません",
      });
      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `日報_${dailyReportProject.name}_${today}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDailyReportStatus("HTML日報を出力しました");
    } catch (err) {
      setDailyReportStatus(err instanceof Error ? err.message : "日報出力に失敗しました");
    } finally {
      setDailyReportExporting(false);
    }
  }, [
    contractors,
    dailyReportActiveTasks.length,
    dailyReportIssues,
    dailyReportProject,
    dailyReportTasks,
    dailyReportWorkerNames.length,
    dailyWeatherSummary.exportText,
    today,
  ]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const resetPhotoSelection = useCallback(() => {
    setSelectedPhotoFile(null);
    setPhotoValidation(null);
    setPhotoPreviewUrl(null);
    setPhotoUploadError(null);
    setPhotoUploadStatus(null);
    setPhotoCategorySuggestion(null);
    setPhotoInputResetKey((key) => key + 1);
  }, []);

  const handlePhotoFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedPhotoFile(file ?? null);
    setPhotoValidation(null);
    setPhotoUploadStatus(null);
    setPhotoUploadError(null);
    setPhotoCategorySuggestion(null);
    if (!file) {
      setPhotoPreviewUrl(null);
      return;
    }
    const localPreviewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(localPreviewUrl);
    const result = validatePhoto({ type: file.type, size: file.size, name: file.name });
    setPhotoValidation(result);
    const suggestion = result.valid ? suggestUploadCategory(file.name) : null;
    if (suggestion) {
      setPhotoCategory(suggestion.category);
      setPhotoCategorySuggestion({
        label: getCategoryLabel(suggestion.category),
        confidence: suggestion.confidence,
      });
    }
    if (result.valid && !dailyReportProject) {
      setPhotoUploadError("アップロード先の案件がありません");
    }
  }, [dailyReportProject]);

  const handlePhotoUpload = useCallback(async () => {
    if (!selectedPhotoFile) return;
    const result = validatePhoto({
      type: selectedPhotoFile.type,
      size: selectedPhotoFile.size,
      name: selectedPhotoFile.name,
    });
    setPhotoValidation(result);
    setPhotoUploadStatus(null);
    setPhotoUploadError(null);
    if (!result.valid) return;
    if (!dailyReportProject) {
      setPhotoUploadError("アップロード先の案件がありません");
      return;
    }
    setPhotoUploading(true);
    try {
      const uploaded = await photoStore.uploadPhoto(selectedPhotoFile, dailyReportProject.id, undefined, {
        category: photoCategory,
        caption: getCategoryLabel(photoCategory as import("../lib/photo-upload.js").PhotoCategory),
      });
      setPhotoPreviewUrl(uploaded.url);
      setPhotoUploadStatus("写真を保存しました");
      setSelectedPhotoFile(null);
      setPhotoInputResetKey((key) => key + 1);
      // Sprint 69: ファイル名から AI分類を推定して永続化（失敗してもアップロード成功扱い）
      try {
        const { classifyByFilename } = await import("../lib/photo-classifier.js");
        const classification = classifyByFilename(selectedPhotoFile.name);
        if (classification.confidence > 0 && classification.category !== "other") {
          await photoStore.updatePhotoClassification(uploaded.id, {
            category: classification.category,
            confidence: classification.confidence,
            subcategory: classification.subcategory,
            tags: classification.tags,
          });
        }
      } catch (classifyErr) {
        console.warn("photo classification persistence failed", classifyErr);
      }
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "写真の保存に失敗しました");
    } finally {
      setPhotoUploading(false);
    }
  }, [dailyReportProject, photoCategory, photoStore, selectedPhotoFile]);

  // ── Cockpit data ─────────────────────────────────────
  const cockpitCriticalPath = useMemo<CriticalPathStatus | null>(() => {
    if (!insightProject || insightTasks.length === 0) return null;
    const cp = criticalPath(insightTasks);
    const cpTaskSet = new Set(cp.taskIds);
    const cpTasks = insightTasks.filter((t) => cpTaskSet.has(t.id));
    const completed = cpTasks.filter((t) => t.status === "done").length;
    const delayed = cpTasks.filter(
      (t) => t.status !== "done" && t.dueDate && t.dueDate < today,
    );
    const maxDelay = delayed.reduce((max, t) => {
      const d = Math.max(1, daysBetween(t.dueDate!, today));
      return Math.max(max, d);
    }, 0);
    const progress =
      cpTasks.length > 0 ? Math.round((completed / cpTasks.length) * 100) : 0;
    return {
      totalTasks: cpTasks.length,
      completedTasks: completed,
      delayedTasks: delayed.length,
      progress,
      maxDelayDays: maxDelay,
    };
  }, [insightProject, insightTasks, today]);

  const cockpitForecast = useMemo(() => {
    if (!insightProject) return null;
    return generateForecastReport(insightProject, insightTasks, expenses);
  }, [insightProject, insightTasks, expenses]);

  const cockpitEntries = useMemo(() => {
    if (!insightProject) return [];
    return getEntryLog(insightProject.id, today);
  }, [insightProject, today]);

  void getTodayWorkerCount; // imported for potential future use

  const cockpitProjects = useMemo<ProjectCockpitSummary[]>(() => {
    return projectStats.map((p) => {
      const overdue = allTasks.filter(
        (t) => t.projectId === p.id && t.status !== "done" && t.dueDate && t.dueDate < today,
      );
      const maxDelay = overdue.reduce((max, t) => {
        return Math.max(max, Math.max(1, daysBetween(t.dueDate!, today)));
      }, 0);
      const status: ProjectCockpitSummary["status"] =
        maxDelay > 7
          ? "major_delay"
          : maxDelay > 0
            ? "minor_delay"
            : p.pct === 100
              ? "on_track"
              : "on_track";
      return {
        id: p.id,
        name: p.name,
        progress: p.pct,
        delayDays: maxDelay,
        pendingCount: 0,
        status,
      };
    });
  }, [projectStats, allTasks, today]);

  // ── Alerts ───────────────────────────────────────────
  const triggeredAlerts = useMemo<TriggeredAlert[]>(() => {
    return allProjects.flatMap((p) => {
      const spent = insightProject?.id === p.id
        ? insightCostRows.reduce((s, r) => s + r.amount, 0)
        : 0;
      return evaluateAlerts(
        [createBudgetAlert(p.id, 80), createDeadlineAlert(p.id, 7)],
        { projectId: p.id, budget: p.budget ?? 0, spent, endDate: p.endDate },
      );
    });
  }, [allProjects, insightProject, insightCostRows]);

  const procurementAlerts = useMemo<ProcurementAlert[]>(
    () => buildProcurementAlerts(allTasks, today),
    [allTasks, today],
  );

  const dashboardCardMetrics = useMemo(() => {
    const weekEnd = new Date(`${today}T00:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = toLocalDateString(weekEnd);

    const todayScheduleCount = tasks.length + (todayGoogleCalendar.connected ? todayGoogleCalendar.events.length : 0);
    const weeklyActiveProjects = allProjects.filter((project) => {
      if (project.status !== "active" && project.status !== "planning") return false;
      const projectTasks = allTasks.filter((task) => task.projectId === project.id);
      if (projectTasks.length === 0) return project.status === "active";
      return projectTasks.some((task) => {
        const startDate = task.startDate ?? task.dueDate;
        const endDate = task.dueDate ?? task.startDate ?? startDate;
        if (!startDate || !endDate || task.status === "done") return false;
        return startDate <= weekEndStr && endDate >= today;
      });
    }).length;

    const unreadNotificationCount = triggeredAlerts.length + procurementAlerts.length + overdueTasks;
    const planningEstimateCount = allProjects.filter((project) => project.status === "planning").length;

    const totalBudget = allProjects.reduce((sum, project) => sum + (project.budget ?? 0), 0);
    const totalSpent = allProjects.reduce((sum, project) => {
      const costRows = buildProjectCostRows(project.id, {
        tasks: allProjectTasks,
        costItems,
        expenses,
      });
      return sum + costRows.reduce((projectSum, row) => projectSum + row.amount, 0);
    }, 0);
    const grossMargin =
      totalBudget > 0
        ? ((totalBudget - totalSpent) / totalBudget) * 100
        : null;

    const openIssueCount = clampMinimumCount(overdueTasks + procurementAlerts.length + triggeredAlerts.length + inProgressTasks);

    return {
      todayScheduleValue: `${todayScheduleCount}件`,
      todayScheduleSubtext: todayGoogleCalendar.connected
        ? `個人予定 ${todayGoogleCalendar.events.length}件を含む`
        : "会議・打合せ含む",
      weeklyActiveProjectsValue: `${weeklyActiveProjects}現場稼働`,
      weeklyActiveProjectsSubtext: weeklyActiveProjects > 0 ? `今週 ${weeklyActiveProjects}件が進行予定` : "今週の稼働予定なし",
      unreadNotificationsValue: `${unreadNotificationCount}件`,
      unreadNotificationsSubtext: `期限超過 ${overdueTasks} / 調達 ${procurementAlerts.length}`,
      planningEstimateValue: `${planningEstimateCount}件`,
      planningEstimateSubtext: planningEstimateCount > 0 ? "着工前・見積調整中" : "見積案件なし",
      grossMarginValue: grossMargin === null ? "未設定" : formatPercent(grossMargin),
      grossMarginSubtext: totalBudget > 0 ? `予算 ${formatCurrency(totalBudget)}` : "予算データ未設定",
      openIssuesValue: `${openIssueCount}件`,
      openIssuesSubtext: `進行中 ${inProgressTasks} / アラート ${triggeredAlerts.length}`,
    };
  }, [
    allProjectTasks,
    allProjects,
    allTasks,
    costItems,
    expenses,
    inProgressTasks,
    overdueTasks,
    procurementAlerts.length,
    tasks.length,
    today,
    todayGoogleCalendar.connected,
    todayGoogleCalendar.events.length,
    triggeredAlerts.length,
  ]);

  // ── Render ───────────────────────────────────────────
  if (loading) {
    return <TodayDashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-10">
      {/* Error banner */}
      {loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#fde8e2] bg-[#fde8e2] px-4 py-3 text-sm text-[#c0614f]">
          <span className="shrink-0 mt-0.5">!</span>
          <span className="flex-1">{loadError}</span>
          <button onClick={() => setLoadError(null)} className="shrink-0 text-[#e8836b] hover:text-[#c0614f]" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      {/* Greeting Header */}
      <h1 className="sr-only">今日のダッシュボード</h1>
      <GreetingHeader userName="光輝さん" />

      {/* Googleカレンダー個人予定とのダブり警告 (Phase A) */}
      {todayHasConflict && (
        <div className="rounded-xl border border-[#f0d898] bg-[#fff4d9] px-4 py-2 text-sm font-semibold text-[#b8903f]" role="status">
          ⚠ 今日は個人予定と現場が重なっています
        </div>
      )}

      {/* 今日のおすすめアクション (ファーストビュー: スクロール前に「次やること」を見せる) */}
      {allProjects.length > 0 && (() => {
        // deadlineSortKey: 負数=期限超過(絶対値が大きいほど緊急), 0=今日, 1-7=今週, Infinity=期限なし
        const actions: { icon: string; label: string; path: string; highlight?: boolean; deadlineSortKey: number }[] = [];
        if (overdueTasks > 0) {
          const maxOverdueDays = allTasks
            .filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today)
            .reduce((max, t) => Math.max(max, Math.max(1, daysBetween(t.dueDate!, today))), 0);
          actions.push({ icon: "⚠", label: `期限超過 ${overdueTasks}件を確認`, path: "/tasks", highlight: true, deadlineSortKey: -maxOverdueDays });
        }
        if (tasks.length > 0) {
          actions.push({ icon: "✓", label: `今日のタスク ${tasks.length}件を処理`, path: "/today", deadlineSortKey: 0 });
        }
        if (allProjects.length === 0) {
          actions.push({ icon: "🏗️", label: ACTION_LABELS.project.createFirst, path: "/app", highlight: true, deadlineSortKey: Infinity });
        }
        if (allTasks.filter((t) => t.status === "todo" && !t.startDate).length > 0) {
          actions.push({ icon: "📊", label: "工程表で未開始タスクを確認", path: insightProject ? `/gantt/${insightProject.id}` : "/gantt", deadlineSortKey: Infinity });
        }
        actions.push({ icon: "📸", label: "現場写真をアップロード", path: "/today", deadlineSortKey: Infinity });
        actions.sort((a, b) => a.deadlineSortKey - b.deadlineSortKey);
        if (actions.length === 0) return null;
        return (
          <section>
            <h2 className="mb-3 text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">今日のおすすめアクション</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {actions.slice(0, 4).map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    action.highlight
                      ? "border-[#f2bdb3] bg-[#fde8e2] text-[#c0614f] hover:bg-[#f8d5ce]"
                      : "border-[#e8dfd3] bg-white text-[#3d3529] hover:bg-[#fdf8f0]"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">{action.icon}</span>
                  <span className="flex-1">{action.label}</span>
                  <span className="text-[#e8dfd3]" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Dashboard Cards — 6-card grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="今日の予定"
          value={dashboardCardMetrics.todayScheduleValue}
          subtext={dashboardCardMetrics.todayScheduleSubtext}
          icon="📅"
          accent="primary"
          onClick={() => navigate("/tasks")}
        />
        <DashboardCard
          title="今週の現場"
          value={dashboardCardMetrics.weeklyActiveProjectsValue}
          subtext={dashboardCardMetrics.weeklyActiveProjectsSubtext}
          icon="🏗️"
          accent="primary"
          onClick={() => navigate("/app")}
        />
        <DashboardCard
          title="未読通知"
          value={dashboardCardMetrics.unreadNotificationsValue}
          subtext={dashboardCardMetrics.unreadNotificationsSubtext}
          icon="🔔"
          accent="warning"
          onClick={() => navigate("/notifications")}
        />
        <DashboardCard
          title="進行中の見積"
          value={dashboardCardMetrics.planningEstimateValue}
          subtext={dashboardCardMetrics.planningEstimateSubtext}
          icon="📝"
          accent="warm"
          onClick={() => navigate("/estimate")}
        />
        <DashboardCard
          title="今月の粗利率"
          value={dashboardCardMetrics.grossMarginValue}
          subtext={dashboardCardMetrics.grossMarginSubtext}
          icon="📊"
          accent="success"
          onClick={() => navigate("/reports")}
        />
        <DashboardCard
          title="残課題"
          value={dashboardCardMetrics.openIssuesValue}
          subtext={dashboardCardMetrics.openIssuesSubtext}
          icon="⚠️"
          accent="warning"
          onClick={() => navigate("/tasks")}
        />
      </div>

      {/* Date Header */}
      <div className="rounded-2xl border border-[#e8dfd3] bg-[#3d3529] px-5 py-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#a69e93] uppercase">
              本日の概要
            </p>
            <p className="mt-1 text-xl font-bold text-white">{formatDateJP(today)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {siteForecasts.map((site) => {
            const todayForecast = site.forecast.daily[0];
            const risk = getDailyWeatherRisk(todayForecast);
            return (
              <button
                key={site.siteId}
                type="button"
                onClick={() => navigate("/weather")}
                className="rounded-xl bg-white/10 px-3 py-3 text-left transition-colors hover:bg-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl leading-tight">
                      {getWeatherEmoji(todayForecast.weather[0]?.icon)}
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {Math.round(todayForecast.temp.max)}° / {Math.round(todayForecast.temp.min)}°
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      risk.level === "danger"
                        ? "bg-[#fde8e2] text-[#c0614f]"
                        : risk.level === "warning"
                          ? "bg-[#fff4d9] text-[#b8903f]"
                          : "bg-[#e8f2eb] text-[#5e8a6c]"
                    }`}
                  >
                    {risk.level === "danger" ? "延期候補" : risk.level === "warning" ? "要注意" : "施工可"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[#a69e93]">
                  降水 {Math.round(todayForecast.pop * 100)}% · 風速 {todayForecast.wind_speed.toFixed(1)}m/s
                </p>
                <p className="mt-1.5 truncate text-[11px] font-semibold text-white">
                  {site.siteName}
                </p>
                <p className="truncate text-[10px] text-[#7a7062]">
                  {site.locationLabel}
                </p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => navigate("/weather")}
          className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          7日間の現場天気を見る
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="進行中案件" value={activeProjectsCount} color="text-[#5e8a6c]" bgColor="bg-[#e8f2eb]" />
        <StatCard label="進行中タスク" value={inProgressTasks} color="text-[#7ba88a]" bgColor="bg-[#f0f7f2]" />
        <StatCard label="完了タスク" value={completedTasks} color="text-[#a69e93]" bgColor="bg-[#f5f0e8]" />
        <StatCard label="期限超過" value={overdueTasks} color="text-[#c0614f]" bgColor={overdueTasks > 0 ? "bg-[#fde8e2]" : "bg-white"} />
      </div>

      {completedMemoProjects.length > 0 && (
        <section className="rounded-2xl border border-[#e8dfd3] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#3d3529]">完了済み記録</h2>
            <span className="rounded-full bg-[#f5f0e8] px-2.5 py-1 text-xs font-semibold text-[#7a7062]">
              {completedMemoProjects.length}件
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {completedMemoProjects.slice(0, 3).map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/project/${project.id}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#e8dfd3] bg-[#fdf8f0] px-3 py-2 text-left hover:bg-[#f5f0e8] transition-colors"
              >
                <span className="min-w-0 truncate text-sm font-medium text-[#3d3529]">{project.name}</span>
                <span className="shrink-0 text-xs font-medium text-[#7ba88a]">記録を開く</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Onboarding checklist — shown when no projects, hidden once all steps done */}
      {allProjects.length === 0 && (
        <OnboardingChecklist hasProjects={allProjects.length > 0} />
      )}

      {/* Cockpit Dashboard */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">コックピット</h2>
          {insightProject && (
            <span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-medium text-[#7a7062]">
              {insightProject.name}
            </span>
          )}
        </div>
        <CockpitDashboard
          health={healthInsight}
          criticalPath={cockpitCriticalPath}
          forecast={cockpitForecast}
          todayEntries={cockpitEntries}
          projects={cockpitProjects}
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">本日の日報</h2>
          <span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-medium text-[#7a7062]">
            {dailyReportProject?.name ?? "案件なし"}
          </span>
        </div>
        <div className="rounded-2xl border border-[#e8dfd3] bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <DashboardSummaryCard
              label="進行中作業"
              value={`${dailyReportActiveTasks.length}件`}
              detail={
                dailyReportActiveTasks.length > 0
                  ? dailyReportActiveTasks
                    .slice(0, 3)
                    .map((task) => `${task.name} (${task.progress}%)`)
                    .join(" / ")
                  : "本日の進行中作業はありません"
              }
            />
            <DashboardSummaryCard
              label="入場業者"
              value={dailyReportWorkerNames.length > 0 ? `${dailyReportWorkerNames.length}社` : "未設定"}
              detail={dailyReportWorkerNames.join(" / ") || "担当業者の割当がありません"}
            />
            <DashboardSummaryCard
              label="天候"
              value={dailyWeatherSummary.title}
              detail={dailyWeatherSummary.detail}
            />
            <DashboardSummaryCard
              label="懸念事項"
              value={dailyReportIssues.length > 0 ? `${dailyReportIssues.length}件` : "なし"}
              detail={dailyReportIssues.join(" / ") || "大きな懸念事項はありません"}
            />
          </div>

          {dailyReportStatus && (
            <p className="mt-4 text-sm text-[#7a7062]">{dailyReportStatus}</p>
          )}

          <button
            type="button"
            onClick={handleDailyReportExport}
            disabled={!dailyReportProject || dailyReportExporting}
            className="mt-4 w-full rounded-xl bg-[#7ba88a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5e8a6c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dailyReportExporting ? "HTML生成中..." : "HTMLで日報出力"}
          </button>
        </div>
      </section>

      {/* Photo Upload */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">現場写真アップロード</h2>
          <span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-medium text-[#7a7062]">
            {dailyReportProject?.name ?? "案件なし"}
          </span>
        </div>
        <div className="rounded-2xl border border-[#e8dfd3] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="photo-category" className="block text-xs font-medium text-[#7a7062] mb-1">カテゴリ</label>
              <select
                id="photo-category"
                value={photoCategory}
                onChange={(e) => {
                  setPhotoCategory(e.target.value);
                  setPhotoCategorySuggestion(null);
                }}
                className="w-full rounded-lg border border-[#e8dfd3] px-3 py-2 text-sm text-[#3d3529] bg-white focus:outline-none focus:ring-2 focus:ring-[#7ba88a]"
              >
                {Object.values(PhotoCategory).map((cat) => (
                  <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="photo-file" className="block text-xs font-medium text-[#7a7062] mb-1">写真ファイル</label>
              <input
                key={photoInputResetKey}
                id="photo-file"
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif"
                onChange={handlePhotoFileChange}
                disabled={photoUploading || !dailyReportProject}
                className="w-full rounded-lg border border-[#e8dfd3] px-3 py-2 text-sm text-[#3d3529] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f2eb] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[#5e8a6c]"
              />
            </div>
          </div>
          {selectedPhotoFile && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#e8dfd3] bg-[#fdf8f0] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#3d3529]">{selectedPhotoFile.name}</p>
                <p className="mt-1 text-xs text-[#7a7062]">
                  {formatFileSize(selectedPhotoFile.size)} · {getCategoryLabel(photoCategory as import("../lib/photo-upload.js").PhotoCategory)}
                </p>
                {photoCategorySuggestion && (
                  <p className="mt-1 text-xs font-semibold text-[#5e8a6c]">
                    ファイル名から {photoCategorySuggestion.label} に設定済み ({Math.round(photoCategorySuggestion.confidence * 100)}%)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetPhotoSelection}
                  disabled={photoUploading}
                  className="rounded-lg border border-[#e8dfd3] px-3 py-2 text-xs font-medium text-[#7a7062] transition-colors hover:bg-[#f5f0e8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handlePhotoUpload}
                  disabled={photoUploading || !dailyReportProject || !photoValidation?.valid}
                  className="rounded-lg bg-[#7ba88a] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#5e8a6c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {photoUploading ? "保存中..." : "この写真を保存"}
                </button>
              </div>
            </div>
          )}
          {photoValidation && !photoValidation.valid && (
            <div className="mt-3 rounded-lg border border-[#f2bdb3] bg-[#fde8e2] px-3 py-2 text-xs text-[#c0614f]">
              {photoValidation.errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
          {photoPreviewUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-[#e8dfd3] bg-[#fdf8f0]">
              <img src={photoPreviewUrl} alt="アップロード写真プレビュー" className="max-h-64 w-full object-contain" />
            </div>
          )}
          {photoUploading && (
            <p className="mt-3 text-xs font-medium text-[#7a7062]">写真を保存中...</p>
          )}
          {photoUploadError && (
            <p className="mt-3 text-xs font-semibold text-[#c0614f]">{photoUploadError}</p>
          )}
          {photoUploadStatus && !photoUploadError && (
            <p className="mt-3 text-xs font-semibold text-[#5e8a6c]">{photoUploadStatus}</p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">GenbaHub Insight</h2>
          <span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-medium text-[#7a7062]">
            {insightProject?.name ?? "案件なし"}
          </span>
        </div>
        {insightProject && budgetInsight && timelineInsight && healthInsight ? (
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-[#e8dfd3] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#a69e93]">予算サマリー</p>
                  <h3 className="mt-1 text-base font-bold text-[#3d3529]">見積 vs 実績</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${budgetStatusTone[budgetInsight.breakdown.status]}`}>
                  {budgetInsight.breakdown.status === "over_budget"
                    ? "超過"
                    : budgetInsight.breakdown.status === "under_budget"
                      ? "余力あり"
                      : "予算通り"}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#7a7062]">
                <div className="flex items-center justify-between gap-3">
                  <span>見積</span>
                  <span className="font-semibold tabular-nums text-[#3d3529]">
                    {formatCurrency(budgetInsight.breakdown.totalEstimated)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>実績</span>
                  <span className="font-semibold tabular-nums text-[#3d3529]">
                    {formatCurrency(budgetInsight.breakdown.totalActual)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#e8dfd3] pt-2">
                  <span>差異</span>
                  <span className={`font-semibold tabular-nums ${
                    budgetInsight.comparison.overallVariance > 0 ? "text-[#c0614f]" : "text-[#5e8a6c]"
                  }`}>
                    {budgetInsight.comparison.overallVariance > 0 ? "+" : ""}
                    {formatCurrency(budgetInsight.comparison.overallVariance)}
                  </span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e8dfd3] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#a69e93]">工程予測</p>
                  <h3 className="mt-1 text-base font-bold text-[#3d3529]">完了見込み</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  timelineInsight.onTrack
                    ? "border-[#c4dcc9] bg-[#e8f2eb] text-[#5e8a6c]"
                    : "border-[#f0d898] bg-[#fff4d9] text-[#b8903f]"
                }`}>
                  信頼度 {confidenceLabel[
                    timelineInsight.progressPct > 70
                      ? "high"
                      : timelineInsight.progressPct < 20
                        ? "low"
                        : "medium"
                  ]}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#7a7062]">
                <div className="flex items-center justify-between gap-3">
                  <span>予定完了</span>
                  <span className="font-semibold tabular-nums text-[#3d3529]">{timelineInsight.originalEndDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>予測完了</span>
                  <span className="font-semibold tabular-nums text-[#3d3529]">{timelineInsight.predictedEndDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#e8dfd3] pt-2">
                  <span>遅延分析</span>
                  <span className="font-semibold text-[#3d3529]">
                    {timelineInsight.delayAnalysis.totalDelayDays}日 /
                    {" "}
                    {delayCategoryLabel[timelineInsight.delayAnalysis.largestCause]}
                  </span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e8dfd3] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#a69e93]">案件健全性</p>
                  <h3 className="mt-1 text-base font-bold text-[#3d3529]">Health Score</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${healthGradeTone[healthInsight.grade]}`}>
                  Grade {healthInsight.grade}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums text-[#3d3529]">{healthInsight.overall}</p>
                  <p className="mt-1 text-xs text-[#a69e93]">schedule / cost / quality / risk</p>
                </div>
                <p className="max-w-[14rem] text-right text-xs leading-5 text-[#7a7062]">
                  {healthInsight.recommendations[0]}
                </p>
              </div>
            </article>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#e8dfd3] bg-white px-4 py-6 text-sm text-[#a69e93] shadow-sm">
            案件データが揃うと、予算・工程・健全性のカードを表示します。
          </div>
        )}
      </section>

      {/* Upcoming milestones */}
      {upcomingMilestones.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">
            今後7日間の期限
            <span className="inline-flex items-center justify-center rounded-full bg-[#fff4d9] px-2 py-0.5 text-xs font-semibold text-[#b8903f]">
              {upcomingMilestones.length}件
            </span>
          </h2>
          <ul className="space-y-2">
            {upcomingMilestones.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-[#f0d898] bg-[#fff4d9]/60 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#3d3529]">{t.name}</p>
                  <p className="text-xs text-[#7a7062]">{t.projectName}</p>
                </div>
                <span className="ml-3 shrink-0 text-xs font-semibold text-[#b8903f]">{t.dueDate}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Executive mode: project overview */}
      {persona === "executive" && (
        <section>
          <h2 className="mb-3 text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">全プロジェクト俯瞰</h2>
          {allProjects.length === 0 ? (
            <div className="rounded-xl border border-[#e8dfd3] bg-white p-4 text-center text-sm text-[#a69e93]">
              プロジェクトがありません
            </div>
          ) : (
            <ul className="space-y-2">
              {projectStats.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-[#e8dfd3] bg-white p-3 shadow-sm cursor-pointer hover:border-[#7ba88a] transition-colors"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#3d3529] truncate">{p.name}</span>
                    <span className={`text-xs font-bold tabular-nums ${
                      p.pct > 80 ? "text-[#5e8a6c]" : p.pct > 50 ? "text-[#7ba88a]" : "text-[#a69e93]"
                    }`}>
                      {p.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#f5f0e8] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.pct > 80 ? "bg-[#7ba88a]" : p.pct > 50 ? "bg-[#a8c4af]" : "bg-[#e8dfd3]"
                      }`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#a69e93] tabular-nums">
                    {p.doneCount}/{p.taskCount} タスク完了
                    {p.budget ? ` · 予算 ¥${p.budget.toLocaleString()}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Today's Tasks */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">
          今日のタスク
          <span className="inline-flex items-center justify-center rounded-full bg-[#e8f2eb] px-2 py-0.5 text-xs font-semibold text-[#5e8a6c]">
            {tasks.length}件
          </span>
        </h2>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8dfd3] bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f2eb]">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-medium text-[#3d3529]">
              今日のタスクはありません
            </p>
            <p className="mt-1 text-xs text-[#a69e93]">
              お疲れ様です。プロジェクト一覧からタスクを追加できます。
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={today}
                onStatusChange={handleStatusChange}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Budget & Deadline Alerts */}
      {triggeredAlerts.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">
            アラート ({triggeredAlerts.length})
          </h2>
          <ul className="space-y-2">
            {triggeredAlerts.map((alert, i) => (
              <li key={`${alert.rule.id}-${i}`} className="rounded-xl border border-[#f0d898] bg-[#fff4d9] px-4 py-3 text-sm text-[#7a5c28]">
                {alert.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Procurement Alerts */}
      {procurementAlerts.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase text-[#a69e93]">
            資材発注アラート ({procurementAlerts.length})
          </h2>
          <ul className="space-y-2">
            {procurementAlerts.slice(0, 5).map((alert) => (
              <li key={alert.taskId} className="rounded-xl border border-[#e8dfd3] bg-[#fdf8f0] px-4 py-3 text-sm">
                <p className="font-medium text-[#3d3529]">{alert.taskName}</p>
                <p className="mt-0.5 text-xs text-[#7a7062]">
                  開始まで {alert.daysRemaining}日 · リードタイム {alert.leadTime}日
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Navigation - only on desktop */}
      <div className="hidden pt-2 sm:block">
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-xl border border-[#e8dfd3] bg-white px-4 py-3.5 text-sm font-medium text-[#7a7062] shadow-sm hover:bg-[#fdf8f0] transition-colors"
        >
          &larr; プロジェクト一覧に戻る
        </button>
      </div>
    </div>
  );
}

export function TodayDashboardPage() {
  return (
    <TodayDashboardPageErrorBoundary>
      <TodayDashboardPageContent />
    </TodayDashboardPageErrorBoundary>
  );
}

// ── Sub-components ─────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-xl ${bgColor} p-3 text-center shadow-sm border border-[#e8dfd3]`}>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] font-medium text-[#a69e93] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function DashboardSummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#e8dfd3] bg-[#fdf8f0] p-3">
      <p className="text-xs font-semibold tracking-[0.18em] text-[#a69e93] uppercase">{label}</p>
      <p className="mt-1 text-base font-bold text-[#3d3529]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#7a7062]">{detail}</p>
    </div>
  );
}

function TaskCard({
  task,
  today,
  onStatusChange,
}: {
  task: TaskWithProject;
  today: string;
  onStatusChange: (id: string, status: TaskStatus) => Promise<void>;
}) {
  const isOverdue = task.dueDate ? task.dueDate < today : false;
  const [updating, setUpdating] = useState(false);

  const handleClick = async (newStatus: TaskStatus) => {
    if (updating) return;
    setUpdating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
        isOverdue ? "border-[#f2bdb3] bg-[#fde8e2]/30" : "border-[#e8dfd3]"
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#3d3529] leading-tight">
            {task.name}
          </p>
          <p className="mt-0.5 text-xs text-[#a69e93]">{task.projectName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusBg[task.status]}`}
        >
          {statusIcon[task.status]} {statusLabel[task.status]}
        </span>
      </div>

      {/* Due date */}
      {task.dueDate && (
        <p
          className={`mb-3 text-xs ${
            isOverdue ? "font-semibold text-[#c0614f]" : "text-[#a69e93]"
          }`}
        >
          {isOverdue ? "⚠ 期限超過: " : "期限: "}
          {task.dueDate}
        </p>
      )}

      {/* Quick Status Buttons */}
      <div className="flex gap-2">
        {(["done", "in_progress", "todo"] as const)
          .filter((s) => s !== task.status)
          .map((s) => (
            <button
              key={s}
              disabled={updating}
              onClick={() => handleClick(s)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold shadow-sm transition-all ${
                statusButtonStyle[s]
              } ${updating ? "opacity-50" : ""}`}
            >
              {s === "done" ? "✓ 完了" : s === "in_progress" ? "◉ 進行中" : "○ 未着手"}
            </button>
          ))}
      </div>
    </li>
  );
}
