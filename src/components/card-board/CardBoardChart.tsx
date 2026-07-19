/**
 * CardBoardChart.tsx（工程カードビュー統合 第2弾 → laporta-beads-8i1wq でPointer Events化）
 *
 * 自由配置キャンバス上に工程タスクをカードとして表示し、ドラッグ配置・
 * 依存線の作成（先行→後続のFS接続）・削除ができる。
 *
 * データは Task[] のみを受け取る表示専用コンポーネント（書き込みは呼び出し元の
 * コールバック props 経由で task-store に委譲する — GanttChart.tsx と同じ設計）。
 *
 * 操作方式（Pointer Events統一・laporta-beads-8i1wq）:
 * - パン・カード移動・接続ポートのドラッグは全て Pointer Events（onPointerDown/Move/Up）で
 *   実装し、mouse/touch/penを区別せず同じ経路で処理する（setPointerCaptureで捕捉）。
 * - pointerType が touch/pen のカード操作は「タップ＝詳細シート」「長押し(450ms)してから
 *   ドラッグ＝移動」に分岐する。長押し前に指定閾値(8px)以上動いた場合は誤操作とみなし
 *   何もしない（パンにもドラッグにも倒さない）。mouse は従来通り即ドラッグ。
 * - 接続ポートの直接ドラッグは mouse のみ有効（デスクトップの上級操作として残す）。
 *   touch/pen はポートでのドラッグ開始を無視し、カードのメニュー（詳細シート内の
 *   「この工程の後に追加」）から後続タスクを選ぶ方式を既定にする。
 * - 全体を表示 / ズーム −・100%・＋ / 直前操作の取り消し、をツールバーに常設する。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "../../domain/types.js";
import { effectiveProgress } from "../gantt/utils.js";
import { useIsNarrow } from "../../hooks/useIsNarrow.js";
import { CardDetailSheet } from "./CardDetailSheet.js";

type Vec2 = { x: number; y: number };

export type CardBoardChartProps = {
  tasks: Task[];
  /** ドラッグ完了時（ポインタアップ）に呼ばれ、カード位置を永続化する */
  onMove: (taskId: string, canvasX: number, canvasY: number) => void;
  /** 出力ポート→別カードへドロップ、またはメニューの「この工程の後に追加」。predecessorId(先行)→successorId(後続) */
  onConnect: (predecessorId: string, successorId: string) => void;
  /** 依存線クリック、または詳細シートの「外す」で解除 */
  onDisconnect: (predecessorId: string, successorId: string) => void;
};

const statusColor: Record<TaskStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#2563eb",
  done: "#587b56",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const CARD_W = 208;
const CARD_H = 108;
const PORT_R = 7;
const LONG_PRESS_MS = 450;
const TAP_MOVE_CANCEL_PX = 8;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

type UndoAction =
  | { type: "move"; taskId: string; x: number; y: number }
  | { type: "connect"; predecessorId: string; successorId: string }
  | { type: "disconnect"; predecessorId: string; successorId: string };

type PendingTouchPress = {
  taskId: string;
  index: number;
  startX: number;
  startY: number;
  moved: boolean;
};

function bezierPath(from: Vec2, to: Vec2): string {
  const dx = Math.abs(to.x - from.x) * 0.5;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function CardBoardChart({ tasks, onMove, onConnect, onDisconnect }: CardBoardChartProps) {
  const [pan, setPan] = useState<Vec2>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastPanPos = useRef<Vec2>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const isNarrow = useIsNarrow();
  const [hintDismissed, setHintDismissed] = useState(false);

  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef<Vec2>({ x: 0, y: 0 });
  const dragStartPos = useRef<Vec2>({ x: 0, y: 0 });
  const [dragOverride, setDragOverride] = useState<{ id: string; x: number; y: number } | null>(null);

  const connectingFrom = useRef<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pointerPos, setPointerPos] = useState<Vec2>({ x: 0, y: 0 });

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTouchPress = useRef<PendingTouchPress | null>(null);
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const screenToCanvas = useCallback((sx: number, sy: number): Vec2 => {
    const rect = svgRef.current?.getBoundingClientRect();
    return {
      x: (sx - (rect?.left ?? 0) - pan.x) / zoom,
      y: (sy - (rect?.top ?? 0) - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const getPos = useCallback((task: Task, index: number): Vec2 => {
    if (dragOverride && dragOverride.id === task.id) {
      return { x: dragOverride.x, y: dragOverride.y };
    }
    if (task.canvasX != null && task.canvasY != null) {
      return { x: task.canvasX, y: task.canvasY };
    }
    const col = index % 4;
    const row = Math.floor(index / 4);
    return { x: col * (CARD_W + 40) + 20, y: row * (CARD_H + 60) + 20 };
  }, [dragOverride]);

  const connections = useMemo(
    () => tasks.flatMap((t) => (t.dependencies ?? []).map((fromId) => ({ fromId, toId: t.id }))),
    [tasks],
  );

  const beginCardDrag = useCallback((task: Task, index: number, clientX: number, clientY: number) => {
    const pos = getPos(task, index);
    const canvasPos = screenToCanvas(clientX, clientY);
    dragOffset.current = { x: canvasPos.x - pos.x, y: canvasPos.y - pos.y };
    dragStartPos.current = pos;
    draggingId.current = task.id;
    isPanning.current = false;
  }, [getPos, screenToCanvas]);

  const handleSvgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (activePointerId.current != null && activePointerId.current !== e.pointerId) return;
    activePointerId.current = e.pointerId;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    isPanning.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerId.current != null && activePointerId.current !== e.pointerId) return;

    if (pendingTouchPress.current && pendingTouchPress.current.taskId) {
      const dx = e.clientX - pendingTouchPress.current.startX;
      const dy = e.clientY - pendingTouchPress.current.startY;
      if (Math.hypot(dx, dy) > TAP_MOVE_CANCEL_PX) {
        pendingTouchPress.current.moved = true;
        clearLongPressTimer();
      }
    }

    if (isPanning.current && !draggingId.current && !isConnecting) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
    if (draggingId.current) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setDragOverride({
        id: draggingId.current,
        x: pos.x - dragOffset.current.x,
        y: pos.y - dragOffset.current.y,
      });
    }
    if (isConnecting) {
      const rect = svgRef.current?.getBoundingClientRect();
      setPointerPos({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
    }
  }, [isConnecting, screenToCanvas, clearLongPressTimer]);

  const endInteraction = useCallback((pointerId: number) => {
    isPanning.current = false;
    if (activePointerId.current === pointerId) {
      activePointerId.current = null;
    }
    clearLongPressTimer();

    if (pendingTouchPress.current && !pendingTouchPress.current.moved && !draggingId.current) {
      // 長押しに至らず、閾値を超えて動きもしなかった＝タップ確定 → 詳細シートを開く
      setSelectedTaskId(pendingTouchPress.current.taskId);
    }
    pendingTouchPress.current = null;
    setPressedCardId(null);

    if (draggingId.current) {
      const id = draggingId.current;
      draggingId.current = null;
      setDragOverride((current) => {
        if (current && current.id === id) {
          const from = dragStartPos.current;
          if (from.x !== current.x || from.y !== current.y) {
            setUndoStack((stack) => [...stack, { type: "move", taskId: id, x: from.x, y: from.y }]);
          }
          onMove(id, current.x, current.y);
        }
        return null;
      });
    }
    if (isConnecting) {
      connectingFrom.current = null;
      setIsConnecting(false);
    }
  }, [isConnecting, onMove, clearLongPressTimer]);

  const handleSvgPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    endInteraction(e.pointerId);
  }, [endInteraction]);

  const handleSvgPointerCancel = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // pointercancel（スクロール割り込み等）ではドラッグ結果を確定させず、位置を戻す。
    isPanning.current = false;
    if (activePointerId.current === e.pointerId) activePointerId.current = null;
    clearLongPressTimer();
    pendingTouchPress.current = null;
    setPressedCardId(null);
    draggingId.current = null;
    setDragOverride(null);
    connectingFrom.current = null;
    setIsConnecting(false);
  }, [clearLongPressTimer]);

  const handleCardPointerDown = useCallback((e: React.PointerEvent, task: Task, index: number) => {
    e.stopPropagation();
    if (activePointerId.current != null && activePointerId.current !== e.pointerId) return;
    activePointerId.current = e.pointerId;
    svgRef.current?.setPointerCapture?.(e.pointerId);

    if (e.pointerType === "touch" || e.pointerType === "pen") {
      pendingTouchPress.current = {
        taskId: task.id,
        index,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      clearLongPressTimer();
      const { clientX, clientY } = e;
      longPressTimer.current = setTimeout(() => {
        if (pendingTouchPress.current?.taskId === task.id && !pendingTouchPress.current.moved) {
          beginCardDrag(task, index, clientX, clientY);
          setPressedCardId(task.id);
        }
      }, LONG_PRESS_MS);
    } else {
      beginCardDrag(task, index, e.clientX, e.clientY);
    }
  }, [beginCardDrag, clearLongPressTimer]);

  const handlePortPointerDown = useCallback((e: React.PointerEvent, taskId: string) => {
    e.stopPropagation();
    if (e.pointerType === "touch" || e.pointerType === "pen") return; // モバイルはメニュー接続に一本化
    if (activePointerId.current != null && activePointerId.current !== e.pointerId) return;
    activePointerId.current = e.pointerId;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    connectingFrom.current = taskId;
    setIsConnecting(true);
    const rect = svgRef.current?.getBoundingClientRect();
    setPointerPos({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }, []);

  const handleCardDrop = useCallback((e: React.PointerEvent, toTaskId: string) => {
    e.stopPropagation();
    if (!isConnecting || !connectingFrom.current) return;
    const fromId = connectingFrom.current;
    connectingFrom.current = null;
    setIsConnecting(false);
    if (fromId === toTaskId) return;
    setUndoStack((stack) => [...stack, { type: "connect", predecessorId: fromId, successorId: toTaskId }]);
    onConnect(fromId, toTaskId);
  }, [isConnecting, onConnect]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => clampZoom(z * delta));
  }, []);

  const handleDependencyClick = useCallback((fromId: string, toId: string, fromName: string, toName: string) => {
    const ok = typeof window !== "undefined" && window.confirm
      ? window.confirm(`依存関係を解除しますか？\n先行: ${fromName}\n後続: ${toName}`)
      : true;
    if (ok) {
      setUndoStack((stack) => [...stack, { type: "disconnect", predecessorId: fromId, successorId: toId }]);
      onDisconnect(fromId, toId);
    }
  }, [onDisconnect]);

  const handleConnectAfter = useCallback((predecessorId: string, successorId: string) => {
    setUndoStack((stack) => [...stack, { type: "connect", predecessorId, successorId }]);
    onConnect(predecessorId, successorId);
  }, [onConnect]);

  const handleRemoveDependency = useCallback((predecessorId: string, successorId: string) => {
    setUndoStack((stack) => [...stack, { type: "disconnect", predecessorId, successorId }]);
    onDisconnect(predecessorId, successorId);
  }, [onDisconnect]);

  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const last = stack[stack.length - 1];
      if (last.type === "move") onMove(last.taskId, last.x, last.y);
      else if (last.type === "connect") onDisconnect(last.predecessorId, last.successorId);
      else onConnect(last.predecessorId, last.successorId);
      return stack.slice(0, -1);
    });
  }, [onMove, onConnect, onDisconnect]);

  const handleFitView = useCallback(() => {
    if (tasks.length === 0) {
      setPan({ x: 80, y: 80 });
      setZoom(1);
      return;
    }
    const positions = tasks.map((t, i) => getPos(t, i));
    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxX = Math.max(...positions.map((p) => p.x + CARD_W));
    const maxY = Math.max(...positions.map((p) => p.y + CARD_H));
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const rect = svgRef.current?.getBoundingClientRect();
    const viewW = rect?.width || 800;
    const viewH = rect?.height || 600;
    const PAD = 48;
    const scale = Math.min((viewW - PAD * 2) / contentW, (viewH - PAD * 2) / contentH);
    const newZoom = clampZoom(scale > 0 ? scale : 1);
    setZoom(newZoom);
    setPan({ x: PAD - minX * newZoom, y: PAD - minY * newZoom });
  }, [tasks, getPos]);

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  return (
    <div className="flex-1 bg-[#0f172a] overflow-hidden relative" data-testid="card-board-canvas">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerCancel}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="card-board-grid" width="40" height="40" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x % 40},${pan.y % 40})`}>
            <circle cx="40" cy="40" r="1" fill="#1e293b" />
          </pattern>
          <marker id="card-board-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#card-board-grid)" />

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {connections.map(({ fromId, toId }) => {
            const fromTask = tasks.find((t) => t.id === fromId);
            const toTask = tasks.find((t) => t.id === toId);
            if (!fromTask || !toTask) return null;
            const fromPos = getPos(fromTask, tasks.indexOf(fromTask));
            const toPos = getPos(toTask, tasks.indexOf(toTask));
            const from: Vec2 = { x: fromPos.x + CARD_W, y: fromPos.y + CARD_H / 2 };
            const to: Vec2 = { x: toPos.x, y: toPos.y + CARD_H / 2 };
            const d = bezierPath(from, to);
            return (
              <g key={`${fromId}-${toId}`}>
                <path d={d} fill="none" stroke="#7c3aed" strokeWidth="2" markerEnd="url(#card-board-arrow)" pointerEvents="none" />
                <path
                  data-testid={`dep-line-hit-${fromId}-${toId}`}
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleDependencyClick(fromId, toId, fromTask.name, toTask.name)}
                >
                  <title>{`依存: ${fromTask.name} → ${toTask.name}（クリックで解除）`}</title>
                </path>
              </g>
            );
          })}

          {isConnecting && connectingFrom.current && (() => {
            const fromTask = tasks.find((t) => t.id === connectingFrom.current);
            if (!fromTask) return null;
            const fromPos = getPos(fromTask, tasks.indexOf(fromTask));
            const from: Vec2 = { x: fromPos.x + CARD_W, y: fromPos.y + CARD_H / 2 };
            const to: Vec2 = { x: (pointerPos.x - pan.x) / zoom, y: (pointerPos.y - pan.y) / zoom };
            return (
              <path d={bezierPath(from, to)} fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 2" pointerEvents="none" />
            );
          })()}

          {tasks.map((task, index) => {
            const pos = getPos(task, index);
            const color = statusColor[task.status];
            const isPressed = pressedCardId === task.id;
            return (
              <g key={task.id} transform={`translate(${pos.x},${pos.y})`} data-testid={`card-${task.id}`}>
                <rect
                  width={CARD_W}
                  height={CARD_H}
                  rx="10"
                  fill="#1e293b"
                  stroke={color}
                  strokeWidth={isPressed ? 3 : 2}
                  opacity={isPressed ? 0.85 : 1}
                  className="cursor-move"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => handleCardPointerDown(e, task, index)}
                  onPointerUp={(e) => handleCardDrop(e, task.id)}
                />
                <rect width={CARD_W} height="4" rx="2" fill={color} />

                <foreignObject x="10" y="10" width={CARD_W - 20} height="36" pointerEvents="none">
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#f1f5f9", lineHeight: "1.3", wordBreak: "break-all" }}>
                    {task.name.length > 26 ? `${task.name.slice(0, 26)}...` : task.name}
                  </div>
                </foreignObject>

                <foreignObject x="10" y="46" width={CARD_W - 20} height="18" pointerEvents="none">
                  <div style={{ fontSize: "10px", color: "#94a3b8", display: "flex", alignItems: "center", overflow: "hidden" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {task.description || " "}
                    </span>
                    {task.leadTimeDays != null && (
                      <span style={{ marginLeft: 6, color: "#facc15", flexShrink: 0 }}>{task.leadTimeDays}日</span>
                    )}
                  </div>
                </foreignObject>

                <foreignObject x="10" y="64" width={CARD_W - 20} height="16" pointerEvents="none">
                  <div style={{ fontSize: "10px", color, fontWeight: 600 }}>
                    {statusLabel[task.status]}
                    {effectiveProgress(task) > 0 && ` · ${effectiveProgress(task)}%`}
                  </div>
                </foreignObject>

                {/* 写真スロット: 第3弾プレースホルダ（機能は未実装） */}
                <foreignObject x="10" y="82" width={CARD_W - 20} height="18" pointerEvents="none">
                  <div style={{ fontSize: "9px", color: "#475569", border: "1px dashed #334155", borderRadius: 4, padding: "1px 4px", display: "inline-block" }}>
                    写真（準備中）
                  </div>
                </foreignObject>

                {/* カードメニュー: タップ/クリックで詳細シートを開く（44px以上のタップ領域） */}
                <foreignObject x={CARD_W - 40} y="8" width="32" height="32" style={{ touchAction: "manipulation" }}>
                  <button
                    type="button"
                    data-testid={`card-menu-${task.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTaskId(task.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      width: 32,
                      height: 32,
                      minWidth: 44,
                      minHeight: 44,
                      marginLeft: -6,
                      marginTop: -6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                    aria-label="カードの詳細メニューを開く"
                  >
                    ⋯
                  </button>
                </foreignObject>

                <circle
                  cx={0}
                  cy={CARD_H / 2}
                  r={PORT_R}
                  fill="#334155"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  className="cursor-crosshair"
                  data-testid={`port-in-${task.id}`}
                  onPointerUp={(e) => handleCardDrop(e, task.id)}
                />
                {/* ponytail: transparent hit-area extends tap target to 44px (r=22) */}
                <circle
                  cx={0}
                  cy={CARD_H / 2}
                  r={22}
                  fill="transparent"
                  className="cursor-crosshair"
                  onPointerUp={(e) => handleCardDrop(e, task.id)}
                />
                <circle
                  cx={CARD_W}
                  cy={CARD_H / 2}
                  r={PORT_R}
                  fill="#334155"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  className="cursor-crosshair"
                  data-testid={`port-out-${task.id}`}
                  onPointerDown={(e) => handlePortPointerDown(e, task.id)}
                />
                {/* ponytail: transparent hit-area extends tap target to 44px (r=22) */}
                <circle
                  cx={CARD_W}
                  cy={CARD_H / 2}
                  r={22}
                  fill="transparent"
                  className="cursor-crosshair"
                  onPointerDown={(e) => handlePortPointerDown(e, task.id)}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-slate-500">
            <p className="text-sm font-medium">タスクがありません</p>
            <p className="text-xs mt-1">ガント表示または工程表からタスクを追加してください</p>
          </div>
        </div>
      )}

      {isNarrow && !hintDismissed && tasks.length > 0 && (
        <div
          data-testid="card-board-mobile-hint"
          className="absolute left-2 right-2 top-2 flex items-center gap-2 rounded-lg bg-slate-800/95 px-3 py-2 text-xs text-slate-200 shadow-lg"
        >
          <span className="flex-1">タップで詳細、長押しでドラッグ移動、接続はメニューから選べます。</span>
          <button
            type="button"
            onClick={() => setHintDismissed(true)}
            className="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:text-slate-100"
            style={{ minHeight: 32, minWidth: 32 }}
            aria-label="ヒントを閉じる"
          >
            ×
          </button>
        </div>
      )}

      <div
        data-testid="card-board-toolbar"
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 shadow-lg"
      >
        <button
          type="button"
          data-testid="card-board-fit-view"
          onClick={handleFitView}
          className="rounded-md px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          style={{ minHeight: 44 }}
        >
          全体を表示
        </button>
        <button
          type="button"
          data-testid="card-board-zoom-out"
          onClick={() => setZoom((z) => clampZoom(z * 0.9))}
          className="rounded-md px-3 text-base font-bold text-slate-200 hover:bg-slate-700"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="縮小"
        >
          −
        </button>
        <button
          type="button"
          data-testid="card-board-zoom-reset"
          onClick={() => setZoom(1)}
          className="rounded-md px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          style={{ minHeight: 44 }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          data-testid="card-board-zoom-in"
          onClick={() => setZoom((z) => clampZoom(z * 1.1))}
          className="rounded-md px-3 text-base font-bold text-slate-200 hover:bg-slate-700"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="拡大"
        >
          ＋
        </button>
        <button
          type="button"
          data-testid="card-board-undo"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="rounded-md px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          style={{ minHeight: 44 }}
        >
          元に戻す
        </button>
      </div>

      {selectedTask && (
        <CardDetailSheet
          task={selectedTask}
          otherTasks={tasks}
          onClose={() => setSelectedTaskId(null)}
          onConnectAfter={(successorId) => handleConnectAfter(selectedTask.id, successorId)}
          onRemoveDependency={(predecessorId) => handleRemoveDependency(predecessorId, selectedTask.id)}
        />
      )}
    </div>
  );
}
