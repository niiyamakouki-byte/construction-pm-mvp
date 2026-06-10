/**
 * ReceiptUploadPage — レシート読み込み → 仕訳ドラフト → freee 送信 UI
 *
 * OCRエンジン未接続のため、テキスト手動貼付けで代替。
 * parseReceiptText → mapToJournal → submitJournal の一本道。
 * 鈴木さん向けに技術用語ゼロ、最小限のUI。
 */

import { useState, useCallback } from "react";
import { parseReceiptTextLegacy as parseReceiptText, type ReceiptData } from "../lib/receipt-ocr.js";
import { mapToJournal, type FreeeJournalDraft } from "../lib/freee-journal-mapper.js";
import { submitJournal, type SubmitResult } from "../lib/freee-api-client.js";

// ── 型 ────────────────────────────────────────────────

type Step = "input" | "confirm" | "done";

// ── サブコンポーネント ─────────────────────────────────

function OcrPlaceholderBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="mt-0.5 shrink-0 text-base">📷</span>
      <span>
        カメラ自動読み取りは準備中です。
        今は下のテキストボックスにレシートの内容を貼り付けてください。
      </span>
    </div>
  );
}

type DropZoneProps = {
  onTextReady: (text: string) => void;
};

function DropZone({ onTextReady }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      // OCR未接続: ファイル名のみ表示してユーザーにテキスト貼付けを促す
      onTextReady(`[ファイル: ${file.name}]\n（OCR未接続のため、内容を手動で貼り付けてください）`);
    },
    [onTextReady],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-sm transition-colors",
        dragging
          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
          : "border-slate-300 bg-slate-50 text-slate-500",
      ].join(" ")}
    >
      <span className="text-3xl">📄</span>
      <span>ここに画像・PDFをドラッグ（OCR準備中）</span>
    </div>
  );
}

type ResultCardProps = {
  receipt: ReceiptData;
  draft: FreeeJournalDraft;
};

function ResultCard({ receipt, draft }: ResultCardProps) {
  const fmt = (n: number) =>
    n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">読み取り結果</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">日付</dt>
        <dd className="font-medium text-slate-800">{receipt.date || "—"}</dd>

        <dt className="text-slate-500">お店</dt>
        <dd className="font-medium text-slate-800">{receipt.vendor}</dd>

        <dt className="text-slate-500">合計</dt>
        <dd className="font-medium text-slate-800">
          {receipt.total > 0 ? fmt(receipt.total) : "—"}
        </dd>

        {receipt.subtotal !== undefined && (
          <>
            <dt className="text-slate-500">小計</dt>
            <dd className="text-slate-700">{fmt(receipt.subtotal)}</dd>
          </>
        )}

        {receipt.tax !== undefined && (
          <>
            <dt className="text-slate-500">消費税</dt>
            <dd className="text-slate-700">{fmt(receipt.tax)}</dd>
          </>
        )}

        {receipt.reduced_tax_items && receipt.reduced_tax_items.length > 0 && (
          <>
            <dt className="text-slate-500">軽減税率品目</dt>
            <dd className="text-slate-700">
              {receipt.reduced_tax_items.join("、")}
            </dd>
          </>
        )}
      </dl>

      <hr className="border-slate-100" />

      <h3 className="text-sm font-semibold text-slate-700">freee 仕訳（案）</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">勘定科目</dt>
        <dd className="font-medium text-slate-800">{draft.account_item}</dd>

        <dt className="text-slate-500">税率</dt>
        <dd className="text-slate-700">{draft.tax_code}%</dd>

        <dt className="text-slate-500">摘要</dt>
        <dd className="text-slate-700">{draft.description}</dd>
      </dl>

      {draft.needs_review && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
          内容を確認してから送信してください（勘定科目・日付・金額が未確定です）
        </div>
      )}
    </div>
  );
}

type ToastProps = {
  result: SubmitResult;
  onClose: () => void;
};

function Toast({ result, onClose }: ToastProps) {
  const isDry = result.mode === "dry_run";
  const base = "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 text-sm shadow-lg";
  const color = result.ok
    ? isDry
      ? "bg-amber-100 text-amber-800 border border-amber-300"
      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
    : "bg-red-100 text-red-800 border border-red-300";

  const message = result.ok
    ? isDry
      ? "テスト送信完了（freee未接続のためドライランです）"
      : `freee に登録しました（取引ID: ${result.deal_id ?? "—"}）`
    : result.error ?? "送信に失敗しました";

  return (
    <div className={`${base} ${color}`}>
      <span>{result.ok ? "✓" : "✗"}</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-xs underline opacity-70 hover:opacity-100"
      >
        閉じる
      </button>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────

export function ReceiptUploadPage() {
  const [rawText, setRawText] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [draft, setDraft] = useState<FreeeJournalDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<SubmitResult | null>(null);

  const handleParse = useCallback(() => {
    if (!rawText.trim()) return;
    const parsed = parseReceiptText(rawText);
    const journal = mapToJournal(parsed);
    setReceipt(parsed);
    setDraft(journal);
    setStep("confirm");
  }, [rawText]);

  const handleSubmit = useCallback(async () => {
    if (!draft) return;
    setSubmitting(true);
    try {
      // env は未設定 → dry_run フォールバック
      const result = await submitJournal(draft, {});
      setToast(result);
      if (result.ok) setStep("done");
    } finally {
      setSubmitting(false);
    }
  }, [draft]);

  const handleReset = useCallback(() => {
    setRawText("");
    setReceipt(null);
    setDraft(null);
    setStep("input");
    setToast(null);
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <h1 className="text-xl font-bold text-slate-800">レシート読み込み</h1>
      <p className="text-sm text-slate-500">
        レシートの内容を貼り付けると、freee 用の仕訳を自動で作成します。
      </p>

      {step === "input" && (
        <>
          <div className="space-y-1">
            <label
              htmlFor="receipt-text"
              className="block text-sm font-medium text-slate-700"
            >
              レシートの内容を貼り付け
            </label>
            <textarea
              id="receipt-text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={10}
              placeholder={`例:\nセブンイレブン 渋谷店\n2025年4月15日\n飲料水        ※  108\nサンドイッチ  ※  324\n合計          ¥432`}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            内容を読み取る
          </button>
        </>
      )}

      {step === "confirm" && receipt && draft && (
        <>
          <ResultCard receipt={receipt} draft={draft} />

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              やり直す
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "送信中…" : "freee に送信"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="space-y-4">
          {receipt && draft && <ResultCard receipt={receipt} draft={draft} />}
          <button
            onClick={handleReset}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            次のレシートを読み込む
          </button>
        </div>
      )}

      {toast && <Toast result={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
