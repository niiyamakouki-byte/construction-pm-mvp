/**
 * OwnerAppPage — 施主専用 PWA ダッシュボード
 * URL: /#/owner-app/:projectId?token=XXX
 *
 * v2-cozy デザイン: セージグリーン #6B8E5A 軸、装飾最小
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { validateShareToken } from "../lib/owner-app/share-token.js";
import { ownerStore } from "../lib/owner-app/owner-store.js";
import type {
  ChangeRequest,
  ChangeRequestStatus,
  OwnerDashboardSnapshot,
  OwnerMessage,
  OwnerSession,
} from "../lib/owner-app/types.js";
import { buildOwnerSnapshot } from "../lib/owner-app/snapshot-builder.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createPhotoStore } from "../stores/photo-store.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function statusLabel(s: ChangeRequestStatus): string {
  const map: Record<ChangeRequestStatus, string> = {
    pending: "申請中",
    reviewing: "確認中",
    approved: "承認済",
    rejected: "却下",
  };
  return map[s] ?? s;
}

function statusColor(s: ChangeRequestStatus): string {
  if (s === "approved") return "#6B8E5A";
  if (s === "rejected") return "#C53030";
  return "#9ca3af";
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressHeader({
  projectName,
  progress,
  phase,
}: {
  projectName: string;
  progress: number;
  phase: string;
}) {
  return (
    <header
      style={{ background: "#6B8E5A" }}
      className="px-4 py-4 text-white"
    >
      <div className="mx-auto max-w-4xl">
        <p className="text-xs opacity-70">施主ダッシュボード</p>
        <h1 className="text-lg font-bold">{projectName}</h1>
        <p className="mt-1 text-xs opacity-80">現フェーズ: {phase}</p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span>全体進捗</span>
            <span className="font-bold text-base">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function GanttMini({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<
    Array<{ id: string; title: string; startDate: string; endDate: string; status: string }>
  >([]);

  useEffect(() => {
    import("../lib/project-tasks-store.js").then(({ fetchProjectTasks }) => {
      fetchProjectTasks(projectId).then((all) => {
        const today = todayIso();
        const d7 = new Date();
        d7.setDate(d7.getDate() + 7);
        const next7 = d7.toISOString().split("T")[0];
        const visible = all
          .filter((t) => t.endDate >= today && t.startDate <= next7)
          .slice(0, 10);
        setTasks(visible);
      });
    });
  }, [projectId]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">今週の工程</h2>
        <p className="text-xs text-slate-400">予定なし</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">今週の工程</h2>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{
                background:
                  t.status === "done"
                    ? "#6B8E5A"
                    : t.status === "in_progress"
                    ? "#f59e0b"
                    : "#d1d5db",
              }}
            />
            <span className="flex-1 truncate text-slate-700">{t.title}</span>
            <span className="text-slate-400 shrink-0">
              {t.startDate.slice(5)} – {t.endDate.slice(5)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: string[] }) {
  const [enlarged, setEnlarged] = useState<string | null>(null);

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">今日の写真</h2>
        <p className="text-xs text-slate-400">本日の写真はありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">今日の写真</h2>
      <div className="grid grid-cols-3 gap-1">
        {photos.slice(0, 6).map((url, i) => (
          <button
            key={i}
            onClick={() => setEnlarged(url)}
            className="aspect-square overflow-hidden rounded-lg bg-slate-100"
          >
            <img
              src={url}
              alt={`現場写真 ${i + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setEnlarged(null)}
        >
          <img
            src={enlarged}
            alt="拡大写真"
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  projectId,
  messages,
  onSend,
}: {
  projectId: string;
  messages: OwnerMessage[];
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleSend() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 flex flex-col" style={{ minHeight: "220px" }}>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">チャット</h2>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3" style={{ maxHeight: "240px" }}>
        {messages.length === 0 && (
          <p className="text-xs text-slate-400">メッセージはありません</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === "owner" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                m.sender === "owner"
                  ? "text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
              style={m.sender === "owner" ? { background: "#6B8E5A" } : undefined}
            >
              <p>{m.text}</p>
              <p className="mt-0.5 text-[10px] opacity-60">{formatTs(m.ts)}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1"
          style={{ "--tw-ring-color": "#6B8E5A" } as React.CSSProperties}
          placeholder="メッセージを入力"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="rounded-lg px-3 py-2 text-xs text-white disabled:opacity-40"
          style={{ background: "#6B8E5A" }}
        >
          送信
        </button>
      </div>
    </div>
  );
}

function ChangeRequestModal({
  projectId,
  onClose,
  onSubmit,
}: {
  projectId: string;
  onClose: () => void;
  onSubmit: (req: { title: string; body: string; photo_urls: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), body: body.trim(), photo_urls: [] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-base font-bold text-slate-800 mb-4">変更要望を提出</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ "--tw-ring-color": "#6B8E5A" } as React.CSSProperties}
              placeholder="例: 床材の変更希望"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              詳細
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 resize-none"
              style={{ "--tw-ring-color": "#6B8E5A" } as React.CSSProperties}
              placeholder="変更内容を具体的に記載してください"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm text-white"
            style={{ background: "#6B8E5A" }}
          >
            提出
          </button>
        </div>
      </form>
    </div>
  );
}

function ChangeRequestList({
  requests,
  onNew,
}: {
  requests: ChangeRequest[];
  onNew: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">変更要望</h2>
        <button
          onClick={onNew}
          className="rounded-lg px-3 py-1 text-xs text-white"
          style={{ background: "#6B8E5A" }}
        >
          + 新規要望
        </button>
      </div>
      {requests.length === 0 ? (
        <p className="text-xs text-slate-400">要望はありません</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700 truncate flex-1">{r.title}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] text-white shrink-0"
                  style={{ background: statusColor(r.status) }}
                >
                  {statusLabel(r.status)}
                </span>
              </div>
              {r.body && (
                <p className="mt-1 text-slate-500 line-clamp-2">{r.body}</p>
              )}
              {r.estimated_cost !== undefined && (
                <p className="mt-1 text-slate-500">
                  概算: ¥{r.estimated_cost.toLocaleString()}
                </p>
              )}
              <p className="mt-1 text-slate-400">{formatTs(r.ts)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  projectId: string;
  token: string;
};

export function OwnerAppPage({ projectId, token }: Props) {
  const [session, setSession] = useState<OwnerSession | null | "loading">(
    "loading",
  );
  const [snapshot, setSnapshot] = useState<OwnerDashboardSnapshot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [localMessages, setLocalMessages] = useState<OwnerMessage[]>([]);
  const [localRequests, setLocalRequests] = useState<ChangeRequest[]>([]);

  // Validate token
  useEffect(() => {
    const s = validateShareToken(token);
    if (!s || s.projectId !== projectId) {
      setSession(null);
      return;
    }
    setSession(s);
  }, [token, projectId]);

  // Load snapshot
  useEffect(() => {
    if (!session || session === "loading") return;

    async function load() {
      const projectRepo = createProjectRepository();
      const project = await projectRepo.findById(projectId);
      const projectName = project?.name ?? projectId;

      // Load photos for today
      let todaysPhotos: string[] = [];
      try {
        const photoStore = createPhotoStore();
        const photos = await photoStore.listPhotosByProject(projectId);
        const today = todayIso();
        todaysPhotos = photos
          .filter((p) => p.takenAt.startsWith(today))
          .map((p) => p.url)
          .slice(0, 6);
      } catch {
        // photo store may be unavailable in test/offline env
      }

      const snap = await buildOwnerSnapshot(projectId, projectName, todaysPhotos);
      setSnapshot(snap);
      setLocalMessages(snap.recentMessages);
      setLocalRequests([
        ...ownerStore.getSnapshot(projectId).requests,
      ]);
    }

    load();
  }, [session, projectId]);

  // Listen for owner-store changes
  useEffect(() => {
    function onChange() {
      const { messages, requests } = ownerStore.getSnapshot(projectId);
      setLocalMessages(messages.slice(-10));
      setLocalRequests(requests);
    }
    ownerStore.addEventListener("change", onChange);
    return () => ownerStore.removeEventListener("change", onChange);
  }, [projectId]);

  function handleSendMessage(text: string) {
    const msg: OwnerMessage = {
      id: `owner-msg-${Date.now()}`,
      sender: "owner",
      text,
      ts: new Date().toISOString(),
    };
    ownerStore.addMessage(projectId, msg);
  }

  function handleSubmitRequest(req: {
    title: string;
    body: string;
    photo_urls: string[];
  }) {
    const cr: ChangeRequest = {
      id: `cr-${Date.now()}`,
      projectId,
      title: req.title,
      body: req.body,
      photo_urls: req.photo_urls,
      status: "pending",
      ts: new Date().toISOString(),
    };
    ownerStore.submitChangeRequest(projectId, cr);
  }

  if (session === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">
        読み込み中...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-lg font-bold text-slate-800">アクセスできません</h1>
          <p className="mt-2 text-sm text-slate-500">
            リンクが無効か期限切れです。担当者にご確認ください。
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">
        データを読み込んでいます...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ProgressHeader
        projectName={snapshot.projectName}
        progress={snapshot.overallProgress}
        phase={snapshot.currentPhase}
      />

      <main className="mx-auto max-w-4xl px-3 py-4">
        {/* CSS Grid layout: left = gantt, right = photos/chat/requests */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          {/* Left: Gantt mini */}
          <div className="flex flex-col gap-4">
            <GanttMini projectId={projectId} />
          </div>

          {/* Right: Photos + Chat + Requests */}
          <div className="flex flex-col gap-4">
            <PhotoGallery photos={snapshot.todaysPhotos} />
            <ChatPanel
              projectId={projectId}
              messages={localMessages}
              onSend={handleSendMessage}
            />
            <ChangeRequestList
              requests={localRequests}
              onNew={() => setShowModal(true)}
            />
          </div>
        </div>
      </main>

      {showModal && (
        <ChangeRequestModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitRequest}
        />
      )}
    </div>
  );
}
