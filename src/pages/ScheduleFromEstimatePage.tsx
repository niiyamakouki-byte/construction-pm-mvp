/**
 * ScheduleFromEstimatePage — estimate確定 → 工程タスク自動展開 (Sprint 3-8)
 * v2-cozy: 装飾削減・余白とフォント階層・セージグリーン1色・絵文字最小
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AssigneeSelector } from "../components/AssigneeSelector.js";
import { useOrganizationContext } from "../contexts/OrganizationContext.js";
import type { Project, TeamMember } from "../domain/types.js";
import type { EstimateLine } from "../estimate/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import { hasSupabaseEnv } from "../infra/supabase-client.js";
import {
  estimateToTasks,
  groupTasksByCategory,
} from "../lib/estimate-to-tasks.js";
import type { ProjectTask } from "../lib/estimate-to-tasks.js";
import { readLastProjectId, writeLastProjectId } from "../lib/last-project.js";
import { resolveProjectTaskSchedule } from "../lib/project-task-scheduler.js";
import {
  createProjectTasksStore,
  type AssignableMember,
  type PersistedProjectTask,
  type ProjectTasksStore,
} from "../lib/project-tasks-store.js";
import { createProjectRepository } from "../stores/project-store.js";

// ── サンプル見積行（デモ用）──────────────────────────────────────────────────

const SAMPLE_LINES: EstimateLine[] = [
  { code: "DIS-001", name: "解体撤去工事", unit: "式", quantity: 1, unitPrice: 150000, amount: 150000, note: "" },
  { code: "LGS-001", name: "LGS間仕切下地工事", unit: "㎡", quantity: 30, unitPrice: 3500, amount: 105000, note: "" },
  { code: "PB-001", name: "石膏ボード張り工事", unit: "㎡", quantity: 60, unitPrice: 1800, amount: 108000, note: "" },
  { code: "ELE-001", name: "電気配線工事", unit: "式", quantity: 1, unitPrice: 120000, amount: 120000, note: "100V/200V" },
  { code: "PT-001", name: "AEP塗装仕上げ", unit: "㎡", quantity: 60, unitPrice: 1200, amount: 72000, note: "" },
  { code: "FL-001", name: "フローリング張り", unit: "㎡", quantity: 25, unitPrice: 8000, amount: 200000, note: "オーク" },
  { code: "CL-001", name: "クロス張り工事", unit: "㎡", quantity: 80, unitPrice: 900, amount: 72000, note: "" },
  { code: "DR-001", name: "建具取付工事", unit: "箇所", quantity: 3, unitPrice: 25000, amount: 75000, note: "" },
  { code: "CLN-001", name: "清掃工事", unit: "式", quantity: 1, unitPrice: 30000, amount: 30000, note: "" },
];

// ── ステータスラベル ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ProjectTask["status"], string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

const STATUS_CLASS: Record<ProjectTask["status"], string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-[#7BA88A]/15 text-[#5E8A6C]",
  done: "bg-emerald-50 text-emerald-600",
};

type ScheduleTaskEdit = {
  title?: string;
  status?: ProjectTask["status"];
  dependsOn?: string[];
  assigneeId?: string;
};

type ScheduleTaskBlueprint = {
  id: string;
  title: string;
  note: string;
  estimateLineId?: string;
  durationDays: number;
  category: string;
  orderIndex: number;
};

type ScheduleTaskView = ScheduleTaskBlueprint & {
  status: ProjectTask["status"];
  dependsOn: string[];
  assigneeId?: string;
  startDate: string;
  endDate: string;
};

type ScheduleProjectOption = Pick<Project, "id" | "name">;

function normalizeStoredStatus(status: PersistedProjectTask["status"] | undefined): ProjectTask["status"] {
  if (status === "done" || status === "in_progress") {
    return status;
  }
  return "todo";
}

function createFallbackProjectId(projectName: string): string {
  const trimmedName = projectName.trim();
  return trimmedName ? `schedule-local:${trimmedName}` : "schedule-local:default";
}

function buildEditsFromStoredTasks(tasks: PersistedProjectTask[]): Record<string, ScheduleTaskEdit> {
  return Object.fromEntries(
    tasks.map((task) => [
      task.id,
      {
        title: task.title,
        status: normalizeStoredStatus(task.status),
        dependsOn: task.dependsOn,
        assigneeId: task.assigneeId,
      },
    ]),
  );
}

function sanitizeTaskDependencies(dependsOn: string[] | undefined, allowedIds: string[]): string[] {
  if (!dependsOn || dependsOn.length === 0) {
    return [];
  }

  const allowedIdSet = new Set(allowedIds);
  return Array.from(new Set(dependsOn)).filter((dependencyId) => allowedIdSet.has(dependencyId));
}

function buildTaskBlueprints(lines: EstimateLine[], projectStartDate: string): ScheduleTaskBlueprint[] {
  return estimateToTasks({
    lines,
    projectStartDate,
    skipWeekends: false,
  }).tasks.map((task, index) => ({
    id: task.id,
    title: task.name,
    note: task.note,
    estimateLineId: task.estimateLineCode || undefined,
    durationDays: task.durationDays,
    category: task.category,
    orderIndex: index,
  }));
}

function buildScheduleTasks(
  taskBlueprints: ScheduleTaskBlueprint[],
  taskEdits: Record<string, ScheduleTaskEdit>,
  projectStartDate: string,
  skipWeekends: boolean,
): ScheduleTaskView[] {
  const draftTasks = taskBlueprints.map((task, index) => {
    const edit = taskEdits[task.id];
    const allowedDependencies = taskBlueprints
      .slice(0, index)
      .map((candidate) => candidate.id);

    return {
      ...task,
      title: edit?.title?.trim() || task.title,
      status: edit?.status ?? "todo",
      dependsOn: sanitizeTaskDependencies(
        edit?.dependsOn ?? (index === 0 ? [] : [taskBlueprints[index - 1].id]),
        allowedDependencies,
      ),
      assigneeId: edit?.assigneeId,
    };
  });

  return resolveProjectTaskSchedule(draftTasks, {
    projectStartDate,
    skipWeekends,
  });
}

function calculateTotalDays(tasks: ScheduleTaskView[], fallbackDate: string): number {
  if (tasks.length === 0) {
    return 0;
  }

  const firstStart = new Date(tasks[0]?.startDate ?? fallbackDate);
  const lastEnd = new Date(tasks.reduce((latest, task) => task.endDate > latest ? task.endDate : latest, tasks[0].endDate));
  return Math.round((lastEnd.getTime() - firstStart.getTime()) / 86400000) + 1;
}

function toPersistedProjectTask(
  task: ScheduleTaskView,
  projectId: string,
): Omit<PersistedProjectTask, "createdAt" | "updatedAt"> {
  return {
    id: task.id,
    projectId,
    estimateLineId: task.estimateLineId,
    category: task.category,
    title: task.title,
    startDate: task.startDate,
    endDate: task.endDate,
    durationDays: task.durationDays,
    dependsOn: task.dependsOn,
    assigneeId: task.assigneeId,
    status: task.status,
    orderIndex: task.orderIndex,
  };
}

const defaultProjectTasksStore = createProjectTasksStore();

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function TaskRow({
  task,
  allTasks,
  members,
  disabled,
  onStatusChange,
  onAssigneeChange,
  onDependsOnChange,
}: {
  task: ScheduleTaskView;
  allTasks: ScheduleTaskView[];
  members: AssignableMember[];
  disabled: boolean;
  onStatusChange: (id: string, status: ProjectTask["status"]) => void;
  onAssigneeChange: (id: string, assigneeId: string | undefined) => void;
  onDependsOnChange: (id: string, dependsOn: string[]) => void;
}) {
  const cycleStatus = useCallback(() => {
    const next: Record<ProjectTask["status"], ProjectTask["status"]> = {
      todo: "in_progress",
      in_progress: "done",
      done: "todo",
    };
    onStatusChange(task.id, next[task.status]);
  }, [task.id, task.status, onStatusChange]);

  const dependencyOptions = useMemo(
    () => allTasks.filter((candidate) => candidate.orderIndex < task.orderIndex),
    [allTasks, task.orderIndex],
  );

  return (
    <tr
      data-testid="task-row"
      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-[150ms]"
    >
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>
        {task.note && (
          <p className="mt-0.5 text-xs text-slate-400 leading-tight">{task.note}</p>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap align-top">
        <p className="text-sm text-slate-700">{task.startDate}</p>
        <p className="text-xs text-slate-400">{task.durationDays}日間</p>
      </td>

      <td className="px-4 py-3 whitespace-nowrap align-top text-sm text-slate-600">
        {task.endDate}
      </td>

      <td className="px-4 py-3 align-top">
        {dependencyOptions.length === 0 ? (
          <p className="text-xs text-slate-400">依存なし</p>
        ) : (
          <select
            multiple
            data-testid={`dependency-select-${task.id}`}
            disabled={disabled}
            value={task.dependsOn}
            onChange={(event) =>
              onDependsOnChange(
                task.id,
                Array.from(event.target.selectedOptions).map((option) => option.value),
              )}
            className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-[#7BA88A] focus:outline-none disabled:bg-slate-50"
          >
            {dependencyOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <AssigneeSelector
          members={members}
          value={task.assigneeId}
          disabled={disabled}
          onChange={(assigneeId) => onAssigneeChange(task.id, assigneeId)}
        />
      </td>

      <td className="px-4 py-3 align-top">
        <button
          type="button"
          data-testid={`status-btn-${task.id}`}
          disabled={disabled}
          onClick={cycleStatus}
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium transition-colors duration-[150ms] disabled:opacity-60 ${STATUS_CLASS[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
        </button>
      </td>
    </tr>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export interface ScheduleFromEstimateProps {
  projectId?: string;
  projectName?: string;
  projectStartDate?: string;
  initialLines?: EstimateLine[];
  availableMembers?: AssignableMember[];
  initialPersistedTasks?: PersistedProjectTask[];
  projectOptions?: ScheduleProjectOption[];
  taskStore?: ProjectTasksStore;
}

export function ScheduleFromEstimatePage({
  projectId,
  projectName = "施工案件",
  projectStartDate: initialStart = new Date().toISOString().slice(0, 10),
  initialLines = SAMPLE_LINES,
  availableMembers,
  initialPersistedTasks,
  projectOptions,
  taskStore: taskStoreProp,
}: ScheduleFromEstimateProps) {
  const { organizationId } = useOrganizationContext();
  const taskStore = taskStoreProp ?? defaultProjectTasksStore;
  const persistenceEnabled = taskStoreProp !== undefined || !import.meta.env.VITEST;
  const fallbackProjectId = useMemo(() => createFallbackProjectId(projectName), [projectName]);
  const projectRepository = useMemo(() => createProjectRepository(() => organizationId), [organizationId]);
  const teamMemberRepository = useMemo(
    () => createAppRepository<TeamMember>("team_members", () => organizationId),
    [organizationId],
  );

  const [startDate, setStartDate] = useState(initialStart);
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [projects, setProjects] = useState<ScheduleProjectOption[]>(projectOptions ?? []);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => projectId ?? readLastProjectId() ?? (!persistenceEnabled || !hasSupabaseEnv() ? fallbackProjectId : null),
  );
  const [members, setMembers] = useState<AssignableMember[]>(availableMembers ?? []);
  const [taskEdits, setTaskEdits] = useState<Record<string, ScheduleTaskEdit>>(
    () => buildEditsFromStoredTasks(initialPersistedTasks ?? []),
  );
  const [persistedTaskIds, setPersistedTaskIds] = useState<string[]>(
    () => initialPersistedTasks?.map((task) => task.id) ?? [],
  );
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedProjectId = useMemo(
    () => projectId ?? selectedProjectId ?? (!persistenceEnabled || !hasSupabaseEnv() ? fallbackProjectId : null),
    [projectId, selectedProjectId, persistenceEnabled, fallbackProjectId],
  );

  const taskBlueprints = useMemo(
    () => buildTaskBlueprints(initialLines, initialStart),
    [initialLines, initialStart],
  );

  const tasks = useMemo(
    () => buildScheduleTasks(taskBlueprints, taskEdits, startDate, skipWeekends),
    [taskBlueprints, taskEdits, startDate, skipWeekends],
  );

  const grouped = useMemo(() => groupTasksByCategory(
    tasks.map((task) => ({
      id: task.id,
      name: task.title,
      estimateLineCode: task.estimateLineId ?? "",
      durationDays: task.durationDays,
      startDate: task.startDate,
      endDate: task.endDate,
      category: task.category,
      status: task.status,
      note: task.note,
    })),
  ), [tasks]);

  const totalDays = useMemo(() => calculateTotalDays(tasks, startDate), [tasks, startDate]);
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const activeProjectName = projectOptions?.find((project) => project.id === resolvedProjectId)?.name
    ?? projects.find((project) => project.id === resolvedProjectId)?.name
    ?? projectName;

  const persistSchedule = useCallback(async (
    nextTaskEdits: Record<string, ScheduleTaskEdit>,
    options?: {
      nextStartDate?: string;
      nextSkipWeekends?: boolean;
      previousPersistedIds?: string[];
      rollback?: () => void;
    },
  ) => {
    if (!persistenceEnabled || !resolvedProjectId) {
      return;
    }

    const nextStartDate = options?.nextStartDate ?? startDate;
    const nextSkipWeekends = options?.nextSkipWeekends ?? skipWeekends;
    const nextTasks = buildScheduleTasks(taskBlueprints, nextTaskEdits, nextStartDate, nextSkipWeekends);
    const persistedIds = options?.previousPersistedIds ?? persistedTaskIds;
    const nextTaskIdSet = new Set(nextTasks.map((task) => task.id));
    const staleTaskIds = persistedIds.filter((id) => !nextTaskIdSet.has(id));

    setSaving(true);
    setError(null);

    try {
      const savedTasks = await Promise.all(
        nextTasks.map((task) => taskStore.upsertProjectTask(toPersistedProjectTask(task, resolvedProjectId))),
      );
      await Promise.all(staleTaskIds.map((id) => taskStore.deleteProjectTask(id)));
      setPersistedTaskIds(savedTasks.map((task) => task.id));
    } catch (err) {
      options?.rollback?.();
      setError(err instanceof Error ? err.message : "工程表の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [
    persistenceEnabled,
    persistedTaskIds,
    resolvedProjectId,
    skipWeekends,
    startDate,
    taskBlueprints,
    taskStore,
  ]);

  useEffect(() => {
    if (projectOptions) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prop同期でプロジェクト候補を置き換える
      setProjects(projectOptions);
    }
  }, [projectOptions]);

  useEffect(() => {
    if (availableMembers) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prop同期で担当者候補を置き換える
      setMembers(availableMembers);
      return;
    }

    if (!persistenceEnabled) {
      return;
    }

    let disposed = false;
    void teamMemberRepository.findAll()
      .then((loadedMembers) => {
        if (disposed) {
          return;
        }

        setMembers(
          loadedMembers
            .map((member) => ({
              id: member.id,
              name: member.name,
              role: member.role,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, "ja")),
        );
      })
      .catch((err) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "メンバーの読み込みに失敗しました");
        }
      });

    return () => {
      disposed = true;
    };
  }, [availableMembers, persistenceEnabled, teamMemberRepository]);

  useEffect(() => {
    if (projectId || projectOptions || !persistenceEnabled) {
      return;
    }

    let disposed = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期ロード開始の状態反映
    setLoadingProjects(true);

    void projectRepository.findAll()
      .then((loadedProjects) => {
        if (disposed) {
          return;
        }

        const nextProjects = loadedProjects
          .map((project) => ({ id: project.id, name: project.name }))
          .sort((left, right) => left.name.localeCompare(right.name, "ja"));

        setProjects(nextProjects);
        setSelectedProjectId((current) => {
          const storedId = readLastProjectId();
          const candidate = current ?? storedId;
          if (candidate && nextProjects.some((project) => project.id === candidate)) {
            return candidate;
          }
          return nextProjects[0]?.id ?? (!hasSupabaseEnv() ? fallbackProjectId : null);
        });
      })
      .catch((err) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "案件の読み込みに失敗しました");
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoadingProjects(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [
    fallbackProjectId,
    persistenceEnabled,
    projectId,
    projectOptions,
    projectRepository,
  ]);

  useEffect(() => {
    if (!persistenceEnabled || !resolvedProjectId) {
      return;
    }

    let disposed = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期ロード開始の状態反映
    setLoadingTasks(true);

    void taskStore.fetchProjectTasks(resolvedProjectId)
      .then((storedTasks) => {
        if (disposed) {
          return;
        }

        const nextTaskEdits = buildEditsFromStoredTasks(storedTasks);
        const nextPersistedIds = storedTasks.map((task) => task.id);
        setTaskEdits(nextTaskEdits);
        setPersistedTaskIds(nextPersistedIds);

        if (import.meta.env.VITEST && taskStoreProp === undefined) {
          return;
        }

        void persistSchedule(nextTaskEdits, {
          previousPersistedIds: nextPersistedIds,
        });
      })
      .catch((err) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "工程タスクの読み込みに失敗しました");
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoadingTasks(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [persistSchedule, persistenceEnabled, resolvedProjectId, taskStore, taskStoreProp]);

  const handleStatusChange = useCallback((id: string, status: ProjectTask["status"]) => {
    const previousTaskEdits = taskEdits;
    const nextTaskEdits = {
      ...taskEdits,
      [id]: {
        ...taskEdits[id],
        status,
      },
    };
    setTaskEdits(nextTaskEdits);
    void persistSchedule(nextTaskEdits, {
      rollback: () => setTaskEdits(previousTaskEdits),
    });
  }, [persistSchedule, taskEdits]);

  const handleAssigneeChange = useCallback((id: string, assigneeId: string | undefined) => {
    const previousTaskEdits = taskEdits;
    const nextTaskEdits = {
      ...taskEdits,
      [id]: {
        ...taskEdits[id],
        assigneeId,
      },
    };
    setTaskEdits(nextTaskEdits);
    void persistSchedule(nextTaskEdits, {
      rollback: () => setTaskEdits(previousTaskEdits),
    });
  }, [persistSchedule, taskEdits]);

  const handleDependsOnChange = useCallback((id: string, dependsOn: string[]) => {
    const previousTaskEdits = taskEdits;
    const nextTaskEdits = {
      ...taskEdits,
      [id]: {
        ...taskEdits[id],
        dependsOn,
      },
    };
    setTaskEdits(nextTaskEdits);
    void persistSchedule(nextTaskEdits, {
      rollback: () => setTaskEdits(previousTaskEdits),
    });
  }, [persistSchedule, taskEdits]);

  const handleStartDateChange = useCallback((value: string) => {
    const previousStartDate = startDate;
    setStartDate(value);
    void persistSchedule(taskEdits, {
      nextStartDate: value,
      rollback: () => setStartDate(previousStartDate),
    });
  }, [persistSchedule, startDate, taskEdits]);

  const handleSkipWeekendsChange = useCallback((checked: boolean) => {
    const previousSkipWeekends = skipWeekends;
    setSkipWeekends(checked);
    void persistSchedule(taskEdits, {
      nextSkipWeekends: checked,
      rollback: () => setSkipWeekends(previousSkipWeekends),
    });
  }, [persistSchedule, skipWeekends, taskEdits]);

  if (!resolvedProjectId && hasSupabaseEnv()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-slate-800">工程表</h1>
        <p className="mt-3 text-sm text-slate-500">先に案件を作成すると、工程タスクを保存できます。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">工程表</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {activeProjectName}
              <span className="mx-1.5 text-slate-300">|</span>
              全{tasks.length}工程 / 約{totalDays}日
            </p>
            {(loadingTasks || saving || loadingProjects) && (
              <p className="mt-1 text-xs text-[#5E8A6C]">
                {loadingProjects ? "案件を読み込み中..." : loadingTasks ? "保存データを読み込み中..." : "工程表を保存中..."}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">{doneCount}/{tasks.length}完了</span>

            {!projectId && projects.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                案件
                <select
                  data-testid="project-select"
                  value={resolvedProjectId ?? ""}
                  disabled={saving}
                  onChange={(event) => {
                    setSelectedProjectId(event.target.value || null);
                    if (event.target.value) {
                      writeLastProjectId(event.target.value);
                    }
                  }}
                  className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-[#7BA88A] focus:outline-none"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              開始
              <input
                data-testid="start-date-input"
                type="date"
                value={startDate}
                disabled={saving}
                onChange={(event) => handleStartDateChange(event.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-[#7BA88A] focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                data-testid="skip-weekends-checkbox"
                type="checkbox"
                checked={skipWeekends}
                disabled={saving}
                onChange={(event) => handleSkipWeekendsChange(event.target.checked)}
                className="accent-[#7BA88A]"
              />
              土日除く
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 space-y-6">
        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {tasks.length === 0 && (
          <p className="text-sm text-slate-400 py-12 text-center">
            見積行がありません
          </p>
        )}

        {[...grouped.entries()].map(([category, categoryTasks]) => (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <h2
              id={`cat-${category}`}
              className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide"
            >
              {category}
            </h2>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse" data-testid="schedule-table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">工事名</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">開始日</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">終了日</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">依存タスク</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">担当者</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTasks.map((categoryTask) => {
                    const task = tasks.find((candidate) => candidate.id === categoryTask.id);
                    if (!task) {
                      return null;
                    }
                    return (
                      <TaskRow
                        key={task.id}
                        task={task}
                        allTasks={tasks}
                        members={members}
                        disabled={saving}
                        onStatusChange={handleStatusChange}
                        onAssigneeChange={handleAssigneeChange}
                        onDependsOnChange={handleDependsOnChange}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
