import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createProjectRepository } from "../stores/project-store.js";
// p94s2: OCR結果は経費ではなく請求書ハブの「確認待ち」レコードへ合流させる
import { addInvoice } from "../lib/invoice-store.js";
import { navigate } from "../hooks/useHashRouter.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import {
  extractInvoiceFromFile,
  InvoiceOcrError,
} from "../lib/invoice-vision.js";
import type { InvoiceExtraction } from "../domain/invoice-extraction-schema.js";
import { getSupabaseClient, hasSupabaseEnv } from "../infra/supabase-client.js";

// ── OCR result (UI 表示用の縮約形) ────────────────────────────

type OcrResult = {
  vendorName: string;
  amount: number;
  invoiceDate: string;
};

/**
 * Vision の抽出結果を UI フォームが扱う OcrResult に変換する。
 * total を優先、なければ subtotal を使う。両方無ければ 0。
 */
function toOcrResult(extraction: InvoiceExtraction): OcrResult {
  const amount = extraction.total ?? extraction.subtotal ?? 0;
  const invoiceDate =
    extraction.issue_date ?? extraction.due_date ?? new Date().toISOString().slice(0, 10);
  return {
    vendorName: extraction.vendor ?? "",
    amount,
    invoiceDate,
  };
}

// ── Component ────────────────────────────────────────────────

export function InvoicePage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(
    () => createProjectRepository(() => organizationId),
    [organizationId],
  );

  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // Editable form fields
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects on mount
  const loadProjects = useCallback(async () => {
    try {
      const all = await projectRepository.findAll();
      setProjects(all.map((p) => ({ id: p.id, name: p.name })));
      if (all.length > 0) setProjectId(all[0].id);
    } catch {
      // non-critical
    }
  }, [projectRepository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時の一度きりの外部データ取得
    void loadProjects();
  }, [loadProjects]);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("画像ファイル（JPG/PNG）またはPDFを選択してください");
      return;
    }
    setProcessing(true);
    setError(null);
    setSaved(false);
    setOcrResult(null);

    // Show preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    setFileName(file.name);

    try {
      const extraction = await extractInvoiceFromFile(file, {
        getAccessToken: async () => {
          if (!hasSupabaseEnv()) return null;
          const client = await getSupabaseClient();
          const { data } = await client.auth.getSession();
          return data.session?.access_token ?? null;
        },
      });
      const result = toOcrResult(extraction);
      setOcrResult(result);
      setVendorName(result.vendorName);
      setAmount(result.amount ? String(result.amount) : "");
      setInvoiceDate(result.invoiceDate);
    } catch (err) {
      if (err instanceof InvoiceOcrError) {
        if (err.status === 401) {
          setError("認証が切れています。ログインし直してから再試行してください。");
        } else if (err.status === 413) {
          setError("ファイルが大きすぎます（上限 5MB）。小さいファイルで再試行してください。");
        } else if (err.status === 429) {
          const sec = err.retryAfterSeconds;
          setError(
            sec
              ? `リクエストが多すぎます。${sec}秒後に再試行してください。`
              : "リクエストが多すぎます。しばらく待ってから再試行してください。",
          );
        } else {
          setError(`請求書の読み取りに失敗しました。${err.message}`);
        }
      } else {
        const msg = err instanceof Error ? err.message : "OCR処理に失敗しました";
        setError(`請求書の読み取りに失敗しました。${msg}`);
      }
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) await processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!vendorName.trim() || !amount || !invoiceDate) {
      setError("業者名・金額・日付は必須です");
      return;
    }
    const parsedAmount = Number(amount);
    if (parsedAmount < 100) {
      setError("金額が小さすぎます（100円未満）。金額は円単位で入力してください。万円単位の場合は末尾に0000を付けてください。");
      return;
    }
    // 請求書は案件に紐づく。案件が1件も無いまま登録できないため先に案内する。
    if (!projectId) {
      setError("請求書の保存先となる案件がありません。先に案件一覧から案件を作成してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // p94s2: OCR結果を請求書ハブの「確認待ち」レコードとして登録（手入力と合流）。
      // 以前は経費(expenses)へ保存され請求書管理に流れず、支払漏れ・二重登録の原因だった。
      addInvoice({
        projectId,
        vendorName: vendorName.trim(),
        amount: parsedAmount,
        tax: 0,
        total: parsedAmount,
        items: [],
        invoiceDate,
        status: "確認待ち",
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [vendorName, amount, invoiceDate, projectId]);

  const handleReset = useCallback(() => {
    setOcrResult(null);
    setPreviewUrl(null);
    setFileName("");
    setVendorName("");
    setAmount("");
    setInvoiceDate("");
    setSaved(false);
    setError(null);
  }, []);

  return (
    <div data-testid="invoice-ocr-page" className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">請求書OCR</h1>
        {ocrResult && (
          <button
            onClick={handleReset}
            className="text-sm text-slate-500 hover:text-brand-600 transition-colors"
          >
            リセット
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="エラーを閉じる">
            &times;
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        請求書画像または PDF をアップロードすると、Claude Vision で業者名・金額・日付を自動抽出します。抽出結果は必ず内容を確認してから保存してください。
      </div>

      {/* Upload area */}
      {!ocrResult && !processing && (
        <div
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-brand-400 bg-brand-50"
              : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-4xl mb-3">📄</div>
          <p className="text-sm font-semibold text-slate-700">
            請求書画像をドラッグ＆ドロップ
          </p>
          <p className="text-xs text-slate-400 mt-1">または クリックして選択</p>
          <p className="text-xs text-slate-300 mt-2">JPG / PNG / PDF 対応</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Processing */}
      {processing && (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700">OCR処理中...</p>
          <p className="text-xs text-slate-400 mt-1">{fileName}</p>
        </div>
      )}

      {/* OCR Result + Edit form */}
      {ocrResult && !processing && (
        <div className="space-y-4">
          {/* Preview */}
          {previewUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img src={previewUrl} alt="請求書プレビュー" className="w-full max-h-48 object-contain" />
            </div>
          )}

          {/* OCR result badge */}
          <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
            <p className="text-xs font-semibold text-brand-700 mb-1">OCR抽出結果（編集可能）</p>
            <p className="text-xs text-brand-500">{fileName}</p>
          </div>

          {/* Edit form */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">業者名</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">金額（円）</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">請求日</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
              />
            </div>
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">案件</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {saved ? (
            <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-brand-700">請求書管理の「確認待ち」に登録しました</p>
              <button
                type="button"
                onClick={() => navigate("/invoices")}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                請求書管理を開く
              </button>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "登録中..." : "請求書として登録"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
