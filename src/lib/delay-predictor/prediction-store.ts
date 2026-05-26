/**
 * 工程遅延予測AI — 予測結果ストア
 *
 * localStorage キー: genbahub:delay-predictions
 * 最大5000件 — FIFO 削除
 * EventTarget でイベント通知
 */

import type { DelayPrediction, RiskLevel } from "./types.js";

const STORAGE_KEY = "genbahub:delay-predictions";
const MAX_PREDICTIONS = 5000;

// ── シングルトン ──────────────────────────────────────────────────────────────

let _instance: PredictionStore | null = null;

export function getPredictionStore(): PredictionStore {
  if (!_instance) {
    _instance = new PredictionStore();
  }
  return _instance;
}

/** テスト用: シングルトンをリセット */
export function _resetPredictionStore(): void {
  _instance = null;
}

// ── ストアクラス ──────────────────────────────────────────────────────────────

export class PredictionStore extends EventTarget {
  private _load(): DelayPrediction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as DelayPrediction[];
    } catch {
      return [];
    }
  }

  private _save(predictions: DelayPrediction[]): void {
    try {
      const trimmed =
        predictions.length > MAX_PREDICTIONS
          ? predictions.slice(predictions.length - MAX_PREDICTIONS)
          : predictions;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Storage quota エラーは無視
    }
  }

  private _emit(type: string): void {
    this.dispatchEvent(new CustomEvent("change", { detail: { type } }));
  }

  /** 予測結果を保存 (同じ taskId の既存データを上書き) */
  save(prediction: DelayPrediction): void {
    const existing = this._load();
    const idx = existing.findIndex(
      (p) => p.taskId === prediction.taskId && p.projectId === prediction.projectId,
    );
    if (idx !== -1) {
      existing[idx] = prediction;
      this._save(existing);
    } else {
      this._save([...existing, prediction]);
    }
    this._emit("save");
  }

  /** 複数予測を一括保存 (単一ロード/保存) */
  saveAll(predictions: DelayPrediction[]): void {
    if (predictions.length === 0) return;
    const existing = this._load();
    const map = new Map(existing.map((p) => [`${p.projectId}:${p.taskId}`, p]));
    for (const p of predictions) {
      map.set(`${p.projectId}:${p.taskId}`, p);
    }
    this._save([...map.values()]);
    this._emit("saveAll");
  }

  queryByProject(projectId: string): DelayPrediction[] {
    return this._load().filter((p) => p.projectId === projectId);
  }

  queryByRiskLevel(level: RiskLevel): DelayPrediction[] {
    return this._load().filter((p) => p.riskLevel === level);
  }

  removeByTask(taskId: string): void {
    const existing = this._load();
    const filtered = existing.filter((p) => p.taskId !== taskId);
    if (filtered.length !== existing.length) {
      this._save(filtered);
      this._emit("remove");
    }
  }

  allPredictions(): DelayPrediction[] {
    return this._load();
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._emit("clear");
  }
}
