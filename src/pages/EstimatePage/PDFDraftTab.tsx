/**
 * PDF由来ドラフトタブ
 * DrawingModel JSON → interior-semantic → takeoff → compose → EstimateDraft 表示
 */

import { useRef, useState } from "react";
import { classifyInteriorElements } from "../../lib/pdf-to-estimate/interior-semantic.js";
import { takeoffFromInterior } from "../../lib/pdf-to-estimate/quantity-takeoff-from-pdf.js";
import { composeEstimate } from "../../lib/pdf-to-estimate/estimate-composer.js";
import type { DrawingModel, EstimateDraft, EstimateLine, CostMasterItem, WallType } from "../../lib/pdf-to-estimate/types.js";
import { WALL_TYPE_RULES } from "../../lib/pdf-to-estimate/types.js";

const TAX_RATE = 0.1;

// ─── helpers ──────────────────────────────────────────────────────

function confidenceBadge(confidence: number): { label: string; className: string } {
  if (confidence >= 0.7) {
    return { label: `${Math.round(confidence * 100)}%`, className: "bg-emerald-100 text-emerald-700" };
  }
  if (confidence >= 0.5) {
    return { label: `${Math.round(confidence * 100)}%`, className: "bg-yellow-100 text-yellow-700" };
  }
  return { label: `${Math.round(confidence * 100)}% 要確認`, className: "bg-red-100 text-red-700" };
}

function rowBg(confidence: number): string {
  if (confidence < 0.5) return "bg-red-50";
  if (confidence < 0.7) return "bg-yellow-50";
  return "";
}

// ─── Component ────────────────────────────────────────────────────

// 壁タイプ選択肢（「自動」+ 7種）
const WALL_TYPE_OPTIONS: Array<{ value: WallType | "auto"; label: string }> = [
  { value: "auto",          label: "自動（推定）" },
  { value: "LGS45",        label: "LGS45 — ふかせない壁（メイン）" },
  { value: "LGS65",        label: "LGS65 — 一般間仕切り（メイン）" },
  { value: "LGS50",        label: "LGS50 — 補助" },
  { value: "LGS75",        label: "LGS75 — 補助" },
  { value: "LGS90",        label: "LGS90 — 遮音・耐火強化" },
  { value: "LGS100",       label: "LGS100 — 遮音・耐火強化" },
  { value: "LGS20_runner", label: "LGS20 ランナー — 天井補強・梁型" },
];

type EditOverrides = Record<string, { unitPrice: string; quantity: string }>;

type Props = {
  costMaster: CostMasterItem[];
  onSave?: (draft: EstimateDraft) => void;
};

export function PDFDraftTab({ costMaster, onSave }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EstimateDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState<EditOverrides>({});
  const [selectedWallType, setSelectedWallType] = useState<WallType | "auto">("auto");

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setDraft(null);
    setEditMode(false);
    setOverrides({});

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

    try {
      let model: DrawingModel;
      if (isPdf) {
        // PDF直読み: pdf-vector-extractor で DrawingModel に変換（縮尺は図面内 "1/50" 等から自動検出）
        const { extractDrawingModel } = await import("../../lib/pdf-vector-extractor/index.js");
        model = await extractDrawingModel(await file.arrayBuffer());
      } else {
        const text = await readFileAsText(file);
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          setError("ファイル形式が不正です（JSON パースエラー）");
          return;
        }
        model = json as DrawingModel;
      }

      // Basic shape check
      if (!model || typeof model !== "object" || !Array.isArray(model.lines)) {
        setError("ファイル形式が不正です（DrawingModel 形式ではありません）");
        return;
      }

      // Required field validation — guard against runtime crashes from incomplete DrawingModel
      if (!Array.isArray(model.texts)) {
        setError("図面データが不完全です（textsフィールドがありません）");
        return;
      }
      if (typeof model.page_index !== "number") {
        setError("図面データが不完全です（page_indexフィールドがありません）");
        return;
      }

      const elements = classifyInteriorElements(model);
      if (elements.length === 0) {
        setError("内装要素が検出されませんでした（図面データを確認してください）");
        return;
      }

      const takeoff = takeoffFromInterior(elements);
      const result = composeEstimate(takeoff, costMaster, model, {
        wallTypeOverride: selectedWallType !== "auto" ? selectedWallType : undefined,
        wallTypeInferenceHints: selectedWallType === "auto"
          ? { texts: model.texts.map((t) => t.text) }
          : undefined,
      });
      setDraft(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleClear = () => {
    setDraft(null);
    setError(null);
    setEditMode(false);
    setOverrides({});
  };

  const handleSave = () => {
    if (!draft || !onSave) return;
    if (Object.keys(overrides).length === 0) {
      onSave(draft);
      return;
    }
    // Apply overrides to lines
    const updatedLines: EstimateLine[] = draft.lines.map((line) => {
      const ov = overrides[line.code];
      if (!ov) return line;
      const unitPrice = Number(ov.unitPrice) || line.unitPrice;
      const quantity = Number(ov.quantity) || line.quantity;
      return { ...line, unitPrice, quantity, amount: Math.round(unitPrice * quantity) };
    });
    const totalExcludingTax = updatedLines.reduce((s, l) => s + l.amount, 0);
    onSave({ ...draft, lines: updatedLines, totalExcludingTax });
  };

  const setOverride = (code: string, field: "unitPrice" | "quantity", value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [code]: { unitPrice: prev[code]?.unitPrice ?? "", quantity: prev[code]?.quantity ?? "", [field]: value },
    }));
  };

  const effectiveLines: EstimateLine[] = draft
    ? draft.lines.map((line) => {
        const ov = overrides[line.code];
        if (!ov) return line;
        const unitPrice = Number(ov.unitPrice) || line.unitPrice;
        const quantity = Number(ov.quantity) || line.quantity;
        return { ...line, unitPrice, quantity, amount: Math.round(unitPrice * quantity) };
      })
    : [];

  const effectiveTotal = effectiveLines.reduce((s, l) => s + l.amount, 0);
  const effectiveTax = Math.round(effectiveTotal * TAX_RATE);

  // ── Drop zone ──
  if (!draft) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
        <h2 className="text-lg font-bold text-slate-900">PDF由来ドラフト</h2>
        <p className="text-xs text-slate-500">
          図面 PDF（または DrawingModel JSON）をアップロードすると、
          内装要素を自動抽出して見積ドラフトを生成します。
        </p>

        {/* 壁タイプ選択 */}
        <div className="flex items-center gap-3">
          <label htmlFor="wall-type-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            壁タイプ
          </label>
          <select
            id="wall-type-select"
            value={selectedWallType}
            onChange={(e) => setSelectedWallType(e.target.value as WallType | "auto")}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
            data-testid="wall-type-select"
          >
            {WALL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            data-testid="pdf-draft-error"
          >
            {error}
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/40 px-6 py-14 text-center hover:border-brand-500 hover:bg-brand-50/70 active:bg-brand-100/60 transition-colors"
          data-testid="pdf-drop-zone"
          role="button"
          aria-label="PDF図面をドロップまたはクリックして選択"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          {/* Upload icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <svg
              width="32" height="32" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5"
              className="text-brand-600"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>

          {loading ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-brand-700">図面を解析中...</p>
              <p className="text-xs text-slate-400">内装要素を自動検出しています</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-base font-bold text-slate-800">
                ここに図面 PDF をドロップ
              </p>
              <p className="text-sm text-slate-500">
                または<span className="text-brand-600 font-semibold"> クリックしてファイルを選択</span>
              </p>
              <p className="text-xs text-slate-400">PDF・JSON 対応　※ファイルは外部送信されません</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,application/json"
          className="hidden"
          onChange={handleInputChange}
          data-testid="pdf-file-input"
        />
      </div>
    );
  }

  // ── Draft result view ──
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">PDF由来ドラフト</h2>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            data-testid="clear-draft-btn"
          >
            ドラフトをクリア
          </button>
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              editMode
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
            data-testid="edit-mode-btn"
          >
            {editMode ? "編集中" : "手動で編集"}
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-colors"
              data-testid="save-draft-btn"
            >
              正式見積として保存
            </button>
          )}
        </div>
      </div>

      {/* Source info */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs text-slate-500 space-y-0.5">
        <p>
          <span className="font-medium text-slate-600">生成元PDF: </span>
          {draft.sourcePdfPath}
        </p>
        <p>
          <span className="font-medium text-slate-600">図面ページ: </span>
          {draft.drawingModel.page_index + 1}  /  スケール: {draft.drawingModel.scale ?? "不明"}
        </p>
        <p>
          <span className="font-medium text-slate-600">全体信頼度: </span>
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${confidenceBadge(draft.confidence).className}`}
            data-testid="overall-confidence-badge"
          >
            {confidenceBadge(draft.confidence).label}
          </span>
        </p>
      </div>

      {/* Notes */}
      {draft.notes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          {draft.notes.map((note, i) => (
            <p key={i} className="text-xs text-amber-700">
              {note}
            </p>
          ))}
        </div>
      )}

      {/* Lines table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="draft-lines-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                <th className="py-2 px-3 text-left font-medium">コード</th>
                <th className="py-2 px-3 text-left font-medium">品目</th>
                <th className="py-2 px-2 text-right font-medium w-20">数量</th>
                <th className="py-2 px-2 text-right font-medium w-12">単位</th>
                <th className="py-2 px-2 text-right font-medium w-24">単価</th>
                <th className="py-2 px-2 text-right font-medium w-24">金額</th>
                <th className="py-2 px-2 text-center font-medium w-20">信頼度</th>
              </tr>
            </thead>
            <tbody>
              {effectiveLines.map((line, idx) => {
                const badge = confidenceBadge(line.confidence);
                const ov = overrides[line.code];
                return (
                  <tr
                    key={`${line.code}-${idx}`}
                    className={`border-b border-slate-50 ${rowBg(line.confidence)}`}
                    data-testid={`draft-line-${line.code}`}
                  >
                    <td className="py-1.5 px-3 text-slate-400 font-mono">{line.code}</td>
                    <td className="py-1.5 px-3 text-slate-700 font-medium">{line.name}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {editMode ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          value={ov?.quantity ?? line.quantity}
                          onChange={(e) => setOverride(line.code, "quantity", e.target.value)}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-right tabular-nums focus:border-brand-400 focus:outline-none"
                          min={0}
                          step={0.01}
                          aria-label={`${line.name} 数量`}
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-400">{line.unit}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {editMode ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={ov?.unitPrice ?? line.unitPrice}
                          onChange={(e) => setOverride(line.code, "unitPrice", e.target.value)}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-right tabular-nums focus:border-brand-400 focus:outline-none"
                          min={0}
                          aria-label={`${line.name} 単価`}
                        />
                      ) : (
                        `¥${line.unitPrice.toLocaleString("ja-JP")}`
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                      ¥{line.amount.toLocaleString("ja-JP")}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        data-testid={`confidence-badge-${line.code}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {effectiveLines.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                    見積行なし
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-slate-200 px-4 py-3 space-y-1 text-sm bg-slate-50/60">
          <div className="flex justify-between text-slate-600">
            <span>小計（税抜）</span>
            <span className="tabular-nums font-semibold" data-testid="total-excl-tax">
              ¥{effectiveTotal.toLocaleString("ja-JP")}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>消費税（10%）</span>
            <span className="tabular-nums">¥{effectiveTax.toLocaleString("ja-JP")}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
            <span>合計（税込）</span>
            <span className="tabular-nums text-brand-700" data-testid="total-incl-tax">
              ¥{(effectiveTotal + effectiveTax).toLocaleString("ja-JP")}
            </span>
          </div>
        </div>
      </div>

      {/* Assembly templates reference */}
      <div className="rounded-lg border border-slate-100 bg-slate-50/40 px-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-600 whitespace-nowrap">壁タイプ変更</p>
          <select
            value={selectedWallType}
            onChange={(e) => setSelectedWallType(e.target.value as WallType | "auto")}
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-400 focus:outline-none"
            data-testid="wall-type-select-result"
          >
            {WALL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs font-semibold text-slate-600 mb-1.5">使用アセンブリテンプレート</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            selectedWallType === "auto"
              ? "壁: 自動推定（LGS+PB+クロス）"
              : `壁: ${selectedWallType}（${WALL_TYPE_RULES[selectedWallType as WallType].usage}）`,
            "床: フロアタイル",
            "天井: 軽鉄下地+石膏ボード",
            "建具: 木製フラッシュ",
            "巾木: ビニル",
          ].map((label) => (
            <span
              key={label}
              className="rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
