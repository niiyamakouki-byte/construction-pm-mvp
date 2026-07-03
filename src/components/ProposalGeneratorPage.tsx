/**
 * ProposalGeneratorPage — 競合提案書自動生成ダッシュボード (Sprint 16-C)
 *
 * v2-cozy: セージグリーン (#6B8E5A) 軸 / 危険のみ赤 (#C53030) / 装飾最小
 */

import { useState, useEffect, useCallback } from "react";
import type {
  ProposalDocument,
  ProposalGenerationInput,
  WorkCategory,
  WorkScale,
} from "../lib/proposal-generator/types.js";
import { generateRaw, generateFromInquiry, generateFromDeal } from "../lib/proposal-generator/proposal-generator.js";
import { proposalStore, _resetProposalStore } from "../lib/proposal-generator/proposal-store.js";
import { renderMarkdown, renderHtml } from "../lib/proposal-generator/proposal-renderer.js";
import { inquiryStore } from "../lib/inquiry-responder/inquiry-store.js";
import { dealStore } from "../lib/sales-pipeline/deal-store.js";
import type { InquiryRecord } from "../lib/inquiry-responder/types.js";
import type { Deal } from "../lib/sales-pipeline/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE = "#6B8E5A";
const DANGER = "#C53030";

const CATEGORY_LABELS: Record<WorkCategory, string> = {
  full_renovation: "全面リノベーション",
  partial_renovation: "部分リフォーム",
  kitchen: "キッチン工事",
  bath: "浴室工事",
  store_fit: "店舗内装工事",
  office_fit: "オフィス内装工事",
  exterior: "外装・外壁工事",
  repair: "補修・修繕工事",
  other: "その他内装工事",
};

const SCALE_LABELS: Record<WorkScale, string> = {
  small: "小規模 (〜100万)",
  medium: "中規模 (100〜500万)",
  large: "大規模 (500〜2000万)",
  extra_large: "超大規模 (2000万〜)",
};

const ORDERED_CATEGORIES: WorkCategory[] = [
  "full_renovation", "partial_renovation", "kitchen", "bath",
  "store_fit", "office_fit", "exterior", "repair", "other",
];

const ORDERED_SCALES: WorkScale[] = ["small", "medium", "large", "extra_large"];

function formatJpy(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}億円`;
  }
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000)}万円`;
  }
  return `${amount.toLocaleString("ja-JP")}円`;
}

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-4">
      <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold leading-tight text-slate-900">{value}</div>
      {sub ? <div className="text-xs text-slate-400 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 overflow-auto max-h-[480px]">
      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">
        {markdown}
      </pre>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function ProposalGeneratorPage() {
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [workCategory, setWorkCategory] = useState<WorkCategory>("full_renovation");
  const [workScale, setWorkScale] = useState<WorkScale>("medium");
  const [locationCity, setLocationCity] = useState("世田谷区");
  const [budgetHintJpy, setBudgetHintJpy] = useState("");
  const [desiredStartMonth, setDesiredStartMonth] = useState("");
  const [styleTags, setStyleTags] = useState("");

  // Generation state
  const [currentDoc, setCurrentDoc] = useState<ProposalDocument | null>(null);
  const [markdownPreview, setMarkdownPreview] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History
  const [recentDocs, setRecentDocs] = useState<ProposalDocument[]>([]);

  // Import sources
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showImport, setShowImport] = useState<"inquiry" | "deal" | null>(null);

  useEffect(() => {
    setRecentDocs(proposalStore.listRecent(10));
    inquiryStore.ensureSeed();
    dealStore.ensureSeed();
    setInquiries(inquiryStore.all().slice(0, 20));
    setDeals(dealStore.getAll().slice(0, 20));

    const unsub = proposalStore.subscribe((docs) => setRecentDocs(docs.slice(0, 10)));
    return unsub;
  }, []);

  const handleGenerate = useCallback(() => {
    if (!customerName.trim()) {
      setError("顧客名を入力してください。");
      return;
    }
    setError(null);
    setGenerating(true);

    const input: ProposalGenerationInput = {
      customerName: customerName.trim(),
      workCategory,
      workScale,
      locationCity: locationCity.trim() || "東京都",
      budgetHintJpy: budgetHintJpy ? Number(budgetHintJpy) * 10_000 : undefined,
      desiredStartMonth: desiredStartMonth ? Number(desiredStartMonth) : undefined,
      styleTags: styleTags ? styleTags.split(/[,、\s]+/).filter(Boolean) : undefined,
    };

    const doc = generateRaw(input);
    setCurrentDoc(doc);
    setMarkdownPreview(renderMarkdown(doc));
    setGenerating(false);
  }, [customerName, workCategory, workScale, locationCity, budgetHintJpy, desiredStartMonth, styleTags]);

  const handleImportFromInquiry = useCallback((inquiry: InquiryRecord) => {
    const doc = generateFromInquiry(inquiry);
    setCurrentDoc(doc);
    setMarkdownPreview(renderMarkdown(doc));
    setShowImport(null);
    setCustomerName(inquiry.customerName ?? "");
    setWorkCategory(inquiry.extractedRequirements.workCategory as WorkCategory);
    setWorkScale(inquiry.extractedRequirements.workScale as WorkScale);
    setLocationCity(inquiry.extractedRequirements.locationCity ?? "東京都");
  }, []);

  const handleImportFromDeal = useCallback((deal: Deal) => {
    const doc = generateFromDeal(deal);
    setCurrentDoc(doc);
    setMarkdownPreview(renderMarkdown(doc));
    setShowImport(null);
    setCustomerName(deal.customerName);
  }, []);

  const handleCopyMarkdown = useCallback(() => {
    if (!currentDoc) return;
    navigator.clipboard.writeText(renderMarkdown(currentDoc)).catch(() => {});
  }, [currentDoc]);

  const handleDownloadHtml = useCallback(() => {
    if (!currentDoc) return;
    const html = renderHtml(currentDoc);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal-${currentDoc.customerName}-${currentDoc.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentDoc]);

  const handlePrint = useCallback(() => {
    if (!currentDoc) return;
    const html = renderHtml(currentDoc);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }, [currentDoc]);

  const handleDeleteDoc = useCallback((id: string) => {
    proposalStore.delete(id);
  }, []);

  const handleRegenerate = useCallback((doc: ProposalDocument) => {
    setCurrentDoc(doc);
    setMarkdownPreview(renderMarkdown(doc));
    setCustomerName(doc.customerName);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">提案書自動生成</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sprint 16-C — 強み3点・類似事例3件・価格・工期・競合差別化を含む叩き台を1クリックで生成
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="今月生成数" value={`${recentDocs.length}件`} />
        <KpiCard label="最新生成日" value={recentDocs[0] ? formatDateJa(recentDocs[0].generatedAt) : "—"} />
        <KpiCard
          label="直近の有効期限"
          value={recentDocs[0]?.validUntil ?? "—"}
          sub="30日間有効"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">入力フォーム</h2>

          {/* Import buttons */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setShowImport(showImport === "inquiry" ? null : "inquiry")}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              問合せから取込 (16-A)
            </button>
            <button
              type="button"
              onClick={() => setShowImport(showImport === "deal" ? null : "deal")}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              商談から取込 (16-B)
            </button>
          </div>

          {/* Import panel — Inquiry */}
          {showImport === "inquiry" && (
            <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">問合せを選択</p>
              {inquiries.map((inq) => (
                <button
                  type="button"
                  key={inq.id}
                  onClick={() => handleImportFromInquiry(inq)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white text-sm text-slate-700 border-b border-slate-100 last:border-0"
                >
                  <span className="font-medium">{inq.customerName ?? "名無し"}</span>
                  <span className="text-slate-400 ml-2 text-xs">{CATEGORY_LABELS[inq.extractedRequirements.workCategory]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Import panel — Deal */}
          {showImport === "deal" && (
            <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">商談を選択</p>
              {deals.map((deal) => (
                <button
                  type="button"
                  key={deal.id}
                  onClick={() => handleImportFromDeal(deal)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white text-sm text-slate-700 border-b border-slate-100 last:border-0"
                >
                  <span className="font-medium">{deal.customerName}</span>
                  <span className="text-slate-400 ml-2 text-xs">{formatJpy(deal.expectedAmountJpy)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">顧客名 *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="例: 田中花子"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">工事種別</label>
              <select
                value={workCategory}
                onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
              >
                {ORDERED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">規模</label>
              <select
                value={workScale}
                onChange={(e) => setWorkScale(e.target.value as WorkScale)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
              >
                {ORDERED_SCALES.map((sc) => (
                  <option key={sc} value={sc}>{SCALE_LABELS[sc]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">対象エリア</label>
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="例: 世田谷区"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">予算ヒント (万円)</label>
                <input
                  type="number"
                  value={budgetHintJpy}
                  onChange={(e) => setBudgetHintJpy(e.target.value)}
                  placeholder="例: 500"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">希望着工月</label>
                <input
                  type="number"
                  value={desiredStartMonth}
                  onChange={(e) => setDesiredStartMonth(e.target.value)}
                  placeholder="1〜12"
                  min="1"
                  max="12"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">スタイルタグ (カンマ区切り)</label>
              <input
                type="text"
                value={styleTags}
                onChange={(e) => setStyleTags(e.target.value)}
                placeholder="例: ナチュラル, 北欧, シンプル"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B8E5A]/30"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 text-sm text-[#C53030] bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: generating ? "#aaa" : SAGE }}
          >
            {generating ? "生成中..." : "提案書を生成"}
          </button>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          {currentDoc ? (
            <>
              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Markdown コピー
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  HTML ダウンロード
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs px-3 py-2 rounded-xl text-white font-medium"
                  style={{ background: SAGE }}
                >
                  PDF で印刷
                </button>
              </div>

              {/* Summary card */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">{currentDoc.customerName} 様</span>
                  <span className="text-xs text-slate-400">有効期限: {currentDoc.validUntil}</span>
                </div>
                <div className="flex gap-4 text-xs text-slate-600">
                  <span>概算: {formatJpy(currentDoc.totalPriceJpyLower)} 〜 {formatJpy(currentDoc.totalPriceJpyUpper)}</span>
                  <span>工期: {currentDoc.durationDays}日間</span>
                  <span>セクション数: {currentDoc.sections.length}</span>
                </div>
              </div>

              {/* Markdown preview */}
              <MarkdownPreview markdown={markdownPreview} />
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <p className="text-slate-400 text-sm">入力フォームを記入して「提案書を生成」を押してください</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {recentDocs.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">過去の提案書</h2>
          <div className="divide-y divide-slate-50">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{doc.customerName} 様</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatDateJa(doc.generatedAt)} | {formatJpy(doc.totalPriceJpyLower)} 〜 {formatJpy(doc.totalPriceJpyUpper)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRegenerate(doc)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    表示
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-[#C53030] hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export reset for testing
export { _resetProposalStore };
