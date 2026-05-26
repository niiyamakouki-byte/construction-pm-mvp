/**
 * TaskAssignmentStore — persists TaskAssignment[] to localStorage.
 *
 * Key: "genbahub:crew-tasks"
 * Capacity: 5000件
 * Singleton proxy + EventTarget
 */

import type { TaskAssignment, CraftsmanSkill } from "./types.js";

const STORAGE_KEY = "genbahub:crew-tasks";
const MAX_TASKS = 5000;

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedTasks(): TaskAssignment[] {
  type SeedEntry = {
    id: string;
    projectId: string;
    projectName: string;
    taskName: string;
    requiredSkills: CraftsmanSkill[];
    startDate: string;
    endDate: string;
    siteLat: number;
    siteLng: number;
    peopleNeeded: number;
    priority: number;
  };

  const seeds: SeedEntry[] = [
    { id: "t001", projectId: "proj-001", projectName: "渋谷リノベーション", taskName: "解体工事", requiredSkills: ["demolition"], startDate: "2026-06-01", endDate: "2026-06-05", siteLat: 35.658, siteLng: 139.701, peopleNeeded: 3, priority: 4 },
    { id: "t002", projectId: "proj-001", projectName: "渋谷リノベーション", taskName: "壁ボード張り", requiredSkills: ["drywall"], startDate: "2026-06-08", endDate: "2026-06-12", siteLat: 35.658, siteLng: 139.701, peopleNeeded: 2, priority: 3 },
    { id: "t003", projectId: "proj-001", projectName: "渋谷リノベーション", taskName: "電気配線", requiredSkills: ["electrical"], startDate: "2026-06-10", endDate: "2026-06-15", siteLat: 35.658, siteLng: 139.701, peopleNeeded: 2, priority: 5 },
    { id: "t004", projectId: "proj-002", projectName: "青山内装工事", taskName: "給排水配管", requiredSkills: ["plumbing"], startDate: "2026-06-03", endDate: "2026-06-07", siteLat: 35.665, siteLng: 139.710, peopleNeeded: 2, priority: 5 },
    { id: "t005", projectId: "proj-002", projectName: "青山内装工事", taskName: "空調設備", requiredSkills: ["hvac"], startDate: "2026-06-09", endDate: "2026-06-14", siteLat: 35.665, siteLng: 139.710, peopleNeeded: 1, priority: 4 },
    { id: "t006", projectId: "proj-002", projectName: "青山内装工事", taskName: "内装仕上げ", requiredSkills: ["interior_finish", "painting"], startDate: "2026-06-15", endDate: "2026-06-20", siteLat: 35.665, siteLng: 139.710, peopleNeeded: 3, priority: 3 },
    { id: "t007", projectId: "proj-003", projectName: "新宿オフィス改修", taskName: "足場組み", requiredSkills: ["scaffolding"], startDate: "2026-06-01", endDate: "2026-06-03", siteLat: 35.690, siteLng: 139.700, peopleNeeded: 2, priority: 4 },
    { id: "t008", projectId: "proj-003", projectName: "新宿オフィス改修", taskName: "塗装工事", requiredSkills: ["painting"], startDate: "2026-06-04", endDate: "2026-06-10", siteLat: 35.690, siteLng: 139.700, peopleNeeded: 2, priority: 3 },
    { id: "t009", projectId: "proj-003", projectName: "新宿オフィス改修", taskName: "器具取付", requiredSkills: ["fixture_install"], startDate: "2026-06-11", endDate: "2026-06-16", siteLat: 35.690, siteLng: 139.700, peopleNeeded: 2, priority: 3 },
    { id: "t010", projectId: "proj-003", projectName: "新宿オフィス改修", taskName: "清掃", requiredSkills: ["cleanup"], startDate: "2026-06-17", endDate: "2026-06-18", siteLat: 35.690, siteLng: 139.700, peopleNeeded: 3, priority: 2 },
    { id: "t011", projectId: "proj-004", projectName: "恵比寿マンション", taskName: "解体清掃", requiredSkills: ["demolition", "cleanup"], startDate: "2026-06-01", endDate: "2026-06-04", siteLat: 35.647, siteLng: 139.710, peopleNeeded: 2, priority: 3 },
    { id: "t012", projectId: "proj-004", projectName: "恵比寿マンション", taskName: "電気工事", requiredSkills: ["electrical"], startDate: "2026-06-05", endDate: "2026-06-12", siteLat: 35.647, siteLng: 139.710, peopleNeeded: 2, priority: 5 },
    { id: "t013", projectId: "proj-004", projectName: "恵比寿マンション", taskName: "水回り配管", requiredSkills: ["plumbing", "hvac"], startDate: "2026-06-06", endDate: "2026-06-13", siteLat: 35.647, siteLng: 139.710, peopleNeeded: 2, priority: 4 },
    { id: "t014", projectId: "proj-005", projectName: "六本木店舗改装", taskName: "壁・天井ボード", requiredSkills: ["drywall", "interior_finish"], startDate: "2026-06-08", endDate: "2026-06-14", siteLat: 35.663, siteLng: 139.731, peopleNeeded: 3, priority: 4 },
    { id: "t015", projectId: "proj-005", projectName: "六本木店舗改装", taskName: "仕上げ塗装", requiredSkills: ["painting", "interior_finish"], startDate: "2026-06-15", endDate: "2026-06-20", siteLat: 35.663, siteLng: 139.731, peopleNeeded: 2, priority: 3 },
    { id: "t016", projectId: "proj-006", projectName: "目黒住宅リフォーム", taskName: "解体", requiredSkills: ["demolition"], startDate: "2026-06-02", endDate: "2026-06-06", siteLat: 35.634, siteLng: 139.715, peopleNeeded: 2, priority: 3 },
    { id: "t017", projectId: "proj-006", projectName: "目黒住宅リフォーム", taskName: "給水配管", requiredSkills: ["plumbing"], startDate: "2026-06-07", endDate: "2026-06-11", siteLat: 35.634, siteLng: 139.715, peopleNeeded: 1, priority: 4 },
    { id: "t018", projectId: "proj-006", projectName: "目黒住宅リフォーム", taskName: "電気設備", requiredSkills: ["electrical", "fixture_install"], startDate: "2026-06-12", endDate: "2026-06-18", siteLat: 35.634, siteLng: 139.715, peopleNeeded: 2, priority: 5 },
    { id: "t019", projectId: "proj-007", projectName: "品川テナント", taskName: "空調更新", requiredSkills: ["hvac"], startDate: "2026-06-03", endDate: "2026-06-09", siteLat: 35.628, siteLng: 139.739, peopleNeeded: 2, priority: 5 },
    { id: "t020", projectId: "proj-007", projectName: "品川テナント", taskName: "内装仕上", requiredSkills: ["interior_finish", "drywall"], startDate: "2026-06-10", endDate: "2026-06-17", siteLat: 35.628, siteLng: 139.739, peopleNeeded: 3, priority: 3 },
    { id: "t021", projectId: "proj-008", projectName: "池袋ビル改修", taskName: "足場設置", requiredSkills: ["scaffolding"], startDate: "2026-06-01", endDate: "2026-06-02", siteLat: 35.730, siteLng: 139.711, peopleNeeded: 3, priority: 4 },
    { id: "t022", projectId: "proj-008", projectName: "池袋ビル改修", taskName: "外壁塗装", requiredSkills: ["painting", "scaffolding"], startDate: "2026-06-03", endDate: "2026-06-12", siteLat: 35.730, siteLng: 139.711, peopleNeeded: 3, priority: 4 },
    { id: "t023", projectId: "proj-008", projectName: "池袋ビル改修", taskName: "器具設置", requiredSkills: ["fixture_install"], startDate: "2026-06-13", endDate: "2026-06-17", siteLat: 35.730, siteLng: 139.711, peopleNeeded: 2, priority: 3 },
    { id: "t024", projectId: "proj-009", projectName: "上野店舗新装", taskName: "解体撤去", requiredSkills: ["demolition", "cleanup"], startDate: "2026-06-02", endDate: "2026-06-05", siteLat: 35.714, siteLng: 139.775, peopleNeeded: 2, priority: 3 },
    { id: "t025", projectId: "proj-009", projectName: "上野店舗新装", taskName: "電気工事", requiredSkills: ["electrical"], startDate: "2026-06-06", endDate: "2026-06-11", siteLat: 35.714, siteLng: 139.775, peopleNeeded: 2, priority: 5 },
    { id: "t026", projectId: "proj-009", projectName: "上野店舗新装", taskName: "水道工事", requiredSkills: ["plumbing"], startDate: "2026-06-06", endDate: "2026-06-10", siteLat: 35.714, siteLng: 139.775, peopleNeeded: 1, priority: 4 },
    { id: "t027", projectId: "proj-010", projectName: "神田オフィス", taskName: "ボード工事", requiredSkills: ["drywall"], startDate: "2026-06-08", endDate: "2026-06-15", siteLat: 35.694, siteLng: 139.770, peopleNeeded: 2, priority: 3 },
    { id: "t028", projectId: "proj-010", projectName: "神田オフィス", taskName: "内装完成仕上", requiredSkills: ["interior_finish", "painting", "cleanup"], startDate: "2026-06-16", endDate: "2026-06-22", siteLat: 35.694, siteLng: 139.770, peopleNeeded: 4, priority: 3 },
    { id: "t029", projectId: "proj-011", projectName: "中目黒住宅", taskName: "空調配管", requiredSkills: ["hvac", "plumbing"], startDate: "2026-06-04", endDate: "2026-06-10", siteLat: 35.643, siteLng: 139.698, peopleNeeded: 2, priority: 4 },
    { id: "t030", projectId: "proj-011", projectName: "中目黒住宅", taskName: "電気配線仕上", requiredSkills: ["electrical", "fixture_install"], startDate: "2026-06-11", endDate: "2026-06-18", siteLat: 35.643, siteLng: 139.698, peopleNeeded: 2, priority: 5 },
    { id: "t031", projectId: "proj-012", projectName: "代官山店舗", taskName: "解体工事", requiredSkills: ["demolition"], startDate: "2026-06-01", endDate: "2026-06-04", siteLat: 35.649, siteLng: 139.703, peopleNeeded: 2, priority: 4 },
    { id: "t032", projectId: "proj-012", projectName: "代官山店舗", taskName: "内装工事", requiredSkills: ["interior_finish", "drywall", "painting"], startDate: "2026-06-05", endDate: "2026-06-14", siteLat: 35.649, siteLng: 139.703, peopleNeeded: 3, priority: 3 },
    { id: "t033", projectId: "proj-013", projectName: "三軒茶屋マンション", taskName: "水道工事", requiredSkills: ["plumbing"], startDate: "2026-06-03", endDate: "2026-06-08", siteLat: 35.645, siteLng: 139.668, peopleNeeded: 1, priority: 4 },
    { id: "t034", projectId: "proj-013", projectName: "三軒茶屋マンション", taskName: "電気設備", requiredSkills: ["electrical"], startDate: "2026-06-09", endDate: "2026-06-14", siteLat: 35.645, siteLng: 139.668, peopleNeeded: 2, priority: 5 },
    { id: "t035", projectId: "proj-014", projectName: "南青山内装", taskName: "足場撤去", requiredSkills: ["scaffolding", "cleanup"], startDate: "2026-06-02", endDate: "2026-06-03", siteLat: 35.665, siteLng: 139.724, peopleNeeded: 2, priority: 2 },
    { id: "t036", projectId: "proj-014", projectName: "南青山内装", taskName: "内装仕上げ", requiredSkills: ["interior_finish", "fixture_install"], startDate: "2026-06-10", endDate: "2026-06-18", siteLat: 35.665, siteLng: 139.724, peopleNeeded: 3, priority: 4 },
    { id: "t037", projectId: "proj-015", projectName: "赤坂オフィス", taskName: "電気配線", requiredSkills: ["electrical"], startDate: "2026-06-05", endDate: "2026-06-11", siteLat: 35.675, siteLng: 139.737, peopleNeeded: 2, priority: 5 },
    { id: "t038", projectId: "proj-015", projectName: "赤坂オフィス", taskName: "空調機器", requiredSkills: ["hvac"], startDate: "2026-06-12", endDate: "2026-06-18", siteLat: 35.675, siteLng: 139.737, peopleNeeded: 1, priority: 4 },
    { id: "t039", projectId: "proj-016", projectName: "番町住宅", taskName: "解体", requiredSkills: ["demolition", "scaffolding"], startDate: "2026-06-01", endDate: "2026-06-06", siteLat: 35.690, siteLng: 139.749, peopleNeeded: 3, priority: 3 },
    { id: "t040", projectId: "proj-016", projectName: "番町住宅", taskName: "水回り工事", requiredSkills: ["plumbing", "hvac"], startDate: "2026-06-07", endDate: "2026-06-14", siteLat: 35.690, siteLng: 139.749, peopleNeeded: 2, priority: 5 },
    { id: "t041", projectId: "proj-017", projectName: "麻布十番改修", taskName: "ボード・塗装", requiredSkills: ["drywall", "painting"], startDate: "2026-06-03", endDate: "2026-06-10", siteLat: 35.655, siteLng: 139.735, peopleNeeded: 2, priority: 3 },
    { id: "t042", projectId: "proj-017", projectName: "麻布十番改修", taskName: "電気器具", requiredSkills: ["electrical", "fixture_install"], startDate: "2026-06-11", endDate: "2026-06-17", siteLat: 35.655, siteLng: 139.735, peopleNeeded: 2, priority: 4 },
    { id: "t043", projectId: "proj-018", projectName: "白金店舗", taskName: "清掃・養生", requiredSkills: ["cleanup"], startDate: "2026-06-02", endDate: "2026-06-03", siteLat: 35.640, siteLng: 139.723, peopleNeeded: 2, priority: 2 },
    { id: "t044", projectId: "proj-018", projectName: "白金店舗", taskName: "内装仕上げ全般", requiredSkills: ["interior_finish", "drywall", "fixture_install"], startDate: "2026-06-04", endDate: "2026-06-16", siteLat: 35.640, siteLng: 139.723, peopleNeeded: 4, priority: 4 },
    { id: "t045", projectId: "proj-019", projectName: "五反田ビル", taskName: "電気幹線", requiredSkills: ["electrical"], startDate: "2026-06-06", endDate: "2026-06-12", siteLat: 35.626, siteLng: 139.724, peopleNeeded: 2, priority: 5 },
    { id: "t046", projectId: "proj-019", projectName: "五反田ビル", taskName: "給排水", requiredSkills: ["plumbing"], startDate: "2026-06-06", endDate: "2026-06-11", siteLat: 35.626, siteLng: 139.724, peopleNeeded: 2, priority: 4 },
    { id: "t047", projectId: "proj-020", projectName: "大崎オフィス", taskName: "解体整地", requiredSkills: ["demolition", "cleanup"], startDate: "2026-06-01", endDate: "2026-06-05", siteLat: 35.620, siteLng: 139.728, peopleNeeded: 3, priority: 3 },
    { id: "t048", projectId: "proj-020", projectName: "大崎オフィス", taskName: "内装仕上", requiredSkills: ["interior_finish", "painting"], startDate: "2026-06-06", endDate: "2026-06-16", siteLat: 35.620, siteLng: 139.728, peopleNeeded: 3, priority: 3 },
    { id: "t049", projectId: "proj-020", projectName: "大崎オフィス", taskName: "設備配管", requiredSkills: ["hvac", "plumbing"], startDate: "2026-06-17", endDate: "2026-06-22", siteLat: 35.620, siteLng: 139.728, peopleNeeded: 2, priority: 4 },
    { id: "t050", projectId: "proj-020", projectName: "大崎オフィス", taskName: "最終電気チェック", requiredSkills: ["electrical", "fixture_install"], startDate: "2026-06-23", endDate: "2026-06-25", siteLat: 35.620, siteLng: 139.728, peopleNeeded: 2, priority: 5 },
  ];

  return seeds;
}

// ── Store class ────────────────────────────────────────────────────────────

export class TaskAssignmentStore extends EventTarget {
  private _load(): TaskAssignment[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as TaskAssignment[];
    } catch {
      return [];
    }
  }

  private _save(tasks: TaskAssignment[]): void {
    try {
      const trimmed =
        tasks.length > MAX_TASKS ? tasks.slice(tasks.length - MAX_TASKS) : tasks;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore storage quota errors
    }
  }

  ensureSeed(): void {
    const existing = this._load();
    if (existing.length === 0) {
      this._save(buildSeedTasks());
    }
  }

  all(): TaskAssignment[] {
    return this._load();
  }

  add(task: TaskAssignment): void {
    const existing = this._load();
    this._save([...existing, task]);
    this.dispatchEvent(new CustomEvent("task-added", { detail: task }));
  }

  saveAll(tasks: TaskAssignment[]): void {
    this._save(tasks);
    this.dispatchEvent(new CustomEvent("tasks-updated"));
  }

  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: TaskAssignmentStore | null = null;

export const taskAssignmentStore: TaskAssignmentStore = new Proxy(
  {} as TaskAssignmentStore,
  {
    get(_target, prop, _receiver) {
      if (!_instance) {
        _instance = new TaskAssignmentStore();
      }
      const value = Reflect.get(_instance, prop, _instance);
      return typeof value === "function" ? value.bind(_instance) : value;
    },
  },
);

export function _resetTaskAssignmentStore(): void {
  _instance = null;
}
