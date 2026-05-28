import type { Project, Task } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";
import { writeLastProjectId } from "./last-project.js";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type SampleProjectResult = {
  projectId: string;
  created: boolean;
};

export async function createSampleProject(
  projectRepository: Repository<Project>,
  taskRepository: Repository<Task>,
): Promise<SampleProjectResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const toDate = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return toLocalDateString(d);
  };

  const projectId = crypto.randomUUID();
  await projectRepository.create({
    id: projectId,
    name: "渋谷オフィスビル内装工事（サンプル）",
    description: "デモ用サンプル案件。自由に編集・削除してください。",
    address: "東京都渋谷区渋谷2-21-1",
    status: "active",
    mode: "normal",
    startDate: toLocalDateString(now),
    includeWeekends: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const sampleTasks = [
    { name: "解体・撤去工事", offsetStart: 0, offsetEnd: 4 },
    { name: "下地工事", offsetStart: 5, offsetEnd: 10 },
    { name: "電気・設備工事", offsetStart: 8, offsetEnd: 15 },
    { name: "内装仕上げ", offsetStart: 16, offsetEnd: 22 },
    { name: "清掃・竣工検査", offsetStart: 23, offsetEnd: 25 },
  ];

  for (const task of sampleTasks) {
    await taskRepository.create({
      id: crypto.randomUUID(),
      projectId,
      name: task.name,
      description: "",
      status: task.offsetEnd < 5 ? "done" : task.offsetStart <= 0 ? "in_progress" : "todo",
      progress: task.offsetEnd < 5 ? 100 : task.offsetStart <= 0 ? 40 : 0,
      startDate: toDate(task.offsetStart),
      dueDate: toDate(task.offsetEnd),
      dependencies: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  writeLastProjectId(projectId);
  return { projectId, created: true };
}

export async function ensureFirstRunProject(
  projectRepository: Repository<Project>,
  taskRepository: Repository<Task>,
): Promise<SampleProjectResult> {
  const projects = await projectRepository.findAll();
  if (projects.length > 0) {
    const [project] = projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    writeLastProjectId(project.id);
    return { projectId: project.id, created: false };
  }

  return createSampleProject(projectRepository, taskRepository);
}
