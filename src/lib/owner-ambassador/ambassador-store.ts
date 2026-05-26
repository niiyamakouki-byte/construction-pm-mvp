/**
 * AmbassadorStore — persists OwnerAmbassador[] to localStorage.
 *
 * Key: "genbahub.owner_ambassadors"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "ambassador-added" / "ambassador-updated" / "ambassador-deleted" events
 */

import type { OwnerAmbassador, OwnerAmbassadorId } from "./types.js";

const STORAGE_KEY = "genbahub.owner_ambassadors";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class AmbassadorStore extends EventTarget {
  private _load(): OwnerAmbassador[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as OwnerAmbassador[];
    } catch {
      return [];
    }
  }

  private _persist(records: OwnerAmbassador[]): void {
    try {
      // FIFO: keep latest 1000
      const trimmed =
        records.length > MAX_RECORDS
          ? records.slice(records.length - MAX_RECORDS)
          : records;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore quota errors
    }
  }

  /** Return all ambassadors (newest first). */
  getAll(limit = MAX_RECORDS): OwnerAmbassador[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return ambassador by ID. */
  get(id: OwnerAmbassadorId): OwnerAmbassador | null {
    return this._load().find((a) => a.id === id) ?? null;
  }

  /** Add a new ambassador. */
  add(ambassador: OwnerAmbassador): void {
    const existing = this._load();
    this._persist([...existing, ambassador]);
    this.dispatchEvent(new CustomEvent("ambassador-added", { detail: ambassador }));
  }

  /** Update partial fields of an ambassador by ID. */
  update(
    id: OwnerAmbassadorId,
    partial: Partial<Omit<OwnerAmbassador, "id">>,
  ): OwnerAmbassador | null {
    const existing = this._load();
    const idx = existing.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    const updated = { ...existing[idx], ...partial } as OwnerAmbassador;
    existing[idx] = updated;
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("ambassador-updated", { detail: updated }));
    return updated;
  }

  /** Remove an ambassador by ID. */
  remove(id: OwnerAmbassadorId): void {
    const existing = this._load();
    const filtered = existing.filter((a) => a.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("ambassador-deleted", { detail: { id } }));
  }

  /** Subscribe to any change. */
  subscribe(listener: (ambassadors: OwnerAmbassador[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("ambassador-added", handler);
    this.addEventListener("ambassador-updated", handler);
    this.addEventListener("ambassador-deleted", handler);
    return () => {
      this.removeEventListener("ambassador-added", handler);
      this.removeEventListener("ambassador-updated", handler);
      this.removeEventListener("ambassador-deleted", handler);
    };
  }

  /** Remove all records. */
  clear(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("ambassador-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: AmbassadorStore | null = null;

export const ambassadorStore: AmbassadorStore = new Proxy({} as AmbassadorStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new AmbassadorStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetAmbassadorStore(): void {
  _instance = null;
}
