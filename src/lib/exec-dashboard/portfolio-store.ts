/**
 * PortfolioStore — subscribes to project/task/invoice/chat/photo data
 * and re-computes the PortfolioSummary on each change.
 *
 * Uses EventTarget so consumers can addEventListener('change', handler).
 */

import { aggregatePortfolio, type ProjectPortfolioEntry, type PortfolioSummary } from "./portfolio-aggregator.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type PortfolioChangeEvent = CustomEvent<PortfolioSummary>;

// ── Store ──────────────────────────────────────────────────────────────────

export class PortfolioStore extends EventTarget {
  private _entries: ProjectPortfolioEntry[] = [];
  private _summary: PortfolioSummary = {
    totalProjects: 0,
    totalGrossProfit: 0,
    weightedProgress: 0,
    unpaidAmount: 0,
    dangerSignals: [],
    dangerProjectCount: 0,
  };

  get summary(): PortfolioSummary {
    return this._summary;
  }

  /**
   * Replace all portfolio entries and recompute the summary.
   * Emits a 'change' CustomEvent with the new summary as detail.
   */
  setEntries(entries: ProjectPortfolioEntry[]): void {
    this._entries = entries;
    this._recompute();
  }

  /**
   * Update a single project's entry (upsert by project.id).
   * Recomputes and emits.
   */
  upsertEntry(entry: ProjectPortfolioEntry): void {
    const idx = this._entries.findIndex((e) => e.project.id === entry.project.id);
    if (idx >= 0) {
      this._entries = [
        ...this._entries.slice(0, idx),
        entry,
        ...this._entries.slice(idx + 1),
      ];
    } else {
      this._entries = [...this._entries, entry];
    }
    this._recompute();
  }

  /**
   * Remove a project entry by project ID and recompute.
   */
  removeEntry(projectId: string): void {
    this._entries = this._entries.filter((e) => e.project.id !== projectId);
    this._recompute();
  }

  private _recompute(): void {
    this._summary = aggregatePortfolio(this._entries);
    const event: PortfolioChangeEvent = new CustomEvent("change", {
      detail: this._summary,
    });
    this.dispatchEvent(event);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: PortfolioStore | null = null;

export function getPortfolioStore(): PortfolioStore {
  if (!_instance) {
    _instance = new PortfolioStore();
  }
  return _instance;
}

/** Reset singleton — for tests only */
export function _resetPortfolioStore(): void {
  _instance = null;
}
