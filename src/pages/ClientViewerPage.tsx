/**
 * ClientViewerPage — 施主リアルタイムビューア（プロダクトアイデア#1）
 * 認証不要・読み取り専用。URLをLINE/メールで施主に共有
 * /client/:projectId
 */

import { useEffect, useMemo, useState } from "react";
import type { Project, Task, DailyReport, ChatMessage } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import {
  STAGE_ORDER,
  getStageLabel,
  type ProjectStage,
} from "../lib/project-flow.js";
import {
  getChangeRequests,
  updateChangeRequest,
  type ChangeRequest,
} from "../lib/change-request.js";
import { getMessages } from "../lib/chat-store.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function nextWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">工事進捗</span>
        <span className="text-2xl font-bold text-blue-600">{value}%</span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-700"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">最新の工事写真</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.slice(0, 10).map((url, i) => (
          <div
            key={i}
            className="aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-100"
          >
            <img
              src={url}
              alt={`工事写真 ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayWork({ notices }: { notices: ChatMessage[] }) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">今日の作業内容</h3>
      {notices.length === 0 ? (
        <p className="text-sm text-slate-400">本日の周知はありません</p>
      ) : (
        <ul className="space-y-2">
          {notices.map((msg) => (
            <li key={msg.id} className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-slate-700">
              {msg.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UpcomingTasks({ tasks }: { tasks: Task[] }) {
  const todayStr = today();
  const nextWeekStr = nextWeek();
  const upcoming = tasks.filter(
    (t) =>
      t.startDate &&
      t.startDate >= todayStr &&
      t.startDate <= nextWeekStr &&
      t.status !== "done",
  );
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">今後1週間の工程予定</h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-400">今後1週間の予定はありません</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {t.startDate ? formatDate(t.startDate) : "—"}
              </span>
              <span className="text-sm text-slate-700">{t.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowIndicator({ stage }: { stage: ProjectStage | null }) {
  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">プロジェクトフロー</h3>
      <div className="flex flex-wrap gap-1">
        {STAGE_ORDER.map((s, i) => {
          const isDone = currentIndex > i;
          const isCurrent = currentIndex === i;
          return (
            <div key={s} className="flex items-center">
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium",
                  isCurrent
                    ? "bg-blue-600 text-white"
                    : isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400",
                ].join(" ")}
              >
                {getStageLabel(s)}
              </span>
              {i < STAGE_ORDER.length - 1 && (
                <span className="mx-1 text-xs text-slate-300">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChangeOrderSection({ projectId }: { projectId: string }) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  useEffect(() => {
    setRequests(getChangeRequests(projectId).filter((r) => r.status === "施主確認中"));
  }, [projectId]);

  function handleApprove(id: string) {
    updateChangeRequest(id, { status: "承認済", approvedAt: new Date().toISOString() });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  function handleReject(id: string) {
    updateChangeRequest(id, { status: "却下" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  if (requests.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-amber-800">承認待ちの変更指示</h3>
      <ul className="space-y-3">
        {requests.map((req) => (
          <li key={req.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-sm font-medium text-slate-800">{req.description}</p>
            <p className="mb-2 text-xs text-slate-500">{req.impactDescription}</p>
            <p className="mb-3 text-sm font-semibold text-amber-700">
              追加費用: ¥{req.costDifference.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(req.id)}
                className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white"
              >
                承認する
              </button>
              <button
                onClick={() => handleReject(req.id)}
                className="flex-1 rounded-xl bg-red-100 py-2 text-sm font-semibold text-red-600"
              >
                却下する
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommentForm({ projectId }: { projectId: string }) {
  const STORAGE_KEY = `client-comments-${projectId}`;
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const next = [
      ...submitted,
      `[${new Date().toLocaleDateString("ja-JP")}] ${comment.trim()}`,
    ];
    setSubmitted(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setComment("");
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">施主コメント</h3>
      {submitted.length > 0 && (
        <ul className="mb-3 space-y-2">
          {submitted.map((c, i) => (
            <li key={i} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {c}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="現場への質問・ご要望をどうぞ"
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={!comment.trim()}
          className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          送信する
        </button>
      </form>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ClientViewerPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projRepo = createProjectRepository();
    const taskRepo = createTaskRepository();
    Promise.all([projRepo.findById(projectId), taskRepo.findAll(projectId)]).then(
      ([p, t]) => {
        setProject(p ?? null);
        setTasks(t);
        setLoading(false);
      },
    );
  }, [projectId]);

  const progress = useMemo(() => calcProgress(tasks), [tasks]);

  const todayNotices = useMemo<ChatMessage[]>(() => {
    const msgs = getMessages(projectId);
    const todayStr = today();
    return msgs.filter(
      (m) => m.type === "notice" && m.timestamp.startsWith(todayStr),
    );
  }, [projectId]);

  const allPhotos = useMemo<string[]>(() => {
    const urls: string[] = [];
    for (const t of tasks) {
      if (t.photoUrls) urls.push(...t.photoUrls);
    }
    return urls.reverse();
  }, [tasks]);

  const currentStage = useMemo<ProjectStage | null>(() => {
    if (!project) return null;
    // Infer stage from project status + task progress
    if (project.status === "completed") return "completed";
    if (project.status === "active") return "construction";
    if (project.status === "planning") return "contract";
    return null;
  }, [project]);

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
        <p className="text-sm text-slate-500">プロジェクトが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-600">
            施主ポータル
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{project.name}</h1>
          {project.address && (
            <p className="mt-0.5 text-xs text-slate-500">{project.address}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">読み取り専用</p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-xl px-4 py-6">
        <ProgressBar value={progress} />
        <FlowIndicator stage={currentStage} />
        <TodayWork notices={todayNotices} />
        <UpcomingTasks tasks={tasks} />
        {allPhotos.length > 0 && <PhotoGallery photos={allPhotos} />}
        <ChangeOrderSection projectId={projectId} />
        <CommentForm projectId={projectId} />
      </main>
    </div>
  );
}
