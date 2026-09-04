/**
 * InquiryInboxPage — HP問い合わせ受信箱 (Sprint 10-A)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 基調、装飾最小、スレートグレー文字
 * リスト + 詳細プレビュー + 返信下書き（表示のみ・都度生成）+ ステータス更新
 *
 * データ源: Supabase `inquiries` テーブル（authenticated の SELECT/UPDATE のみ、RLSで強制）。
 * INSERT はサーバー側 (receiveContactSubmissionAndNotify → inquiry-repository.ts, service role)
 * に限定されるため、このページに追加・削除の操作は無い。
 */
import { useState, useCallback, useEffect } from "react";
import {
  listInquiries,
  updateInquiryStatus,
} from "../lib/contact-webhook/inquiry-inbox-repository.js";
import type { InquiryDbRecord, InquiryStatus } from "../lib/contact-webhook/inquiry-inbox-repository.js";
import { generateReplyDraft } from "../lib/contact-webhook/reply-draft-generator.js";
import { formatYen } from "../lib/estimate-assistant/cost-lookup.js";

// ── ステータスラベル ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "新着",
  replied: "返信済み",
  closed: "クローズ",
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  new: "bg-sage-badge text-sage-text border-sage-border",
  replied: "bg-slate-50 text-slate-500 border-slate-200",
  closed: "bg-stone-50 text-stone-400 border-stone-200",
};

// ── フォーマットヘルパー ──────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

// ── サブコンポーネント ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function InquiryListItem({
  record,
  isSelected,
  onClick,
}: {
  record: InquiryDbRecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-stone-100 transition-colors ${
        isSelected ? "bg-[#f0f4ee]" : "hover:bg-stone-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700 truncate">{record.submission.name}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{record.submission.message}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={record.status} />
          <span className="text-[11px] text-slate-400">{formatDate(record.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

function EstimatePanel({ record }: { record: InquiryDbRecord }) {
  const { estimate } = record;
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-600">概算レンジ（税込）</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-white border border-stone-200 py-1.5 px-1">
          <p className="text-[10px] text-slate-400">梅</p>
          <p className="text-xs font-bold text-blue-600 mt-0.5">{formatYen(estimate.taxIncludedLow)}</p>
        </div>
        <div className="rounded bg-white border border-[#6B8E5A]/30 py-1.5 px-1 ring-1 ring-[#6B8E5A]/20">
          <p className="text-[10px] text-slate-400">竹</p>
          <p className="text-xs font-bold text-[#6B8E5A] mt-0.5">{formatYen(estimate.taxIncludedMid)}</p>
        </div>
        <div className="rounded bg-white border border-stone-200 py-1.5 px-1">
          <p className="text-[10px] text-slate-400">松</p>
          <p className="text-xs font-bold text-amber-700 mt-0.5">{formatYen(estimate.taxIncludedHigh)}</p>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  record,
  onStatusChange,
}: {
  record: InquiryDbRecord;
  onStatusChange: (id: string, status: InquiryStatus) => void;
}) {
  // 返信下書きは永続化せず、選択のたびにテンプレートから都度生成する（inquiries テーブルに draft 列は無い）。
  const initialDraft = generateReplyDraft({ submission: record.submission, estimate: record.estimate });
  const [draftSubject, setDraftSubject] = useState(initialDraft.subject);
  const [draftBody, setDraftBody] = useState(initialDraft.body);
  const [copied, setCopied] = useState(false);

  // record が切り替わったら下書きを再生成する
  useEffect(() => {
    const draft = generateReplyDraft({ submission: record.submission, estimate: record.estimate });
    setDraftSubject(draft.subject);
    setDraftBody(draft.body);
  }, [record.id, record.submission, record.estimate]);

  const handleCopy = useCallback(() => {
    const text = `件名: ${draftSubject}\n\n${draftBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [draftSubject, draftBody]);

  const { submission } = record;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ヘッダー */}
      <div className="px-5 py-4 border-b border-stone-200">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-700">{submission.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{submission.email}</p>
            {submission.phone && (
              <p className="text-xs text-slate-400">{submission.phone}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={record.status} />
            <span className="text-xs text-slate-400">{formatDate(record.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        {/* 問い合わせ内容 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">問い合わせ内容</p>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{submission.message}</p>
          </div>
        </div>

        {/* 概算レンジ */}
        <EstimatePanel record={record} />

        {/* 下書き編集 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">返信下書き</p>
          <div className="space-y-2">
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#6B8E5A] bg-white"
              placeholder="件名"
              aria-label="件名"
            />
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#6B8E5A] bg-white resize-y font-mono leading-relaxed"
              placeholder="本文"
              aria-label="本文"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md border border-stone-300 text-slate-500 text-xs font-medium hover:bg-stone-50 transition-colors"
            >
              {copied ? "コピー済み" : "コピー"}
            </button>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
          {record.status !== "replied" && (
            <button
              type="button"
              onClick={() => onStatusChange(record.id, "replied")}
              className="px-3 py-1.5 rounded-md bg-[#6B8E5A] text-white text-xs font-medium hover:bg-[#5a7a4b] transition-colors"
            >
              返信済みにマーク
            </button>
          )}
          {record.status !== "closed" && (
            <button
              type="button"
              onClick={() => onStatusChange(record.id, "closed")}
              className="px-3 py-1.5 rounded-md border border-stone-200 text-slate-400 text-xs font-medium hover:bg-stone-50 transition-colors"
            >
              クローズ
            </button>
          )}
          {record.status === "closed" && (
            <button
              type="button"
              onClick={() => onStatusChange(record.id, "new")}
              className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors"
            >
              再オープン
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: Array<{ value: InquiryStatus | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "new", label: "新着" },
  { value: "replied", label: "返信済み" },
  { value: "closed", label: "クローズ" },
];

export function InquiryInboxPage() {
  const [records, setRecords] = useState<InquiryDbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">("all");

  const selected = records.find((r) => r.id === selectedId) ?? null;

  const filteredRecords =
    statusFilter === "all" ? records : records.filter((r) => r.status === statusFilter);

  const refresh = useCallback(async () => {
    try {
      const latest = await listInquiries();
      setRecords(latest);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "問い合わせ一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初期データ取得
    void refresh();
  }, [refresh]);

  const handleStatusChange = useCallback(
    (id: string, status: InquiryStatus) => {
      void updateInquiryStatus(id, status)
        .then(refresh)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "ステータス更新に失敗しました");
        });
    },
    [refresh],
  );

  const newCount = records.filter((r) => r.status === "new").length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-stone-50">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#6B8E5A]/30 border-t-[#6B8E5A]" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-50 text-slate-800">
      {/* 左: リスト */}
      <div className="flex flex-col w-72 border-r border-stone-200 bg-white shrink-0">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-700">問い合わせ受信箱</h1>
            {newCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6B8E5A] text-white text-[10px] font-bold">
                {newCount}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">HP経由の問い合わせ一覧</p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {/* フィルタタブ */}
        <div className="flex overflow-x-auto border-b border-stone-100 px-2 pt-2 gap-1 shrink-0">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-2.5 py-1 rounded-t text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === opt.value
                  ? "bg-[#6B8E5A] text-white"
                  : "text-slate-500 hover:text-slate-700 hover:bg-stone-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* リスト本体 */}
        <div className="flex-1 overflow-y-auto">
          {filteredRecords.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-slate-400">問い合わせがありません</p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <InquiryListItem
                key={record.id}
                record={record}
                isSelected={record.id === selectedId}
                onClick={() => setSelectedId(record.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* 右: 詳細 */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <DetailPanel record={selected} onStatusChange={handleStatusChange} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-slate-400">問い合わせを選択してください</p>
              {records.length === 0 && (
                <p className="text-xs text-slate-300 mt-1">HP問い合わせを受信すると自動的に表示されます</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
