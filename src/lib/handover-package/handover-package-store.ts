/**
 * HandoverPackageStore — persists HandoverPackage[] to localStorage.
 *
 * Key: "laporta.handover_packages"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "handover-package-added" / "handover-package-updated" / "handover-package-deleted" events
 */

import type { HandoverPackage, HandoverPackageId, HandoverPackageStatus } from "./types.js";

const STORAGE_KEY = "laporta.handover_packages";
const MAX_RECORDS = 1000;

// ── Store class ────────────────────────────────────────────────────────────

export class HandoverPackageStore extends EventTarget {
  private _load(): HandoverPackage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as HandoverPackage[];
    } catch {
      return [];
    }
  }

  private _persist(records: HandoverPackage[]): void {
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

  /** Return all packages (newest first). */
  listRecent(limit = 20): HandoverPackage[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return packages by projectId. */
  listByProject(projectId: string): HandoverPackage[] {
    return this._load().filter((pkg) => pkg.projectId === projectId);
  }

  /** Return packages by status. */
  listByStatus(status: HandoverPackageStatus): HandoverPackage[] {
    return this._load().filter((pkg) => pkg.status === status);
  }

  /** Return package by ID. */
  get(id: HandoverPackageId): HandoverPackage | null {
    return this._load().find((pkg) => pkg.id === id) ?? null;
  }

  /** Save a package (upsert). */
  save(pkg: HandoverPackage): void {
    const existing = this._load();
    const idx = existing.findIndex((p) => p.id === pkg.id);
    if (idx >= 0) {
      existing[idx] = pkg;
      this._persist(existing);
      this.dispatchEvent(new CustomEvent("handover-package-updated", { detail: pkg }));
    } else {
      this._persist([...existing, pkg]);
      this.dispatchEvent(new CustomEvent("handover-package-added", { detail: pkg }));
    }
  }

  /** Delete a package by ID. */
  delete(id: HandoverPackageId): void {
    const existing = this._load();
    const filtered = existing.filter((pkg) => pkg.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("handover-package-deleted", { detail: { id } }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (packages: HandoverPackage[]) => void): () => void {
    const handler = () => listener(this.listRecent(MAX_RECORDS));
    this.addEventListener("handover-package-added", handler);
    this.addEventListener("handover-package-updated", handler);
    this.addEventListener("handover-package-deleted", handler);
    return () => {
      this.removeEventListener("handover-package-added", handler);
      this.removeEventListener("handover-package-updated", handler);
      this.removeEventListener("handover-package-deleted", handler);
    };
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("handover-package-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: HandoverPackageStore | null = null;

export const handoverPackageStore: HandoverPackageStore = new Proxy({} as HandoverPackageStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new HandoverPackageStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetHandoverPackageStore(): void {
  _instance = null;
}
