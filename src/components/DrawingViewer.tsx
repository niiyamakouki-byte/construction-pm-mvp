import { useState, useRef, useCallback, useEffect } from "react";
import {
  createPin,
  updatePin,
  deletePin,
  generatePinReport,
  PIN_STATUS_COLORS,
  PIN_STATUSES,
  type DrawingPin,
  type PinStatus,
} from "../lib/drawing-pins.js";
import { htmlToBlob } from "../lib/report-generator.js";
import {
  calibrateScale,
  measureDistance,
  measureArea,
  loadScale,
  saveScale,
  type Point,
} from "../lib/drawing-measure.js";
import { comparePDFs, type DiffResult, type DiffColor } from "../lib/blueprint-diff.js";

type ViewerMode = "pin" | "calibrate" | "measure" | "area" | "diff" | "pickup";

type Props = {
  /** Drawing image URL */
  drawingUrl: string;
  /** Drawing ID for persisting scale per drawing */
  drawingId?: string;
  /** Initial pins (controlled or uncontrolled) */
  initialPins?: DrawingPin[];
  /** Called whenever pins change */
  onPinsChange?: (pins: DrawingPin[]) => void;
  /** Optional second drawing URL for diff mode */
  compareDrawingUrl?: string;
  /** Project name used in the PDF report header */
  projectName?: string;
  /** Drawing name used in the PDF report header */
  drawingName?: string;
};

type PopoverState = {
  pinId: string;
  editing: boolean;
};

type MeasureState =
  | { stage: "idle" }
  | { stage: "first"; first: Point }
  | { stage: "done"; first: Point; second: Point; label: string };

type AreaState =
  | { stage: "collecting"; points: Point[] }
  | { stage: "done"; points: Point[]; areaSqm: number };

type CalibrateState =
  | { stage: "idle" }
  | { stage: "first"; first: Point }
  | { stage: "dialog"; first: Point; second: Point };

export function DrawingViewer({
  drawingUrl,
  drawingId = "default",
  initialPins = [],
  onPinsChange,
  compareDrawingUrl,
  projectName = "プロジェクト",
  drawingName = "図面",
}: Props) {
  const [pins, setPins] = useState<DrawingPin[]>(initialPins);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [draft, setDraft] = useState<Partial<DrawingPin>>({});
  const [mode, setMode] = useState<ViewerMode>("pin");
  const [scale, setScale] = useState<number | null>(null);
  const [measureState, setMeasureState] = useState<MeasureState>({ stage: "idle" });
  const [areaState, setAreaState] = useState<AreaState>({ stage: "collecting", points: [] });
  const [calibrateState, setCalibrateState] = useState<CalibrateState>({ stage: "idle" });
  const [calibrateInput, setCalibrateInput] = useState("");
  const [pinchActive, setPinchActive] = useState(false);
  // diff mode state
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffRunning, setDiffRunning] = useState(false);
  const [diffOpacity, setDiffOpacity] = useState(0.7);
  const [oldOpacity, setOldOpacity] = useState(0.5);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const oldImgRef = useRef<HTMLImageElement | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load persisted scale on mount
  useEffect(() => {
    const saved = loadScale(drawingId);
    if (saved !== null) setScale(saved);
  }, [drawingId]);

  const notify = (next: DrawingPin[]) => {
    setPins(next);
    onPinsChange?.(next);
  };

  const getPixelPos = useCallback((clientX: number, clientY: number): Point | null => {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;
    return { x, y };
  }, []);

  const getRelativePos = useCallback((clientX: number, clientY: number): Point | null => {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

  // Pinch detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      setPinchActive(true);
      return;
    }
    setPinchActive(false);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) setPinchActive(false);
  }, []);

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } | null => {
    if ("touches" in e) {
      if (e.touches.length !== 1) return null;
      const t = e.touches[0];
      if (!t) return null;
      return { clientX: t.clientX, clientY: t.clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (pinchActive) return;
      const pos = getEventPos(e);
      if (!pos) return;

      if (mode === "pin") {
        const rel = getRelativePos(pos.clientX, pos.clientY);
        if (!rel) return;
        setDraft({ x: rel.x, y: rel.y, status: "未着手", comment: "", assignee: "", dueDate: "" });
        setPopover({ pinId: "__new__", editing: true });
        return;
      }

      if (mode === "calibrate") {
        const px = getPixelPos(pos.clientX, pos.clientY);
        if (!px) return;
        if (calibrateState.stage === "idle") {
          setCalibrateState({ stage: "first", first: px });
        } else if (calibrateState.stage === "first") {
          setCalibrateState({ stage: "dialog", first: calibrateState.first, second: px });
          setCalibrateInput("");
        }
        return;
      }

      if (mode === "measure") {
        if (!scale) return;
        const px = getPixelPos(pos.clientX, pos.clientY);
        if (!px) return;
        if (measureState.stage === "idle" || measureState.stage === "done") {
          setMeasureState({ stage: "first", first: px });
        } else if (measureState.stage === "first") {
          const result = measureDistance(measureState.first, px, scale);
          setMeasureState({ stage: "done", first: measureState.first, second: px, label: result.label });
        }
        return;
      }

      if (mode === "area") {
        if (!scale) return;
        const px = getPixelPos(pos.clientX, pos.clientY);
        if (!px) return;
        if (areaState.stage === "collecting") {
          setAreaState({ stage: "collecting", points: [...areaState.points, px] });
        }
        return;
      }
    },
    [mode, pinchActive, calibrateState, measureState, areaState, scale, getPixelPos, getRelativePos]
  );

  // Draw overlays on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mode === "calibrate") {
      const drawPoint = (p: Point) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      };
      if (calibrateState.stage === "first") {
        drawPoint(calibrateState.first);
      } else if (calibrateState.stage === "dialog") {
        drawPoint(calibrateState.first);
        drawPoint(calibrateState.second);
        ctx.beginPath();
        ctx.moveTo(calibrateState.first.x, calibrateState.first.y);
        ctx.lineTo(calibrateState.second.x, calibrateState.second.y);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (mode === "measure") {
      const drawPoint = (p: Point) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      };
      if (measureState.stage === "first") {
        drawPoint(measureState.first);
      } else if (measureState.stage === "done") {
        drawPoint(measureState.first);
        drawPoint(measureState.second);
        ctx.beginPath();
        ctx.moveTo(measureState.first.x, measureState.first.y);
        ctx.lineTo(measureState.second.x, measureState.second.y);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.stroke();
        // dimension label
        const mx = (measureState.first.x + measureState.second.x) / 2;
        const my = (measureState.first.y + measureState.second.y) / 2;
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#1e3a8a";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.strokeText(measureState.label, mx + 4, my - 6);
        ctx.fillText(measureState.label, mx + 4, my - 6);
      }
    }

    if (mode === "area") {
      const points = areaState.stage === "collecting" ? areaState.points : areaState.points;
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0]!.x, points[0]!.y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i]!.x, points[i]!.y);
        }
        if (areaState.stage === "done") ctx.closePath();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (areaState.stage === "done") {
          ctx.fillStyle = "rgba(16,185,129,0.15)";
          ctx.fill();
          // area label
          const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
          const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
          const label = `${areaState.areaSqm.toFixed(2)} ㎡`;
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#064e3b";
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 4;
          ctx.strokeText(label, cx, cy);
          ctx.fillText(label, cx, cy);
        }
        points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#10b981";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
    }
  }, [mode, calibrateState, measureState, areaState]);

  const confirmCalibrate = () => {
    if (calibrateState.stage !== "dialog") return;
    const mm = parseFloat(calibrateInput);
    if (isNaN(mm) || mm <= 0) return;
    const newScale = calibrateScale(calibrateState.first, calibrateState.second, mm);
    setScale(newScale);
    saveScale(drawingId, newScale);
    setCalibrateState({ stage: "idle" });
    setCalibrateInput("");
    setMode("measure");
  };

  const finalizeArea = () => {
    if (areaState.stage !== "collecting" || areaState.points.length < 3 || !scale) return;
    const areaSqm = measureArea(areaState.points, scale);
    setAreaState({ stage: "done", points: areaState.points, areaSqm });
  };

  const resetArea = () => {
    setAreaState({ stage: "collecting", points: [] });
  };

  const switchMode = (next: ViewerMode) => {
    setMode(next);
    setPopover(null);
    if (next !== "calibrate") setCalibrateState({ stage: "idle" });
    if (next !== "measure") setMeasureState({ stage: "idle" });
    if (next !== "area") setAreaState({ stage: "collecting", points: [] });
    if (next !== "diff") { setDiffResult(null); }
  };

  // Run diff when switching to diff mode with both images loaded
  const runDiff = useCallback(() => {
    const newImg = imgRef.current;
    const oldImg = oldImgRef.current;
    if (!newImg || !oldImg) return;
    if (!newImg.complete || !oldImg.complete) return;

    setDiffRunning(true);

    // Draw each image to an offscreen canvas to get ImageData
    const getImageData = (img: HTMLImageElement): ImageData => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("No 2d context");
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height);
    };

    try {
      const oldData = getImageData(oldImg);
      const newData = getImageData(newImg);
      const result = comparePDFs(oldData, newData);
      setDiffResult(result);

      // Auto-place diff pins
      if (result.regions.length > 0) {
        const newW = newImg.naturalWidth || newImg.width;
        const newH = newImg.naturalHeight || newImg.height;
        const DIFF_COLOR_LABEL: Record<DiffColor, string> = {
          added: "追加（青）",
          removed: "削除（赤）",
          changed: "変更（黄）",
        };
        const diffPins: DrawingPin[] = result.regions.slice(0, 20).map((region) => {
          const cx = (region.box.x + region.box.width / 2) / newW;
          const cy = (region.box.y + region.box.height / 2) / newH;
          return createPin({
            x: Math.max(0, Math.min(1, cx)),
            y: Math.max(0, Math.min(1, cy)),
            comment: `ここが変わりました（${DIFF_COLOR_LABEL[region.type]}）`,
            assignee: "",
            dueDate: "",
            status: "未着手",
          });
        });
        notify(diffPins);
      }
    } finally {
      setDiffRunning(false);
    }
  }, []);

  // Render diff overlay onto diffCanvasRef whenever diffResult changes
  useEffect(() => {
    if (mode !== "diff") return;
    const canvas = diffCanvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !diffResult) return;
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale overlay data to displayed size
    const offscreen = document.createElement("canvas");
    offscreen.width = diffResult.overlayData.width;
    offscreen.height = diffResult.overlayData.height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
    offCtx.putImageData(diffResult.overlayData, 0, 0);

    ctx.globalAlpha = diffOpacity;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }, [diffResult, diffOpacity, mode]);

  const handleSaveDraft = () => {
    if (draft.x == null || draft.y == null) return;
    const pin = createPin({
      x: draft.x,
      y: draft.y,
      comment: draft.comment ?? "",
      assignee: draft.assignee ?? "",
      dueDate: draft.dueDate ?? "",
      status: (draft.status as PinStatus) ?? "未着手",
    });
    notify([...pins, pin]);
    setPopover(null);
    setDraft({});
  };

  const handleUpdatePin = (id: string, updates: Partial<DrawingPin>) => {
    notify(updatePin(pins, id, updates));
  };

  const handleDeletePin = (id: string) => {
    notify(deletePin(pins, id));
    setPopover(null);
  };

  const activePin = popover?.pinId !== "__new__" ? pins.find((p) => p.id === popover?.pinId) : null;

  const incompletePins = pins.filter((p) => p.status !== "完了");

  const handleDownloadReport = async (incompleteOnly: boolean) => {
    const html = generatePinReport(pins, projectName, drawingName, { incompleteOnly });
    const blob = await htmlToBlob(html);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `指摘一覧_${drawingName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modeBtns: { key: ViewerMode; label: string }[] = [
    { key: "pin", label: "ピン" },
    { key: "calibrate", label: "縮尺設定" },
    { key: "measure", label: "距離計測" },
    { key: "area", label: "面積計測" },
    { key: "diff", label: "差分" },
  ];

  const noScaleWarning = (mode === "measure" || mode === "area") && !scale;

  return (
    <div className="flex flex-col gap-4 lg:flex-row" ref={containerRef}>
      {/* Drawing canvas area */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 select-none">
        <img
          ref={imgRef}
          src={drawingUrl}
          alt="図面"
          className={`w-full ${mode !== "pin" ? "cursor-crosshair" : "cursor-default"}`}
          onClick={mode === "pin" ? handleCanvasClick : undefined}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          draggable={false}
        />

        {/* Measurement / calibration overlay canvas */}
        {mode !== "pin" && mode !== "diff" && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-auto cursor-crosshair"
            onClick={handleCanvasClick}
            onTouchStart={(e) => { handleTouchStart(e); if (e.touches.length === 1) handleCanvasClick(e); }}
            onTouchEnd={handleTouchEnd}
          />
        )}

        {/* Diff mode: old drawing overlay + diff color canvas */}
        {mode === "diff" && compareDrawingUrl && (
          <>
            {/* Hidden old image loader */}
            <img
              ref={(el) => { oldImgRef.current = el; }}
              src={compareDrawingUrl}
              alt="旧図面"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              style={{ opacity: oldOpacity }}
              onLoad={runDiff}
              crossOrigin="anonymous"
            />
            {/* Diff overlay canvas */}
            <canvas
              ref={(el) => { diffCanvasRef.current = el; }}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </>
        )}

        {/* Pin markers */}
        {mode === "pin" && pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
              backgroundColor: PIN_STATUS_COLORS[pin.status],
            }}
            className="absolute -translate-x-1/2 -translate-y-full rounded-full w-7 h-7 flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white hover:scale-110 transition-transform z-10"
            onClick={(e) => {
              e.stopPropagation();
              setPopover({ pinId: pin.id, editing: false });
              setDraft({});
            }}
            aria-label={`ピン: ${pin.comment || pin.assignee || pin.status}`}
          >
            📌
          </button>
        ))}

        {/* Mode indicator banners */}
        {mode === "pin" && (
          <div className="absolute inset-0 border-2 border-transparent rounded-2xl pointer-events-none flex items-start justify-center pt-3" />
        )}
        {mode === "calibrate" && calibrateState.stage === "idle" && (
          <div className="absolute inset-0 border-2 border-amber-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-amber-500 text-white text-xs px-3 py-1 rounded-full shadow">1点目をタップ</span>
          </div>
        )}
        {mode === "calibrate" && calibrateState.stage === "first" && (
          <div className="absolute inset-0 border-2 border-amber-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-amber-500 text-white text-xs px-3 py-1 rounded-full shadow">2点目をタップ</span>
          </div>
        )}
        {mode === "measure" && !noScaleWarning && (measureState.stage === "idle" || measureState.stage === "done") && (
          <div className="absolute inset-0 border-2 border-blue-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full shadow">1点目をタップ</span>
          </div>
        )}
        {mode === "measure" && !noScaleWarning && measureState.stage === "first" && (
          <div className="absolute inset-0 border-2 border-blue-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full shadow">2点目をタップ</span>
          </div>
        )}
        {mode === "area" && !noScaleWarning && (
          <div className="absolute inset-0 border-2 border-emerald-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-full shadow">
              {areaState.stage === "done"
                ? `面積: ${areaState.areaSqm.toFixed(2)} ㎡`
                : `${areaState.points.length}点 — 3点以上で確定`}
            </span>
          </div>
        )}
        {noScaleWarning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-slate-800/90 text-white text-sm px-4 py-2 rounded-2xl shadow">
              まず縮尺を設定してください
            </span>
          </div>
        )}
        {mode === "diff" && !compareDrawingUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-slate-800/90 text-white text-sm px-4 py-2 rounded-2xl shadow">
              比較する旧図面URLを設定してください
            </span>
          </div>
        )}
        {mode === "diff" && compareDrawingUrl && diffRunning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-slate-800/90 text-white text-sm px-4 py-2 rounded-2xl shadow">
              差分を計算中...
            </span>
          </div>
        )}
        {mode === "diff" && compareDrawingUrl && diffResult && (
          <div className="absolute inset-0 border-2 border-purple-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-purple-600 text-white text-xs px-3 py-1 rounded-full shadow">
              差分: {(diffResult.diffRatio * 100).toFixed(1)}% 変化 / {diffResult.regions.length}箇所
            </span>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col gap-3 lg:w-72">
        {/* Mode buttons */}
        <div className="grid grid-cols-2 gap-2">
          {modeBtns.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={`rounded-2xl py-2.5 text-xs font-bold transition-colors ${
                mode === key
                  ? key === "calibrate"
                    ? "bg-amber-500 text-white"
                    : key === "measure"
                    ? "bg-blue-600 text-white"
                    : key === "area"
                    ? "bg-emerald-600 text-white"
                    : key === "diff"
                    ? "bg-purple-600 text-white"
                    : "bg-blue-600 text-white"
                  : "bg-slate-800 text-white hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scale status */}
        {scale !== null && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            縮尺: <span className="font-bold">{scale.toFixed(4)} px/mm</span>
          </div>
        )}

        {/* Measure result */}
        {mode === "measure" && measureState.stage === "done" && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800 font-bold text-center">
            {measureState.label}
            <button
              type="button"
              onClick={() => setMeasureState({ stage: "idle" })}
              className="block w-full mt-1 text-xs font-normal text-blue-500"
            >
              クリアして再計測
            </button>
          </div>
        )}

        {/* Area actions */}
        {mode === "area" && scale && (
          <div className="flex gap-2">
            {areaState.stage === "collecting" && areaState.points.length >= 3 && (
              <button
                type="button"
                onClick={finalizeArea}
                className="flex-1 rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
              >
                面積確定
              </button>
            )}
            <button
              type="button"
              onClick={resetArea}
              className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600"
            >
              リセット
            </button>
          </div>
        )}

        {/* Diff controls */}
        {mode === "diff" && compareDrawingUrl && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={runDiff}
              disabled={diffRunning}
              className="rounded-2xl bg-purple-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {diffRunning ? "計算中..." : "差分を再実行"}
            </button>
            {diffResult && (
              <>
                <div className="rounded-xl bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-800 space-y-1">
                  <p className="font-bold">差分結果</p>
                  <p>変化率: {(diffResult.diffRatio * 100).toFixed(2)}%</p>
                  <p>変化箇所: {diffResult.regions.length}箇所</p>
                  <div className="flex gap-2 mt-1">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-600" />追加</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-600" />削除</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />変更</span>
                  </div>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  差分オーバーレイ透明度
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={diffOpacity}
                    onChange={(e) => setDiffOpacity(parseFloat(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  旧図面の透明度
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={oldOpacity}
                    onChange={(e) => setOldOpacity(parseFloat(e.target.value))}
                    className="w-full accent-slate-500"
                  />
                </label>
              </>
            )}
          </div>
        )}

        {/* Pin list (only in pin mode) */}
        {mode === "pin" && (
          <>
            <button
              type="button"
              onClick={() => { setPopover(null); }}
              className="rounded-2xl py-3 text-sm font-bold transition-colors bg-blue-600 text-white"
              style={{ display: "none" }}
            />
            {/* PDF report download button */}
            <button
              type="button"
              onClick={() => handleDownloadReport(true)}
              className="relative rounded-2xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors"
              aria-label="指摘一覧PDF"
            >
              指摘一覧PDF
              {incompletePins.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-bold text-slate-900">
                  {incompletePins.length}
                </span>
              )}
            </button>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh]">
              {pins.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4">ピンがありません</p>
              )}
              {pins.map((pin, idx) => (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() => setPopover({ pinId: pin.id, editing: false })}
                  className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: PIN_STATUS_COLORS[pin.status] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">
                      #{idx + 1} {pin.comment || "(コメントなし)"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {pin.assignee} {pin.dueDate ? `· ${pin.dueDate}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: PIN_STATUS_COLORS[pin.status] }}>
                    {pin.status}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Calibrate distance dialog */}
      {mode === "calibrate" && calibrateState.stage === "dialog" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setCalibrateState({ stage: "idle" })}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 mb-3">既知距離を入力</h3>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              実寸法 (mm)
              <input
                type="number"
                value={calibrateInput}
                onChange={(e) => setCalibrateInput(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none"
                placeholder="例: 3000"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmCalibrate(); }}
              />
            </label>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={confirmCalibrate}
                className="flex-1 rounded-2xl bg-amber-500 py-2.5 text-sm font-bold text-white"
              >
                縮尺を設定
              </button>
              <button
                type="button"
                onClick={() => setCalibrateState({ stage: "idle" })}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pin Popover */}
      {mode === "pin" && popover && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setPopover(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {popover.pinId === "__new__" ? (
              <NewPinForm
                draft={draft}
                onChange={setDraft}
                onSave={handleSaveDraft}
                onCancel={() => setPopover(null)}
              />
            ) : activePin ? (
              <PinDetail
                pin={activePin}
                editing={popover.editing}
                onEdit={() => setPopover({ pinId: activePin.id, editing: true })}
                onChange={(updates) => handleUpdatePin(activePin.id, updates)}
                onDelete={() => handleDeletePin(activePin.id)}
                onClose={() => setPopover(null)}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

type NewPinFormProps = {
  draft: Partial<DrawingPin>;
  onChange: (d: Partial<DrawingPin>) => void;
  onSave: () => void;
  onCancel: () => void;
};

function NewPinForm({ draft, onChange, onSave, onCancel }: NewPinFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-bold text-slate-800">ピンを追加</h3>
      <PinFields pin={draft} onChange={onChange} />
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="flex-1 rounded-2xl bg-slate-800 py-2.5 text-sm font-bold text-white">
          追加
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600">
          キャンセル
        </button>
      </div>
    </div>
  );
}

type PinDetailProps = {
  pin: DrawingPin;
  editing: boolean;
  onEdit: () => void;
  onChange: (updates: Partial<DrawingPin>) => void;
  onDelete: () => void;
  onClose: () => void;
};

function PinDetail({ pin, editing, onEdit, onChange, onDelete, onClose }: PinDetailProps) {
  const [local, setLocal] = useState<Partial<DrawingPin>>(pin);

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-bold text-slate-800">ピンを編集</h3>
        <PinFields pin={local} onChange={(u) => setLocal((p) => ({ ...p, ...u }))} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onChange(local); onClose(); }}
            className="flex-1 rounded-2xl bg-slate-800 py-2.5 text-sm font-bold text-white"
          >
            保存
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600">
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">ピン詳細</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
        <p><span className="font-semibold">コメント:</span> {pin.comment || "—"}</p>
        <p><span className="font-semibold">担当者:</span> {pin.assignee || "—"}</p>
        <p><span className="font-semibold">期日:</span> {pin.dueDate || "—"}</p>
        <p>
          <span className="font-semibold">ステータス:</span>{" "}
          <span className="font-bold" style={{ color: PIN_STATUS_COLORS[pin.status] }}>{pin.status}</span>
        </p>
      </div>
      {/* Quick status change */}
      <div className="flex gap-2">
        {PIN_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ status: s })}
            className="flex-1 rounded-full py-1.5 text-xs font-bold text-white transition-opacity"
            style={{
              backgroundColor: PIN_STATUS_COLORS[s],
              opacity: pin.status === s ? 1 : 0.4,
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onEdit} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          編集
        </button>
        <button type="button" onClick={onDelete} className="flex-1 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white">
          削除
        </button>
      </div>
    </div>
  );
}

type PinFieldsProps = {
  pin: Partial<DrawingPin>;
  onChange: (updates: Partial<DrawingPin>) => void;
};

function PinFields({ pin, onChange }: PinFieldsProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        コメント
        <input
          type="text"
          value={pin.comment ?? ""}
          onChange={(e) => onChange({ comment: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
          placeholder="指摘内容など"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        担当者
        <input
          type="text"
          value={pin.assignee ?? ""}
          onChange={(e) => onChange({ assignee: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
          placeholder="氏名"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        期日
        <input
          type="date"
          value={pin.dueDate ?? ""}
          onChange={(e) => onChange({ dueDate: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
        />
      </label>
      <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        ステータス
        <div className="flex gap-2">
          {PIN_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ status: s })}
              className="flex-1 rounded-full py-1.5 text-xs font-bold text-white transition-opacity"
              style={{
                backgroundColor: PIN_STATUS_COLORS[s],
                opacity: pin.status === s ? 1 : 0.35,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
