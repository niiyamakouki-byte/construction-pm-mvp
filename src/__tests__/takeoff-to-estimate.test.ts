import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  sessionToEstimateItems,
  writeEstimateInject,
  readAndClearEstimateInject,
  TAKEOFF_INJECT_KEY,
} from "../lib/takeoff-to-estimate.js";
import {
  createSession,
  addSegment,
} from "../lib/takeoff-session.js";

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
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── sessionToEstimateItems ────────────────────────────────────────────────────

describe("sessionToEstimateItems", () => {
  it("空セッションは空配列を返す", () => {
    const session = createSession("d1");
    expect(sessionToEstimateItems(session)).toEqual([]);
  });

  it("面積セグメント1件: ㎡換算・code・name・unit・unitPrice=0 が正しい", () => {
    let session = createSession("d1");
    session = addSegment(session, {
      category: "床",
      measureKind: "area",
      value: 12.5,
    });
    const items = sessionToEstimateItems(session);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.code).toBe("TAKEOFF_床_area");
    expect(item.name).toBe("床（面積）");
    expect(item.unit).toBe("㎡");
    expect(item.unitPrice).toBe(0);
    expect(item.quantity).toBe(12.5);
  });

  it("距離セグメント1件: m換算・unit=m が正しい", () => {
    let session = createSession("d1");
    session = addSegment(session, {
      category: "巾木",
      measureKind: "distance",
      value: 8.333,
    });
    const items = sessionToEstimateItems(session);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.code).toBe("TAKEOFF_巾木_distance");
    expect(item.name).toBe("巾木（距離）");
    expect(item.unit).toBe("m");
    expect(item.quantity).toBe(8.33); // 小数点2桁丸め
  });

  it("複数カテゴリ: 別行になる", () => {
    let session = createSession("d1");
    session = addSegment(session, { category: "壁", measureKind: "area", value: 20 });
    session = addSegment(session, { category: "床", measureKind: "area", value: 10 });
    session = addSegment(session, { category: "壁", measureKind: "distance", value: 5 });
    const items = sessionToEstimateItems(session);
    // 壁面積・壁距離・床面積 の3行 (summariseSession 順)
    expect(items).toHaveLength(3);
    const codes = items.map((i) => i.code);
    expect(codes).toContain("TAKEOFF_壁_area");
    expect(codes).toContain("TAKEOFF_壁_distance");
    expect(codes).toContain("TAKEOFF_床_area");
  });

  it("同カテゴリ・同種の複数セグメントは合計される", () => {
    let session = createSession("d1");
    session = addSegment(session, { category: "天井", measureKind: "area", value: 5.5 });
    session = addSegment(session, { category: "天井", measureKind: "area", value: 4.5 });
    const items = sessionToEstimateItems(session);
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toBe(10);
  });

  it("quantity は小数点2桁丸めになる", () => {
    let session = createSession("d1");
    // 1/3 ≈ 0.3333...
    session = addSegment(session, { category: "廻り縁", measureKind: "distance", value: 1 / 3 });
    const items = sessionToEstimateItems(session);
    expect(items[0]!.quantity).toBe(0.33);
  });
});

// ── writeEstimateInject / readAndClearEstimateInject ──────────────────────────

describe("writeEstimateInject / readAndClearEstimateInject", () => {
  it("write → read で同じアイテムが返る", () => {
    const items = [
      { code: "TAKEOFF_壁_area", name: "壁（面積）", unit: "㎡", unitPrice: 0, quantity: 15 },
    ];
    writeEstimateInject(items);
    const result = readAndClearEstimateInject();
    expect(result).toEqual(items);
  });

  it("read 後はキーが削除される", () => {
    writeEstimateInject([
      { code: "TAKEOFF_床_area", name: "床（面積）", unit: "㎡", unitPrice: 0, quantity: 8 },
    ]);
    readAndClearEstimateInject();
    expect(mockStorage[TAKEOFF_INJECT_KEY]).toBeUndefined();
  });

  it("何も書かれていない場合は空配列を返す", () => {
    expect(readAndClearEstimateInject()).toEqual([]);
  });

  it("破損したJSONは空配列を返す", () => {
    mockStorage[TAKEOFF_INJECT_KEY] = "not-valid-json{{{";
    expect(readAndClearEstimateInject()).toEqual([]);
  });
});
