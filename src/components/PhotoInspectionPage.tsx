/**
 * PhotoInspectionPage — AI写真検査ページ
 *
 * v2-cozy スタイル: セージグリーン #6B8E5A、白背景、装飾最小、危険のみ赤 #C53030
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { RuleBasedDetector } from "../lib/photo-inspection/defect-detector.js";
import {
  InspectionStore,
  type InspectionChangeEvent,
} from "../lib/photo-inspection/inspection-store.js";
import { generateReport } from "../lib/photo-inspection/report-generator.js";
import { renderReportHTML } from "../lib/photo-inspection/report-pdf-renderer.js";
import {
  DEFECT_KIND_LABELS,
  type InspectionPhoto,
  type PhotoStatus,
} from "../lib/photo-inspection/types.js";

// ── 定数 ──────────────────────────────────────────────────────────────────────

const COLOR_SAGE = "#6B8E5A";
const COLOR_DANGER = "#C53030";
const DETECTOR = new RuleBasedDetector();

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  projectId: string;
  projectName?: string;
};

// ── ユーティリティ ────────────────────────────────────────────────────────────

async function fileToImageData(
  file: File,
): Promise<{ imageData: ImageData; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context failed"));
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve({ imageData, dataUrl });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PhotoStatus, string> = {
  pending: "未検査",
  inspected: "検査済",
  approved: "合格",
  rework: "要手直し",
};
const STATUS_COLORS: Record<PhotoStatus, string> = {
  pending: "#94a3b8",
  inspected: "#2563eb",
  approved: COLOR_SAGE,
  rework: COLOR_DANGER,
};

function StatusBadge({ status }: { status: PhotoStatus }) {
  return (
    <span
      style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}`,
        borderRadius: 4,
        padding: "1px 6px",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── PhotoCard ─────────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  onApprove,
  onRework,
  onReInspect,
}: {
  photo: InspectionPhoto;
  onApprove: () => void;
  onRework: () => void;
  onReInspect: () => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 12,
        background: "#fff",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {/* サムネ + bbox オーバーレイ */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img
            src={photo.imageUrl}
            alt={photo.fileName}
            style={{ width: 140, height: 100, objectFit: "cover", borderRadius: 6, display: "block" }}
          />
          {photo.defects.length > 0 && (
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 140,
                height: 100,
                pointerEvents: "none",
              }}
            >
              {photo.defects.map((d) => (
                <rect
                  key={d.id}
                  x={d.bbox.x}
                  y={d.bbox.y}
                  width={d.bbox.w}
                  height={d.bbox.h}
                  fill="none"
                  stroke={d.kind === "crack" || d.kind === "water_damage" ? COLOR_DANGER : COLOR_SAGE}
                  strokeWidth={0.012}
                  strokeDasharray="0.02 0.012"
                />
              ))}
            </svg>
          )}
        </div>

        {/* 情報 */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
              {photo.fileName}
            </span>
            <StatusBadge status={photo.status} />
          </div>

          {photo.defects.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>欠陥なし</p>
          ) : (
            <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: "0.8rem", color: "#475569" }}>
              {photo.defects.map((d) => (
                <li key={d.id}>
                  <span
                    style={{
                      color:
                        d.kind === "crack" || d.kind === "water_damage"
                          ? COLOR_DANGER
                          : "#475569",
                      fontWeight: d.kind === "crack" || d.kind === "water_damage" ? 700 : 400,
                    }}
                  >
                    {DEFECT_KIND_LABELS[d.kind]}
                  </span>{" "}
                  ({Math.round(d.confidence * 100)}%)
                </li>
              ))}
            </ul>
          )}

          {/* アクションボタン */}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={onReInspect}
              style={{
                fontSize: "0.75rem",
                padding: "3px 10px",
                borderRadius: 5,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                cursor: "pointer",
                color: "#475569",
              }}
            >
              再検査
            </button>
            <button
              onClick={onApprove}
              style={{
                fontSize: "0.75rem",
                padding: "3px 10px",
                borderRadius: 5,
                border: `1px solid ${COLOR_SAGE}`,
                background: photo.status === "approved" ? COLOR_SAGE : "#fff",
                color: photo.status === "approved" ? "#fff" : COLOR_SAGE,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              合格
            </button>
            <button
              onClick={onRework}
              style={{
                fontSize: "0.75rem",
                padding: "3px 10px",
                borderRadius: 5,
                border: `1px solid ${COLOR_DANGER}`,
                background: photo.status === "rework" ? COLOR_DANGER : "#fff",
                color: photo.status === "rework" ? "#fff" : COLOR_DANGER,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              要手直し
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export function PhotoInspectionPage({ projectId, projectName }: Props) {
  const storeRef = useRef<InspectionStore>(new InspectionStore());
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ストアの変化を購読
  useEffect(() => {
    const store = storeRef.current;
    const handler = (e: Event) => {
      setPhotos((e as InspectionChangeEvent).detail.photos.filter((p) => p.projectId === projectId));
    };
    store.addEventListener("change", handler);
    // 初期ロード
    setPhotos(store.queryByProject(projectId));
    return () => store.removeEventListener("change", handler);
  }, [projectId]);

  // ファイル処理
  const processFiles = useCallback(
    async (files: File[]) => {
      setProcessing(true);
      try {
        const store = storeRef.current;
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          const { imageData, dataUrl } = await fileToImageData(file);
          const defects = await DETECTOR.detect(imageData);
          store.add({
            projectId,
            capturedAt: new Date().toISOString(),
            imageUrl: dataUrl,
            fileName: file.name,
            defects,
            status: "inspected",
          });
        }
      } finally {
        setProcessing(false);
      }
    },
    [projectId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      void processFiles(files);
    },
    [processFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      void processFiles(files);
      e.target.value = "";
    },
    [processFiles],
  );

  const handleApprove = useCallback((id: string) => {
    storeRef.current.setStatus(id, "approved");
  }, []);

  const handleRework = useCallback((id: string) => {
    storeRef.current.setStatus(id, "rework");
  }, []);

  const handleReInspect = useCallback(
    async (id: string) => {
      const store = storeRef.current;
      const photo = store.getById(id);
      if (!photo) return;
      // 既存の画像URL (dataUrl) を再解析
      setProcessing(true);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = photo.imageUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const defects = await DETECTOR.detect(imageData);
        store.update(id, { defects, status: "inspected" });
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  const handleGenerateReport = useCallback(() => {
    const report = generateReport(projectId, photos, undefined);
    const html = renderReportHTML(report, projectName ?? projectId);
    setReportHtml(html);
  }, [projectId, projectName, photos]);

  const handlePrintReport = useCallback(() => {
    if (!reportHtml) return;
    const reportUrl = URL.createObjectURL(new Blob([reportHtml], { type: "text/html;charset=utf-8" }));
    const win = window.open(reportUrl, "_blank");
    if (!win) {
      URL.revokeObjectURL(reportUrl);
      return;
    }
    win.opener = null;

    win.addEventListener("load", () => {
      win.print();
      URL.revokeObjectURL(reportUrl);
    }, { once: true });
  }, [reportHtml]);

  const pendingCount = photos.filter((p) => p.status === "pending").length;
  const reworkCount = photos.filter((p) => p.status === "rework").length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px", fontFamily: "sans-serif" }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
          AI写真検査
        </h1>
        {projectName && (
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            {projectName}
          </p>
        )}
        {reworkCount > 0 && (
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: COLOR_DANGER, fontWeight: 600 }}>
            ⚠ 要手直し {reworkCount}件
          </p>
        )}
      </div>

      {/* アップロードゾーン */}
      <div
        role="region"
        aria-label="写真アップロードゾーン"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? COLOR_SAGE : "#cbd5e1"}`,
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "#f0f7ed" : "#fafafa",
          marginBottom: 20,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
          {processing
            ? "検査中..."
            : "写真をドラッグ&ドロップ または クリックして選択 (複数可)"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
          data-testid="file-input"
        />
      </div>

      {/* ステータスバー */}
      {photos.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            fontSize: "0.82rem",
            color: "#64748b",
            flexWrap: "wrap",
          }}
        >
          <span>合計: <strong>{photos.length}</strong>枚</span>
          <span>未検査: <strong>{pendingCount}</strong></span>
          <span style={{ color: COLOR_DANGER }}>
            要手直し: <strong>{reworkCount}</strong>
          </span>
          <span style={{ color: COLOR_SAGE }}>
            合格: <strong>{photos.filter((p) => p.status === "approved").length}</strong>
          </span>
        </div>
      )}

      {/* 写真リスト */}
      {photos.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "20px 0" }}>
          写真がありません
        </p>
      ) : (
        photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onApprove={() => handleApprove(photo.id)}
            onRework={() => handleRework(photo.id)}
            onReInspect={() => void handleReInspect(photo.id)}
          />
        ))
      )}

      {/* 報告書ボタン */}
      {photos.length > 0 && (
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            onClick={handleGenerateReport}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: `1px solid ${COLOR_SAGE}`,
              background: COLOR_SAGE,
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            報告書を生成
          </button>
          {reportHtml && (
            <button
              onClick={handlePrintReport}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#475569",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              印刷 / PDF保存
            </button>
          )}
        </div>
      )}

      {/* 報告書プレビュー */}
      {reportHtml && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>
            報告書プレビュー
          </h2>
          <div
            data-testid="report-preview"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
              maxHeight: 400,
              overflowY: "auto",
              fontSize: "0.82rem",
            }}
            dangerouslySetInnerHTML={{ __html: reportHtml }}
          />
        </div>
      )}
    </div>
  );
}
