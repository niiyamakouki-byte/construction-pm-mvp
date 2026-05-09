/**
 * FollowupStore — persists FollowupSchedule[] to localStorage.
 *
 * Key: "genbahub.longterm_followups"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "followup-added" / "followup-updated" / "followup-deleted" events
 */

import type { FollowupSchedule, FollowupScheduleId } from "./types.js";

const STORAGE_KEY = "genbahub.longterm_followups";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class FollowupStore extends EventTarget {
  private _load(): FollowupSchedule[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as FollowupSchedule[];
    } catch {
      return [];
    }
  }

  private _persist(records: FollowupSchedule[]): void {
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

  /** Return all schedules (newest first). */
  getAll(limit = MAX_RECORDS): FollowupSchedule[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return schedule by ID. */
  get(id: FollowupScheduleId): FollowupSchedule | null {
    return this._load().find((s) => s.id === id) ?? null;
  }

  /** Add a new schedule. */
  add(schedule: FollowupSchedule): void {
    const existing = this._load();
    this._persist([...existing, schedule]);
    this.dispatchEvent(new CustomEvent("followup-added", { detail: schedule }));
  }

  /** Update partial fields of a schedule by ID. */
  update(
    id: FollowupScheduleId,
    partial: Partial<Omit<FollowupSchedule, "id">>,
  ): FollowupSchedule | null {
    const existing = this._load();
    const idx = existing.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const updated = { ...existing[idx], ...partial } as FollowupSchedule;
    existing[idx] = updated;
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("followup-updated", { detail: updated }));
    return updated;
  }

  /** Remove a schedule by ID. */
  remove(id: FollowupScheduleId): void {
    const existing = this._load();
    const filtered = existing.filter((s) => s.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("followup-deleted", { detail: { id } }));
  }

  /** Subscribe to any change. */
  subscribe(listener: (schedules: FollowupSchedule[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("followup-added", handler);
    this.addEventListener("followup-updated", handler);
    this.addEventListener("followup-deleted", handler);
    return () => {
      this.removeEventListener("followup-added", handler);
      this.removeEventListener("followup-updated", handler);
      this.removeEventListener("followup-deleted", handler);
    };
  }

  /** Remove all records. */
  clear(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("followup-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: FollowupStore | null = null;

export const followupStore: FollowupStore = new Proxy({} as FollowupStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new FollowupStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetFollowupStore(): void {
  _instance = null;
}
