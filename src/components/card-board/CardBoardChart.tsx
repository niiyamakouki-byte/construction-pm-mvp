/**
 * CardBoardChart.tsx（工程カードビュー統合 第2弾）
 *
 * 自由配置キャンバス上に工程タスクをカードとして表示し、ドラッグ配置・
 * 依存線の作成（先行→後続のFS接続）・削除ができる。
 *
 * データは Task[] のみを受け取る表示専用コンポーネント（書き込みは呼び出し元の
 * コールバック props 経由で task-store に委譲する — GanttChart.tsx と同じ設計）。
 * キャンバスのパン/ズーム/ドラッグ操作は NodeSchedulePage.tsx の実装を踏襲している。
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "../../domain/types.js";
import { effectiveProgress } from "../gantt/utils.js";

type Vec2 = { x: number; y: number };

export type CardBoardChartProps = {
  tasks: Task[];
  /** ドラッグ完了時（マウスアップ）に呼ばれ、カード位置を永続化する */
  onMove: (taskId: string, canvasX: number, canvasY: number) => void;
  /** 出力ポート→別カードへドロップ。predecessorId(先行)→successorId(後続) */
  onConnect: (predecessorId: string, successorId: string) => void;
  /** 依存線クリックで解除 */
  onDisconnect: (predecessorId: string, successorId: string) => void;
};

const statusColor: Record<TaskStatus, string> = {
  todo: "#94a3b8",
  in_progress: "#2563eb",
  done: "#10b981",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const CARD_W = 208;
const CARD_H = 108;
const PORT_R = 7;

function bezierPath(from: Vec2, to: Vec2): string {
  const dx = Math.abs(to.x - from.x) * 0.5;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

export function CardBoardChart({ tasks, onMove, onConnect, onDisconnect }: CardBoardChartProps) {
  const [pan, setPan] = useState<Vec2>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastPanPos = useRef<Vec2>({ x: 0, y: 0 });

  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef<Vec2>({ x: 0, y: 0 });
  const [dragOverride, setDragOverride] = useState<{ id: string; x: number; y: number } | null>(null);

  const connectingFrom = useRef<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [mousePos, setMousePos] = useState<Vec2>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);

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

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
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
      setMousePos({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
    }
  }, [isConnecting, screenToCanvas]);

  const handleSvgMouseUp = useCallback(() => {
    isPanning.current = false;
    if (draggingId.current) {
      const id = draggingId.current;
      draggingId.current = null;
      setDragOverride((current) => {
        if (current && current.id === id) onMove(id, current.x, current.y);
        return null;
      });
    }
    if (isConnecting) {
      connectingFrom.current = null;
      setIsConnecting(false);
    }
  }, [isConnecting, onMove]);

  const handleCardMouseDown = useCallback((e: React.MouseEvent, task: Task, index: number) => {
    e.stopPropagation();
    const pos = getPos(task, index);
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    dragOffset.current = { x: canvasPos.x - pos.x, y: canvasPos.y - pos.y };
    draggingId.current = task.id;
    isPanning.current = false;
  }, [getPos, screenToCanvas]);

  const handlePortMouseDown = useCallback((e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    connectingFrom.current = taskId;
    setIsConnecting(true);
    const rect = svgRef.current?.getBoundingClientRect();
    setMousePos({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }, []);

  const handleCardDrop = useCallback((e: React.MouseEvent, toTaskId: string) => {
    e.stopPropagation();
    if (!isConnecting || !connectingFrom.current) return;
    const fromId = connectingFrom.current;
    connectingFrom.current = null;
    setIsConnecting(false);
    if (fromId === toTaskId) return;
    onConnect(fromId, toTaskId);
  }, [isConnecting, onConnect]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.2, Math.min(3, z * delta)));
  }, []);

  const handleDependencyClick = useCallback((fromId: string, toId: string, fromName: string, toName: string) => {
    const ok = typeof window !== "undefined" && window.confirm
      ? window.confirm(`依存関係を解除しますか？\n先行: ${fromName}\n後続: ${toName}`)
      : true;
    if (ok) onDisconnect(fromId, toId);
  }, [onDisconnect]);

  return (
    <div className="flex-1 bg-[#0f172a] overflow-hidden relative" data-testid="card-board-canvas">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleSvgMouseUp}
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
            const to: Vec2 = { x: (mousePos.x - pan.x) / zoom, y: (mousePos.y - pan.y) / zoom };
            return (
              <path d={bezierPath(from, to)} fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 2" pointerEvents="none" />
            );
          })()}

          {tasks.map((task, index) => {
            const pos = getPos(task, index);
            const color = statusColor[task.status];
            return (
              <g key={task.id} transform={`translate(${pos.x},${pos.y})`} data-testid={`card-${task.id}`}>
                <rect
                  width={CARD_W}
                  height={CARD_H}
                  rx="10"
                  fill="#1e293b"
                  stroke={color}
                  strokeWidth="2"
                  className="cursor-move"
                  onMouseDown={(e) => handleCardMouseDown(e, task, index)}
                  onMouseUp={(e) => handleCardDrop(e, task.id)}
                />
                <rect width={CARD_W} height="4" rx="2" fill={color} />

                <foreignObject x="10" y="10" width={CARD_W - 20} height="36" pointerEvents="none">
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#f1f5f9", lineHeight: "1.3", wordBreak: "break-all" }}>
                    {task.name.length > 26 ? `${task.name.slice(0, 26)}...` : task.name}
                  </div>
                </foreignObject>

                <foreignObject x="10" y="46" width={CARD_W - 20} height="18" pointerEvents="none">
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {task.description || " "}
                    {task.leadTimeDays != null && (
                      <span style={{ marginLeft: 6, color: "#facc15" }}>{task.leadTimeDays}日</span>
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

                <circle
                  cx={0}
                  cy={CARD_H / 2}
                  r={PORT_R}
                  fill="#334155"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  className="cursor-crosshair"
                  data-testid={`port-in-${task.id}`}
                  onMouseUp={(e) => handleCardDrop(e, task.id)}
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
                  onMouseDown={(e) => handlePortMouseDown(e, task.id)}
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
    </div>
  );
}
