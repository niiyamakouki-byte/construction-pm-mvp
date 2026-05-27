import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import type { Project } from "../domain/types.js";
import type { GeneratedSchedule, GeneratedTask, WorkCategory } from "../lib/ai-schedule-generator.js";
import {
  reconcileWithSchedule,
  proposeScheduleUpdate,
  explainDelta,
} from "../lib/photo-progress-tracker.js";
import type { TradeProgress, ScheduleDelta } from "../lib/photo-progress-tracker.js";

// ─── アダプター: プロジェクトタスク → GeneratedSchedule ──────────────────────

function buildGeneratedSchedule(
  project: Project,
  tasks: Array<{
    id: string;
    name: string;
    startDate?: string;
    dueDate?: string;
    dependencies: string[];
    progress: number;
  }>,
): GeneratedSchedule {
  const genTasks: GeneratedTask[] = tasks.map((t) => {
    const startDate = t.startDate ? new Date(t.startDate) : new Date();
    const endDate = t.dueDate ? new Date(t.dueDate) : new Date(startDate.getTime() + 86400000 * 2);
    const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    return {
      id: t.id,
      name: t.name,
      category: "other" as WorkCategory,
      startDate,
      endDate,
      durationDays,
      dependencies: t.dependencies ?? [],
      crewSize: 1,
    };
  });

  const valid = genTasks.filter((t) => !isNaN(t.startDate.getTime()));
  const startDate = valid.length > 0
    ? valid.reduce((min, t) => t.startDate < min ? t.startDate : min, valid[0].startDate)
    : new Date(project.startDate);
  const endDate = valid.length > 0
    ? valid.reduce((max, t) => t.endDate > max ? t.endDate : max, valid[0].endDate)
    : new Date();

  return {
    projectId: project.id,
    projectName: project.name,
    tasks: genTasks,
    totalDays: Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1),
    startDate,
    endDate,
    criticalPath: [],
    generatedAt: new Date(),
  };
}

// ─── TradeProgress入力フォーム ────────────────────────────────────────────────

const TRADE_OPTIONS: { value: WorkCategory; label: string }[] = [
  { value: "demolition", label: "解体" },
  { value: "framing", label: "軽量鉄骨" },
  { value: "mep_rough", label: "設備粗配管" },
  { value: "mep_finish", label: "設備仕上" },
  { value: "interior_rough", label: "内装下地" },
  { value: "interior_finish", label: "内装仕上" },
  { value: "exterior", label: "外装" },
  { value: "waterproof", label: "防水" },
  { value: "painting", label: "塗装" },
  { value: "cleaning", label: "清掃" },
  { value: "other", label: "その他" },
];

// ─── ProgressReviewPage ───────────────────────────────────────────────────────

export function ProgressReviewPage() {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TradeProgress入力
  const [trade, setTrade] = useState<WorkCategory>("painting");
  const [completionRate, setCompletionRate] = useState(0);
  const [confidence, setConfidence] = useState(0.8);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [photoId, setPhotoId] = useState("");

  // 結果
  const [progressList, setProgressList] = useState<TradeProgress[]>([]);
  const [deltas, setDeltas] = useState<ScheduleDelta[]>([]);
  const [updatedSchedule, setUpdatedSchedule] = useState<GeneratedSchedule | null>(null);
  const [explanations, setExplanations] = useState<string[]>([]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const allProjects = await projectRepository.findAll();
      setProjects(allProjects);
      if (allProjects.length > 0) {
        setSelectedProjectId((current) => current || allProjects[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, [projectRepository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- プロジェクト一覧の取得トリガー
    void loadProjects();
  }, [loadProjects]);

  const loadSchedule = useCallback(async (projectId: string) => {
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    try {
      const allTasks = await taskRepository.findAll();
      const tasks = allTasks.filter((t) => t.projectId === projectId);
      const gen = buildGeneratedSchedule(project, tasks);
      setSchedule(gen);
      setDeltas([]);
      setUpdatedSchedule(null);
      setExplanations([]);
      setProgressList([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "工程読み込み失敗");
    }
  }, [projects, taskRepository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- プロジェクト選択時に工程データを取得する意図的なパターン
    if (selectedProjectId) void loadSchedule(selectedProjectId);
  }, [selectedProjectId, loadSchedule]);

  const handleAddProgress = useCallback(() => {
    const entry: TradeProgress = {
      trade,
      completionRate: completionRate / 100,
      confidence,
      evidenceNotes: evidenceNotes || undefined,
      photoId: photoId || undefined,
      capturedAt: new Date(),
    };
    setProgressList((prev) => [...prev, entry]);
    setEvidenceNotes("");
    setPhotoId("");
  }, [trade, completionRate, confidence, evidenceNotes, photoId]);

  const handleReconcile = useCallback(() => {
    if (!schedule || progressList.length === 0) return;
    const found = reconcileWithSchedule(progressList, schedule, new Date());
    setDeltas(found);
    setUpdatedSchedule(null);
    setExplanations([]);
  }, [schedule, progressList]);

  const handleApplyUpdate = useCallback(() => {
    if (!schedule || deltas.length === 0) return;
    const next = proposeScheduleUpdate(deltas, schedule);
    const expls = deltas.map((d) => explainDelta(d, schedule));
    setUpdatedSchedule(next);
    setExplanations(expls);
    setSchedule(next);
  }, [schedule, deltas]);

  const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span className="text-sm text-slate-400">読み込み中...</span>
      </div>
    );
  }

  if (projects.length === 0 || !selectedProjectId) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-24">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">進捗レビューは、案件選択と写真選択を先に行います</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            対象案件を選んでから現場写真をアップロードすると、写真由来の進捗を入力して工程と突合できます。
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/app")}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
            >
              案件を選ぶ
            </button>
            <button
              type="button"
              onClick={() => navigate("/today")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              写真をアップロード
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 pb-24 px-4">
      <div className="rounded-[28px] bg-[linear-gradient(145deg,#fff8ef_0%,#f7fbff_55%,#eef6ff_100%)] px-4 py-5 shadow-sm ring-1 ring-slate-200 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500">photo-progress-tracker</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">進捗レビュー（Buildots統合）</h1>
        <p className="mt-1 text-sm text-slate-500">写真由来のトレード進捗を手入力し、スケジュールとの乖離を検出します。</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* プロジェクト選択 */}
      <div className="rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-slate-200">
        <label className="block text-xs font-semibold tracking-[0.16em] text-slate-500 mb-2">対象案件</label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {schedule && (
          <p className="mt-2 text-xs text-slate-500">
            {schedule.tasks.length}件の工程 / {fmtDate(schedule.startDate)} - {fmtDate(schedule.endDate)}
          </p>
        )}
      </div>

      {/* TradeProgress入力フォーム */}
      <div className="rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-slate-900 mb-3">AI判定進捗を入力</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">トレード</label>
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value as WorkCategory)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {TRADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              完了率: {completionRate}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={completionRate}
              onChange={(e) => setCompletionRate(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              信頼度: {Math.round(confidence * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(confidence * 100)}
              onChange={(e) => setConfidence(Number(e.target.value) / 100)}
              className="w-full accent-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">写真ID（任意）</label>
            <input
              type="text"
              value={photoId}
              onChange={(e) => setPhotoId(e.target.value)}
              placeholder="photo_001"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">メモ（任意）</label>
            <input
              type="text"
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
              placeholder="下地見えてる、仕上がりムラあり 等"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddProgress}
          className="mt-3 rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          + 進捗を追加
        </button>
      </div>

      {/* 入力済み進捗リスト */}
      {progressList.length > 0 && (
        <div className="rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">入力済み進捗 ({progressList.length}件)</h2>
            <button
              type="button"
              onClick={handleReconcile}
              disabled={!schedule}
              className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              スケジュール突合
            </button>
          </div>
          <div className="space-y-2">
            {progressList.map((p, idx) => {
              const label = TRADE_OPTIONS.find((o) => o.value === p.trade)?.label ?? p.trade;
              return (
                <div key={idx} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700 w-16">{label}</span>
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-brand-500 h-2 rounded-full"
                      style={{ width: `${p.completionRate * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums">{Math.round(p.completionRate * 100)}%</span>
                  <span className="text-slate-400">信頼度{Math.round(p.confidence * 100)}%</span>
                  {p.evidenceNotes && <span className="text-slate-400 truncate max-w-[120px]">{p.evidenceNotes}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 遅延検出結果 */}
      {deltas.length > 0 && (
        <div className="rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">遅延検出結果 ({deltas.length}件)</h2>
            <button
              type="button"
              onClick={handleApplyUpdate}
              className="rounded-2xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
            >
              遅延提案を適用
            </button>
          </div>
          <div className="space-y-2">
            {deltas.map((d, idx) => {
              const task = schedule?.tasks.find((t) => t.id === d.taskId);
              return (
                <div key={idx} className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                  <div className="font-semibold">{task?.name ?? d.taskId}</div>
                  <div className="mt-0.5 text-red-500">{d.reason}</div>
                  <div className="mt-0.5 text-red-400">
                    {fmtDate(d.currentEnd)} → {fmtDate(d.proposedEnd)}（+{d.deltaDays}日）
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deltas.length === 0 && progressList.length > 0 && !loading && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200 text-sm text-emerald-700">
          遅延は検出されませんでした。
        </div>
      )}

      {/* 適用後の説明 */}
      {updatedSchedule && explanations.length > 0 && (
        <div className="rounded-2xl bg-white/90 px-4 py-4 ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900 mb-3">適用済み変更</h2>
          <div className="space-y-2">
            {explanations.map((expl, idx) => (
              <div key={idx} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-relaxed">
                {expl}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            新しい竣工予定: <span className="font-semibold text-slate-700">{fmtDate(updatedSchedule.endDate)}</span>
            （{updatedSchedule.totalDays}日）
          </div>
        </div>
      )}
    </div>
  );
}
