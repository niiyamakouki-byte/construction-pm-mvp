import { describe, it, expect, vi, beforeEach } from "vitest";

function makeMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}
import {
  createPin,
  updatePin,
  deletePin,
  loadPins,
  savePins,
  type DrawingPin,
} from "./drawing-pins.js";

const makePin = (overrides: Partial<Omit<DrawingPin, "id" | "createdAt">> = {}): DrawingPin =>
  createPin({
    x: 0.3,
    y: 0.5,
    comment: "亀裂あり",
    assignee: "田中",
    dueDate: "2025-04-15",
    status: "未着手",
    ...overrides,
  });

describe("createPin", () => {
  it("generates a unique id", () => {
    const a = makePin();
    const b = makePin();
    expect(a.id).not.toBe(b.id);
  });

  it("sets createdAt as ISO string", () => {
    const p = makePin();
    expect(() => new Date(p.createdAt)).not.toThrow();
  });

  it("preserves provided fields", () => {
    const p = makePin({ comment: "test comment", status: "対応中" });
    expect(p.comment).toBe("test comment");
    expect(p.status).toBe("対応中");
  });
});

describe("updatePin", () => {
  it("updates matching pin", () => {
    const pin = makePin();
    const updated = updatePin([pin], pin.id, { status: "完了" });
    expect(updated[0]?.status).toBe("完了");
  });

  it("does not mutate other pins", () => {
    const a = makePin({ comment: "A" });
    const b = makePin({ comment: "B" });
    const updated = updatePin([a, b], a.id, { comment: "A updated" });
    expect(updated[1]?.comment).toBe("B");
  });
});

describe("deletePin", () => {
  it("removes pin by id", () => {
    const pin = makePin();
    const result = deletePin([pin], pin.id);
    expect(result).toHaveLength(0);
  });

  it("leaves other pins intact", () => {
    const a = makePin();
    const b = makePin();
    const result = deletePin([a, b], a.id);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(b.id);
  });
});

describe("pin persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeMockStorage());
  });

  it("loads empty array for unknown drawing", () => {
    expect(loadPins("drawing-x")).toEqual([]);
  });

  it("saves and loads pins", () => {
    const pin = makePin();
    savePins("d1", [pin]);
    const loaded = loadPins("d1");
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe(pin.id);
  });

  it("overwrites on re-save", () => {
    const a = makePin();
    const b = makePin();
    savePins("d1", [a]);
    savePins("d1", [a, b]);
    expect(loadPins("d1")).toHaveLength(2);
  });
});
