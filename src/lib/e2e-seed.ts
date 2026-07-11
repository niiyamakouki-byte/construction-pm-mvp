/**
 * Development/Preview-only deterministic demo seed.
 * Provenance: laporta-beads-d4vpz; creator: Codex; implementation commit: 6285f41.
 */
import type { CostItem, Project, Task } from "../domain/types.js";
import type { UploadedPhoto } from "../infra/supabase-adapter/photo-repository.js";
import type { TakeoffEstimateItem } from "./takeoff-to-estimate.js";

declare const __VERCEL_ENV__: string;

export const E2E_DEMO_PROJECT_ID = "e2e00000-0000-4000-8000-000000000001";
export const E2E_PHOTOS_STORAGE_KEY = "genbahub:e2e-photos";
export const E2E_ESTIMATES_STORAGE_KEY = "genbahub:e2e-estimates";

type SeedStorage = Pick<Storage, "getItem" | "setItem">;

export type E2ESeedEnvironment = {
  isDevelopment: boolean;
  vercelEnvironment: string;
};

export type E2ESeedResult = {
  projectId: string;
  projects: number;
  tasks: number;
  photos: number;
  estimates: number;
};

export function isE2ESeedAllowed(
  environment: E2ESeedEnvironment = {
    isDevelopment: import.meta.env.DEV,
    vercelEnvironment: __VERCEL_ENV__,
  },
): boolean {
  return environment.isDevelopment || environment.vercelEnvironment === "preview";
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return toLocalDateString(result);
}

function readArray<T>(storage: SeedStorage, key: string): T[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function mergeById<T extends { id: string }>(current: T[], seeded: T[]): T[] {
  const seededIds = new Set(seeded.map((item) => item.id));
  return [...current.filter((item) => !seededIds.has(item.id)), ...seeded];
}

export function seedE2EDemoData(storage: SeedStorage, now = new Date()): E2ESeedResult {
  const timestamp = now.toISOString();
  const project: Project = {
    id: E2E_DEMO_PROJECT_ID,
    name: "E2Eデモ：青山オフィス改装",
    description: "laporta-beads-d4vpz の再現可能な開発・Preview専用デモ案件です。",
    address: "東京都港区北青山3-5-6",
    status: "active",
    mode: "normal",
    startDate: addDays(now, -7),
    endDate: addDays(now, 21),
    budget: 5_500_000,
    includeWeekends: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const tasks: Task[] = [
    {
      id: "e2e00000-0000-4000-8000-000000000101",
      projectId: project.id,
      name: "既存内装の解体・撤去",
      description: "養生後に既存間仕切りと床材を撤去",
      status: "done",
      progress: 100,
      startDate: addDays(now, -7),
      dueDate: addDays(now, -4),
      dependencies: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "e2e00000-0000-4000-8000-000000000102",
      projectId: project.id,
      name: "軽量下地・ボード工事",
      description: "会議室と執務室の間仕切りを施工",
      status: "in_progress",
      progress: 45,
      startDate: addDays(now, -1),
      dueDate: addDays(now, 2),
      dependencies: ["e2e00000-0000-4000-8000-000000000101"],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "e2e00000-0000-4000-8000-000000000103",
      projectId: project.id,
      name: "電気・照明設備工事",
      description: "LED照明とコンセントを増設",
      status: "todo",
      progress: 0,
      startDate: addDays(now, 3),
      dueDate: addDays(now, 7),
      dependencies: ["e2e00000-0000-4000-8000-000000000102"],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "e2e00000-0000-4000-8000-000000000104",
      projectId: project.id,
      name: "内装仕上げ・竣工検査",
      description: "クロス・床仕上げ後に施主検査",
      status: "todo",
      progress: 0,
      startDate: addDays(now, 8),
      dueDate: addDays(now, 14),
      dependencies: ["e2e00000-0000-4000-8000-000000000103"],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const costItems: CostItem[] = [
    {
      id: "e2e00000-0000-4000-8000-000000000201",
      projectId: project.id,
      taskId: tasks[0]!.id,
      description: "解体・産廃処分",
      amount: 620_000,
      category: "解体工事",
      costDate: addDays(now, -4),
      paymentStatus: "paid",
      breakdownType: "task_cost",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "e2e00000-0000-4000-8000-000000000202",
      projectId: project.id,
      taskId: tasks[1]!.id,
      description: "軽量鉄骨・石膏ボード",
      amount: 880_000,
      category: "内装工事",
      costDate: addDays(now, -1),
      paymentStatus: "unpaid",
      breakdownType: "material_cost",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const photos: UploadedPhoto[] = [
    {
      id: "e2e-photo-before",
      projectId: project.id,
      storagePath: "e2e/before.png",
      fileName: "着工前_全景.png",
      contentType: "image/png",
      fileSize: 1,
      url: "/lp/screen-dashboard.png",
      category: "着工前",
      caption: "着工前の室内全景",
      takenAt: addDays(now, -7),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "e2e-photo-progress",
      projectId: project.id,
      taskId: tasks[1]!.id,
      storagePath: "e2e/progress.png",
      fileName: "内装_下地施工中.png",
      contentType: "image/png",
      fileSize: 1,
      url: "/lp/screen-estimate.png",
      category: "内装",
      caption: "軽量下地の施工状況",
      takenAt: toLocalDateString(now),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const estimateItems: TakeoffEstimateItem[] = [
    { code: "DM-001", name: "内装解体", unit: "㎡", unitPrice: 0, quantity: 85 },
    { code: "IN-005", name: "量産クロス張り", unit: "㎡", unitPrice: 0, quantity: 210 },
    { code: "EL-004", name: "LED直管照明", unit: "台", unitPrice: 0, quantity: 18 },
  ];
  const estimates = [{
    id: "e2e-estimate-001",
    projectId: project.id,
    propertyName: project.name,
    clientName: "株式会社デモ建設",
    totalAmount: 5_500_000,
    taxRate: 0.1,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  }];

  storage.setItem("genbahub:projects", JSON.stringify(mergeById(readArray<Project>(storage, "genbahub:projects"), [project])));
  storage.setItem("genbahub:tasks", JSON.stringify(mergeById(readArray<Task>(storage, "genbahub:tasks"), tasks)));
  storage.setItem("genbahub:cost_items", JSON.stringify(mergeById(readArray<CostItem>(storage, "genbahub:cost_items"), costItems)));
  storage.setItem(E2E_PHOTOS_STORAGE_KEY, JSON.stringify(mergeById(readArray<UploadedPhoto>(storage, E2E_PHOTOS_STORAGE_KEY), photos)));
  storage.setItem(E2E_ESTIMATES_STORAGE_KEY, JSON.stringify(estimates));
  storage.setItem("takeoff_estimate_inject", JSON.stringify(estimateItems));
  storage.setItem("genbahub:last-project-id", project.id);
  storage.setItem("genbahub_onboarding_done", "1");
  storage.setItem("genbahub_tour_done", "1");

  return { projectId: project.id, projects: 1, tasks: tasks.length, photos: photos.length, estimates: estimates.length };
}
