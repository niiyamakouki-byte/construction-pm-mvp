/**
 * VendorEventStore — localStorage CRUD, FIFO trim, EventTarget
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { VendorEventStore, getVendorEventStore } from "../lib/vendor-rating/event-store.js";
import { VendorEventKind } from "../lib/vendor-rating/types.js";
import type { VendorEvent } from "../lib/vendor-rating/types.js";

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

function makeEvent(overrides: Partial<VendorEvent> = {}): VendorEvent {
  return {
    id: crypto.randomUUID(),
    vendorId: "v1",
    projectId: "p1",
    kind: VendorEventKind.DeliveryOnTime,
    weight: 1.0,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("VendorEventStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    VendorEventStore._reset();
  });

  // ── Singleton ──────────────────────────────────────────────────

  it("getInstance returns the same instance", () => {
    const a = VendorEventStore.getInstance();
    const b = VendorEventStore.getInstance();
    expect(a).toBe(b);
  });

  it("getVendorEventStore() helper returns same instance", () => {
    const a = getVendorEventStore();
    const b = VendorEventStore.getInstance();
    expect(a).toBe(b);
  });

  // ── addEvent ───────────────────────────────────────────────────

  it("addEvent stores and returns the event", () => {
    const store = VendorEventStore.getInstance();
    const e = makeEvent();
    const result = store.addEvent(e);
    expect(result).toEqual(e);
  });

  it("addEvent persists to localStorage", () => {
    const store = VendorEventStore.getInstance();
    const e = makeEvent({ id: "persist-1" });
    store.addEvent(e);
    const raw = localStorage.getItem("genbahub:vendor-events");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as VendorEvent[];
    expect(parsed.some((ev) => ev.id === "persist-1")).toBe(true);
  });

  it("addEvent fires change event with type add", () => {
    const store = VendorEventStore.getInstance();
    const listener = vi.fn();
    store.addEventListener("change", listener);
    store.addEvent(makeEvent());
    expect(listener).toHaveBeenCalledOnce();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.type).toBe("add");
    store.removeEventListener("change", listener);
  });

  it("multiple addEvent calls accumulate", () => {
    const store = VendorEventStore.getInstance();
    store.addEvent(makeEvent({ id: "e1" }));
    store.addEvent(makeEvent({ id: "e2" }));
    store.addEvent(makeEvent({ id: "e3" }));
    expect(store.allEvents()).toHaveLength(3);
  });

  // ── removeEvent ────────────────────────────────────────────────

  it("removeEvent returns true for existing id", () => {
    const store = VendorEventStore.getInstance();
    const e = makeEvent({ id: "del-1" });
    store.addEvent(e);
    expect(store.removeEvent("del-1")).toBe(true);
  });

  it("removeEvent actually removes the event", () => {
    const store = VendorEventStore.getInstance();
    const e = makeEvent({ id: "del-2" });
    store.addEvent(e);
    store.removeEvent("del-2");
    expect(store.allEvents().find((ev) => ev.id === "del-2")).toBeUndefined();
  });

  it("removeEvent returns false for unknown id", () => {
    const store = VendorEventStore.getInstance();
    expect(store.removeEvent("nonexistent")).toBe(false);
  });

  it("removeEvent fires change event with type remove", () => {
    const store = VendorEventStore.getInstance();
    const e = makeEvent({ id: "del-3" });
    store.addEvent(e);
    const listener = vi.fn();
    store.addEventListener("change", listener);
    store.removeEvent("del-3");
    expect(listener).toHaveBeenCalledOnce();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.type).toBe("remove");
    store.removeEventListener("change", listener);
  });

  // ── eventsByVendor ─────────────────────────────────────────────

  it("eventsByVendor returns only events for the given vendorId", () => {
    const store = VendorEventStore.getInstance();
    store.addEvent(makeEvent({ vendorId: "v1", id: "a1" }));
    store.addEvent(makeEvent({ vendorId: "v2", id: "a2" }));
    store.addEvent(makeEvent({ vendorId: "v1", id: "a3" }));
    const v1Events = store.eventsByVendor("v1");
    expect(v1Events).toHaveLength(2);
    expect(v1Events.every((e) => e.vendorId === "v1")).toBe(true);
  });

  it("eventsByVendor returns empty array for unknown vendor", () => {
    const store = VendorEventStore.getInstance();
    expect(store.eventsByVendor("unknown")).toEqual([]);
  });

  // ── clearAll ───────────────────────────────────────────────────

  it("clearAll removes all events", () => {
    const store = VendorEventStore.getInstance();
    store.addEvent(makeEvent());
    store.addEvent(makeEvent());
    store.clearAll();
    expect(store.allEvents()).toHaveLength(0);
  });

  it("clearAll fires change event with type clear", () => {
    const store = VendorEventStore.getInstance();
    store.addEvent(makeEvent());
    const listener = vi.fn();
    store.addEventListener("change", listener);
    store.clearAll();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.type).toBe("clear");
    store.removeEventListener("change", listener);
  });

  it("clearAll removes localStorage key", () => {
    const store = VendorEventStore.getInstance();
    store.addEvent(makeEvent());
    store.clearAll();
    expect(localStorage.getItem("genbahub:vendor-events")).toBeNull();
  });

  // ── FIFO trim ──────────────────────────────────────────────────

  it("FIFO: trimming keeps the newest MAX_EVENTS events", () => {
    const store = VendorEventStore.getInstance();
    // Add 10005 events by direct localStorage manipulation to avoid timeout
    const events: VendorEvent[] = Array.from({ length: 10_005 }, (_, i) =>
      makeEvent({ id: `fifo-${i}`, vendorId: "vfifo" }),
    );
    localStorage.setItem("genbahub:vendor-events", JSON.stringify(events));
    // Adding one more triggers the trim
    store.addEvent(makeEvent({ id: "fifo-trigger", vendorId: "vfifo" }));
    const all = store.allEvents();
    expect(all.length).toBeLessThanOrEqual(10_000);
  });

  // ── Corrupt storage recovery ──────────────────────────────────

  it("returns empty array when localStorage contains invalid JSON", () => {
    localStorage.setItem("genbahub:vendor-events", "NOT_JSON");
    const store = VendorEventStore.getInstance();
    expect(store.allEvents()).toEqual([]);
  });
});
