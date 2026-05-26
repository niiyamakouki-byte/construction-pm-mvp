/**
 * ProfitRankingStore — persists ProfitRankingSnapshot[] to localStorage.
 *
 * Key: "genbahub:profit-ranking-snapshots"
 * Capacity: 50 snapshots (FIFO eviction)
 * Extends EventTarget so consumers can addEventListener('snapshot-added', handler).
 */

import type { ProfitRankingSnapshot } from "./types.js";

const STORAGE_KEY = "genbahub:profit-ranking-snapshots";
const MAX_SNAPSHOTS = 50;

// ── Store class ────────────────────────────────────────────────────────────

export class ProfitRankingStore extends EventTarget {
  // ── Persistence helpers ──────────────────────────────────────────────────

  private _load(): ProfitRankingSnapshot[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as ProfitRankingSnapshot[];
    } catch {
      return [];
    }
  }

  private _save(snapshots: ProfitRankingSnapshot[]): void {
    try {
      // FIFO: keep latest MAX_SNAPSHOTS entries
      const trimmed =
        snapshots.length > MAX_SNAPSHOTS
          ? snapshots.slice(snapshots.length - MAX_SNAPSHOTS)
          : snapshots;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore storage quota errors
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Add a new snapshot, persist, and emit 'snapshot-added'.
   */
  add(snapshot: ProfitRankingSnapshot): void {
    const existing = this._load();
    this._save([...existing, snapshot]);
    this.dispatchEvent(new CustomEvent("snapshot-added", { detail: snapshot }));
  }

  /** Return all stored snapshots. */
  all(): ProfitRankingSnapshot[] {
    return this._load();
  }

  /** Return the most recent snapshot, or null if empty. */
  latest(): ProfitRankingSnapshot | null {
    const all = this._load();
    return all.length > 0 ? all[all.length - 1] : null;
  }

  /** Remove all stored snapshots. */
  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: ProfitRankingStore | null = null;

export const profitRankingStore: ProfitRankingStore = new Proxy(
  {} as ProfitRankingStore,
  {
    get(_target, prop, _receiver) {
      if (!_instance) {
        _instance = new ProfitRankingStore();
      }
      const value = Reflect.get(_instance, prop, _instance);
      return typeof value === "function" ? value.bind(_instance) : value;
    },
  },
);

/** Reset singleton — for testing only */
export function _resetProfitRankingStore(): void {
  _instance = null;
}
