import type { BaseEntity, TeamMember } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";
import { createAppRepository } from "../infra/create-app-repository.js";

export type PersistedProjectTaskStatus = "planned" | "todo" | "in_progress" | "done";

export type PersistedProjectTask = BaseEntity & {
  projectId: string;
  estimateLineId?: string;
  category: string;
  title: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  dependsOn: string[];
  assigneeId?: string;
  status: PersistedProjectTaskStatus;
  orderIndex: number;
};

export type ProjectTasksStore = {
  fetchProjectTasks(projectId: string): Promise<PersistedProjectTask[]>;
  upsertProjectTask(task: Omit<PersistedProjectTask, "createdAt" | "updatedAt"> & Partial<Pick<PersistedProjectTask, "createdAt" | "updatedAt">>): Promise<PersistedProjectTask>;
  deleteProjectTask(id: string): Promise<boolean>;
};

function normalizeDependsOn(dependsOn: string[] | undefined): string[] {
  if (!dependsOn || dependsOn.length === 0) {
    return [];
  }
  return Array.from(new Set(dependsOn.filter(Boolean)));
}

function sortProjectTasks(tasks: PersistedProjectTask[]): PersistedProjectTask[] {
  return [...tasks].sort((left, right) => {
    if (left.orderIndex !== right.orderIndex) {
      return left.orderIndex - right.orderIndex;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function createProjectTasksStore(
  repository: Repository<PersistedProjectTask> = createAppRepository<PersistedProjectTask>("project_tasks"),
): ProjectTasksStore {
  return {
    async fetchProjectTasks(projectId) {
      const allTasks = await repository.findAll();
      return sortProjectTasks(
        allTasks
          .filter((task) => task.projectId === projectId)
          .map((task) => ({
            ...task,
            dependsOn: normalizeDependsOn(task.dependsOn),
          })),
      );
    },

    async upsertProjectTask(task) {
      const now = new Date().toISOString();
      const normalizedTask: PersistedProjectTask = {
        ...task,
        estimateLineId: task.estimateLineId ?? undefined,
        assigneeId: task.assigneeId ?? undefined,
        status: task.status ?? "planned",
        dependsOn: normalizeDependsOn(task.dependsOn),
        createdAt: task.createdAt ?? now,
        updatedAt: now,
      };

      const existing = await repository.findById(normalizedTask.id);
      if (existing) {
        const updated = await repository.update(normalizedTask.id, {
          projectId: normalizedTask.projectId,
          estimateLineId: normalizedTask.estimateLineId,
          category: normalizedTask.category,
          title: normalizedTask.title,
          startDate: normalizedTask.startDate,
          endDate: normalizedTask.endDate,
          durationDays: normalizedTask.durationDays,
          dependsOn: normalizedTask.dependsOn,
          assigneeId: normalizedTask.assigneeId,
          status: normalizedTask.status,
          orderIndex: normalizedTask.orderIndex,
          updatedAt: now,
        });
        return updated ?? {
          ...existing,
          ...normalizedTask,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
      }

      return repository.create(normalizedTask);
    },

    async deleteProjectTask(id) {
      return repository.delete(id);
    },
  };
}

const defaultProjectTasksStore = createProjectTasksStore();

export const fetchProjectTasks = defaultProjectTasksStore.fetchProjectTasks;
export const upsertProjectTask = defaultProjectTasksStore.upsertProjectTask;
export const deleteProjectTask = defaultProjectTasksStore.deleteProjectTask;

export type AssignableMember = Pick<TeamMember, "id" | "name" | "role">;
