/**
 * ProposalStore — persists ProposalDocument[] to localStorage.
 *
 * Key: "laporta.proposal_documents"
 * Capacity: 500件 FIFO
 * EventTarget singleton — "proposal-added" / "proposal-updated" / "proposal-deleted" events
 */

import type { ProposalDocument } from "./types.js";

const STORAGE_KEY = "laporta.proposal_documents";
const MAX_RECORDS = 500;

// ── Store class ────────────────────────────────────────────────────────────

export class ProposalStore extends EventTarget {
  private _load(): ProposalDocument[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as ProposalDocument[];
    } catch {
      return [];
    }
  }

  private _persist(records: ProposalDocument[]): void {
    try {
      // FIFO: keep latest 500
      const trimmed =
        records.length > MAX_RECORDS
          ? records.slice(records.length - MAX_RECORDS)
          : records;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore quota errors
    }
  }

  /** Return all documents (newest first). */
  listRecent(limit = 20): ProposalDocument[] {
    const all = this._load();
    return [...all].reverse().slice(0, limit);
  }

  /** Return documents by customerName. */
  listByCustomer(customerName: string): ProposalDocument[] {
    return this._load().filter((d) => d.customerName === customerName);
  }

  /** Return document by ID. */
  get(id: string): ProposalDocument | null {
    return this._load().find((d) => d.id === id) ?? null;
  }

  /** Save a document (upsert). */
  save(doc: ProposalDocument): void {
    const existing = this._load();
    const idx = existing.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      existing[idx] = doc;
      this._persist(existing);
      this.dispatchEvent(new CustomEvent("proposal-updated", { detail: doc }));
    } else {
      this._persist([...existing, doc]);
      this.dispatchEvent(new CustomEvent("proposal-added", { detail: doc }));
    }
  }

  /** Delete a document by ID. */
  delete(id: string): void {
    const existing = this._load();
    const filtered = existing.filter((d) => d.id !== id);
    this._persist(filtered);
    this.dispatchEvent(new CustomEvent("proposal-deleted", { detail: { id } }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (docs: ProposalDocument[]) => void): () => void {
    const handler = () => listener(this.listRecent(MAX_RECORDS));
    this.addEventListener("proposal-added", handler);
    this.addEventListener("proposal-updated", handler);
    this.addEventListener("proposal-deleted", handler);
    return () => {
      this.removeEventListener("proposal-added", handler);
      this.removeEventListener("proposal-updated", handler);
      this.removeEventListener("proposal-deleted", handler);
    };
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("proposal-deleted", { detail: { id: "*" } }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: ProposalStore | null = null;

export const proposalStore: ProposalStore = new Proxy({} as ProposalStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new ProposalStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetProposalStore(): void {
  _instance = null;
}
