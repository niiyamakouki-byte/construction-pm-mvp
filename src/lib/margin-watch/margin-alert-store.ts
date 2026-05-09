/**
 * MarginAlertStore — persists MarginAlert[] to localStorage.
 *
 * Key: "genbahub:margin-alerts"
 * Capacity: 5000 alerts (FIFO eviction)
 * Extends EventTarget so consumers can addEventListener('alert-added', handler).
 */

import type { MarginAlert, MarginAlertLevel } from "./types.js";

const STORAGE_KEY = "genbahub:margin-alerts";
const MAX_ALERTS = 5000;

// ── Store class ────────────────────────────────────────────────────────────

export class MarginAlertStore extends EventTarget {
  // ── Persistence helpers ──────────────────────────────────────────────────

  private _load(): MarginAlert[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as MarginAlert[];
    } catch {
      return [];
    }
  }

  private _save(alerts: MarginAlert[]): void {
    try {
      // FIFO: keep latest MAX_ALERTS entries
      const trimmed =
        alerts.length > MAX_ALERTS
          ? alerts.slice(alerts.length - MAX_ALERTS)
          : alerts;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore storage quota errors
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Add a new alert, persist, and emit 'alert-added'.
   */
  add(alert: MarginAlert): void {
    const existing = this._load();
    this._save([...existing, alert]);
    this.dispatchEvent(new CustomEvent("alert-added", { detail: alert }));
  }

  /** Return all stored alerts. */
  all(): MarginAlert[] {
    return this._load();
  }

  /** Return alerts for a specific project. */
  byProject(projectId: string): MarginAlert[] {
    return this._load().filter((a) => a.projectId === projectId);
  }

  /** Return alerts filtered by level. */
  byLevel(level: MarginAlertLevel): MarginAlert[] {
    return this._load().filter((a) => a.level === level);
  }

  /** Return alerts raised on or after the given date. */
  since(date: Date): MarginAlert[] {
    const threshold = date.toISOString();
    return this._load().filter((a) => a.raisedAt >= threshold);
  }

  /**
   * Remove alert by id and emit 'alert-dismissed'.
   */
  dismiss(alertId: string): void {
    const existing = this._load();
    const filtered = existing.filter((a) => a.id !== alertId);
    if (filtered.length === existing.length) return;
    this._save(filtered);
    this.dispatchEvent(new CustomEvent("alert-dismissed", { detail: { alertId } }));
  }

  /** Remove all stored alerts. */
  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: MarginAlertStore | null = null;

export const marginAlertStore: MarginAlertStore = new Proxy(
  {} as MarginAlertStore,
  {
    get(_target, prop, receiver) {
      if (!_instance) {
        _instance = new MarginAlertStore();
      }
      const value = Reflect.get(_instance, prop, _instance);
      return typeof value === "function" ? value.bind(_instance) : value;
    },
  },
);

/** Reset singleton — for testing only */
export function _resetMarginAlertStore(): void {
  _instance = null;
}
