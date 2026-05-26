/**
 * LossStore — persists LossSignal[] to localStorage.
 *
 * Key: "genbahub:loss-signals"
 * Capacity: 5000 signals (FIFO eviction)
 * Extends EventTarget so consumers can addEventListener('change', handler).
 */

import type { LossSignal } from "./types.js";

const STORAGE_KEY = "genbahub:loss-signals";
const MAX_SIGNALS = 5000;

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: LossStore | null = null;

export function getLossStore(): LossStore {
  if (!_instance) {
    _instance = new LossStore();
  }
  return _instance;
}

/** Reset singleton — for testing only */
export function _resetLossStore(): void {
  _instance = null;
}

// ── Store class ────────────────────────────────────────────────────────────

export class LossStore extends EventTarget {
  // ── Persistence helpers ──────────────────────────────────────────────────

  private _load(): LossSignal[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LossSignal[];
    } catch {
      return [];
    }
  }

  private _save(signals: LossSignal[]): void {
    try {
      // FIFO: keep latest MAX_SIGNALS entries
      const trimmed =
        signals.length > MAX_SIGNALS
          ? signals.slice(signals.length - MAX_SIGNALS)
          : signals;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore storage quota errors
    }
  }

  private _emit(): void {
    this.dispatchEvent(new CustomEvent("change"));
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Persist new signals (appended, de-duplicated by id).
   * Emits 'change' event.
   */
  recordSignals(signals: LossSignal[]): void {
    if (signals.length === 0) return;

    const existing = this._load();
    const existingIds = new Set(existing.map((s) => s.id));
    const newOnes = signals.filter((s) => !existingIds.has(s.id));
    if (newOnes.length === 0) return;

    this._save([...existing, ...newOnes]);
    this._emit();
  }

  /**
   * Return all signals for a given projectId.
   */
  signalsForProject(projectId: string): LossSignal[] {
    return this._load().filter((s) => s.projectId === projectId);
  }

  /**
   * Remove all signals for a given projectId. Emits 'change'.
   */
  clearByProject(projectId: string): void {
    const existing = this._load();
    const filtered = existing.filter((s) => s.projectId !== projectId);
    if (filtered.length === existing.length) return;
    this._save(filtered);
    this._emit();
  }

  /**
   * Mark a signal as resolved by removing it. Emits 'change'.
   */
  markResolved(signalId: string): void {
    const existing = this._load();
    const filtered = existing.filter((s) => s.id !== signalId);
    if (filtered.length === existing.length) return;
    this._save(filtered);
    this._emit();
  }

  /**
   * Return all stored signals.
   */
  allSignals(): LossSignal[] {
    return this._load();
  }
}
