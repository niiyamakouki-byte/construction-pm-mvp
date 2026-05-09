/**
 * Vendor Rating AI — event store
 * localStorage キー: genbahub:vendor-events
 * 最大10,000件 — 超過時は古いものから FIFO 削除
 * EventTarget でイベント通知
 */

import type { VendorEvent } from "./types.js";

const STORAGE_KEY = "genbahub:vendor-events";
const MAX_EVENTS = 10_000;

export class VendorEventStore extends EventTarget {
  private static _instance: VendorEventStore | null = null;

  static getInstance(): VendorEventStore {
    if (!VendorEventStore._instance) {
      VendorEventStore._instance = new VendorEventStore();
    }
    return VendorEventStore._instance;
  }

  /** テスト用: シングルトンをリセット */
  static _reset(): void {
    VendorEventStore._instance = null;
  }

  private load(): VendorEvent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as VendorEvent[];
    } catch {
      return [];
    }
  }

  private save(events: VendorEvent[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  addEvent(event: VendorEvent): VendorEvent {
    const events = this.load();
    events.push(event);
    // FIFO — 古いものから削除
    const trimmed =
      events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
    this.save(trimmed);
    this.dispatchEvent(new CustomEvent("change", { detail: { type: "add", event } }));
    return event;
  }

  removeEvent(id: string): boolean {
    const events = this.load();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    const removed = events[idx];
    events.splice(idx, 1);
    this.save(events);
    this.dispatchEvent(
      new CustomEvent("change", { detail: { type: "remove", event: removed } }),
    );
    return true;
  }

  eventsByVendor(vendorId: string): VendorEvent[] {
    return this.load().filter((e) => e.vendorId === vendorId);
  }

  allEvents(): VendorEvent[] {
    return this.load();
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.dispatchEvent(new CustomEvent("change", { detail: { type: "clear" } }));
  }
}

/** シングルトンインスタンス取得のショートハンド */
export function getVendorEventStore(): VendorEventStore {
  return VendorEventStore.getInstance();
}
