/**
 * MarginWatcher — evaluates ProjectFinanceSnapshot and generates MarginAlerts.
 */

import type { ProjectFinanceSnapshot, MarginAlert, MarginWatchConfig } from "./types.js";
import { DEFAULT_MARGIN_WATCH_CONFIG } from "./types.js";
import { calculateMargin } from "./margin-calculator.js";
import { classifyCause } from "./cause-classifier.js";
import { suggestAction_ja } from "./action-suggester.js";
import { MarginAlertStore, marginAlertStore } from "./margin-alert-store.js";

let _alertCounter = 0;

function generateAlertId(): string {
  return `ma-${Date.now()}-${++_alertCounter}`;
}

export class MarginWatcher {
  private readonly _store: MarginAlertStore;
  private readonly _config: MarginWatchConfig;
  /** In-memory previous snapshots keyed by projectId */
  private readonly _snapshots = new Map<string, ProjectFinanceSnapshot>();

  constructor(
    store: MarginAlertStore = marginAlertStore,
    config: MarginWatchConfig = DEFAULT_MARGIN_WATCH_CONFIG,
  ) {
    this._store = store;
    this._config = config;
  }

  /**
   * Evaluate a single snapshot.
   *
   * Returns null when:
   * - current level is 'safe' AND previous level was also 'safe' (chatter suppression)
   *
   * Otherwise generates a MarginAlert, persists it, and returns it.
   */
  evaluate(snapshot: ProjectFinanceSnapshot): MarginAlert | null {
    const prev = this._snapshots.get(snapshot.projectId);

    const { actual, forecast, level } = calculateMargin(snapshot, this._config);

    // Chatter suppression: safe→safe transition produces no alert
    if (level === "safe") {
      const prevLevel = prev
        ? calculateMargin(prev, this._config).level
        : "safe";
      if (prevLevel === "safe") {
        // Still update snapshot so future comparisons stay current
        this._snapshots.set(snapshot.projectId, {
          ...snapshot,
          marginRatioPct: actual,
          forecastMarginRatioPct: forecast,
        });
        return null;
      }
    }

    const causes = classifyCause(prev, snapshot);
    const action = suggestAction_ja(level, causes);

    const alert: MarginAlert = {
      id: generateAlertId(),
      projectId: snapshot.projectId,
      projectName: snapshot.projectName,
      level,
      marginRatioPct: actual,
      forecastMarginRatioPct: forecast,
      deltaFromTargetPct: forecast - this._config.targetMarginPct,
      causeTag: causes,
      suggestedAction_ja: action,
      raisedAt: new Date().toISOString(),
    };

    this._store.add(alert);

    // Update in-memory snapshot
    this._snapshots.set(snapshot.projectId, {
      ...snapshot,
      marginRatioPct: actual,
      forecastMarginRatioPct: forecast,
    });

    return alert;
  }

  /**
   * Evaluate multiple snapshots at once.
   * Returns only non-null alerts.
   */
  evaluateBatch(snapshots: ProjectFinanceSnapshot[]): MarginAlert[] {
    const results: MarginAlert[] = [];
    for (const snapshot of snapshots) {
      const alert = this.evaluate(snapshot);
      if (alert !== null) {
        results.push(alert);
      }
    }
    return results;
  }
}
