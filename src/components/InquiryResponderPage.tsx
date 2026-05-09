/**
 * InquiryResponderPage — 問合せ→初回返信AI ダッシュボード (Sprint 16-A)
 *
 * v2-cozy: セージ #6B8E5A / danger のみ #C53030
 */

import { useMemo, useState } from "react";
import { InquiryStore } from "../lib/inquiry-responder/inquiry-store.js";
import { priorityLabel } from "../lib/inquiry-responder/inquiry-triage.js";
import type {
  InquiryRecord,
  InquiryChannel,
  InquiryStatus,
  InquiryPriority,
  WorkCategory,
} from "../lib/inquiry-responder/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

const CHANNEL_LABEL: Record<InquiryChannel, string> = {
  hp_form: "HP",
  line: "LINE",
  discord: "Discord",
  email: "メール",
  phone_memo: "電話",
};

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "新規",
  triaged: "分類済",
  replied: "返信済",
  scheduled: "予約済",
  closed_won: "受注",
  closed_lost: "失注",
};

const STATUS_COLOR: Record<InquiryStatus, string> = {
  new: SAGE_GREEN,
  triaged: "#3b82f6",
  replied: "#f59e0b",
  scheduled: "#a855f7",
  closed_won: "#6B8E5A",
  closed_lost: "#94a3b8",
};

const PRIORITY_COLOR: Record<InquiryPriority, string> = {
  urgent: DANGER_RED,
  high: "#f97316",
  medium: "#f59e0b",
  normal: "#94a3b8",
};

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  kitchen: "キッチン",
  bath: "浴室",
  store_fit: "店舗",
  office_fit: "オフィス",
  full_renovation: "全面リノベ",
  partial_renovation: "部分改装",
  exterior: "外装",
  repair: "補修",
  other: "その他",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color: danger ? DANGER_RED : SAGE_GREEN }}
        data-testid={`kpi-${label}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: STATUS_COLOR[status] }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: InquiryPriority }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: PRIORITY_COLOR[priority] }}
    >
      {priorityLabel(priority)}
    </span>
  );
}

function formatJpy(yen: number): string {
  if (yen >= 100_000_000) return `${(yen / 100_000_000).toFixed(1)}億円`;
  return `${Math.round(yen / 10_000)}万円`;
}

// ── Draft Modal ────────────────────────────────────────────────────────────

function DraftModal({
  record,
  onClose,
}: {
  record: InquiryRecord;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="font-semibold text-slate-800">返信ドラフト</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            閉じる
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
            {record.draftReplyJa}
          </pre>
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="text-xs text-slate-500">
            候補日:{" "}
            {record.proposedSlots
              .slice(0, 3)
              .map((s) => s.note_ja)
              .join(" / ")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type ChannelFilter = InquiryChannel | "all";
type StatusFilter = InquiryStatus | "all";

const ALL_CHANNELS: ChannelFilter[] = ["all", "hp_form", "line", "discord", "email", "phone_memo"];
const ALL_STATUSES: StatusFilter[] = ["all", "new", "triaged", "replied", "scheduled", "closed_won", "closed_lost"];

export function InquiryResponderPage() {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedRecord, setSelectedRecord] = useState<InquiryRecord | null>(null);

  const storeInstance = useMemo(() => {
    const s = new InquiryStore();
    s.ensureSeed();
    return s;
  }, []);

  const records = useMemo(() => storeInstance.all(), [storeInstance]);

  // KPIs
  const newCount = records.filter((r) => r.status === "new" || r.status === "triaged").length;
  const pendingReply = records.filter((r) => r.status === "new" || r.status === "triaged").length;
  const urgentCount = records.filter((r) => r.priority === "urgent" || r.priority === "high").length;
  const closedWon = records.filter((r) => r.status === "closed_won").length;

  // Filter
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (channelFilter !== "all" && r.channel !== channelFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [records, channelFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">問合せ→初回返信AI</h1>
        <p className="mt-1 text-sm text-slate-500">
          HP/LINE/Discord/メール経由の施主問合せを自動トリアージし、概算見積と候補日付きの一次返信ドラフトを生成します
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="新規問合せ数" value={`${newCount}件`} />
        <KpiCard label="返信待ち数" value={`${pendingReply}件`} danger={pendingReply > 5} />
        <KpiCard label="今週成約見込み" value={`${closedWon}件`} />
        <KpiCard label="要対応 (至急/高)" value={`${urgentCount}件`} danger={urgentCount > 0} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">チャンネル:</span>
        {ALL_CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: channelFilter === ch ? SAGE_GREEN : "white",
              color: channelFilter === ch ? "white" : "#475569",
              borderColor: channelFilter === ch ? SAGE_GREEN : "#e2e8f0",
            }}
          >
            {ch === "all" ? "全て" : CHANNEL_LABEL[ch]}
          </button>
        ))}
        <span className="ml-4 text-sm text-slate-600">状態:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "全て" : STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-slate-600">受付#</th>
              <th className="px-3 py-3 text-left font-medium text-slate-600">顧客</th>
              <th className="px-3 py-3 text-left font-medium text-slate-600">CH</th>
              <th className="px-3 py-3 text-left font-medium text-slate-600">カテゴリ</th>
              <th className="px-3 py-3 text-right font-medium text-slate-600">概算レンジ</th>
              <th className="px-3 py-3 text-left font-medium text-slate-600">優先度</th>
              <th className="px-3 py-3 text-left font-medium text-slate-600">状態</th>
              <th className="px-3 py-3 text-left font-medium text-slate-600">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((record, idx) => (
              <tr key={record.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 tabular-nums text-slate-500 text-xs">
                  #{String(idx + 1).padStart(4, "0")}
                </td>
                <td className="px-3 py-3 font-medium text-slate-800">
                  {record.customerName ?? "—"}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {CHANNEL_LABEL[record.channel]}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {CATEGORY_LABEL[record.extractedRequirements.workCategory]}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                  {formatJpy(record.estimatedRangeJpy.lowerJpy)}〜{formatJpy(record.estimatedRangeJpy.upperJpy)}
                </td>
                <td className="px-3 py-3">
                  <PriorityBadge priority={record.priority} />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => setSelectedRecord(record)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-white transition-colors"
                    style={{ background: SAGE_GREEN }}
                  >
                    返信ドラフト
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  該当する問合せがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Draft Modal */}
      {selectedRecord && (
        <DraftModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}
