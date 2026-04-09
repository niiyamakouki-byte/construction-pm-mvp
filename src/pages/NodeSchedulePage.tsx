import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "../domain/types.js";
import { createTaskRepository } from "../stores/task-store.js";
import { createProjectRepository } from "../stores/project-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { filterScheduleTasks } from "../lib/cost-management.js";

// ── Types ─────────────────────────────────────────────────────

type Vec2 = { x: number; y: number };

type Connection = {
  fromId: string;
  toId: string;
};

// ── Helpers ───────────────────────────────────────────────────

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

function bezierPath(from: Vec2, to: Vec2): string {
  const dx = Math.abs(to.x - from.x) * 0.5;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

const NODE_W = 180;
const NODE_H = 80;
const PORT_R = 6;

// ── CSV Import helpers ────────────────────────────────────────

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

const SAMPLE_CSV = `タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数
墨出し・下地確認,内装,2024-04-01,2024-04-02,田中工務店,,0
解体・撤去,内装,2024-04-02,2024-04-05,田中工務店,,1
下地工事,内装,2024-04-05,2024-04-10,山田建設,石膏ボード,2
電気配管,設備,2024-04-08,2024-04-12,鈴木電気,配管資材,3
ボード張り,内装,2024-04-10,2024-04-13,山田建設,石膏ボード,2
塗装,仕上,2024-04-13,2024-04-18,佐藤塗装,塗料,1
`;

// ── Component ─────────────────────────────────────────────────

export function NodeSchedulePage() {
  const { organizationId } = useOrganizationContext();
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas pan/zoom state
  const [pan, setPan] = useState<Vec2>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const lastPanPos = useRef<Vec2>({ x: 0, y: 0 });

  // Drag node state
  const draggingNodeId = useRef<string | null>(null);
  const dragOffset = useRef<Vec2>({ x: 0, y: 0 });

  // Connection state: dragging from a port
  const connectingFrom = useRef<string | null>(null);
  const [mousePos, setMousePos] = useState<Vec2>({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);

  // CSV import state
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; error: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const loadTasks = useCallback(async () => {
    try {
      setError(null);
      const all = await taskRepository.findAll();
      setTasks(filterScheduleTasks(all));
    } catch (err) {
      console.error("Failed to load node schedule tasks", err);
      setError(err instanceof Error ? err.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, [taskRepository]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((sx: number, sy: number): Vec2 => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: sx, y: sy };
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (sx - rect.left - pan.x) / zoom,
      y: (sy - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Node position with default layout
  const getNodePos = useCallback((task: Task, index: number): Vec2 => {
    if (task.canvasX != null && task.canvasY != null) {
      return { x: task.canvasX, y: task.canvasY };
    }
    const col = index % 4;
    const row = Math.floor(index / 4);
    return { x: col * 220 + 20, y: row * 120 + 20 };
  }, []);

  // ── Mouse handlers ───────────────────────────────────────────

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Middle of SVG = pan
    isPanning.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning.current && !draggingNodeId.current && !isConnecting) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
    if (draggingNodeId.current) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const newX = pos.x - dragOffset.current.x;
      const newY = pos.y - dragOffset.current.y;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggingNodeId.current ? { ...t, canvasX: newX, canvasY: newY } : t,
        ),
      );
    }
    if (isConnecting) {
      const svgEl = svgRef.current;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  }, [isConnecting, screenToCanvas]);

  const handleSvgMouseUp = useCallback(async () => {
    isPanning.current = false;

    if (draggingNodeId.current) {
      const nodeId = draggingNodeId.current;
      draggingNodeId.current = null;
      // Persist position
      const task = tasks.find((t) => t.id === nodeId);
      if (task && task.canvasX != null && task.canvasY != null) {
        try {
          await taskRepository.update(nodeId, {
            canvasX: task.canvasX,
            canvasY: task.canvasY,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Failed to persist node position", err);
          setError(err instanceof Error ? err.message : "ノード位置の保存に失敗しました");
        }
      }
    }

    if (isConnecting) {
      connectingFrom.current = null;
      setIsConnecting(false);
    }
  }, [tasks, taskRepository, isConnecting]);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, taskId: string, index: number) => {
      e.stopPropagation();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const pos = getNodePos(task, index);
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      dragOffset.current = { x: canvasPos.x - pos.x, y: canvasPos.y - pos.y };
      draggingNodeId.current = taskId;
      isPanning.current = false;
    },
    [tasks, getNodePos, screenToCanvas],
  );

  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      connectingFrom.current = taskId;
      setIsConnecting(true);
      const svgEl = svgRef.current;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [],
  );

  const handleNodePortDrop = useCallback(
    async (e: React.MouseEvent, toTaskId: string) => {
      e.stopPropagation();
      if (!isConnecting || !connectingFrom.current) return;
      const fromId = connectingFrom.current;
      if (fromId === toTaskId) {
        connectingFrom.current = null;
        setIsConnecting(false);
        return;
      }
      // Add dependency: toTask depends on fromTask
      const toTask = tasks.find((t) => t.id === toTaskId);
      if (!toTask) return;
      const deps = [...(toTask.dependencies ?? [])];
      if (!deps.includes(fromId)) {
        deps.push(fromId);
        try {
          await taskRepository.update(toTaskId, {
            dependencies: deps,
            updatedAt: new Date().toISOString(),
          });
          await loadTasks();
        } catch (err) {
          console.error("Failed to create node dependency", err);
          setError(err instanceof Error ? err.message : "依存関係の保存に失敗しました");
        }
      }
      connectingFrom.current = null;
      setIsConnecting(false);
    },
    [isConnecting, tasks, taskRepository, loadTasks],
  );

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.2, Math.min(3, z * delta)));
  }, []);

  // ── Build connections from dependencies ─────────────────────
  const connections: Connection[] = useMemo(() => {
    const conns: Connection[] = [];
    for (const task of tasks) {
      for (const depId of task.dependencies ?? []) {
        conns.push({ fromId: depId, toId: task.id });
      }
    }
    return conns;
  }, [tasks]);

  // ── CSV Import ───────────────────────────────────────────────

  const handleCsvFile = useCallback(
    async (file: File) => {
      setImporting(true);
      setCsvResult(null);
      setError(null);
      try {
        const text = await file.text();
        const rows = parseCSV(text);
        let successCount = 0;
        let errorCount = 0;
        let importErrorMessage: string | null = null;

        // Get projects for lookup
        const projects = await projectRepository.findAll();
        const defaultProjectId = projects[0]?.id ?? "";

        const now = new Date();
        let xOffset = 20;
        for (const row of rows) {
          const taskName = row["タスク名"] ?? row["task_name"] ?? "";
          if (!taskName) { errorCount++; continue; }
          try {
            await taskRepository.create({
              id: crypto.randomUUID(),
              projectId: defaultProjectId,
              name: taskName,
              description: row["カテゴリ"] ?? row["category"] ?? "",
              status: "todo",
              startDate: row["開始日"] ?? row["start_date"] ?? undefined,
              dueDate: row["終了日"] ?? row["end_date"] ?? undefined,
              contractorId: row["担当業者"] ?? row["contractor"] ?? row["assignee"] ?? undefined,
              materials: row["材料"] ? [row["材料"]] : [],
              lead_time: row["リードタイム日数"] ? Number(row["リードタイム日数"]) : 0,
              leadTimeDays: row["リードタイム日数"] ? Number(row["リードタイム日数"]) : 0,
              progress: 0,
              dependencies: [],
              canvasX: xOffset,
              canvasY: 50,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            });
            xOffset += 220;
            successCount++;
          } catch (err) {
            console.error("Failed to import node schedule CSV row", err);
            errorCount++;
            importErrorMessage =
              err instanceof Error ? err.message : "一部のタスクをインポートできませんでした";
          }
        }
        setCsvResult({ success: successCount, error: errorCount });
        await loadTasks();
        if (importErrorMessage) {
          setError(importErrorMessage);
        }
      } catch (err) {
        console.error("Failed to import node schedule CSV", err);
        setError(err instanceof Error ? err.message : "CSVインポート失敗");
      } finally {
        setImporting(false);
      }
    },
    [taskRepository, projectRepository, loadTasks],
  );

  const handleCsvInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleCsvFile(file);
      e.target.value = "";
    },
    [handleCsvFile],
  );

  const downloadSampleCSV = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <button
            onClick={() => navigate("/gantt")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            ガント表示
          </button>
          <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 cursor-default">
            ノード表示
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleCSV}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            サンプルCSV
          </button>
          <button
            onClick={() => setShowCsvImport(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            CSVインポート
          </button>
          <span className="text-xs text-slate-400 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => { setPan({ x: 80, y: 80 }); setZoom(1); }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            リセット
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 shrink-0">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 bg-[#0f172a] overflow-hidden relative">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
          onWheel={handleWheel}
        >
          {/* Grid dots */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 40},${pan.y % 40})`}>
              <circle cx="40" cy="40" r="1" fill="#1e293b" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Connections (bezier edges) */}
            {connections.map((conn) => {
              const fromTask = tasks.find((t) => t.id === conn.fromId);
              const toTask = tasks.find((t) => t.id === conn.toId);
              if (!fromTask || !toTask) return null;
              const fromIdx = tasks.indexOf(fromTask);
              const toIdx = tasks.indexOf(toTask);
              const fromPos = getNodePos(fromTask, fromIdx);
              const toPos = getNodePos(toTask, toIdx);
              const from: Vec2 = { x: fromPos.x + NODE_W, y: fromPos.y + NODE_H / 2 };
              const to: Vec2 = { x: toPos.x, y: toPos.y + NODE_H / 2 };
              return (
                <path
                  key={`${conn.fromId}-${conn.toId}`}
                  d={bezierPath(from, to)}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  markerEnd="url(#arrow)"
                />
              );
            })}

            {/* Arrow marker */}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
              </marker>
            </defs>

            {/* Live connecting line */}
            {isConnecting && connectingFrom.current && (() => {
              const fromTask = tasks.find((t) => t.id === connectingFrom.current);
              if (!fromTask) return null;
              const fromIdx = tasks.indexOf(fromTask);
              const fromPos = getNodePos(fromTask, fromIdx);
              const from: Vec2 = { x: fromPos.x + NODE_W, y: fromPos.y + NODE_H / 2 };
              // Convert mousePos (screen) to canvas
              const to: Vec2 = {
                x: (mousePos.x - pan.x) / zoom,
                y: (mousePos.y - pan.y) / zoom,
              };
              return (
                <path
                  d={bezierPath(from, to)}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  pointerEvents="none"
                />
              );
            })()}

            {/* Task nodes */}
            {tasks.map((task, index) => {
              const pos = getNodePos(task, index);
              const color = statusColor[task.status];
              return (
                <g key={task.id} transform={`translate(${pos.x},${pos.y})`}>
                  {/* Node card */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="8"
                    fill="#1e293b"
                    stroke={color}
                    strokeWidth="2"
                    className="cursor-move"
                    onMouseDown={(e) => handleNodeMouseDown(e, task.id, index)}
                    onMouseUp={(e) => { void handleNodePortDrop(e, task.id); }}
                  />
                  {/* Status bar */}
                  <rect width={NODE_W} height="4" rx="2" fill={color} />

                  {/* Task name */}
                  <foreignObject x="8" y="12" width={NODE_W - 16} height="44">
                    <div
                      style={{ fontSize: "12px", color: "#f1f5f9", lineHeight: "1.3", wordBreak: "break-all" }}
                    >
                      {task.name.length > 28 ? task.name.slice(0, 28) + "..." : task.name}
                    </div>
                  </foreignObject>

                  {/* Status badge */}
                  <foreignObject x="8" y="56" width={NODE_W - 16} height="18">
                    <div style={{ fontSize: "10px", color: color, fontWeight: 600 }}>
                      {statusLabel[task.status]}
                      {task.progress > 0 && ` · ${task.progress}%`}
                    </div>
                  </foreignObject>

                  {/* Left port (input) */}
                  <circle
                    cx={0}
                    cy={NODE_H / 2}
                    r={PORT_R}
                    fill="#334155"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    className="cursor-crosshair"
                    onMouseUp={(e) => { void handleNodePortDrop(e, task.id); }}
                  />

                  {/* Right port (output) */}
                  <circle
                    cx={NODE_W}
                    cy={NODE_H / 2}
                    r={PORT_R}
                    fill="#334155"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    className="cursor-crosshair"
                    onMouseDown={(e) => handlePortMouseDown(e, task.id)}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-500">
              <p className="text-sm font-medium">タスクがありません</p>
              <p className="text-xs mt-1">CSVインポートまたはプロジェクト詳細からタスクを追加</p>
            </div>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCsvImport(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 mb-4">CSVインポート</h3>
            <p className="text-xs text-slate-500 mb-3">
              CSV形式: タスク名,カテゴリ,開始日,終了日,担当業者,材料,リードタイム日数
            </p>

            {csvResult && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${csvResult.error === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                成功: {csvResult.success}件 / エラー: {csvResult.error}件
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={downloadSampleCSV}
                className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                サンプルCSVをダウンロード
              </button>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvInputChange}
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                disabled={importing}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {importing ? "インポート中..." : "CSVファイルを選択"}
              </button>
            </div>

            <button
              onClick={() => setShowCsvImport(false)}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
