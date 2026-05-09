/**
 * 工程遅延予測AI — 過去タスク実績ストア
 *
 * localStorage キー: genbahub:historical-tasks
 * 起動時に過去データが空の場合は seed 50件を投入する。
 * EventTarget でイベント通知。
 */

import type { HistoricalTaskRecord } from "./types.js";
import { WeatherCondition } from "./types.js";

const STORAGE_KEY = "genbahub:historical-tasks";

// ── Seed データ ───────────────────────────────────────────────────────────────

const SEED_RECORDS: HistoricalTaskRecord[] = [
  // 内装 (7件)
  { id: "h-001", taskKind: "内装", plannedDays: 10, actualDays: 11, weather: [WeatherCondition.sunny, WeatherCondition.cloudy], laborAvailabilityRatio: 0.9, season: "spring" },
  { id: "h-002", taskKind: "内装", plannedDays: 8,  actualDays: 10, weather: [WeatherCondition.rain, WeatherCondition.rain], laborAvailabilityRatio: 0.75, season: "summer" },
  { id: "h-003", taskKind: "内装", plannedDays: 12, actualDays: 14, weather: [WeatherCondition.heavy_rain], laborAvailabilityRatio: 0.65, season: "autumn" },
  { id: "h-004", taskKind: "内装", plannedDays: 6,  actualDays: 6,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-005", taskKind: "内装", plannedDays: 9,  actualDays: 9,  weather: [WeatherCondition.cloudy, WeatherCondition.sunny], laborAvailabilityRatio: 0.95, season: "winter" },
  { id: "h-006", taskKind: "内装", plannedDays: 7,  actualDays: 8,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.88, season: "summer" },
  { id: "h-007", taskKind: "内装", plannedDays: 14, actualDays: 15, weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "autumn" },

  // 解体 (6件)
  { id: "h-008", taskKind: "解体", plannedDays: 3,  actualDays: 4,  weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.85, season: "spring" },
  { id: "h-009", taskKind: "解体", plannedDays: 5,  actualDays: 5,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "summer" },
  { id: "h-010", taskKind: "解体", plannedDays: 4,  actualDays: 6,  weather: [WeatherCondition.heavy_rain, WeatherCondition.rain], laborAvailabilityRatio: 0.6, season: "autumn" },
  { id: "h-011", taskKind: "解体", plannedDays: 3,  actualDays: 3,  weather: [WeatherCondition.sunny, WeatherCondition.cloudy], laborAvailabilityRatio: 1.0, season: "winter" },
  { id: "h-012", taskKind: "解体", plannedDays: 6,  actualDays: 8,  weather: [WeatherCondition.snow, WeatherCondition.snow], laborAvailabilityRatio: 0.7, season: "winter" },
  { id: "h-013", taskKind: "解体", plannedDays: 4,  actualDays: 5,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.9, season: "spring" },

  // 電気 (7件)
  { id: "h-014", taskKind: "電気", plannedDays: 5,  actualDays: 5,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-015", taskKind: "電気", plannedDays: 4,  actualDays: 4,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.95, season: "summer" },
  { id: "h-016", taskKind: "電気", plannedDays: 6,  actualDays: 7,  weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "autumn" },
  { id: "h-017", taskKind: "電気", plannedDays: 3,  actualDays: 3,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-018", taskKind: "電気", plannedDays: 5,  actualDays: 6,  weather: [WeatherCondition.cloudy, WeatherCondition.rain], laborAvailabilityRatio: 0.85, season: "winter" },
  { id: "h-019", taskKind: "電気", plannedDays: 7,  actualDays: 7,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "summer" },
  { id: "h-020", taskKind: "電気", plannedDays: 4,  actualDays: 5,  weather: [WeatherCondition.rain, WeatherCondition.rain], laborAvailabilityRatio: 0.75, season: "autumn" },

  // 設備 (6件)
  { id: "h-021", taskKind: "設備", plannedDays: 8,  actualDays: 10, weather: [WeatherCondition.rain, WeatherCondition.heavy_rain], laborAvailabilityRatio: 0.7, season: "summer" },
  { id: "h-022", taskKind: "設備", plannedDays: 6,  actualDays: 6,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-023", taskKind: "設備", plannedDays: 10, actualDays: 12, weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "autumn" },
  { id: "h-024", taskKind: "設備", plannedDays: 5,  actualDays: 5,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.9, season: "winter" },
  { id: "h-025", taskKind: "設備", plannedDays: 7,  actualDays: 9,  weather: [WeatherCondition.snow], laborAvailabilityRatio: 0.65, season: "winter" },
  { id: "h-026", taskKind: "設備", plannedDays: 4,  actualDays: 4,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },

  // 塗装 (7件)
  { id: "h-027", taskKind: "塗装", plannedDays: 4,  actualDays: 6,  weather: [WeatherCondition.rain, WeatherCondition.rain, WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "summer" },
  { id: "h-028", taskKind: "塗装", plannedDays: 3,  actualDays: 3,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-029", taskKind: "塗装", plannedDays: 5,  actualDays: 8,  weather: [WeatherCondition.heavy_rain, WeatherCondition.heavy_rain], laborAvailabilityRatio: 0.6, season: "autumn" },
  { id: "h-030", taskKind: "塗装", plannedDays: 4,  actualDays: 5,  weather: [WeatherCondition.cloudy, WeatherCondition.rain], laborAvailabilityRatio: 0.85, season: "winter" },
  { id: "h-031", taskKind: "塗装", plannedDays: 6,  actualDays: 7,  weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.88, season: "spring" },
  { id: "h-032", taskKind: "塗装", plannedDays: 3,  actualDays: 4,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.9, season: "summer" },
  { id: "h-033", taskKind: "塗装", plannedDays: 7,  actualDays: 7,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "autumn" },

  // 床 (6件)
  { id: "h-034", taskKind: "床", plannedDays: 3,  actualDays: 3,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-035", taskKind: "床", plannedDays: 5,  actualDays: 6,  weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "summer" },
  { id: "h-036", taskKind: "床", plannedDays: 4,  actualDays: 4,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.95, season: "autumn" },
  { id: "h-037", taskKind: "床", plannedDays: 6,  actualDays: 8,  weather: [WeatherCondition.snow, WeatherCondition.snow], laborAvailabilityRatio: 0.65, season: "winter" },
  { id: "h-038", taskKind: "床", plannedDays: 3,  actualDays: 3,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-039", taskKind: "床", plannedDays: 5,  actualDays: 5,  weather: [WeatherCondition.cloudy, WeatherCondition.sunny], laborAvailabilityRatio: 0.92, season: "summer" },

  // 壁 (6件)
  { id: "h-040", taskKind: "壁", plannedDays: 5,  actualDays: 6,  weather: [WeatherCondition.cloudy, WeatherCondition.rain], laborAvailabilityRatio: 0.82, season: "spring" },
  { id: "h-041", taskKind: "壁", plannedDays: 7,  actualDays: 7,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "summer" },
  { id: "h-042", taskKind: "壁", plannedDays: 4,  actualDays: 5,  weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "autumn" },
  { id: "h-043", taskKind: "壁", plannedDays: 6,  actualDays: 7,  weather: [WeatherCondition.snow], laborAvailabilityRatio: 0.75, season: "winter" },
  { id: "h-044", taskKind: "壁", plannedDays: 3,  actualDays: 3,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "spring" },
  { id: "h-045", taskKind: "壁", plannedDays: 8,  actualDays: 9,  weather: [WeatherCondition.cloudy], laborAvailabilityRatio: 0.88, season: "autumn" },

  // 天井 (5件)
  { id: "h-046", taskKind: "天井", plannedDays: 4,  actualDays: 5,  weather: [WeatherCondition.rain], laborAvailabilityRatio: 0.8, season: "spring" },
  { id: "h-047", taskKind: "天井", plannedDays: 6,  actualDays: 6,  weather: [WeatherCondition.sunny], laborAvailabilityRatio: 1.0, season: "summer" },
  { id: "h-048", taskKind: "天井", plannedDays: 5,  actualDays: 7,  weather: [WeatherCondition.heavy_rain, WeatherCondition.rain], laborAvailabilityRatio: 0.7, season: "autumn" },
  { id: "h-049", taskKind: "天井", plannedDays: 3,  actualDays: 4,  weather: [WeatherCondition.snow], laborAvailabilityRatio: 0.72, season: "winter" },
  { id: "h-050", taskKind: "天井", plannedDays: 4,  actualDays: 4,  weather: [WeatherCondition.cloudy, WeatherCondition.sunny], laborAvailabilityRatio: 0.95, season: "spring" },
];

// ── シングルトン ──────────────────────────────────────────────────────────────

let _instance: HistoricalStore | null = null;

export function getHistoricalStore(): HistoricalStore {
  if (!_instance) {
    _instance = new HistoricalStore();
  }
  return _instance;
}

/** テスト用: シングルトンをリセット */
export function _resetHistoricalStore(): void {
  _instance = null;
}

// ── ストアクラス ──────────────────────────────────────────────────────────────

export class HistoricalStore extends EventTarget {
  constructor() {
    super();
    this._ensureSeeded();
  }

  private _load(): HistoricalTaskRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as HistoricalTaskRecord[];
    } catch {
      return [];
    }
  }

  private _save(records: HistoricalTaskRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Storage quota エラーは無視
    }
  }

  private _ensureSeeded(): void {
    const existing = this._load();
    if (existing.length === 0) {
      this._save(SEED_RECORDS);
    }
  }

  add(record: HistoricalTaskRecord): void {
    const records = this._load();
    records.push(record);
    this._save(records);
    this.dispatchEvent(new CustomEvent("change", { detail: { type: "add", record } }));
  }

  all(): HistoricalTaskRecord[] {
    return this._load();
  }

  filterByKind(kind: string): HistoricalTaskRecord[] {
    return this._load().filter((r) => r.taskKind === kind);
  }

  filterBySeason(season: HistoricalTaskRecord["season"]): HistoricalTaskRecord[] {
    return this._load().filter((r) => r.season === season);
  }

  /** テスト用: 全件削除して再シード */
  _clearAndReseed(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._ensureSeeded();
  }
}
