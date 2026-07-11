/**
 * DelayPredictionPage — 工程遅延予測ダッシュボード (Sprint 13-A)
 *
 * プロジェクト選択 → 各タスクの遅延リスクを予測して表示。
 * v2-cozy: セージ #6B8E5A / critical のみ #C53030
 */

import { useEffect, useMemo, useState } from "react";
import type { Task } from "../domain/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { predictDelay } from "../lib/delay-predictor/predictor.js";
import { getHistoricalStore } from "../lib/delay-predictor/historical-store.js";
import { getPredictionStore } from "../lib/delay-predictor/prediction-store.js";
import { generateWeatherForecast } from "../lib/delay-predictor/weather-mock.js";
import type { DelayPrediction, RiskLevel } from "../lib/delay-predictor/types.js";
import { DEFAULT_PREDICTION_CONFIG } from "../lib/delay-predictor/types.js";

// ── Constants ──────────────────────────────────────────────────────────────

const SAGE_GREEN = "#6B8E5A";
const DANGER_RED = "#C53030";

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#64748b",
  medium: "#d97706",
  high: "#ea580c",
  critical: DANGER_RED,
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "低リスク",
  medium: "中リスク",
  high: "高リスク",
  critical: "緊急",
};

// ── Sub-components ─────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ background: RISK_COLORS[level] }}
      data-testid={`risk-badge-${level}`}
    >
      {RISK_LABELS[level]}
    </span>
  );
}

function RiskBar({ pct, level }: { pct: number; level: RiskLevel }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 rounded-full bg-slate-100 h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: RISK_COLORS[level] }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8">{pct}%</span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** タスクの工種を majorCategory → name の順で解決する */
function resolveTaskKind(task: Task): string {
  return task.majorCategory ?? task.name;
}

/** YYYY-MM-DD から月を取得 */
function monthFromDate(iso?: string | null): number {
  if (!iso) return new Date().getMonth() + 1;
  const m = parseInt(iso.slice(5, 7), 10);
  return isNaN(m) ? new Date().getMonth() + 1 : m;
}

/** 月から季節を返す */
function monthToSeason(month: number): "spring" | "summer" | "autumn" | "winter" {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

// ── Main component ─────────────────────────────────────────────────────────

export type DelayPredictionPageProps = {
  /** 選択可能なプロジェクト ID リスト */
  projectIds?: string[];
  /** プロジェクト ID → ラベルのマッピング */
  projectLabels?: Record<string, string>;
};

export function DelayPredictionPage({
  projectIds: propProjectIds,
  projectLabels: propLabels = {},
}: DelayPredictionPageProps) {
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [predictions, setPredictions] = useState<DelayPrediction[]>([]);
  const [criticalHighOnly, setCriticalHighOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const projectRepo = useMemo(() => createProjectRepository(), []);
  const taskRepo = useMemo(() => createTaskRepository(), []);
  const historicalStore = useMemo(() => getHistoricalStore(), []);
  const predictionStore = useMemo(() => getPredictionStore(), []);

  // プロジェクト一覧を取得
  useEffect(() => {
    if (propProjectIds && propProjectIds.length > 0) {
      const entries = propProjectIds.map((id) => ({
        id,
        name: propLabels[id] ?? id,
      }));
      setAllProjects(entries);
      setSelectedProjectId(entries[0]?.id ?? "");
      return;
    }

    projectRepo.findAll().then((projects) => {
      const entries = projects.map((p) => ({ id: p.id, name: p.name }));
      setAllProjects(entries);
      if (entries.length > 0) setSelectedProjectId(entries[0].id);
    });
  }, [propProjectIds, propLabels, projectRepo]);

  // 選択プロジェクトのタスクを取得
  useEffect(() => {
    if (!selectedProjectId) return;
    taskRepo.findAll().then((all) => {
      setTasks(all.filter((t) => t.projectId === selectedProjectId));
      setPredictions([]);
    });
  }, [selectedProjectId, taskRepo]);

  // 一括予測実行
  async function handlePredict() {
    if (tasks.length === 0) return;
    setIsLoading(true);

    const history = historicalStore.all();
    const results: DelayPrediction[] = [];

    for (const task of tasks) {
      const taskKind = resolveTaskKind(task);
      const month = monthFromDate(task.startDate);
      const season = monthToSeason(month);
      const weather = generateWeatherForecast(season, 5, Date.now() ^ task.id.charCodeAt(0));
      // 労務データなし → 空配列でリスク 0
      const prediction = predictDelay(
        { taskId: task.id, projectId: task.projectId, taskKind },
        weather,
        [],
        history,
        DEFAULT_PREDICTION_CONFIG,
      );
      results.push(prediction);
    }

    setPredictions(results);
    setIsLoading(false);
  }

  // PredictionStore に保存
  function handleSave() {
    if (predictions.length === 0) return;
    predictionStore.saveAll(predictions);
    setSavedCount(predictions.length);
    setTimeout(() => setSavedCount(0), 3000);
  }

  const displayedPredictions = useMemo(() => {
    if (!criticalHighOnly) return predictions;
    return predictions.filter(
      (p) => p.riskLevel === "critical" || p.riskLevel === "high",
    );
  }, [predictions, criticalHighOnly]);

  // タスク名を taskId から引く
  const taskMap = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );

  const criticalCount = predictions.filter((p) => p.riskLevel === "critical").length;
  const highCount = predictions.filter((p) => p.riskLevel === "high").length;

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: SAGE_GREEN }}>
          工程遅延予測
        </h1>
        {predictions.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {criticalCount > 0 && (
              <span className="font-semibold" style={{ color: DANGER_RED }}>
                緊急 {criticalCount}件
              </span>
            )}
            {highCount > 0 && (
              <span className="font-semibold text-orange-600">高 {highCount}件</span>
            )}
          </div>
        )}
      </div>

      {/* コントロール */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            案件
          </label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            data-testid="project-select"
          >
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handlePredict}
          disabled={isLoading || tasks.length === 0}
          className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: SAGE_GREEN }}
          data-testid="predict-btn"
        >
          {isLoading ? "予測中..." : "一括予測"}
        </button>

        {predictions.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={criticalHighOnly}
                onChange={(e) => setCriticalHighOnly(e.target.checked)}
                data-testid="critical-high-toggle"
                className="rounded"
              />
              <span className="text-slate-600">緊急/高のみ表示</span>
            </label>

            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              data-testid="save-btn"
            >
              予測を保存
            </button>

            {savedCount > 0 && (
              <span className="text-xs text-slate-400">{savedCount}件保存しました</span>
            )}
          </>
        )}
      </div>

      {/* タスク件数情報 */}
      {tasks.length > 0 && predictions.length === 0 && !isLoading && (
        <p className="text-sm text-slate-500">
          {tasks.length}件のタスクが見つかりました。一括予測を実行してください。
        </p>
      )}

      {tasks.length === 0 && selectedProjectId && (
        <p className="text-sm text-slate-400" data-testid="no-tasks-msg">
          この案件にはタスクがありません。
        </p>
      )}

      {/* 予測テーブル */}
      {displayedPredictions.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm" data-testid="prediction-table">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                  タスク名
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-500 text-xs">
                  天気リスク
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-500 text-xs">
                  労務リスク
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-500 text-xs">
                  種別ベース
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                  総合リスク
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                  レベル
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-500 text-xs">
                  推奨アクション
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedPredictions.map((pred) => {
                const task = taskMap.get(pred.taskId);
                const isCritical = pred.riskLevel === "critical";
                return (
                  <tr
                    key={pred.taskId}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                    style={isCritical ? { background: "#fff5f5" } : undefined}
                    data-testid={`prediction-row-${pred.taskId}`}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {task?.name ?? pred.taskId}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                      {pred.factors.weatherRisk}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                      {pred.factors.laborRisk}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                      {pred.factors.kindBaselineRisk}
                    </td>
                    <td className="py-2.5 px-3">
                      <RiskBar pct={pred.riskPct} level={pred.riskLevel} />
                    </td>
                    <td className="py-2.5 px-3">
                      <RiskBadge level={pred.riskLevel} />
                    </td>
                    <td
                      className="py-2.5 px-3 text-xs text-slate-600"
                      style={isCritical ? { color: DANGER_RED, fontWeight: 600 } : undefined}
                    >
                      {pred.suggestedAction_ja}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 空状態 */}
      {criticalHighOnly && predictions.length > 0 && displayedPredictions.length === 0 && (
        <p className="text-sm text-slate-400" data-testid="no-critical-high-msg">
          緊急・高リスクのタスクはありません。
        </p>
      )}
    </div>
  );
}
