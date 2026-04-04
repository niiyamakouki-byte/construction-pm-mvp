import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project, Task, TaskStatus, CostItem, Expense } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createCostItemRepository } from "../stores/cost-item-store.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";

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
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};

const statusIcon: Record<TaskStatus, string> = {
  todo: "○",
  in_progress: "◉",
  done: "✓",
};

type WeatherData = {
  temperature: number;
  description: string;
  icon: string;
};

const weatherCodes: Record<number, { desc: string; icon: string }> = {
  0: { desc: "快晴", icon: "☀️" },
  1: { desc: "晴れ", icon: "🌤" },
  2: { desc: "曇り", icon: "⛅" },
  3: { desc: "曇天", icon: "☁️" },
  51: { desc: "小雨", icon: "🌦" },
  53: { desc: "雨", icon: "🌧" },
  55: { desc: "強い雨", icon: "🌧" },
  61: { desc: "小雨", icon: "🌦" },
  63: { desc: "雨", icon: "🌧" },
  65: { desc: "大雨", icon: "🌧" },
  80: { desc: "にわか雨", icon: "🌦" },
  95: { desc: "雷雨", icon: "⛈" },
};

async function fetchWeather(
  lat: number,
  lon: number,
): Promise<WeatherData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const current = data.current;
    if (current) {
      const code = current.weather_code ?? 0;
      const info = weatherCodes[code] ?? { desc: "不明", icon: "🌡" };
      return {
        temperature: current.temperature_2m ?? 0,
        description: info.desc,
        icon: info.icon,
      };
    }
  } catch {
    // non-critical: weather is a nice-to-have
  }
  return null;
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
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
  const weatherFetched = useRef(false);

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
      setTasks(allTasks.filter((t) => t.projectId === projectId));
      setCostItems(allCosts.filter((c) => c.projectId === projectId));
      setExpenses(allExpenses.filter((e) => e.projectId === projectId));

      if (p?.latitude && p?.longitude && !weatherFetched.current) {
        weatherFetched.current = true;
        const w = await fetchWeather(p.latitude, p.longitude);
        setWeather(w);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId, expenseRepository]);

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
          dueDate: addDaysToDate(baseDate, t.startOffsetDays + t.durationDays),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-sm text-slate-500">プロジェクトが見つかりません</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
        >
          一覧に戻る
        </button>
      </div>
    );
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
    planning: "bg-blue-100 text-blue-700",
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-slate-100 text-slate-600",
    on_hold: "bg-amber-100 text-amber-700",
  };

  const statusLabelMap: Record<string, string> = {
    planning: "計画中",
    active: "進行中",
    completed: "完了",
    on_hold: "保留",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600 transition-colors"
      >
        <span aria-hidden="true">&larr;</span>
        プロジェクト一覧
      </button>

      {/* Error banner */}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0 mt-0.5">!</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="エラーを閉じる">&times;</button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeletingTaskId(null)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">タスクを削除</h3>
            <p className="mt-2 text-sm text-slate-600">
              このタスクを削除してもよろしいですか？この操作は取り消せません。
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeletingTaskId(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDeleteTask}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Header */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-brand-300">{project.description}</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusColorMap[project.status]}`}
          >
            {statusLabelMap[project.status]}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {project.address && (
            <span className="flex items-center gap-1 text-brand-200">
              <span aria-hidden="true">📍</span>
              {project.address}
            </span>
          )}
          <span className="flex items-center gap-1 text-brand-200 tabular-nums">
            <span aria-hidden="true">📅</span>
            {project.startDate}
            {project.endDate && ` 〜 ${project.endDate}`}
          </span>
        </div>

        {/* Weather */}
        {weather && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <span className="text-xl">{weather.icon}</span>
            <span className="font-bold">{weather.temperature}°C</span>
            <span className="text-sm text-brand-200">{weather.description}</span>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">プロジェクト設定</h2>
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
                (project.includeWeekends ?? true) ? "bg-brand-500" : "bg-slate-300"
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
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-700 tabular-nums">
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
            {totalCost > 0 ? `¥${totalCost.toLocaleString()}` : "-"}
          </p>
          <p className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            コスト合計
          </p>
        </div>
      </div>

      {/* Cash Flow / Finance Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-slate-800">財務</h2>

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
                <span>支出: ¥{totalExpenses.toLocaleString()}</span>
                <span>予算: ¥{budget.toLocaleString()}</span>
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
            プロジェクトに予算を設定するとキャッシュフローが表示されます。
            {totalExpenses > 0 && ` 現在の支出: ¥${totalExpenses.toLocaleString()}`}
          </p>
        )}
      </section>

      {/* Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">タスク一覧</h2>
          <button
            onClick={() => setShowTaskForm(!showTaskForm)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
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
            className="mb-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm page-enter"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
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
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">終了日（期限）</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    aria-label="終了日"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
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
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
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
                    className="w-full accent-brand-500"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none resize-none"
              />
              {/* Row 5: actions */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { resetTaskForm(); setShowTaskForm(false); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
                >
                  {submitting ? "追加中..." : "追加"}
                </button>
              </div>
            </div>
          </form>
        )}

        {tasks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">
              タスクがまだありません。上のボタンからタスクを追加してください。
            </p>
          </div>
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
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                            {task.assigneeId}
                          </span>
                        )}
                        {task.progress > 0 && (
                          <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                            {task.progress}%
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleCopyTask(task)}
                      className="shrink-0 rounded-lg p-2.5 text-slate-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
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
    </div>
  );
}
