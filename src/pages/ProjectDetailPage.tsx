import { useCallback, useEffect, useState } from "react";
import type { Project, Task, TaskStatus, CostItem } from "../domain/types.js";
import { projectRepository } from "../stores/project-store.js";
import { taskRepository } from "../stores/task-store.js";
import { costItemRepository } from "../stores/cost-item-store.js";
import { navigate } from "../hooks/useHashRouter.js";

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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`;
    const res = await fetch(url);
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
    // non-critical
  }
  return null;
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [p, allTasks, allCosts] = await Promise.all([
        projectRepository.findById(projectId),
        taskRepository.findAll(),
        costItemRepository.findAll(),
      ]);
      setProject(p);
      setTasks(allTasks.filter((t) => t.projectId === projectId));
      setCostItems(allCosts.filter((c) => c.projectId === projectId));

      if (p?.latitude && p?.longitude) {
        const w = await fetchWeather(p.latitude, p.longitude);
        setWeather(w);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await taskRepository.update(taskId, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    await loadData();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    setSubmitting(true);
    try {
      const now = new Date();
      await taskRepository.create({
        id: crypto.randomUUID(),
        projectId,
        name: taskName.trim(),
        description: "",
        status: "todo",
        dueDate: taskDueDate || undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      setTaskName("");
      setTaskDueDate("");
      setShowTaskForm(false);
      await loadData();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await taskRepository.delete(taskId);
    await loadData();
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

        {/* Task creation form */}
        {showTaskForm && (
          <form
            onSubmit={handleAddTask}
            className="mb-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm page-enter"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="タスク名"
                required
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50"
              >
                {submitting ? "追加中..." : "追加"}
              </button>
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
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${statusBg[task.status]}`}
                      title={`${statusLabel[task.status]} - タップで変更`}
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
                      {task.dueDate && (
                        <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
                          期限: {task.dueDate}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="削除"
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
