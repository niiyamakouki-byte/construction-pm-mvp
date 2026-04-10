import { useCallback, useEffect, useMemo, useState } from "react";
import type { Contractor, CostItem, Expense, Task, TaskStatus, Project } from "../domain/types.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createContractorRepository } from "../stores/contractor-store.js";
import { navigate } from "../hooks/useHashRouter.js";
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
import {
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
  todo: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusButtonStyle: Record<TaskStatus, string> = {
  done: "bg-emerald-600 text-white active:bg-emerald-700",
  in_progress: "bg-blue-600 text-white active:bg-blue-700",
  todo: "bg-amber-500 text-white active:bg-amber-600",
};

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const budgetStatusTone = {
  under_budget: "bg-emerald-50 text-emerald-700 border-emerald-200",
  on_budget: "bg-blue-50 text-blue-700 border-blue-200",
  over_budget: "bg-red-50 text-red-700 border-red-200",
} as const;

const healthGradeTone = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-lime-100 text-lime-700 border-lime-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-orange-100 text-orange-700 border-orange-200",
  F: "bg-red-100 text-red-700 border-red-200",
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

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
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
  const [photoValidation, setPhotoValidation] = useState<PhotoValidationResult | null>(null);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const allSiteForecasts = useMemo(
    () => buildMockConstructionSiteForecasts(allProjects),
    [allProjects],
  );
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

  // ── Render ───────────────────────────────────────────
  if (loading) {
    return <TodayDashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8">
      {/* Error banner */}
      {loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 mt-0.5">!</span>
          <span className="flex-1">{loadError}</span>
          <button onClick={() => setLoadError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      {/* Date Header */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 px-5 py-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand-300 uppercase">
              本日の概要
            </p>
            <p className="mt-1 text-xl font-bold">{formatDateJP(today)}</p>
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
                className="rounded-xl bg-white/10 px-3 py-3 text-left backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl leading-tight">
                      {getWeatherEmoji(todayForecast.weather[0]?.icon)}
                    </p>
                    <p className="mt-1 text-base font-bold">
                      {Math.round(todayForecast.temp.max)}° / {Math.round(todayForecast.temp.min)}°
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      risk.level === "danger"
                        ? "bg-red-100 text-red-700"
                        : risk.level === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {risk.level === "danger" ? "延期候補" : risk.level === "warning" ? "要注意" : "施工可"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-brand-200">
                  降水 {Math.round(todayForecast.pop * 100)}% · 風速 {todayForecast.wind_speed.toFixed(1)}m/s
                </p>
                <p className="mt-1.5 truncate text-[11px] font-semibold text-white">
                  {site.siteName}
                </p>
                <p className="truncate text-[10px] text-brand-300">
                  {site.locationLabel}
                </p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => navigate("/weather")}
          className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
        >
          7日間の現場天気を見る
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="進行中案件" value={activeProjectsCount} color="text-brand-700" bgColor="bg-brand-50" />
        <StatCard label="進行中タスク" value={inProgressTasks} color="text-blue-600" bgColor="bg-blue-50" />
        <StatCard label="完了タスク" value={completedTasks} color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatCard label="期限超過" value={overdueTasks} color="text-red-600" bgColor={overdueTasks > 0 ? "bg-red-50" : "bg-white"} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800">本日の日報</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {dailyReportProject?.name ?? "案件なし"}
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
            <p className="mt-4 text-sm text-slate-500">{dailyReportStatus}</p>
          )}

          <button
            type="button"
            onClick={handleDailyReportExport}
            disabled={!dailyReportProject || dailyReportExporting}
            className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dailyReportExporting ? "HTML生成中..." : "HTMLで日報出力"}
          </button>
        </div>
      </section>

      {/* Photo Upload */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800">現場写真アップロード</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {dailyReportProject?.name ?? "案件なし"}
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="photo-category" className="block text-xs font-semibold text-slate-500 mb-1">カテゴリ</label>
              <select
                id="photo-category"
                value={photoCategory}
                onChange={(e) => setPhotoCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {Object.values(PhotoCategory).map((cat) => (
                  <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="photo-file" className="block text-xs font-semibold text-slate-500 mb-1">写真ファイル</label>
              <input
                id="photo-file"
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setPhotoUploaded(false);
                  if (!file) {
                    setPhotoValidation(null);
                    return;
                  }
                  const result = validatePhoto({ type: file.type, size: file.size, name: file.name });
                  setPhotoValidation(result);
                  if (result.valid) {
                    setPhotoUploaded(true);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-700"
              />
            </div>
          </div>
          {photoValidation && !photoValidation.valid && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {photoValidation.errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
          {photoUploaded && photoValidation?.valid && (
            <p className="mt-3 text-xs text-emerald-600 font-semibold">
              写真を検証しました（{getCategoryLabel(photoCategory as import("../lib/photo-upload.js").PhotoCategory)}）。アップロード準備完了。
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800">GenbaHub Insight</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {insightProject?.name ?? "案件なし"}
          </span>
        </div>
        {insightProject && budgetInsight && timelineInsight && healthInsight ? (
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">予算サマリー</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">見積 vs 実績</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${budgetStatusTone[budgetInsight.breakdown.status]}`}>
                  {budgetInsight.breakdown.status === "over_budget"
                    ? "超過"
                    : budgetInsight.breakdown.status === "under_budget"
                      ? "余力あり"
                      : "予算通り"}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>見積</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatCurrency(budgetInsight.breakdown.totalEstimated)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>実績</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatCurrency(budgetInsight.breakdown.totalActual)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                  <span>差異</span>
                  <span className={`font-semibold tabular-nums ${
                    budgetInsight.comparison.overallVariance > 0 ? "text-red-600" : "text-emerald-600"
                  }`}>
                    {budgetInsight.comparison.overallVariance > 0 ? "+" : ""}
                    {formatCurrency(budgetInsight.comparison.overallVariance)}
                  </span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">工程予測</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">完了見込み</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  timelineInsight.onTrack
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
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
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>予定完了</span>
                  <span className="font-semibold tabular-nums text-slate-900">{timelineInsight.originalEndDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>予測完了</span>
                  <span className="font-semibold tabular-nums text-slate-900">{timelineInsight.predictedEndDate}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                  <span>遅延分析</span>
                  <span className="font-semibold text-slate-900">
                    {timelineInsight.delayAnalysis.totalDelayDays}日 /
                    {" "}
                    {delayCategoryLabel[timelineInsight.delayAnalysis.largestCause]}
                  </span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">案件健全性</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">Health Score</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${healthGradeTone[healthInsight.grade]}`}>
                  Grade {healthInsight.grade}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums text-slate-900">{healthInsight.overall}</p>
                  <p className="mt-1 text-xs text-slate-500">schedule / cost / quality / risk</p>
                </div>
                <p className="max-w-[14rem] text-right text-xs leading-5 text-slate-500">
                  {healthInsight.recommendations[0]}
                </p>
              </div>
            </article>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
            案件データが揃うと、予算・工程・健全性のカードを表示します。
          </div>
        )}
      </section>

      {/* Upcoming milestones */}
      {upcomingMilestones.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            今後7日間の期限
            <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {upcomingMilestones.length}件
            </span>
          </h2>
          <ul className="space-y-2">
            {upcomingMilestones.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.projectName}</p>
                </div>
                <span className="ml-3 shrink-0 text-xs font-semibold text-amber-700">{t.dueDate}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Executive mode: project overview */}
      {persona === "executive" && (
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-800">全プロジェクト俯瞰</h2>
          {allProjects.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
              プロジェクトがありません
            </div>
          ) : (
            <ul className="space-y-2">
              {projectStats.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm cursor-pointer hover:border-brand-300 transition-colors"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-800 truncate">{p.name}</span>
                    <span className={`text-xs font-bold tabular-nums ${
                      p.pct > 80 ? "text-emerald-600" : p.pct > 50 ? "text-blue-600" : "text-slate-500"
                    }`}>
                      {p.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.pct > 80 ? "bg-emerald-500" : p.pct > 50 ? "bg-blue-500" : "bg-slate-400"
                      }`}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400 tabular-nums">
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
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          今日のタスク
          <span className="inline-flex items-center justify-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {tasks.length}件
          </span>
        </h2>

        {tasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              今日のタスクはありません
            </p>
            <p className="mt-1 text-xs text-slate-400">
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
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            <span className="text-amber-500">⚠</span> アラート ({triggeredAlerts.length})
          </h2>
          <ul className="space-y-2">
            {triggeredAlerts.map((alert, i) => (
              <li key={`${alert.rule.id}-${i}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {alert.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Procurement Alerts */}
      {procurementAlerts.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            <span>📦</span> 資材発注アラート ({procurementAlerts.length})
          </h2>
          <ul className="space-y-2">
            {procurementAlerts.slice(0, 5).map((alert) => (
              <li key={alert.taskId} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                <p className="font-semibold text-blue-900">{alert.taskName}</p>
                <p className="mt-0.5 text-blue-700">
                  開始まで {alert.daysRemaining}日 · リードタイム {alert.leadTime}日
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Navigation - only on desktop (bottom tab bar handles mobile) */}
      <div className="hidden pt-2 sm:block">
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-600 shadow-sm active:bg-slate-50 transition-colors"
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
    <div className={`rounded-xl ${bgColor} p-3 text-center shadow-sm border border-slate-100`}>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
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
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
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
        isOverdue ? "border-red-200 bg-red-50/40" : "border-slate-200"
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 leading-tight">
            {task.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{task.projectName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBg[task.status]}`}
        >
          {statusIcon[task.status]} {statusLabel[task.status]}
        </span>
      </div>

      {/* Due date */}
      {task.dueDate && (
        <p
          className={`mb-3 text-xs ${
            isOverdue ? "font-bold text-red-600" : "text-slate-500"
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
              className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-bold shadow-sm transition-all ${
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
