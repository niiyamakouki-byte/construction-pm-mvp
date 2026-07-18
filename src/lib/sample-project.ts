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

let firstRunProjectPromise: Promise<SampleProjectResult> | null = null;

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

  const sampleTasks: { name: string; description?: string; offsetStart: number; offsetEnd: number }[] = [
    { name: "解体・撤去工事", offsetStart: 0, offsetEnd: 4 },
    { name: "下地工事", offsetStart: 5, offsetEnd: 10 },
    { name: "電気・設備工事", offsetStart: 8, offsetEnd: 15 },
    { name: "内装仕上げ", offsetStart: 16, offsetEnd: 22 },
    { name: "清掃・竣工検査", offsetStart: 23, offsetEnd: 25 },
    // ponytail: 長文の工種名・説明を1件混ぜて表示崩れ(文字ズレ・折り返し)を検出しやすくする
    {
      name: "特殊建材による防音・遮音仕上げ工事（二重床・二重天井・吸音パネル張り及び配線ダクト移設を含む複合工程）",
      description:
        "既存躯体天井の解体後、遮音等級D-65仕様の二重天井下地を新設し、吸音パネル・遮音シートを施工する。同時に電気配線ダクトの移設と点検口の増設を行い、竣工検査にて遮音性能測定（JIS A 1416準拠）を実施する。工程内で近隣挨拶・搬入経路の使用許可申請も並行して進める。",
      offsetStart: 26,
      offsetEnd: 30,
    },
  ];

  for (const task of sampleTasks) {
    await taskRepository.create({
      id: crypto.randomUUID(),
      projectId,
      name: task.name,
      description: task.description ?? "",
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
  if (firstRunProjectPromise) return firstRunProjectPromise;

  firstRunProjectPromise = (async () => {
    const projects = await projectRepository.findAll();
    if (projects.length > 0) {
      const [project] = projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      writeLastProjectId(project.id);
      return { projectId: project.id, created: false };
    }

    return createSampleProject(projectRepository, taskRepository);
  })();

  try {
    return await firstRunProjectPromise;
  } finally {
    firstRunProjectPromise = null;
  }
}
