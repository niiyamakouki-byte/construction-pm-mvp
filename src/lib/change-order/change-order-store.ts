/**
 * ChangeOrderStore — persists ChangeOrder[] to localStorage.
 *
 * Key: "laporta.change_orders"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "change-order-added" / "change-order-updated" / "change-order-deleted" events
 */

import type { ChangeOrder, ChangeOrderId, ChangeOrderStatus } from "./types.js";

const STORAGE_KEY = "laporta.change_orders";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class ChangeOrderStore extends EventTarget {
  private _load(): ChangeOrder[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as ChangeOrder[];
    } catch {
      return [];
    }
  }

  private _persist(records: ChangeOrder[]): void {
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

  /** Return all change orders (newest first). */
  listRecent(limit = 20): ChangeOrder[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return change orders by projectId. */
  listByProject(projectId: string): ChangeOrder[] {
    return this._load().filter((co) => co.projectId === projectId);
  }

  /** Return change orders by status. */
  listByStatus(status: ChangeOrderStatus): ChangeOrder[] {
    return this._load().filter((co) => co.status === status);
  }

  /** Return change order by ID. */
  get(id: ChangeOrderId): ChangeOrder | null {
    return this._load().find((co) => co.id === id) ?? null;
  }

  /** Save a change order (upsert). */
  save(co: ChangeOrder): void {
    const existing = this._load();
    const idx = existing.findIndex((c) => c.id === co.id);
    if (idx >= 0) {
      existing[idx] = co;
      this._persist(existing);
      this.dispatchEvent(new CustomEvent("change-order-updated", { detail: co }));
    } else {
      this._persist([...existing, co]);
      this.dispatchEvent(new CustomEvent("change-order-added", { detail: co }));
    }
  }

  /** Delete a change order by ID. */
  delete(id: ChangeOrderId): void {
    const existing = this._load();
    const filtered = existing.filter((co) => co.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("change-order-deleted", { detail: { id } }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (orders: ChangeOrder[]) => void): () => void {
    const handler = () => listener(this.listRecent(MAX_RECORDS));
    this.addEventListener("change-order-added", handler);
    this.addEventListener("change-order-updated", handler);
    this.addEventListener("change-order-deleted", handler);
    return () => {
      this.removeEventListener("change-order-added", handler);
      this.removeEventListener("change-order-updated", handler);
      this.removeEventListener("change-order-deleted", handler);
    };
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("change-order-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: ChangeOrderStore | null = null;

export const changeOrderStore: ChangeOrderStore = new Proxy({} as ChangeOrderStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new ChangeOrderStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetChangeOrderStore(): void {
  _instance = null;
}
