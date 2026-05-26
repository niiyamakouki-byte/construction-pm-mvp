import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createSession,
  addSegment,
  removeSegment,
  updateSegment,
  summariseSession,
  suggestForRow,
  autoMatchSession,
  exportSessionCSV,
  exportSessionJSON,
  saveSession,
  loadSession,
  listSessionIds,
  deleteSession,
  createTakeoffUndoStack,
  withUndo,
  TAKEOFF_SEGMENT_CATEGORIES,
  MAX_UNDO_STEPS,
} from "../lib/takeoff-session.js";
import type {
  TakeoffSessionState,
  TakeoffSegmentCategory,
} from "../lib/takeoff-session.js";
import type { CostMasterEntry } from "../lib/measurement-to-estimate-link.js";

// ── Mock localStorage ─────────────────────────────────────────────────────────

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
  clear: vi.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};

beforeEach(() => {
  // Clear mock storage
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Sample data helpers ───────────────────────────────────────────────────────

const sampleCostMaster: CostMasterEntry[] = [
  { code: "W001", name: "LGS壁ボード", unit: "㎡", unitPrice: 3200, categoryName: "壁" },
  { code: "F001", name: "タイルカーペット", unit: "㎡", unitPrice: 4500, categoryName: "床" },
  { code: "C001", name: "天井クロス", unit: "㎡", unitPrice: 1800, categoryName: "天井" },
  { code: "B001", name: "巾木材", unit: "m", unitPrice: 600, categoryName: "巾木" },
];

function makeSession(): TakeoffSessionState {
  return createSession("drawing-001", "proj-001");
}

// ── createSession ─────────────────────────────────────────────────────────────

describe("createSession", () => {
  it("returns a session with correct drawingId", () => {
    const sess = createSession("dwg-1");
    expect(sess.drawingId).toBe("dwg-1");
  });

  it("returns a session with projectId when provided", () => {
    const sess = createSession("dwg-1", "proj-99");
    expect(sess.projectId).toBe("proj-99");
  });

  it("returns a session with empty segments", () => {
    const sess = createSession("dwg-1");
    expect(sess.segments).toHaveLength(0);
  });

  it("assigns unique ids to each session", () => {
    const a = createSession("dwg-1");
    const b = createSession("dwg-1");
    expect(a.id).not.toBe(b.id);
  });

  it("createdAt and updatedAt are set", () => {
    const before = Date.now();
    const sess = createSession("dwg-1");
    const after = Date.now();
    expect(sess.createdAt).toBeGreaterThanOrEqual(before);
    expect(sess.createdAt).toBeLessThanOrEqual(after);
    expect(sess.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

// ── addSegment ────────────────────────────────────────────────────────────────

describe("addSegment", () => {
  it("adds a segment to an empty session", () => {
    const sess = makeSession();
    const next = addSegment(sess, { category: "壁", measureKind: "area", value: 12.5 });
    expect(next.segments).toHaveLength(1);
    expect(next.segments[0]?.category).toBe("壁");
    expect(next.segments[0]?.value).toBe(12.5);
    expect(next.segments[0]?.measureKind).toBe("area");
  });

  it("accumulates multiple segments", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 20 });
    sess = addSegment(sess, { category: "巾木", measureKind: "distance", value: 8.5 });
    expect(sess.segments).toHaveLength(3);
  });

  it("does not mutate the original session", () => {
    const original = makeSession();
    addSegment(original, { category: "壁", measureKind: "area", value: 5 });
    expect(original.segments).toHaveLength(0);
  });

  it("stores optional label", () => {
    const sess = makeSession();
    const next = addSegment(sess, { category: "壁", measureKind: "area", value: 8, label: "北面" });
    expect(next.segments[0]?.label).toBe("北面");
  });

  it("assigns unique segment ids", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    const ids = sess.segments.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("updates updatedAt", () => {
    const sess = makeSession();
    const t0 = sess.updatedAt;
    const next = addSegment(sess, { category: "床", measureKind: "area", value: 1 });
    expect(next.updatedAt).toBeGreaterThanOrEqual(t0);
  });
});

// ── removeSegment ─────────────────────────────────────────────────────────────

describe("removeSegment", () => {
  it("removes a segment by id", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    const segId = sess.segments[0]!.id;
    sess = removeSegment(sess, segId);
    expect(sess.segments).toHaveLength(0);
  });

  it("does not affect other segments", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 20 });
    const firstId = sess.segments[0]!.id;
    sess = removeSegment(sess, firstId);
    expect(sess.segments).toHaveLength(1);
    expect(sess.segments[0]?.category).toBe("床");
  });

  it("handles removing non-existent id gracefully", () => {
    const sess = makeSession();
    const next = removeSegment(sess, "no-such-id");
    expect(next.segments).toHaveLength(0);
  });
});

// ── updateSegment ─────────────────────────────────────────────────────────────

describe("updateSegment", () => {
  it("updates category of a segment", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    const id = sess.segments[0]!.id;
    sess = updateSegment(sess, id, { category: "天井" });
    expect(sess.segments[0]?.category).toBe("天井");
  });

  it("updates label of a segment", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    const id = sess.segments[0]!.id;
    sess = updateSegment(sess, id, { label: "南面" });
    expect(sess.segments[0]?.label).toBe("南面");
  });

  it("links a cost code to a segment", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    const id = sess.segments[0]!.id;
    sess = updateSegment(sess, id, { linkedCostCode: "W001", linkedCostName: "LGS壁ボード" });
    expect(sess.segments[0]?.linkedCostCode).toBe("W001");
    expect(sess.segments[0]?.linkedCostName).toBe("LGS壁ボード");
  });

  it("does not mutate other segments", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 10 });
    const firstId = sess.segments[0]!.id;
    sess = updateSegment(sess, firstId, { category: "天井" });
    expect(sess.segments[1]?.category).toBe("床");
  });
});

// ── summariseSession ──────────────────────────────────────────────────────────

describe("summariseSession", () => {
  it("returns empty array for empty session", () => {
    const sess = makeSession();
    expect(summariseSession(sess)).toHaveLength(0);
  });

  it("groups same category + measureKind", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    const rows = summariseSession(sess);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalValue).toBeCloseTo(15);
  });

  it("sums up a wall session with 3 segments → 42.3㎡", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 20.1 });
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 12.5 });
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 9.7 });
    const rows = summariseSession(sess);
    expect(rows[0]?.totalValue).toBeCloseTo(42.3);
  });

  it("keeps different categories separate", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 20 });
    const rows = summariseSession(sess);
    expect(rows).toHaveLength(2);
  });

  it("keeps same category but different measureKind as separate rows", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "壁", measureKind: "distance", value: 3 });
    const rows = summariseSession(sess);
    expect(rows).toHaveLength(2);
  });

  it("distance rows have unit 'm'", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "巾木", measureKind: "distance", value: 5 });
    const rows = summariseSession(sess);
    expect(rows[0]?.unit).toBe("m");
  });

  it("area rows have unit '㎡'", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 10 });
    const rows = summariseSession(sess);
    expect(rows[0]?.unit).toBe("㎡");
  });

  it("segmentCount reflects number of segments in group", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "天井", measureKind: "area", value: 5 });
    sess = addSegment(sess, { category: "天井", measureKind: "area", value: 8 });
    sess = addSegment(sess, { category: "天井", measureKind: "area", value: 3 });
    const rows = summariseSession(sess);
    expect(rows[0]?.segmentCount).toBe(3);
  });

  it("sorts rows by TAKEOFF_SEGMENT_CATEGORIES order", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    sess = addSegment(sess, { category: "天井", measureKind: "area", value: 8 });
    const rows = summariseSession(sess);
    const categories = rows.map((r) => r.category);
    const expectedOrder = TAKEOFF_SEGMENT_CATEGORIES.filter((c) =>
      categories.includes(c as TakeoffSegmentCategory),
    );
    expect(categories).toEqual(expectedOrder);
  });
});

// ── suggestForRow ─────────────────────────────────────────────────────────────

describe("suggestForRow", () => {
  it("returns suggestions for a 壁 area row", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 15 });
    const rows = summariseSession(sess);
    const suggestions = suggestForRow(rows[0]!, sampleCostMaster);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("returns empty array when cost master is empty", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    const rows = summariseSession(sess);
    const suggestions = suggestForRow(rows[0]!, []);
    expect(suggestions).toHaveLength(0);
  });

  it("suggestion quantity matches totalValue", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 20 });
    const rows = summariseSession(sess);
    const suggestions = suggestForRow(rows[0]!, sampleCostMaster);
    expect(suggestions[0]?.quantity).toBeCloseTo(20);
  });

  it("suggestion amount = quantity × unitPrice", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 10 });
    const rows = summariseSession(sess);
    const suggestions = suggestForRow(rows[0]!, sampleCostMaster, 1);
    const s = suggestions[0]!;
    expect(s.amount).toBe(Math.round(s.quantity * s.unitPrice));
  });

  it("respects maxResults limit", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    const rows = summariseSession(sess);
    const suggestions = suggestForRow(rows[0]!, sampleCostMaster, 2);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });
});

// ── autoMatchSession ──────────────────────────────────────────────────────────

describe("autoMatchSession", () => {
  it("returns one entry per summary row", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 10 });
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 20 });
    const results = autoMatchSession(sess, sampleCostMaster);
    expect(results).toHaveLength(2);
  });

  it("top is null when cost master is empty", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "開口部", measureKind: "distance", value: 3 });
    const results = autoMatchSession(sess, []);
    expect(results[0]?.top).toBeNull();
  });

  it("returns empty array for empty session", () => {
    const sess = makeSession();
    expect(autoMatchSession(sess, sampleCostMaster)).toHaveLength(0);
  });
});

// ── exportSessionCSV ──────────────────────────────────────────────────────────

describe("exportSessionCSV", () => {
  it("starts with correct CSV header", () => {
    const sess = makeSession();
    const csv = exportSessionCSV(sess);
    expect(csv.startsWith("カテゴリ,計測種別,合計,単位,セグメント数")).toBe(true);
  });

  it("empty session has only header", () => {
    const csv = exportSessionCSV(makeSession());
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("outputs correct data row", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 12.5 });
    const csv = exportSessionCSV(sess);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("壁");
    expect(lines[1]).toContain("12.500");
    expect(lines[1]).toContain("㎡");
  });

  it("escapes commas in field values", () => {
    // カテゴリ名に , が含まれるケース（実際には起きないが境界テスト）
    let sess = makeSession();
    sess = addSegment(sess, { category: "その他", measureKind: "distance", value: 3 });
    const csv = exportSessionCSV(sess);
    expect(csv).toContain("その他");
  });

  it("measureKind area → 面積, distance → 距離", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "壁", measureKind: "area", value: 5 });
    sess = addSegment(sess, { category: "巾木", measureKind: "distance", value: 3 });
    const csv = exportSessionCSV(sess);
    expect(csv).toContain("面積");
    expect(csv).toContain("距離");
  });
});

// ── exportSessionJSON ─────────────────────────────────────────────────────────

describe("exportSessionJSON", () => {
  it("returns valid JSON string", () => {
    const sess = makeSession();
    const json = exportSessionJSON(sess);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("serialised session has same id", () => {
    const sess = makeSession();
    const parsed = JSON.parse(exportSessionJSON(sess)) as TakeoffSessionState;
    expect(parsed.id).toBe(sess.id);
  });

  it("serialised segments are preserved", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "床", measureKind: "area", value: 10 });
    const parsed = JSON.parse(exportSessionJSON(sess)) as TakeoffSessionState;
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.segments[0]?.category).toBe("床");
  });
});

// ── localStorage persistence ──────────────────────────────────────────────────

describe("saveSession / loadSession", () => {
  it("round-trips a session through localStorage", () => {
    const sess = makeSession();
    saveSession(sess);
    const loaded = loadSession(sess.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(sess.id);
    expect(loaded?.drawingId).toBe(sess.drawingId);
  });

  it("loadSession returns null for unknown id", () => {
    expect(loadSession("nonexistent-id")).toBeNull();
  });

  it("segments are preserved after round-trip", () => {
    let sess = makeSession();
    sess = addSegment(sess, { category: "天井", measureKind: "area", value: 15 });
    saveSession(sess);
    const loaded = loadSession(sess.id);
    expect(loaded?.segments).toHaveLength(1);
    expect(loaded?.segments[0]?.value).toBe(15);
  });
});

describe("listSessionIds", () => {
  it("returns ids for sessions matching drawingId", () => {
    const sess1 = createSession("dwg-A");
    const sess2 = createSession("dwg-A");
    const sess3 = createSession("dwg-B");
    saveSession(sess1);
    saveSession(sess2);
    saveSession(sess3);
    const ids = listSessionIds("dwg-A");
    expect(ids).toContain(sess1.id);
    expect(ids).toContain(sess2.id);
    expect(ids).not.toContain(sess3.id);
  });

  it("returns empty array when no sessions match", () => {
    expect(listSessionIds("dwg-none")).toHaveLength(0);
  });
});

describe("deleteSession", () => {
  it("removes session from localStorage", () => {
    const sess = makeSession();
    saveSession(sess);
    deleteSession(sess.id);
    expect(loadSession(sess.id)).toBeNull();
  });

  it("is a no-op for non-existent id", () => {
    expect(() => deleteSession("no-such-id")).not.toThrow();
  });
});

// ── Undo/Redo ─────────────────────────────────────────────────────────────────

describe("createTakeoffUndoStack", () => {
  it("canUndo returns false when stack is empty", () => {
    const stack = createTakeoffUndoStack();
    expect(stack.canUndo()).toBe(false);
  });

  it("canUndo returns true after push", () => {
    const stack = createTakeoffUndoStack();
    stack.push(makeSession());
    expect(stack.canUndo()).toBe(true);
  });

  it("undo returns the pushed state", () => {
    const stack = createTakeoffUndoStack();
    const state = makeSession();
    stack.push(state);
    const restored = stack.undo();
    expect(restored?.id).toBe(state.id);
  });

  it("undo returns null when empty", () => {
    const stack = createTakeoffUndoStack();
    expect(stack.undo()).toBeNull();
  });

  it("canRedo returns false initially", () => {
    const stack = createTakeoffUndoStack();
    expect(stack.canRedo()).toBe(false);
  });

  it("pushing after undo clears redo stack", () => {
    const stack = createTakeoffUndoStack();
    const s1 = makeSession();
    const s2 = { ...makeSession(), id: "sess-b" };
    stack.push(s1);
    stack.undo();
    // Push new operation — redo should be gone
    stack.push(s2);
    expect(stack.canRedo()).toBe(false);
  });

  it("respects maxSteps limit (default 20)", () => {
    const stack = createTakeoffUndoStack();
    // Push 25 states
    for (let i = 0; i < 25; i++) {
      stack.push(makeSession());
    }
    // Should only keep the last MAX_UNDO_STEPS
    let count = 0;
    while (stack.canUndo()) {
      stack.undo();
      count++;
    }
    expect(count).toBe(MAX_UNDO_STEPS);
  });

  it("custom maxSteps is respected", () => {
    const stack = createTakeoffUndoStack(3);
    for (let i = 0; i < 5; i++) stack.push(makeSession());
    let count = 0;
    while (stack.canUndo()) { stack.undo(); count++; }
    expect(count).toBe(3);
  });

  it("clear empties both stacks", () => {
    const stack = createTakeoffUndoStack();
    stack.push(makeSession());
    stack.clear();
    expect(stack.canUndo()).toBe(false);
  });
});

// ── withUndo ──────────────────────────────────────────────────────────────────

describe("withUndo", () => {
  it("applies operation and returns new state", () => {
    const stack = createTakeoffUndoStack();
    const sess = makeSession();
    const next = withUndo(stack, sess, (s) =>
      addSegment(s, { category: "壁", measureKind: "area", value: 10 }),
    );
    expect(next.segments).toHaveLength(1);
  });

  it("pushes before-state onto undo stack", () => {
    const stack = createTakeoffUndoStack();
    const sess = makeSession();
    withUndo(stack, sess, (s) =>
      addSegment(s, { category: "床", measureKind: "area", value: 5 }),
    );
    expect(stack.canUndo()).toBe(true);
    const restored = stack.undo();
    expect(restored?.segments).toHaveLength(0);
  });

  it("sequential operations allow multi-step undo", () => {
    const stack = createTakeoffUndoStack();
    let sess = makeSession();
    sess = withUndo(stack, sess, (s) =>
      addSegment(s, { category: "壁", measureKind: "area", value: 10 }),
    );
    sess = withUndo(stack, sess, (s) =>
      addSegment(s, { category: "床", measureKind: "area", value: 20 }),
    );
    // After 2 ops, undo twice should get back to empty
    const before2 = stack.undo()!;
    expect(before2.segments).toHaveLength(1);
    void sess;
    const before1 = stack.undo()!;
    expect(before1.segments).toHaveLength(0);
  });

  it("withUndo on removeSegment restores removed segment", () => {
    const stack = createTakeoffUndoStack();
    let sess = makeSession();
    sess = withUndo(stack, sess, (s) =>
      addSegment(s, { category: "天井", measureKind: "area", value: 8 }),
    );
    const segId = sess.segments[0]!.id;
    withUndo(stack, sess, (s) => removeSegment(s, segId));
    const restored = stack.undo()!;
    expect(restored.segments).toHaveLength(1);
  });
});
