import { describe, it, expect, beforeEach, vi } from "vitest";

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
  addStroke,
  createStroke,
  eraseAt,
  loadAnnotations,
  saveAnnotations,
  undoLastStroke,
  type PdfAnnotations,
} from "./pdf-annotations.js";

describe("createStroke", () => {
  it("generates a unique id and preserves fields", () => {
    const a = createStroke([{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], "#D64545", 0.01);
    const b = createStroke([{ x: 0, y: 0 }], "#346538", 0.02);
    expect(a.id).not.toBe(b.id);
    expect(a.color).toBe("#D64545");
    expect(a.width).toBe(0.01);
  });
});

describe("addStroke / undoLastStroke", () => {
  it("appends a stroke to the given page only", () => {
    const stroke = createStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }], "#D64545", 0.01);
    const data = addStroke({}, 2, stroke);
    expect(data[2]).toEqual([stroke]);
    expect(data[1]).toBeUndefined();
  });

  it("undo removes only the most recent stroke on that page", () => {
    const s1 = createStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }], "#D64545", 0.01);
    const s2 = createStroke([{ x: 0, y: 1 }, { x: 1, y: 0 }], "#346538", 0.02);
    let data = addStroke({}, 1, s1);
    data = addStroke(data, 1, s2);
    const undone = undoLastStroke(data, 1);
    expect(undone[1]).toEqual([s1]);
  });

  it("undo on an empty page is a no-op (returns the same reference)", () => {
    const data: PdfAnnotations = {};
    expect(undoLastStroke(data, 1)).toBe(data);
  });
});

describe("eraseAt", () => {
  it("removes strokes with a point inside the radius", () => {
    const near = createStroke([{ x: 0.5, y: 0.5 }], "#D64545", 0.01);
    const far = createStroke([{ x: 0.9, y: 0.9 }], "#D64545", 0.01);
    const data = addStroke(addStroke({}, 1, near), 1, far);
    const next = eraseAt(data, 1, 0.5, 0.5, 0.05);
    expect(next[1]).toEqual([far]);
  });

  it("returns the same reference when nothing is erased", () => {
    const far = createStroke([{ x: 0.9, y: 0.9 }], "#D64545", 0.01);
    const data = addStroke({}, 1, far);
    expect(eraseAt(data, 1, 0.0, 0.0, 0.01)).toBe(data);
  });
});

describe("annotation persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeMockStorage());
  });

  it("round-trips through localStorage per documentId", () => {
    const stroke = createStroke([{ x: 0, y: 0 }, { x: 1, y: 1 }], "#D64545", 0.01);
    const data = addStroke({}, 1, stroke);
    saveAnnotations("doc-1", data);
    expect(loadAnnotations("doc-1")).toEqual(data);
    expect(loadAnnotations("doc-2")).toEqual({});
  });

  it("returns {} when storage is corrupted or unavailable", () => {
    localStorage.setItem("pdf_annotations_bad", "{not json");
    expect(loadAnnotations("bad")).toEqual({});
  });
});
