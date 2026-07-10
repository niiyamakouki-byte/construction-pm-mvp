/**
 * CardBoardPage.tsx（工程カードビュー統合 第2弾）
 *
 * データソースは GanttPage と同じ Task[]（task-store.ts 経由）。
 * カードの表示・ドラッグ配置・依存線の作成/削除は CardBoardChart に委譲し、
 * 書き込みは既存の taskRepository をそのまま使う（二重の書き込み経路を作らない）。
 * 依存を新規作成した際、後続の日程が矛盾していれば既存の cascade-scheduler で押し出す。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, Task } from "../domain/types.js";
import type { GanttTask } from "../components/gantt/types.js";
import { createProjectRepository } from "../stores/project-store.js";
import { createTaskRepository } from "../stores/task-store.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import { navigate } from "../hooks/useHashRouter.js";
import { filterScheduleTasks } from "../lib/cost-management.js";
import { resolveDependencyDrop } from "../components/gantt/utils.js";
import { computeConnectScheduleUpdates } from "../lib/card-board-schedule.js";
import { CardBoardChart } from "../components/card-board/CardBoardChart.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";

type CardBoardPageProps = {
  initialProjectId?: string | null;
};

/** cascade-scheduler は GanttTask 前提のため、日付が確定しているタスクだけを変換する。 */
function toGanttTaskLite(task: Task, project: Project | undefined): GanttTask | null {
  if (!task.startDate || !task.dueDate) return null;
  return {
    ...task,
    projectName: project?.name ?? "",
    startDate: task.startDate,
    endDate: task.dueDate,
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: project?.includeWeekends ?? true,
  };
}

export function CardBoardPage({ initialProjectId = null }: CardBoardPageProps) {
  const { organizationId } = useOrganizationContext();
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const taskRepository = useMemo(() => createTaskRepository(() => organizationId), [organizationId]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId ?? readLastProjectId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [allProjects, allTasks] = await Promise.all([
        projectRepository.findAll(),
        taskRepository.findAll(),
      ]);
      setProjects(allProjects);
      setTasks(filterScheduleTasks(allTasks));
      setSelectedProjectId((current) => {
        const candidates = [initialProjectId, current, readLastProjectId()].filter(Boolean) as string[];
        const matched = candidates.find((id) => allProjects.some((p) => p.id === id));
        if (matched) return matched;
        return (allProjects.find((p) => p.status === "active") ?? allProjects[0])?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "工程カードの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectRepository, taskRepository, initialProjectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回データ取得トリガー
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedProjectId) return;
    writeLastProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === selectedProjectId),
    [tasks, selectedProjectId],
  );

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    writeLastProjectId(projectId);
    navigate(`/cards/${projectId}`);
  }, []);

  const handleMove = useCallback((taskId: string, canvasX: number, canvasY: number) => {
    // 見た目の即時反映はCardBoardChart側のローカル状態が担うため、ここでは永続化のみ。
    void taskRepository.update(taskId, { canvasX, canvasY, updatedAt: new Date().toISOString() })
      .then(loadData)
      .catch((err) => setError(err instanceof Error ? err.message : "カード位置の保存に失敗しました"));
  }, [taskRepository, loadData]);

  const handleConnect = useCallback(async (predecessorId: string, successorId: string) => {
    const result = resolveDependencyDrop(projectTasks, predecessorId, successorId);
    if (!result.ok) {
      if (result.reason === "cycle") setError("循環依存関係が発生するため、この接続はできません。");
      return;
    }
    const successor = projectTasks.find((t) => t.id === successorId);
    if (!successor) return;

    try {
      const now = new Date().toISOString();
      await taskRepository.update(successorId, {
        dependencies: [...(successor.dependencies ?? []), predecessorId],
        updatedAt: now,
      });

      const ganttTasks = projectTasks
        .map((t) => toGanttTaskLite(t, selectedProject ?? undefined))
        .filter((t): t is GanttTask => t !== null);
      const scheduleUpdates = computeConnectScheduleUpdates(ganttTasks, predecessorId, successorId);
      if (scheduleUpdates.size > 0) {
        await Promise.all(
          Array.from(scheduleUpdates.entries()).map(([taskId, dates]) =>
            taskRepository.update(taskId, { startDate: dates.startDate, dueDate: dates.endDate, updatedAt: now }),
          ),
        );
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "依存関係の設定に失敗しました");
    }
  }, [projectTasks, taskRepository, selectedProject, loadData]);

  const handleDisconnect = useCallback(async (predecessorId: string, successorId: string) => {
    const successor = projectTasks.find((t) => t.id === successorId);
    if (!successor) return;
    const updated = (successor.dependencies ?? []).filter((id) => id !== predecessorId);
    try {
      await taskRepository.update(successorId, { dependencies: updated, updatedAt: new Date().toISOString() });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "依存関係の解除に失敗しました");
    }
  }, [projectTasks, taskRepository, loadData]);

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
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white border-b border-slate-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-slate-800">工程カードビュー</h1>
          {selectedProjectId && (
            <button
              onClick={() => navigate(`/gantt/${selectedProjectId}`)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ガント表示
            </button>
          )}
        </div>
        <select
          value={selectedProjectId ?? ""}
          onChange={(e) => handleProjectSelect(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700 shrink-0">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      <CardBoardChart
        tasks={projectTasks}
        onMove={handleMove}
        onConnect={(from, to) => { void handleConnect(from, to); }}
        onDisconnect={(from, to) => { void handleDisconnect(from, to); }}
      />
    </div>
  );
}
