import {
  requireExistingProject,
  requireExistingTask,
  resolveTaskContractor,
  wouldCreateDependencyCycle,
} from "../route-helpers.js";
import { serializeTask } from "../serialization.js";
import { created, noContent, ok } from "../responses.js";
import { ApiError, type ApiRouteHandler, type ApiTaskRecord, type UpdateTaskInput } from "../types.js";
import {
  assertDateOrder,
  validateCreateDependencyInput,
  validateCreateTaskInput,
  validateUpdateTaskInput,
} from "../validation.js";

function assertMilestoneSchedule(
  startDate: string | undefined,
  endDate: string | undefined,
  isMilestone: boolean,
): void {
  if (!startDate || !endDate) {
    return;
  }

  assertDateOrder(startDate, endDate);
  if (isMilestone && startDate !== endDate) {
    throw new ApiError(400, "マイルストーンは開始日と終了日を同日にしてください。");
  }
}

function resolveNextTaskSchedule(existing: ApiTaskRecord, input: UpdateTaskInput) {
  return {
    startDate: input.startDate === undefined ? existing.startDate : (input.startDate ?? undefined),
    endDate: input.endDate === undefined ? existing.dueDate : (input.endDate ?? undefined),
    isMilestone: input.isMilestone ?? existing.isMilestone,
  };
}

export const handleTasksRoutes: ApiRouteHandler = async ({ pathname, request, store }) => {
  const projectTasksMatch = pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
  if (projectTasksMatch) {
    const projectId = decodeURIComponent(projectTasksMatch[1]);
    await requireExistingProject(store, projectId);

    if (request.method === "GET") {
      return ok({
        tasks: (await store.listTasks(projectId)).map(serializeTask),
      });
    }

    if (request.method === "POST") {
      const input = validateCreateTaskInput(request.body ?? {});
      const contractorLink =
        input.contractorId !== undefined
          ? await resolveTaskContractor(store, input.contractorId)
          : {};
      const task = await store.createTask(projectId, {
        ...input,
        contractorId: contractorLink.contractorId ?? input.contractorId,
        contractor: contractorLink.contractor ?? input.contractor,
      });

      return created({
        task: serializeTask(task),
      });
    }
  }

  const projectMilestonesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/milestones$/);
  if (request.method === "GET" && projectMilestonesMatch) {
    const projectId = decodeURIComponent(projectMilestonesMatch[1]);
    await requireExistingProject(store, projectId);
    const milestones = (await store.listTasks(projectId))
      .filter((task) => task.isMilestone)
      .map(serializeTask);

    return ok({ milestones });
  }

  const taskDependenciesMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/dependencies$/);
  if (request.method === "POST" && taskDependenciesMatch) {
    const taskId = decodeURIComponent(taskDependenciesMatch[1]);
    const task = await requireExistingTask(store, taskId);
    const dependency = validateCreateDependencyInput(request.body ?? {});

    if (dependency.predecessorId === taskId) {
      throw new ApiError(400, "タスク自身を依存先には設定できません。");
    }

    const predecessor = await store.getTask(dependency.predecessorId);
    if (!predecessor) {
      throw new ApiError(404, "指定された依存先タスクが見つかりません。");
    }
    if (predecessor.projectId !== task.projectId) {
      throw new ApiError(400, "依存関係は同一プロジェクト内のタスクにのみ設定できます。");
    }
    if (await wouldCreateDependencyCycle(store, taskId, dependency.predecessorId)) {
      throw new ApiError(400, "依存関係が循環するため追加できません。");
    }

    const updatedTask = await store.updateTask(taskId, {
      dependencies: [...task.dependencies, dependency],
    });
    if (!updatedTask) {
      throw new ApiError(404, "指定されたタスクが見つかりません。");
    }

    return created({
      task: serializeTask(updatedTask),
    });
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (!taskMatch) {
    return null;
  }

  const taskId = decodeURIComponent(taskMatch[1]);

  if (request.method === "PATCH") {
    const existing = await requireExistingTask(store, taskId);
    const input = validateUpdateTaskInput(request.body ?? {});

    if (input.projectId !== undefined) {
      await requireExistingProject(store, input.projectId);
    }
    if (input.contractorId !== undefined) {
      Object.assign(input, await resolveTaskContractor(store, input.contractorId));
    }

    const nextSchedule = resolveNextTaskSchedule(existing, input);
    assertMilestoneSchedule(nextSchedule.startDate, nextSchedule.endDate, nextSchedule.isMilestone);

    const task = await store.updateTask(taskId, input);
    if (!task) {
      throw new ApiError(404, "指定されたタスクが見つかりません。");
    }

    return ok({
      task: serializeTask(task),
    });
  }

  if (request.method === "DELETE") {
    const deleted = await store.deleteTask(taskId);
    if (!deleted) {
      throw new ApiError(404, "指定されたタスクが見つかりません。");
    }
    return noContent();
  }

  return null;
};
