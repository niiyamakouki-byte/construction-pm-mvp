/**
 * realtime-store — MonitorSnapshot のリアルタイム配信ストア
 *
 * EventTarget を継承し、ポーリング (5秒) で /api/monitor/snapshot を fetch。
 * 失敗時は console.warn のみで UI を壊さない。
 * React / DOM 依存なし (EventTarget は Node.js 18+ / ブラウザ両対応)。
 */

import type { MonitorSnapshot } from "./monitor-aggregator.js";

const CHANGE_EVENT = "change";

export class MonitorRealtimeStore extends EventTarget {
  private snapshot: MonitorSnapshot | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** 現在保持しているスナップショットを返す (null = 未取得) */
  getSnapshot(): MonitorSnapshot | null {
    return this.snapshot;
  }

  /**
   * スナップショット更新: 内部状態を更新して "change" イベントを発火する。
   * update は外部 (テスト / 手動注入) からも呼べる。
   */
  update(snapshot: MonitorSnapshot): void {
    this.snapshot = snapshot;
    this.dispatchEvent(
      Object.assign(new Event(CHANGE_EVENT), { snapshot }),
    );
  }

  /**
   * スナップショット変化を購読する。
   * @returns unsubscribe 関数
   */
  subscribe(callback: (snapshot: MonitorSnapshot) => void): () => void {
    const handler = (e: Event) => {
      const ev = e as Event & { snapshot: MonitorSnapshot };
      callback(ev.snapshot);
    };
    this.addEventListener(CHANGE_EVENT, handler);
    return () => this.removeEventListener(CHANGE_EVENT, handler);
  }

  /**
   * setInterval で /api/monitor/snapshot を fetch し続ける。
   * 失敗は console.warn のみ (UI 非破壊)。
   * 既に起動中なら何もしない。
   */
  pullFromAPI(intervalMs = 5000): void {
    if (this.intervalId !== null) return;

    const fetchOnce = () => {
      fetch("/api/monitor/snapshot")
        .then((res) => {
          if (!res.ok) {
            console.warn(`[MonitorRealtimeStore] fetch failed: ${res.status}`);
            return null;
          }
          return res.json() as Promise<MonitorSnapshot>;
        })
        .then((data) => {
          if (data) this.update(data);
        })
        .catch((err: unknown) => {
          console.warn("[MonitorRealtimeStore] fetch error:", err);
        });
    };

    // 初回即時取得
    fetchOnce();
    this.intervalId = setInterval(fetchOnce, intervalMs);
  }

  /** ポーリングを停止する */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
