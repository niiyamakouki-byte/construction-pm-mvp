/**
 * LivestreamStore — persists LivestreamSession[] to localStorage.
 *
 * Key: "genbahub.livestream_sessions"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "livestream-added" / "livestream-updated" / "livestream-deleted" events
 */

import type { LivestreamSession, LivestreamSessionId } from "./types.js";

const STORAGE_KEY = "genbahub.livestream_sessions";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class LivestreamStore extends EventTarget {
  private _load(): LivestreamSession[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LivestreamSession[];
    } catch {
      return [];
    }
  }

  private _persist(records: LivestreamSession[]): void {
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

  /** Return all sessions (newest first). */
  getAll(limit = MAX_RECORDS): LivestreamSession[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return session by ID. */
  get(id: LivestreamSessionId): LivestreamSession | null {
    return this._load().find((s) => s.id === id) ?? null;
  }

  /** Add a new session. */
  add(session: LivestreamSession): void {
    const existing = this._load();
    this._persist([...existing, session]);
    this.dispatchEvent(new CustomEvent("livestream-added", { detail: session }));
  }

  /** Update partial fields of a session by ID. */
  update(
    id: LivestreamSessionId,
    partial: Partial<Omit<LivestreamSession, "id">>,
  ): LivestreamSession | null {
    const existing = this._load();
    const idx = existing.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const updated = { ...existing[idx], ...partial } as LivestreamSession;
    existing[idx] = updated;
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("livestream-updated", { detail: updated }));
    return updated;
  }

  /** Remove a session by ID. */
  remove(id: LivestreamSessionId): void {
    const existing = this._load();
    const filtered = existing.filter((s) => s.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("livestream-deleted", { detail: { id } }));
  }

  /** Subscribe to any change. */
  subscribe(listener: (sessions: LivestreamSession[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("livestream-added", handler);
    this.addEventListener("livestream-updated", handler);
    this.addEventListener("livestream-deleted", handler);
    return () => {
      this.removeEventListener("livestream-added", handler);
      this.removeEventListener("livestream-updated", handler);
      this.removeEventListener("livestream-deleted", handler);
    };
  }

  /** Remove all records. */
  clear(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("livestream-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: LivestreamStore | null = null;

export const livestreamStore: LivestreamStore = new Proxy({} as LivestreamStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new LivestreamStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetLivestreamStore(): void {
  _instance = null;
}
