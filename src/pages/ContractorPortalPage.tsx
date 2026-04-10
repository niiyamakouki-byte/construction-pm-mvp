/**
 * ContractorPortalPage — 協力会社無料ビュー（Buildee/KANNA蒸留）
 * 認証不要・読み取り専用
 * /portal/:projectId
 */

import { useEffect, useMemo, useState } from "react";
import type { Project } from "../domain/types.js";
import type { Task } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { getEntryLog } from "../lib/site-entry-log.js";
import type { SiteEntryRecord } from "../lib/site-entry-log.js";

type Tab = "gantt" | "chat" | "drawings" | "attendance";

const TAB_DEFS: { key: Tab; label: string; icon: string }[] = [
  { key: "gantt", label: "工程表", icon: "📅" },
  { key: "chat", label: "チャット", icon: "💬" },
  { key: "drawings", label: "図面", icon: "📐" },
  { key: "attendance", label: "入退場", icon: "🚧" },
];

// ── Gantt read-only view ──────────────────────────────────────────────────

function GanttReadOnly({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-500">工程データがありません</p>
      </div>
    );
  }

  const sorted = [...tasks].sort((a, b) =>
    (a.startDate ?? "").localeCompare(b.startDate ?? ""),
  );

  const startDates = sorted.map((t) => t.startDate).filter(Boolean) as string[];
  const endDates = sorted.map((t) => t.endDate).filter(Boolean) as string[];
  const minDate = startDates.length > 0 ? startDates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = endDates.length > 0 ? endDates.reduce((a, b) => (a > b ? a : b)) : null;

  const totalDays =
    minDate && maxDate
      ? Math.max(
          1,
          Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86_400_000) + 1,
        )
      : 1;

  function barStyle(task: Task): React.CSSProperties {
    if (!task.startDate || !minDate) return { left: "0%", width: "4%" };
    const startOffset = Math.round(
      (new Date(task.startDate).getTime() - new Date(minDate).getTime()) / 86_400_000,
    );
    const duration = task.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / 86_400_000,
          ) + 1,
        )
      : 3;
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${Math.max(2, (duration / totalDays) * 100)}%`,
    };
  }

  const statusColors: Record<string, string> = {
    done: "bg-emerald-400",
    in_progress: "bg-blue-400",
    todo: "bg-slate-300",
    blocked: "bg-red-400",
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-500">
          {minDate} 〜 {maxDate}（{totalDays}日間）
        </p>
      </div>
      <div className="overflow-y-auto max-h-96">
        {sorted.map((task) => (
          <div key={task.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2 last:border-0">
            <div className="w-32 shrink-0 truncate text-xs font-medium text-slate-700">{task.name}</div>
            <div className="relative flex-1 h-5 rounded bg-slate-100">
              <div
                className={`absolute top-0.5 h-4 rounded ${statusColors[task.status] ?? "bg-slate-300"}`}
                style={barStyle(task)}
              />
            </div>
            <div className="w-12 shrink-0 text-[10px] text-slate-400 text-right">
              {task.progress ?? 0}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chat read-only view ───────────────────────────────────────────────────

function ChatReadOnly({ projectId }: { projectId: string }) {
  type ChatMessage = { id: string; sender: string; body: string; ts: string };

  const messages = useMemo<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(`genbahub_chat_${projectId}`);
      return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  }, [projectId]);

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-500">チャットメッセージがありません</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">チャット（閲覧のみ）</p>
      </div>
      <div className="space-y-3 overflow-y-auto max-h-96 px-4 py-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-700">{m.sender}</p>
              <p className="text-[10px] text-slate-400">{m.ts?.slice(0, 16)}</p>
            </div>
            <p className="text-sm text-slate-800">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drawings read-only view ───────────────────────────────────────────────

function DrawingsReadOnly({ projectId }: { projectId: string }) {
  type Drawing = { id: string; name: string; url: string; uploadedAt: string };

  const drawings = useMemo<Drawing[]>(() => {
    try {
      const raw = localStorage.getItem(`genbahub_drawings_${projectId}`);
      return raw ? (JSON.parse(raw) as Drawing[]) : [];
    } catch {
      return [];
    }
  }, [projectId]);

  if (drawings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-500">図面がありません</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">図面一覧（閲覧のみ）</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {drawings.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg" aria-hidden="true">📄</span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
              <p className="text-xs text-slate-400">{d.uploadedAt?.slice(0, 10)}</p>
            </div>
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                開く
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Attendance read-only view ─────────────────────────────────────────────

function AttendanceReadOnly({
  projectId,
  company,
}: {
  projectId: string;
  company: string | null;
}) {
  const records = useMemo<SiteEntryRecord[]>(() => {
    const all = getEntryLog(projectId);
    if (!company) return all;
    return all.filter((r) => r.company === company);
  }, [projectId, company]);

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-500">
          {company ? `${company}の入退場記録がありません` : "入退場記録がありません"}
        </p>
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => b.entryTime.localeCompare(a.entryTime));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {company ? `${company} の入退場記録` : "入退場記録"}（閲覧のみ）
        </p>
      </div>
      <div className="overflow-y-auto max-h-96">
        {sorted.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{r.workerName}</p>
              <p className="text-xs text-slate-500">{r.company}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-700">入: {r.entryTime.slice(11, 16)}</p>
              <p className="text-xs text-slate-500">
                {r.exitTime ? `退: ${r.exitTime.slice(11, 16)}` : "在場中"}
              </p>
            </div>
            <p className="w-20 shrink-0 text-right text-[10px] text-slate-400">
              {r.entryTime.slice(0, 10)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

type Props = {
  projectId: string;
  /** 協力会社名（URLパラメータ等から渡す）— null の場合は全社表示 */
  company?: string;
};

export function ContractorPortalPage({ projectId, company = null }: Props) {
  const projectRepository = useMemo(() => createProjectRepository(() => null), []);
  const taskRepository = useMemo(() => createTaskRepository(() => null), []);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("gantt");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [p, t] = await Promise.all([
        projectRepository.findById(projectId),
        taskRepository.findAll(),
      ]);
      if (!cancelled) {
        setProject(p ?? null);
        setTasks(t.filter((task) => task.projectId === projectId));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectRepository, taskRepository]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">プロジェクトが見つかりません</p>
          <p className="mt-2 text-sm text-slate-500">URLを確認してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white font-bold text-sm shrink-0">
              G
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{project.name}</p>
              <p className="text-xs text-slate-400">
                協力会社ポータル
                {company && ` — ${company}`}
                {" "}（閲覧のみ）
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-5 pb-8">
        {/* Project info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 text-sm">
            {project.address && (
              <span className="text-slate-600">
                <span className="font-semibold text-slate-400">現場: </span>{project.address}
              </span>
            )}
            {project.startDate && (
              <span className="text-slate-600">
                <span className="font-semibold text-slate-400">開始: </span>{project.startDate}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {TAB_DEFS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                activeTab === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span aria-hidden="true">{icon}</span>{" "}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "gantt" && <GanttReadOnly tasks={tasks} />}
        {activeTab === "chat" && <ChatReadOnly projectId={projectId} />}
        {activeTab === "drawings" && <DrawingsReadOnly projectId={projectId} />}
        {activeTab === "attendance" && (
          <AttendanceReadOnly projectId={projectId} company={company} />
        )}

        {/* Read-only notice */}
        <p className="text-center text-xs text-slate-400">
          このページは読み取り専用です。編集はGenbaHubにログインして行ってください。
        </p>
      </main>
    </div>
  );
}
