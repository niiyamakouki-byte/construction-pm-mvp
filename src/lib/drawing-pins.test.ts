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
  generatePinReport,
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

describe("generatePinReport", () => {
  const p1 = makePin({ comment: "亀裂あり", assignee: "田中", dueDate: "2025-05-01", status: "未着手" });
  const p2 = makePin({ comment: "塗装剥がれ", assignee: "鈴木", dueDate: "", status: "完了" });

  it("returns an HTML string with the project and drawing name", () => {
    const html = generatePinReport([p1], "テスト現場", "1F平面図");
    expect(html).toContain("テスト現場");
    expect(html).toContain("1F平面図");
  });

  it("includes all pins by default", () => {
    const html = generatePinReport([p1, p2], "現場A", "図面B");
    expect(html).toContain("亀裂あり");
    expect(html).toContain("塗装剥がれ");
  });

  it("filters incomplete pins when incompleteOnly is true", () => {
    const html = generatePinReport([p1, p2], "現場A", "図面B", { incompleteOnly: true });
    expect(html).toContain("亀裂あり");
    expect(html).not.toContain("塗装剥がれ");
  });

  it("shows correct count in header", () => {
    const html = generatePinReport([p1, p2], "現場A", "図面B", { incompleteOnly: true });
    expect(html).toContain("1件");
  });

  it("shows empty state when no pins match filter", () => {
    const html = generatePinReport([p2], "現場A", "図面B", { incompleteOnly: true });
    expect(html).toContain("指摘事項なし");
  });

  it("escapes HTML special characters in comment", () => {
    const pin = makePin({ comment: '<script>alert("xss")</script>', status: "未着手" });
    const html = generatePinReport([pin], "現場", "図面");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes position as percentage", () => {
    const pin = makePin({ x: 0.25, y: 0.75 });
    const html = generatePinReport([pin], "現場", "図面");
    expect(html).toContain("25.0%");
    expect(html).toContain("75.0%");
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
