/**
 * PredictionStore — persists RepeatPrediction[] to localStorage.
 *
 * Key: "laporta.genbahub.repeat_predictions"
 * Capacity: 5000件 (FIFO eviction)
 * Extends EventTarget so consumers can addEventListener('prediction-added', handler).
 */

import type { RepeatPrediction, CustomerSegment } from "./types.js";

const STORAGE_KEY = "laporta.genbahub.repeat_predictions";
const MAX_PREDICTIONS = 5000;

// ── Store class ────────────────────────────────────────────────────────────

export class PredictionStore extends EventTarget {
  private _load(): RepeatPrediction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RepeatPrediction[];
    } catch {
      return [];
    }
  }

  private _save(predictions: RepeatPrediction[]): void {
    try {
      const trimmed =
        predictions.length > MAX_PREDICTIONS
          ? predictions.slice(predictions.length - MAX_PREDICTIONS)
          : predictions;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore quota errors
    }
  }

  /** Add or replace a prediction for a customer, persist, and emit 'prediction-added'. */
  upsert(prediction: RepeatPrediction): void {
    const existing = this._load();
    const index = existing.findIndex((p) => p.customerId === prediction.customerId);
    if (index >= 0) {
      existing[index] = prediction;
    } else {
      existing.push(prediction);
    }
    this._save(existing);
    this.dispatchEvent(new CustomEvent("prediction-added", { detail: prediction }));
  }

  /** Bulk upsert multiple predictions at once. */
  upsertAll(predictions: RepeatPrediction[]): void {
    for (const p of predictions) {
      this.upsert(p);
    }
  }

  /** Return all stored predictions. */
  all(): RepeatPrediction[] {
    return this._load();
  }

  /** Return prediction for a specific customer. */
  byCustomer(customerId: string): RepeatPrediction | null {
    return this._load().find((p) => p.customerId === customerId) ?? null;
  }

  /** Return predictions filtered by segment. */
  bySegment(segment: CustomerSegment): RepeatPrediction[] {
    return this._load().filter((p) => p.segment === segment);
  }

  /**
   * Return predictions where next order is within N months.
   * @param withinMonths — horizon (inclusive)
   */
  upcoming(withinMonths: number): RepeatPrediction[] {
    return this._load().filter((p) => p.predictedNextOrderMonths <= withinMonths);
  }

  /** Remove all stored predictions. */
  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: PredictionStore | null = null;

export const predictionStore: PredictionStore = new Proxy(
  {} as PredictionStore,
  {
    get(_target, prop, _receiver) {
      if (!_instance) {
        _instance = new PredictionStore();
      }
      const value = Reflect.get(_instance, prop, _instance);
      return typeof value === "function" ? value.bind(_instance) : value;
    },
  },
);

/** Reset singleton — for testing only */
export function _resetPredictionStore(): void {
  _instance = null;
}
