/**
 * LongtermFollowupPage — 長期フォローアップダッシュボード (Sprint 19-A)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type {
  FollowupSchedule,
  FollowupCheckpoint,
  RenovationLead,
  LeadPotential,
  CheckpointStatus,
} from "../lib/longterm-followup/types.js";
import {
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_STATUS_LABELS,
  LEAD_POTENTIAL_LABELS,
} from "../lib/longterm-followup/types.js";
import { followupStore } from "../lib/longterm-followup/followup-store.js";
import {
  registerFollowup,
  listSchedules,
  listCheckpoints,
  getUpcomingCheckpoints,
  getActiveLeadsByPotential,
  listAllLeads,
  markReminderSent,
  markDiagnosisSent,
  submitDiagnosisResponse,
} from "../lib/longterm-followup/followup-facade.js";
import {
  activeFollowupSchedules,
  upcomingCheckpointsNext30Days,
  urgentRenovationLeadsCount,
  avgDegradationScoreByYear,
} from "../lib/longterm-followup/portfolio-followup-metrics.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const POTENTIAL_COLORS: Record<LeadPotential, string> = {
  low: "#9ca3af",
  medium: "#f59e0b",
  high: "#d97706",
  urgent: DANGER,
};

const STATUS_COLOR: Record<CheckpointStatus, string> = {
  scheduled: "#9ca3af",
  reminder_sent: "#3b82f6",
  diagnosis_sent: "#8b5cf6",
  completed: SAGE,
  skipped: "#6b7280",
};

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit = "",
  color = SAGE,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "12px 16px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Schedule row ───────────────────────────────────────────────────────────

function ScheduleRow({ schedule }: { schedule: FollowupSchedule }) {
  const checkpoints = listCheckpoints(schedule.id);
  const next = checkpoints.find(
    (cp) => cp.status !== "completed" && cp.status !== "skipped",
  );

  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{schedule.projectId}</td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{schedule.ownerId}</td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {schedule.handoverDate.slice(0, 10)}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {next ? (
          <span>
            {CHECKPOINT_KIND_LABELS[next.kind]}
            <span style={{ color: "#9ca3af", marginLeft: 6, fontSize: 12 }}>
              {next.scheduledDate.slice(0, 10)}
            </span>
          </span>
        ) : (
          <span style={{ color: SAGE }}>全完了</span>
        )}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        <span
          style={{
            background: schedule.isActive ? "#f0fdf4" : "#f9fafb",
            color: schedule.isActive ? SAGE : "#6b7280",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
          }}
        >
          {schedule.isActive ? "アクティブ" : "終了"}
        </span>
      </td>
    </tr>
  );
}

// ── Checkpoint calendar row ────────────────────────────────────────────────

function CheckpointRow({ cp }: { cp: FollowupCheckpoint }) {
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {CHECKPOINT_KIND_LABELS[cp.kind]}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {cp.scheduledDate.slice(0, 10)}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {cp.reminderDate.slice(0, 10)}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {cp.diagnosisDate.slice(0, 10)}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <span
          style={{
            background: `${STATUS_COLOR[cp.status]}22`,
            color: STATUS_COLOR[cp.status],
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
          }}
        >
          {CHECKPOINT_STATUS_LABELS[cp.status]}
        </span>
      </td>
    </tr>
  );
}

// ── Lead row ───────────────────────────────────────────────────────────────

function LeadRow({ lead }: { lead: RenovationLead }) {
  const color = POTENTIAL_COLORS[lead.potential];
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "8px 12px" }}>
        <span
          style={{
            background: `${color}22`,
            color,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {LEAD_POTENTIAL_LABELS[lead.potential]}
        </span>
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{lead.projectId}</td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{lead.overallScore}</td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {lead.recommendedWorkTypes.slice(0, 2).join(" / ")}
        {lead.recommendedWorkTypes.length > 2 && (
          <span style={{ color: "#9ca3af" }}> +{lead.recommendedWorkTypes.length - 2}</span>
        )}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        ¥{(lead.estimatedMinJpy / 10000).toFixed(0)}万〜¥{(lead.estimatedMaxJpy / 10000).toFixed(0)}万
      </td>
      <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
        {lead.proposalTimingJa}
      </td>
    </tr>
  );
}

// ── Register form ──────────────────────────────────────────────────────────

function RegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const [projectId, setProjectId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [handoverDate, setHandoverDate] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!projectId || !ownerId || !handoverDate) return;
      registerFollowup(projectId, ownerId, handoverDate);
      setProjectId("");
      setOwnerId("");
      setHandoverDate("");
      onRegistered();
    },
    [projectId, ownerId, handoverDate, onRegistered],
  );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>案件ID</div>
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="proj-001"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            width: 120,
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>施主ID</div>
        <input
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="owner-001"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            width: 120,
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>引渡日</div>
        <input
          type="date"
          value={handoverDate}
          onChange={(e) => setHandoverDate(e.target.value)}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
          }}
        />
      </div>
      <button
        type="submit"
        style={{
          background: SAGE,
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "7px 16px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        登録
      </button>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function LongtermFollowupPage() {
  const [schedules, setSchedules] = useState<FollowupSchedule[]>([]);
  const [upcomingCps, setUpcomingCps] = useState<FollowupCheckpoint[]>([]);
  const [urgentLeads, setUrgentLeads] = useState<RenovationLead[]>([]);
  const [highLeads, setHighLeads] = useState<RenovationLead[]>([]);
  const [allLeads, setAllLeads] = useState<RenovationLead[]>([]);
  const [kpis, setKpis] = useState({
    active: 0,
    upcoming30: 0,
    urgentCount: 0,
    avgScores: { 1: 0, 3: 0, 5: 0, 10: 0 },
  });
  const [tab, setTab] = useState<"schedules" | "calendar" | "leads" | "diagnosis">("schedules");

  const refresh = useCallback(() => {
    setSchedules(listSchedules());
    setUpcomingCps(getUpcomingCheckpoints(30));
    setUrgentLeads(getActiveLeadsByPotential("urgent"));
    setHighLeads(getActiveLeadsByPotential("high"));
    setAllLeads(listAllLeads());
    setKpis({
      active: activeFollowupSchedules(),
      upcoming30: upcomingCheckpointsNext30Days(),
      urgentCount: urgentRenovationLeadsCount(),
      avgScores: avgDegradationScoreByYear(),
    });
  }, []);

  useEffect(() => {
    refresh();
    return followupStore.subscribe(() => refresh());
  }, [refresh]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? SAGE : "#6b7280",
    borderBottom: active ? `2px solid ${SAGE}` : "2px solid transparent",
    cursor: "pointer",
    background: "none",
    border: "none",
  });

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1f2937", margin: 0 }}>
          長期フォローアップ
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
          引渡後5年/10年点検の自動スケジュール管理 · リフォーム需要の先回り掘り起こし
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard label="アクティブスケジュール" value={kpis.active} unit="件" />
        <KpiCard label="30日以内の点検" value={kpis.upcoming30} unit="件" color="#3b82f6" />
        <KpiCard
          label="緊急リード"
          value={kpis.urgentCount}
          unit="件"
          color={kpis.urgentCount > 0 ? DANGER : "#9ca3af"}
        />
        <KpiCard
          label="劣化スコア(1年)"
          value={kpis.avgScores[1]}
          unit="/100"
          color="#8b5cf6"
        />
        <KpiCard
          label="劣化スコア(5年)"
          value={kpis.avgScores[5]}
          unit="/100"
          color={kpis.avgScores[5] > 60 ? DANGER : "#f59e0b"}
        />
        <KpiCard
          label="劣化スコア(10年)"
          value={kpis.avgScores[10]}
          unit="/100"
          color={kpis.avgScores[10] > 60 ? DANGER : "#f59e0b"}
        />
      </div>

      {/* Register form */}
      <RegisterForm onRegistered={refresh} />

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
        <button style={tabStyle(tab === "schedules")} onClick={() => setTab("schedules")}>
          スケジュール一覧
        </button>
        <button style={tabStyle(tab === "calendar")} onClick={() => setTab("calendar")}>
          30日カレンダー
        </button>
        <button style={tabStyle(tab === "leads")} onClick={() => setTab("leads")}>
          リフォームリード
          {kpis.urgentCount > 0 && (
            <span
              style={{
                background: DANGER,
                color: "#fff",
                borderRadius: 10,
                padding: "1px 6px",
                fontSize: 11,
                marginLeft: 6,
              }}
            >
              {kpis.urgentCount}
            </span>
          )}
        </button>
        <button style={tabStyle(tab === "diagnosis")} onClick={() => setTab("diagnosis")}>
          診断送信ステータス
        </button>
      </div>

      {/* Tab content */}
      {tab === "schedules" && (
        <div>
          {schedules.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>スケジュールがありません</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["案件ID", "施主ID", "引渡日", "次回点検", "状態"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <ScheduleRow key={s.id} schedule={s} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "calendar" && (
        <div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
            直近30日以内に予定されているチェックポイント ({upcomingCps.length}件)
          </p>
          {upcomingCps.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>予定なし</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["種別", "予定日", "リマインダー", "診断送信", "ステータス"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingCps.map((cp) => (
                  <CheckpointRow key={cp.id} cp={cp} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "leads" && (
        <div>
          {allLeads.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>リフォームリードがありません</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["ポテンシャル", "案件ID", "劣化スコア", "推奨工種", "概算金額", "提案タイミング"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          fontSize: 12,
                          color: "#6b7280",
                          textAlign: "left",
                          fontWeight: 600,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[...urgentLeads, ...highLeads, ...allLeads.filter(
                  (l) => l.potential !== "urgent" && l.potential !== "high",
                )].map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "diagnosis" && (
        <div>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
            診断フォーム送信ステータス
          </p>
          {listCheckpoints().length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>チェックポイントがありません</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["種別", "予定日", "診断送信日", "ステータス", "リードID"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#6b7280",
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listCheckpoints()
                  .filter((cp) => cp.status === "diagnosis_sent" || cp.status === "completed")
                  .map((cp) => (
                    <tr key={cp.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>
                        {CHECKPOINT_KIND_LABELS[cp.kind]}
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>
                        {cp.scheduledDate.slice(0, 10)}
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>
                        {cp.diagnosisDate.slice(0, 10)}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            background: `${STATUS_COLOR[cp.status]}22`,
                            color: STATUS_COLOR[cp.status],
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 12,
                          }}
                        >
                          {CHECKPOINT_STATUS_LABELS[cp.status]}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af" }}>
                        {cp.renovationLeadId ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
