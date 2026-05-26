/**
 * OwnerSuggestionStore — persists OwnerSuggestion[] to localStorage.
 *
 * Key: "genbahub.owner_suggestions"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "owner-suggestion-added" / "owner-suggestion-updated" / "owner-suggestion-deleted" events
 */

import type { OwnerSuggestion, OwnerSuggestionId } from "./types.js";

const STORAGE_KEY = "genbahub.owner_suggestions";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class OwnerSuggestionStore extends EventTarget {
  private _load(): OwnerSuggestion[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as OwnerSuggestion[];
    } catch {
      return [];
    }
  }

  private _persist(records: OwnerSuggestion[]): void {
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

  /** Return all suggestions (newest first). */
  getAll(limit = MAX_RECORDS): OwnerSuggestion[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return suggestion by ID. */
  get(id: OwnerSuggestionId): OwnerSuggestion | null {
    return this._load().find((s) => s.id === id) ?? null;
  }

  /** Add a new suggestion. */
  add(suggestion: OwnerSuggestion): void {
    const existing = this._load();
    this._persist([...existing, suggestion]);
    this.dispatchEvent(new CustomEvent("owner-suggestion-added", { detail: suggestion }));
  }

  /** Update partial fields of a suggestion by ID. */
  update(id: OwnerSuggestionId, partial: Partial<Omit<OwnerSuggestion, "id">>): OwnerSuggestion | null {
    const existing = this._load();
    const idx = existing.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const updated = { ...existing[idx], ...partial } as OwnerSuggestion;
    existing[idx] = updated;
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("owner-suggestion-updated", { detail: updated }));
    return updated;
  }

  /** Remove a suggestion by ID. */
  remove(id: OwnerSuggestionId): void {
    const existing = this._load();
    const filtered = existing.filter((s) => s.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("owner-suggestion-deleted", { detail: { id } }));
  }

  /** Subscribe to any change. */
  subscribe(listener: (suggestions: OwnerSuggestion[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("owner-suggestion-added", handler);
    this.addEventListener("owner-suggestion-updated", handler);
    this.addEventListener("owner-suggestion-deleted", handler);
    return () => {
      this.removeEventListener("owner-suggestion-added", handler);
      this.removeEventListener("owner-suggestion-updated", handler);
      this.removeEventListener("owner-suggestion-deleted", handler);
    };
  }

  /** Remove all records. */
  clear(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("owner-suggestion-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: OwnerSuggestionStore | null = null;

export const ownerSuggestionStore: OwnerSuggestionStore = new Proxy({} as OwnerSuggestionStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new OwnerSuggestionStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetOwnerSuggestionStore(): void {
  _instance = null;
}
