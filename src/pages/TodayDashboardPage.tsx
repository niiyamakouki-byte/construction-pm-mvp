import { useCallback, useEffect, useState } from "react";
import type { Task, TaskStatus, Project } from "../domain/types.js";
import { taskRepository } from "../stores/task-store.js";
import { projectRepository } from "../stores/project-store.js";
import { navigate } from "../hooks/useHashRouter.js";

// ── Helpers ────────────────────────────────────────────

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  done: "bg-green-50 text-green-700 border-green-200",
};

const statusButtonStyle: Record<TaskStatus, string> = {
  done: "bg-green-600 text-white active:bg-green-700",
  in_progress: "bg-blue-600 text-white active:bg-blue-700",
  todo: "bg-amber-500 text-white active:bg-amber-600",
};

type TaskWithProject = Task & { projectName: string };

// ── Weather Widget (simple fetch from Open-Meteo, free, no key) ────

type WeatherData = {
  temperature: number;
  description: string;
  icon: string;
} | null;

const weatherCodes: Record<number, { desc: string; icon: string }> = {
  0: { desc: "快晴", icon: "☀️" },
  1: { desc: "晴れ", icon: "🌤" },
  2: { desc: "曇り", icon: "⛅" },
  3: { desc: "曇天", icon: "☁️" },
  45: { desc: "霧", icon: "🌫" },
  48: { desc: "霧氷", icon: "🌫" },
  51: { desc: "小雨", icon: "🌦" },
  53: { desc: "雨", icon: "🌧" },
  55: { desc: "強い雨", icon: "🌧" },
  61: { desc: "小雨", icon: "🌦" },
  63: { desc: "雨", icon: "🌧" },
  65: { desc: "大雨", icon: "🌧" },
  71: { desc: "小雪", icon: "🌨" },
  73: { desc: "雪", icon: "❄️" },
  75: { desc: "大雪", icon: "❄️" },
  80: { desc: "にわか雨", icon: "🌦" },
  81: { desc: "にわか雨", icon: "🌧" },
  82: { desc: "激しい雨", icon: "⛈" },
  95: { desc: "雷雨", icon: "⛈" },
};

function useWeather(): { weather: WeatherData; loading: boolean } {
  const [weather, setWeather] = useState<WeatherData>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tokyo coordinates (default for construction company in 南青山)
    const lat = 35.6762;
    const lon = 139.6503;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FTokyo`;

    fetch(url)
      .then((res) => res.json())
      .then((data: { current?: { temperature_2m?: number; weather_code?: number } }) => {
        const current = data.current;
        if (current) {
          const code = current.weather_code ?? 0;
          const info = weatherCodes[code] ?? { desc: "不明", icon: "🌡" };
          setWeather({
            temperature: current.temperature_2m ?? 0,
            description: info.desc,
            icon: info.icon,
          });
        }
      })
      .catch(() => {
        // Weather is non-critical
      })
      .finally(() => setLoading(false));
  }, []);

  return { weather, loading };
}

// ── Main Component ─────────────────────────────────────

export function TodayDashboardPage() {
  const today = toLocalDateString(new Date());
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { weather, loading: weatherLoading } = useWeather();

  const loadData = useCallback(async () => {
    try {
      const [allT, allP] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
      ]);

      setAllTasks(allT);

      const projectMap = new Map<string, Project>();
      for (const p of allP) projectMap.set(p.id, p);

      // Tasks for today: due today, or in_progress with no due date, or overdue
      const todayTasks = allT
        .filter((t) => {
          if (t.status === "done") return false;
          if (t.dueDate === today) return true;
          if (t.dueDate && t.dueDate < today) return true; // overdue
          if (!t.dueDate && t.status === "in_progress") return true;
          return false;
        })
        .map((t) => ({
          ...t,
          projectName: projectMap.get(t.projectId)?.name ?? "不明",
        }));

      setTasks(todayTasks);
    } catch {
      // Silent fail for dashboard
    } finally {
      setLoading(false);
    }
  }, [today]);

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

  // ── Stats ────────────────────────────────────────────
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "done").length;
  const overdueTasks = allTasks.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate < today,
  ).length;
  const inProgressTasks = allTasks.filter(
    (t) => t.status === "in_progress",
  ).length;

  // ── Render ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-8">
      {/* Date & Weather Header */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 text-white shadow-md">
        <div>
          <p className="text-xs font-medium tracking-wider text-slate-300 uppercase">
            Today
          </p>
          <p className="text-lg font-bold">{today}</p>
        </div>
        <div className="text-right">
          {weatherLoading ? (
            <p className="text-sm text-slate-400">天気取得中...</p>
          ) : weather ? (
            <div>
              <p className="text-2xl">{weather.icon}</p>
              <p className="text-sm font-medium">
                {weather.temperature}°C {weather.description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">天気取得不可</p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="全タスク" value={totalTasks} color="text-slate-900" />
        <StatCard label="進行中" value={inProgressTasks} color="text-blue-600" />
        <StatCard label="完了" value={completedTasks} color="text-green-600" />
        <StatCard label="遅延" value={overdueTasks} color="text-red-600" />
      </div>

      {/* Today's Tasks */}
      <section>
        <h2 className="mb-3 text-base font-bold text-slate-800">
          今日のタスク
          <span className="ml-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {tasks.length}件
          </span>
        </h2>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">
            読み込み中...
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 text-sm font-medium text-slate-600">
              今日のタスクはありません
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

      {/* Navigation */}
      <div className="pt-2">
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm active:bg-slate-50"
        >
          ← プロジェクト一覧に戻る
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm border border-slate-100">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
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
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        isOverdue ? "border-red-200 bg-red-50/30" : "border-slate-200"
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
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusBg[task.status]}`}
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
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold shadow-sm transition-opacity ${
                statusButtonStyle[s]
              } ${updating ? "opacity-50" : ""}`}
            >
              {s === "done" ? "✓ 完了" : s === "in_progress" ? "◉ 進行中" : "○ 遅延"}
            </button>
          ))}
      </div>
    </li>
  );
}
