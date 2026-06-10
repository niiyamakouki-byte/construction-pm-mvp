import { useState, useRef, useCallback, useEffect } from "react";
import {
  sessionToEstimateItems,
  writeEstimateInject,
} from "../lib/takeoff-to-estimate.js";
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
import { resolveDrawingScale } from "../lib/drawing-scale-auto.js";
import { comparePDFs, type DiffResult, type DiffColor } from "../lib/blueprint-diff.js";
import {
  createSession,
  addSegment,
  removeSegment,
  updateSegment,
  summariseSession,
  summariseWithCost,
  sessionTotalCost,
  suggestForRow,
  exportSessionCSV,
  exportSessionJSON,
  saveSession,
  loadSession,
  listSessionIds,
  createTakeoffUndoStack,
  withUndo,
  TAKEOFF_SEGMENT_CATEGORIES,
  TAKEOFF_CATEGORY_COLORS,
  polylineLengthPx,
  pxLengthToMetres,
  type TakeoffSessionState,
  type TakeoffSegmentCategory,
} from "../lib/takeoff-session.js";
import type { CostMasterEntry } from "../lib/measurement-to-estimate-link.js";
import {
  processPickupPoint,
  isNearFirstPoint,
} from "../lib/drawing-takeoff.js";
import type { TakeoffPoint } from "../lib/drawing-takeoff.js";
import {
  simplifyStroke,
  classifyStroke,
  type PenSample,
} from "../lib/pen-stroke.js";

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
  /** Cost master entries for pickup mode auto-matching */
  costMaster?: CostMasterEntry[];
  /** Project ID for session persistence */
  projectId?: string;
  /**
   * PDF テキスト検出による縮尺（mm/pt）。
   * localStorage に手動値がなければ自動的に scale の初期値として使われる。
   */
  detectedScaleMmPerPt?: number;
  /**
   * 表示用縮尺ラベル（例: "1:50"）。detectedScaleMmPerPt が有効なときに UI に表示。
   */
  detectedScaleLabel?: string;
  /**
   * PDF をラスタライズした際のレンダリング解像度（px/pt）。
   * 省略時は標準スクリーン解像度 96dpi (= 96/72 ≈ 1.333 px/pt) を使用。
   */
  renderPxPerPt?: number;
};

type PopoverState = {
  pinId: string;
  editing: boolean;
};

type MeasureState =
  | { stage: "idle" }
  | { stage: "first"; first: Point }
  | { stage: "done"; first: Point; second: Point; label: string }
  | { stage: "adjust"; first: Point; second: Point; target: "first" | "second" };

type MeasurePreviewState = {
  point: Point;
  label: string;
};

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
  costMaster = [],
  projectId,
  detectedScaleMmPerPt,
  detectedScaleLabel,
  renderPxPerPt,
}: Props) {
  const [pins, setPins] = useState<DrawingPin[]>(initialPins);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [draft, setDraft] = useState<Partial<DrawingPin>>({});
  const [mode, setMode] = useState<ViewerMode>("pin");
  const [scale, setScale] = useState<number | null>(null);
  const [scaleIsAuto, setScaleIsAuto] = useState(false);
  const [autoScaleLabel, setAutoScaleLabel] = useState<string | null>(null);
  const [measureState, setMeasureState] = useState<MeasureState>({ stage: "idle" });
  const [measurePreview, setMeasurePreview] = useState<MeasurePreviewState | null>(null);
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

  // Pickup / takeoff session state
  const [pickupSession, setPickupSession] = useState<TakeoffSessionState>(() =>
    createSession(drawingId, projectId),
  );
  const [pickupCategory, setPickupCategory] = useState<TakeoffSegmentCategory>("壁");
  const [pickupKind, setPickupKind] = useState<"distance" | "area">("area");
  const [pickupLabel, setPickupLabel] = useState("");
  // Suggestions panel: which summary row index is expanded
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const pickupUndoStack = useRef(createTakeoffUndoStack());
  // Pickup drawing points (for line or area tracing)
  const [pickupPoints, setPickupPoints] = useState<Point[]>([]);
  const [pickupDrawing, setPickupDrawing] = useState(false);
  // AI prediction: ghost point for next likely position
  const [pickupPrediction, setPickupPrediction] = useState<TakeoffPoint | null>(null);
  // Pen stroke (Apple Pencil) live samples for pickup mode
  const penSamplesRef = useRef<PenSample[]>([]);
  const penActiveRef = useRef(false);
  const [penStrokePreview, setPenStrokePreview] = useState<PenSample[]>([]);

  const buildMeasureDoneState = useCallback(
    (first: Point, second: Point): MeasureState => {
      const result = measureDistance(first, second, scale ?? 0);
      return { stage: "done", first, second, label: result.label };
    },
    [scale],
  );

  const snapMeasurePoint = useCallback((candidate: Point, anchor: Point): Point => {
    const { snapped } = processPickupPoint(candidate, [anchor]);
    return snapped;
  }, []);

  const buildMeasurePreview = useCallback(
    (first: Point, candidate: Point): MeasurePreviewState => {
      const snapped = snapMeasurePoint(candidate, first);
      const result = measureDistance(first, snapped, scale ?? 0);
      return { point: snapped, label: result.label };
    },
    [scale, snapMeasurePoint],
  );

  // Load persisted scale on mount; fall back to PDF auto-detected scale if no manual value saved
  useEffect(() => {
    const saved = loadScale(drawingId);
    const resolved = resolveDrawingScale(
      saved,
      detectedScaleMmPerPt ?? null,
      detectedScaleLabel ?? null,
      renderPxPerPt,
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drawingId変化時にlocalStorageから倍率を復元する初期化パターン
    if (resolved.scale !== null) setScale(resolved.scale);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同上
    setScaleIsAuto(resolved.isAutoDetected);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同上
    setAutoScaleLabel(resolved.detectedScaleLabel);
  }, [drawingId, detectedScaleMmPerPt, detectedScaleLabel, renderPxPerPt]);

  // Load most recent pickup session for this drawing on mount
  useEffect(() => {
    const ids = listSessionIds(drawingId);
    if (ids.length > 0) {
      const loaded = loadSession(ids[ids.length - 1]!);
      if (loaded) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- drawingId変化時にlocalStorageからセッションを復元する初期化パターン
        setPickupSession(loaded);
      }
    }
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
    // パームリジェクション: ペン入力進行中はタッチ系を完全無視
    if (penActiveRef.current) return;
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
      // パームリジェクション: ペン入力進行中はタッチ系の頂点置きを無視
      if (penActiveRef.current && "touches" in e) return;
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
          setMeasureState(buildMeasureDoneState(measureState.first, snapMeasurePoint(px, measureState.first)));
        } else if (measureState.stage === "adjust") {
          const first =
            measureState.target === "first"
              ? snapMeasurePoint(px, measureState.second)
              : measureState.first;
          const second =
            measureState.target === "second"
              ? snapMeasurePoint(px, measureState.first)
              : measureState.second;
          setMeasureState(buildMeasureDoneState(first, second));
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

      if (mode === "pickup") {
        if (!scale) return;
        const px = getPixelPos(pos.clientX, pos.clientY);
        if (!px) return;
        setPickupPoints((pts) => {
          const { snapped, prediction } = processPickupPoint(px, pts);
          // Auto-close: if area mode and near first point (≥3 pts), treat as finalize
          const first = pts[0];
          if (pickupKind === "area" && pts.length >= 3 && first && isNearFirstPoint(snapped, first)) {
            // Trigger finalize on next render via a synthetic flag — we can't call
            // finalizePickupSegment here (closure over stale pts). Instead just
            // return pts unchanged and set a flag via an effect workaround.
            // Simpler: close the polygon by adding the first point so the segment
            // is computed correctly on finalizePickupSegment.
            setPickupPrediction(null);
            return [...pts, first];
          }
          setPickupPrediction(prediction);
          setPickupDrawing(true);
          return [...pts, snapped];
        });
        return;
      }
    },
    [mode, pinchActive, calibrateState, measureState, areaState, scale, getPixelPos, getRelativePos, buildMeasureDoneState, snapMeasurePoint]
  );

  const handleMeasurePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== "measure" || !scale) return;
      if (measureState.stage !== "first" && measureState.stage !== "adjust") {
        setMeasurePreview(null);
        return;
      }
      const px = getPixelPos(e.clientX, e.clientY);
      if (!px) {
        setMeasurePreview(null);
        return;
      }
      if (measureState.stage === "first") {
        setMeasurePreview(buildMeasurePreview(measureState.first, px));
        return;
      }
      const anchor = measureState.target === "first" ? measureState.second : measureState.first;
      setMeasurePreview(buildMeasurePreview(anchor, px));
    },
    [mode, scale, measureState, getPixelPos, buildMeasurePreview],
  );

  const clearMeasurePreview = useCallback(() => {
    setMeasurePreview(null);
  }, []);

  useEffect(() => {
    if (
      mode !== "measure" ||
      (measureState.stage !== "first" && measureState.stage !== "adjust")
    ) {
      setMeasurePreview(null);
    }
  }, [mode, measureState]);

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
        if (measurePreview) {
          drawPoint(measurePreview.point);
          ctx.beginPath();
          ctx.moveTo(measureState.first.x, measureState.first.y);
          ctx.lineTo(measurePreview.point.x, measurePreview.point.y);
          ctx.strokeStyle = "rgba(59,130,246,0.6)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          const mx = (measureState.first.x + measurePreview.point.x) / 2;
          const my = (measureState.first.y + measurePreview.point.y) / 2;
          ctx.font = "bold 13px sans-serif";
          ctx.fillStyle = "#1e3a8a";
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 4;
          ctx.strokeText(measurePreview.label, mx + 4, my - 6);
          ctx.fillText(measurePreview.label, mx + 4, my - 6);
        }
      } else if (measureState.stage === "done" || measureState.stage === "adjust") {
        drawPoint(measureState.first);
        drawPoint(measureState.second);
        ctx.beginPath();
        ctx.moveTo(measureState.first.x, measureState.first.y);
        ctx.lineTo(measureState.second.x, measureState.second.y);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (measureState.stage === "adjust" && measurePreview) {
          const anchor = measureState.target === "first" ? measureState.second : measureState.first;
          drawPoint(measurePreview.point);
          ctx.beginPath();
          ctx.moveTo(anchor.x, anchor.y);
          ctx.lineTo(measurePreview.point.x, measurePreview.point.y);
          ctx.strokeStyle = "rgba(59,130,246,0.6)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          const mx = (anchor.x + measurePreview.point.x) / 2;
          const my = (anchor.y + measurePreview.point.y) / 2;
          ctx.font = "bold 13px sans-serif";
          ctx.fillStyle = "#1e3a8a";
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 4;
          ctx.strokeText(measurePreview.label, mx + 4, my - 6);
          ctx.fillText(measurePreview.label, mx + 4, my - 6);
        }
        if (measureState.stage === "done") {
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
    if (mode === "pickup" && pickupPoints.length > 0) {
      ctx.beginPath();
      // Per-category color for the active trace
      const catColor = TAKEOFF_CATEGORY_COLORS[pickupCategory] ?? "#f97316";
      ctx.moveTo(pickupPoints[0]!.x, pickupPoints[0]!.y);
      for (let i = 1; i < pickupPoints.length; i++) {
        ctx.lineTo(pickupPoints[i]!.x, pickupPoints[i]!.y);
      }
      ctx.strokeStyle = catColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      pickupPoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = catColor;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      // Draw prediction ghost point (ベクトル延長補完)
      if (pickupPrediction) {
        const last = pickupPoints[pickupPoints.length - 1]!;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pickupPrediction.x, pickupPrediction.y);
        ctx.strokeStyle = catColor + "55";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(pickupPrediction.x, pickupPrediction.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = catColor + "55";
        ctx.fill();
        ctx.strokeStyle = catColor + "99";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Draw snap-to-close indicator when near first point
      if (pickupKind === "area" && pickupPoints.length >= 3) {
        const first = pickupPoints[0]!;
        ctx.beginPath();
        ctx.arc(first.x, first.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(34,197,94,0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ペンストロークのライブプレビュー (pickupモードのみ)
    if (mode === "pickup" && penStrokePreview.length > 1) {
      const catColor = TAKEOFF_CATEGORY_COLORS[pickupCategory] ?? "#f97316";
      ctx.strokeStyle = catColor;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // 区間ごとに筆圧で太さを変える (1.5〜4px)
      for (let i = 1; i < penStrokePreview.length; i++) {
        const a = penStrokePreview[i - 1]!;
        const b = penStrokePreview[i]!;
        const p = (a.pressure + b.pressure) / 2;
        ctx.lineWidth = 1.5 + Math.min(Math.max(p, 0), 1) * 2.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }, [mode, calibrateState, measureState, measurePreview, areaState, pickupPoints, pickupPrediction, pickupKind, pickupCategory, penStrokePreview]);

  const confirmCalibrate = () => {
    if (calibrateState.stage !== "dialog") return;
    const mm = parseFloat(calibrateInput);
    if (isNaN(mm) || mm <= 0) return;
    const newScale = calibrateScale(calibrateState.first, calibrateState.second, mm);
    setScale(newScale);
    setScaleIsAuto(false);
    setAutoScaleLabel(null);
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

  // ── Pickup mode helpers ──────────────────────────────────────────────────────

  const finalizePickupSegment = useCallback(() => {
    if (!scale || pickupPoints.length < 2) return;
    let value: number;
    if (pickupKind === "area") {
      if (pickupPoints.length < 3) return;
      // measureArea returns ㎡
      value = measureArea(pickupPoints, scale);
    } else {
      // Sum all polyline segment lengths (not just first→last straight line)
      const totalPx = polylineLengthPx(pickupPoints);
      value = pxLengthToMetres(totalPx, scale);
    }
    if (value <= 0) return;
    const next = withUndo(pickupUndoStack.current, pickupSession, (s) =>
      addSegment(s, {
        category: pickupCategory,
        measureKind: pickupKind,
        value,
        label: pickupLabel || undefined,
      }),
    );
    setPickupSession(next);
    saveSession(next);
    setPickupPoints([]);
    setPickupDrawing(false);
    setPickupLabel("");
    setPickupPrediction(null);
  }, [scale, pickupPoints, pickupKind, pickupCategory, pickupLabel, pickupSession]);

  const resetPickupPoints = useCallback(() => {
    setPickupPoints([]);
    setPickupDrawing(false);
    setPickupPrediction(null);
  }, []);

  // ペンストロークで生成された確定点列を、タップ式 state を経由せず直接 session に追加する。
  // タップ式と異なり snap/予測は適用しない（連続サンプルなので不要）。
  const finalizePickupFromStroke = useCallback(
    (points: Point[], kind: "distance" | "area") => {
      if (!scale) return;
      let value: number;
      if (kind === "area") {
        if (points.length < 3) return;
        value = measureArea(points, scale);
      } else {
        if (points.length < 2) return;
        const totalPx = polylineLengthPx(points);
        value = pxLengthToMetres(totalPx, scale);
      }
      if (value <= 0) return;
      const next = withUndo(pickupUndoStack.current, pickupSession, (s) =>
        addSegment(s, {
          category: pickupCategory,
          measureKind: kind,
          value,
          label: pickupLabel || undefined,
        }),
      );
      setPickupSession(next);
      saveSession(next);
      setPickupLabel("");
    },
    [scale, pickupCategory, pickupLabel, pickupSession],
  );

  // ── Pen (Apple Pencil) pointer event handlers ─────────────────────────────
  // タッチ/マウスのタップ頂点置きは触らない。pointerType === "pen" のみストローク扱い。

  const handlePickupPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== "pickup") return;
      if (e.pointerType !== "pen") return;
      if (!scale) return;
      const px = getPixelPos(e.clientX, e.clientY);
      if (!px) return;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      penActiveRef.current = true;
      const sample: PenSample = {
        x: px.x,
        y: px.y,
        pressure: e.pressure || 0.5,
        t: e.timeStamp,
      };
      penSamplesRef.current = [sample];
      setPenStrokePreview([sample]);
    },
    [mode, scale, getPixelPos],
  );

  const handlePickupPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!penActiveRef.current) return;
      if (e.pointerType !== "pen") return;
      // 高頻度サンプルがある環境では coalesced events を全部使う
      const native = e.nativeEvent;
      const events: PointerEvent[] = native.getCoalescedEvents
        ? native.getCoalescedEvents()
        : [native];
      const fallback = events.length > 0 ? events : [native];
      const newSamples: PenSample[] = [];
      for (const ev of fallback) {
        const px = getPixelPos(ev.clientX, ev.clientY);
        if (!px) continue;
        newSamples.push({
          x: px.x,
          y: px.y,
          pressure: (ev as PointerEvent).pressure || 0.5,
          t: ev.timeStamp,
        });
      }
      if (newSamples.length === 0) return;
      penSamplesRef.current = penSamplesRef.current.concat(newSamples);
      setPenStrokePreview(penSamplesRef.current.slice());
    },
    [getPixelPos],
  );

  const finishPenStroke = useCallback(
    (commit: boolean) => {
      if (!penActiveRef.current) return;
      penActiveRef.current = false;
      const samples = penSamplesRef.current;
      penSamplesRef.current = [];
      setPenStrokePreview([]);
      if (!commit || samples.length < 2) return;
      const simplified = simplifyStroke(samples, 2);
      const result = classifyStroke(simplified);
      if (result.kind === "polygon") {
        finalizePickupFromStroke(result.points, "area");
      } else {
        // line / polyline はどちらも距離扱い (折れ線長)
        finalizePickupFromStroke(result.points, "distance");
      }
    },
    [finalizePickupFromStroke],
  );

  const handlePickupPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType !== "pen") return;
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
      finishPenStroke(true);
    },
    [finishPenStroke],
  );

  const handlePickupPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType !== "pen") return;
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
      finishPenStroke(false);
    },
    [finishPenStroke],
  );

  // Keyboard: Enter or Escape in pickup mode
  useEffect(() => {
    if (mode !== "pickup") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finalizePickupSegment();
      } else if (e.key === "Escape") {
        resetPickupPoints();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, finalizePickupSegment, resetPickupPoints]);

  const undoPickup = useCallback(() => {
    const prev = pickupUndoStack.current.undo();
    if (!prev) return;
    setPickupSession(prev);
    saveSession(prev);
  }, []);

  const removePickupSegment = useCallback((segId: string) => {
    const next = withUndo(pickupUndoStack.current, pickupSession, (s) =>
      removeSegment(s, segId),
    );
    setPickupSession(next);
    saveSession(next);
  }, [pickupSession]);

  const linkPickupSegment = useCallback(
    (segId: string, code: string, name: string) => {
      const next = withUndo(pickupUndoStack.current, pickupSession, (s) =>
        updateSegment(s, segId, { linkedCostCode: code, linkedCostName: name }),
      );
      setPickupSession(next);
      saveSession(next);
    },
    [pickupSession],
  );

  const handlePickupExportCSV = useCallback(() => {
    const csv = exportSessionCSV(pickupSession);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `拾い出し_${drawingName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pickupSession, drawingName]);

  const handlePickupExportJSON = useCallback(() => {
    const json = exportSessionJSON(pickupSession);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `拾い出し_${drawingName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pickupSession, drawingName]);

  const handleSendToEstimate = useCallback(() => {
    const items = sessionToEstimateItems(pickupSession);
    if (items.length === 0) return;
    writeEstimateInject(items);
    window.location.hash = "/estimate";
  }, [pickupSession]);

  const switchMode = (next: ViewerMode) => {
    setMode(next);
    setPopover(null);
    if (next !== "calibrate") setCalibrateState({ stage: "idle" });
    if (next !== "measure") setMeasureState({ stage: "idle" });
    if (next !== "measure") setMeasurePreview(null);
    if (next !== "area") setAreaState({ stage: "collecting", points: [] });
    if (next !== "diff") { setDiffResult(null); }
    if (next !== "pickup") { setPickupPoints([]); setPickupDrawing(false); setPickupPrediction(null); }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify は非メモ化関数のため deps 追加すると再生成ループになる
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
    { key: "pickup", label: "拾い出し" },
  ];

  const noScaleWarning = (mode === "measure" || mode === "area") && !scale;

  // Mobile: sidebar open/close toggle (hidden below lg)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:gap-4" ref={containerRef}>
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
            // pickupモード時のみピンチ等を抑止してペンストロークを優先
            style={mode === "pickup" ? { touchAction: "none" } : undefined}
            onClick={handleCanvasClick}
            onTouchStart={(e) => { handleTouchStart(e); if (e.touches.length === 1) handleCanvasClick(e); }}
            onTouchEnd={handleTouchEnd}
            onPointerMove={mode === "measure" ? handleMeasurePointerMove : mode === "pickup" ? handlePickupPointerMove : undefined}
            onPointerLeave={mode === "measure" ? clearMeasurePreview : undefined}
            onPointerDown={mode === "pickup" ? handlePickupPointerDown : undefined}
            onPointerUp={mode === "pickup" ? handlePickupPointerUp : undefined}
            onPointerCancel={mode === "pickup" ? handlePickupPointerCancel : undefined}
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
        {mode === "measure" && !noScaleWarning && measureState.stage === "adjust" && (
          <div className="absolute inset-0 border-2 border-blue-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full shadow">
              {measureState.target === "first" ? "始点の新しい位置をタップ" : "終点の新しい位置をタップ"}
            </span>
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
        {mode === "pickup" && !scale && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-slate-800/90 text-white text-sm px-4 py-2 rounded-2xl shadow">
              まず縮尺を設定してください
            </span>
          </div>
        )}
        {mode === "pickup" && scale && (
          <div className="absolute inset-0 border-2 border-orange-400 rounded-2xl pointer-events-none flex items-start justify-center pt-3">
            <span className="bg-orange-500 text-white text-xs px-3 py-1 rounded-full shadow">
              {pickupDrawing && pickupKind === "area" && pickupPoints.length >= 3
                ? `${pickupPoints.length}点 — 最初の点付近でオートクローズ`
                : pickupDrawing
                ? `${pickupPoints.length}点 — 確定 or リセット`
                : "図面をタップして計測"}
            </span>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="flex w-full flex-col gap-3 lg:w-72">
        {/* Mode buttons: horizontal scroll on mobile, 2-column grid on desktop */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar lg:grid lg:grid-cols-2 lg:gap-2 lg:overflow-visible lg:pb-0">
          {modeBtns.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={`flex-shrink-0 rounded-2xl px-3 min-h-[44px] py-2 text-xs font-bold transition-colors lg:flex-shrink lg:py-2.5 ${
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

        {/* Mobile: panel toggle — shown only below lg */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((o) => !o)}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 min-h-[44px] lg:hidden"
          aria-label={mobileSidebarOpen ? "パネルを閉じる" : "パネルを開く"}
        >
          <span>{mobileSidebarOpen ? "設定・集計パネルを閉じる" : "設定・集計パネルを開く"}</span>
          <span>{mobileSidebarOpen ? "▲" : "▼"}</span>
        </button>

        {/* Panel content: always shown on desktop, toggle-able on mobile */}
        <div className={`flex flex-col gap-3 lg:flex ${mobileSidebarOpen ? "flex" : "hidden"}`}>

        {/* Scale status */}
        {scale !== null && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 space-y-0.5">
            <div>
              縮尺: <span className="font-bold">{scale.toFixed(4)} px/mm</span>
            </div>
            {scaleIsAuto && autoScaleLabel && (
              <div className="text-[10px] text-teal-700 font-medium">
                縮尺 {autoScaleLabel} を自動検出
              </div>
            )}
          </div>
        )}

        {/* Measure result */}
        {mode === "measure" && measureState.stage === "done" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm text-blue-800">
            <div className="font-bold">{measureState.label}</div>
            <div className="mt-1 text-[11px] text-blue-600">2点を後から微調整できます</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setMeasureState({
                    stage: "adjust",
                    first: measureState.first,
                    second: measureState.second,
                    target: "first",
                  })
                }
                className="rounded-xl border border-blue-200 bg-white px-2 py-1.5 text-xs font-medium text-blue-700"
              >
                始点調整
              </button>
              <button
                type="button"
                onClick={() =>
                  setMeasureState({
                    stage: "adjust",
                    first: measureState.first,
                    second: measureState.second,
                    target: "second",
                  })
                }
                className="rounded-xl border border-blue-200 bg-white px-2 py-1.5 text-xs font-medium text-blue-700"
              >
                終点調整
              </button>
              <button
                type="button"
                onClick={() => setMeasureState({ stage: "idle" })}
                className="rounded-xl border border-blue-200 bg-white px-2 py-1.5 text-xs font-medium text-blue-700"
              >
                再計測
              </button>
            </div>
          </div>
        )}

        {mode === "measure" && measurePreview && (measureState.stage === "first" || measureState.stage === "adjust") && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-center text-xs text-sky-800">
            <div className="font-bold">プレビュー: {measurePreview.label}</div>
            <div className="mt-1 text-[11px] text-sky-600">タップ前の吸着位置を表示中</div>
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

        {/* Pickup sidebar */}
        {mode === "pickup" && (
          <PickupSidebar
            session={pickupSession}
            category={pickupCategory}
            measureKind={pickupKind}
            label={pickupLabel}
            points={pickupPoints}
            hasScale={scale !== null}
            canUndo={pickupUndoStack.current.canUndo()}
            costMaster={costMaster}
            expandedRowIdx={expandedRowIdx}
            onCategoryChange={setPickupCategory}
            onMeasureKindChange={setPickupKind}
            onLabelChange={setPickupLabel}
            onFinalize={finalizePickupSegment}
            onReset={resetPickupPoints}
            onUndo={undoPickup}
            onRemoveSegment={removePickupSegment}
            onLinkSegment={linkPickupSegment}
            onExpandRow={setExpandedRowIdx}
            onExportCSV={handlePickupExportCSV}
            onExportJSON={handlePickupExportJSON}
            onSendToEstimate={handleSendToEstimate}
          />
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
        </div>{/* end panel-content */}
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

// ── PickupSidebar ─────────────────────────────────────────────────────────────

type PickupSidebarProps = {
  session: TakeoffSessionState;
  category: TakeoffSegmentCategory;
  measureKind: "distance" | "area";
  label: string;
  points: Point[];
  hasScale: boolean;
  canUndo: boolean;
  costMaster: CostMasterEntry[];
  expandedRowIdx: number | null;
  onCategoryChange: (c: TakeoffSegmentCategory) => void;
  onMeasureKindChange: (k: "distance" | "area") => void;
  onLabelChange: (l: string) => void;
  onFinalize: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRemoveSegment: (id: string) => void;
  onLinkSegment: (segId: string, code: string, name: string) => void;
  onExpandRow: (idx: number | null) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onSendToEstimate: () => void;
};

function PickupSidebar({
  session,
  category,
  measureKind,
  label,
  points,
  hasScale,
  canUndo,
  costMaster,
  expandedRowIdx,
  onCategoryChange,
  onMeasureKindChange,
  onLabelChange,
  onFinalize,
  onReset,
  onUndo,
  onRemoveSegment,
  onLinkSegment,
  onExpandRow,
  onExportCSV,
  onExportJSON,
  onSendToEstimate,
}: PickupSidebarProps) {
  const costRows = summariseWithCost(session, costMaster);
  const summaryRows = summariseSession(session);
  const totalCost = sessionTotalCost(session, costMaster);
  const minPoints = measureKind === "area" ? 3 : 2;
  const canFinalize = hasScale && points.length >= minPoints;

  return (
    <div className="flex flex-col gap-3">
      {/* Category selector with color dots */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">カテゴリ</span>
        <div className="grid grid-cols-3 gap-1">
          {TAKEOFF_SEGMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              style={
                category === cat
                  ? { backgroundColor: TAKEOFF_CATEGORY_COLORS[cat], color: "#fff" }
                  : undefined
              }
              className={`rounded-xl py-1.5 text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                category === cat
                  ? ""
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: TAKEOFF_CATEGORY_COLORS[cat] }}
              />
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Measure kind toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onMeasureKindChange("area")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
            measureKind === "area"
              ? "bg-orange-500 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          面積 (㎡)
        </button>
        <button
          type="button"
          onClick={() => onMeasureKindChange("distance")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
            measureKind === "distance"
              ? "bg-orange-500 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          距離 (m)
        </button>
      </div>

      {/* Optional label */}
      <input
        type="text"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="ラベル (例: 北面)"
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-400 focus:outline-none"
      />

      {/* Points info + actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onFinalize}
          disabled={!canFinalize}
          className="flex-1 rounded-2xl bg-orange-500 py-2.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {points.length > 0
            ? `確定 (${points.length}点)`
            : `確定 (${minPoints}点以上)`}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-600"
        >
          リセット
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-600 disabled:opacity-40"
          aria-label="元に戻す"
        >
          ↩
        </button>
      </div>

      {/* Summary table with cost totals */}
      {summaryRows.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">数量集計</p>
            {totalCost > 0 && (
              <p className="text-xs font-bold text-emerald-700">
                合計 ¥{totalCost.toLocaleString()}
              </p>
            )}
          </div>
          {costRows.map((row, idx) => {
            const isExpanded = expandedRowIdx === idx;
            const suggestions = isExpanded
              ? suggestForRow(row, costMaster, 3)
              : [];
            const catColor = TAKEOFF_CATEGORY_COLORS[row.category] ?? "#6b7280";
            return (
              <div
                key={`${row.category}-${row.measureKind}`}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                style={{ borderLeftColor: catColor, borderLeftWidth: 3 }}
              >
                <button
                  type="button"
                  onClick={() => onExpandRow(isExpanded ? null : idx)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: catColor }}
                    />
                    {row.category}
                    <span className="ml-1 font-normal text-slate-500">
                      ({row.segmentCount}箇所)
                    </span>
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold" style={{ color: catColor }}>
                      {row.totalValue.toFixed(2)} {row.unit}
                    </span>
                    {row.totalCost > 0 && (
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        ¥{row.totalCost.toLocaleString()}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-3 py-2 flex flex-col gap-1">
                    {/* Segment list */}
                    {session.segments
                      .filter(
                        (s) =>
                          s.category === row.category &&
                          s.measureKind === row.measureKind,
                      )
                      .map((seg) => (
                        <div
                          key={seg.id}
                          className="flex items-center justify-between text-xs text-slate-600"
                        >
                          <span>
                            {seg.label ?? "—"} {seg.value.toFixed(2)} {row.unit}
                            {seg.linkedCostName && (
                              <span className="ml-1 text-emerald-600">
                                [{seg.linkedCostName}]
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveSegment(seg.id)}
                            className="ml-2 text-red-400 hover:text-red-600"
                            aria-label="削除"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                    {/* Cost-master suggestions */}
                    {suggestions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        <p className="text-[10px] font-semibold text-slate-500">
                          単価候補 (タップで反映)
                        </p>
                        {suggestions.map((s) => (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => {
                              // Link cost to all segments in this row
                              session.segments
                                .filter(
                                  (seg) =>
                                    seg.category === row.category &&
                                    seg.measureKind === row.measureKind,
                                )
                                .forEach((seg) =>
                                  onLinkSegment(seg.id, s.code, s.name),
                                );
                              onExpandRow(null);
                            }}
                            className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="ml-2 shrink-0">
                              ¥{s.unitPrice.toLocaleString()}/{s.unit} →
                              ¥{s.amount.toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {session.segments.length === 0 && (
        <p className="text-center text-xs text-slate-400 py-2">
          セグメントなし — 図面をタップして計測
        </p>
      )}

      {/* Export buttons */}
      {session.segments.length > 0 && (
        <>
          <button
            type="button"
            onClick={onSendToEstimate}
            className="min-h-[44px] w-full rounded-2xl bg-brand-600 py-2.5 text-sm font-bold text-white hover:bg-brand-700 active:bg-brand-800 transition-colors"
            data-testid="send-to-estimate-btn"
          >
            見積に流し込む →
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExportCSV}
              className="flex-1 rounded-2xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={onExportJSON}
              className="flex-1 rounded-2xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

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
