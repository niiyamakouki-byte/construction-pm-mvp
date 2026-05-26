/**
 * CrewOptimizerPage — 職人スケジュール最適化ダッシュボード (Sprint 14-B)
 *
 * v2-cozy: セージ #6B8E5A / critical のみ #C53030
 */

import { useMemo, useState } from "react";
import { optimize } from "../lib/crew-optimizer/optimizer.js";
import { CraftsmanStore } from "../lib/crew-optimizer/craftsman-store.js";
import { TaskAssignmentStore } from "../lib/crew-optimizer/task-store.js";
import { CrewOptimizationStore } from "../lib/crew-optimizer/optimization-store.js";
import type { CrewOptimizationResult, CrewConflict } from "../lib/crew-optimizer/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color: danger ? DANGER_RED : SAGE_GREEN }}
        data-testid={`kpi-${label}`}
      >
        {value}
      </div>
    </div>
  );
}

function ConflictSeverityBadge({ severity }: { severity: CrewConflict["severity"] }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: severity === "critical" ? DANGER_RED : "#d97706" }}
    >
      {severity === "critical" ? "緊急" : "警告"}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CrewOptimizerPage() {
  const [result, setResult] = useState<CrewOptimizationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const craftsmanStore = useMemo(() => new CraftsmanStore(), []);
  const taskStore = useMemo(() => new TaskAssignmentStore(), []);
  const optimizationStore = useMemo(() => new CrewOptimizationStore(), []);

  // Ensure seed data exists
  craftsmanStore.ensureSeed();
  taskStore.ensureSeed();

  const craftsmen = craftsmanStore.all();
  const tasks = taskStore.all();

  // KPI calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTaskCount = tasks.filter(
    (t) => t.startDate <= todayStr && t.endDate >= todayStr,
  ).length;

  const conflictCount = result?.totalConflicts ?? 0;
  const criticalConflictCount =
    result?.schedules
      .flatMap((s) => s.conflicts)
      .filter((c) => c.severity === "critical").length ?? 0;
  const avgUtilization = result?.avgUtilizationPct ?? 0;

  function handleOptimize() {
    setIsRunning(true);
    // Run synchronously (pure TS engine)
    const res = optimize(tasks, craftsmen);
    optimizationStore.add(res);
    setResult(res);
    setIsRunning(false);
  }

  // Unique conflicts for display (dedupe by kind+craftsmanId)
  const allConflicts = result?.schedules.flatMap((s) => s.conflicts) ?? [];

  // Flatten and deduplicate conflicts by a key
  const uniqueConflictsMap = new Map<string, CrewConflict>();
  for (const c of allConflicts) {
    const key = `${c.kind}:${c.craftsmanId}:${c.taskIds.sort().join(",")}`;
    uniqueConflictsMap.set(key, c);
  }
  const uniqueConflicts = [...uniqueConflictsMap.values()];

  const KIND_LABELS: Record<CrewConflict["kind"], string> = {
    doubleBooking: "ダブルブッキング",
    skillMismatch: "スキル不足",
    overcapacity: "許容超過",
    travelTooLong: "移動距離超過",
  };

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: SAGE_GREEN }}>
          職人スケジュール最適化
        </h1>
        {result && (
          <span className="text-xs text-slate-400">
            生成日時: {new Date(result.generatedAt).toLocaleString("ja-JP")}
          </span>
        )}
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="kpi-section">
        <KpiCard label="職人数" value={craftsmen.length} />
        <KpiCard label="今日のタスク数" value={todayTaskCount} />
        <KpiCard
          label="コンフリクト数"
          value={conflictCount}
          danger={criticalConflictCount > 0}
        />
        <KpiCard label="平均稼働率" value={result ? `${avgUtilization}%` : "—"} />
      </div>

      {/* 最適化ボタン */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleOptimize}
          disabled={isRunning || tasks.length === 0}
          className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: SAGE_GREEN }}
          data-testid="optimize-btn"
        >
          {isRunning ? "最適化中..." : "最適化を実行"}
        </button>
        {result && (
          <span className="text-xs text-slate-500">
            {result.unassignedTaskIds.length > 0 && (
              <span style={{ color: DANGER_RED }}>
                未割当: {result.unassignedTaskIds.length}件
              </span>
            )}
            割当済みタスク: {tasks.length - result.unassignedTaskIds.length}件
          </span>
        )}
      </div>

      {/* 日別スケジュール表 */}
      {result && result.schedules.length > 0 && (
        <div className="space-y-2" data-testid="schedule-section">
          <h2 className="text-sm font-semibold text-slate-600">日別スケジュール</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm" data-testid="schedule-table">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    日付
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    職人
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    タスク
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    役割
                  </th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-500 text-xs">
                    スコア
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    理由
                  </th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-500 text-xs">
                    稼働率
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.schedules.map((schedule) => {
                  if (schedule.assignments.length === 0) return null;
                  const craftsmanMap = new Map(craftsmen.map((c) => [c.id, c]));
                  const taskMap = new Map(tasks.map((t) => [t.id, t]));
                  return schedule.assignments.map((assignment, idx) => {
                    const craftsman = craftsmanMap.get(assignment.craftsmanId);
                    const task = taskMap.get(assignment.taskId);
                    return (
                      <tr
                        key={`${schedule.date}-${assignment.craftsmanId}-${assignment.taskId}-${idx}`}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                        data-testid={`schedule-row-${schedule.date}`}
                      >
                        <td className="py-2 px-3 text-xs text-slate-500 tabular-nums">
                          {idx === 0 ? schedule.date : ""}
                        </td>
                        <td className="py-2 px-3 text-xs font-medium text-slate-700">
                          {craftsman?.name ?? assignment.craftsmanId}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-600">
                          {task?.taskName ?? assignment.taskId}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                            style={{
                              background:
                                assignment.role === "lead" ? SAGE_GREEN : "#94a3b8",
                            }}
                          >
                            {assignment.role === "lead" ? "リード" : "サブ"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-500 tabular-nums">
                          {assignment.score.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-500">
                          {assignment.reasoning_ja}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-500 tabular-nums">
                          {idx === 0 ? `${schedule.utilizationPct}%` : ""}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* コンフリクト一覧 */}
      {result && uniqueConflicts.length > 0 && (
        <div className="space-y-2" data-testid="conflict-section">
          <h2 className="text-sm font-semibold" style={{ color: DANGER_RED }}>
            コンフリクト ({uniqueConflicts.length}件)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm" data-testid="conflict-table">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    種別
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    深刻度
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                    詳細
                  </th>
                </tr>
              </thead>
              <tbody>
                {uniqueConflicts.map((conflict, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-50 last:border-0"
                    style={
                      conflict.severity === "critical"
                        ? { background: "#fff5f5" }
                        : undefined
                    }
                    data-testid={`conflict-row-${conflict.kind}`}
                  >
                    <td className="py-2.5 px-3 text-xs font-medium text-slate-700">
                      {KIND_LABELS[conflict.kind]}
                    </td>
                    <td className="py-2.5 px-3">
                      <ConflictSeverityBadge severity={conflict.severity} />
                    </td>
                    <td
                      className="py-2.5 px-3 text-xs"
                      style={
                        conflict.severity === "critical"
                          ? { color: DANGER_RED }
                          : { color: "#78716c" }
                      }
                    >
                      {conflict.messageJa}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* タスクなし */}
      {tasks.length === 0 && (
        <p className="text-sm text-slate-400" data-testid="no-tasks-msg">
          タスクデータがありません。
        </p>
      )}

      {/* 最適化待ち */}
      {tasks.length > 0 && !result && (
        <p className="text-sm text-slate-500" data-testid="ready-msg">
          「最適化を実行」ボタンで職人の最適配置を計算します。
        </p>
      )}
    </div>
  );
}
