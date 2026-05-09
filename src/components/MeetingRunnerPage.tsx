/**
 * MeetingRunnerPage — 工程会議自動進行AI ダッシュボード (Sprint 17-A)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type {
  MeetingSession,
  MeetingKind,
  AgendaItem,
  ActionItem,
  MeetingDistributionFormat,
} from "../lib/meeting-runner/types.js";
import { MEETING_KIND_LABELS, AGENDA_STATUS_LABELS, ACTION_STATUS_LABELS } from "../lib/meeting-runner/types.js";
import { meetingStore } from "../lib/meeting-runner/meeting-store.js";
import {
  createMeetingSession,
  saveMeetingMinutes,
  updateAgendaItemStatus,
  distributeMinutes,
  getProjectOverdueActions,
  getProjectUpcomingActions,
  suggestNextMeeting,
} from "../lib/meeting-runner/meeting-runner-facade.js";
import type { MeetingCandidate } from "../lib/meeting-runner/next-meeting-scheduler.js";
import {
  meetingsThisMonth,
  avgUnresolvedItemsCount,
  mostActiveProjectId,
} from "../lib/meeting-runner/portfolio-meeting-metrics.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const ORDERED_KINDS: MeetingKind[] = [
  "weekly_progress",
  "design_review",
  "subcontractor_briefing",
  "site_walkthrough",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  const dow = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${y}年${m}月${d}日（${dow}）`;
}

function formatDueJa(dueDate: string): string {
  const dt = new Date(dueDate);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-4">
      <div className="text-xs text-slate-400 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function AgendaRow({
  item,
  onStatusChange,
}: {
  item: AgendaItem;
  onStatusChange: (id: string, status: AgendaItem["status"]) => void;
}) {
  const priorityColors: Record<number, string> = {
    1: DANGER,
    2: "#d97706",
    3: "#64748b",
    4: "#94a3b8",
    5: "#cbd5e1",
  };

  const nextStatuses: Array<AgendaItem["status"]> = ["pending", "discussing", "resolved", "deferred"];

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: priorityColors[item.priority] }}
        title={`優先度 ${item.priority}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-700 truncate">{item.title}</div>
        <div className="text-xs text-slate-400">{item.owner} · {item.estimatedMinutes}分</div>
      </div>
      <select
        value={item.status}
        onChange={(e) => onStatusChange(item.id, e.target.value as AgendaItem["status"])}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1"
        style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
      >
        {nextStatuses.map((s) => (
          <option key={s} value={s}>{AGENDA_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const isOverdue = item.status === "overdue";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <div
        className="text-xs font-medium px-1.5 py-0.5 rounded"
        style={{
          background: isOverdue ? "#fef2f2" : "#f0f7ed",
          color: isOverdue ? DANGER : SAGE,
        }}
      >
        {ACTION_STATUS_LABELS[item.status]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-700 truncate">{item.description}</div>
        <div className="text-xs text-slate-400">{item.assignee} · {formatDueJa(item.dueDate)}まで</div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function MeetingRunnerPage() {
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [activeSession, setActiveSession] = useState<MeetingSession | null>(null);
  const [view, setView] = useState<"list" | "active" | "create">("list");

  // Create form state
  const [createProjectId, setCreateProjectId] = useState("proj-001");
  const [createKind, setCreateKind] = useState<MeetingKind>("weekly_progress");
  const [createParticipants, setCreateParticipants] = useState("新山");
  const [createDate, setCreateDate] = useState(todayIso());

  // Minutes input
  const [minutesText, setMinutesText] = useState("");
  const [minutesSaved, setMinutesSaved] = useState(false);

  // Distribution
  const [distFormat, setDistFormat] = useState<MeetingDistributionFormat>("discord");
  const [distPreview, setDistPreview] = useState<string | null>(null);
  const [distCopied, setDistCopied] = useState(false);

  // Next meeting candidates
  const [nextCandidates, setNextCandidates] = useState<MeetingCandidate[]>([]);

  // Metrics
  const [metricsThisMonth, setMetricsThisMonth] = useState(0);
  const [metricsAvgUnresolved, setMetricsAvgUnresolved] = useState(0);
  const [metricsActiveProject, setMetricsActiveProject] = useState<string | null>(null);

  // Overdue / upcoming actions for active project
  const [overdueActions, setOverdueActions] = useState<ActionItem[]>([]);
  const [upcomingActions, setUpcomingActions] = useState<ActionItem[]>([]);

  const refreshSessions = useCallback(() => {
    setSessions(meetingStore.listRecent(50));
    setMetricsThisMonth(meetingsThisMonth());
    setMetricsAvgUnresolved(avgUnresolvedItemsCount());
    setMetricsActiveProject(mostActiveProjectId());
  }, []);

  useEffect(() => {
    refreshSessions();
    const unsub = meetingStore.subscribe(() => refreshSessions());
    return unsub;
  }, [refreshSessions]);

  useEffect(() => {
    if (activeSession) {
      setOverdueActions(getProjectOverdueActions(activeSession.projectId));
      setUpcomingActions(getProjectUpcomingActions(activeSession.projectId));
      setNextCandidates(suggestNextMeeting(activeSession.id as string));
    }
  }, [activeSession]);

  const handleCreate = () => {
    const participants = createParticipants.split(/[,、\n]/).map((p) => p.trim()).filter(Boolean);
    const session = createMeetingSession({
      projectId: createProjectId.trim() || "proj-001",
      scheduledAt: new Date(createDate).toISOString(),
      kind: createKind,
      participants,
    });
    setActiveSession(session);
    setView("active");
    setMinutesText("");
    setMinutesSaved(false);
    setDistPreview(null);
  };

  const handleSaveMinutes = () => {
    if (!activeSession) return;
    const lines = minutesText.split("\n").filter((l) => l.trim());
    const updated = saveMeetingMinutes(activeSession.id as string, lines);
    if (updated) {
      setActiveSession(updated);
      setMinutesSaved(true);
    }
  };

  const handleAgendaStatus = (agendaItemId: string, status: AgendaItem["status"]) => {
    if (!activeSession) return;
    const updated = updateAgendaItemStatus(activeSession.id as string, agendaItemId, status);
    if (updated) setActiveSession(updated);
  };

  const handleDistribute = () => {
    if (!activeSession) return;
    const text = distributeMinutes(activeSession.id as string, distFormat);
    setDistPreview(text);
    setDistCopied(false);
  };

  const handleCopyDist = async () => {
    if (!distPreview) return;
    try {
      await navigator.clipboard.writeText(distPreview);
      setDistCopied(true);
      setTimeout(() => setDistCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">工程会議AI</h1>
          <p className="text-sm text-slate-400 mt-0.5">議題自動生成・議事録・TODO配布</p>
        </div>
        {view !== "create" && (
          <button
            onClick={() => setView("create")}
            className="text-sm font-medium px-4 py-2 rounded-xl text-white"
            style={{ background: SAGE }}
          >
            + 新規会議
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="今月の会議数" value={metricsThisMonth} sub="件" />
        <KpiCard
          label="平均未解決事項"
          value={metricsAvgUnresolved}
          sub="件/回"
        />
        <KpiCard
          label="最多案件"
          value={metricsActiveProject ?? "—"}
          sub="最も会議が多い"
        />
      </div>

      {/* Create form */}
      {view === "create" && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
          <h2 className="font-semibold text-slate-700 text-base">会議の新規作成</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">案件ID</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                value={createProjectId}
                onChange={(e) => setCreateProjectId(e.target.value)}
                placeholder="proj-001"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">会議日</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">会議種別</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
              value={createKind}
              onChange={(e) => setCreateKind(e.target.value as MeetingKind)}
            >
              {ORDERED_KINDS.map((k) => (
                <option key={k} value={k}>{MEETING_KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">参加者（カンマ区切り）</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1"
              style={{ "--tw-ring-color": SAGE } as React.CSSProperties}
              value={createParticipants}
              onChange={(e) => setCreateParticipants(e.target.value)}
              placeholder="新山, 田中, 鈴木"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleCreate}
              className="flex-1 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: SAGE }}
            >
              議題を生成して開始
            </button>
            <button
              onClick={() => setView("list")}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Active session */}
      {view === "active" && activeSession && (
        <div className="space-y-4">
          {/* Session header */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: SAGE }}
          >
            <div className="text-sm opacity-80">{MEETING_KIND_LABELS[activeSession.kind]}</div>
            <div className="font-bold text-lg">{activeSession.projectId}</div>
            <div className="text-sm opacity-80">{formatDateJa(activeSession.scheduledAt)}</div>
            <div className="text-sm opacity-80 mt-1">
              参加者: {activeSession.participants.join("、")}
            </div>
          </div>

          {/* Agenda */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">
              議題 ({activeSession.agendaItems.length}件)
            </h3>
            {activeSession.agendaItems.length === 0 ? (
              <p className="text-sm text-slate-400">議題がありません</p>
            ) : (
              <div>
                {activeSession.agendaItems.map((item) => (
                  <AgendaRow
                    key={item.id}
                    item={item}
                    onStatusChange={handleAgendaStatus}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Previous unresolved summary */}
          {activeSession.agendaItems.filter((i) => i.source === "previous_unresolved").length > 0 && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "#fefce8", color: "#92400e" }}
            >
              前回からの引き継ぎ:{" "}
              {activeSession.agendaItems.filter((i) => i.source === "previous_unresolved").length}件
            </div>
          )}

          {/* Overdue actions */}
          {overdueActions.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <h3
                className="font-semibold text-sm mb-3"
                style={{ color: DANGER }}
              >
                期限超過アクション ({overdueActions.length}件)
              </h3>
              {overdueActions.map((a) => <ActionRow key={a.id} item={a} />)}
            </div>
          )}

          {/* Upcoming actions */}
          {upcomingActions.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">
                期日が近いアクション ({upcomingActions.length}件)
              </h3>
              {upcomingActions.map((a) => <ActionRow key={a.id} item={a} />)}
            </div>
          )}

          {/* Minutes recorder */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">議事録入力</h3>
            <p className="text-xs text-slate-400 mb-2">
              発言を1行ずつ入力 — 「決定」「承認」→決定事項 / 「すること」「担当」→アクション / 「持越し」「保留」→未解決
            </p>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1"
              style={{ minHeight: 120, "--tw-ring-color": SAGE } as React.CSSProperties}
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              placeholder={"外壁材をAパネルに決定\n田中が図面修正をすること\n設備仕様は次回持越し"}
            />
            <button
              onClick={handleSaveMinutes}
              disabled={!minutesText.trim()}
              className="mt-2 w-full py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40"
              style={{ background: SAGE }}
            >
              議事録を保存
            </button>
            {minutesSaved && (
              <p className="text-xs mt-2" style={{ color: SAGE }}>保存しました</p>
            )}
          </div>

          {/* Saved minutes summary */}
          {activeSession.minutes && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-slate-700 text-sm">議事録サマリ</h3>

              {activeSession.minutes.decisions.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">決定事項</div>
                  {activeSession.minutes.decisions.map((d, i) => (
                    <div key={i} className="text-sm text-slate-700 py-1 border-b border-slate-50 last:border-0">
                      · {d}
                    </div>
                  ))}
                </div>
              )}

              {activeSession.minutes.actionItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">アクション</div>
                  {activeSession.minutes.actionItems.map((a) => (
                    <ActionRow key={a.id} item={a} />
                  ))}
                </div>
              )}

              {activeSession.minutes.unresolvedItems.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">次回持越し</div>
                  {activeSession.minutes.unresolvedItems.map((u) => (
                    <div key={u.id} className="text-sm text-slate-700 py-1 border-b border-slate-50 last:border-0">
                      · {u.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Distribution */}
          {activeSession.minutes && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">配布</h3>
              <div className="flex gap-2 mb-3">
                {(["discord", "email_html", "markdown"] as MeetingDistributionFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setDistFormat(f)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                    style={
                      distFormat === f
                        ? { background: SAGE, color: "#fff", borderColor: SAGE }
                        : { borderColor: "#e2e8f0", color: "#64748b" }
                    }
                  >
                    {f === "discord" ? "Discord" : f === "email_html" ? "Email" : "Markdown"}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDistribute}
                className="w-full py-2 rounded-xl text-white text-sm font-medium"
                style={{ background: SAGE }}
              >
                プレビュー生成
              </button>

              {distPreview && (
                <div className="mt-3">
                  <pre className="text-xs bg-slate-50 border border-slate-100 rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap text-slate-600">
                    {distPreview}
                  </pre>
                  <button
                    onClick={handleCopyDist}
                    className="mt-2 w-full py-1.5 rounded-xl border border-slate-200 text-sm text-slate-500"
                  >
                    {distCopied ? "コピー済" : "クリップボードにコピー"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Next meeting suggestions */}
          {nextCandidates.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">次回候補日</h3>
              {nextCandidates.map((c) => (
                <div
                  key={c.scheduledAt}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                >
                  <span className="text-sm text-slate-700">{c.labelJa}</span>
                  {c.isRecommended && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#f0f7ed", color: SAGE }}
                    >
                      推薦
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Back button */}
          <button
            onClick={() => setView("list")}
            className="w-full py-2 rounded-xl border border-slate-200 text-slate-500 text-sm"
          >
            セッション一覧に戻る
          </button>
        </div>
      )}

      {/* Session list */}
      {view === "list" && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <h2 className="font-semibold text-slate-700 text-sm">直近の会議</h2>
          </div>
          {sessions.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              会議がまだありません。「+ 新規会議」から始めてください。
            </div>
          ) : (
            <div>
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session);
                    setMinutesText("");
                    setMinutesSaved(false);
                    setDistPreview(null);
                    setView("active");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: session.minutes ? SAGE : "#94a3b8" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      {MEETING_KIND_LABELS[session.kind]} — {session.projectId}
                    </div>
                    <div className="text-xs text-slate-400">{formatDateJa(session.scheduledAt)}</div>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">
                    {session.agendaItems.length}件の議題
                    {session.minutes && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
                        style={{ background: "#f0f7ed", color: SAGE }}
                      >
                        議事録済
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
