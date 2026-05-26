/**
 * case-store.ts のテスト (Sprint 12-A)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PastCaseStore, resetPastCaseStore, getSeedCases } from "../lib/site-ai-assistant/case-store.js";
import { IssueCategory } from "../lib/site-ai-assistant/types.js";
import type { PastCase } from "../lib/site-ai-assistant/types.js";

// localStorage のモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

function makeCase(overrides: Partial<PastCase> = {}): PastCase {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    category: IssueCategory.coordination,
    problemSummary: "テスト課題",
    solutionSummary: "テスト解決策",
    resolvedAt: "2024-01-01T00:00:00Z",
    satisfaction: 4,
    ...overrides,
  };
}

describe("PastCaseStore", () => {
  let store: PastCaseStore;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    resetPastCaseStore();
    store = new PastCaseStore();
  });

  // ── CRUD ────────────────────────────────────────────────────────────────

  describe("addCase", () => {
    it("ケースを追加できる", () => {
      const pc = makeCase({ id: "add-1" });
      store.addCase(pc);
      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].id).toBe("add-1");
    });

    it("複数ケースを追加できる", () => {
      store.addCase(makeCase({ id: "a1" }));
      store.addCase(makeCase({ id: "a2" }));
      store.addCase(makeCase({ id: "a3" }));
      expect(store.getAll()).toHaveLength(3);
    });

    it("localStorage に保存される", () => {
      store.addCase(makeCase({ id: "save-1" }));
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe("removeCase", () => {
    it("IDで特定のケースを削除できる", () => {
      store.addCase(makeCase({ id: "del-1" }));
      store.addCase(makeCase({ id: "del-2" }));
      store.removeCase("del-1");
      const all = store.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("del-2");
    });

    it("存在しないIDを削除しても何も起きない", () => {
      store.addCase(makeCase({ id: "keep-1" }));
      store.removeCase("nonexistent");
      expect(store.getAll()).toHaveLength(1);
    });
  });

  describe("findByCategory", () => {
    it("カテゴリでフィルタできる", () => {
      store.addCase(makeCase({ id: "c1", category: IssueCategory.material_shortage }));
      store.addCase(makeCase({ id: "c2", category: IssueCategory.weather_delay }));
      store.addCase(makeCase({ id: "c3", category: IssueCategory.material_shortage }));
      const result = store.findByCategory(IssueCategory.material_shortage);
      expect(result).toHaveLength(2);
      expect(result.every((c) => c.category === IssueCategory.material_shortage)).toBe(true);
    });

    it("マッチしないカテゴリは空配列を返す", () => {
      store.addCase(makeCase({ category: IssueCategory.coordination }));
      expect(store.findByCategory(IssueCategory.safety_concern)).toHaveLength(0);
    });
  });

  describe("searchByKeywords", () => {
    it("problemSummary のキーワードでスコアリングできる", () => {
      store.addCase(
        makeCase({
          id: "kw-1",
          problemSummary: "塗料が足りない 材料不足",
          solutionSummary: "代替品を調達",
        })
      );
      store.addCase(
        makeCase({
          id: "kw-2",
          problemSummary: "天候不良で工程遅れ",
          solutionSummary: "雨天作業に切り替え",
        })
      );
      const results = store.searchByKeywords("塗料が足りない");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pastCase.id).toBe("kw-1");
    });

    it("solutionSummary のキーワードでもヒットする", () => {
      store.addCase(
        makeCase({
          id: "sol-kw",
          problemSummary: "問題発生",
          solutionSummary: "専門業者に修理を依頼",
        })
      );
      const results = store.searchByKeywords("専門業者");
      expect(results.length).toBeGreaterThan(0);
    });

    it("マッチしないクエリは空配列を返す", () => {
      store.addCase(makeCase({ problemSummary: "内装工事の問題", solutionSummary: "対応済み" }));
      const results = store.searchByKeywords("XYZABCDEF");
      expect(results).toHaveLength(0);
    });

    it("スコアが高い順に返す", () => {
      store.addCase(
        makeCase({ id: "high", problemSummary: "材料 足りない 在庫不足 欠品", solutionSummary: "材料調達" })
      );
      store.addCase(
        makeCase({ id: "low", problemSummary: "材料の問題", solutionSummary: "対応" })
      );
      const results = store.searchByKeywords("材料 足りない 在庫不足");
      expect(results[0].pastCase.id).toBe("high");
    });

    it("topN パラメータで件数を制限できる", () => {
      for (let i = 0; i < 15; i++) {
        store.addCase(makeCase({ id: `topn-${i}`, problemSummary: "共通キーワード問題発生" }));
      }
      const results = store.searchByKeywords("共通キーワード", 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("FIFO (1000件上限)", () => {
    it("1000件を超えると古いケースが削除される", () => {
      for (let i = 0; i < 1001; i++) {
        store.addCase(makeCase({ id: `fifo-${i}` }));
      }
      const all = store.getAll();
      expect(all).toHaveLength(1000);
      // 最初のケース (fifo-0) が削除されていること
      expect(all.find((c) => c.id === "fifo-0")).toBeUndefined();
      // 最後のケース (fifo-1000) が残っていること
      expect(all.find((c) => c.id === "fifo-1000")).toBeDefined();
    });
  });

  describe("seed", () => {
    it("seed() で20件のシードデータが投入される", () => {
      store.seed();
      expect(store.getAll()).toHaveLength(20);
    });

    it("seed() を2回呼んでも重複しない", () => {
      store.seed();
      store.seed();
      expect(store.getAll()).toHaveLength(20);
    });

    it("シードデータは全カテゴリを含む", () => {
      store.seed();
      const categories = new Set(store.getAll().map((c) => c.category));
      // 全8カテゴリが含まれる
      expect(categories.size).toBe(8);
    });
  });

  describe("getSeedCases", () => {
    it("20件のシードデータを返す", () => {
      const seeds = getSeedCases();
      expect(seeds).toHaveLength(20);
    });

    it("全件がユニークなIDを持つ", () => {
      const seeds = getSeedCases();
      const ids = seeds.map((s) => s.id);
      expect(new Set(ids).size).toBe(20);
    });
  });

  describe("clear", () => {
    it("clear() でストアが空になる", () => {
      store.addCase(makeCase());
      store.addCase(makeCase());
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe("EventTarget", () => {
    it("addCase で change イベントが発火する", () => {
      const listener = vi.fn();
      store.addEventListener("change", listener);
      store.addCase(makeCase());
      expect(listener).toHaveBeenCalledOnce();
    });

    it("removeCase で change イベントが発火する", () => {
      const pc = makeCase({ id: "evt-1" });
      store.addCase(pc);
      const listener = vi.fn();
      store.addEventListener("change", listener);
      store.removeCase("evt-1");
      expect(listener).toHaveBeenCalledOnce();
    });
  });
});
