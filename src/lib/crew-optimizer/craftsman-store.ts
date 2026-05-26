/**
 * CraftsmanStore — persists Craftsman[] to localStorage.
 *
 * Key: "genbahub:craftsmen"
 * Capacity: 200名
 * Singleton proxy + EventTarget
 */

import type { Craftsman, CraftsmanSkill } from "./types.js";

const STORAGE_KEY = "genbahub:craftsmen";
const MAX_CRAFTSMEN = 200;

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedCraftsmen(): Craftsman[] {
  type SeedEntry = {
    id: string;
    name: string;
    skills: CraftsmanSkill[];
    dailyRate: number;
    lat: number;
    lng: number;
  };

  const seeds: SeedEntry[] = [
    { id: "c001", name: "田中 大輔", skills: ["demolition", "cleanup"], dailyRate: 25000, lat: 35.68, lng: 139.69 },
    { id: "c002", name: "鈴木 健", skills: ["drywall", "interior_finish"], dailyRate: 28000, lat: 35.67, lng: 139.70 },
    { id: "c003", name: "佐藤 明", skills: ["electrical"], dailyRate: 32000, lat: 35.69, lng: 139.68 },
    { id: "c004", name: "高橋 武", skills: ["plumbing"], dailyRate: 31000, lat: 35.66, lng: 139.71 },
    { id: "c005", name: "伊藤 誠", skills: ["hvac"], dailyRate: 33000, lat: 35.70, lng: 139.67 },
    { id: "c006", name: "渡辺 光", skills: ["painting", "interior_finish"], dailyRate: 26000, lat: 35.65, lng: 139.72 },
    { id: "c007", name: "中村 浩", skills: ["fixture_install", "interior_finish"], dailyRate: 27000, lat: 35.71, lng: 139.66 },
    { id: "c008", name: "小林 実", skills: ["scaffolding", "demolition"], dailyRate: 24000, lat: 35.64, lng: 139.73 },
    { id: "c009", name: "加藤 純", skills: ["drywall", "painting"], dailyRate: 27500, lat: 35.72, lng: 139.65 },
    { id: "c010", name: "吉田 豊", skills: ["electrical", "fixture_install"], dailyRate: 34000, lat: 35.63, lng: 139.74 },
    { id: "c011", name: "山田 勝", skills: ["plumbing", "hvac"], dailyRate: 35000, lat: 35.73, lng: 139.64 },
    { id: "c012", name: "佐々木 修", skills: ["interior_finish", "cleanup"], dailyRate: 24500, lat: 35.62, lng: 139.75 },
    { id: "c013", name: "松本 一郎", skills: ["demolition", "scaffolding"], dailyRate: 23000, lat: 35.74, lng: 139.63 },
    { id: "c014", name: "井上 孝", skills: ["painting"], dailyRate: 26500, lat: 35.61, lng: 139.76 },
    { id: "c015", name: "木村 博", skills: ["drywall", "interior_finish", "painting"], dailyRate: 30000, lat: 35.75, lng: 139.62 },
    { id: "c016", name: "林 俊介", skills: ["electrical", "hvac"], dailyRate: 36000, lat: 35.60, lng: 139.77 },
    { id: "c017", name: "清水 徹", skills: ["plumbing", "cleanup"], dailyRate: 28500, lat: 35.76, lng: 139.61 },
    { id: "c018", name: "山口 良", skills: ["fixture_install", "painting"], dailyRate: 27000, lat: 35.59, lng: 139.78 },
    { id: "c019", name: "斉藤 義", skills: ["scaffolding", "cleanup"], dailyRate: 22000, lat: 35.77, lng: 139.60 },
    { id: "c020", name: "松田 隆", skills: ["interior_finish", "fixture_install", "drywall"], dailyRate: 31000, lat: 35.58, lng: 139.79 },
    { id: "c021", name: "岡田 稔", skills: ["demolition", "drywall"], dailyRate: 25500, lat: 35.78, lng: 139.59 },
    { id: "c022", name: "橋本 進", skills: ["electrical"], dailyRate: 33500, lat: 35.57, lng: 139.80 },
    { id: "c023", name: "西村 久", skills: ["plumbing", "fixture_install"], dailyRate: 32000, lat: 35.79, lng: 139.58 },
    { id: "c024", name: "石川 秀", skills: ["hvac", "electrical"], dailyRate: 37000, lat: 35.56, lng: 139.81 },
    { id: "c025", name: "宮崎 昭", skills: ["painting", "cleanup", "interior_finish"], dailyRate: 25000, lat: 35.80, lng: 139.57 },
    { id: "c026", name: "大野 淳", skills: ["scaffolding", "demolition", "cleanup"], dailyRate: 23500, lat: 35.55, lng: 139.82 },
    { id: "c027", name: "藤田 悟", skills: ["drywall", "fixture_install"], dailyRate: 29000, lat: 35.81, lng: 139.56 },
    { id: "c028", name: "後藤 哲", skills: ["interior_finish", "painting", "drywall"], dailyRate: 30500, lat: 35.54, lng: 139.83 },
    { id: "c029", name: "近藤 寿", skills: ["plumbing", "hvac", "cleanup"], dailyRate: 34500, lat: 35.82, lng: 139.55 },
    { id: "c030", name: "村田 充", skills: ["electrical", "fixture_install", "interior_finish"], dailyRate: 35500, lat: 35.53, lng: 139.84 },
  ];

  return seeds.map((s) => ({
    id: s.id,
    name: s.name,
    skills: s.skills,
    dailyRate: s.dailyRate,
    baseLocationLat: s.lat,
    baseLocationLng: s.lng,
    maxConcurrentSites: 2,
  }));
}

// ── Store class ────────────────────────────────────────────────────────────

export class CraftsmanStore extends EventTarget {
  private _load(): Craftsman[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Craftsman[];
    } catch {
      return [];
    }
  }

  private _save(craftsmen: Craftsman[]): void {
    try {
      const trimmed =
        craftsmen.length > MAX_CRAFTSMEN
          ? craftsmen.slice(craftsmen.length - MAX_CRAFTSMEN)
          : craftsmen;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore storage quota errors
    }
  }

  /** 保存件数が 0 なら seed データを書き込む */
  ensureSeed(): void {
    const existing = this._load();
    if (existing.length === 0) {
      this._save(buildSeedCraftsmen());
    }
  }

  all(): Craftsman[] {
    return this._load();
  }

  findById(id: string): Craftsman | undefined {
    return this._load().find((c) => c.id === id);
  }

  add(craftsman: Craftsman): void {
    const existing = this._load();
    this._save([...existing, craftsman]);
    this.dispatchEvent(new CustomEvent("craftsman-added", { detail: craftsman }));
  }

  /** 上限を超えた分は FIFO で削除して一括保存 */
  saveAll(craftsmen: Craftsman[]): void {
    this._save(craftsmen);
    this.dispatchEvent(new CustomEvent("craftsmen-updated"));
  }

  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: CraftsmanStore | null = null;

export const craftsmanStore: CraftsmanStore = new Proxy({} as CraftsmanStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new CraftsmanStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

export function _resetCraftsmanStore(): void {
  _instance = null;
}
