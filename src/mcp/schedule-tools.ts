import {
  createTask,
  listTasks,
  updateTask,
  type TaskRow,
} from "./supabase-tools.js";
import { parseScheduleImportFile } from "../api/schedule-importer.js";

export type ScheduleItemInput = {
  name: string;
  description?: string;
  start_date?: string;
  due_date?: string;
  progress?: number;
  cost?: number;
};

export type ScheduleItemUpdate = Partial<Omit<ScheduleItemInput, "name">> & {
  name?: string;
  status?: "todo" | "in_progress" | "done";
};

export type ScheduleTaskService = {
  createTask: (input: Partial<TaskRow>) => Promise<TaskRow>;
  listTasks: (projectId: string) => Promise<TaskRow[]>;
  updateTask: (id: string, input: Partial<TaskRow>) => Promise<TaskRow>;
};

const defaultTaskService: ScheduleTaskService = {
  createTask,
  listTasks,
  updateTask,
};

function parseImportPayload(input: { file_base64?: string; buffer?: string }): ScheduleItemInput[] {
  const raw = input.file_base64 ?? input.buffer;
  if (!raw) {
    throw new Error("file_base64 or buffer is required");
  }

  const decoded = input.file_base64 ? atob(raw) : raw;
  try {
    const parsed: unknown = JSON.parse(decoded);
    if (!Array.isArray(parsed)) {
      throw new Error("Imported schedule must be a JSON array");
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Schedule item ${index + 1} must be an object`);
      }
      const candidate = item as Record<string, unknown>;
      if (typeof candidate["name"] !== "string") {
        throw new Error(`Schedule item ${index + 1} requires a name`);
      }
      return {
        name: candidate["name"],
        ...(typeof candidate["description"] === "string" ? { description: candidate["description"] } : {}),
        ...(typeof candidate["start_date"] === "string" ? { start_date: candidate["start_date"] } : {}),
        ...(typeof candidate["due_date"] === "string" ? { due_date: candidate["due_date"] } : {}),
        ...(typeof candidate["progress"] === "number" ? { progress: candidate["progress"] } : {}),
        ...(typeof candidate["cost"] === "number" ? { cost: candidate["cost"] } : {}),
      };
    });
  } catch {
    return parseScheduleImportFile({
      buffer: new TextEncoder().encode(decoded),
      filename: "schedule.csv",
    }).map((item) => ({
      name: item.name,
      start_date: item.startDate,
      due_date: item.endDate,
      ...(item.description ? { description: item.description } : {}),
    }));
  }
}

export async function createSchedule(input: {
  project_id: string;
  items: ScheduleItemInput[];
}, service: Pick<ScheduleTaskService, "createTask"> = defaultTaskService): Promise<TaskRow[]> {
  const tasks: TaskRow[] = [];
  for (const item of input.items) {
    tasks.push(await service.createTask({ project_id: input.project_id, ...item }));
  }
  return tasks;
}

export async function listScheduleItems(
  projectId: string,
  service: Pick<ScheduleTaskService, "listTasks"> = defaultTaskService,
): Promise<TaskRow[]> {
  return service.listTasks(projectId);
}

export async function updateScheduleItem(
  id: string,
  fields: ScheduleItemUpdate,
  service: Pick<ScheduleTaskService, "updateTask"> = defaultTaskService,
): Promise<TaskRow> {
  return service.updateTask(id, fields);
}

export async function importSchedule(input: {
  project_id: string;
  file_base64?: string;
  buffer?: string;
}, service: Pick<ScheduleTaskService, "createTask"> = defaultTaskService): Promise<TaskRow[]> {
  return createSchedule({
    project_id: input.project_id,
    items: parseImportPayload(input),
  }, service);
}
