import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  drawBlackboard,
  loadTemplates,
  saveTemplate,
  deleteTemplate,
  type BlackboardData,
  type BlackboardTemplate,
} from "./digital-blackboard.js";

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

const makeData = (overrides: Partial<BlackboardData> = {}): BlackboardData => ({
  projectName: "テスト工事",
  shootDate: "2025-04-01",
  workType: "内装工事",
  location: "1F天井",
  condition: "施工中",
  ...overrides,
});

// Minimal CanvasRenderingContext2D mock
function makeCtx() {
  const calls: string[] = [];
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textBaseline: "",
    font: "",
    _calls: calls,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn((...args: unknown[]) => calls.push("fillText:" + String(args[0]))),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    drawImage: vi.fn(),
  };
}

describe("drawBlackboard", () => {
  it("calls fillText with project name", () => {
    const ctx = makeCtx();
    drawBlackboard(ctx as unknown as CanvasRenderingContext2D, 800, 600, makeData());
    const texts = ctx._calls.map((c) => c.replace("fillText:", ""));
    expect(texts.some((t) => t.includes("テスト工事"))).toBe(true);
  });

  it("calls fillText with shoot date", () => {
    const ctx = makeCtx();
    drawBlackboard(ctx as unknown as CanvasRenderingContext2D, 800, 600, makeData());
    const texts = ctx._calls.map((c) => c.replace("fillText:", ""));
    expect(texts.some((t) => t.includes("2025-04-01"))).toBe(true);
  });

  it("calls fillText with work type", () => {
    const ctx = makeCtx();
    drawBlackboard(ctx as unknown as CanvasRenderingContext2D, 800, 600, makeData());
    const texts = ctx._calls.map((c) => c.replace("fillText:", ""));
    expect(texts.some((t) => t.includes("内装工事"))).toBe(true);
  });

  it("calls roundRect for board background", () => {
    const ctx = makeCtx();
    drawBlackboard(ctx as unknown as CanvasRenderingContext2D, 800, 600, makeData());
    expect(ctx.roundRect).toHaveBeenCalled();
  });
});

describe("template persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeMockStorage());
  });

  it("loads empty array when nothing saved", () => {
    expect(loadTemplates()).toEqual([]);
  });

  const tpl: BlackboardTemplate = {
    id: "t1",
    projectName: "工事A",
    workType: "内装",
  };

  it("saves and loads a template", () => {
    saveTemplate(tpl);
    const loaded = loadTemplates();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.projectName).toBe("工事A");
  });

  it("deletes a template", () => {
    saveTemplate(tpl);
    deleteTemplate("t1");
    expect(loadTemplates()).toHaveLength(0);
  });

  it("deduplicates by id on re-save", () => {
    saveTemplate(tpl);
    saveTemplate({ ...tpl, projectName: "工事A更新" });
    const loaded = loadTemplates();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.projectName).toBe("工事A更新");
  });
});
