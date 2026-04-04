import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task, TaskStatus, Project } from "../domain/types.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { usePersona } from "../contexts/PersonaContext.js";

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

type TaskWithProject = Task & { projectName: string };

// ── Weather Widget (simple fetch from Open-Meteo, free, no key) ────

type WeatherData = {
  temperature: number;
  description: string;
  icon: string;
};

type ProjectWeather = {
  projectName: string;
  locationLabel: string;
  weather: WeatherData | null;
};

// Default: Tokyo
const TOKYO_LAT = 35.6762;
const TOKYO_LON = 139.6503;

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
    // Network error or timeout — non-critical, return null
  }
  return null;
}

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function useProjectWeathers(projects: Project[]): {
  weathers: ProjectWeather[];
  loading: boolean;
} {
  const [weathers, setWeathers] = useState<ProjectWeather[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const buckets = new Map<
        string,
        { lat: number; lon: number; entries: { name: string; label: string }[] }
      >();

      const activeProjects = projects.filter(
        (p) => p.status === "active" || p.status === "planning",
      );

      if (activeProjects.length === 0) {
        const key = coordKey(TOKYO_LAT, TOKYO_LON);
        buckets.set(key, {
          lat: TOKYO_LAT,
          lon: TOKYO_LON,
          entries: [{ name: "本社", label: "東京" }],
        });
      } else {
        for (const p of activeProjects) {
          const lat = p.latitude ?? TOKYO_LAT;
          const lon = p.longitude ?? TOKYO_LON;
          const label = p.address ?? "東京";
          const key = coordKey(lat, lon);
          const existing = buckets.get(key);
          if (existing) {
            existing.entries.push({ name: p.name, label });
          } else {
            buckets.set(key, {
              lat,
              lon,
              entries: [{ name: p.name, label }],
            });
          }
        }
      }

      const results: ProjectWeather[] = [];
      for (const bucket of buckets.values()) {
        const w = await fetchWeather(bucket.lat, bucket.lon);
        for (const entry of bucket.entries) {
          results.push({
            projectName: entry.name,
            locationLabel: entry.label,
            weather: w,
          });
        }
      }

      if (!cancelled) {
        setWeathers(results);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  return { weathers, loading };
}

// ── Main Component ─────────────────────────────────────

export function TodayDashboardPage() {
  const { organizationId } = useOrganizationContext();
  const taskRepository = useMemo(
    () => createTaskRepository(() => organizationId),
    [organizationId],
  );
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );
  const today = toLocalDateString(new Date());
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { weathers, loading: weatherLoading } = useProjectWeathers(allProjects);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [allT, allP] = await Promise.all([
        taskRepository.findAll(),
        projectRepository.findAll(),
      ]);

      setAllTasks(allT);
      setAllProjects(allP);

      const projectMap = new Map<string, Project>();
      for (const p of allP) projectMap.set(p.id, p);

      const todayTasks = allT
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
  }, [today]);

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
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "done").length;
  const overdueTasks = allTasks.filter(
    (t) => t.status !== "done" && t.dueDate && t.dueDate < today,
  ).length;
  const inProgressTasks = allTasks.filter(
    (t) => t.status === "in_progress",
  ).length;

  // Project completion stats for executive mode
  const projectStats = useMemo(() => {
    return allProjects.map((p) => {
      const pTasks = allTasks.filter((t) => t.projectId === p.id);
      const done = pTasks.filter((t) => t.status === "done").length;
      const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
      return { ...p, taskCount: pTasks.length, doneCount: done, pct };
    });
  }, [allProjects, allTasks]);

  // ── Render ───────────────────────────────────────────
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
              Today&apos;s Overview
            </p>
            <p className="mt-1 text-xl font-bold">{formatDateJP(today)}</p>
          </div>
          {weatherLoading && (
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span className="text-xs text-brand-300">天気取得中</span>
            </div>
          )}
        </div>

        {/* Per-project weather */}
        {!weatherLoading && weathers.length > 0 && (
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(weathers.length, 3)}, 1fr)` }}>
            {weathers.map((pw, i) => (
              <div
                key={i}
                className="rounded-xl bg-white/10 backdrop-blur-sm px-3 py-3 text-center"
              >
                {pw.weather ? (
                  <>
                    <p className="text-2xl leading-tight">{pw.weather.icon}</p>
                    <p className="mt-1 text-base font-bold">
                      {pw.weather.temperature}°C
                    </p>
                    <p className="text-[11px] text-brand-200">
                      {pw.weather.description}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-brand-300">取得不可</p>
                )}
                <p className="mt-1.5 truncate text-[11px] font-semibold text-white">
                  {pw.projectName}
                </p>
                <p className="truncate text-[10px] text-brand-300">
                  {pw.locationLabel}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="全タスク" value={totalTasks} color="text-slate-900" bgColor="bg-white" />
        <StatCard label="進行中" value={inProgressTasks} color="text-blue-600" bgColor="bg-blue-50" />
        <StatCard label="完了" value={completedTasks} color="text-emerald-600" bgColor="bg-emerald-50" />
        <StatCard label="遅延" value={overdueTasks} color="text-red-600" bgColor={overdueTasks > 0 ? "bg-red-50" : "bg-white"} />
      </div>

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

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            <span className="text-sm text-slate-400">読み込み中...</span>
          </div>
        ) : tasks.length === 0 ? (
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
