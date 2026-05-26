/**
 * SiteLivestreamPage — 現場ライブストリーム共有ダッシュボード (Sprint 18-B)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type {
  LivestreamSession,
  LivestreamPost,
  StreamChannelKind,
  NotificationMethod,
  DigestFrequency,
  OwnerNotificationPreference,
} from "../lib/site-livestream/types.js";
import {
  CHANNEL_KIND_LABELS,
  POST_STATUS_LABELS,
  POSTED_BY_ROLE_LABELS,
  NOTIFICATION_METHOD_LABELS,
  DIGEST_FREQUENCY_LABELS,
} from "../lib/site-livestream/types.js";
import { livestreamStore } from "../lib/site-livestream/livestream-store.js";
import {
  createSession,
  addPost,
  markPostPublished,
  archivePost,
  listAllSessions,
} from "../lib/site-livestream/livestream-facade.js";
import { extractHighlights } from "../lib/site-livestream/highlight-extractor.js";
import {
  pendingLivestreamReviews,
  livestreamPostsThisWeek,
  avgDailyEngagement,
  mostActiveChannelKind,
} from "../lib/site-livestream/portfolio-livestream-metrics.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const CHANNEL_TABS: StreamChannelKind[] = [
  "live_broadcast",
  "fixed_camera",
  "recorded_highlight",
  "milestone_summary",
];

const NOTIFICATION_OPTIONS: NotificationMethod[] = ["email", "discord", "line", "push"];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  return `${Math.round(sec / 60)}分`;
}

function postStatusColor(status: LivestreamPost["status"]): string {
  if (status === "published") return SAGE;
  if (status === "flagged") return DANGER;
  if (status === "archived") return "#6b7280";
  return "#d97706";
}

function newPostId(): string {
  return `post-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: SAGE }}>{value}</div>
    </div>
  );
}

function PostCard({
  post,
  onPublish,
  onArchive,
}: {
  post: LivestreamPost;
  onPublish: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const highlights = extractHighlights(post);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span
            style={{
              fontSize: 11,
              background: "#f0f4ee",
              color: SAGE,
              borderRadius: 4,
              padding: "2px 8px",
              marginRight: 8,
            }}
          >
            {CHANNEL_KIND_LABELS[post.channelKind]}
          </span>
          <span style={{ fontSize: 11, color: postStatusColor(post.status) }}>
            {POST_STATUS_LABELS[post.status]}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {new Date(post.capturedAt).toLocaleDateString("ja-JP")}
        </span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{post.title}</div>
      {post.description && (
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{post.description}</div>
      )}

      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        {POSTED_BY_ROLE_LABELS[post.postedByRole]}・{post.postedByName}
        {post.durationSec != null && ` · ${formatSeconds(post.durationSec)}`}
        {" · "}視聴 {post.viewCount}回
      </div>

      {post.autoCaptionsJa && (
        <div
          style={{
            fontSize: 12,
            color: "#374151",
            background: "#f9fafb",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 10,
            borderLeft: `3px solid ${SAGE}`,
          }}
        >
          {post.autoCaptionsJa}
        </div>
      )}

      {highlights.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>ハイライトクリップ</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {highlights.map((clip) => (
              <span
                key={clip.id}
                style={{
                  fontSize: 11,
                  background: "#eff6eb",
                  color: SAGE,
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {clip.captionJa} ({clip.startSec}s〜{clip.endSec}s)
              </span>
            ))}
          </div>
        </div>
      )}

      {post.status === "pending_review" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => onPublish(post.id)}
            style={{
              fontSize: 12,
              background: SAGE,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            公開する
          </button>
          <button
            type="button"
            onClick={() => onArchive(post.id)}
            style={{
              fontSize: 12,
              background: "#f3f4f6",
              color: "#374151",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            アーカイブ
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SiteLivestreamPage() {
  const [sessions, setSessions] = useState<LivestreamSession[]>([]);
  const [activeChannel, setActiveChannel] = useState<StreamChannelKind>("recorded_highlight");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formMediaKind, setFormMediaKind] = useState<LivestreamPost["mediaKind"]>("video");
  const [formMediaUrl, setFormMediaUrl] = useState("");
  const [formPostedBy, setFormPostedBy] = useState("");
  const [formPostedByRole, setFormPostedByRole] = useState<LivestreamPost["postedByRole"]>("supervisor");

  // Session creation form
  const [showNewSession, setShowNewSession] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [notifChannels, setNotifChannels] = useState<NotificationMethod[]>(["email"]);
  const [digestFreq, setDigestFreq] = useState<DigestFrequency>("immediate");
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");

  const reload = useCallback(() => {
    setSessions(listAllSessions());
  }, []);

  useEffect(() => {
    reload();
    const unsubscribe = livestreamStore.subscribe(() => reload());
    return unsubscribe;
  }, [reload]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;

  const filteredPosts = activeSession?.posts.filter(
    (p) => p.channelKind === activeChannel,
  ) ?? [];

  // KPI
  const kpiPending = pendingLivestreamReviews();
  const kpiWeek = livestreamPostsThisWeek();
  const kpiEngagement = avgDailyEngagement();
  const kpiTopChannel = mostActiveChannelKind();

  function handleCreateSession() {
    if (!newOwnerName.trim() || !newProjectId.trim()) return;
    const prefs: OwnerNotificationPreference = {
      ownerName: newOwnerName,
      projectId: newProjectId,
      channels: notifChannels,
      digestFrequency: digestFreq,
      quietHours: { start: quietStart, end: quietEnd },
    };
    createSession(newProjectId, newOwnerName, prefs);
    setShowNewSession(false);
    setNewOwnerName("");
    setNewProjectId("");
    reload();
  }

  function handleAddPost() {
    if (!activeSession || !formTitle.trim()) return;
    const post: LivestreamPost = {
      id: newPostId(),
      projectId: activeSession.projectId,
      channelKind: activeChannel,
      postedByName: formPostedBy || "匿名",
      postedByRole: formPostedByRole,
      title: formTitle.trim(),
      description: formDescription.trim(),
      mediaKind: formMediaKind,
      mediaUrl: formMediaUrl.trim() || undefined,
      durationSec: formDuration ? parseInt(formDuration, 10) : undefined,
      capturedAt: new Date().toISOString(),
      status: "pending_review",
      autoCaptionsJa: "",
      ownerNotificationSent: false,
      viewCount: 0,
    };
    addPost(activeSession.id, post);
    setFormTitle("");
    setFormDescription("");
    setFormDuration("");
    setFormMediaUrl("");
    setFormPostedBy("");
  }

  function handlePublish(postId: string) {
    if (!activeSession) return;
    markPostPublished(activeSession.id, postId);
  }

  function handleArchive(postId: string) {
    if (!activeSession) return;
    archivePost(activeSession.id, postId);
  }

  function toggleNotifChannel(method: NotificationMethod) {
    setNotifChannels((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
          現場ライブストリーム共有
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          施主が遠隔から現場の進捗をリアルタイムで確認できます
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard label="審査待ち投稿" value={kpiPending} />
        <KpiCard label="今週の投稿" value={kpiWeek} />
        <KpiCard label="日平均視聴数" value={kpiEngagement} />
        <KpiCard
          label="最多チャネル"
          value={kpiTopChannel ? CHANNEL_KIND_LABELS[kpiTopChannel] : "—"}
        />
      </div>

      {/* Session selector */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={activeSessionId ?? ""}
          onChange={(e) => setActiveSessionId(e.target.value || null)}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 14,
            background: "#fff",
          }}
        >
          {sessions.length === 0 && <option value="">— セッションなし —</option>}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ownerName} / {s.projectId}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNewSession((v) => !v)}
          style={{
            fontSize: 13,
            background: showNewSession ? "#f3f4f6" : SAGE,
            color: showNewSession ? "#374151" : "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          {showNewSession ? "キャンセル" : "+ 新規セッション"}
        </button>
      </div>

      {/* New session form */}
      {showNewSession && (
        <div
          style={{
            border: `1px solid ${SAGE}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            background: "#f9fdf8",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12 }}>新規セッション作成</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>施主名</label>
              <input
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                placeholder="例: 田中様"
                style={{ display: "block", width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>プロジェクトID</label>
              <input
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                placeholder="例: proj-001"
                style={{ display: "block", width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>通知方法</div>
            <div style={{ display: "flex", gap: 8 }}>
              {NOTIFICATION_OPTIONS.map((m) => (
                <label key={m} style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={notifChannels.includes(m)}
                    onChange={() => toggleNotifChannel(m)}
                  />
                  {NOTIFICATION_METHOD_LABELS[m]}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>配信頻度</label>
              <select
                value={digestFreq}
                onChange={(e) => setDigestFreq(e.target.value as DigestFrequency)}
                style={{ display: "block", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14 }}
              >
                {(["immediate", "daily", "weekly"] as DigestFrequency[]).map((f) => (
                  <option key={f} value={f}>{DIGEST_FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>通知停止 (開始)</label>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                style={{ display: "block", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>通知停止 (終了)</label>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                style={{ display: "block", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14 }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateSession}
            disabled={!newOwnerName.trim() || !newProjectId.trim()}
            style={{
              background: SAGE,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 20px",
              fontSize: 14,
              cursor: "pointer",
              opacity: !newOwnerName.trim() || !newProjectId.trim() ? 0.5 : 1,
            }}
          >
            作成する
          </button>
        </div>
      )}

      {activeSession && (
        <>
          {/* Channel tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
            {CHANNEL_TABS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setActiveChannel(ch)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: activeChannel === ch ? `2px solid ${SAGE}` : "2px solid transparent",
                  color: activeChannel === ch ? SAGE : "#6b7280",
                  fontWeight: activeChannel === ch ? 700 : 400,
                  fontSize: 14,
                  padding: "8px 16px",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {CHANNEL_KIND_LABELS[ch]}
              </button>
            ))}
          </div>

          {/* Post form */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>新規投稿</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>タイトル *</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="例: 解体作業の進捗"
                  style={{ display: "block", width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>投稿者名</label>
                <input
                  value={formPostedBy}
                  onChange={(e) => setFormPostedBy(e.target.value)}
                  placeholder="例: 田中"
                  style={{ display: "block", width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#6b7280" }}>説明</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="作業内容の詳細..."
                rows={2}
                style={{ display: "block", width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, boxSizing: "border-box", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>ロール</label>
                <select
                  value={formPostedByRole}
                  onChange={(e) => setFormPostedByRole(e.target.value as LivestreamPost["postedByRole"])}
                  style={{ display: "block", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14 }}
                >
                  {(["craftsman", "supervisor", "site_manager"] as const).map((r) => (
                    <option key={r} value={r}>{POSTED_BY_ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>メディア種別</label>
                <select
                  value={formMediaKind}
                  onChange={(e) => setFormMediaKind(e.target.value as LivestreamPost["mediaKind"])}
                  style={{ display: "block", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14 }}
                >
                  <option value="video">動画</option>
                  <option value="photo_burst">写真バースト</option>
                  <option value="live_url">ライブURL</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>長さ（秒）</label>
                <input
                  type="number"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="例: 300"
                  min={1}
                  style={{ display: "block", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, width: 100 }}
                />
              </div>
            </div>
            {formMediaKind === "live_url" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#6b7280" }}>ライブURL (https://)</label>
                <input
                  value={formMediaUrl}
                  onChange={(e) => setFormMediaUrl(e.target.value)}
                  placeholder="https://example.com/live"
                  style={{ display: "block", width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 10px", marginTop: 4, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleAddPost}
              disabled={!formTitle.trim()}
              style={{
                background: SAGE,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 20px",
                fontSize: 14,
                cursor: "pointer",
                opacity: !formTitle.trim() ? 0.5 : 1,
              }}
            >
              投稿する
            </button>
          </div>

          {/* Post list */}
          <div>
            {filteredPosts.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", padding: 32, fontSize: 14 }}>
                このチャネルにはまだ投稿がありません
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPublish={handlePublish}
                  onArchive={handleArchive}
                />
              ))
            )}
          </div>

          {/* Session info */}
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: "#f9fafb",
              borderRadius: 8,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <span style={{ fontWeight: 600 }}>セッション情報</span>
            {" — "}
            施主: {activeSession.ownerName}
            {" · "}合計時間: {formatSeconds(activeSession.totalDurationSec)}
            {" · "}最終活動: {new Date(activeSession.lastActivityAt).toLocaleString("ja-JP")}
          </div>
        </>
      )}

      {sessions.length === 0 && !showNewSession && (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            color: "#9ca3af",
            border: "2px dashed #e5e7eb",
            borderRadius: 12,
            fontSize: 14,
          }}
        >
          セッションがありません。「+ 新規セッション」から開始してください。
        </div>
      )}
    </div>
  );
}
