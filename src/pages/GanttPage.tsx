import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Contractor, Project, ProjectStatus } from "../domain/types.js";
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
import { TaskDrilldownModal } from "../components/gantt/TaskDrilldownModal.js";
import type { ChartLayout, GanttTask, QuickAddState, TaskDetailState } from "../components/gantt/types.js";
import type { GeneratedSchedule, GeneratedTask } from "../lib/ai-schedule-generator.js";
import { getDefaultPaceData } from "../lib/ai-schedule-generator.js";
import { monteCarloSchedule, identifyDrivingPaths } from "../lib/schedule-risk-forecaster.js";
import { parseScheduleCommand, applyScheduleEdit } from "../lib/schedule-chat-editor.js";
import type { ScheduleEdit } from "../lib/schedule-chat-editor.js";
import {
  addDays,
  addDaysBySchedule,
  addDaysSkipWeekends,
  daysBetween,
  formatScheduleDate,
  hasCycle,
  toLocalDateString,
} from "../components/gantt/utils.js";
import { getHolidayName } from "../lib/japanese-holidays.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";
import { cascadeSchedule } from "../lib/cascade-scheduler.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import { buildGanttPdfHtml, exportGanttToPdf } from "../lib/gantt-pdf-export.js";
import { downloadProjectICS } from "../lib/gantt-ics-export.js";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar.js";
import { detectScheduleConflicts } from "../lib/schedule-conflict.js";
import {
  checkMilestoneStatus,
  createMilestones,
} from "../lib/milestone-tracker.js";
import {
  generateChangeLog,
  getChangeOrders,
} from "../lib/change-order-tracker.js";
import type { ConnectState } from "../components/gantt/types.js";
import { undoStack } from "../lib/undo-stack.js";
import { getCategories } from "../lib/task-categories.js";
import { expandWBSToPhases } from "../lib/work-breakdown/expansion.js";
import { getMasterCategories, getMasterEntries } from "../lib/work-schedule-master.js";
import { readMasterPresetHistory, writeMasterPresetHistory } from "../lib/gantt-master-preset.js";
import { savePhaseTemplate } from "../lib/phase-template/storage.js";
import type { PhaseTemplate, PhaseTemplateTag } from "../lib/phase-template/types.js";
import { ConfirmDialog } from "../components/common/ConfirmDialog.js";
import { ACTION_LABELS } from "../lib/action-labels.js";

const MAX_CHART_DAYS = 240;
const MIN_DAY_WIDTH = 8;
const MAX_DAY_WIDTH = 60;
const DEFAULT_DAY_WIDTH = 28;

const projectStatusLabel: Record<ProjectStatus, string> = {
  planning: "計画中",
  active: "進行中",
  completed: "完了",
  on_hold: "保留",
};

const projectStatusTone: Record<ProjectStatus, string> = {
  planning: "bg-[#fdf8f0] text-[#7a7062] ring-[#e8dfd3]",
  active: "bg-[#e8f2eb] text-[#5e8a6c] ring-[#c4dcc9]",
  completed: "bg-[#f5f0e8] text-[#a69e93] ring-[#e8dfd3]",
  on_hold: "bg-[#fff4d9] text-[#b8903f] ring-[#f0d898]",
};

// ─── GanttTask → GeneratedSchedule アダプター ─────────────────────────────────

function ganttTasksToGeneratedSchedule(
  tasks: GanttTask[],
  projectId: string,
  projectName: string,
): GeneratedSchedule {
  const genTasks: GeneratedTask[] = tasks.map((t) => {
    const startDate = t.startDate ? new Date(t.startDate) : new Date();
    const endDate = t.endDate ? new Date(t.endDate) : new Date();
    const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    return {
      id: t.id,
      name: t.name,
      category: "other" as const,
      startDate,
      endDate,
      durationDays,
      dependencies: t.dependencies ?? [],
      crewSize: 1,
    };
  });

  const validDates = genTasks.filter((t) => !isNaN(t.startDate.getTime()));
  const startDate = validDates.length > 0
    ? validDates.reduce((min, t) => t.startDate < min ? t.startDate : min, validDates[0].startDate)
    : new Date();
  const endDate = validDates.length > 0
    ? validDates.reduce((max, t) => t.endDate > max ? t.endDate : max, validDates[0].endDate)
    : new Date();

  return {
    projectId,
    projectName,
    tasks: genTasks,
    totalDays: Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1),
    startDate,
    endDate,
    criticalPath: [],
    generatedAt: new Date(),
  };
}

// ─── リスクパネル（nPlan統合）────────────────────────────────────────────────

type RiskPanelProps = {
  schedule: GeneratedSchedule;
  highlightedTaskIds: string[];
  onHighlight: (ids: string[]) => void;
};

function RiskPanel({ schedule, highlightedTaskIds, onHighlight }: RiskPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof identifyDrivingPaths> | null>(null);
  const [projectEndP50, setProjectEndP50] = useState<Date | null>(null);
  const [projectEndP80, setProjectEndP80] = useState<Date | null>(null);
  const [projectEndP95, setProjectEndP95] = useState<Date | null>(null);

  const handleRun = useCallback(() => {
    if (schedule.tasks.length === 0) return;
    setRunning(true);
    // setTimeout で非同期に実行してUIブロックを避ける
    setTimeout(() => {
      try {
        const history = getDefaultPaceData();
        const forecast = monteCarloSchedule(schedule, history, 1000);
        const paths = identifyDrivingPaths(schedule, forecast, history, 3);
        setResult(paths);
        setProjectEndP50(forecast.projectEndP50);
        setProjectEndP80(forecast.projectEndP80);
        setProjectEndP95(forecast.projectEndP95);
      } finally {
        setRunning(false);
      }
    }, 0);
  }, [schedule]);

  const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const pathColors = ["bg-red-500", "bg-amber-500", "bg-yellow-400"] as const;

  return (
    <div className="rounded-2xl border border-[#e8dfd3] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="mt-1 text-sm font-semibold text-[#3d3529]">リスク予測（モンテカルロ）</h2>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={running || schedule.tasks.length === 0}
          className="rounded-xl bg-[#7ba88a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#5e8a6c] disabled:opacity-50 transition-colors"
        >
          {running ? "計算中..." : "リスク計算"}
        </button>
      </div>

      {result && projectEndP50 && projectEndP80 && projectEndP95 && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#e8f2eb] px-3 py-1 text-[#5e8a6c]">P50: {fmtDate(projectEndP50)}</span>
            <span className="rounded-full bg-[#fff4d9] px-3 py-1 text-[#b8903f]">P80: {fmtDate(projectEndP80)}</span>
            <span className="rounded-full bg-[#fde8e2] px-3 py-1 text-[#c0614f]">P95: {fmtDate(projectEndP95)}</span>
          </div>
          <div className="space-y-2">
            {result.map((path, idx) => {
              const isHighlighted = path.taskIds.every((id) => highlightedTaskIds.includes(id));
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onHighlight(isHighlighted ? [] : path.taskIds)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    isHighlighted ? "bg-[#fde8e2] ring-2 ring-[#e8836b]" : "bg-[#fdf8f0] hover:bg-[#f5f0e8]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${pathColors[idx] ?? "bg-[#a69e93]"}`} />
                    <span className="font-semibold text-[#3d3529]">
                      {Math.round(path.probability * 100)}% クリティカル / 平均 {path.expectedDelay.toFixed(1)}日遅延
                    </span>
                  </div>
                  <p className="text-[#7a7062] leading-relaxed">{path.explanation}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!result && !running && (
        <p className="mt-3 text-sm text-[#a69e93]">「リスク計算」を押すとモンテカルロ1000回でクリティカルパスを分析します。</p>
      )}
    </div>
  );
}

// ─── チャット編集パネル（PROCOLLA統合）───────────────────────────────────────

type ChatEdit = { text: string; edits: ScheduleEdit[]; appliedAt: Date };

type ChatEditorPanelProps = {
  schedule: GeneratedSchedule;
  onScheduleChange: (next: GeneratedSchedule) => void;
};

function ChatEditorPanel({ schedule, onScheduleChange }: ChatEditorPanelProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatEdit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback((e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError(null);
    try {
      const edits = parseScheduleCommand(text, schedule);
      if (edits.length === 0) {
        setError("コマンドを認識できませんでした。例: 「塗装を2日後ろ倒し」");
        return;
      }
      const next = applyScheduleEdit(schedule, edits);
      const entry: ChatEdit = { text, edits, appliedAt: new Date() };
      setHistory((prev) => [entry, ...prev]);
      onScheduleChange(next);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "適用エラー");
    }
  }, [input, schedule, onScheduleChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    // undo: pop last entry and re-apply remaining from original
    setHistory((prev) => prev.slice(1));
    setError(null);
  }, [history]);

  const fmtTime = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-[#e8dfd3] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[#a69e93] uppercase">schedule-chat-editor</p>
          <h2 className="mt-1 text-sm font-semibold text-[#3d3529]">自然言語で工程を編集</h2>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleUndo}
            className="rounded-xl border border-[#e8dfd3] bg-white px-3 py-1.5 text-xs font-semibold text-[#7a7062] hover:bg-[#fdf8f0] transition-colors"
          >
            ↩ Undo
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例: 塗装を2日後ろ倒し、清掃を前倒し"
          className="flex-1 rounded-xl border border-[#e8dfd3] bg-white px-3 py-2 text-sm text-[#3d3529] placeholder:text-[#a69e93] focus:outline-none focus:ring-2 focus:ring-[#7ba88a]"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-xl bg-[#7ba88a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#5e8a6c] disabled:opacity-50 transition-colors"
        >
          適用
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs font-medium text-[#c0614f]">{error}</p>
      )}

      {history.length > 0 && (
        <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
          {history.map((entry, idx) => (
            <div key={idx} className="rounded-lg bg-[#fdf8f0] px-3 py-2 text-xs text-[#7a7062]">
              <span className="text-[#a69e93] mr-2">{fmtTime(entry.appliedAt)}</span>
              <span className="font-medium text-[#3d3529]">{entry.text}</span>
              <span className="ml-2 text-[#a69e93]">({entry.edits.length}件適用)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [drilldownTask, setDrilldownTask] = useState<GanttTask | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetailState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GanttTask | null>(null);
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [connectMode, setConnectMode] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string>("");
  const [undoing, setUndoing] = useState(false);
  const [canUndo, setCanUndo] = useState(() => undoStack.canUndo());
  const [showMilestones, setShowMilestones] = useState(true);
  const [showChanges, setShowChanges] = useState(false);
  const [rainDialogOpen, setRainDialogOpen] = useState(false);
  const [rainDate, setRainDate] = useState("");
  const [rainAffected, setRainAffected] = useState<Map<string, { startDate: string; endDate: string }> | null>(null);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [wbsModalOpen, setWbsModalOpen] = useState(false);
  const [wbsSelectedMajors, setWbsSelectedMajors] = useState<Set<string>>(
    () => new Set(getCategories()),
  );
  const [wbsApplying, setWbsApplying] = useState(false);

  // ─── マスタープリセット ───────────────────────────────────────────────────
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterSelectedCategoryId, setMasterSelectedCategoryId] = useState<string>(
    () => readMasterPresetHistory().lastCategoryId ?? getMasterCategories()[0]?.id ?? "",
  );
  const [masterSelectedEntryIds, setMasterSelectedEntryIds] = useState<Set<string>>(
    () => new Set(getMasterEntries(readMasterPresetHistory().lastCategoryId ?? getMasterCategories()[0]?.id ?? "").map((e) => e.id)),
  );
  const [masterApplying, setMasterApplying] = useState(false);
  const [masterConflictPending, setMasterConflictPending] = useState(false);

  // ─── テンプレ保存モーダル ──────────────────────────────────────────────────
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const [templateSaveDesc, setTemplateSaveDesc] = useState("");
  const [templateSaveTags, setTemplateSaveTags] = useState<Set<PhaseTemplateTag>>(new Set());
  const [templateSaving, setTemplateSaving] = useState(false);

  // ─── 工種フィルタ ──────────────────────────────────────────────────────────
  const TRADE_CATEGORIES = ["painting", "framing", "electrical", "plumbing", "finishing", "other"] as const;
  type TradeCategory = typeof TRADE_CATEGORIES[number];
  const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
    painting: "塗装",
    framing: "軽鉄",
    electrical: "電気",
    plumbing: "配管",
    finishing: "仕上",
    other: "その他",
  };
  const [activeTrades, setActiveTrades] = useState<Set<TradeCategory>>(new Set(TRADE_CATEGORIES));
  const [riskHighlightIds, setRiskHighlightIds] = useState<string[]>([]);
  const [chatSchedule, setChatSchedule] = useState<GeneratedSchedule | null>(null);
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
          const normalizedProjectStart = addDaysSkipWeekends(
            projectStart,
            0,
            project?.includeWeekends ?? true,
            task.includeWeekends,
          );
          const startDate = task.startDate
            ?? (task.dueDate
              ? addDaysBySchedule(task.dueDate, -2, project?.includeWeekends ?? true, task.includeWeekends)
              : normalizedProjectStart);
          const endDate = task.dueDate
            ?? addDaysBySchedule(startDate, 2, project?.includeWeekends ?? true, task.includeWeekends);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ガントデータの取得トリガー
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialProjectId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URLパラメータからプロジェクトIDを初期設定する同期パターン
    setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    writeLastProjectId(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => () => {
    undoStack.clear();
  }, []);

  useEffect(() => {
    undoStack.clear();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- プロジェクト切替時にundoスタックをリセットする同期パターン
    setCanUndo(false);
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedProjectTasks = useMemo(
    () => ganttTasks.filter((task) => task.projectId === selectedProjectId),
    [ganttTasks, selectedProjectId],
  );

  const resolveTradeCategory = useCallback((task: GanttTask): TradeCategory => {
    const raw = (task.majorCategory ?? "").toLowerCase();
    if (raw.includes("paint") || raw.includes("塗装")) return "painting";
    if (raw.includes("fram") || raw.includes("軽鉄") || raw.includes("下地")) return "framing";
    if (raw.includes("elect") || raw.includes("電気") || raw.includes("配線")) return "electrical";
    if (raw.includes("plumb") || raw.includes("配管") || raw.includes("給排水")) return "plumbing";
    if (raw.includes("finish") || raw.includes("仕上") || raw.includes("クロス") || raw.includes("床")) return "finishing";
    return "other";
  }, []);

  const filteredProjectTasks = useMemo(
    () => selectedProjectTasks.filter((task) => activeTrades.has(resolveTradeCategory(task))),
    [selectedProjectTasks, activeTrades, resolveTradeCategory],
  );

  const selectedProjectPeriod = useMemo(() => {
    if (!selectedProject) return "期間未設定";
    return buildProjectPeriod(selectedProject, selectedProjectTasks);
  }, [selectedProject, selectedProjectTasks]);

  const milestoneIndicators = useMemo(
    () => (
      selectedProject
        ? checkMilestoneStatus(createMilestones(selectedProject, selectedProjectTasks), today)
        : []
    ),
    [selectedProject, selectedProjectTasks, today],
  );

  const milestoneSummary = useMemo(
    () => milestoneIndicators.reduce((summary, milestone) => {
      summary[milestone.status] += 1;
      return summary;
    }, {
      "on-track": 0,
      "at-risk": 0,
      missed: 0,
      completed: 0,
    }),
    [milestoneIndicators],
  );

  const projectChangeOrders = useMemo(
    () => (selectedProject ? getChangeOrders(selectedProject.id) : []),
    [selectedProject],
  );

  const changeLog = useMemo(
    () => (selectedProject ? generateChangeLog(selectedProject.id) : []),
    [selectedProject],
  );

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
      projectIncludesWeekends: project?.includeWeekends ?? true,
      name: "",
      startDate,
      dueDate: addDaysBySchedule(startDate, 2, project?.includeWeekends ?? true),
      contractorId: "",
      status: "todo",
      submitting: false,
      selectedCategory: "",
      majorCategory: "",
      middleCategory: "",
      minorCategory: "",
      categorySearch: "",
    });
  }, [projects, today]);

  const openTaskDetail = useCallback((task: GanttTask) => {
    setDrilldownTask(task);
  }, []);

  const openTaskEdit = useCallback((task: GanttTask) => {
    setDrilldownTask(null);
    setTaskDetail({
      task,
      editName: task.name,
      editStartDate: task.startDate,
      editDueDate: task.endDate,
      editIncludeWeekendsOverride: task.includeWeekends !== undefined,
      editIncludeWeekends: task.includeWeekends ?? task.projectIncludesWeekends,
      editAssigneeId: task.assigneeId ?? "",
      editContractorId: task.contractorId ?? "",
      editProgress: task.progress,
      editStatus: task.status,
      editMaterials: task.materials?.join(", ") ?? "",
      editLeadTimeDays: task.lead_time != null
        ? String(task.lead_time)
        : task.leadTimeDays != null
          ? String(task.leadTimeDays)
          : "",
      editDependencyType: task.dependencyType ?? "FS",
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
        majorCategory: quickAdd.majorCategory || undefined,
        middleCategory: quickAdd.middleCategory || undefined,
        minorCategory: quickAdd.minorCategory || undefined,
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
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスクの削除に失敗しました");
      setDeleteTarget(null);
    }
  }, [loadData, taskRepository]);

  const handleTaskDetailSave = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskDetail) return;

    if (
      taskDetail.editStartDate &&
      taskDetail.editDueDate &&
      taskDetail.editDueDate < taskDetail.editStartDate
    ) {
      setError("終了日は開始日以降に設定してください");
      return;
    }

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
        includeWeekends: taskDetail.editIncludeWeekendsOverride ? taskDetail.editIncludeWeekends : undefined,
        assigneeId: taskDetail.editAssigneeId.trim() || undefined,
        contractorId: nextContractorId,
        progress: taskDetail.editProgress,
        status: taskDetail.editStatus,
        materials,
        lead_time: Number.isFinite(leadTimeDays) ? leadTimeDays : undefined,
        leadTimeDays: Number.isFinite(leadTimeDays) ? leadTimeDays : undefined,
        dependencyType: taskDetail.editDependencyType,
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

    // Prevent circular dependencies (A→B→A)
    if (hasCycle(ganttTasks, fromTaskId, toTaskId)) {
      setError("循環依存関係が発生するため、この接続はできません。");
      return;
    }

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

  const handleUndo = useCallback(async () => {
    const entry = undoStack.undo();
    setCanUndo(undoStack.canUndo());
    if (!entry) return;

    setUndoing(true);
    try {
      await taskRepository.update(entry.taskId, {
        startDate: entry.previousStartDate,
        dueDate: entry.previousEndDate,
        updatedAt: new Date().toISOString(),
      });
      await loadData();
    } catch (err) {
      undoStack.push(entry);
      setCanUndo(true);
      setError(err instanceof Error ? err.message : "変更の取り消しに失敗しました");
    } finally {
      setUndoing(false);
    }
  }, [loadData, taskRepository]);

  const { dragState, dragRef, cascadePreview, startTaskDrag, startTaskResize } = useGanttDrag({
    ganttTasks,
    contractors,
    dayWidth,
    organizationId,
    taskRepository,
    loadData,
    onError: setError,
    onDatesCommitted: (entry) => {
      undoStack.push(entry);
      setCanUndo(undoStack.canUndo());
    },
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
      const day = new Date(`${date}T00:00:00`).getDay();
      const holidayName = getHolidayName(date);
      return {
        date,
        isToday: date === today,
        isWeekend: day === 0 || day === 6,
        isHoliday: holidayName !== null,
        holidayName,
      };
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

  // ─── Googleカレンダー個人予定とのダブり可視化 (Phase A) ────────
  const googleCalendarRange = useMemo(() => {
    if (!chartLayout) return { timeMin: null, timeMax: null } as const;
    return {
      timeMin: new Date(`${chartLayout.chartStart}T00:00:00`),
      timeMax: new Date(`${addDays(chartLayout.chartStart, chartLayout.totalDays)}T23:59:59`),
    };
  }, [chartLayout]);
  const googleCalendar = useGoogleCalendar(googleCalendarRange);
  const scheduleConflicts = useMemo(
    () => detectScheduleConflicts(googleCalendar.events, selectedProjectTasks),
    [googleCalendar.events, selectedProjectTasks],
  );
  const personalEventLabelsByDate = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [date, events] of Object.entries(scheduleConflicts.eventsByDate)) {
      out[date] = events.map((e) => e.summary);
    }
    return out;
  }, [scheduleConflicts.eventsByDate]);

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    writeLastProjectId(projectId);
    navigate(`/gantt/${projectId}`);
  }, []);

  const handlePdfPreview = useCallback(() => {
    if (!selectedProject) return;
    try {
      const html = buildGanttPdfHtml(
        selectedProject,
        selectedProjectTasks,
        chartLayout?.chartStart ?? selectedProject.startDate,
        chartLayout?.totalDays ?? 0,
        { autoPrint: false },
      );
      setPdfPreviewHtml(html);
      setPdfPreviewOpen(true);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDFプレビューに失敗しました");
    }
  }, [chartLayout, selectedProject, selectedProjectTasks]);

  const handlePdfExport = useCallback(() => {
    if (!selectedProject) return;

    setPdfExporting(true);
    try {
      exportGanttToPdf(
        selectedProject,
        selectedProjectTasks,
        chartLayout?.chartStart ?? selectedProject.startDate,
        chartLayout?.totalDays ?? 0,
      );
      setPdfPreviewOpen(false);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF出力に失敗しました");
    } finally {
      setPdfExporting(false);
    }
  }, [chartLayout, selectedProject, selectedProjectTasks]);

  const icsExportableCount = useMemo(
    () => selectedProjectTasks.filter((t) => !!t.startDate).length,
    [selectedProjectTasks],
  );

  const handleICSExport = useCallback(() => {
    if (!selectedProject) return;
    downloadProjectICS(selectedProject, selectedProjectTasks);
  }, [selectedProject, selectedProjectTasks]);

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

  const handleRainDateChange = useCallback((date: string) => {
    setRainDate(date);
    if (!date || selectedProjectTasks.length === 0) {
      setRainAffected(null);
      return;
    }
    // Find tasks that include the rain date
    const affectedTask = selectedProjectTasks.find(
      (task) => task.startDate <= date && task.endDate >= date,
    );
    if (!affectedTask) {
      setRainAffected(new Map());
      return;
    }
    const updates = cascadeSchedule(
      selectedProjectTasks,
      affectedTask.id,
      affectedTask.startDate,
      affectedTask.endDate,
    );
    // Include the directly affected task shifted by 1 day
    const shifted = addDaysSkipWeekends(
      affectedTask.endDate,
      1,
      affectedTask.projectIncludesWeekends,
      affectedTask.includeWeekends,
    );
    updates.set(affectedTask.id, {
      startDate: affectedTask.startDate,
      endDate: shifted,
    });
    setRainAffected(updates);
  }, [selectedProjectTasks]);

  const handleRainApply = useCallback(async () => {
    if (!rainAffected || rainAffected.size === 0) {
      setRainDialogOpen(false);
      return;
    }
    const now = new Date().toISOString();
    try {
      await Promise.all(
        Array.from(rainAffected.entries()).map(([taskId, dates]) =>
          taskRepository.update(taskId, {
            startDate: dates.startDate,
            dueDate: dates.endDate,
            updatedAt: now,
          }),
        ),
      );
      setRainDialogOpen(false);
      setRainDate("");
      setRainAffected(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "工程の更新に失敗しました");
    }
  }, [loadData, rainAffected, taskRepository]);

  const handleMasterApplyConfirmed = useCallback(async () => {
    if (!selectedProject || !masterSelectedCategoryId) return;
    setMasterConflictPending(false);
    setMasterApplying(true);
    try {
      const allEntries = getMasterEntries(masterSelectedCategoryId);
      const entries = allEntries.filter((e) => masterSelectedEntryIds.has(e.id));
      const categories = getMasterCategories();
      const category = categories.find((c) => c.id === masterSelectedCategoryId);
      if (!category || entries.length === 0) return;

      writeMasterPresetHistory({ lastCategoryId: masterSelectedCategoryId });

      const now = new Date().toISOString();
      let cursor = selectedProject.startDate;

      for (const entry of entries) {
        const startDate = cursor;
        const endDateObj = new Date(startDate);
        endDateObj.setDate(endDateObj.getDate() + entry.defaultDays - 1);
        const dueDate = endDateObj.toISOString().slice(0, 10);

        // entryのgroupIdからmiddleCategory名を取得
        const group = category.groups.find((g) => g.tasks.some((t) => t.id === entry.id) || `wbs-entry-${g.id}` === entry.id);
        const middleCategory = group?.name;

        await taskRepository.create({
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          projectId: selectedProject.id,
          name: entry.name,
          description: category.name,
          status: "todo",
          startDate,
          dueDate,
          progress: 0,
          dependencies: [],
          majorCategory: category.name,
          middleCategory,
          includeWeekends: selectedProject.includeWeekends,
        });

        const nextDate = new Date(dueDate);
        nextDate.setDate(nextDate.getDate() + 1);
        cursor = nextDate.toISOString().slice(0, 10);
      }

      setMasterModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "マスタープリセットの適用に失敗しました");
    } finally {
      setMasterApplying(false);
    }
  }, [loadData, masterSelectedCategoryId, masterSelectedEntryIds, selectedProject, taskRepository]);

  const handleMasterApply = useCallback(() => {
    if (!selectedProject || !masterSelectedCategoryId) return;
    if (selectedProjectTasks.length > 0) {
      // 既存タスクがある場合は確認ダイアログを表示
      setMasterConflictPending(true);
    } else {
      void handleMasterApplyConfirmed();
    }
  }, [handleMasterApplyConfirmed, masterSelectedCategoryId, selectedProject, selectedProjectTasks.length]);

  const handleWbsApply = useCallback(async () => {
    if (!selectedProject || wbsSelectedMajors.size === 0) return;
    setWbsApplying(true);
    try {
      const phases = expandWBSToPhases({
        projectId: selectedProject.id,
        projectStartDate: selectedProject.startDate,
        selectedMajors: wbsSelectedMajors,
        includeWeekends: selectedProject.includeWeekends,
      });
      const now = new Date().toISOString();
      for (const phase of phases) {
        await taskRepository.create({
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          ...phase,
        });
      }
      setWbsModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "工程テンプレートの適用に失敗しました");
    } finally {
      setWbsApplying(false);
    }
  }, [loadData, selectedProject, taskRepository, wbsSelectedMajors]);

  // ─── テンプレ保存ハンドラ ──────────────────────────────────────────────────
  const handleTemplateSave = useCallback(() => {
    if (!selectedProject || !templateSaveName.trim()) return;
    setTemplateSaving(true);
    try {
      // GanttTask[] → WBSCategory[] (3階層)
      const byCategory = new Map<string, Map<string, { name: string; defaultDays: number }[]>>();
      for (const task of selectedProjectTasks) {
        const major = task.majorCategory ?? "その他";
        const middle = task.middleCategory ?? "その他";
        if (!byCategory.has(major)) byCategory.set(major, new Map());
        const groupMap = byCategory.get(major)!;
        if (!groupMap.has(middle)) groupMap.set(middle, []);
        const durDays = task.startDate && task.endDate
          ? Math.max(1, Math.round((new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / 86400000) + 1)
          : 1;
        groupMap.get(middle)!.push({ name: task.name, defaultDays: durDays });
      }

      const phases = Array.from(byCategory.entries()).map(([majorName, groupMap]) => {
        const groups = Array.from(groupMap.entries()).map(([middleName, tasks]) => ({
          id: `wbs-grp-${majorName}-${middleName}`,
          categoryId: `wbs-cat-${majorName}`,
          name: middleName,
          defaultDays: tasks.reduce((s, t) => s + t.defaultDays, 0),
          tasks: tasks.map((t, i) => ({
            id: `wbs-task-${majorName}-${middleName}-${i}`,
            groupId: `wbs-grp-${majorName}-${middleName}`,
            categoryId: `wbs-cat-${majorName}`,
            name: t.name,
            defaultDays: t.defaultDays,
          })),
        }));
        const totalDays = groups.reduce((s, g) => s + g.defaultDays, 0);
        return {
          id: `wbs-cat-${majorName}`,
          name: majorName,
          defaultDays: totalDays,
          groups,
        };
      });

      const template: PhaseTemplate = {
        id: crypto.randomUUID(),
        name: templateSaveName.trim(),
        description: templateSaveDesc.trim(),
        tags: Array.from(templateSaveTags),
        phases,
        createdAt: new Date().toISOString(),
      };
      savePhaseTemplate(template);
      setTemplateSaveOpen(false);
      setTemplateSaveName("");
      setTemplateSaveDesc("");
      setTemplateSaveTags(new Set());
    } finally {
      setTemplateSaving(false);
    }
  }, [selectedProject, selectedProjectTasks, templateSaveDesc, templateSaveName, templateSaveTags]);

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

      {drilldownTask ? (
        <TaskDrilldownModal
          task={drilldownTask}
          onClose={() => setDrilldownTask(null)}
          onEdit={() => openTaskEdit(drilldownTask)}
        />
      ) : null}

      {taskDetail ? (
        <TaskEditModal
          taskDetail={taskDetail}
          contractors={contractors}
          onClose={() => setTaskDetail(null)}
          onSubmit={(event) => void handleTaskDetailSave(event)}
          onChange={(updater) => setTaskDetail((current) => (current ? updater(current) : current))}
          onDelete={(taskId) => setDeleteTarget(ganttTasks.find((task) => task.id === taskId) ?? taskDetail.task)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="工程タスクを削除"
        message={
          <>
            <span className="font-semibold text-slate-800">{deleteTarget?.name}</span>
            を削除します。この操作は取り消せません。
          </>
        }
        confirmLabel="削除する"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) void handleTaskDelete(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {rainDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="雨天中止ダイアログ"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">雨天中止の日程調整</h2>
            <p className="mt-1 text-sm text-slate-500">
              雨天で中止した日付を入力してください。影響タスクを1日後ろにずらします。
            </p>
            <div className="mt-4">
              <label htmlFor="rain-date" className="block text-xs font-semibold tracking-[0.16em] text-slate-500">
                雨天日
              </label>
              <input
                id="rain-date"
                type="date"
                value={rainDate}
                onChange={(e) => handleRainDateChange(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {rainAffected !== null && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                {rainAffected.size === 0 ? (
                  <p className="text-sm text-slate-500">この日に該当するタスクはありません。</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">
                      影響タスク ({rainAffected.size}件)
                    </p>
                    <ul className="mt-2 space-y-1">
                      {Array.from(rainAffected.entries()).slice(0, 5).map(([taskId, dates]) => {
                        const task = selectedProjectTasks.find((t) => t.id === taskId);
                        return (
                          <li key={taskId} className="flex items-center justify-between text-sm text-slate-700">
                            <span className="truncate font-medium">{task?.name ?? taskId}</span>
                            <span className="ml-2 shrink-0 tabular-nums text-xs text-slate-500">
                              → {dates.endDate}
                            </span>
                          </li>
                        );
                      })}
                      {rainAffected.size > 5 && (
                        <li className="text-xs text-slate-400">他 {rainAffected.size - 5} 件...</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRainDialogOpen(false)}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {ACTION_LABELS.form.cancel}
              </button>
              <button
                type="button"
                disabled={!rainDate || (rainAffected?.size ?? -1) === 0}
                onClick={() => void handleRainApply()}
                className="min-h-[44px] rounded-2xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                変更を適用
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {masterModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="マスタから読み込む"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">テンプレートから工程を追加</h2>
            <p className="mt-1 text-sm text-slate-500">
              大項目を選んで追加する工程をチェックしてください。
            </p>

            {/* 大項目 (Level 1) */}
            <div className="mt-4">
              <label htmlFor="master-category-select" className="block text-xs font-semibold tracking-[0.16em] text-slate-500">
                大項目
              </label>
              <select
                id="master-category-select"
                value={masterSelectedCategoryId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setMasterSelectedCategoryId(nextId);
                  setMasterSelectedEntryIds(new Set(getMasterEntries(nextId).map((entry) => entry.id)));
                }}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {getMasterCategories().map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* 中項目 → 小項目 3階層ツリー (Level 2 & 3) */}
            {masterSelectedCategoryId && (() => {
              const cat = getMasterCategories().find((c) => c.id === masterSelectedCategoryId);
              if (!cat) return null;
              const allEntries = getMasterEntries(masterSelectedCategoryId);
              const selectedCount = allEntries.filter((e) => masterSelectedEntryIds.has(e.id)).length;
              const allChecked = selectedCount === allEntries.length;
              return (
                <div className="mt-4" aria-label="中項目・小項目ツリー">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">
                      中項目 / 小項目
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (allChecked) {
                          setMasterSelectedEntryIds(new Set());
                        } else {
                          setMasterSelectedEntryIds(new Set(allEntries.map((e) => e.id)));
                        }
                      }}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {allChecked ? "全解除" : "全選択"} ({selectedCount}/{allEntries.length})
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 max-h-56 overflow-y-auto space-y-3">
                    {cat.groups.map((group) => {
                      const groupEntries = allEntries.filter((e) =>
                        group.tasks.some((t) => t.id === e.id) || `wbs-entry-${group.id}` === e.id,
                      );
                      const groupCheckedCount = groupEntries.filter((e) => masterSelectedEntryIds.has(e.id)).length;
                      const groupAllChecked = groupCheckedCount === groupEntries.length && groupEntries.length > 0;
                      return (
                        <div key={group.id}>
                          {/* 中項目 (Level 2) */}
                          <label className="flex cursor-pointer items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              checked={groupAllChecked}
                              onChange={() => {
                                setMasterSelectedEntryIds((prev) => {
                                  const next = new Set(prev);
                                  if (groupAllChecked) {
                                    groupEntries.forEach((e) => next.delete(e.id));
                                  } else {
                                    groupEntries.forEach((e) => next.add(e.id));
                                  }
                                  return next;
                                });
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              aria-label={`中項目: ${group.name}`}
                            />
                            <span className="text-xs font-semibold text-slate-600">{group.name}</span>
                            <span className="ml-auto text-xs tabular-nums text-slate-400">{groupCheckedCount}/{groupEntries.length}</span>
                          </label>
                          {/* 小項目 (Level 3) */}
                          {groupEntries.length > 0 && (
                            <ul className="ml-6 space-y-0.5">
                              {groupEntries.map((entry) => {
                                const checked = masterSelectedEntryIds.has(entry.id);
                                return (
                                  <li key={entry.id}>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-white">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setMasterSelectedEntryIds((prev) => {
                                            const next = new Set(prev);
                                            if (checked) {
                                              next.delete(entry.id);
                                            } else {
                                              next.add(entry.id);
                                            }
                                            return next;
                                          });
                                        }}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        aria-label={`小項目: ${entry.name}`}
                                      />
                                      <span className="flex-1 text-sm text-slate-700 truncate">{entry.name}</span>
                                      <span className="shrink-0 tabular-nums text-xs text-slate-400">{entry.defaultDays}日</span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMasterModalOpen(false)}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={!masterSelectedCategoryId || masterSelectedEntryIds.size === 0 || masterApplying}
                onClick={handleMasterApply}
                className="min-h-[44px] rounded-2xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {masterApplying ? ACTION_LABELS.task.adding : ACTION_LABELS.gantt.addSelected(masterSelectedEntryIds.size)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {masterConflictPending ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="工程追加の確認"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">工程を追加しますか？</h2>
            <p className="mt-2 text-sm text-slate-500">
              この案件にはすでに {selectedProjectTasks.length} 件の工程があります。テンプレートの工程を追加します。
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMasterConflictPending(false)}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleMasterApplyConfirmed()}
                className="min-h-[44px] rounded-2xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {wbsModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="工程テンプレート適用"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">工程テンプレート適用</h2>
            <p className="mt-1 text-sm text-slate-500">
              適用する大項目を選択してください。選択した工種のタスクが一括生成されます。
            </p>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {getCategories().map((major) => {
                const checked = wbsSelectedMajors.has(major);
                return (
                  <label
                    key={major}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setWbsSelectedMajors((prev) => {
                          const next = new Set(prev);
                          if (checked) {
                            next.delete(major);
                          } else {
                            next.add(major);
                          }
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{major}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {wbsSelectedMajors.size} / {getCategories().length} 大項目選択中
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setWbsModalOpen(false)}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={wbsSelectedMajors.size === 0 || wbsApplying}
                onClick={() => void handleWbsApply()}
                className="min-h-[44px] rounded-2xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {wbsApplying ? "適用中..." : "適用"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[28px] border border-[#e8dfd3] bg-[#fdf8f0] px-4 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#a69e93] uppercase">工程表</p>
            <h1 className="mt-1 text-2xl font-bold text-[#3d3529]">{selectedProject.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${projectStatusTone[selectedProject.status]}`}>
                {projectStatusLabel[selectedProject.status]}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#7a7062] ring-1 ring-[#e8dfd3]">
                {selectedProjectPeriod}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#7a7062] ring-1 ring-[#e8dfd3]">
                {selectedProjectTasks.length}件
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-white px-4 py-3 text-sm text-[#7a7062] ring-1 ring-[#e8dfd3]">
              ピンチで拡大縮小 / バーをドラッグして日程変更
            </div>
            <button
              type="button"
              onClick={() => setShowMilestones((current) => !current)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                showMilestones
                  ? "bg-[#3d3529] text-white shadow-sm"
                  : "bg-white text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
              }`}
            >
              Milestones
              {" "}
              {milestoneIndicators.length}
            </button>
            <button
              type="button"
              onClick={() => setShowChanges((current) => !current)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                showChanges
                  ? "bg-[#d4a853] text-white shadow-sm"
                  : "bg-white text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
              }`}
            >
              Changes
              {" "}
              {projectChangeOrders.length}
            </button>
            {canUndo ? (
              <button
                type="button"
                onClick={() => void handleUndo()}
                disabled={undoing}
                aria-label="直前の変更を元に戻す"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-[#7a7062] ring-1 ring-[#e8dfd3] transition-colors hover:bg-[#f5f0e8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                ↩
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleToggleConnectMode}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                connectMode
                  ? "bg-[#7a7062] text-white shadow-sm"
                  : "bg-white text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
              }`}
            >
              {connectMode
                ? connectState
                  ? "接続先を選択"
                  : "接続元を選択"
                : "依存関係を接続"}
            </button>
            <button
              type="button"
              onClick={() => setMasterModalOpen(true)}
              className="rounded-xl bg-[#7ba88a] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#5e8a6c] transition-colors"
            >
              マスタから読み込む
            </button>
            <details className="group relative">
              <summary className="list-none rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8] [&::-webkit-details-marker]:hidden">
                その他
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-[#e8dfd3] bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => setWbsModalOpen(true)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[#3d3529] hover:bg-[#f5f0e8]"
                >
                  工程テンプレート
                </button>
                <button
                  type="button"
                  disabled={selectedProjectTasks.length === 0}
                  onClick={() => setTemplateSaveOpen(true)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[#3d3529] hover:bg-[#f5f0e8] disabled:opacity-50"
                >
                  テンプレ保存
                </button>
                <button
                  type="button"
                  onClick={() => { setRainDate(""); setRainAffected(null); setRainDialogOpen(true); }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[#3d3529] hover:bg-[#f5f0e8]"
                >
                  雨天中止
                </button>
              </div>
            </details>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled={pdfExporting}
                onClick={() => { setPdfError(null); handlePdfPreview(); }}
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
              >
                {pdfExporting ? "出力中..." : "PDF出力"}
              </button>
              {pdfError && (
                <p className="text-xs text-[#c0614f]" role="alert">{pdfError}</p>
              )}
            </div>
            <button
              type="button"
              disabled={icsExportableCount === 0}
              onClick={handleICSExport}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              カレンダーに出力 (.ics)
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRiskPanel((v) => !v);
                if (!chatSchedule) {
                  setChatSchedule(ganttTasksToGeneratedSchedule(selectedProjectTasks, selectedProject.id, selectedProject.name));
                }
              }}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                showRiskPanel
                  ? "bg-[#e8836b] text-white shadow-sm"
                  : "bg-white text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
              }`}
            >
              リスク予測
            </button>
            <button
              type="button"
              onClick={() => {
                setShowChatPanel((v) => !v);
                if (!chatSchedule) {
                  setChatSchedule(ganttTasksToGeneratedSchedule(selectedProjectTasks, selectedProject.id, selectedProject.name));
                }
              }}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                showChatPanel
                  ? "bg-[#7a7062] text-white shadow-sm"
                  : "bg-white text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
              }`}
            >
              指示で編集
            </button>
          </div>
        </div>

        {showMilestones || showChanges ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-[#e8dfd3] bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[#3d3529]">工程上の主要マイルストーン</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[#e8f2eb] px-3 py-1 text-[#5e8a6c]">
                    完了 {milestoneSummary.completed}
                  </span>
                  <span className="rounded-full bg-[#fdf8f0] px-3 py-1 text-[#7a7062]">
                    順調 {milestoneSummary["on-track"]}
                  </span>
                  <span className="rounded-full bg-[#fff4d9] px-3 py-1 text-[#b8903f]">
                    注意 {milestoneSummary["at-risk"]}
                  </span>
                  <span className="rounded-full bg-[#fde8e2] px-3 py-1 text-[#c0614f]">
                    遅延 {milestoneSummary.missed}
                  </span>
                </div>
              </div>
              {milestoneIndicators.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {milestoneIndicators.slice(0, 6).map((milestone) => (
                    <span
                      key={milestone.id}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        milestone.status === "completed"
                          ? "bg-[#e8f2eb] text-[#5e8a6c]"
                          : milestone.status === "at-risk"
                            ? "bg-[#fff4d9] text-[#b8903f]"
                            : milestone.status === "missed"
                              ? "bg-[#fde8e2] text-[#c0614f]"
                              : "bg-[#fdf8f0] text-[#7a7062]"
                      }`}
                    >
                      {milestone.name}
                      {" "}·{" "}
                      {milestone.targetDate}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#a69e93]">依存関係のある工程が増えるとマイルストーンを自動表示します。</p>
              )}
            </div>

            <div className="rounded-xl border border-[#e8dfd3] bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[#3d3529]">変更指示サマリー</h2>
                <span className="rounded-full bg-[#f5f0e8] px-3 py-1 text-xs font-medium text-[#7a7062]">
                  {projectChangeOrders.length}件
                </span>
              </div>
              {showChanges && changeLog.length > 0 ? (
                <div className="mt-3 space-y-2 text-sm text-[#7a7062]">
                  <div className="flex items-center justify-between gap-3">
                    <span>累計コスト影響</span>
                    <span className="font-semibold tabular-nums text-[#3d3529]">
                      ¥{changeLog.at(-1)?.cumulativeCostDelta.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>累計日程影響</span>
                    <span className="font-semibold tabular-nums text-[#3d3529]">
                      {changeLog.at(-1)?.cumulativeScheduleDelta}日
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#a69e93]">登録済みの変更指示はありません。</p>
              )}
            </div>
          </div>
        ) : null}

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
                      ? "bg-[#3d3529] text-white"
                      : "bg-white text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
                  }`}
                >
                  {project.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 工種フィルタ */}
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="工種フィルタ">
          <button
            type="button"
            onClick={() => setActiveTrades(new Set(TRADE_CATEGORIES))}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8] transition-colors"
          >
            全表示
          </button>
          <button
            type="button"
            onClick={() => setActiveTrades(new Set())}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#7a7062] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8] transition-colors"
          >
            全非表示
          </button>
          {TRADE_CATEGORIES.map((cat) => {
            const on = activeTrades.has(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setActiveTrades((prev) => {
                    const next = new Set(prev);
                    if (next.has(cat)) next.delete(cat);
                    else next.add(cat);
                    return next;
                  })
                }
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on
                    ? "bg-[#7ba88a] text-white shadow-sm"
                    : "bg-white text-[#a69e93] ring-1 ring-[#e8dfd3] hover:bg-[#f5f0e8]"
                }`}
              >
                {TRADE_CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </section>

      {googleCalendar.needsReconnect && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-[#f0d898] bg-[#fff4d9] px-3 py-2 text-xs text-[#7a5c28]" role="status">
          <span>Google連携の有効期限が切れました</span>
          <button
            type="button"
            onClick={() => { void googleCalendar.reconnect(); }}
            className="rounded-md bg-[#d4a853] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#b8903f]"
          >
            再連携
          </button>
        </div>
      )}

      {selectedProjectTasks.length === 0 || !chartLayout ? (
        <EmptyScheduleState
          title="この案件に工程がありません"
          description="右下の追加ボタンから最初の工程を登録すると、すぐにバーで表示されます。"
          actionLabel="工程を追加"
          onAction={() => openQuickAdd(selectedProject.id, selectedProject.name)}
        />
      ) : (
        <GanttChart
          ganttTasks={filteredProjectTasks}
          visibleRows={filteredProjectTasks.map((task) => ({ type: "task" as const, task }))}
          chartLayout={chartLayout}
          dragState={dragState}
          dragRef={dragRef}
          cascadePreview={cascadePreview}
          connectMode={connectMode}
          connectState={connectState}
          milestones={milestoneIndicators}
          showMilestones={showMilestones}
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
          personalEventLabelsByDate={googleCalendar.connected ? personalEventLabelsByDate : undefined}
        />
      )}

      {(showRiskPanel || showChatPanel) && chatSchedule && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {showRiskPanel && (
            <RiskPanel
              schedule={chatSchedule}
              highlightedTaskIds={riskHighlightIds}
              onHighlight={setRiskHighlightIds}
            />
          )}
          {showChatPanel && (
            <ChatEditorPanel
              schedule={chatSchedule}
              onScheduleChange={setChatSchedule}
            />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => openQuickAdd(selectedProject.id, selectedProject.name)}
        className="safe-bottom fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#7ba88a] text-3xl text-white shadow-[0_12px_24px_rgba(123,168,138,0.4)] md:bottom-6"
        aria-label="新しいタスクを追加"
      >
        +
      </button>

      {templateSaveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50"
          onClick={() => setTemplateSaveOpen(false)}
        >
          <div
            className="rounded-[26px] bg-white shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="テンプレ保存"
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">工程をテンプレとして保存</h2>
              <p className="text-xs text-slate-500 mt-1">
                「{selectedProject.name}」の工程 ({selectedProjectTasks.length} タスク) をライブラリに保存します。
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label htmlFor="template-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  テンプレ名 <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={templateSaveName}
                  onChange={(e) => setTemplateSaveName(e.target.value)}
                  placeholder="例: 住宅リフォーム標準工程"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label htmlFor="template-desc" className="block text-xs font-semibold text-slate-700 mb-1">
                  説明 (任意)
                </label>
                <input
                  id="template-desc"
                  type="text"
                  value={templateSaveDesc}
                  onChange={(e) => setTemplateSaveDesc(e.target.value)}
                  placeholder="例: 60m²以下の内装リフォーム向け"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <fieldset>
                <legend className="text-xs font-semibold text-slate-700 mb-1">タグ (複数可)</legend>
                <div className="flex flex-wrap gap-2">
                  {(["住宅", "店舗", "オフィス"] as const).map((tag) => (
                    <label key={tag} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={templateSaveTags.has(tag)}
                        onChange={() => {
                          setTemplateSaveTags((prev) => {
                            const next = new Set(prev);
                            if (next.has(tag)) next.delete(tag);
                            else next.add(tag);
                            return next;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">{tag}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTemplateSaveOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={templateSaving || !templateSaveName.trim()}
                onClick={handleTemplateSave}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
              >
                {templateSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfPreviewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="工程表PDFプレビュー"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">工程表プレビュー</h2>
              <p className="text-xs text-slate-500">内容を確認してから出力してください</p>
            </div>
            <iframe
              title="工程表PDFプレビュー"
              srcDoc={pdfPreviewHtml}
              className="flex-1 w-full rounded-2xl border border-slate-200 bg-white"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(false)}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                閉じる
              </button>
              <button
                type="button"
                disabled={pdfExporting}
                onClick={() => { setPdfError(null); handlePdfExport(); }}
                className="min-h-[44px] rounded-2xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pdfExporting ? "出力中..." : "印刷 / PDF保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
