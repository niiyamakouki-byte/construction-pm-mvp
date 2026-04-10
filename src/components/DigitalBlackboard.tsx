import { useRef, useState, useEffect, useCallback } from "react";
import {
  compositeBlackboard,
  downloadCanvas,
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  type BlackboardData,
  type BlackboardTemplate,
} from "../lib/digital-blackboard.js";

type Props = {
  /** Optional initial photo URL for preview */
  photoUrl?: string;
  /** Default values pre-filled from project context */
  defaults?: Partial<BlackboardData>;
};

const today = () => new Date().toISOString().slice(0, 10);

export function DigitalBlackboard({ photoUrl, defaults }: Props) {
  const [data, setData] = useState<BlackboardData>({
    projectName: defaults?.projectName ?? "",
    shootDate: defaults?.shootDate ?? today(),
    workType: defaults?.workType ?? "",
    location: defaults?.location ?? "",
    condition: defaults?.condition ?? "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(photoUrl ?? "");
  const [templates, setTemplates] = useState<BlackboardTemplate[]>([]);
  const [composited, setComposited] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const handleFile = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setComposited(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  };

  const handleChange = (field: keyof BlackboardData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setData((prev) => ({ ...prev, [field]: e.target.value }));
    setComposited(false);
  };

  const applyTemplate = (tpl: BlackboardTemplate) => {
    setData((prev) => ({
      ...prev,
      projectName: tpl.projectName,
      workType: tpl.workType,
    }));
    setComposited(false);
  };

  const handleSaveTemplate = () => {
    const tpl: BlackboardTemplate = {
      id: crypto.randomUUID(),
      projectName: data.projectName,
      workType: data.workType,
    };
    saveTemplate(tpl);
    setTemplates(loadTemplates());
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
    setTemplates(loadTemplates());
  };

  const handleComposite = useCallback(() => {
    if (!canvasRef.current) return;
    const img = imgRef.current;
    if (!img) return;
    const canvas = compositeBlackboard(img, data);
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = canvas.width;
    canvasRef.current.height = canvas.height;
    ctx.drawImage(canvas, 0, 0);
    setComposited(true);
  }, [data]);

  const handleDownload = () => {
    if (!canvasRef.current || !composited) return;
    const fname = `blackboard_${data.projectName || "photo"}_${data.shootDate}.jpg`;
    downloadCanvas(canvasRef.current, fname);
  };

  const hasImage = !!previewUrl || !!imageFile;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-bold text-slate-800">電子黒板</h2>

      {/* Drop zone / file picker */}
      <label
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 text-sm text-slate-500 cursor-pointer hover:border-slate-400 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        aria-label="写真を選択またはドロップ"
      >
        <span className="mb-1 text-2xl">📷</span>
        <span>写真を選択またはドロップ</span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm">
              <button
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="text-slate-700 hover:text-slate-900"
              >
                {tpl.projectName} / {tpl.workType}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(tpl.id)}
                className="ml-1 text-slate-400 hover:text-red-500"
                aria-label="テンプレート削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ["projectName", "工事名"],
            ["shootDate", "撮影日"],
            ["workType", "工種"],
            ["location", "部位"],
            ["condition", "状況"],
          ] as [keyof BlackboardData, string][]
        ).map(([field, label]) => (
          <label key={field} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            {label}
            <input
              type={field === "shootDate" ? "date" : "text"}
              value={data[field]}
              onChange={handleChange(field)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
            />
          </label>
        ))}
      </div>

      {/* Save template button */}
      <button
        type="button"
        onClick={handleSaveTemplate}
        className="self-start rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 shadow-sm hover:bg-slate-50"
      >
        テンプレート保存
      </button>

      {/* Preview canvas */}
      {hasImage && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {/* Hidden img for drawing */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            src={previewUrl}
            className="hidden"
            ref={(el) => { imgRef.current = el; }}
            onLoad={handleComposite}
            aria-hidden="true"
          />
          <canvas
            ref={canvasRef}
            className="w-full"
            aria-label="黒板合成プレビュー"
          />
          {!composited && previewUrl && (
            <img
              src={previewUrl}
              alt="プレビュー"
              className="w-full rounded-2xl"
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleComposite}
          disabled={!hasImage}
          className="flex-1 rounded-2xl bg-slate-800 py-3 text-sm font-bold text-white disabled:opacity-40 active:opacity-70"
        >
          黒板を合成
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!composited}
          className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40 active:opacity-70"
        >
          ダウンロード
        </button>
      </div>
    </div>
  );
}
