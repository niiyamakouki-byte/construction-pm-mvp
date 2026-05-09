/**
 * MeetingStore — persists MeetingSession[] to localStorage.
 *
 * Key: "laporta.meeting_sessions"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "meeting-added" / "meeting-updated" / "meeting-deleted" events
 */

import type { MeetingSession, MeetingId } from "./types.js";

const STORAGE_KEY = "laporta.meeting_sessions";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class MeetingStore extends EventTarget {
  private _load(): MeetingSession[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as MeetingSession[];
    } catch {
      return [];
    }
  }

  private _persist(records: MeetingSession[]): void {
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
  listRecent(limit = 20): MeetingSession[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return sessions for a specific project. */
  listByProject(projectId: string): MeetingSession[] {
    return this._load().filter((s) => s.projectId === projectId);
  }

  /** Return session by ID. */
  get(id: MeetingId): MeetingSession | null {
    return this._load().find((s) => s.id === id) ?? null;
  }

  /** Return the most recent session for a project (for previous-minutes lookups). */
  latestForProject(projectId: string): MeetingSession | null {
    const all = this._load().filter((s) => s.projectId === projectId);
    if (all.length === 0) return null;
    return all.reduce((prev, curr) =>
      new Date(curr.scheduledAt) > new Date(prev.scheduledAt) ? curr : prev,
    );
  }

  /** Save a session (upsert). */
  save(session: MeetingSession): void {
    const existing = this._load();
    const idx = existing.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      existing[idx] = session;
      this._persist(existing);
      this.dispatchEvent(new CustomEvent("meeting-updated", { detail: session }));
    } else {
      this._persist([...existing, session]);
      this.dispatchEvent(new CustomEvent("meeting-added", { detail: session }));
    }
  }

  /** Delete a session by ID. */
  delete(id: MeetingId): void {
    const existing = this._load();
    const filtered = existing.filter((s) => s.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("meeting-deleted", { detail: { id } }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (sessions: MeetingSession[]) => void): () => void {
    const handler = () => listener(this.listRecent(MAX_RECORDS));
    this.addEventListener("meeting-added", handler);
    this.addEventListener("meeting-updated", handler);
    this.addEventListener("meeting-deleted", handler);
    return () => {
      this.removeEventListener("meeting-added", handler);
      this.removeEventListener("meeting-updated", handler);
      this.removeEventListener("meeting-deleted", handler);
    };
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("meeting-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: MeetingStore | null = null;

export const meetingStore: MeetingStore = new Proxy({} as MeetingStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new MeetingStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetMeetingStore(): void {
  _instance = null;
}
