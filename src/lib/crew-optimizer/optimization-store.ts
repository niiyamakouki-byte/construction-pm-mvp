/**
 * CrewOptimizationStore — persists CrewOptimizationResult[] to localStorage.
 *
 * Key: "genbahub:crew-optimization-snapshots"
 * Capacity: 50件 FIFO
 * Singleton proxy + EventTarget
 */

import type { CrewOptimizationResult } from "./types.js";

const STORAGE_KEY = "genbahub:crew-optimization-snapshots";
const MAX_SNAPSHOTS = 50;

// ── Store class ────────────────────────────────────────────────────────────

export class CrewOptimizationStore extends EventTarget {
  private _load(): CrewOptimizationResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as CrewOptimizationResult[];
    } catch {
      return [];
    }
  }

  private _save(snapshots: CrewOptimizationResult[]): void {
    try {
      const trimmed =
        snapshots.length > MAX_SNAPSHOTS
          ? snapshots.slice(snapshots.length - MAX_SNAPSHOTS)
          : snapshots;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore storage quota errors
    }
  }

  add(result: CrewOptimizationResult): void {
    const existing = this._load();
    this._save([...existing, result]);
    this.dispatchEvent(new CustomEvent("optimization-added", { detail: result }));
  }

  all(): CrewOptimizationResult[] {
    return this._load();
  }

  latest(): CrewOptimizationResult | null {
    const all = this._load();
    return all.length > 0 ? all[all.length - 1] : null;
  }

  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: CrewOptimizationStore | null = null;

export const crewOptimizationStore: CrewOptimizationStore = new Proxy(
  {} as CrewOptimizationStore,
  {
    get(_target, prop, _receiver) {
      if (!_instance) {
        _instance = new CrewOptimizationStore();
      }
      const value = Reflect.get(_instance, prop, _instance);
      return typeof value === "function" ? value.bind(_instance) : value;
    },
  },
);

export function _resetCrewOptimizationStore(): void {
  _instance = null;
}
